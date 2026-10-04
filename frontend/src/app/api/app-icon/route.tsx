import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { MASKABLE_BG, MASKABLE_LOGO_RATIO } from '@/lib/brand-colors';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

// Brand tile: the homepage CTA gradient
const FROM = '#15803d';
const TO = '#0d2b1c';

/**
 * Generated app icon for the current tenant: the company logo centred on the
 * brand-green gradient tile. Used for the PWA install icon, Apple touch icon,
 * favicon and splash, so the logo always has contrast (the uploaded logo is a
 * white letterform on transparency, which disappears on light backgrounds).
 *
 *   /api/app-icon?size=512            square tile (Apple touch icon)
 *   /api/app-icon?size=512&rounded=1  rounded tile (favicon, Android "any")
 *   /api/app-icon?size=512&maskable=1 extra padding for Android's adaptive mask
 *   /api/app-icon?size=512&bare=1     the logo alone on transparency (splash)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const size = Math.min(1024, Math.max(16, Number(url.searchParams.get('size')) || 512));
  const maskable = url.searchParams.get('maskable') === '1';
  const bare = url.searchParams.get('bare') === '1';

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const domain = host.split(':')[0];

  let logo: string | null = null;
  let name = 'Easyland';
  if (domain) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/companies/resolve?domain=${encodeURIComponent(domain)}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const raw = await res.json();
        const company = raw?.data || raw;
        // Main logo = light letterform, made for dark backgrounds like this tile
        logo = company?.logo || null;
        if (company?.name) name = company.name;
      }
    } catch {
      /* fall back to the initial */
    }
  }

  // Android crops maskable icons to a circle/squircle within the central 80%.
  // Corners are only rounded on request (favicon/Android "any"); iOS rounds
  // touch icons itself and would show transparent corners as black.
  const rounded = url.searchParams.get('rounded') === '1' && !maskable;
  const tile = size;
  // Maskable (home screen + Android launch screen): logo on a solid green square
  // that fills the whole icon — no padding, no white. bare=1: just the logo on
  // transparency (the in-app splash animates it from Android's launch frame).
  const logoSize = Math.round(bare ? size : maskable ? size * MASKABLE_LOGO_RATIO : tile * 0.64);
  const radius = rounded ? Math.round(tile * 0.22) : 0;
  const tileBg = bare ? 'transparent' : maskable ? MASKABLE_BG : `linear-gradient(145deg, ${FROM} 0%, #166534 45%, ${TO} 100%)`;

  const tileEl = (
      <div
        style={{
          width: tile,
          height: tile,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tileBg,
          borderRadius: radius,
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={logoSize} height={logoSize} style={{ objectFit: 'contain' }} alt="" />
        ) : (
          <div style={{ color: 'white', fontSize: Math.round(tile * 0.5), fontWeight: 800 }}>
            {name.trim().charAt(0).toUpperCase()}
          </div>
        )}
      </div>
  );

  return new ImageResponse(
    tileEl,
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    },
  );
}
