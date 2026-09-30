'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Crown,
  MessageSquare,
  Receipt,
  Shield,
  ShieldCheck,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
  Award,
  Search,
} from 'lucide-react';

// CMS icon names are free text ("Crown", "CROWN", ...) — match case-insensitively
const ICONS: Record<string, any> = {
  crown: Crown, users: Users, building2: Building2, trendingup: TrendingUp, award: Award, barchart3: BarChart3,
  messagesquare: MessageSquare, shield: Shield, zap: Zap, star: Star, search: Search, trophy: Trophy, wallet: Wallet,
};
const iconFor = (name?: string) => ICONS[(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || Zap;

// Tools the platform actually ships — shown after any CMS-provided items
const BUILT_IN = [
  { icon: Trophy, title: 'Realtor dashboards & ranks', description: 'Every realtor tracks their sales and levels up from Bronze to Platinum.' },
  { icon: Wallet, title: 'Commission tracking', description: 'Commission and tax calculated automatically on every payment.' },
  { icon: Receipt, title: 'Installment plans & receipts', description: 'Flexible payment plans with instant, verifiable receipts.' },
  { icon: ShieldCheck, title: 'Secure accounts', description: 'Protected sign-in and encrypted connections for every user.' },
  { icon: MessageSquare, title: 'Team chat & alerts', description: 'Real-time messages and notifications keep deals moving.' },
  { icon: Calendar, title: 'Events & site visits', description: 'Publish inspections and events, and manage registrations.' },
];

export function PlatformShowcase({ cmsFeatures, companyName }: { cmsFeatures: any[]; companyName: string }) {
  // A single CMS item is used as the brand highlight; more are shown as tools
  const [highlight, ...cmsTools] = cmsFeatures.length === 1 ? [cmsFeatures[0]] : [undefined, ...cmsFeatures];
  const tools = [
    ...cmsTools.filter(Boolean).map((f: any) => ({ icon: iconFor(f.icon), title: f.title, description: f.description })),
    ...BUILT_IN,
  ].slice(0, 6);
  const HighlightIcon = iconFor(highlight?.icon);

  return (
    <section className="px-4 py-20">
      <div className="container relative mx-auto overflow-hidden rounded-[2.5rem] bg-[#07170f] px-6 py-14 md:px-12 md:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-[100px]" />
          <div className="absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-amber-400/10 blur-[100px]" />
        </div>

        <div className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Platform</span>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white md:text-5xl">Everything You Need to Succeed</h2>
            <p className="mt-4 max-w-md text-base text-white/60">
              Comprehensive tools for managing your real estate business — from first enquiry to final receipt.
            </p>

            {highlight && (
              <figure className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-6 backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-[#07170f]">
                    <HighlightIcon className="h-5 w-5" />
                  </span>
                  <figcaption className="text-sm font-semibold uppercase tracking-wide text-white">
                    {highlight.title || companyName}
                  </figcaption>
                </div>
                {highlight.description && (
                  <blockquote className="mt-4 text-xl font-semibold leading-snug text-amber-100">“{highlight.description}”</blockquote>
                )}
              </figure>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition-colors hover:bg-emerald-50">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                See all features
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {tools.map(({ icon: Icon, title, description }, i) => (
              <div
                key={title}
                className={`group rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.08] ${
                  i % 2 === 1 ? 'sm:translate-y-6 sm:hover:translate-y-5' : ''
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 transition-colors group-hover:bg-emerald-400 group-hover:text-[#07170f]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
