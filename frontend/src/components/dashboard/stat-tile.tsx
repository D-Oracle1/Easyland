'use client';

import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'brand' | 'amber' | 'sky' | 'rose' | 'slate';

const TONES: Record<StatTone, string> = {
  brand: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

/**
 * KPI tile used on every dashboard home. `featured` renders the brand
 * gradient version for the headline metric.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon = BarChart3,
  tone = 'brand',
  featured = false,
  loading = false,
  index = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: StatTone;
  featured?: boolean;
  loading?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5',
        featured
          ? 'bg-gradient-to-br from-primary-800 to-brand-deep text-white shadow-lg shadow-primary/20'
          : 'border border-black/[0.05] bg-card shadow-[0_1px_3px_rgba(16,40,24,0.06)] hover:shadow-[0_12px_28px_-14px_rgba(16,40,24,0.25)] dark:border-white/[0.06]',
      )}
    >
      {featured && <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />}
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('text-sm font-medium', featured ? 'text-white/70' : 'text-muted-foreground')}>{label}</p>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            featured ? 'bg-white/15 text-white' : TONES[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className={cn('relative mt-3 text-2xl font-bold tracking-tight sm:text-[1.7rem]', featured ? 'text-white' : 'text-foreground')}>
        {loading ? <span className={cn('inline-block h-7 w-24 animate-pulse rounded-md', featured ? 'bg-white/20' : 'bg-muted')} /> : value}
      </p>
      {hint && <p className={cn('relative mt-1 text-xs', featured ? 'text-white/60' : 'text-muted-foreground')}>{hint}</p>}
    </motion.div>
  );
}

/** Map legacy per-page colour classes (e.g. "text-orange-600") to a StatTile tone. */
export function toneFromClass(color?: string): StatTone {
  const c = color || '';
  if (/orange|amber|yellow/.test(c)) return 'amber';
  if (/blue|sky|cyan/.test(c)) return 'sky';
  if (/red|rose|pink/.test(c)) return 'rose';
  if (/purple|violet|slate|gray/.test(c)) return 'slate';
  return 'brand';
}
