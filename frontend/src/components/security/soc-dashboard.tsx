'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  ScanLine,
  AlertTriangle,
  Ban,
  Radar,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Server,
  Clock,
  Zap,
  Bug,
  Gauge as GaugeIcon,
  ListChecks,
  History,
  Play,
  Square,
  Lock,
  Unlock,
  X,
  MapPin,
  Globe,
  Fingerprint,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import type {
  AdminMode,
  DataMode,
  SystemStatus,
  SecurityEvent,
  ScanResult,
  Severity,
  Incident,
} from '@/lib/security/types';
import { toast } from 'sonner';
import {
  STATUS_ACCENT,
  SEVERITY_COLOR,
  maskIp,
  fmtTime,
  timeAgo,
  loadScanHistory,
  saveScan,
  makeSimEvent,
  runAuthAttackScenario,
} from '@/lib/security/engine';
import { getUser } from '@/lib/auth-storage';
import {
  type ManagedIp,
  type AuditEntry,
  type MitigationConfig,
  type IpStatus,
  DEFAULT_CONFIG,
  loadManagedIps,
  saveManagedIps,
  loadAudit,
  saveAudit,
  loadConfig,
  saveConfig,
  recordFailure,
  autoExpire,
  manualUnblock,
  manualWhitelist,
  blockForDetection,
  fmtCountdown,
} from '@/lib/security/ip-mitigation';

const SCAN_STAGES = [
  'Initializing security scanner',
  'Checking HTTP response',
  'Checking SSL/TLS',
  'Checking security headers',
  'Checking exposed endpoints',
  'Checking authentication endpoints',
  'Checking suspicious traffic',
  'Checking rate limits',
  'Checking configuration',
  'Calculating security score',
];

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_EVENTS = 40;

const STATUS_LABEL: Record<SystemStatus, string> = {
  PROTECTED: 'PROTECTED',
  WARNING: 'WARNING',
  THREAT: 'THREAT DETECTED',
};

// Preset SQL-injection attack: 5 distinct simulated sources, each blocked.
const SQLI_ATTACKERS: Array<{ ip: string; location: string }> = [
  { ip: '45.147.230.12', location: 'Amsterdam, NL' },
  { ip: '193.42.33.81', location: 'Frankfurt, DE' },
  { ip: '89.248.165.74', location: 'Unknown' },
  { ip: '185.220.101.33', location: 'Kyiv, UA' },
  { ip: '141.98.11.29', location: 'Ashburn, US' },
];
const SQLI_PAYLOADS = [
  "/api/v1/auth/login?email=admin'--",
  "/api/v1/properties?id=1' OR '1'='1",
  "/api/v1/users?q=1; DROP TABLE users;--",
  "/api/v1/sales?ref=1' UNION SELECT password FROM users--",
  "/api/v1/clients?id=1'; WAITFOR DELAY '0:0:5'--",
];

// ---------------------------------------------------------------------------

