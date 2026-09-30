'use client';

import Image from 'next/image';
import { ArrowRight, Building2, Home, LandPlot } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import { CATEGORY_LABELS, type PropertyCategory } from '@/lib/property-categories';

type Listings = Record<PropertyCategory, { items: any[]; total: number }>;

const CARDS: {
  key: PropertyCategory;
  anchor: string;
  icon: any;
  blurb: string;
  iconBg: string;
  glow: string;
  accent: string;
}[] = [
  {
    key: 'land', anchor: 'land', icon: LandPlot,
    blurb: 'Verified plots and estates, ready to build on',
    iconBg: 'from-amber-400 to-orange-500', glow: 'group-hover:shadow-amber-500/20', accent: 'text-amber-600',
  },
  {
    key: 'homes', anchor: 'apartments', icon: Home,
    blurb: 'Apartments, terraces, duplexes and villas',
    iconBg: 'from-emerald-500 to-green-700', glow: 'group-hover:shadow-emerald-500/20', accent: 'text-emerald-600',
  },
  {
    key: 'commercial', anchor: 'commercial', icon: Building2,
    blurb: 'Offices, shops and mixed-use spaces',
    iconBg: 'from-slate-500 to-slate-700', glow: 'group-hover:shadow-slate-500/20', accent: 'text-slate-600',
  },
];

const abs = (src: string) => (src.startsWith('http') ? src : getImageUrl(src));

/** The category cards that overlap the bottom of the hero. */
export function CategoryCards({ listings, loading }: { listings: Listings; loading: boolean }) {
  const cards = CARDS.filter((c) => c.key !== 'commercial' || listings.commercial.total > 0);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative z-10 -mt-20 px-4 md:-mt-24">
      <div className={`container mx-auto grid gap-5 ${cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {cards.map(({ key, anchor, icon: Icon, blurb, iconBg, glow, accent }) => {
          const data = listings[key];
          const thumbs = data.items.filter((p: any) => p.images?.length).slice(0, 3);
          return (
            <button
              key={key}
              type="button"
              onClick={() => scrollTo(anchor)}
              className={`group relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 text-left shadow-xl shadow-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${glow} dark:border-gray-800 dark:bg-gray-900 md:p-7`}
            >
              <div aria-hidden className={`absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br ${iconBg} opacity-[0.08] transition-opacity group-hover:opacity-[0.14]`} />
              <div className="relative flex items-start justify-between gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} text-white shadow-lg`}>
                  <Icon className="h-6 w-6" />
                </span>
                {thumbs.length > 0 && (
                  <div className="flex -space-x-3">
                    {thumbs.map((p: any) => (
                      <span key={p.id} className="relative h-11 w-11 overflow-hidden rounded-full ring-[3px] ring-white dark:ring-gray-900">
                        <Image src={abs(p.images[0])} alt="" fill sizes="44px" className="object-cover" />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative mt-6 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{CATEGORY_LABELS[key]}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{blurb}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-4xl font-extrabold leading-none text-gray-900 dark:text-white">{loading ? '–' : data.total}</div>
                  <div className={`mt-1 text-xs font-semibold uppercase tracking-wider ${accent}`}>available</div>
                </div>
              </div>

              <div className="relative mt-5 flex items-center gap-1.5 border-t border-gray-100 pt-4 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
                Explore {CATEGORY_LABELS[key].toLowerCase()}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
