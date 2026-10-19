import Link from 'next/link';
import { FileText, Download, CalendarClock, Tag, PhoneCall, ShieldAlert, ClipboardList } from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import {
  CONTACT_TO_CONFIRM,
  contactHref,
  formatListingDate,
  formatNaira,
  type FileLink,
  type ListingDetails,
} from '@/lib/listing-details';

const fileUrl = (url?: string) => (!url ? '' : url.startsWith('http') ? url : getImageUrl(url));

function ConfirmLink({ title }: { title?: string }) {
  return (
    <Link href={contactHref(title)} className="text-accent underline underline-offset-2 hover:text-accent-600">
      {CONTACT_TO_CONFIRM}
    </Link>
  );
}

function Fact({ label, value, title, required }: { label: string; value?: React.ReactNode; title?: string; required?: boolean }) {
  const empty = value === undefined || value === null || value === '';
  if (empty && !required) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-gray-500 sm:w-48 sm:flex-shrink-0">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 whitespace-pre-line">{empty ? <ConfirmLink title={title} /> : value}</dd>
    </div>
  );
}

function FileList({ files }: { files: FileLink[] }) {
  return (
    <ul className="space-y-2">
      {files.map((f, i) => (
        <li key={i}>
          <a
            href={fileUrl(f.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 transition-colors hover:border-accent/40 hover:text-accent"
          >
            <FileText className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
            <span className="flex-1">{f.label || `Document ${i + 1}`}</span>
            <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
        {Icon && <Icon className="h-5 w-5 text-accent" aria-hidden="true" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Sidebar price block. Falls back to `fallback` (the listing's base price) when no approved pricing exists. */
export function ListingPricing({ details, fallback }: { details: ListingDetails | null; fallback: React.ReactNode }) {
  const items = (details?.pricing?.items || []).filter((it) => formatNaira(it.price) || formatNaira(it.deposit));
  return (
    <div>
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((it, i) => (
            <div key={i}>
              {it.label && <div className="text-sm font-medium text-gray-700 mb-1">{it.label}</div>}
              {formatNaira(it.price) && (
                <div className="text-2xl font-bold text-primary">{formatNaira(it.price)}</div>
              )}
              {formatNaira(it.deposit) && (
                <div className="text-sm text-gray-600">Initial deposit: <span className="font-semibold">{formatNaira(it.deposit)}</span></div>
              )}
            </div>
          ))}
          {details?.pricing?.note && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{details.pricing.note}</p>
          )}
        </div>
      ) : (
        fallback
      )}
      <p className="mt-3 text-xs text-gray-500">
        Contact us directly for secure, verified payment instructions.
      </p>
    </div>
  );
}

interface Props {
  details: ListingDetails | null;
  propertyTitle: string;
  /** Apartment listings always show the key-facts structure, with "Contact us to confirm" for gaps. */
  apartment: boolean;
}

export function ListingDetailsSection({ details, propertyTitle, apartment }: Props) {
  const d = details || {};
  const t = propertyTitle;
  const ov = d.overview || {};
  const spec = d.specifications || {};
  const updates = [...(d.construction?.updates || [])]
    .filter((u) => u.note)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const delivery = d.delivery?.expected
    ? `${formatListingDate(d.delivery.expected)}${d.delivery.confirmed ? '' : ' (estimate — contact us to confirm)'}`
    : undefined;
  const charges = [
    d.charges?.oneTime && `One-time: ${d.charges.oneTime}`,
    d.charges?.ongoing && `Ongoing: ${d.charges.ongoing}`,
  ].filter(Boolean).join('\n');
  const specRows = [
    ['Specifications', spec.specifications],
    ['Finishes', spec.finishes],
    ['Fittings', spec.fittings],
    ['Utilities', spec.utilities],
    ['Included facilities', spec.facilities],
  ].filter(([, v]) => v) as [string, string][];
  const titleDocs = d.titleDocuments?.items || [];
  const promo = d.promotion;

  if (!apartment && Object.keys(d).length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Key facts */}
      {(apartment || d.overview || d.units || d.construction || d.delivery || d.paymentPlan || d.charges) && (
        <Card title="Property details" icon={ClipboardList}>
          <dl>
            <Fact label="Development" value={ov.developmentName} />
            <Fact label="Property name" value={ov.propertyName} />
            <Fact label="Location" value={ov.location} title={t} required={apartment} />
            <Fact label="Property type" value={ov.propertyType} title={t} required={apartment} />
            <Fact label="Unit type" value={ov.unitType} />
            <Fact label="Bedrooms" value={ov.bedrooms} />
            <Fact label="Bathrooms" value={ov.bathrooms} />
            <Fact label="Total units" value={d.units?.totalUnits} title={t} required={apartment} />
            <Fact label="Current availability" value={d.units?.availability} title={t} required={apartment} />
            <Fact label="Construction status" value={d.construction?.status} title={t} required={apartment} />
            <Fact label="Expected delivery" value={delivery} title={t} required={apartment} />
            <Fact label="Payment plan" value={d.paymentPlan?.summary} title={t} required={apartment} />
            <Fact label="Additional charges" value={charges} title={t} required={apartment} />
          </dl>
        </Card>
      )}

      {promo && (promo.title || promo.terms) && (
        <Card title="Current offer" icon={Tag}>
          {promo.title && <p className="font-semibold text-gray-900">{promo.title}</p>}
          {(promo.startDate || promo.endDate) && (
            <p className="mt-1 text-sm text-gray-600">
              {promo.startDate && promo.endDate
                ? `${formatListingDate(promo.startDate)} – ${formatListingDate(promo.endDate)}`
                : promo.endDate
                  ? `Until ${formatListingDate(promo.endDate)}`
                  : `From ${formatListingDate(promo.startDate)}`}
            </p>
          )}
          {promo.terms && <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">{promo.terms}</p>}
        </Card>
      )}

      {specRows.length > 0 && (
        <Card title="Specifications & facilities">
          <dl>
            {specRows.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
          </dl>
        </Card>
      )}

      {(d.floorPlans?.files?.length || 0) > 0 && (
        <Card title="Floor plans" icon={FileText}>
          <FileList files={d.floorPlans!.files!} />
        </Card>
      )}

      {(d.documents?.files?.length || 0) > 0 && (
        <Card title="Property documents" icon={Download}>
          <FileList files={d.documents!.files!} />
        </Card>
      )}

      {updates.length > 0 && (
        <Card title="Construction progress" icon={CalendarClock}>
          <ol className="space-y-4 border-l-2 border-accent/20 pl-5">
            {updates.map((u, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-accent" aria-hidden="true" />
                {u.date && <time dateTime={u.date} className="text-xs font-semibold uppercase tracking-wide text-accent">{formatListingDate(u.date)}</time>}
                <p className="text-sm text-gray-700 whitespace-pre-line">{u.note}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {(apartment || titleDocs.length > 0) && (
        <Card title="Title & approval documents" icon={ShieldAlert}>
          {titleDocs.length > 0 ? (
            <>
              <p className="mb-3 text-sm text-gray-600">The company states that the following document types are available:</p>
              <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                {titleDocs.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    {doc}
                  </li>
                ))}
              </ul>
              <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                These documents have not been independently verified by this website. Please{' '}
                <Link href={contactHref(t)} className="text-accent underline underline-offset-2">contact us</Link>{' '}
                to confirm which documents are available for independent review and how to arrange access.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              <ConfirmLink title={t} /> which title and approval documents are available for independent review and how to arrange access.
            </p>
          )}
        </Card>
      )}

      {(apartment || d.contacts) && (
        <Card title="Enquiries" icon={PhoneCall}>
          <dl>
            <Fact label="Sales enquiries" value={d.contacts?.enquiry} />
            <Fact label="After-sales" value={d.contacts?.afterSales} />
          </dl>
          <Link
            href={contactHref(t)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
          >
            Send an enquiry about this property
          </Link>
        </Card>
      )}
    </div>
  );
}
