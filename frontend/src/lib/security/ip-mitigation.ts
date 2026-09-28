/**
 * Temporary IP mitigation engine for authentication threats.
 *
 * Design principles (deliberately NOT a permanent ban system):
 *  - Failed logins are treated with PROGRESSIVE responses: monitor -> rate
 *    limit -> temporary block. Blocks are always TEMPORARY and auto-expire.
 *  - Legitimate users who forget passwords must be able to recover (the app's
 *    /auth/forgot-password flow) without an admin ever touching their IP.
 *  - Every threshold, window and block duration is configurable.
 *  - Whitelisted IPs are never auto-blocked, but their events are still logged.
 *
 * Persistence is localStorage (MVP, no DB changes). The real enforcement seam
 * is POST /api/security/ip/action, which is where a production auth/WAF layer
 * would apply/remove the actual block.
 */

import type { Severity } from './types';

export type IpStatus =
  | 'MONITORED'
  | 'RATE_LIMITED'
  | 'TEMPORARILY_BLOCKED'
  | 'UNBLOCKED'
  | 'WHITELISTED';

export interface LevelRule {
  /** failed attempts within the window that trigger this level */
  attempts: number;
  /** observation window in minutes */
  windowMinutes: number;
  /** temporary block duration in minutes (HIGH/CRITICAL only) */
  blockMinutes?: number;
}

export interface MitigationConfig {
  low: LevelRule;
  medium: LevelRule;
  high: LevelRule;
  critical: LevelRule;
  /** rolling window (minutes) after which an idle counter resets */
  rollingWindowMinutes: number;
}

export const DEFAULT_CONFIG: MitigationConfig = {
  low: { attempts: 3, windowMinutes: 5 },
  medium: { attempts: 5, windowMinutes: 5 },
  high: { attempts: 10, windowMinutes: 10, blockMinutes: 15 },
  critical: { attempts: 20, windowMinutes: 15, blockMinutes: 30 },
  rollingWindowMinutes: 15,
};

export interface ManagedIp {
  ip: string;
  status: IpStatus;
  reason: string;
  threatLevel: Severity;
  failedAttempts: number;
  firstDetected: string;
  lastDetected: string;
  blockedUntil: string | null;
  windowStart: string;
  location?: string;
  isSimulated: boolean;
}

export type AuditAction =
  | 'MONITOR'
  | 'RATE_LIMIT'
  | 'AUTO_BLOCK'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'WHITELIST'
  | 'AUTO_EXPIRE';

