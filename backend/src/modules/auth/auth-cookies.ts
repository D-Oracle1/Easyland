import type { Request, Response, CookieOptions } from 'express';

/**
 * HttpOnly auth cookies.
 *
 * Browsers reach the API through the frontend's same-origin /api proxy, so these
 * cookies are first-party on the tenant's own domain and never readable by JS.
 * In production the `__Host-` / `__Secure-` prefixes make the browser enforce
 * Secure (and, for __Host-, no Domain + Path=/), so they cannot be overwritten
 * from a sibling subdomain or over plain HTTP.
 */
const isProd = process.env.NODE_ENV === 'production';

export const ACCESS_COOKIE = isProd ? '__Host-easyland_at' : 'easyland_at';
export const REFRESH_COOKIE = isProd ? '__Secure-easyland_rt' : 'easyland_rt';
// Refresh token is only ever needed by the auth endpoints.
const REFRESH_PATH = '/api/v1/auth';

/** Parse a jsonwebtoken-style duration ("15m", "7d", "3600") into milliseconds. */
export function durationToMs(value: string | number | undefined, fallbackMs: number): number {
  if (value === undefined || value === null || value === '') return fallbackMs;
  if (typeof value === 'number') return value * 1000;
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return fallbackMs;
  const n = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  const mult: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}

function base(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken?: string; expiresIn?: string },
  refreshExpiresIn?: string,
) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(),
    maxAge: durationToMs(tokens.expiresIn, 7 * 86_400_000),
  });
  if (tokens.refreshToken) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base(),
      sameSite: 'strict',
      path: REFRESH_PATH,
      // Refresh expiry is configured in days (see AuthService.generateTokens)
      maxAge: durationToMs(refreshExpiresIn ? `${parseInt(refreshExpiresIn, 10)}d` : undefined, 30 * 86_400_000),
    });
  }
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, base());
  res.clearCookie(REFRESH_COOKIE, { ...base(), sameSite: 'strict', path: REFRESH_PATH });
}

/** Read a cookie without pulling in cookie-parser. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
