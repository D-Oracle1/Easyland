'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2,
  Users,
  TrendingUp,
  Shield,
  BarChart3,
  MessageSquare,
  Award,
  Zap,
  Search,
  Home,
  Star,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  LandPlot,
  Calendar,
  Globe,
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/public-navbar';
import { PublicFooter } from '@/components/layout/public-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { LandCard, HomeCard } from '@/components/home/listing-cards';
import { api, getImageUrl } from '@/lib/api';
import { useTenantResolution } from '@/hooks/use-tenant-resolution';
import {
  CATEGORY_LABELS,
  CATEGORY_TYPES,
  categoryHref,
  type PropertyCategory,
} from '@/lib/property-categories';

interface HomepageEvent {
  id: string;
  title: string;
  slug: string;
  bannerUrl: string | null;
  isFeatured: boolean;
  eventDate: string;
  locationType: 'physical' | 'online';
  locationDetails: string | null;
  maxAttendees: number | null;
  _count: { registrations: number };
}

type CategoryListings = Record<PropertyCategory, { items: any[]; total: number }>;

const EMPTY_LISTINGS: CategoryListings = {
  land: { items: [], total: 0 },
  homes: { items: [], total: 0 },
  commercial: { items: [], total: 0 },
};

const PLACEHOLDER_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1400&q=80',
];

const ICON_MAP: Record<string, any> = {
  Users, Building2, TrendingUp, Award, BarChart3, MessageSquare, Shield, Zap, Star, Search,
};

const SEARCH_TABS: { value: '' | PropertyCategory; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'land', label: 'Land' },
  { value: 'homes', label: 'Apartments' },
];

// ── Lightweight sessionStorage cache (stale-while-revalidate) ──────────────
function scRead<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, d } = JSON.parse(raw);
    return Date.now() - t < ttlMs ? (d as T) : null;
  } catch { return null; }
}
function scWrite(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch {}
}

const abs = (src: string) => (src.startsWith('http') ? src : getImageUrl(src));

