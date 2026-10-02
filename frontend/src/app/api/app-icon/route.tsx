import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { MASKABLE_BG } from '@/lib/brand-colors';

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
 *   …&splash=1                        launch-screen variant: Android draws the
 *                                     largest manifest icon on its launch screen at
 *                                     a fixed size, so this shrinks the visible
 *                                     logo (a small tile on transparency / a small
 *                                     logo on the maskable square)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const size = Math.min(1024, Math.max(16, Number(url.searchParams.get('size')) || 512));
  const maskable = url.searchParams.get('maskable') === '1';
  const splash = url.searchParams.get('splash') === '1';

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
  // Splash (non-maskable): draw a smaller tile centred on transparency
  const tile = splash && !maskable ? Math.round(size * 0.56) : size;
  // Maskable: bold logo, still inside the 2/3 circle Android shows on its
  // launch screen (radius 33%) and the 80% adaptive-icon safe zone.
  const logoSize = Math.round(maskable ? size * 0.56 : tile * 0.64);
  const radius = rounded || (splash && !maskable) ? Math.round(tile * 0.22) : 0;

  const tileEl = (
      <div
        style={{
          width: tile,
          height: tile,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Maskable: solid colour, so our in-app splash can draw the identical
          // circle Android shows on its launch screen (see lib/brand-colors).
          background: maskable ? MASKABLE_BG : `linear-gradient(145deg, ${FROM} 0%, #166534 45%, ${TO} 100%)`,
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
    tile === size ? tileEl : (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tileEl}</div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    },
  );
}
