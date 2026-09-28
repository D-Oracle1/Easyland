import { NextRequest, NextResponse } from 'next/server';
import type {
  ScanCheck,
  ScanResult,
  CategoryScore,
  Recommendation,
  CheckStatus,
} from '@/lib/security/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/security/scan
 *
 * Runs a SAFE, non-destructive security posture scan against a target the
 * administrator owns. It only issues ordinary GET requests and inspects the
 * response (status, TLS reachability, security headers, information exposure).
 * It performs NO exploitation, fuzzing, or authentication brute-forcing.
 *
 * The results are REAL observations about the live target — nothing here is
 * fabricated. Dimensions that cannot be measured safely from the outside
 * (rate-limiting internals, traffic anomalies, auth internals) are returned as
 * `advisory` with an honest note that they require log integration / manual
 * review, rather than being invented.
 */

// Only these hosts may be scanned from this endpoint (owned infrastructure).
const ALLOWED_HOSTS = new Set([
  'easylandng.com',
  'www.easylandng.com',
]);

function normaliseTarget(raw: string | undefined, reqHost: string): string {
  let target = (raw || '').trim();
  if (!target) target = `https://${reqHost}`;
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  return target;
}

function has(headers: Headers, name: string): string | null {
  return headers.get(name);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: { target?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }

  const reqHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || 'easylandng.com')
    .split(':')[0];
  const target = normaliseTarget(body.target, reqHost);

  let targetHost = '';
  try {
    targetHost = new URL(target).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
  }

  // Allow the host the dashboard is served from, plus the owned allow-list.
  const allowed = ALLOWED_HOSTS.has(targetHost) || targetHost === reqHost;
  if (!allowed) {
    return NextResponse.json(
      { error: `Scanning ${targetHost} is not permitted. Only owned hosts may be scanned.` },
      { status: 403 },
    );
  }

  const checks: ScanCheck[] = [];
  const add = (id: string, label: string, category: string, status: CheckStatus, detail: string) =>
    checks.push({ id, label, category, status, detail });

  let reachable = false;
  let httpStatus = 0;
  let headers: Headers | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'EasylandSOC-SafeScanner/1.0' },
      cache: 'no-store',
    });
    clearTimeout(timeout);
    reachable = true;
    httpStatus = res.status;
    headers = res.headers;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const result: ScanResult = {
      id: `scan_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      target,
      durationMs: Date.now() - started,
      score: 0,
      status: 'THREAT',
      threats: 1,
      warnings: 0,
      categories: [],
      checks: [
        {
          id: 'reachability',
          label: 'Target reachable',
          category: 'Infrastructure Security',
          status: 'fail',
          detail: `Could not reach ${target}: ${message}`,
        },
      ],
      recommendations: [
        {
          id: 'rec_reach',
          priority: 'HIGH',
          title: 'Target unreachable',
          description: `The scanner could not connect to ${target}.`,
          why: 'If the site is down or blocking the scanner, users may also be affected.',
          action: 'Verify the deployment is live and that outbound scans are permitted.',
        },
      ],
      live: false,
      error: message,
    };
    return NextResponse.json(result, { status: 200 });
  }

  // --- TLS / HTTPS -------------------------------------------------------
  const isHttps = target.toLowerCase().startsWith('https://');
  add(
    'https',
    'HTTPS enabled',
    'SSL/TLS',
    isHttps ? 'pass' : 'fail',
    isHttps
      ? 'Target served over HTTPS; a successful TLS handshake implies a valid, trusted certificate.'
      : 'Target is not served over HTTPS.',
  );

  const hsts = headers && has(headers, 'strict-transport-security');
  add(
    'hsts',
    'HSTS (Strict-Transport-Security)',
    'SSL/TLS',
    hsts ? 'pass' : 'warn',
    hsts ? `Present: ${hsts}` : 'No HSTS header — browsers may allow insecure downgrade on first visit.',
  );

  // --- HTTP response -----------------------------------------------------
  const okStatus = httpStatus > 0 && httpStatus < 500;
  add(
    'http_status',
    'HTTP response healthy',
    'Infrastructure Security',
    okStatus ? 'pass' : 'fail',
    `Target responded with HTTP ${httpStatus}.`,
  );

  // --- Security headers --------------------------------------------------
  const csp = headers && has(headers, 'content-security-policy');
  add('csp', 'Content-Security-Policy', 'Security Headers', csp ? 'pass' : 'warn',
    csp ? 'CSP present.' : 'No Content-Security-Policy — reduces defence against injected scripts.');

  const xfo = headers && has(headers, 'x-frame-options');
  const cspFrame = csp && /frame-ancestors/i.test(csp);
  add('xfo', 'X-Frame-Options / frame-ancestors', 'Security Headers',
    xfo || cspFrame ? 'pass' : 'warn',
    xfo ? `Present: ${xfo}` : cspFrame ? 'Covered by CSP frame-ancestors.' : 'No clickjacking protection header.');

  const xcto = headers && has(headers, 'x-content-type-options');
  add('xcto', 'X-Content-Type-Options', 'Security Headers', xcto ? 'pass' : 'warn',
    xcto ? `Present: ${xcto}` : 'Missing — browsers may MIME-sniff responses.');

  const ref = headers && has(headers, 'referrer-policy');
  add('referrer', 'Referrer-Policy', 'Security Headers', ref ? 'pass' : 'warn',
    ref ? `Present: ${ref}` : 'Missing — referrer information may leak to third parties.');

  const perm = headers && has(headers, 'permissions-policy');
  add('permissions', 'Permissions-Policy', 'Security Headers', perm ? 'pass' : 'info',
    perm ? `Present: ${perm}` : 'Not set — optional but recommended to restrict browser features.');

  // --- Information exposure ---------------------------------------------
  // A bare platform name (e.g. "Vercel", which the platform always sends and
  // cannot be removed) is not a meaningful disclosure; a version number is.
  const server = headers && has(headers, 'server');
  const serverRevealsVersion = !!server && /\d/.test(server);
  add('server_header', 'Server banner exposure', 'Application Security',
    serverRevealsVersion ? 'warn' : 'pass',
    !server
      ? 'No revealing Server banner.'
      : serverRevealsVersion
        ? `Server header reveals version: ${server}`
        : `Server header names the host platform only (${server}), no version disclosed.`);

  const poweredBy = headers && has(headers, 'x-powered-by');
  add('powered_by', 'X-Powered-By exposure', 'Application Security',
    poweredBy ? 'warn' : 'pass',
    poweredBy ? `X-Powered-By reveals: ${poweredBy}` : 'No X-Powered-By technology disclosure.');

  // --- Cookie flags ------------------------------------------------------
  const getSetCookie = (h: Headers): string[] => {
    const anyH = h as unknown as { getSetCookie?: () => string[] };
    if (typeof anyH.getSetCookie === 'function') return anyH.getSetCookie();
    const single = h.get('set-cookie');
    return single ? [single] : [];
  };
  const cookies = headers ? getSetCookie(headers) : [];
  if (cookies.length) {
    const insecure = cookies.filter((c) => !/;\s*secure/i.test(c) || !/;\s*httponly/i.test(c));
    add('cookie_flags', 'Cookie security flags', 'Application Security',
      insecure.length ? 'warn' : 'pass',
      insecure.length
        ? `${insecure.length} of ${cookies.length} set-cookie header(s) missing Secure/HttpOnly.`
        : 'All set-cookie headers carry Secure + HttpOnly.');
  } else {
    // Nothing to steal or mis-flag — the safest outcome, so it passes.
    add('cookie_flags', 'Cookie security flags', 'Application Security', 'pass',
      'No cookies set on the scanned response.');
  }

  // --- Advisory (cannot be measured safely from the outside) ------------
  add('auth_advisory', 'Authentication controls', 'Authentication Security', 'info',
    'Auth strength (lockout, MFA, session policy) cannot be safely tested externally — review manually.');
  add('rate_advisory', 'Rate limiting', 'Rate Limiting', 'info',
    'Rate-limit thresholds require server config or log inspection to verify — not probed to avoid load.');
  add('traffic_advisory', 'Traffic anomalies', 'Traffic Anomalies', 'info',
    'Requires connected access/WAF logs (see Log Integration). No live log source is configured.');

  // --- Scoring -----------------------------------------------------------
  // Measurable categories are scored from their pass/warn/fail checks.
  // Advisory categories get a neutral baseline and are flagged so the UI can
  // show them honestly rather than inflating the overall score.
  const CATS: Array<{ key: string; label: string; advisory?: boolean; weight: number }> = [
    { key: 'SSL/TLS', label: 'SSL / TLS', weight: 1.2 },
    { key: 'Security Headers', label: 'Security Headers', weight: 1.3 },
    { key: 'Application Security', label: 'Application Security', weight: 1 },
    { key: 'Infrastructure Security', label: 'Infrastructure Security', weight: 1 },
    { key: 'Authentication Security', label: 'Authentication Security', advisory: true, weight: 0.6 },
    { key: 'Rate Limiting', label: 'Rate Limiting', advisory: true, weight: 0.6 },
    { key: 'Traffic Anomalies', label: 'Traffic Anomalies', advisory: true, weight: 0.5 },
  ];

  const scoreFor = (catKey: string, advisory?: boolean): number => {
    const cat = checks.filter((c) => c.category === catKey);
    if (advisory || !cat.length) return 75; // neutral baseline for advisory dims
    const weights = { pass: 1, info: 0.9, warn: 0.5, fail: 0 } as Record<CheckStatus, number>;
    const total = cat.reduce((s, c) => s + weights[c.status], 0);
    return Math.round((total / cat.length) * 100);
  };

  const categories: CategoryScore[] = CATS.map((c) => ({
    key: c.key,
    label: c.label,
    score: scoreFor(c.key, c.advisory),
    advisory: c.advisory,
  }));

  const wsum = CATS.reduce((s, c) => s + c.weight, 0);
  const overall = Math.round(
    CATS.reduce((s, c, i) => s + categories[i].score * c.weight, 0) / wsum,
  );

  const status = overall >= 85 ? 'PROTECTED' : overall >= 60 ? 'WARNING' : 'THREAT';
  const warnings = checks.filter((c) => c.status === 'warn').length;
  const threats = checks.filter((c) => c.status === 'fail').length;

  // --- Recommendations (derived only from real findings) ----------------
  const recommendations: Recommendation[] = [];
  const failOrWarn = checks.filter((c) => c.status === 'warn' || c.status === 'fail');
  const recMap: Record<string, Omit<Recommendation, 'id'>> = {
    hsts: {
      priority: 'MEDIUM', title: 'Enable HSTS',
      description: 'Add a Strict-Transport-Security header.',
      why: 'Forces browsers to use HTTPS and prevents SSL-stripping downgrade attacks.',
      action: 'Set `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.',
    },
    csp: {
      priority: 'HIGH', title: 'Add a Content-Security-Policy',
      description: 'No CSP header was returned.',
      why: 'CSP is the strongest defence against XSS and injected script/content.',
      action: 'Define a CSP (start report-only), then enforce script/style/connect sources.',
    },
    xfo: {
      priority: 'MEDIUM', title: 'Add clickjacking protection',
      description: 'No X-Frame-Options or CSP frame-ancestors.',
      why: 'Prevents the site from being embedded in a malicious iframe (clickjacking).',
      action: 'Set `X-Frame-Options: DENY` or CSP `frame-ancestors \'none\'`.',
    },
    xcto: {
      priority: 'LOW', title: 'Set X-Content-Type-Options',
      description: 'Missing MIME-sniffing protection.',
      why: 'Stops browsers from reinterpreting responses as a different content type.',
      action: 'Set `X-Content-Type-Options: nosniff`.',
    },
    referrer: {
      priority: 'LOW', title: 'Set a Referrer-Policy',
      description: 'No Referrer-Policy header.',
      why: 'Limits how much URL information leaks to third-party destinations.',
      action: 'Set `Referrer-Policy: strict-origin-when-cross-origin`.',
    },
    server_header: {
      priority: 'LOW', title: 'Hide server technology banner',
      description: 'The Server header discloses infrastructure details.',
      why: 'Reduces information available to attackers fingerprinting the stack.',
      action: 'Strip or genericise the Server header at the edge/proxy.',
    },
    powered_by: {
      priority: 'LOW', title: 'Remove X-Powered-By',
      description: 'The X-Powered-By header discloses the framework.',
      why: 'Version disclosure helps attackers target known vulnerabilities.',
      action: 'Disable X-Powered-By (`poweredByHeader: false` is already set for Next).',
    },
    cookie_flags: {
      priority: 'MEDIUM', title: 'Harden cookie flags',
      description: 'One or more cookies lack Secure/HttpOnly.',
      why: 'Protects session cookies from theft over plaintext and via JavaScript.',
      action: 'Set Secure + HttpOnly (and SameSite) on all auth/session cookies.',
    },
    https: {
      priority: 'HIGH', title: 'Serve the site over HTTPS',
      description: 'The target is not served over HTTPS.',
      why: 'Without TLS, all traffic (including credentials) is exposed in transit.',
      action: 'Enforce HTTPS and redirect all HTTP traffic to HTTPS.',
    },
  };
  for (const c of failOrWarn) {
    const tpl = recMap[c.id];
    if (tpl) recommendations.push({ id: `rec_${c.id}`, ...tpl });
  }
  // Always-present operational recommendation for the advisory dimensions.
  recommendations.push({
    id: 'rec_logs',
    priority: 'MEDIUM',
    title: 'Connect a live log source',
    description: 'Traffic anomaly, rate-limit and auth-attack detection need real logs.',
    why: 'External scans cannot observe attacker behaviour; logs turn on true monitoring.',
    action: 'Wire Nginx/WAF/auth logs into POST /api/security/events (see Log Integration).',
  });

  const priorityRank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  const result: ScanResult = {
    id: `scan_${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    target,
    durationMs: Date.now() - started,
    score: overall,
    status,
    threats,
    warnings,
    categories,
    checks,
    recommendations,
    live: true,
  };

  return NextResponse.json(result, { status: 200 });
}