export function SocDashboard() {
  const [adminMode, setAdminMode] = useState<AdminMode>('AUTO');
  const dataMode: DataMode = adminMode === 'DEMO' ? 'DEMO' : 'LIVE';

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [simStatus, setSimStatus] = useState<SystemStatus>('PROTECTED');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [revealIps, setRevealIps] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Threat detail (clickable analysis)
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [selectedIp, setSelectedIp] = useState<ManagedIp | null>(null);

  // IP mitigation state
  const [managedIps, setManagedIps] = useState<ManagedIp[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [mitConfig, setMitConfig] = useState<MitigationConfig>(DEFAULT_CONFIG);
  const [confirmAction, setConfirmAction] = useState<{ ip: string; kind: 'unblock' | 'whitelist' } | null>(null);
  const [, setTick] = useState(0); // forces countdown re-render
  const adminEmail = useRef<string>('administrator');

  useEffect(() => {
    adminEmail.current = getUser()?.email || 'administrator';
    setManagedIps(loadManagedIps());
    setAuditLog(loadAudit());
    setMitConfig(loadConfig());
  }, []);

  // Persist mitigation state whenever it changes.
  useEffect(() => { saveManagedIps(managedIps); }, [managedIps]);
  useEffect(() => { saveAudit(auditLog); }, [auditLog]);
  useEffect(() => { saveConfig(mitConfig); }, [mitConfig]);

  const appendAudit = useCallback((entries: AuditEntry[]) => {
    if (entries.length) setAuditLog((prev) => [...entries, ...prev].slice(0, 200));
  }, []);

  // Automatic expiry of temporary blocks + live countdown tick.
  useEffect(() => {
    const iv = setInterval(() => {
      setTick((t) => t + 1);
      setManagedIps((prev) => {
        const { records, audits } = autoExpire(prev);
        if (audits.length) {
          appendAudit(audits);
          audits.forEach((a) => toast.message(`Block expired for ${maskIp(a.ip)}`, { description: 'Status returned to MONITORED.' }));
          return records;
        }
        return prev;
      });
    }, 3000);
    return () => clearInterval(iv);
  }, [appendAudit]);

  // Feed a failed-auth signal into the mitigation engine (demo).
  const feedFailure = useCallback(
    (ip: string, opts: { location?: string; setAttempts?: number }) => {
      setManagedIps((prev) => {
        const { records, audits } = recordFailure(
          prev,
          ip,
          { location: opts.location, isSimulated: true, setAttempts: opts.setAttempts },
          mitConfig,
        );
        if (audits.length) {
          appendAudit(audits);
          audits
            .filter((a) => a.action === 'AUTO_BLOCK')
            .forEach((a) => toast.warning(`Temporary block applied · ${maskIp(a.ip)}`, { description: `SIMULATED · ${a.reason}` }));
        }
        return records;
      });
    },
    [mitConfig, appendAudit],
  );

  // Admin Control Center lock (server-verified password)
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('soc_admin_unlocked') === '1') {
      setAdminUnlocked(true);
    }
  }, []);

  const unlockAdmin = useCallback(async () => {
    if (!pwInput || pwLoading) return;
    setPwLoading(true);
    setPwError('');
    try {
      const res = await fetch('/api/security/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwInput }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAdminUnlocked(true);
        sessionStorage.setItem('soc_admin_unlocked', '1');
        setPwInput('');
      } else {
        setPwError(data.error || 'Incorrect password');
      }
    } catch {
      setPwError('Could not verify password. Try again.');
    } finally {
      setPwLoading(false);
    }
  }, [pwInput, pwLoading]);

  const lockAdmin = useCallback(() => {
    setAdminUnlocked(false);
    sessionStorage.removeItem('soc_admin_unlocked');
    // Return to a safe, non-simulated posture when re-locking.
    setAdminMode('AUTO');
  }, []);

  const scenarioCancel = useRef<null | (() => void)>(null);
  const incidentStart = useRef<string | null>(null);

  // --- derived posture --------------------------------------------------
  const status: SystemStatus = useMemo(() => {
    if (adminMode === 'PROTECTED') return 'PROTECTED';
    if (adminMode === 'ALERT') return 'THREAT';
    if (adminMode === 'DEMO') return simStatus;
    return scan?.status ?? 'PROTECTED'; // AUTO
  }, [adminMode, simStatus, scan]);

  const accent = STATUS_ACCENT[status];

  // --- initial load + silent live scan ----------------------------------
  const silentScan = useCallback(async () => {
    try {
      const res = await fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result: ScanResult = await res.json();
      setScan(result);
      setScanHistory(saveScan(result));
      setLastUpdated(new Date());
    } catch {
      /* offline / blocked — leave as-is */
    }
  }, []);

  useEffect(() => {
    const hist = loadScanHistory();
    setScanHistory(hist);
    if (hist[0]) setScan(hist[0]);
    silentScan();
  }, [silentScan]);

  // --- animated user-triggered scan -------------------------------------
  const runScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setStageIdx(0);
    setProgress(0);
    const fetchP = fetch('/api/security/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json() as Promise<ScanResult>)
      .catch(() => null);

    for (let i = 0; i < SCAN_STAGES.length; i++) {
      setStageIdx(i);
      setProgress(Math.round(((i + 1) / SCAN_STAGES.length) * 90));
      await delay(360 + Math.random() * 220);
    }
    const result = await fetchP;
    setProgress(100);
    await delay(320);
    if (result) {
      setScan(result);
      setScanHistory(saveScan(result));
      setLastUpdated(new Date());
    }
    setScanning(false);
  }, [scanning]);

  // --- demo simulation ambient ticker -----------------------------------
  const pushEvent = useCallback((e: SecurityEvent) => {
    setEvents((prev) => [e, ...prev].slice(0, MAX_EVENTS));
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (adminMode !== 'DEMO') {
      // Leaving demo — clear simulated state so LIVE stays clean.
      scenarioCancel.current?.();
      scenarioCancel.current = null;
      setEvents([]);
      setIncident(null);
      setSimStatus('PROTECTED');
      incidentStart.current = null;
      setManagedIps((prev) => prev.filter((r) => !r.isSimulated));
      return;
    }
    const iv = setInterval(() => {
      const e = makeSimEvent({ severity: Math.random() > 0.6 ? 'MEDIUM' : 'LOW' });
      pushEvent(e);
      // Auth-related events feed the IP mitigation engine (one failed attempt).
      if (/login|authentication/i.test(e.eventType)) {
        feedFailure(e.ipAddress, { location: e.location });
      }
    }, 4500);
    return () => clearInterval(iv);
  }, [adminMode, pushEvent, feedFailure]);

  useEffect(() => () => scenarioCancel.current?.(), []);

  // --- simulation controls ----------------------------------------------
  const simulate = useCallback(
    (kind: 'warning' | 'high' | 'critical' | 'sqli') => {
      if (kind === 'warning') {
        setSimStatus('WARNING');
        for (let i = 0; i < 3; i++) pushEvent(makeSimEvent({ severity: 'MEDIUM' }));
        return;
      }
      if (kind === 'high') {
        setSimStatus('WARNING');
        for (let i = 0; i < 4; i++) pushEvent(makeSimEvent({ severity: 'HIGH' }));
        return;
      }
      if (kind === 'sqli') {
        // 5 SQL-injection detections from 5 distinct sources, each blocked at the WAF.
        const nowIso = new Date().toISOString();
        SQLI_ATTACKERS.forEach((atk, i) => {
          const ev = makeSimEvent({ severity: 'HIGH', ip: atk.ip, eventType: 'SQL Injection' });
          ev.action = 'BLOCKED';
          ev.status = 403;
          ev.location = atk.location;
          ev.requestPath = SQLI_PAYLOADS[i % SQLI_PAYLOADS.length];
          pushEvent(ev);
        });
        setManagedIps((prev) => {
          let recs = prev;
          const audits: AuditEntry[] = [];
          SQLI_ATTACKERS.forEach((atk) => {
            const r = blockForDetection(
              recs,
              atk.ip,
              {
                reason: 'SQL Injection',
                severity: 'HIGH',
                minutes: mitConfig.high.blockMinutes ?? 15,
                attempts: 1,
                location: atk.location,
                isSimulated: true,
              },
            );
            recs = r.records;
            audits.push(...r.audits);
          });
          if (audits.length) appendAudit(audits);
          return recs;
        });
        setSimStatus('THREAT');
        setIncident({
          id: 'inc_sqli',
          eventType: 'SQL Injection attack',
          ipAddress: SQLI_ATTACKERS[0].ip,
          severity: 'HIGH',
          firstSeen: nowIso,
          lastSeen: nowIso,
          attempts: SQLI_ATTACKERS.length,
          action: 'BLOCKED',
          recommended:
            'Payloads blocked at the WAF. Review query parameterization on the targeted endpoints and audit access logs.',
          isSimulated: true,
        });
        return;
      }
      // critical: scripted escalating auth-attack incident
      scenarioCancel.current?.();
      incidentStart.current = null;
      scenarioCancel.current = runAuthAttackScenario((step) => {
        pushEvent(step.event);
        setSimStatus(step.status);
        // Drive the mitigation engine with the escalating attempt count so the
        // IP progresses monitor -> rate limit -> temporary block automatically.
        feedFailure(step.event.ipAddress, { location: step.event.location, setAttempts: step.attempts });
        if (!incidentStart.current) incidentStart.current = step.event.timestamp;
        setIncident({
          id: 'inc_auth',
          eventType: 'Repeated authentication attempts',
          ipAddress: step.event.ipAddress,
          severity: step.severity,
          firstSeen: incidentStart.current,
          lastSeen: step.event.timestamp,
          attempts: step.attempts,
          action: step.event.action,
          recommended: 'Review authentication logs and consider temporary IP blocking.',
          isSimulated: true,
        });
      });
    },
    [pushEvent, feedFailure, mitConfig, appendAudit],
  );

  const clearSim = useCallback(() => {
    scenarioCancel.current?.();
    scenarioCancel.current = null;
    incidentStart.current = null;
    setEvents([]);
    setIncident(null);
    setSimStatus('PROTECTED');
    // Drop simulated IP records (keep any real ones).
    setManagedIps((prev) => prev.filter((r) => !r.isSimulated));
  }, []);

  // --- manual administrator IP actions ----------------------------------
  const doUnblock = useCallback(
    (ip: string) => {
      setManagedIps((prev) => {
        const { records, audits } = manualUnblock(prev, ip, adminEmail.current, 'Manual unblock by administrator');
        appendAudit(audits);
        return records;
      });
      fetch('/api/security/ip/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, action: 'unblock', reason: 'Manual unblock by administrator' }),
      }).catch(() => {});
      toast.success(`IP ${maskIp(ip)} has been unblocked.`);
    },
    [appendAudit],
  );

  const doWhitelist = useCallback(
    (ip: string) => {
      setManagedIps((prev) => {
        const { records, audits } = manualWhitelist(prev, ip, adminEmail.current, 'Marked safe / whitelisted by administrator');
        appendAudit(audits);
        return records;
      });
      fetch('/api/security/ip/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, action: 'whitelist', reason: 'Marked safe by administrator' }),
      }).catch(() => {});
      toast.success(`IP ${maskIp(ip)} whitelisted.`, { description: 'It will no longer be auto-blocked. Events still logged.' });
    },
    [appendAudit],
  );

  // --- stats ------------------------------------------------------------
  const stats = useMemo(() => {
    if (dataMode === 'DEMO') {
      const threats = events.filter((e) => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
      const blocked = new Set(events.filter((e) => e.action === 'BLOCKED').map((e) => e.ipAddress)).size;
      const failed = events.filter((e) => /login|authentication/i.test(e.eventType)).length;
      return { threats, blocked, suspicious: events.length, failed, total: events.length };
    }
    return { threats: scan?.threats ?? 0, blocked: 0, suspicious: 0, failed: 0, total: 0 };
  }, [dataMode, events, scan]);

  // --- chart data -------------------------------------------------------
  const scoreHistory = useMemo(
    () =>
      [...scanHistory]
        .reverse()
        .map((s, i) => ({ name: `#${i + 1}`, score: s.score })),
    [scanHistory],
  );
  const categoryData = useMemo(
    () => (scan?.categories ?? []).map((c) => ({ name: c.label, score: c.score, advisory: c.advisory })),
    [scan],
  );
  const severityData = useMemo(() => {
    const order: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return order.map((sev) => ({
      name: sev,
      value: events.filter((e) => e.severity === sev).length,
      color: SEVERITY_COLOR[sev],
    }));
  }, [events]);

  const isThreat = status === 'THREAT';

  // ---------------------------------------------------------------------

  return (
    <div
      className="min-h-[80vh] rounded-2xl p-4 md:p-6 text-slate-100"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, rgba(30,41,59,0.55), transparent), linear-gradient(180deg, #05070d 0%, #070b16 100%)',
        boxShadow: `inset 0 0 0 1px rgba(148,163,184,0.08), 0 0 60px -20px ${accent}55`,
      }}
    >
      {/* Header */}
      <header
        className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
        style={{
          borderColor: `${accent}44`,
          background: isThreat
            ? 'linear-gradient(90deg, rgba(239,68,68,0.16), rgba(7,11,22,0.2))'
            : 'rgba(148,163,184,0.04)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}55` }}
          >
            {isThreat ? (
              <ShieldAlert className="h-6 w-6" style={{ color: accent }} />
            ) : status === 'WARNING' ? (
              <Shield className="h-6 w-6" style={{ color: accent }} />
            ) : (
              <ShieldCheck className="h-6 w-6" style={{ color: accent }} />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">
              EASYLAND SECURITY OPERATIONS CENTER
            </h1>
            <p className="text-xs text-slate-400">
              Monitoring {scan?.target ?? 'easylandng.com'} · Non-destructive posture scanning
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <ModePill dataMode={dataMode} />
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            <Clock className="h-3.5 w-3.5" />
            {lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : 'Not yet updated'}
          </div>
        </div>
      </header>

      {/* Demo banner */}
      {dataMode === 'DEMO' && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            DEMO MODE — SIMULATED SECURITY EVENTS (not real incidents)
          </div>
          <div className="flex flex-wrap gap-2">
            <SimBtn onClick={() => simulate('sqli')} label="Simulate SQL Injection (5 IPs)" tone="red" icon={<Bug className="h-3.5 w-3.5" />} />
            <SimBtn onClick={() => simulate('warning')} label="Simulate Warning" tone="amber" />
            <SimBtn onClick={() => simulate('high')} label="Simulate High Threat" tone="orange" />
            <SimBtn onClick={() => simulate('critical')} label="Simulate Critical" tone="red" icon={<Play className="h-3.5 w-3.5" />} />
            <SimBtn onClick={clearSim} label="Clear Simulation" tone="slate" icon={<Square className="h-3.5 w-3.5" />} />
          </div>
        </div>
      )}

      {/* Critical alert */}
      {isThreat && (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: '#ef444466', background: 'rgba(239,68,68,0.12)' }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            CRITICAL SECURITY ALERT{incident?.isSimulated ? ' · SIMULATED' : ''}
          </div>
          {incident ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <AlertField label="Threat Type" value={incident.eventType} />
              <AlertField label="Source IP" value={revealIps ? incident.ipAddress : maskIp(incident.ipAddress)} />
              <AlertField label="Attempts" value={String(incident.attempts)} />
              <AlertField label="Current Action" value={incident.action.replace('_', ' ')} />
              <AlertField label="First Seen" value={fmtTime(incident.firstSeen)} />
              <AlertField label="Last Seen" value={fmtTime(incident.lastSeen)} />
              <AlertField label="Severity" value={incident.severity} />
              <AlertField label="Recommended" value={incident.recommended} wide />
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-200/80">
              {adminMode === 'ALERT'
                ? 'Alert state manually engaged by administrator (drill).'
                : 'Security posture scored below threshold. Review the findings and recommendations below.'}
            </p>
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Status + scan */}
        <Panel className="lg:col-span-1" title="System Status" icon={<Activity className="h-4 w-4" />}>
          <div className="flex flex-col items-center gap-5 py-2">
            <div
              className="w-full rounded-xl border p-4 text-center"
              style={{ borderColor: `${accent}44`, background: `${accent}12` }}
            >
              <div className="text-xs uppercase tracking-widest text-slate-400">Current Posture</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>
                {STATUS_LABEL[status]}
              </div>
            </div>

            {/* Scan button */}
            <button
              onClick={runScan}
              disabled={scanning}
              className="group relative flex h-44 w-44 items-center justify-center rounded-full transition disabled:cursor-not-allowed"
              style={{ background: 'radial-gradient(circle at 50% 40%, rgba(148,163,184,0.12), rgba(2,6,12,0.6))' }}
              aria-label="Run security scan"
            >
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={accent}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - (scanning ? progress : 100) / 100)}
                  style={{ transition: 'stroke-dashoffset 0.3s ease', filter: `drop-shadow(0 0 6px ${accent}88)` }}
                />
              </svg>
              <div className="flex flex-col items-center">
                {scanning ? (
                  <>
                    <ScanLine className="h-6 w-6 animate-pulse" style={{ color: accent }} />
                    <span className="mt-1 text-2xl font-bold">{progress}%</span>
                    <span className="text-[10px] text-slate-400">SCANNING</span>
                  </>
                ) : (
                  <>
                    <Radar className="h-7 w-7 transition-transform group-hover:scale-110" style={{ color: accent }} />
                    <span className="mt-1 text-lg font-bold tracking-wide">SCAN NOW</span>
                    <span className="text-[10px] text-slate-400">Safe posture check</span>
                  </>
                )}
              </div>
            </button>

            <div className="h-5 text-center text-xs text-slate-400">
              {scanning ? SCAN_STAGES[stageIdx] : scan ? `Last scan ${timeAgo(scan.timestamp)} · ${scan.durationMs}ms` : 'No scan yet'}
            </div>
          </div>
        </Panel>

        {/* Security score */}
        <Panel className="lg:col-span-1" title="Security Score" icon={<GaugeIcon className="h-4 w-4" />}>
          <div className="flex flex-col items-center gap-4">
            <ScoreGauge score={scan?.score ?? null} accent={accent} />
            <div className="w-full space-y-2">
              {(scan?.categories ?? []).map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      {c.label}
                      {c.advisory && <span className="ml-1 text-[10px] text-slate-500">(advisory)</span>}
                    </span>
                    <span className="tabular-nums text-slate-400">{c.score}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.score}%`, background: scoreColor(c.score) }}
                    />
                  </div>
                </div>
              ))}
              {!scan && <p className="text-center text-xs text-slate-500">Run a scan to compute the score.</p>}
            </div>
          </div>
        </Panel>

        {/* Stats */}
        <Panel className="lg:col-span-1" title="Live Metrics" icon={<Zap className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Bug className="h-4 w-4" />} label="Threats Detected" value={stats.threats} tone="red" simulated={dataMode === 'DEMO'} />
            <StatCard icon={<Ban className="h-4 w-4" />} label="Blocked IPs" value={stats.blocked} tone="orange" simulated={dataMode === 'DEMO'} />
            <StatCard icon={<Radar className="h-4 w-4" />} label="Suspicious Requests" value={stats.suspicious} tone="amber" simulated={dataMode === 'DEMO'} />
            <StatCard icon={<KeyRound className="h-4 w-4" />} label="Failed Logins" value={stats.failed} tone="sky" simulated={dataMode === 'DEMO'} />
            <StatCard icon={<Activity className="h-4 w-4" />} label="Security Events" value={stats.total} tone="violet" simulated={dataMode === 'DEMO'} />
            <StatCard icon={<Clock className="h-4 w-4" />} label="Last Scan" value={scan ? timeAgo(scan.timestamp) : '—'} tone="slate" isText />
          </div>
          {dataMode === 'LIVE' && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Event counters read 0 because no live log source is connected. Threats reflect real scan
              findings. Connect logs via <code className="text-slate-400">POST /api/security/events</code>.
            </p>
          )}
        </Panel>
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Security Score History" icon={<History className="h-4 w-4" />}>
          <ChartFrame empty={scoreHistory.length < 2} emptyText="Run more scans to chart score over time.">
            <AreaChart data={scoreHistory}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="score" stroke={accent} strokeWidth={2} fill="url(#scoreFill)" />
            </AreaChart>
          </ChartFrame>
        </Panel>

        <Panel title="Category Scores" icon={<ListChecks className="h-4 w-4" />}>
          <ChartFrame empty={!categoryData.length} emptyText="Run a scan to view category breakdown.">
            <BarChart data={categoryData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={92} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {categoryData.map((d, i) => (
                  <Cell key={i} fill={scoreColor(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ChartFrame>
        </Panel>

        <Panel title="Event Severity Distribution" icon={<AlertTriangle className="h-4 w-4" />}>
          <ChartFrame empty={dataMode !== 'DEMO' || events.length === 0} emptyText={dataMode === 'DEMO' ? 'No simulated events yet — run a simulation.' : 'Live events require a connected log source.'}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={24} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartFrame>
        </Panel>
      </div>

      {/* Threat table + live stream */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Threat Activity"
          icon={<Radar className="h-4 w-4" />}
          action={
            <button
              onClick={() => setRevealIps((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
            >
              {revealIps ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {revealIps ? 'Mask IPs' : 'Reveal IPs'}
            </button>
          }
        >
          <div className="overflow-x-auto">
            {events.length === 0 ? (
              <EmptyState
                text={
                  dataMode === 'DEMO'
                    ? 'No simulated events yet. Use the demo controls above.'
                    : 'No live events. Connect a log source (POST /api/security/events) to populate this table.'
                }
              />
            ) : (
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">IP Address</th>
                    <th className="py-2 pr-3 font-medium">Event</th>
                    <th className="py-2 pr-3 font-medium">Severity</th>
                    <th className="py-2 pr-3 font-medium">Location</th>
                    <th className="py-2 pr-3 font-medium">Request</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 12).map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      className="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
                      title="Click to analyse this threat"
                    >
                      <td className="py-2 pr-3 tabular-nums text-slate-400">{fmtTime(e.timestamp)}</td>
                      <td className="py-2 pr-3 font-mono text-slate-300">
                        {revealIps ? e.ipAddress : maskIp(e.ipAddress)}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {e.eventType}
                        {e.isSimulated && <SimTag />}
                      </td>
                      <td className="py-2 pr-3"><SeverityBadge severity={e.severity} /></td>
                      <td className="py-2 pr-3 text-slate-400">{e.location}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">{e.requestPath}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-400">{e.status || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1">
                          <ActionBadge action={e.action} />
                          <ChevronRight className="h-3 w-3 text-slate-500" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="Live Security Events" icon={<Activity className="h-4 w-4" />}>
          <div className="flex items-center gap-2 pb-2 text-[11px] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: accent }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
            </span>
            {dataMode === 'DEMO' ? 'Streaming simulated events' : 'Awaiting live log source'}
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <EmptyState text={dataMode === 'DEMO' ? 'Run a simulation to see the stream.' : 'No live log source connected.'} small />
            ) : (
              events.slice(0, 14).map((e) => (
                <div
                  key={e.id}
                  onClick={() => setSelectedEvent(e)}
                  className="cursor-pointer rounded-lg border border-white/5 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]"
                  title="Click to analyse this threat"
                >
                  <div className="flex items-center justify-between">
                    <span className="tabular-nums text-[11px] text-slate-500">{fmtTime(e.timestamp)}</span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <div className="mt-1 text-xs text-slate-200">
                    {e.eventType}
                    {e.isSimulated && <SimTag />}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    IP: {revealIps ? e.ipAddress : maskIp(e.ipAddress)} · {e.requestPath}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Recommendations + scan history */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Security Recommendations" icon={<ListChecks className="h-4 w-4" />}>
          <div className="space-y-2.5">
            {(scan?.recommendations ?? []).map((r) => (
              <div key={r.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={r.priority} />
                  <span className="text-sm font-medium text-slate-100">{r.title}</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">{r.description}</p>
                <p className="mt-1 text-[11px] text-slate-500"><span className="text-slate-400">Why:</span> {r.why}</p>
                <p className="mt-0.5 text-[11px] text-slate-500"><span className="text-slate-400">Action:</span> {r.action}</p>
              </div>
            ))}
            {!scan && <EmptyState text="Run a scan to generate recommendations." small />}
          </div>
        </Panel>

        <Panel title="Scan History" icon={<History className="h-4 w-4" />}>
          <div className="overflow-x-auto">
            {scanHistory.length === 0 ? (
              <EmptyState text="No scans recorded yet." small />
            ) : (
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">Date / Time</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 pr-3 font-medium">Threats</th>
                    <th className="py-2 pr-3 font-medium">Warnings</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setScan(s)}
                      className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-2 pr-3 text-slate-300">
                        {new Date(s.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 pr-3 font-semibold" style={{ color: scoreColor(s.score) }}>{s.score}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-400">{s.threats}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-400">{s.warnings}</td>
                      <td className="py-2 pr-3"><StatusDot status={s.status} /></td>
                      <td className="py-2 pr-3 tabular-nums text-slate-400">{s.durationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>

      {/* IP Management */}
      <div className="mt-4">
        <Panel
          title="IP Management"
          icon={<Ban className="h-4 w-4" />}
          action={
            !adminUnlocked ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="h-3 w-3" /> unlock admin control to act
              </span>
            ) : null
          }
        >
          <div className="overflow-x-auto">
            {managedIps.length === 0 ? (
              <EmptyState
                text={
                  dataMode === 'DEMO'
                    ? 'No IPs under mitigation. Run the critical simulation to see progressive blocking.'
                    : 'No IPs under mitigation. Connect the auth pipeline (POST /api/security/ip/action) to enforce real blocks.'
                }
              />
            ) : (
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">IP Address</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Reason</th>
                    <th className="py-2 pr-3 font-medium">Level</th>
                    <th className="py-2 pr-3 font-medium">Fails</th>
                    <th className="py-2 pr-3 font-medium">First</th>
                    <th className="py-2 pr-3 font-medium">Last</th>
                    <th className="py-2 pr-3 font-medium">Blocked Until</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {managedIps.map((r) => (
                    <tr
                      key={r.ip}
                      onClick={() => setSelectedIp(r)}
                      className="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
                      title="Click to see IP details"
                    >
                      <td className="py-2 pr-3 font-mono text-slate-300">{revealIps ? r.ip : maskIp(r.ip)}</td>
                      <td className="py-2 pr-3"><IpStatusBadge status={r.status} /></td>
                      <td className="py-2 pr-3 text-slate-400">{r.reason}</td>
                      <td className="py-2 pr-3"><SeverityBadge severity={r.threatLevel} /></td>
                      <td className="py-2 pr-3 tabular-nums text-slate-300">{r.failedAttempts}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-500">{fmtTime(r.firstDetected)}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-500">{fmtTime(r.lastDetected)}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-400">
                        {r.status === 'TEMPORARILY_BLOCKED' && r.blockedUntil ? (
                          <span>
                            {fmtTime(r.blockedUntil)}{' '}
                            <span className="text-[10px] text-amber-400/80">({fmtCountdown(r.blockedUntil)})</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-1.5">
                          {r.status === 'TEMPORARILY_BLOCKED' && (
                            <button
                              disabled={!adminUnlocked}
                              onClick={(e) => { e.stopPropagation(); setConfirmAction({ ip: r.ip, kind: 'unblock' }); }}
                              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                            >
                              UNBLOCK
                            </button>
                          )}
                          {r.status !== 'WHITELISTED' && (
                            <button
                              disabled={!adminUnlocked}
                              onClick={(e) => { e.stopPropagation(); setConfirmAction({ ip: r.ip, kind: 'whitelist' }); }}
                              className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-40"
                            >
                              MARK SAFE
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Blocks are <span className="text-slate-400">temporary</span> and auto-expire — legitimate users
            who forget passwords can recover via <code className="text-slate-400">/auth/forgot-password</code> without
            an admin. Whitelisted IPs are never auto-blocked but their events are still logged.
          </p>
        </Panel>
      </div>

      {/* Security audit log */}
      <div className="mt-4">
        <Panel title="Security Audit Log" icon={<ListChecks className="h-4 w-4" />}>
          <div className="max-h-[280px] overflow-y-auto">
            {auditLog.length === 0 ? (
              <EmptyState text="No administrative or automatic IP actions recorded yet." small />
            ) : (
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Administrator</th>
                    <th className="py-2 pr-3 font-medium">IP</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Reason</th>
                    <th className="py-2 pr-3 font-medium">Prev → New</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.slice(0, 30).map((a) => (
                    <tr key={a.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 tabular-nums text-slate-500">{fmtTime(a.timestamp)}</td>
                      <td className="py-2 pr-3 text-slate-300">{a.administrator}</td>
                      <td className="py-2 pr-3 font-mono text-slate-400">{revealIps ? a.ip : maskIp(a.ip)}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{a.action.replace('_', ' ')}</span>
                        {a.isSimulated && <SimTag />}
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{a.reason}</td>
                      <td className="py-2 pr-3 text-[11px] text-slate-500">{a.previousStatus} → {a.newStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>

      {/* Admin controls — locked behind a server-verified password */}
      <div className="mt-4">
        <Panel
          title="Admin Control Center"
          icon={adminUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          action={
            adminUnlocked ? (
              <button
                onClick={lockAdmin}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
              >
                <Lock className="h-3 w-3" /> Lock
              </button>
            ) : null
          }
        >
          {!adminUnlocked ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'rgba(148,163,184,0.1)', boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.25)' }}
              >
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">This control center is locked</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Enter the administrator password to access posture overrides and demo mode.
                </p>
              </div>
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  unlockAdmin();
                }}
                className="flex w-full max-w-sm flex-col items-center gap-2"
              >
                <div className="flex w-full items-center gap-2">
                  <input
                    type="password"
                    value={pwInput}
                    onChange={(e) => {
                      setPwInput(e.target.value);
                      setPwError('');
                    }}
                    placeholder="Administrator password"
                    autoComplete="off"
                    className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-white/25"
                  />
                  <button
                    type="submit"
                    disabled={pwLoading || !pwInput}
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {pwLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
                    Unlock
                  </button>
                </div>
                {pwError && <p className="text-xs text-red-400">{pwError}</p>}
              </form>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['AUTO', 'PROTECTED', 'ALERT', 'DEMO'] as AdminMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setAdminMode(m)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                      style={
                        adminMode === m
                          ? { borderColor: `${accent}88`, background: `${accent}22`, color: '#fff' }
                          : { borderColor: 'rgba(148,163,184,0.2)', color: '#94a3b8' }
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={silentScan}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh live status
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                <span className="text-slate-400">AUTO</span>: posture follows the real scan.{' '}
                <span className="text-slate-400">PROTECTED / ALERT</span>: manual override for drills.{' '}
                <span className="text-slate-400">DEMO</span>: simulated events for presentations (clearly labelled).
              </p>

              {/* Mitigation thresholds — all configurable */}
              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  IP Mitigation Thresholds
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ThresholdEditor label="LOW · monitor" rule={mitConfig.low} onChange={(low) => setMitConfig((c) => ({ ...c, low }))} />
                  <ThresholdEditor label="MEDIUM · rate limit" rule={mitConfig.medium} onChange={(medium) => setMitConfig((c) => ({ ...c, medium }))} />
                  <ThresholdEditor label="HIGH · temp block" rule={mitConfig.high} block onChange={(high) => setMitConfig((c) => ({ ...c, high }))} />
                  <ThresholdEditor label="CRITICAL · temp block + alert" rule={mitConfig.critical} block onChange={(critical) => setMitConfig((c) => ({ ...c, critical }))} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Changes apply immediately and persist. Blocks always auto-expire.
                  </span>
                  <button
                    onClick={() => setMitConfig(DEFAULT_CONFIG)}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
                  >
                    Reset defaults
                  </button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* Threat analysis modal */}
      {selectedEvent && (
        <ThreatDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* IP detail (clickable from IP Management) */}
      {selectedIp && (
        <IpDetailModal
          ip={selectedIp}
          events={events}
          audit={auditLog}
          revealIps={revealIps}
          canAct={adminUnlocked}
          onClose={() => setSelectedIp(null)}
          onUnblock={() => { setConfirmAction({ ip: selectedIp.ip, kind: 'unblock' }); setSelectedIp(null); }}
          onWhitelist={() => { setConfirmAction({ ip: selectedIp.ip, kind: 'whitelist' }); setSelectedIp(null); }}
        />
      )}

      {/* Confirmation modal for destructive IP actions */}
      {confirmAction && (
        <ConfirmModal
          ip={confirmAction.ip}
          kind={confirmAction.kind}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const { ip, kind } = confirmAction;
            if (kind === 'unblock') doUnblock(ip);
            else doWhitelist(ip);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

const tooltipStyle = {
  background: '#0b1120',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 12,
};

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function Panel({
  title,
  icon,
  children,
  className = '',
  action,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm ${className}`}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartFrame({ children, empty, emptyText }: { children: React.ReactElement; empty?: boolean; emptyText: string }) {
  if (empty) return <div className="flex h-[180px] items-center justify-center"><EmptyState text={emptyText} small /></div>;
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center text-slate-500 ${small ? 'py-6' : 'py-10'}`}>
      <Radar className="h-6 w-6 opacity-40" />
      <p className="max-w-xs text-xs">{text}</p>
    </div>
  );
}

function ScoreGauge({ score, accent }: { score: number | null; accent: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <div className="relative h-40 w-40">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={score === null ? '#64748b' : scoreColor(pct)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 6px ${accent}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score === null ? '--' : score}</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  simulated,
  isText,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'red' | 'orange' | 'amber' | 'sky' | 'violet' | 'slate';
  simulated?: boolean;
  isText?: boolean;
}) {
  const toneColor: Record<string, string> = {
    red: '#ef4444',
    orange: '#fb923c',
    amber: '#f59e0b',
    sky: '#38bdf8',
    violet: '#a78bfa',
    slate: '#94a3b8',
  };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400" style={{ color: toneColor[tone] }}>
        {icon}
        <span className="text-slate-400">{label}</span>
      </div>
      <div className={`mt-1 font-bold ${isText ? 'text-base' : 'text-2xl'}`}>{value}</div>
      {simulated && !isText && <span className="text-[9px] font-medium uppercase tracking-wide text-amber-400/80">simulated</span>}
    </div>
  );
}

function StatusPill({ status }: { status: SystemStatus }) {
  const accent = STATUS_ACCENT[status];
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={{ background: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}55` }}
    >
      <span className="relative flex h-2 w-2">
        {status !== 'PROTECTED' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: accent }} />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: accent }} />
      </span>
      {STATUS_LABEL[status]}
    </div>
  );
}

