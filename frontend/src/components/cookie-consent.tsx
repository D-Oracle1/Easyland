'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { Button } from '@/components/ui/button';

type Consent = 'accepted' | 'declined';

const COOKIE_NAME = 'cookie_consent';
const ONE_YEAR = 60 * 60 * 24 * 365;
// Dispatch this event (e.g. from a "Cookie settings" link) to re-open the banner.
export const OPEN_COOKIE_SETTINGS_EVENT = 'open-cookie-settings';

function readConsent(): Consent | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(accepted|declined)`));
  return (match?.[1] as Consent) ?? null;
}

function writeConsent(value: Consent) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    setConsent(saved);
    setOpen(saved === null);

    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const choose = (value: Consent) => {
    writeConsent(value);
    setConsent(value);
    setOpen(false);
  };

  return (
    <>
      {/* Analytics only loads after explicit consent */}
      {consent === 'accepted' && <Analytics />}

      {open && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-lg border bg-background p-4 shadow-lg sm:inset-x-auto sm:left-4"
        >
          <p className="text-sm text-muted-foreground">
            We use essential cookies to keep you signed in and secure. With your permission we also
            collect anonymous usage analytics to improve the site.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => choose('declined')}>
              Essential only
            </Button>
            <Button size="sm" onClick={() => choose('accepted')}>
              Accept all
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
