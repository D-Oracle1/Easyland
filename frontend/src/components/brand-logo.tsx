'use client';

import { cn } from '@/lib/utils';

/**
 * The company logo exactly as it appears on the installed app icon: the logo
 * on the green brand tile, generated per tenant by /api/app-icon. Using the
 * same image everywhere (sidebar, navbar, footer, login, reports, favicon,
 * splash) keeps the brand consistent and always readable on any background.
 *
 * `src` only says whether the tenant has a logo (callers pass branding.logo);
 * the tile itself is fetched same-origin and sized for crisp display.
 * `on` is kept for call-site compatibility — the tile works on both.
 */
export const APP_ICON_TILE = '/api/app-icon?size=192&rounded=1&v=2';

export function BrandLogo({
  src,
  alt,
  className,
}: {
  src?: string;
  alt?: string;
  /** Background the logo sits on (no longer changes rendering) */
  on?: 'light' | 'dark';
  className?: string;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={APP_ICON_TILE}
      alt={alt ?? ''}
      width={192}
      height={192}
      className={cn('aspect-square object-contain', className)}
    />
  );
}
