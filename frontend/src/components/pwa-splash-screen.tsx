'use client';

import { useEffect, useState } from 'react';
import { isInstalledApp } from '@/lib/pwa';
import { ICON_VERSION, LAUNCH_LOGO_PX, LAUNCH_TILE_PX, MASKABLE_BG } from '@/lib/brand-colors';

/** The logo alone (no tile) — sized like Android's launch-screen logo. */
const SPLASH_LOGO = `/api/app-icon?size=256&bare=1&v=${ICON_VERSION}`;
/** Logo size inside the final tile (same 64% as the app tile). */
const TILE_LOGO_PX = LAUNCH_TILE_PX * 0.64;

/** Splash stays until this long after launch (navigation start) … */
const HOLD_MS = 3600;
/** … but never longer than this, even if the page is slow to load. */
const MAX_MS = 6500;
const FADE_MS = 600;

/**
 * Launch splash for the installed app.
 *
 * Android always shows its own launch screen first (it cannot be disabled):
 * plain brand green with the logo in the middle. This splash starts on exactly
 * that frame, then the green shrinks into the small rounded-square app tile and
 * the logo scales down into it, revealing the white doodle background; the
 * shadow and loading bar fade in and the tile breathes until the app is ready.
 * (iOS has no launch screen of its own, so it simply plays the same animation.)
 *
 * Stability: it is server-rendered and shown purely by CSS (display-mode media
 * query in globals.css), so it covers the page from the very first paint — no
 * flash of the page before React hydrates. An inline script in the root layout
 * hides it on later reloads in the same session.
 */
export function PWASplashScreen() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute('data-splash-done')) return;
    if (!isInstalledApp()) {
      root.setAttribute('data-splash-done', '');
      return;
    }
    try { sessionStorage.setItem('pwa_splash_shown', '1'); } catch {}

    let done = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      setTimeout(() => root.setAttribute('data-splash-done', ''), FADE_MS);
    };
    const cap = setTimeout(leave, Math.max(0, MAX_MS - performance.now()));
    const onReady = () => { hold = setTimeout(leave, Math.max(0, HOLD_MS - performance.now())); };
    if (document.readyState === 'complete') onReady();
    else window.addEventListener('load', onReady, { once: true });

    return () => {
      clearTimeout(cap);
      if (hold) clearTimeout(hold);
      window.removeEventListener('load', onReady);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`pwa-splash fixed inset-0 z-[9999] bg-white transition-opacity ease-out ${leaving ? 'opacity-0' : 'opacity-100'}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Doodle pattern — fades in to 6% after the hand-over */}
      <div
        className="pwa-splash-doodle pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url('/splash-doodle.webp')", backgroundRepeat: 'repeat', backgroundSize: '320px' }}
      />

      {/* Starts as Android's launch frame (full green + logo), then shrinks into the tile */}
      <div className="pwa-splash-mark absolute inset-0">
        <div
          className="pwa-splash-shadow absolute left-1/2 top-1/2 rounded-[18px]"
          style={{ width: LAUNCH_TILE_PX, height: LAUNCH_TILE_PX, marginLeft: -LAUNCH_TILE_PX / 2, marginTop: -LAUNCH_TILE_PX / 2 }}
        />
        <div className="pwa-splash-plate absolute inset-0" style={{ background: MASKABLE_BG }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SPLASH_LOGO}
          alt=""
          width={LAUNCH_LOGO_PX}
          height={LAUNCH_LOGO_PX}
          fetchPriority="high"
          className="pwa-splash-logo absolute left-1/2 top-1/2 max-w-none"
          style={
            {
              width: LAUNCH_LOGO_PX,
              height: LAUNCH_LOGO_PX,
              marginLeft: -LAUNCH_LOGO_PX / 2,
              marginTop: -LAUNCH_LOGO_PX / 2,
              '--logo-end': TILE_LOGO_PX / LAUNCH_LOGO_PX,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Loading bar, below the tile so the tile stays exactly centred */}
      <div
        className="pwa-splash-barwrap absolute left-1/2 h-1 w-16 -translate-x-1/2 overflow-hidden rounded-full bg-green-700/15"
        style={{ top: `calc(50% + ${LAUNCH_TILE_PX / 2 + 28}px)` }}
      >
        <div className="pwa-splash-bar h-full w-1/3 rounded-full bg-green-700" />
      </div>
    </div>
  );
}
