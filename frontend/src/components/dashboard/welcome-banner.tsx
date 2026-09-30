'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getUser } from '@/lib/auth-storage';

export interface BannerAction {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Brand welcome banner (homepage CTA gradient) shown at the top of each role's
 * dashboard home: greeting, date, a short summary line and quick actions.
 */
export function WelcomeBanner({
  subtitle,
  actions = [],
  children,
}: {
  subtitle?: string;
  actions?: BannerAction[];
  /** Optional right-hand content (e.g. a headline figure) */
  children?: React.ReactNode;
}) {
  // Read the user after mount so server and client markup match
  const [name, setName] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setName(getUser()?.firstName?.trim() || '');
    setNow(new Date());
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-800 to-brand-deep p-6 text-white shadow-lg shadow-primary/20 sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            {now ? now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ' '}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {now ? greeting(now.getHours()) : 'Welcome'}{name ? `, ${name}` : ''} 👋
          </h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/70">{subtitle}</p>}

          {actions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions.map(({ label, href, icon: Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={
                    i === 0
                      ? 'inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-800 shadow-sm transition-colors hover:bg-white/90'
                      : 'inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20'
                  }
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {children && <div className="relative shrink-0">{children}</div>}
      </div>
    </motion.section>
  );
}
