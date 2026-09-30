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
    blurb: 'Verified plots and estates',
    iconBg: 'from-amber-400 to-orange-500', glow: 'hover:shadow-amber-500/20', accent: 'text-amber-600',
  },
  {
    key: 'homes', anchor: 'apartments', icon: Home,
    blurb: 'Apartments, terraces and villas',
    iconBg: 'from-emerald-500 to-green-700', glow: 'hover:shadow-emerald-500/20', accent: 'text-emerald-600',
  },
  {
    key: 'commercial', anchor: 'commercial', icon: Building2,
    blurb: 'Offices, shops and mixed-use',
    iconBg: 'from-slate-500 to-slate-700', glow: 'hover:shadow-slate-500/20', accent: 'text-slate-600',
  },
];

const abs = (src: string) => (src.startsWith('http') ? src : getImageUrl(src));

/** Compact category chips that overlap the bottom of the hero. */
export function CategoryCards({ listings, loading }: { listings: Listings; loading: boolean }) {
  const cards = CARDS.filter((c) => c.key !== 'commercial' || listings.commercial.total > 0);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="relative z-10 -mt-10 px-4 md:-mt-12">
      <div className={`container mx-auto grid max-w-5xl gap-4 ${cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {cards.map(({ key, anchor, icon: Icon, blurb, iconBg, glow, accent }) => {
          const data = listings[key];
          const thumbs = data.items.filter((p: any) => p.images?.length).slice(0, 3);
          return (
            <button
              key={key}
              type="button"
              onClick={() => scrollTo(anchor)}
              className={`group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${glow} dark:border-gray-800 dark:bg-gray-900`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${iconBg} text-white shadow-md`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-gray-900 dark:text-white">{CATEGORY_LABELS[key]}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{blurb}</span>
              </span>
              {thumbs.length > 0 && (
                <span className="hidden -space-x-2.5 sm:flex">
                  {thumbs.map((p: any) => (
                    <span key={p.id} className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-white dark:ring-gray-900">
                      <Image src={abs(p.images[0])} alt="" fill sizes="32px" className="object-cover" />
                    </span>
                  ))}
                </span>
              )}
              <span className="shrink-0 text-right">
                <span className="block text-2xl font-extrabold leading-none text-gray-900 dark:text-white">{loading ? '–' : data.total}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${accent}`}>available</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-all group-hover:translate-x-0.5 group-hover:text-gray-900 dark:group-hover:text-white" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
