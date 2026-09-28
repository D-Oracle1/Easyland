import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/security/ip/action
 *   { ip, action: 'block'|'unblock'|'whitelist', reason, minutes? }
 *
 * Enforcement seam for the IP mitigation system. The SOC dashboard maintains
 * mitigation state client-side (MVP), but every administrator action is also
 * posted here so a production auth/WAF/firewall layer can apply or remove the
 * ACTUAL block and persist it to a durable store (blocked_ips + audit tables).
 *
 * IMPORTANT: blocks are TEMPORARY by design — a real implementation must set an
 * expiry (minutes) and never permanently ban an IP for failed logins alone.
 * For the MVP this validates and acknowledges the action.
 */
const ACTIONS = new Set(['block', 'unblock', 'whitelist']);

export async function POST(req: NextRequest) {
  let body: { ip?: string; action?: string; reason?: string; minutes?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const ip = String(body.ip ?? '').trim();
  const action = String(body.action ?? '').trim();
  if (!ip) return NextResponse.json({ ok: false, error: 'ip is required' }, { status: 400 });
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: 'action must be block|unblock|whitelist' }, { status: 400 });
  }

  // INTEGRATION POINT: apply/remove the real block here (WAF/firewall/edge rule)
  // and persist to blocked_ips + security_audit tables. For 'block', honour the
  // temporary `minutes` expiry — never make it permanent.
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      ip,
      action,
      reason: body.reason ?? '',
      minutes: action === 'block' ? body.minutes ?? null : null,
      note: 'Acknowledged. Wire this handler to the real auth/WAF layer + durable audit store.',
    },
    { status: 202 },
  );
}