function ModePill({ dataMode }: { dataMode: DataMode }) {
  const isDemo = dataMode === 'DEMO';
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={{
        background: isDemo ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
        color: isDemo ? '#fbbf24' : '#4ade80',
        boxShadow: `inset 0 0 0 1px ${isDemo ? '#f59e0b55' : '#22c55e55'}`,
      }}
    >
      <Activity className="h-3.5 w-3.5" />
      {isDemo ? 'DEMO / SIMULATION' : 'LIVE MONITORING'}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {severity}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className="inline-block rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
      {action.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const map = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#38bdf8' };
  const color = map[priority];
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}22`, color }}>
      {priority} PRIORITY
    </span>
  );
}

function StatusDot({ status }: { status: SystemStatus }) {
  const accent = STATUS_ACCENT[status];
  return (
    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: accent }}>
      <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function SimTag() {
  return (
    <span className="ml-1.5 rounded bg-amber-400/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
      simulated
    </span>
  );
}

function AlertField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-4' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-red-300/60">{label}</div>
      <div className="text-sm font-medium text-red-100">{value}</div>
    </div>
  );
}

function SimBtn({
  onClick,
  label,
  tone,
  icon,
}: {
  onClick: () => void;
  label: string;
  tone: 'amber' | 'orange' | 'red' | 'slate';
  icon?: React.ReactNode;
}) {
  const map = {
    amber: '#f59e0b',
    orange: '#fb923c',
    red: '#ef4444',
    slate: '#94a3b8',
  };
  const color = map[tone];
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition hover:brightness-110"
      style={{ background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}44` }}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// IP mitigation UI helpers
