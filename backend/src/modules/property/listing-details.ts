import { BadRequestException } from '@nestjs/common';

/**
 * Optional, CMS-edited details for a property listing, stored in
 * `Property.listingDetails` (JSON).
 *
 * Every section carries an `approved` flag. Staff can save incomplete or
 * unapproved sections; only approved, non-empty sections are returned by the
 * public endpoints (see toPublicListingDetails). `internalNotes` is never public.
 *
 * Keep the section/field names in sync with frontend/src/lib/listing-details.ts.
 */

export const IMAGE_CATEGORIES = ['COMPLETED', 'CONSTRUCTION', 'SHOW_HOME', 'CGI'] as const;

const TEXT_MAX = 2000;
const LONG_TEXT_MAX = 8000;
const LIST_MAX = 50;

type Kind = 'text' | 'longText' | 'int' | 'bool' | 'date' | 'delivery';

// Field kinds per section. Lists are handled separately below.
const SECTION_FIELDS: Record<string, Record<string, Kind>> = {
  overview: {
    developmentName: 'text',
    propertyName: 'text',
    location: 'text',
    propertyType: 'text',
    unitType: 'text',
    bedrooms: 'text',
    bathrooms: 'text',
  },
  units: { totalUnits: 'int', availability: 'text' },
  pricing: { note: 'text' },
  paymentPlan: { summary: 'longText' },
  charges: { oneTime: 'longText', ongoing: 'longText' },
  specifications: {
    specifications: 'longText',
    finishes: 'longText',
    fittings: 'longText',
    utilities: 'longText',
    facilities: 'longText',
  },
  floorPlans: {},
  documents: {},
  construction: { status: 'text' },
  delivery: { expected: 'delivery', confirmed: 'bool' },
  titleDocuments: {},
  images: {},
  promotion: { title: 'text', startDate: 'date', endDate: 'date', terms: 'longText' },
  contacts: { enquiry: 'longText', afterSales: 'longText' },
};

export const LISTING_SECTIONS = Object.keys(SECTION_FIELDS);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// "Q1 2027", "2027-03" or "2027-03-31"
const DELIVERY_RE = /^(Q[1-4] \d{4}|\d{4}-(0[1-9]|1[0-2])|\d{4}-\d{2}-\d{2})$/;

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value: unknown, field: string, max = TEXT_MAX): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
  return trimmed || undefined;
}

function money(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e13) {
    throw new BadRequestException(`${field} must be a valid amount in naira`);
  }
  return Math.round(n * 100) / 100;
}

function field(kind: Kind, value: unknown, name: string): unknown {
  switch (kind) {
    case 'text':
      return text(value, name);
    case 'longText':
      return text(value, name, LONG_TEXT_MAX);
    case 'bool':
      return value === true;
    case 'int': {
      if (value === undefined || value === null || value === '') return undefined;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 100000) {
        throw new BadRequestException(`${name} must be a whole number`);
      }
      return n;
    }
    case 'date': {
      const v = text(value, name);
      if (v && !isValidDate(v)) throw new BadRequestException(`${name} must be a date (YYYY-MM-DD)`);
      return v;
    }
    case 'delivery': {
      const v = text(value, name);
      if (v && !DELIVERY_RE.test(v)) {
        throw new BadRequestException(`${name} must look like "Q1 2027", "2027-03" or "2027-03-31"`);
      }
      if (v && DATE_RE.test(v) && !isValidDate(v)) throw new BadRequestException(`${name} is not a valid date`);
      return v;
    }
  }
}

function list(value: unknown, name: string): any[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestException(`${name} must be a list`);
  if (value.length > LIST_MAX) throw new BadRequestException(`${name} can have at most ${LIST_MAX} entries`);
  return value;
}

function url(value: unknown, name: string): string | undefined {
  const v = text(value, name);
  if (v && !/^https?:\/\//i.test(v) && !v.startsWith('/')) {
    throw new BadRequestException(`${name} must be an uploaded file or http(s) link`);
  }
  return v;
}

