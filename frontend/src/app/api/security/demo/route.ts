import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/security/demo  { action: 'start' | 'stop', scenario?: string }
 *
 * Demo-mode control interface. The actual simulation runs client-side (see
 * lib/security/engine.ts) so it needs no server state — this endpoint exists so
 * the demo lifecycle has a documented, auditable API seam and returns a clear
 * acknowledgement that everything produced in demo mode is SIMULATED.
 */
export async function POST(req: NextRequest) {
  let body: { action?: string; scenario?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const action = body.action === 'stop' ? 'stop' : 'start';
  return NextResponse.json({
    ok: true,
    action,
    scenario: body.scenario || 'auth-attack',
    simulated: true,
    note: 'DEMO mode active. All generated events are simulated and flagged isSimulated=true.',
  });
}
