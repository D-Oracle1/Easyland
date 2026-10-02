'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Building2, Images, Phone, UserRound, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUser } from '@/lib/auth-storage';

/**
 * App-style bottom tab bar for the public site on phones: full width, solid,
 * safe-area aware, with clear labels. Secondary pages (Features, About) live in
 * the navbar's menu sheet. While mounted it pads the page bottom (see
 * body.has-bottom-nav in globals.css) so the bar never covers the footer.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('has-bottom-nav');
    return () => document.body.classList.remove('has-bottom-nav');
  }, []);

  useEffect(() => {
    const user = getUser();
    if (!user) return;
    const role = String(user.role || '')
      .toLowerCase()
      .replace(/_/g, '-');
    setDashboardHref(user.isSuperAdmin || role === 'super-admin' ? '/dashboard/super-admin' : `/dashboard/${role}`);
  }, []);

  const items = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/properties', label: 'Properties', icon: Building2 },
    { href: '/gallery', label: 'Gallery', icon: Images },
    { href: '/contact', label: 'Contact', icon: Phone },
    dashboardHref
      ? { href: dashboardHref, label: 'Dashboard', icon: LayoutDashboard }
      : { href: '/auth/login', label: 'Log in', icon: UserRound },
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    // Floating glass pill — full width (minus a small margin), full-size tabs
    <nav
      aria-label="Main"
      className="fixed inset-x-3 z-50 overflow-hidden rounded-[26px] border border-white/60 bg-white/65 shadow-[0_10px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150 md:hidden dark:border-white/10 dark:bg-gray-900/65"
      style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      {/* glass sheen */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent dark:from-white/5" />
      <ul className="relative mx-auto grid h-16 grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex h-full flex-col items-center justify-center gap-1 transition-transform active:scale-95"
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active
                      ? 'bg-green-700 text-white shadow-md shadow-green-900/25'
                      : 'text-gray-600 dark:text-gray-300',
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                <span
                  className={cn(
                    'text-[11px] font-medium leading-none',
                    active ? 'font-semibold text-green-800 dark:text-green-300' : 'text-gray-600 dark:text-gray-300',
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
