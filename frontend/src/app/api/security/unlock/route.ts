import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/security/unlock  { password }
 *
 * Verifies the Admin Control Center password server-side, so the secret is
 * never shipped in the client bundle. The password is read from the
 * SOC_ADMIN_PASSWORD environment variable.
 *
 * Set it in your environment (e.g. Vercel project env):
 *   SOC_ADMIN_PASSWORD=your-strong-password
 * If unset, a development default is used and a warning is returned so it is
 * obvious the production secret still needs configuring.
 */
const DEV_DEFAULT = 'easyland-soc';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const provided = String(body.password ?? '');
  const configured = process.env.SOC_ADMIN_PASSWORD;
  const expected = configured || DEV_DEFAULT;

  if (!provided) {
    return NextResponse.json({ ok: false, error: 'Password required' }, { status: 400 });
  }

  if (!safeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    usingDefault: !configured,
    ...(configured
      ? {}
      : { warning: 'SOC_ADMIN_PASSWORD is not set — using the development default. Set it in your environment.' }),
  });
}
