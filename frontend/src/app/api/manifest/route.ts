import { NextRequest, NextResponse } from 'next/server';
import { LAUNCH_BG, ICON_VERSION } from '@/lib/brand-colors';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').trim();

const DEFAULT_ICONS = [
  { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
  { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
  { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
  { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
  { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
  { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
  { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
];

export async function GET(req: NextRequest) {
  let companyName = 'Easyland';
  let shortName = 'Easyland';
  let description = 'Enterprise-grade PropTech platform for managing realtors, properties, and clients';
  // Brand CTA green. Launch background is white, like the in-app splash, which
  // starts with the same small square tile Android shows (see lib/brand-colors).
  let themeColor = '#15803d';
  const bgColor = LAUNCH_BG;
  let icons = DEFAULT_ICONS;
  let splashAnimation = 'none';

  // Determine tenant from host header
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const domain = host.split(':')[0]; // strip port if any

  if (domain) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/companies/resolve?domain=${encodeURIComponent(domain)}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const raw = await res.json();
        const company = raw?.data || raw;
        if (company?.name) companyName = company.name;
        if (company?.primaryColor) themeColor = company.primaryColor;
        // (pwaSettings.themeColor / bgColor are superseded by the brand colours)

        const pwa = company?.pwaSettings;
        if (pwa) {
          if (pwa.appName) companyName = pwa.appName;
          if (pwa.shortName) shortName = pwa.shortName;
          if (pwa.description) description = pwa.description;
          if (pwa.splashAnimation) splashAnimation = pwa.splashAnimation;
        }

        // Generated icons: logo on the brand tile (always has contrast), plus
        // a padded maskable version for Android's adaptive icon shapes.
        icons = [
          { src: `/api/app-icon?size=192&rounded=1&v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          // Home screen uses the 192s (bold logo); Android's launch screen uses the
          // 512s, which are the small rounded-square tile on white/transparency.
          { src: `/api/app-icon?size=512&splash=1&v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `/api/app-icon?size=192&maskable=1&v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `/api/app-icon?size=512&maskable=1&splash=1&v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ];
      }
    } catch {
      // Fall back to defaults
    }
  }

  const manifest = {
    id: '/',
    name: companyName,
    short_name: shortName,
    description,
    start_url: '/',
    scope: '/',
    // Full screen: hides the phone's status and navigation bars. Browsers that
    // can't do fullscreen for installed apps fall back to standalone.
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'portrait-primary',
    background_color: bgColor,
    theme_color: themeColor,
    splash_animation: splashAnimation !== 'none' ? splashAnimation : undefined,
    icons,
    categories: ['business', 'productivity'],
    lang: 'en',
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
