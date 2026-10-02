'use client';

import { useEffect, useRef, useState } from 'react';

/** Same generated tile as the installed app icon and favicon (see /api/app-icon). */
const SPLASH_ICON = '/api/app-icon?size=320&rounded=1&v=2';

/**
 * Branded launch splash for the installed PWA.
 *
 * Shows the app icon (company logo on the brand tile — the same image as the
 * home-screen icon and favicon) on the deep brand-green background when the
 * app is opened in standalone (installed) mode, then fades out once the page
 * has loaded AND the icon has painted (up to a hard cap). Plain web visits are
 * left untouched.
 */
export function PWASplashScreen() {
  const [visible, setVisible] = useState(false);
  const [iconLoaded, setIconLoaded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  // Decide whether to show the splash (installed PWA, once per app session).
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone || sessionStorage.getItem('pwa_splash_shown')) return;
    sessionStorage.setItem('pwa_splash_shown', '1');

    startRef.current = Date.now();
    setVisible(true);
  }, []);

  // Fade the splash out once the page is loaded and the logo is on screen —
  // but never hold longer than MAX_MS so a failed fetch can't trap the user.
  useEffect(() => {
    if (!visible || doneRef.current) return;

    const MIN_MS = 800; // keep the logo up long enough to register
    const MAX_MS = 3000; // hard ceiling — always release the splash
    const FADE_MS = 400;

    const beginLeave = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setLeaving(true);
      window.setTimeout(() => setVisible(false), FADE_MS);
    };

    // Absolute safety cap.
    const cap = window.setTimeout(beginLeave, MAX_MS);

    const pageReady = document.readyState === 'complete';
    const logoReady = iconLoaded;

    // Release once the window has loaded and the brand logo can paint.
    if (pageReady && logoReady) {
      const wait = Math.max(0, MIN_MS - (Date.now() - startRef.current));
      const t = window.setTimeout(beginLeave, wait);
      return () => {
        window.clearTimeout(cap);
        window.clearTimeout(t);
      };
    }

    // Not ready yet: re-run this effect when the window finishes loading.
    // (Icon readiness re-runs it via the `iconLoaded` dependency.)
    const onLoad = () => setVisible((v) => v); // nudge a re-render
    if (!pageReady) window.addEventListener('load', onLoad, { once: true });

    return () => {
      window.clearTimeout(cap);
      window.removeEventListener('load', onLoad);
    };
  }, [visible, iconLoaded]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#15803d] via-[#166534] to-[#0d2b1c] transition-opacity ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: '400ms' }}
    >
      <style>{`
        @keyframes pwaSplashPop {
          0% { opacity: 0; transform: scale(.82); }
          60% { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pwaSplashBar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pwa-splash-logo { animation: none !important; }
          .pwa-splash-bar { animation: none !important; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SPLASH_ICON}
          alt=""
          onLoad={() => setIconLoaded(true)}
          onError={() => setIconLoaded(true)}
          className="pwa-splash-logo h-32 w-32 rounded-[28px] shadow-2xl ring-1 ring-white/20"
          // Pop in only once the image has actually decoded
          style={iconLoaded ? { animation: 'pwaSplashPop .6s ease-out both' } : { opacity: 0 }}
        />

        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <div
            className="pwa-splash-bar h-full w-1/3 rounded-full"
            style={{ background: '#ffffff', animation: 'pwaSplashBar 1.1s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