// ---------------------------------------------------------------------------

const IP_STATUS_STYLE: Record<IpStatus, { color: string; label: string }> = {
  MONITORED: { color: '#38bdf8', label: 'MONITORED' },
  RATE_LIMITED: { color: '#f59e0b', label: 'RATE LIMITED' },
  TEMPORARILY_BLOCKED: { color: '#ef4444', label: 'TEMP BLOCKED' },
  UNBLOCKED: { color: '#22c55e', label: 'UNBLOCKED' },
  WHITELISTED: { color: '#a78bfa', label: 'WHITELISTED' },
};

function IpStatusBadge({ status }: { status: IpStatus }) {
  const s = IP_STATUS_STYLE[status];
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${s.color}22`, color: s.color }}>
      {s.label}
    </span>
  );
}

function ThresholdEditor({
  label,
  rule,
  block,
  onChange,
}: {
  label: string;
  rule: { attempts: number; windowMinutes: number; blockMinutes?: number };
  block?: boolean;
  onChange: (r: { attempts: number; windowMinutes: number; blockMinutes?: number }) => void;
}) {
  const numField = (val: number, key: 'attempts' | 'windowMinutes' | 'blockMinutes', suffix: string) => (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-500">{suffix}</span>
      <input
        type="number"
        min={1}
        value={val}
        onChange={(e) => onChange({ ...rule, [key]: Math.max(1, Number(e.target.value) || 1) })}
        className="w-16 rounded border border-white/10 bg-black/30 px-2 py-1 text-right text-xs text-slate-100 outline-none focus:border-white/25"
      />
    </label>
  );
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="space-y-1.5">
        {numField(rule.attempts, 'attempts', 'attempts')}
        {numField(rule.windowMinutes, 'windowMinutes', 'window (min)')}
        {block && numField(rule.blockMinutes ?? 15, 'blockMinutes', 'block (min)')}
      </div>
    </div>
  );
}

function ConfirmModal({
  ip,
  kind,
  onCancel,
  onConfirm,
}: {
  ip: string;
  kind: 'unblock' | 'whitelist';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isUnblock = kind === 'unblock';
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,12,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-5 text-slate-100"
        style={{ background: 'linear-gradient(180deg, #0a0f1c 0%, #070b16 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">
          {isUnblock ? 'Unblock this IP?' : 'Mark this IP as safe?'}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {isUnblock ? (
            <>
              This removes the active temporary block for <span className="font-mono text-slate-200">{maskIp(ip)}</span> and
              immediately allows it to authenticate again. The action is recorded in the audit log.
            </>
          ) : (
            <>
              This whitelists <span className="font-mono text-slate-200">{maskIp(ip)}</span> so it will never be auto-blocked.
              Its security events are still logged. The action is recorded in the audit log.
            </>
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ background: isUnblock ? '#059669' : '#0284c7' }}
          >
            {isUnblock ? 'Unblock IP' : 'Mark Safe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Threat detail / analysis modal
// ---------------------------------------------------------------------------

function ipClass(ip: string): string {
  // Rough, honest classification from the address itself (no external lookup).
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip))
    return 'Private / internal (RFC 1918)';
  if (/^127\./.test(ip)) return 'Loopback';
  if (ip.includes(':')) return 'IPv6 address';
  return 'Public IPv4 address';
}

function ThreatDetailModal({ event, onClose }: { event: SecurityEvent; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const color = SEVERITY_COLOR[event.severity];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,12,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 text-slate-100"
        style={{
          borderColor: `${color}55`,
          background: 'linear-gradient(180deg, #0a0f1c 0%, #070b16 100%)',
          boxShadow: `0 0 60px -12px ${color}66`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={event.severity} />
              {event.isSimulated && <SimTag />}
            </div>
            <h3 className="mt-2 text-lg font-semibold">{event.eventType}</h3>
            <p className="text-xs text-slate-500">
              Threat analysis · {fmtTime(event.timestamp)} · source: {event.source}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* IP + Location analysis */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              <Fingerprint className="h-3.5 w-3.5" /> IP Address
            </div>
            <div className="mt-1 font-mono text-base text-slate-100">{event.ipAddress}</div>
            <div className="mt-1 text-[11px] text-slate-500">{ipClass(event.ipAddress)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              <MapPin className="h-3.5 w-3.5" /> Location
            </div>
            <div className="mt-1 text-base text-slate-100">{event.location}</div>
            <div className="mt-1 text-[11px] text-slate-500">Geo estimate</div>
          </div>
        </div>

        {/* Attributes */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
          <DetailRow label="Severity" value={<span style={{ color }}>{event.severity}</span>} />
          <DetailRow label="Action" value={event.action.replace('_', ' ')} />
          <DetailRow label="HTTP status" value={event.status ? String(event.status) : '—'} />
          <DetailRow label="Attempts" value={event.attempts != null ? String(event.attempts) : '—'} />
          <DetailRow label="Request path" value={<span className="font-mono text-xs">{event.requestPath}</span>} wide />
          <DetailRow label="User agent" value={<span className="font-mono text-xs break-all">{event.userAgent}</span>} wide />
        </div>

        {/* Narrative */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
            <Globe className="h-3.5 w-3.5" /> Analysis
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            {event.isSimulated
              ? 'This is a SIMULATED event generated in demo mode — it does not represent a real attacker. '
              : 'This event was ingested from a connected log source. '}
            A <strong>{event.severity.toLowerCase()}</strong>-severity “{event.eventType}” was observed from{' '}
            <span className="font-mono">{event.ipAddress}</span>
            {event.location ? ` (${event.location})` : ''} against{' '}
            <span className="font-mono">{event.requestPath}</span>. Current response:{' '}
            <strong>{event.action.replace('_', ' ').toLowerCase()}</strong>.
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Deeper geo/ASN/reputation enrichment requires a GeoIP provider — wire one into the event
            pipeline to populate reverse-DNS, ASN and country confidence here.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}

function IpDetailModal({
  ip,
  events,
  audit,
  revealIps,
  canAct,
  onClose,
  onUnblock,
  onWhitelist,
}: {
  ip: ManagedIp;
  events: SecurityEvent[];
  audit: AuditEntry[];
  revealIps: boolean;
  canAct: boolean;
  onClose: () => void;
  onUnblock: () => void;
  onWhitelist: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const color = IP_STATUS_STYLE[ip.status].color;
  const relatedEvents = events.filter((e) => e.ipAddress === ip.ip).slice(0, 8);
  const relatedAudit = audit.filter((a) => a.ip === ip.ip).slice(0, 8);
  const shownIp = revealIps ? ip.ip : maskIp(ip.ip);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,12,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 text-slate-100"
        style={{
          borderColor: `${color}55`,
          background: 'linear-gradient(180deg, #0a0f1c 0%, #070b16 100%)',
          boxShadow: `0 0 60px -12px ${color}66`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <IpStatusBadge status={ip.status} />
              {ip.isSimulated && <SimTag />}
            </div>
            <h3 className="mt-2 font-mono text-lg font-semibold">{shownIp}</h3>
            <p className="text-xs text-slate-500">{ip.reason} · {ip.location || 'Unknown'}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
          <DetailRow label="Status" value={<IpStatusBadge status={ip.status} />} />
          <DetailRow label="Threat level" value={<SeverityBadge severity={ip.threatLevel} />} />
          <DetailRow label="Failed attempts" value={String(ip.failedAttempts)} />
          <DetailRow
            label="Blocked until"
            value={
              ip.status === 'TEMPORARILY_BLOCKED' && ip.blockedUntil
                ? `${fmtTime(ip.blockedUntil)} (${fmtCountdown(ip.blockedUntil)})`
                : '—'
            }
          />
          <DetailRow label="First detected" value={fmtTime(ip.firstDetected)} />
          <DetailRow label="Last detected" value={fmtTime(ip.lastDetected)} />
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Related events ({relatedEvents.length})</div>
          <div className="mt-2 space-y-1.5">
            {relatedEvents.length === 0 ? (
              <p className="text-xs text-slate-500">No individual events recorded for this IP.</p>
            ) : (
              relatedEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    {e.eventType}
                    <span className="ml-2 font-mono text-[11px] text-slate-500">{e.requestPath}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <SeverityBadge severity={e.severity} />
                    <span className="tabular-nums text-slate-500">{fmtTime(e.timestamp)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Audit trail ({relatedAudit.length})</div>
          <div className="mt-2 space-y-1.5">
            {relatedAudit.length === 0 ? (
              <p className="text-xs text-slate-500">No actions recorded yet.</p>
            ) : (
              relatedAudit.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{a.action.replace('_', ' ')}</span>
                    <span className="ml-2 text-slate-500">{a.administrator}</span>
                  </span>
                  <span className="tabular-nums text-slate-500">{fmtTime(a.timestamp)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {!canAct && <span className="mr-auto flex items-center gap-1 text-[11px] text-slate-500"><Lock className="h-3 w-3" /> unlock admin control to act</span>}
          {ip.status === 'TEMPORARILY_BLOCKED' && (
            <button
              disabled={!canAct}
              onClick={onUnblock}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              Unblock IP
            </button>
          )}
          {ip.status !== 'WHITELISTED' && (
            <button
              disabled={!canAct}
              onClick={onWhitelist}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-40"
            >
              Mark Safe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
