/**
 * Optional, CMS-edited listing details stored in `Property.listingDetails`.
 * Keep section/field names in sync with backend/src/modules/property/listing-details.ts,
 * which validates saves and strips unapproved sections from public responses.
 */

export const CONTACT_TO_CONFIRM = 'Contact us to confirm';

/** Types that get the full apartment detail structure on public pages. */
export const APARTMENT_TYPES = ['RESIDENTIAL', 'APARTMENT', 'CONDO', 'TOWNHOUSE', 'VILLA'];

export const isApartmentListing = (type?: string) => !!type && APARTMENT_TYPES.includes(type);

export type ImageCategory = 'COMPLETED' | 'CONSTRUCTION' | 'SHOW_HOME' | 'CGI';

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  COMPLETED: 'Completed property',
  CONSTRUCTION: 'Current construction',
  SHOW_HOME: 'Show home',
  CGI: 'Computer-generated visual',
};

/** Caption for images whose status hasn't been recorded — never implies a finished or in-progress build. */
export const UNCATEGORISED_IMAGE_LABEL = 'Promotional image — contact us to confirm what it shows';

export interface FileLink { label?: string; url?: string }

export interface ListingDetails {
  overview?: {
    approved?: boolean;
    developmentName?: string;
    propertyName?: string;
    location?: string;
    propertyType?: string;
    unitType?: string;
    bedrooms?: string;
    bathrooms?: string;
  };
  units?: { approved?: boolean; totalUnits?: number | string; availability?: string };
  pricing?: {
    approved?: boolean;
    items?: { label?: string; price?: number | string; deposit?: number | string }[];
    note?: string;
  };
  paymentPlan?: { approved?: boolean; summary?: string };
  charges?: { approved?: boolean; oneTime?: string; ongoing?: string };
  specifications?: {
    approved?: boolean;
    specifications?: string;
    finishes?: string;
    fittings?: string;
    utilities?: string;
    facilities?: string;
  };
  floorPlans?: { approved?: boolean; files?: FileLink[] };
  documents?: { approved?: boolean; files?: FileLink[] };
  construction?: { approved?: boolean; status?: string; updates?: { date?: string; note?: string }[] };
  delivery?: { approved?: boolean; expected?: string; confirmed?: boolean };
  titleDocuments?: { approved?: boolean; items?: string[] };
  images?: { approved?: boolean; items?: { url?: string; alt?: string; category?: ImageCategory | '' }[] };
  promotion?: { approved?: boolean; title?: string; startDate?: string; endDate?: string; terms?: string };
  contacts?: { approved?: boolean; enquiry?: string; afterSales?: string };
  internalNotes?: string;
}

export type ListingSectionKey = Exclude<keyof ListingDetails, 'internalNotes'>;

export const DELIVERY_PATTERN = /^(Q[1-4] \d{4}|\d{4}-(0[1-9]|1[0-2])|\d{4}-\d{2}-\d{2})$/;

export function formatNaira(value: number | string | undefined): string {
  const n = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(n)) return '';
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2027-03-31" → "31 March 2027"; "2027-03" → "March 2027"; "Q1 2027" unchanged. */
export function formatListingDate(value?: string): string {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return value;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return value;
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`;
}

export function contactHref(propertyTitle?: string): string {
  return propertyTitle ? `/contact?subject=${encodeURIComponent(`Enquiry: ${propertyTitle}`)}` : '/contact';
}
