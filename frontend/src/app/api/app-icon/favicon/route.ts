import { NextRequest } from 'next/server';
import { GET as appIcon } from '../route';

/**
 * Favicon (/favicon.ico) — rewritten here by next.config.js. A static route (not a dynamic
 * segment) so it is matched before the /api/:path* backend proxy, and the
 * size is set here because rewrites can't reliably carry query parameters.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/app-icon';
  url.search = 'size=48&rounded=1';
  return appIcon(new NextRequest(url, { headers: req.headers }));
}
