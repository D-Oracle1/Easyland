import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy favicon endpoint — the favicon is now the generated app icon
 * (company logo on the brand tile), so just send browsers there.
 */
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/app-icon/favicon', req.url), 308);
}
