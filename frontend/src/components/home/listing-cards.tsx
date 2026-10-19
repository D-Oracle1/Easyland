'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, BedDouble, Bath, Maximize, LandPlot, Home, Grid3x3, ArrowUpRight } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import { formatArea } from '@/lib/utils';
import { propertyHref } from '@/lib/property-url';

function coverImage(p: any): string | null {
  const src = p.images?.[0];
  if (!src) return null;
  return src.startsWith('http') ? src : getImageUrl(src);
}

function typeLabel(type?: string) {
  return (type || '').replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function perPlot(value: unknown): string | null {
  const n = Number(value);
  if (!(n > 0)) return null;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toLocaleString('en-NG', { maximumFractionDigits: 1 })}M / plot`;
  return `₦${n.toLocaleString('en-NG')} / plot`;
}

/** Land listing: emphasises price per plot. The number of plots is never shown publicly. */
export function LandCard({ property }: { property: any }) {
  const img = coverImage(property);
  return (
    <Link href={propertyHref(property)} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="relative aspect-[4/3] overflow-hidden">
          {img ? (
            <Image src={img} alt={property.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-lime-100">
              <LandPlot className="h-14 w-14 text-amber-500/60" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow">Land</span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-1 font-semibold text-gray-900 transition-colors group-hover:text-green-700 dark:text-white">{property.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-green-600" />
            <span className="line-clamp-1">{[property.city, property.state].filter(Boolean).join(', ')}</span>
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 text-sm dark:border-gray-800">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Grid3x3 className="h-4 w-4 text-amber-500" />
              {perPlot(property.pricePerSqm) || 'Price on request'}
            </span>
            <span className="flex items-center gap-1 font-medium text-green-700">
              View <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

/** Apartment / home listing: emphasises rooms and floor area. */
export function HomeCard({ property }: { property: any }) {
  const img = coverImage(property);
  const specs = [
    property.bedrooms > 0 && { icon: BedDouble, text: `${property.bedrooms} bed` },
    property.bathrooms > 0 && { icon: Bath, text: `${property.bathrooms} bath` },
    property.area > 0 && { icon: Maximize, text: formatArea(Number(property.area)) },
  ].filter(Boolean) as { icon: any; text: string }[];

  return (
    <Link href={propertyHref(property)} className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-gray-900 dark:ring-gray-800">
        <div className="relative aspect-[4/3] overflow-hidden">
          {img ? (
            <Image src={img} alt={property.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-100 to-emerald-200">
              <Home className="h-14 w-14 text-green-500/60" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-green-700 px-3 py-1 text-xs font-semibold text-white shadow">
            {typeLabel(property.type)}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-1 font-semibold text-gray-900 transition-colors group-hover:text-green-700 dark:text-white">{property.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-green-600" />
            <span className="line-clamp-1">{[property.city, property.state].filter(Boolean).join(', ')}</span>
          </p>
          {specs.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
              {specs.map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-green-600" /> {text}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
