import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/security/status
 *
 * Lightweight liveness/posture probe of the target. Performs a single safe
 * GET and reports reachability + whether the response was healthy. Deeper
 * scoring lives in POST /api/security/scan. Returns real observations only.
 */
export async function GET(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || 'easylandng.com').split(':')[0];
  const target = `https://${host}`;
  const started = Date.now();

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'EasylandSOC-SafeScanner/1.0' },
      cache: 'no-store',
    });
    clearTimeout(t);
    const healthy = res.status > 0 && res.status < 500;
    return NextResponse.json(
      {
        live: true,
        target,
        reachable: true,
        httpStatus: res.status,
        https: true,
        status: healthy ? 'PROTECTED' : 'WARNING',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        live: true,
        target,
        reachable: false,
        status: 'THREAT',
        error: e instanceof Error ? e.message : 'unreachable',
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