function SectionHeading({ eyebrow, title, subtitle, accent = 'text-green-700', action }: {
  eyebrow: string; title: string; subtitle?: string; accent?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <span className={`text-xs font-bold uppercase tracking-[0.2em] ${accent}`}>{eyebrow}</span>
        <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-900">
          <div className="aspect-[4/3] animate-pulse bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-2 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'' | PropertyCategory>('');

  const cachedListings = scRead<CategoryListings>('__hp_cats__', 30_000);
  const cachedCms = scRead<Record<string, any>>('__hp_cms__', 300_000);
  const cachedEvts = scRead<any>('__hp_evts__', 120_000);

  const [listings, setListings] = useState<CategoryListings>(cachedListings || EMPTY_LISTINGS);
  const [loading, setLoading] = useState(!cachedListings);
  const [cms, setCms] = useState<Record<string, any> | null>(cachedCms);
  const [events, setEvents] = useState<{ featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[] } | null>(cachedEvts);
  // Resolve tenant company ID from hostname (no-op if NEXT_PUBLIC_COMPANY_ID is set)
  const { tenantReady } = useTenantResolution();

  // CMS + events once the tenant is known
  useEffect(() => {
    if (!tenantReady) return;
    api.get('/cms/public')
      .then((raw) => {
        const data = raw?.data || raw;
        if (data && typeof data === 'object') { setCms(data); scWrite('__hp_cms__', data); }
      })
      .catch(() => {});
    api.get<{ data: { featured: HomepageEvent[]; upcoming: HomepageEvent[]; closingSoon: HomepageEvent[] } }>('/events/homepage')
      .then((res) => {
        const d = res?.data;
        if (d && (d.featured || d.upcoming)) { setEvents(d); scWrite('__hp_evts__', d); }
      })
      .catch(() => {});
  }, [tenantReady]);

  // Listings, split by the property type the admin chose when listing
  const fetchListings = useCallback(async () => {
    const fetchCategory = async (category: PropertyCategory) => {
      try {
        const raw = await api.get(`/properties/listed?limit=6&type=${CATEGORY_TYPES[category].join(',')}`);
        const items = Array.isArray(raw) ? raw : (raw?.data || []);
        return { items, total: raw?.meta?.total ?? items.length };
      } catch {
        return { items: [], total: 0 };
      }
    };
    const [land, homes, commercial] = await Promise.all([
      fetchCategory('land'), fetchCategory('homes'), fetchCategory('commercial'),
    ]);
    const next = { land, homes, commercial };
    setListings(next);
    scWrite('__hp_cats__', next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!tenantReady) return;
    fetchListings();
  }, [tenantReady, fetchListings]);

  const companyName = cms?.branding?.companyName || 'Real Estate Management';
  const hero = cms?.hero || {};
  const agents = cms?.agents || {};
  const features = cms?.features || {};
  const platformFeatures = cms?.platform_features || {};
  const about = cms?.about || {};
  const stats = cms?.stats || {};
  const cta = cms?.cta || {};
  const contact = cms?.contact || {};

  const heroTitle = hero.title || 'Find Your Perfect Property';
  const heroTitleAccent = hero.titleAccent || `with ${companyName}`;
  const heroSubtitle = hero.subtitle || 'Discover premium land and apartments, connect with top realtors, and make your real estate dreams a reality.';

  // Hero image carousel: side images first, then background images, then placeholders
  const rawHeroImages: string[] = [
    ...(Array.isArray(hero.heroImages) ? hero.heroImages : hero.heroImage ? [hero.heroImage] : []),
    ...(Array.isArray(hero.backgroundImages) ? hero.backgroundImages : hero.backgroundImage ? [hero.backgroundImage] : []),
  ].filter(Boolean);
  const heroImages = rawHeroImages.length > 0 ? rawHeroImages.map(abs) : PLACEHOLDER_HERO_IMAGES;

  const [slide, setSlide] = useState(0);
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSlides = useCallback(() => {
    if (heroImages.length <= 1) return;
    slideTimer.current = setInterval(() => setSlide((i) => (i + 1) % heroImages.length), 5000);
  }, [heroImages.length]);
  useEffect(() => {
    startSlides();
    return () => { if (slideTimer.current) clearInterval(slideTimer.current); };
  }, [startSlides]);
  const goToSlide = (i: number) => {
    setSlide(i);
    if (slideTimer.current) clearInterval(slideTimer.current);
    startSlides();
  };

  const displayEvents = events
    ? (events.featured.length > 0 ? events.featured : events.upcoming.slice(0, 3))
    : [];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (searchCategory) params.set('type', CATEGORY_TYPES[searchCategory].join(','));
    router.push(`/properties${params.toString() ? `?${params}` : ''}`);
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const categoryTiles = ([
    { key: 'land', icon: LandPlot, blurb: 'Estates, plots and acreage ready to build on', tint: 'from-amber-950/95', anchor: 'land' },
    { key: 'homes', icon: Home, blurb: 'Apartments, terraces, duplexes and villas', tint: 'from-green-950/95', anchor: 'apartments' },
    { key: 'commercial', icon: Building2, blurb: 'Offices, shops and mixed-use spaces', tint: 'from-slate-950/95', anchor: 'commercial' },
  ] as const).filter((t) => t.key !== 'commercial' || listings.commercial.total > 0);

  const nothingListed = !loading && listings.land.total + listings.homes.total + listings.commercial.total === 0;

  return (
    <div className="min-h-dvh bg-white dark:bg-gray-950">
      <PublicNavbar currentPage="/" />
      <MobileBottomNav />

      {/* ── HERO ── split: copy + search on the left, image showcase on the right */}
      <section className="relative overflow-hidden bg-[#0d2b1c] pb-28 pt-28 md:pb-36 md:pt-32">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #86efac 1px, transparent 1px)', backgroundSize: '26px 26px' }}
        />
        <div aria-hidden className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-green-600/20 blur-3xl" />

        <div className="container relative mx-auto grid items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            {hero.badgeText && (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-4 py-1.5 text-xs font-semibold text-green-200">
                <Users className="h-3.5 w-3.5" /> {hero.badgeText}
              </div>
            )}
            <h1 className="text-4xl font-extrabold leading-[1.1] text-white md:text-5xl lg:text-6xl">
              {heroTitle}{' '}
              <span className="bg-gradient-to-r from-green-300 to-amber-200 bg-clip-text text-transparent">{heroTitleAccent}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">{heroSubtitle}</p>

            {/* Search */}
            <div className="mt-8 max-w-xl rounded-2xl bg-white p-2 shadow-2xl dark:bg-gray-900">
              <div className="flex gap-1 p-1" role="tablist" aria-label="Property category">
                {SEARCH_TABS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={searchCategory === t.value}
                    onClick={() => setSearchCategory(t.value)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      searchCategory === t.value
                        ? 'bg-green-700 text-white'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800">
                  <MapPin className="h-4 w-4 shrink-0 text-green-600" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="City, area or estate name…"
                    aria-label="Search location"
                    className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600"
                >
                  <Search className="h-4 w-4" /> Search
                </button>
              </div>
            </div>

            {hero.stats && hero.stats.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-8">
                {hero.stats.map((stat: any, i: number) => (
                  <div key={i}>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="mt-0.5 text-xs text-white/50">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image showcase */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-white/10 sm:aspect-[5/5]">
              {heroImages.map((src, i) => (
                <div key={src + i} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === slide ? 1 : 0 }}>
                  <Image src={src} alt={`${companyName} property ${i + 1}`} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" priority={i === 0} />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {heroImages.length > 1 && (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
                  {heroImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToSlide(i)}
                      aria-label={`Show image ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
            </div>
            {/* Floating category chips */}
            {!loading && listings.land.total > 0 && (
              <button
                type="button"
                onClick={() => scrollTo('land')}
                className="absolute -left-3 top-10 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-left shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5 sm:-left-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><LandPlot className="h-5 w-5 text-amber-600" /></span>
                <span>
                  <span className="block text-lg font-bold leading-none text-gray-900">{listings.land.total}</span>
                  <span className="text-xs text-gray-500">Land listings</span>
                </span>
              </button>
            )}
            {!loading && listings.homes.total > 0 && (
              <button
                type="button"
                onClick={() => scrollTo('apartments')}
                className="absolute -right-3 bottom-16 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-left shadow-xl backdrop-blur transition-transform hover:-translate-y-0.5 sm:-right-8"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100"><Home className="h-5 w-5 text-green-700" /></span>
                <span>
                  <span className="block text-lg font-bold leading-none text-gray-900">{listings.homes.total}</span>
                  <span className="text-xs text-gray-500">Apartments & homes</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── CATEGORY TILES ── overlap the hero */}
      <section className="relative z-10 -mt-16 px-4 md:-mt-20">
        <div className={`container mx-auto grid gap-4 ${categoryTiles.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {categoryTiles.map((tile) => {
            const data = listings[tile.key];
            const cover = data.items.find((p: any) => p.images?.length)?.images?.[0];
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => scrollTo(tile.anchor)}
                className="group relative h-44 overflow-hidden rounded-2xl text-left shadow-xl md:h-52"
              >
                {cover ? (
                  <Image src={abs(cover)} alt="" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-green-700 to-green-900" />
                )}
                {/* Listing covers are text-heavy flyers: darken enough for the label to read */}
                <div className="absolute inset-0 bg-black/45" />
                <div className={`absolute inset-0 bg-gradient-to-t ${tile.tint} via-black/40 to-transparent`} />
                <div className="relative flex h-full flex-col justify-end p-6 text-white">
                  <Icon className="mb-3 h-7 w-7 text-white/90" />
                  <h3 className="text-xl font-bold drop-shadow">{CATEGORY_LABELS[tile.key]}</h3>
                  <p className="mt-1 max-w-xs text-sm text-white/75">{tile.blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                    {loading ? 'Loading…' : `${data.total} available`}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── LAND & PLOTS ── */}
      <section id="land" className="scroll-mt-24 px-4 py-20">
        <div className="container mx-auto">
          <SectionHeading
            eyebrow="Land & Plots"
            accent="text-amber-600"
            title="Secure land in growing locations"
            subtitle="Verified plots and estates with clear titles — build your future on solid ground."
            action={listings.land.total > 0 && (
              <Link href={categoryHref('land')} className="group flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-600">
                View all land <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          />
          {loading ? <CardSkeletons /> : listings.land.items.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.land.items.map((p: any) => <LandCard key={p.id} property={p} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-amber-200 p-10 text-center text-sm text-gray-500">New land listings are coming soon.</p>
          )}
        </div>
      </section>

      {/* ── APARTMENTS & HOMES ── */}
      <section id="apartments" className="scroll-mt-24 bg-[#f1f7ec] px-4 py-20 dark:bg-gray-900">
        <div className="container mx-auto">
          <SectionHeading
            eyebrow="Apartments & Homes"
            title="Move-in ready places to live"
            subtitle="Apartments, terraces, duplexes and villas finished to a high standard."
            action={listings.homes.total > 0 && (
              <Link href={categoryHref('homes')} className="group flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-600">
                View all apartments <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          />
          {loading ? <CardSkeletons /> : listings.homes.items.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.homes.items.map((p: any) => <HomeCard key={p.id} property={p} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-green-200 bg-white/60 p-10 text-center text-sm text-gray-500 dark:bg-transparent">New apartments are coming soon.</p>
          )}
        </div>
      </section>

      {/* ── COMMERCIAL ── only when there are commercial listings */}
      {listings.commercial.total > 0 && (
        <section id="commercial" className="scroll-mt-24 px-4 py-20">
          <div className="container mx-auto">
            <SectionHeading
              eyebrow="Commercial"
              accent="text-slate-600"
              title="Spaces for business"
              action={(
                <Link href={categoryHref('commercial')} className="group flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-600">
                  View all commercial <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.commercial.items.map((p: any) => <HomeCard key={p.id} property={p} />)}
            </div>
          </div>
        </section>
      )}

      {nothingListed && (
        <p className="px-4 pb-10 text-center text-sm text-gray-500">
          Browse our <Link href="/properties" className="font-semibold text-green-700 underline">full catalogue</Link> for the latest availability.
        </p>
      )}

      {/* ── ABOUT ── */}
      {(about.title || about.content) && (
        <section id="about" className="px-4 py-20">
          <div className="container mx-auto grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">{about.subtitle || 'About Us'}</span>
              <h2 className="mb-5 mt-2 text-3xl font-bold leading-tight text-gray-900 dark:text-white md:text-4xl">
                {about.title || `Welcome to ${companyName}`}
              </h2>
              {(() => {
                const plain = (about.content || '').replace(/<[^>]+>/g, '').trim();
                const full = plain || 'Your trusted partner in real estate. We are dedicated to helping you find the perfect property and providing exceptional service every step of the way.';
                const excerpt = full.length > 320 ? full.slice(0, full.lastIndexOf(' ', 320)) + '…' : full;
                return <p className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{excerpt}</p>;
              })()}
              {about.items && about.items.length > 0 && (
                <ul className="mb-8 space-y-3">
                  {about.items.slice(0, 4).map((item: any, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      {item.text || item.title || (typeof item === 'string' ? item : '')}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/about" className="inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600">
                Learn more about us <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative order-1 lg:order-2">
              <div className="relative h-[380px] overflow-hidden rounded-[2rem] shadow-xl md:h-[440px]">
                {about.image ? (
                  <Image src={abs(about.image)} alt={`About ${companyName}`} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-800 to-green-600">
                    <Building2 className="h-20 w-20 text-white/20" />
                  </div>
                )}
              </div>
              {stats.stats?.[0] && (
                <div className="absolute -bottom-6 left-6 rounded-2xl bg-white px-6 py-4 shadow-xl dark:bg-gray-900">
                  <div className="text-2xl font-extrabold text-green-700">{stats.stats[0].value}</div>
                  <div className="text-xs text-gray-500">{stats.stats[0].label}</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── WHY CHOOSE US ── */}
      {features.features && features.features.length > 0 && (
        <section id="features" className="bg-[#f1f7ec] px-4 py-20 dark:bg-gray-900">
          <div className="container mx-auto">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">Why us</span>
              <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">{features.title || `Why Choose ${companyName}?`}</h2>
            </div>
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
              {features.features.slice(0, 8).map((feature: any, i: number) => {
                const plain = (feature.description || '').replace(/<[^>]+>/g, '').trim();
                const short = plain.length > 110 ? plain.slice(0, 110) + '…' : plain;
                return (
                  <Link key={i} href="/features" className="group flex flex-col rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-gray-950">
                    {feature.image ? (
                      <div className="relative mb-4 h-12 w-12 overflow-hidden rounded-xl">
                        <Image src={abs(feature.image)} alt="" fill sizes="48px" className="object-cover" />
                      </div>
                    ) : (
                      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-700 text-lg font-bold text-white">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    )}
                    <h3 className="mb-2 font-bold text-gray-900 dark:text-white">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{short}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-700">
                      Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── STATS ── */}
      {stats.stats && stats.stats.length > 0 && (
        <section className="bg-[#0d2b1c] px-4 py-14">
          <div className="container mx-auto grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {stats.stats.map((stat: any, i: number) => {
              const StatIcon = ICON_MAP[stat.icon] || [Building2, TrendingUp, Users, Star][i % 4];
              return (
                <div key={i}>
                  <StatIcon className="mx-auto mb-3 h-7 w-7 text-green-300" />
                  <div className="text-3xl font-extrabold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-white/60">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── EVENTS ── */}
      {displayEvents.length > 0 && (
        <section className="px-4 py-20">
          <div className="container mx-auto">
            <SectionHeading eyebrow="Events" title="Upcoming Events" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayEvents.map((ev) => {
                const spotsLeft = ev.maxAttendees ? ev.maxAttendees - (ev._count?.registrations ?? 0) : null;
                return (
                  <Link key={ev.id} href={`/event/${ev.slug}`} className="group">
                    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-lg dark:bg-gray-900 dark:ring-gray-800">
                      {ev.bannerUrl ? (
                        <div className="relative h-44 overflow-hidden">
                          <Image src={ev.bannerUrl} alt={ev.title} fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                          {ev.isFeatured && (
                            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-green-700 px-2 py-1 text-xs font-semibold text-white">
                              <Star className="h-3 w-3 fill-white" /> Featured
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30">
                          <Calendar className="h-14 w-14 text-green-400" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-3 p-5">
                        <h3 className="line-clamp-2 font-semibold text-gray-900 transition-colors group-hover:text-green-700 dark:text-white">{ev.title}</h3>
                        <div className="space-y-1.5 text-xs text-gray-500">
                          <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-green-600" />{new Date(ev.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div className="flex items-center gap-2">
                            {ev.locationType === 'online' ? <Globe className="h-3.5 w-3.5 text-green-600" /> : <MapPin className="h-3.5 w-3.5 text-green-600" />}
                            <span className="capitalize">{ev.locationType}{ev.locationDetails ? ` — ${ev.locationDetails}` : ''}</span>
                          </div>
                          {ev._count?.registrations !== undefined && (
                            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-green-600" />{ev._count.registrations} registered{spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}</div>
                          )}
                        </div>
                        <span className="mt-auto flex items-center gap-1 border-t border-gray-100 pt-3 text-sm font-medium text-green-700 dark:border-gray-800">
                          Register Now <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── AGENTS ── */}
      {agents.agents && agents.agents.length > 0 && (
        <section className="bg-[#f1f7ec] px-4 py-20 dark:bg-gray-900">
          <div className="container mx-auto">
            <SectionHeading eyebrow="Our Team" title="Meet Our Top Realtors" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {agents.agents.map((agent: any, i: number) => {
                const raw = agent.photo || agent.image || agent.avatar || '';
                const photo = raw ? abs(raw) : '';
                return (
                  <div key={i} className="rounded-2xl bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-lg dark:bg-gray-950">
                    {photo ? (
                      <Image src={photo} alt={agent.name} width={88} height={88} className="mx-auto h-[88px] w-[88px] rounded-full object-cover ring-4 ring-green-100" />
                    ) : (
                      <div className="mx-auto flex h-[88px] w-[88px] items-center justify-center rounded-full bg-green-100 text-2xl font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-200">
                        {(agent.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                    <p className="text-xs text-gray-500">{typeof agent.role === 'string' ? agent.role : agent.role?.name || ''}</p>
                    <div className="mt-4 flex items-center justify-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                      <span className="flex items-center gap-0.5">
                        {[...Array(Math.min(5, Number(agent.rating) || 5))].map((_, j) => (
                          <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                      {agent.deals !== undefined && <span className="text-xs text-gray-500">{agent.deals} deals</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── PLATFORM FEATURES ── */}
      {platformFeatures.features && platformFeatures.features.length > 0 && (
        <section className="px-4 py-20">
          <div className="container mx-auto">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">Platform</span>
              <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Everything You Need to Succeed</h2>
              <p className="mt-2 text-sm text-gray-500">Comprehensive tools for managing your real estate business</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {platformFeatures.features.map((feature: any, i: number) => {
                const FeatureIcon = ICON_MAP[feature.icon] || Zap;
                return (
                  <div key={i} className="rounded-2xl border border-gray-100 p-6 transition-colors hover:border-green-200 hover:bg-green-50/50 dark:border-gray-800 dark:hover:bg-gray-900">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                      <FeatureIcon className="h-5 w-5 text-green-700" />
                    </span>
                    <h3 className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-gray-500">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="px-4 pb-20">
        <div className="container relative mx-auto overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-700 via-green-800 to-[#0d2b1c] px-8 py-14 text-center md:px-16">
          <div
            aria-hidden
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold leading-tight text-white md:text-4xl">
              {cta.title || `Ready to Find Your Perfect Property with ${companyName}?`}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/70">
              {cta.subtitle || "Whether you're buying land, an apartment, or investing — our team guides you every step of the way."}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={cta.primaryButtonLink || '/auth/register'} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-green-800 transition-colors hover:bg-green-50">
                {cta.primaryButtonText || 'Get Started'} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={cta.secondaryButtonLink || '/contact'} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                {cta.secondaryButtonText || 'Contact Us'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT + MAP ── */}
      <section id="contact" className="bg-[#f1f7ec] px-4 py-20 dark:bg-gray-900">
        <div className="container mx-auto grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">Get In Touch</span>
            <h2 className="mb-3 mt-2 text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">Visit or contact us</h2>
            <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">Have questions? We&apos;d love to hear from you.</p>
            <div className="space-y-5">
              {[
                contact.phone && { icon: Phone, label: 'Phone', value: contact.phone },
                contact.email && { icon: Mail, label: 'Email', value: contact.email },
                contact.address && { icon: MapPin, label: 'Address', value: contact.address },
                contact.hours && { icon: Clock, label: 'Working Hours', value: contact.hours },
              ].filter(Boolean).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-950">
                    <item.icon className="h-5 w-5 text-green-700" />
                  </span>
                  <div>
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/contact" className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600">
              Send us a message <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="h-[360px] overflow-hidden rounded-[2rem] shadow-xl lg:col-span-3 lg:h-auto lg:min-h-[420px]">
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(contact.mapCoordinates?.trim() || contact.address || companyName + ' real estate')}&output=embed&hl=en&z=16`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Office Location"
            />
          </div>
        </div>
      </section>

      {/* Extra bottom padding on mobile so content clears the floating bottom nav */}
      <div className="h-24 md:hidden" />

      <PublicFooter cmsData={cms?.footer} />
    </div>
  );
}
