import { NextRequest, NextResponse } from 'next/server';
import type { SecurityEvent, Severity, EventAction, EventSource } from '@/lib/security/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Security event API — the integration seam for REAL log data.
 *
 * GET  /api/security/events
 *   Returns live security events. In this MVP no external log source is
 *   connected, so it honestly returns an empty list plus a `note` explaining
 *   where real events should come from. It never invents events. (Demo events
 *   are generated entirely client-side and flagged isSimulated.)
 *
 * POST /api/security/events
 *   Ingestion endpoint. A log shipper (Nginx/WAF/auth pipeline) can POST
 *   normalised events here. It validates and echoes them back with
 *   `isSimulated: false`. This is the documented point at which a real database
 *   (table: security_events) and event store should be wired in.
 */

const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ACTIONS: EventAction[] = ['MONITOR', 'RATE_LIMITED', 'BLOCKED', 'CHALLENGED', 'INVESTIGATING'];
const SOURCES: EventSource[] = ['scanner', 'nginx', 'application', 'auth', 'waf', 'firewall', 'simulation'];

export async function GET() {
  return NextResponse.json(
    {
      live: true,
      events: [] as SecurityEvent[],
      note:
        'No external log source is connected. Real events appear here once a log ' +
        'shipper posts to POST /api/security/events and a persistent store is wired in. ' +
        'Use DEMO mode for simulated events.',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface IngestBody {
  ipAddress?: string;
  eventType?: string;
  severity?: string;
  location?: string;
  requestPath?: string;
  userAgent?: string;
  status?: number;
  action?: string;
  source?: string;
  timestamp?: string;
}

export async function POST(req: NextRequest) {
  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.ipAddress || !body.eventType) {
    return NextResponse.json(
      { error: 'ipAddress and eventType are required' },
      { status: 400 },
    );
  }

  const severity = (SEVERITIES.includes(body.severity as Severity) ? body.severity : 'LOW') as Severity;
  const action = (ACTIONS.includes(body.action as EventAction) ? body.action : 'MONITOR') as EventAction;
  const source = (SOURCES.includes(body.source as EventSource) ? body.source : 'application') as EventSource;

  const event: SecurityEvent = {
    id: `ing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: body.timestamp || new Date().toISOString(),
    ipAddress: String(body.ipAddress),
    eventType: String(body.eventType),
    severity,
    location: body.location || 'Unknown',
    requestPath: body.requestPath || '/',
    userAgent: body.userAgent || 'unknown',
    status: typeof body.status === 'number' ? body.status : 0,
    action,
    source,
    isSimulated: false, // ingested = real
  };

  // INTEGRATION POINT: persist `event` to the security_events table here and
  // fan it out to connected dashboards (WebSocket/Pusher/SSE). For the MVP we
  // acknowledge receipt so the ingestion contract can be tested end-to-end.
  return NextResponse.json({ accepted: true, event }, { status: 202 });
}
