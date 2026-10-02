import Image from 'next/image';
import Link from 'next/link';
import { Home } from 'lucide-react';
import type { ReactNode } from 'react';
import { FloatingBubbles } from '@/components/ui/floating-bubbles';
import { cn } from '@/lib/utils';

/**
 * Shared hero for the public pages: deep brand green with floating bubbles,
 * optionally over a slowly zooming photo. Matches the homepage hero.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  breadcrumb,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional background photo (absolute URL); shown dimmed behind the bubbles */
  image?: string | null;
  /** Current page label for a Home / … breadcrumb */
  breadcrumb?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    // Same green as the dashboard sidebar (primary → primary-800 → brand-deep)
    <section className={cn('relative isolate overflow-hidden bg-gradient-to-br from-primary via-primary-800 to-brand-deep px-4 pb-14 pt-28 md:pb-20 md:pt-36', className)}>
      {/* Background photo */}
      {image && (
        <div aria-hidden className="absolute inset-0 -z-20">
          <Image src={image} alt="" fill priority sizes="100vw" className="hero-kenburns object-cover opacity-45" />
        </div>
      )}
      {/* Brand wash over the photo, in the sidebar green */}
      {image && (
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/85 via-primary-800/80 to-brand-deep/90" />
      )}
      <div aria-hidden className="pointer-events-none absolute -left-24 top-0 -z-10 h-80 w-80 rounded-full bg-emerald-500/25 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -right-16 bottom-0 -z-10 h-72 w-72 rounded-full bg-amber-400/15 blur-[110px]" />
      <FloatingBubbles className="-z-10" density={image ? 'light' : 'normal'} />

      <div className="container relative mx-auto max-w-4xl px-0 text-center">
        {eyebrow && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 backdrop-blur">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-[3.4rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70 md:text-lg">{subtitle}</p>
        )}
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mt-5 flex items-center justify-center gap-2 text-sm text-white/55">
            <Link href="/" className="flex items-center gap-1 transition-colors hover:text-white">
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
            <span>/</span>
            <span className="text-white/90">{breadcrumb}</span>
          </nav>
        )}
        {children}
      </div>
    </section>
  );
}
