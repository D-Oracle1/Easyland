'use client';

import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
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

/**
 * iOS has no install API — every browser installs via its Share menu (Safari
 * always; Chrome, Edge and Firefox since iOS 16.4). Safari's Share button is in
 * the bottom toolbar; the others put it in or beside the address bar.
 */
function iosBrowser(): 'safari' | 'other' | null {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return null;
  return /crios|fxios|edgios|opios/i.test(ua) ? 'other' : 'safari';
}

/**
 * "Install the app" card. On Android/desktop Chromium it triggers the browser's
 * real install dialog (beforeinstallprompt); on iOS Safari, which has no install
 * API, it shows the Share → Add to Home Screen steps. Never shown inside the
 * installed app, and "Not now" snoozes it for a week.
 */
export function PWAInstallPrompt() {
  const branding = useBranding();
  const name = getCompanyName(branding);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState<'safari' | 'other' | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isInstalledApp() || snoozed()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => { timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS); };

    const onPrompt = (e: Event) => {
      e.preventDefault(); // we show our own card instead of the mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
      reveal();
    };
    const onInstalled = () => { setOpen(false); setDeferred(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const browser = iosBrowser();
    if (browser) { setIos(browser); reveal(); }

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

  if (!open || (!deferred && !ios)) return null;

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
              Full screen, faster to open, right from your home screen.
            </p>
          </div>
        </div>

        {ios ? (
          <ol className="mt-3.5 space-y-2 rounded-2xl bg-gray-50 p-3 text-[13px] text-gray-700 dark:bg-gray-800/70 dark:text-gray-200">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-900"><Share className="h-3.5 w-3.5 text-blue-500" /></span>
              {ios === 'safari' ? <>Tap <b>Share</b> in Safari&apos;s toolbar</> : <>Tap <b>Share</b> in the address bar</>}
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-gray-900"><SquarePlus className="h-3.5 w-3.5 text-gray-700 dark:text-gray-200" /></span>
              Choose <b>Add to Home Screen</b>
            </li>
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
