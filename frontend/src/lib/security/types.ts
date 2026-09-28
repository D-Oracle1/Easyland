/**
 * Easyland Security Operations Center — shared types.
 *
 * These types are shared by the SOC dashboard UI, the client-side simulation
 * engine, and the /api/security/* route handlers. The single most important
 * invariant is `isSimulated`: every event carries it, and demo/simulated
 * events must NEVER be presented as genuine security incidents.
 */

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Overall posture of the system, drives the dashboard accent colour. */
export type SystemStatus = 'PROTECTED' | 'WARNING' | 'THREAT';

/** Where the dashboard's data comes from. */
export type DataMode = 'LIVE' | 'DEMO';

/** Administrator override for the posture state machine. */
export type AdminMode = 'AUTO' | 'PROTECTED' | 'ALERT' | 'DEMO';

export type EventAction =
  | 'MONITOR'
  | 'RATE_LIMITED'
  | 'BLOCKED'
  | 'CHALLENGED'
  | 'INVESTIGATING';

export type EventSource =
  | 'scanner'
  | 'nginx'
  | 'application'
  | 'auth'
  | 'waf'
  | 'firewall'
  | 'simulation';

export interface SecurityEvent {
  id: string;
  timestamp: string; // ISO
  ipAddress: string;
  eventType: string;
  severity: Severity;
  location: string;
  requestPath: string;
  userAgent: string;
  status: number; // HTTP status associated with the event, if any
  action: EventAction;
  source: EventSource;
  /** TRUE for demo/simulated events. Persisted so demo can never be mistaken for real. */
  isSimulated: boolean;
  /** For repeated-attempt incidents. */
  attempts?: number;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface ScanCheck {
  id: string;
  label: string;
  category: string;
  status: CheckStatus;
  detail: string;
}

export interface CategoryScore {
  key: string;
  label: string;
  score: number; // 0-100
  /** True when this dimension cannot be measured by a safe scan (needs logs / manual review). */
  advisory?: boolean;
}

export type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Recommendation {
  id: string;
  priority: RecommendationPriority;
  title: string;
  description: string;
  why: string;
  action: string;
}

export interface ScanResult {
  id: string;
  timestamp: string; // ISO
  target: string;
  durationMs: number;
  score: number; // 0-100
  status: SystemStatus;
  threats: number;
  warnings: number;
  categories: CategoryScore[];
  checks: ScanCheck[];
  recommendations: Recommendation[];
  /** True when the scan actually reached the live target. */
  live: boolean;
  /** Present when the scan could not reach the target. */
  error?: string;
}

/** A running/summarised incident (used by the critical-alert panel). */
export interface Incident {
  id: string;
  eventType: string;
  ipAddress: string;
  severity: Severity;
  firstSeen: string;
  lastSeen: string;
  attempts: number;
  action: EventAction;
  recommended: string;
  isSimulated: boolean;
}
