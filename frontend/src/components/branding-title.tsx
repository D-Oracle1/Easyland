'use client';

import { useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';

/**
 * Sets the browser tab title to the CMS company name.
 * Watches for route transitions and re-applies automatically.
 */
export function BrandingTitle() {
  const branding = useBranding();

  useEffect(() => {
    if (!branding.companyName) return;

    const name = branding.companyName;

    const applyTitle = () => {
      const current = document.title;
      // Already branded — stop. This is the critical guard: the MutationObserver
      // below reacts to our OWN writes, and because `name` itself contains
      // "Easyland", re-running the replace below would keep matching and rewrite
      // the title forever ("Easyland Realty Realty..."), pegging the main thread
      // and triggering Chrome's "page unresponsive" freeze. Once the title
      // contains the company name we have reached the fixed point — do nothing.
      if (current.includes(name)) return;

      let next = current;
      if (current === 'Loading...') {
        next = name;
      } else if (current.includes('Easyland')) {
        next = current.replace(/Easyland/g, name);
      }

      // Only write when something actually changed, so the observer never
      // fires on a no-op mutation.
      if (next !== current) {
        document.title = next;
      }
    };

    // Apply immediately
    applyTitle();

    // Watch for title changes from Next.js route transitions
    const titleEl = document.querySelector('title');
    if (!titleEl) return;

    const observer = new MutationObserver(applyTitle);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => observer.disconnect();
  }, [branding.companyName]);

  return null;
}
