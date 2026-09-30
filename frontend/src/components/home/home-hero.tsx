'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Search, MapPin, Sparkles, ArrowUpRight, LandPlot, Home, Users } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import { CATEGORY_TYPES, CATEGORY_LABELS, categoryOf, type PropertyCategory } from '@/lib/property-categories';

type Listings = Record<PropertyCategory, { items: any[]; total: number }>;

const PLACEHOLDER_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1400&q=80',
];

const TABS: { value: '' | PropertyCategory; label: string; icon: any }[] = [
  { value: '', label: 'All', icon: Sparkles },
  { value: 'land', label: 'Land', icon: LandPlot },
  { value: 'homes', label: 'Apartments', icon: Home },
];

const abs = (src: string) => (src.startsWith('http') ? src : getImageUrl(src));

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

export function HomeHero({
  hero,
  companyName,
  listings,
  loading,
  headlineStat,
}: {
  hero: Record<string, any>;
  companyName: string;
  listings: Listings;
  loading: boolean;
  headlineStat?: { value: string; label: string };
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'' | PropertyCategory>('');

  const heroTitle = hero.title || 'Find Your Perfect Property';
  const heroTitleAccent = hero.titleAccent || `with ${companyName}`;
  const heroSubtitle =
    hero.subtitle || 'Discover premium land and apartments, connect with top realtors, and make your real estate dreams a reality.';

  const raw: string[] = [
    ...(Array.isArray(hero.heroImages) ? hero.heroImages : hero.heroImage ? [hero.heroImage] : []),
    ...(Array.isArray(hero.backgroundImages) ? hero.backgroundImages : hero.backgroundImage ? [hero.backgroundImage] : []),
  ].filter(Boolean);
  const images = Array.from(new Set(raw.length ? raw.map(abs) : PLACEHOLDER_HERO_IMAGES));

  const [slide, setSlide] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = useCallback(() => {
    if (images.length <= 1) return;
    timer.current = setInterval(() => setSlide((i) => (i + 1) % images.length), 5500);
  }, [images.length]);
  useEffect(() => {
    start();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [start]);
  const goTo = (i: number) => {
    setSlide(i);
    if (timer.current) clearInterval(timer.current);
    start();
  };

  // Newest listing across categories, shown as a floating card on the image
  const latest = [...listings.land.items, ...listings.homes.items, ...listings.commercial.items]
    .filter((p: any) => p?.id)
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];

  const search = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('search', query.trim());
    if (category) params.set('type', CATEGORY_TYPES[category].join(','));
    router.push(`/properties${params.toString() ? `?${params}` : ''}`);
  };

  const liveStats = [
    { value: loading ? '–' : String(listings.land.total), label: 'Land listings' },
    { value: loading ? '–' : String(listings.homes.total), label: 'Apartments & homes' },
    ...(headlineStat?.value ? [{ value: headlineStat.value, label: headlineStat.label }] : []),
  ];

  return (
    <section className="relative isolate overflow-hidden bg-[#07170f] pb-32 pt-28 md:pb-40 md:pt-32">
      {/* Ambient light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[380px] w-[380px] rounded-full bg-amber-400/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
          }}
        />
      </div>

      <div className="container mx-auto grid items-center gap-14 px-4 lg:grid-cols-[1.05fr_1fr]">
        {/* Copy + search */}
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-emerald-100 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {hero.badgeText || 'New listings added every week'}
          </motion.div>

          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[4.1rem]">
            {heroTitle}{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 bg-clip-text text-transparent">
              {heroTitleAccent}
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
            {heroSubtitle}
          </motion.p>

          {/* Glass search */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3}
            className="mt-9 max-w-xl rounded-3xl border border-white/10 bg-white/[0.07] p-2.5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex gap-1 px-1 pb-2 pt-1" role="tablist" aria-label="Property category">
              {TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={category === value}
                  onClick={() => setCategory(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    category === value ? 'bg-white text-gray-900 shadow' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-white p-1.5 sm:flex-row dark:bg-gray-900">
              <label className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder={category === 'land' ? 'Where do you want land?' : category === 'homes' ? 'Where do you want to live?' : 'City, area or estate name…'}
                  aria-label="Search location"
                  className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
                />
              </label>
              <button
                type="button"
                onClick={search}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:brightness-110"
              >
                <Search className="h-4 w-4" /> Search
              </button>
            </div>
          </motion.div>

          {/* Live stats */}
          <motion.dl variants={fadeUp} initial="hidden" animate="show" custom={4} className="mt-9 flex flex-wrap gap-x-10 gap-y-5">
            {liveStats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse border-l-2 border-emerald-400/60 pl-4">
                <dt className="text-xs uppercase tracking-wider text-white/50">{s.label}</dt>
                <dd className="text-3xl font-bold text-white">{s.value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Image showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="relative mx-auto w-full max-w-[560px]"
        >
          <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.75rem] bg-gradient-to-br from-emerald-400/30 via-transparent to-amber-300/20 blur-2xl" />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/5 shadow-2xl">
            {images.map((src, i) => (
              <div key={src} className="absolute inset-0 transition-all duration-[1200ms] ease-out"
                style={{ opacity: i === slide ? 1 : 0, transform: i === slide ? 'scale(1)' : 'scale(1.04)' }}>
                <Image src={src} alt={`${companyName} showcase ${i + 1}`} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" priority={i === 0} />
              </div>
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

            {images.length > 1 && (
              <div className="absolute right-5 top-5 flex gap-1.5 rounded-full bg-black/30 px-2.5 py-2 backdrop-blur">
                {images.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} aria-label={`Show image ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`} />
                ))}
              </div>
            )}

            {/* Latest listing */}
            {latest && (
              <Link href={`/properties/${latest.id}`}
                className="group absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/85 p-2.5 pr-4 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-0.5 dark:bg-gray-900/85 sm:inset-x-5 sm:bottom-5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-emerald-100">
                  {latest.images?.[0] ? (
                    <Image src={abs(latest.images[0])} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <LandPlot className="m-auto h-full w-6 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    Latest · {CATEGORY_LABELS[categoryOf(latest.type)]}
                  </p>
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{latest.title}</p>
                  <p className="truncate text-xs text-gray-500">{[latest.city, latest.state].filter(Boolean).join(', ')}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-transform group-hover:rotate-45 dark:bg-white dark:text-gray-900">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            )}
          </div>

          {/* Trust chip */}
          {headlineStat?.value && (
            <div className="absolute -left-3 top-10 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0d2418]/90 px-4 py-3 shadow-xl backdrop-blur sm:flex sm:-left-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
                <Users className="h-4 w-4 text-emerald-300" />
              </span>
              <span>
                <span className="block text-base font-bold leading-none text-white">{headlineStat.value}</span>
                <span className="text-[11px] capitalize text-white/55">{headlineStat.label.toLowerCase()}</span>
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
