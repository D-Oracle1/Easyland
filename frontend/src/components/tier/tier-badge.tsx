'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export const TIER_ORDER: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

// ₦ total sales value needed for each tier (mirrors backend loyalty/tiers.ts)
export const TIER_THRESHOLDS: Record<Tier, number> = {
  BRONZE: 0,
  SILVER: 50_000_000,
  GOLD: 150_000_000,
  PLATINUM: 500_000_000,
};

const PALETTE: Record<Tier, { light: string; mid: string; dark: string; rim: string; label: string }> = {
  BRONZE:   { light: '#F3C08F', mid: '#CD7F32', dark: '#7A4513', rim: '#5C330D', label: 'Bronze' },
  SILVER:   { light: '#FFFFFF', mid: '#C0C7D1', dark: '#6B7480', rim: '#4B525C', label: 'Silver' },
  GOLD:     { light: '#FFF3A6', mid: '#F5C518', dark: '#A77A00', rim: '#6E5000', label: 'Gold' },
  PLATINUM: { light: '#F2FBFF', mid: '#9FD8EE', dark: '#3E7F9A', rim: '#24536A', label: 'Platinum' },
};

export function normalizeTier(tier?: string | null): Tier {
  const t = (tier || '').toUpperCase();
  return (TIER_ORDER as string[]).includes(t) ? (t as Tier) : 'BRONZE';
}

export function tierLabel(tier?: string | null) {
  return PALETTE[normalizeTier(tier)].label;
}

interface TierBadgeProps {
  tier?: string | null;
  size?: number;
  className?: string;
  /** Adds a slow shine sweep — use on hero/celebration placements */
  animated?: boolean;
  title?: string;
}

/**
 * Game-style rank emblem: a faceted shield whose chevrons grow with the tier
 * (1 → 3), topped by a crown at Platinum.
 */
export function TierBadge({ tier, size = 40, className, animated, title }: TierBadgeProps) {
  const t = normalizeTier(tier);
  const c = PALETTE[t];
  // Tier in the id: even if ids collide across React roots, they resolve to
  // identical gradients.
  const uid = t + useId().replace(/[^a-zA-Z0-9]/g, '');
  const rank = TIER_ORDER.indexOf(t);
  const chevrons = Math.min(rank + 1, 3);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title ?? `${c.label} tier`}
      className={cn('shrink-0 drop-shadow-sm', className)}
    >
      <title>{title ?? `${c.label} tier`}</title>
      <defs>
        <linearGradient id={`f${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.55" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
          {animated && (
            <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="1 0" dur="2.8s" repeatCount="indefinite" />
          )}
        </linearGradient>
        <clipPath id={`c${uid}`}>
          <path d="M32 6 L54 14 V32 C54 45 44 54 32 58 C20 54 10 45 10 32 V14 Z" />
        </clipPath>
      </defs>

      {/* Shield body */}
      <path d="M32 6 L54 14 V32 C54 45 44 54 32 58 C20 54 10 45 10 32 V14 Z" fill={`url(#f${uid})`} stroke={c.rim} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Inner bevel */}
      <path d="M32 11 L49 17.5 V32 C49 42 41.5 49 32 52.5 C22.5 49 15 42 15 32 V17.5 Z" fill="none" stroke={c.light} strokeOpacity="0.7" strokeWidth="1.5" />

      {/* Rank chevrons */}
      {Array.from({ length: chevrons }).map((_, i) => {
        const y = 40 - i * 7 - (3 - chevrons) * 3.5;
        return (
          <path key={i} d={`M21 ${y} L32 ${y - 6} L43 ${y} L43 ${y + 4} L32 ${y - 2} L21 ${y + 4} Z`} fill={c.rim} fillOpacity="0.85" stroke={c.light} strokeOpacity="0.6" strokeWidth="0.75" />
        );
      })}

      {/* Crown for Platinum, star for the rest */}
      {t === 'PLATINUM' ? (
        <path d="M22 22 L25 14 L29 19 L32 11 L35 19 L39 14 L42 22 Z" fill="#FFF7C2" stroke={c.rim} strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d="M32 13.5 L33.8 17.4 L38 17.8 L34.8 20.6 L35.8 24.7 L32 22.5 L28.2 24.7 L29.2 20.6 L26 17.8 L30.2 17.4 Z" fill={c.light} stroke={c.rim} strokeWidth="0.9" />
      )}

      {/* Shine */}
      <g clipPath={`url(#c${uid})`}>
        <rect x="0" y="0" width="64" height="64" fill={`url(#s${uid})`} />
      </g>
    </svg>
  );
}

/**
 * Wraps an avatar and pins the tier emblem to its bottom-right corner,
 * like a rank badge on a game profile picture.
 */
export function TierAvatar({
  tier,
  children,
  badgeSize,
  className,
}: {
  tier?: string | null;
  children: React.ReactNode;
  badgeSize?: number;
  className?: string;
}) {
  if (!tier) return <>{children}</>;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {children}
      <span className="absolute -bottom-1 -right-1.5 rounded-full bg-background/90 p-[1px]">
        <TierBadge tier={tier} size={badgeSize ?? 18} />
      </span>
    </span>
  );
}
