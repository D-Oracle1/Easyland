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
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/80 bg-white/95 shadow-[0_-6px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden dark:border-gray-800 dark:bg-gray-950/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex h-full flex-col items-center justify-center gap-1 transition-colors active:bg-gray-50 dark:active:bg-gray-900"
              >
                {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-green-700" />}
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400',
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                <span
                  className={cn(
                    'text-[11px] font-medium leading-none',
                    active ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400',
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
