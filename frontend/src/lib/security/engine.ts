/**
 * Client-side SOC engine.
 *
 * Responsibilities:
 *  - Deterministic helpers (severity ranking, status colours, IP masking).
 *  - Local persistence of scan history + score history (localStorage) so the
 *    MVP works with zero database changes. The API routes document where a
 *    real DB / log source should take over.
 *  - The DEMO simulation engine: generates CLEARLY-LABELLED simulated events
 *    (isSimulated: true) and scripted incident scenarios for presentations.
 *
 * Nothing in here fabricates real attacks: simulated data is only ever used
 * while the dashboard is in DEMO mode, and is always flagged isSimulated.
 */

import type {
  Severity,
  SystemStatus,
  SecurityEvent,
  ScanResult,
  EventAction,
} from './types';

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

export const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  LOW: '#38bdf8', // sky
  MEDIUM: '#f59e0b', // amber
  HIGH: '#fb923c', // orange
  CRITICAL: '#ef4444', // red
};

export const STATUS_ACCENT: Record<SystemStatus, string> = {
  PROTECTED: '#22c55e',
  WARNING: '#f59e0b',
  THREAT: '#ef4444',
};

export function statusFromScore(score: number): SystemStatus {
  if (score >= 85) return 'PROTECTED';
  if (score >= 60) return 'WARNING';
  return 'THREAT';
}