export interface AuditEntry {
  id: string;
  timestamp: string;
  administrator: string; // email, or 'system' for automatic actions
  ip: string;
  action: AuditAction;
  reason: string;
  previousStatus: IpStatus | '-';
  newStatus: IpStatus;
  isSimulated: boolean;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface Classification {
  severity: Severity;
  status: IpStatus;
  blockMinutes: number | null;
  alert: boolean;
}

/** Map a failed-attempt count to a progressive response using the config. */
export function classify(attempts: number, config: MitigationConfig): Classification {
  if (attempts >= config.critical.attempts) {
    return { severity: 'CRITICAL', status: 'TEMPORARILY_BLOCKED', blockMinutes: config.critical.blockMinutes ?? 30, alert: true };
  }
  if (attempts >= config.high.attempts) {
    return { severity: 'HIGH', status: 'TEMPORARILY_BLOCKED', blockMinutes: config.high.blockMinutes ?? 15, alert: false };
  }
  if (attempts >= config.medium.attempts) {
    return { severity: 'MEDIUM', status: 'RATE_LIMITED', blockMinutes: null, alert: false };
  }
  if (attempts >= config.low.attempts) {
    return { severity: 'LOW', status: 'MONITORED', blockMinutes: null, alert: false };
  }
  return { severity: 'LOW', status: 'MONITORED', blockMinutes: null, alert: false };
}

let auditSeq = 0;
function auditId(): string {
  auditSeq += 1;
  return `aud_${Date.now().toString(36)}_${auditSeq}`;
}

function mkAudit(
  ip: string,
  action: AuditAction,
  reason: string,
  prev: IpStatus | '-',
  next: IpStatus,
  administrator: string,
  isSimulated: boolean,
): AuditEntry {
  return {
    id: auditId(),
    timestamp: new Date().toISOString(),
    administrator,
    ip,
    action,
    reason,
    previousStatus: prev,
    newStatus: next,
    isSimulated,
  };
}

// ---------------------------------------------------------------------------
// Recording failures (drives auto rate-limit / temporary block)
// ---------------------------------------------------------------------------

interface FailureMeta {
  location?: string;
  isSimulated: boolean;
  /** absolute attempts count to set (scenario); if omitted, increments by 1 */
  setAttempts?: number;
}

export interface MitigationResult {
  records: ManagedIp[];
  audits: AuditEntry[];
}

/**
 * Record failed authentication attempt(s) for an IP and apply the progressive
 * response. Returns the new records plus any audit entries produced (e.g. an
 * automatic temporary block). Whitelisted IPs are counted but never blocked.
 */
export function recordFailure(
  records: ManagedIp[],
  ip: string,
  meta: FailureMeta,
  config: MitigationConfig,
  now: Date = new Date(),
): MitigationResult {
  const nowIso = now.toISOString();
  const rollingMs = config.rollingWindowMinutes * 60_000;
  const audits: AuditEntry[] = [];
  const next = [...records];
  const idx = next.findIndex((r) => r.ip === ip);

  let rec: ManagedIp;
  if (idx === -1) {
    rec = {
      ip,
      status: 'MONITORED',
      reason: 'Repeated failed login attempts',
      threatLevel: 'LOW',
      failedAttempts: 0,
      firstDetected: nowIso,
      lastDetected: nowIso,
      blockedUntil: null,
      windowStart: nowIso,
      location: meta.location,
      isSimulated: meta.isSimulated,
    };
  } else {
    rec = { ...next[idx] };
  }

  // Rolling-window reset (idle counter decays) — unless currently blocked.
  if (rec.status !== 'TEMPORARILY_BLOCKED' && now.getTime() - new Date(rec.windowStart).getTime() > rollingMs) {
    rec.windowStart = nowIso;
    rec.failedAttempts = 0;
  }

  rec.failedAttempts = meta.setAttempts != null ? meta.setAttempts : rec.failedAttempts + 1;
  rec.lastDetected = nowIso;
  if (meta.location) rec.location = meta.location;

  // Whitelisted IPs: log the attempt, but do not escalate/block.
  if (rec.status === 'WHITELISTED') {
    if (idx === -1) next.push(rec);
    else next[idx] = rec;
    return { records: next, audits };
  }

  const prevStatus = rec.status;
  const cls = classify(rec.failedAttempts, config);
  rec.threatLevel = cls.severity;

  if (cls.status === 'TEMPORARILY_BLOCKED') {
    // Only (re)issue an audit/block on transition into blocked or when escalating.
    const wasBlocked = prevStatus === 'TEMPORARILY_BLOCKED';
    rec.status = 'TEMPORARILY_BLOCKED';
    rec.blockedUntil = new Date(now.getTime() + (cls.blockMinutes ?? 15) * 60_000).toISOString();
    rec.reason = `${rec.failedAttempts} failed login attempts`;
    if (!wasBlocked) {
      audits.push(
        mkAudit(
          ip,
          'AUTO_BLOCK',
          `${rec.failedAttempts} failed login attempts (${cls.severity}) — temporary ${cls.blockMinutes}m block`,
          prevStatus === 'MONITORED' && idx === -1 ? '-' : prevStatus,
          'TEMPORARILY_BLOCKED',
          'system',
          meta.isSimulated,
        ),
      );
    }
  } else if (cls.status === 'RATE_LIMITED') {
    if (prevStatus !== 'RATE_LIMITED') {
      rec.status = 'RATE_LIMITED';
      rec.reason = `${rec.failedAttempts} failed login attempts`;
      audits.push(mkAudit(ip, 'RATE_LIMIT', `${rec.failedAttempts} failed attempts — rate limiting applied`, prevStatus, 'RATE_LIMITED', 'system', meta.isSimulated));
    }
  } else {
    // MONITORED
    if (prevStatus !== 'TEMPORARILY_BLOCKED') rec.status = 'MONITORED';
  }

  if (idx === -1) next.push(rec);
  else next[idx] = rec;
  return { records: next, audits };
}

// ---------------------------------------------------------------------------
// Automatic expiry
// ---------------------------------------------------------------------------

/** Expire any temporary blocks whose blockedUntil has passed. */
export function autoExpire(records: ManagedIp[], now: Date = new Date()): MitigationResult {
  const audits: AuditEntry[] = [];
  const next = records.map((r) => {
    if (r.status === 'TEMPORARILY_BLOCKED' && r.blockedUntil && new Date(r.blockedUntil).getTime() <= now.getTime()) {
      audits.push(mkAudit(r.ip, 'AUTO_EXPIRE', 'Temporary block expired automatically', 'TEMPORARILY_BLOCKED', 'MONITORED', 'system', r.isSimulated));
      return { ...r, status: 'MONITORED' as IpStatus, blockedUntil: null, failedAttempts: 0, windowStart: now.toISOString() };
    }
    return r;
  });
  return { records: next, audits };
}

// ---------------------------------------------------------------------------
// Manual administrator actions
// ---------------------------------------------------------------------------

export function manualUnblock(records: ManagedIp[], ip: string, admin: string, reason: string): MitigationResult {
  const audits: AuditEntry[] = [];
  const next = records.map((r) => {
    if (r.ip !== ip) return r;
    audits.push(mkAudit(ip, 'UNBLOCK', reason, r.status, 'UNBLOCKED', admin, r.isSimulated));
    return { ...r, status: 'UNBLOCKED' as IpStatus, blockedUntil: null, failedAttempts: 0, windowStart: new Date().toISOString() };
  });
  return { records: next, audits };
}

export function manualWhitelist(records: ManagedIp[], ip: string, admin: string, reason: string): MitigationResult {
  const audits: AuditEntry[] = [];
  const next = records.map((r) => {
    if (r.ip !== ip) return r;
    audits.push(mkAudit(ip, 'WHITELIST', reason, r.status, 'WHITELISTED', admin, r.isSimulated));
    return { ...r, status: 'WHITELISTED' as IpStatus, blockedUntil: null };
  });
  return { records: next, audits };
}

/**
 * Immediately temporarily-block an IP on a positive threat detection (e.g. a
 * WAF matching a SQL-injection / XSS payload). Unlike recordFailure this does
 * not wait for a login-attempt threshold — the malicious signature itself is
 * the trigger. Whitelisted IPs are left untouched (still logged elsewhere).
 */
export function blockForDetection(
  records: ManagedIp[],
  ip: string,
  opts: { reason: string; severity: Severity; minutes: number; attempts?: number; location?: string; isSimulated: boolean },
  now: Date = new Date(),
): MitigationResult {
  const nowIso = now.toISOString();
  const audits: AuditEntry[] = [];
  const next = [...records];
  const idx = next.findIndex((r) => r.ip === ip);
  const blockedUntil = new Date(now.getTime() + opts.minutes * 60_000).toISOString();

  const existing = idx === -1 ? null : next[idx];
  if (existing && existing.status === 'WHITELISTED') {
    return { records: next, audits };
  }

  const rec: ManagedIp = {
    ip,
    status: 'TEMPORARILY_BLOCKED',
    reason: opts.reason,
    threatLevel: opts.severity,
    failedAttempts: opts.attempts ?? existing?.failedAttempts ?? 0,
    firstDetected: existing?.firstDetected ?? nowIso,
    lastDetected: nowIso,
    blockedUntil,
    windowStart: existing?.windowStart ?? nowIso,
    location: opts.location ?? existing?.location,
    isSimulated: opts.isSimulated,
  };

  audits.push(
    mkAudit(
      ip,
      'AUTO_BLOCK',
      `${opts.reason} (${opts.severity}) — temporary ${opts.minutes}m block`,
      existing ? existing.status : '-',
      'TEMPORARILY_BLOCKED',
      'system',
      opts.isSimulated,
    ),
  );

  if (idx === -1) next.push(rec);
  else next[idx] = rec;
  return { records: next, audits };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const IP_KEY = 'soc_managed_ips_v1';
const AUDIT_KEY = 'soc_audit_log_v1';
const CONFIG_KEY = 'soc_mitigation_config_v1';
const MAX_AUDIT = 200;

export function loadManagedIps(): ManagedIp[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(IP_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveManagedIps(list: ManagedIp[]): void {
  try {
    localStorage.setItem(IP_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}
export function loadAudit(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  } catch {
    return [];
  }
}
export function saveAudit(list: AuditEntry[]): void {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, MAX_AUDIT)));
  } catch {
    /* quota */
  }
}
export function loadConfig(): MitigationConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}
export function saveConfig(config: MitigationConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* quota */
  }
}

export function fmtCountdown(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