function files(value: unknown, name: string) {
  return list(value, name)
    .map((f, i) => ({
      label: text(f?.label, `${name} ${i + 1} label`),
      url: url(f?.url, `${name} ${i + 1} file`),
    }))
    .filter((f) => f.url);
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

/** Validates and normalises admin input. Throws BadRequestException on invalid values. */
export function normalizeListingDetails(input: unknown): Record<string, any> {
  if (input === null || input === undefined) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('listingDetails must be an object');
  }
  const src = input as Record<string, any>;
  const out: Record<string, any> = {};

  for (const section of LISTING_SECTIONS) {
    const raw = src[section];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException(`${section} must be an object`);
    }
    const s: Record<string, any> = { approved: raw.approved === true };
    for (const [key, kind] of Object.entries(SECTION_FIELDS[section])) {
      s[key] = field(kind, raw[key], `${section}.${key}`);
    }

    switch (section) {
      case 'pricing':
        s.items = list(raw.items, 'pricing.items')
          .map((it, i) => compact({
            label: text(it?.label, `Price ${i + 1} label`),
            price: money(it?.price, `Price ${i + 1} amount`),
            deposit: money(it?.deposit, `Price ${i + 1} deposit`),
          }))
          .filter((it) => it.price !== undefined || it.deposit !== undefined);
        break;
      case 'floorPlans':
      case 'documents':
        s.files = files(raw.files, section);
        break;
      case 'construction':
        s.updates = list(raw.updates, 'construction.updates')
          .map((u, i) => {
            const date = field('date', u?.date, `Progress update ${i + 1} date`) as string | undefined;
            const note = text(u?.note, `Progress update ${i + 1} note`, LONG_TEXT_MAX);
            if (note && !date) throw new BadRequestException(`Progress update ${i + 1} needs a date`);
            return compact({ date, note });
          })
          .filter((u) => u.note);
        break;
      case 'titleDocuments':
        s.items = list(raw.items, 'titleDocuments.items')
          .map((d, i) => text(d, `Document type ${i + 1}`))
          .filter(Boolean);
        break;
      case 'images':
        s.items = list(raw.items, 'images.items')
          .map((img, i) => {
            const category = img?.category || undefined;
            if (category && !(IMAGE_CATEGORIES as readonly string[]).includes(category)) {
              throw new BadRequestException(`Image ${i + 1} has an unknown category`);
            }
            return compact({
              url: url(img?.url, `Image ${i + 1}`),
              alt: text(img?.alt, `Image ${i + 1} alt text`, 300),
              category,
            });
          })
          .filter((img) => img.url);
        break;
      case 'promotion':
        if (s.startDate && s.endDate && s.endDate < s.startDate) {
          throw new BadRequestException('promotion.endDate must be on or after the start date');
        }
        break;
    }
    out[section] = compact(s);
  }

  const notes = text(src.internalNotes, 'internalNotes', LONG_TEXT_MAX);
  if (notes) out.internalNotes = notes;
  return out;
}

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Public view: only approved sections with at least one filled field.
 * Drops internal notes and the approval flags themselves. Expired promotions are hidden.
 */
export function toPublicListingDetails(details: unknown, today = new Date()): Record<string, any> | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const src = details as Record<string, any>;
  const out: Record<string, any> = {};
  const todayStr = today.toISOString().slice(0, 10);

  for (const section of LISTING_SECTIONS) {
    const s = src[section];
    if (!s || s.approved !== true) continue;
    const { approved, ...fields } = s;
    if (section === 'promotion' && fields.endDate && fields.endDate < todayStr) continue;
    // `confirmed` alone doesn't make a delivery section worth showing
    const meaningful = Object.entries(fields).filter(([k, v]) => k !== 'confirmed' && hasContent(v));
    if (meaningful.length === 0) continue;
    out[section] = fields;
  }
  return Object.keys(out).length ? out : null;
}
