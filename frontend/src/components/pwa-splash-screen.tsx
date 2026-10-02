'use client';

import { useEffect, useState } from 'react';
import { isInstalledApp } from '@/lib/pwa';
import { ICON_VERSION, LAUNCH_CIRCLE_PX, LAUNCH_ICON_PX, MASKABLE_BG } from '@/lib/brand-colors';

/** The maskable icon — the exact image Android puts on its own launch screen. */
const LAUNCH_ICON = `/api/app-icon?size=512&maskable=1&v=${ICON_VERSION}`;

/** Splash stays until this long after launch (navigation start) … */
const HOLD_MS = 3600;
/** … but never longer than this, even if the page is slow to load. */
const MAX_MS = 6500;
const FADE_MS = 600;

/**
 * Launch splash for the installed app.
 *
 * Android 12+ always shows its own launch screen first (it cannot be disabled).
 * This splash starts as an exact copy of it — the maskable icon cropped to the
 * same 160px circle, centred, on the same white — so the hand-over is invisible
 * and the two read as one longer splash. Then the doodle pattern and loading
 * bar fade in and the logo breathes until the app is ready.
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

  const inset = (LAUNCH_ICON_PX - LAUNCH_CIRCLE_PX) / 2;

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

      {/* Same circle, size and position as Android's launch-screen icon */}
      <div
        className="pwa-splash-logo absolute left-1/2 top-1/2 overflow-hidden rounded-full shadow-[0_12px_40px_rgba(22,101,52,0.25)]"
        style={{
          width: LAUNCH_CIRCLE_PX,
          height: LAUNCH_CIRCLE_PX,
          marginLeft: -LAUNCH_CIRCLE_PX / 2,
          marginTop: -LAUNCH_CIRCLE_PX / 2,
          background: MASKABLE_BG,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LAUNCH_ICON}
          alt=""
          width={LAUNCH_ICON_PX}
          height={LAUNCH_ICON_PX}
          fetchPriority="high"
          className="absolute max-w-none"
          style={{ left: -inset, top: -inset, width: LAUNCH_ICON_PX, height: LAUNCH_ICON_PX }}
        />
      </div>

      {/* Loading bar, below the circle so the circle stays exactly centred */}
      <div
        className="pwa-splash-barwrap absolute left-1/2 h-1 w-16 -translate-x-1/2 overflow-hidden rounded-full bg-green-700/15"
        style={{ top: `calc(50% + ${LAUNCH_CIRCLE_PX / 2 + 40}px)` }}
      >
        <div className="pwa-splash-bar h-full w-1/3 rounded-full bg-green-700" />
      </div>
    </div>
  );
}