/** Masks an IPv4 address: 102.145.20.41 -> 102.***.***.41 */
export function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.***.***.${parts[3]}`;
  // IPv6 or unknown: keep the first block only
  const seg = ip.split(':');
  if (seg.length > 2) return `${seg[0]}:****:****:${seg[seg.length - 1]}`;
  return ip;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

let idc = 0;
export function uid(prefix = 'evt'): string {
  idc += 1;
  return `${prefix}_${Date.now().toString(36)}_${idc}`;
}

// ---------------------------------------------------------------------------
// Local persistence (scan + score history)
// ---------------------------------------------------------------------------

const SCAN_KEY = 'soc_scan_history_v1';
const MAX_HISTORY = 25;

export function loadScanHistory(): ScanResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SCAN_KEY);
    return raw ? (JSON.parse(raw) as ScanResult[]) : [];
  } catch {
    return [];
  }
}

export function saveScan(scan: ScanResult): ScanResult[] {
  const history = [scan, ...loadScanHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(SCAN_KEY, JSON.stringify(history));
  } catch {
    /* ignore quota */
  }
  return history;
}

// ---------------------------------------------------------------------------
// DEMO simulation engine  (all output is isSimulated: true)
// ---------------------------------------------------------------------------

const SIM_IPS = [
  '102.145.20.41',
  '41.203.72.17',
  '197.210.55.83',
  '154.113.9.220',
  '105.112.44.6',
  '160.152.18.199',
  '45.83.201.14',
  '185.220.101.7',
];

const SIM_LOCATIONS = [
  'Lagos, NG',
  'Abuja, NG',
  'Kano, NG',
  'Amsterdam, NL',
  'Frankfurt, DE',
  'Unknown',
  'Ashburn, US',
  'Kyiv, UA',
];

const SIM_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/dashboard/admin',
  '/wp-admin.php',
  '/.env',
  '/api/v1/users',
  '/admin/config',
  '/api/v1/properties',
  '/phpmyadmin',
  '/api/v1/sales',
];

const SIM_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'python-requests/2.31.0',
  'curl/8.4.0',
  'sqlmap/1.7',
  'Mozilla/5.0 (Linux; Android 13)',
  'Go-http-client/2.0',
];

interface EventTemplate {
  eventType: string;
  severity: Severity;
  action: EventAction;
  status: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  { eventType: 'Repeated failed login', severity: 'MEDIUM', action: 'MONITOR', status: 401 },
  { eventType: 'Brute force pattern', severity: 'HIGH', action: 'RATE_LIMITED', status: 401 },
  { eventType: 'Excessive requests', severity: 'MEDIUM', action: 'RATE_LIMITED', status: 429 },
  { eventType: 'Endpoint probing', severity: 'LOW', action: 'MONITOR', status: 404 },
  { eventType: '404 enumeration', severity: 'LOW', action: 'MONITOR', status: 404 },
  { eventType: '403 activity', severity: 'LOW', action: 'MONITOR', status: 403 },
  { eventType: 'Suspicious user agent', severity: 'MEDIUM', action: 'CHALLENGED', status: 200 },
  { eventType: 'Rate limit violation', severity: 'HIGH', action: 'RATE_LIMITED', status: 429 },
  { eventType: 'SQL injection pattern detected', severity: 'HIGH', action: 'BLOCKED', status: 403 },
  { eventType: 'XSS pattern detected', severity: 'HIGH', action: 'BLOCKED', status: 403 },
  { eventType: 'Credential stuffing pattern', severity: 'CRITICAL', action: 'BLOCKED', status: 401 },
  { eventType: 'Geographic anomaly', severity: 'MEDIUM', action: 'INVESTIGATING', status: 200 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate one clearly-labelled simulated event, optionally pinned severity. */
export function makeSimEvent(opts?: {
  severity?: Severity;
  ip?: string;
  eventType?: string;
  attempts?: number;
}): SecurityEvent {
  let tpl = pick(EVENT_TEMPLATES);
  if (opts?.severity) {
    const matching = EVENT_TEMPLATES.filter((t) => t.severity === opts.severity);
    if (matching.length) tpl = pick(matching);
  }
  return {
    id: uid('sim'),
    timestamp: new Date().toISOString(),
    ipAddress: opts?.ip ?? pick(SIM_IPS),
    eventType: opts?.eventType ?? tpl.eventType,
    severity: opts?.severity ?? tpl.severity,
    location: pick(SIM_LOCATIONS),
    requestPath: pick(SIM_PATHS),
    userAgent: pick(SIM_AGENTS),
    status: tpl.status,
    action: tpl.action,
    source: 'simulation',
    isSimulated: true,
    attempts: opts?.attempts,
  };
}

/**
 * Scripted escalating incident: repeated authentication attempts that climb
 * 5 -> 12 -> 27 -> 45 and escalate LOW -> MEDIUM -> HIGH -> CRITICAL.
 * Returns a cancel() function. Each step invokes `onStep` with a fresh
 * simulated event plus the running incident summary.
 */
export interface ScenarioStep {
  event: SecurityEvent;
  attempts: number;
  severity: Severity;
  status: SystemStatus;
}

export function runAuthAttackScenario(
  onStep: (step: ScenarioStep) => void,
  stepMs = 1600,
): () => void {
  const ip = pick(SIM_IPS);
  const ladder: Array<{ attempts: number; severity: Severity; status: SystemStatus }> = [
    { attempts: 5, severity: 'LOW', status: 'PROTECTED' },
    { attempts: 12, severity: 'MEDIUM', status: 'WARNING' },
    { attempts: 27, severity: 'HIGH', status: 'WARNING' },
    { attempts: 45, severity: 'CRITICAL', status: 'THREAT' },
  ];
  let i = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;

  const fire = () => {
    if (cancelled || i >= ladder.length) return;
    const rung = ladder[i];
    const event = makeSimEvent({
      severity: rung.severity,
      ip,
      eventType: 'Repeated authentication attempts',
      attempts: rung.attempts,
    });
    event.requestPath = '/api/v1/auth/login';
    event.action = rung.status === 'THREAT' ? 'BLOCKED' : 'RATE_LIMITED';
    onStep({ event, attempts: rung.attempts, severity: rung.severity, status: rung.status });
    i += 1;
    if (i < ladder.length) timers.push(setTimeout(fire, stepMs));
  };

  timers.push(setTimeout(fire, 300));
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}
