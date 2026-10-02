'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, EllipsisVertical, MonitorDown, Share, SquarePlus, X } from 'lucide-react';
import { useBranding, getCompanyName } from '@/hooks/use-branding';
import { isInstalledApp } from '@/lib/pwa';
import { APP_ICON_TILE } from '@/components/brand-logo';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa_install_dismissed_at';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // "Not now" hides it for a week
const SHOW_AFTER_MS = 4000; // let the page settle first

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

type Step = { icon: ReactNode; text: ReactNode };
type Guide = { subtitle: string; steps: Step[] };

const stepIcon = (node: ReactNode) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-900">{node}</span>
);

/**
 * Browsers that can install the app but have no install API (so no real
 * Install button): show their own short steps instead.
 *  - iOS: every browser installs via Share → Add to Home Screen (Safari always;
 *    Chrome, Edge, Firefox since iOS 16.4). Safari's Share is in the toolbar,
 *    the others put it in or beside the address bar.
 *  - Firefox on Android: menu (⋮) → Install.
 *  - Safari on Mac (macOS Sonoma / Safari 17+): File → Add to Dock.
 * Chrome, Edge, Samsung Internet and Opera fire beforeinstallprompt instead.
 */
function manualGuide(): Guide | null {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const ios = /iphone|ipad|ipod/i.test(ua) || iPadOS;

  if (ios) {
    const safari = !/crios|fxios|edgios|opios/i.test(ua);
    return {
      subtitle: 'Full screen, faster to open, right from your home screen.',
      steps: [
        {
          icon: stepIcon(<Share className="h-3.5 w-3.5 text-blue-500" />),
          text: safari ? <>Tap <b>Share</b> in Safari&apos;s toolbar</> : <>Tap <b>Share</b> in the address bar</>,
        },
        { icon: stepIcon(<SquarePlus className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />), text: <>Choose <b>Add to Home Screen</b></> },
      ],
    };
  }

  if (/android/i.test(ua) && /firefox\//i.test(ua)) {
    return {
      subtitle: 'Full screen, faster to open, right from your home screen.',
      steps: [
        { icon: stepIcon(<EllipsisVertical className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />), text: <>Tap the <b>menu</b> (⋮) in Firefox</> },
        { icon: stepIcon(<SquarePlus className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />), text: <>Choose <b>Install</b> (or <b>Add to Home screen</b>)</> },
      ],
    };
  }

  const safariVersion = /version\/(\d+)[\d.]* .*safari/i.exec(ua);
  const macSafari = /macintosh/i.test(ua) && !iPadOS && !!safariVersion && !/chrome|chromium|edg\/|firefox|opr\//i.test(ua);
  if (macSafari && Number(safariVersion![1]) >= 17) {
    return {
      subtitle: 'Opens in its own window, right from your Dock.',
      steps: [
        { icon: stepIcon(<MonitorDown className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />), text: <>Click <b>File</b> in the menu bar (or the <b>Share</b> button)</> },
        { icon: stepIcon(<SquarePlus className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" />), text: <>Choose <b>Add to Dock</b></> },
      ],
    };
  }

  return null;
}

/**
 * "Install the app" card. Where the browser supports it (Chrome, Edge, Samsung
 * Internet, Opera) it triggers the real install dialog via beforeinstallprompt;
 * elsewhere it shows that browser's install steps (see manualGuide). Never shown
 * inside the installed app, and "Not now" / close snoozes it for a week.
 */
export function PWAInstallPrompt() {
  const branding = useBranding();
  const name = getCompanyName(branding);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isInstalledApp() || snoozed()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    };

    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own card instead of the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
      reveal();
    };
    const onInstalled = () => { setOpen(false); setDeferred(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const manual = manualGuide();
    if (manual) { setGuide(manual); reveal(); }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setDeferred(null);
    if (outcome === 'accepted') setOpen(false);
    else dismiss();
  };

  if (!open || (!deferred && !guide)) return null;
  // A real install button beats manual steps when the browser offers both
  const showSteps = !deferred && guide;

  return (
    <div
      role="dialog"
      aria-label={`Install the ${name} app`}
      className="pwa-install-card fixed inset-x-3 z-[70] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 md:inset-x-auto md:right-6"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/85 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl dark:border-white/10 dark:bg-gray-900/85">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3.5 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={APP_ICON_TILE} alt="" width={52} height={52} className="h-[52px] w-[52px] shrink-0 rounded-2xl shadow-md" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white">Install the {name} app</p>
            <p className="text-[13px] leading-snug text-gray-500 dark:text-gray-400">
              {showSteps ? guide.subtitle : 'Full screen, faster to open, right from your home screen.'}
            </p>
          </div>
        </div>

        {showSteps ? (
          <ol className="mt-3.5 space-y-2 rounded-2xl bg-gray-50 p-3 text-[13px] text-gray-700 dark:bg-gray-800/70 dark:text-gray-200">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                {step.icon}
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-700 py-2.5 text-sm font-semibold text-white shadow-sm shadow-green-900/20 hover:bg-green-600"
            >
              <Download className="h-4 w-4" /> Install
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
