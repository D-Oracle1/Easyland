import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { SupportChatWidget } from '@/components/support/support-chat-widget';
import { BrandingTitle } from '@/components/branding-title';
import { BrandingGate } from '@/components/branding-gate';
import { PWASplashScreen } from '@/components/pwa-splash-screen';

const inter = Inter({ subsets: ['latin'] });

const APP_DESCRIPTION =
  'Enterprise-grade PropTech platform for managing realtors, properties, and clients';

export const metadata: Metadata = {
  title: {
    default: 'Loading...',
    template: '%s',
  },
  description: APP_DESCRIPTION,
  keywords: ['real estate', 'property management', 'realtors', 'proptech'],
  manifest: '/api/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Easyland',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    description: APP_DESCRIPTION,
  },
  icons: {
    // Dynamic favicon resolves to the current tenant's company logo (by host),
    // with the static favicon as a fallback.
    icon: [
      { url: '/api/favicon', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: [{ url: '/api/favicon' }],
    apple: [
      { url: '/api/favicon' },
      { url: '/apple-touch-icon.png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#22c55e' },
    { media: '(prefers-color-scheme: dark)', color: '#052e16' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Do NOT set maximumScale=1 — iOS 10+ ignores it and Safari flags it as
  // an accessibility violation. Allow users to pinch-zoom freely.
  minimumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/*
          Self-heal: runs on every fresh HTML load, before hydration. It tears
          down the legacy next-pwa precache worker that served stale assets and
          broke navigation until users manually cleared site data. Complements
          the /sw.js kill-switch: the kill-switch heals a stuck browser on its
          next service-worker update check, while this guarantees the old worker
          is gone the moment any fresh page is served, and permanently stops it
          from re-trapping the browser. The push worker (sw-push.js) is left
          alone so notifications keep working. No forced reload — this only runs
          on already-fresh HTML, so referenced chunks are already current.
        */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){var s=r.active||r.waiting||r.installing;var u=(s&&s.scriptURL)||'';if(u.indexOf('/sw-push.js')===-1){r.unregister();}});}).catch(function(){});}if('caches' in window){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});}).catch(function(){});}}catch(e){}})();`,
          }}
        />
        <Providers>
          <PWASplashScreen />
          <BrandingGate>
            <BrandingTitle />
            {children}
            <SupportChatWidget />
          </BrandingGate>
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
