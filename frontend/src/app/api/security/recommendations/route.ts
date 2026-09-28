import { NextResponse } from 'next/server';
import type { Recommendation } from '@/lib/security/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/security/recommendations
 *
 * Baseline, always-applicable security best practices. Scan-specific
 * recommendations (derived from real findings) are returned by the scan
 * endpoint; this endpoint provides the standing operational checklist.
 */
const BASELINE: Recommendation[] = [
  {
    id: 'base_mfa',
    priority: 'HIGH',
    title: 'Enforce strong authentication controls',
    description: 'Require MFA for administrators and apply account lockout on repeated failures.',
    why: 'Credential stuffing and brute-force attacks target authentication first.',
    action: 'Enable MFA for admin/staff roles and cap failed logins with progressive backoff.',
  },
  {
    id: 'base_ratelimit',
    priority: 'MEDIUM',
    title: 'Configure rate limiting',
    description: 'Throttle auth and write-heavy endpoints per IP and per account.',
    why: 'Rate limiting blunts brute-force, scraping, and abusive automation.',
    action: 'Add per-route rate limits at the edge/proxy and in the API gateway.',
  },
  {
    id: 'base_headers',
    priority: 'MEDIUM',
    title: 'Harden security headers',
    description: 'Ship CSP, HSTS, X-Content-Type-Options, Referrer-Policy on every response.',
    why: 'Headers provide defence-in-depth against XSS, clickjacking, and downgrade attacks.',
    action: 'Set headers centrally in next.config / edge middleware.',
  },
  {
    id: 'base_logs',
    priority: 'HIGH',
    title: 'Connect live security logs',
    description: 'Stream Nginx/WAF/auth logs into the event pipeline.',
    why: 'Real-time detection of anomalies and attacks requires actual traffic data.',
    action: 'Ship normalised events to POST /api/security/events and persist them.',
  },
];

export async function GET() {
  return NextResponse.json({ recommendations: BASELINE }, { headers: { 'Cache-Control': 'no-store' } });
}
