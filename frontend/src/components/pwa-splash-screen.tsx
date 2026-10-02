'use client';

import { useEffect, useRef, useState } from 'react';
import { isInstalledApp } from '@/lib/pwa';

/** Same generated tile as the installed app icon and favicon (see /api/app-icon). */
const SPLASH_ICON = '/api/app-icon?size=320&rounded=1&v=2';

/**
 * Branded launch splash for the installed PWA.
 *
 * Shows the app icon (company logo on the brand tile — the same image as the
 * home-screen icon and favicon) on white with a faint doodle pattern when the
 * app is opened in standalone (installed) mode, then fades out once the page
 * has loaded AND the icon has painted (up to a hard cap). Plain web visits are
 * left untouched.
 */
export function PWASplashScreen() {
  const [visible, setVisible] = useState(false);
  const [iconLoaded, setIconLoaded] = useState(false);
  const iconShownAtRef = useRef(0);
  const onIconReady = () => {
    if (!iconShownAtRef.current) iconShownAtRef.current = Date.now();
    setIconLoaded(true);
  };
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  // Decide whether to show the splash (installed PWA, once per app session).
  useEffect(() => {
    if (!isInstalledApp() || sessionStorage.getItem('pwa_splash_shown')) return;
    sessionStorage.setItem('pwa_splash_shown', '1');

    setVisible(true);
  }, []);

  // Fade the splash out once the page is loaded and the logo is on screen —
  // but never hold longer than MAX_MS so a failed fetch can't trap the user.
  useEffect(() => {
    if (!visible || doneRef.current) return;

    // Timed from when the logo appears, so the pop-in always plays in full:
    // ~1.2s pop + a beat of the breathing pulse before fading out.
    const SHOW_MS = 2600;
    const MAX_MS = 5000; // hard ceiling — always release the splash
    const FADE_MS = 600;

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
      const wait = Math.max(0, SHOW_MS - (Date.now() - iconShownAtRef.current));
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: '600ms' }}
    >
      {/* Doodle pattern, faded to 6% */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url('/splash-doodle.webp')", backgroundRepeat: 'repeat', backgroundSize: '320px', opacity: 0.06 }}
      />
      <style>{`
        @keyframes pwaSplashPop {
          0% { opacity: 0; transform: scale(.6) translateY(12px); }
          55% { opacity: 1; transform: scale(1.08) translateY(0); }
          75% { transform: scale(.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pwaSplashBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
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

      <div className="relative flex flex-col items-center gap-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SPLASH_ICON}
          alt=""
          onLoad={onIconReady}
          onError={onIconReady}
          className="pwa-splash-logo h-20 w-20 rounded-[20px] shadow-xl ring-1 ring-black/5"
          // Pop in only once the image has actually decoded, then breathe gently
          style={
            iconLoaded
              ? { animation: 'pwaSplashPop 1.2s cubic-bezier(.22,1,.36,1) both, pwaSplashBreathe 2.4s ease-in-out 1.2s infinite' }
              : { opacity: 0 }
          }
        />

        <div className="h-1 w-16 overflow-hidden rounded-full bg-green-700/15">
          <div
            className="pwa-splash-bar h-full w-1/3 rounded-full"
            style={{ background: '#15803d', animation: 'pwaSplashBar 1.6s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
