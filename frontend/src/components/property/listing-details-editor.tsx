'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { api, getImageUrl } from '@/lib/api';
import {
  DELIVERY_PATTERN,
  IMAGE_CATEGORY_LABELS,
  type ListingDetails,
  type ListingSectionKey,
} from '@/lib/listing-details';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel serverless body limit

const isValidDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const isValidAmount = (v: unknown) => {
  if (v === undefined || v === null || v === '') return true;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0;
};

/** Mirrors the backend rules so staff see problems before saving. */
function validate(d: ListingDetails): string | null {
  for (const [i, it] of (d.pricing?.items || []).entries()) {
    if (!isValidAmount(it.price)) return `Price ${i + 1}: enter an amount in naira (numbers only).`;
    if (!isValidAmount(it.deposit)) return `Price ${i + 1}: enter the deposit in naira (numbers only).`;
  }
  if (d.units?.totalUnits !== undefined && d.units.totalUnits !== '' && !/^\d+$/.test(String(d.units.totalUnits))) {
    return 'Total units must be a whole number.';
  }
  const exp = d.delivery?.expected?.trim();
  if (exp && (!DELIVERY_PATTERN.test(exp) || (exp.length === 10 && !isValidDate(exp)))) {
    return 'Expected delivery must look like "Q1 2027", "2027-03" or "2027-03-31".';
  }
  for (const [i, u] of (d.construction?.updates || []).entries()) {
    if (u.note?.trim() && !u.date) return `Progress update ${i + 1} needs a date.`;
  }
  const { startDate, endDate } = d.promotion || {};
  if (startDate && endDate && endDate < startDate) return 'The offer end date must be on or after its start date.';
  for (const [i, img] of (d.images?.items || []).entries()) {
    if (img.url && !img.alt?.trim()) return `Image ${i + 1}: add alt text describing what the image shows.`;
  }
  return null;
}

/** Turn the form's string amounts into numbers the API accepts. */
function toPayload(d: ListingDetails): ListingDetails {
  const out: ListingDetails = JSON.parse(JSON.stringify(d));
  if (out.pricing?.items) {
    out.pricing.items = out.pricing.items.map((it) => ({
      ...it,
      price: it.price === '' || it.price === undefined ? undefined : Number(String(it.price).replace(/,/g, '')),
      deposit: it.deposit === '' || it.deposit === undefined ? undefined : Number(String(it.deposit).replace(/,/g, '')),
    }));
  }
  if (out.units && (out.units.totalUnits === '' || out.units.totalUnits === undefined)) delete out.units.totalUnits;
  return out;
}

interface Props {
  property: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ListingDetailsEditor({ property, open, onOpenChange, onSaved }: Props) {
  const uid = useId();
  const [details, setDetails] = useState<ListingDetails>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<((url: string) => void) | null>(null);

  useEffect(() => {
    if (open && property) {
      setDetails(JSON.parse(JSON.stringify(property.listingDetails || {})));
      setError(null);
    }
  }, [open, property]);

  const section = <K extends ListingSectionKey>(key: K) => (details[key] || {}) as NonNullable<ListingDetails[K]>;
  const setField = <K extends ListingSectionKey>(key: K, field: string, value: unknown) =>
    setDetails((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));

  const id = (name: string) => `${uid}-${name}`;

  const pickFile = (accept: string, onUploaded: (url: string) => void, kind: 'image' | 'file') => {
    pendingUpload.current = onUploaded;
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.dataset.kind = kind;
      fileInputRef.current.click();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const kind = e.target.dataset.kind;
    e.target.value = '';
    if (!file || !pendingUpload.current) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File is larger than 4 MB. Please compress it and try again.');
      return;
    }
    setUploading(file.name);
    try {
      const result: any = kind === 'image'
        ? await api.uploadFiles('/upload/property-images', [file], 'images')
        : await api.uploadFiles('/upload/file', [file], 'file');
      const url: string = Array.isArray(result) ? result[0] : result?.url || result;
      if (typeof url !== 'string' || !url) throw new Error('No URL returned');
      pendingUpload.current(url);
      toast.success('Uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    const problem = validate(details);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api.put(`/properties/${property.id}/listing-details`, { listingDetails: toPayload(details) });
      toast.success('Listing details saved');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save listing details');
    } finally {
      setSaving(false);
    }
  };

  // ── Field helpers ──────────────────────────────────────────────────────────
  const TextField = ({ sec, field, label, placeholder, long, type = 'text', hint }: {
    sec: ListingSectionKey; field: string; label: string; placeholder?: string; long?: boolean; type?: string; hint?: string;
  }) => {
    const value = (section(sec) as any)[field] ?? '';
    const fid = id(`${sec}-${field}`);
    return (
      <div className="space-y-1">
        <label htmlFor={fid} className="text-sm font-medium">{label}</label>
        {long ? (
          <Textarea id={fid} rows={3} value={value} placeholder={placeholder} onChange={(e) => setField(sec, field, e.target.value)} />
        ) : (
          <Input id={fid} type={type} value={value} placeholder={placeholder} onChange={(e) => setField(sec, field, e.target.value)} />
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  };

  const Section = ({ sec, title, description, children }: {
    sec: ListingSectionKey; title: string; description?: string; children: React.ReactNode;
  }) => {
    const approved = !!(section(sec) as any).approved;
    const sid = id(`${sec}-approved`);
    return (
      <fieldset className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <legend className="font-semibold text-sm">{title}</legend>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch id={sid} checked={approved} onCheckedChange={(v) => setField(sec, 'approved', v)} />
            <label htmlFor={sid} className={`text-xs font-medium ${approved ? 'text-green-700' : 'text-muted-foreground'}`}>
              {approved ? 'Approved — shown publicly' : 'Draft — not shown'}
            </label>
          </div>
        </div>
        {children}
      </fieldset>
    );
  };

  const listOf = <T,>(sec: ListingSectionKey, field: string): T[] => ((section(sec) as any)[field] || []) as T[];
  const setListItem = (sec: ListingSectionKey, field: string, idx: number, patch: any) => {
    const items = [...listOf<any>(sec, field)];
    items[idx] = typeof patch === 'object' && patch !== null ? { ...items[idx], ...patch } : patch;
    setField(sec, field, items);
  };
  const removeListItem = (sec: ListingSectionKey, field: string, idx: number) =>
    setField(sec, field, listOf<any>(sec, field).filter((_, i) => i !== idx));
  const addListItem = (sec: ListingSectionKey, field: string, item: any) =>
    setField(sec, field, [...listOf<any>(sec, field), item]);

  const RemoveButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 flex-shrink-0" onClick={onClick} aria-label={label}>
      <Trash2 className="w-4 h-4" />
    </Button>
  );

  const FilesEditor = ({ sec, noun }: { sec: 'floorPlans' | 'documents'; noun: string }) => {
    const files = listOf<{ label?: string; url?: string }>(sec, 'files');
    return (
      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              aria-label={`${noun} ${i + 1} name`}
              placeholder={`${noun} name`}
              value={f.label || ''}
              onChange={(e) => setListItem(sec, 'files', i, { label: e.target.value })}
              className="sm:w-48"
            />
            <Input
              aria-label={`${noun} ${i + 1} link`}
              placeholder="Uploaded file link"
              value={f.url || ''}
              onChange={(e) => setListItem(sec, 'files', i, { url: e.target.value })}
              className="flex-1 text-xs"
            />
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={() => pickFile('application/pdf,image/*', (url) => setListItem(sec, 'files', i, { url }), 'file')}>
                <Upload className="w-3.5 h-3.5 mr-1" /> Upload
              </Button>
              <RemoveButton onClick={() => removeListItem(sec, 'files', i)} label={`Remove ${noun.toLowerCase()} ${i + 1}`} />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addListItem(sec, 'files', { label: '', url: '' })}>
          <Plus className="w-4 h-4 mr-1" /> Add {noun.toLowerCase()}
        </Button>
      </div>
    );
  };

  if (!property) return null;

  const pricingItems = listOf<{ label?: string; price?: string | number; deposit?: string | number }>('pricing', 'items');
  const updates = listOf<{ date?: string; note?: string }>('construction', 'updates');
  const titleDocs = listOf<string>('titleDocuments', 'items');
  const imageItems = listOf<{ url?: string; alt?: string; category?: string }>('images', 'items');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listing details — {property.title}</DialogTitle>
          <DialogDescription>
            All fields are optional and you can save incomplete details. Only sections switched to
            <strong> Approved</strong> appear on the public listing; empty key facts show “Contact us to confirm”.
            Enter only information the company has supplied — never estimates or placeholders.
          </DialogDescription>
        </DialogHeader>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} aria-hidden="true" tabIndex={-1} />

        <div className="space-y-4 py-2">
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {uploading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Uploading {uploading}…</p>
          )}

          {Section({ sec: 'overview', title: 'Overview', description: 'Development and property name, location, type and rooms.', children: (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TextField({ sec: 'overview', field: 'developmentName', label: 'Development name' })}
              {TextField({ sec: 'overview', field: 'propertyName', label: 'Property name' })}
              {TextField({ sec: 'overview', field: 'location', label: 'Location' })}
              {TextField({ sec: 'overview', field: 'propertyType', label: 'Property type(s)', placeholder: 'e.g. 3-bedroom bungalow and 4-bedroom duplex' })}
              {TextField({ sec: 'overview', field: 'unitType', label: 'Unit type' })}
              {TextField({ sec: 'overview', field: 'bedrooms', label: 'Bedrooms' })}
              {TextField({ sec: 'overview', field: 'bathrooms', label: 'Bathrooms' })}
            </div>
          </>) })}

          {Section({ sec: 'units', title: 'Units & availability', children: (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TextField({ sec: 'units', field: 'totalUnits', label: 'Total units', type: 'number' })}
              {TextField({ sec: 'units', field: 'availability', label: 'Current availability', placeholder: 'e.g. 4 units remaining' })}
            </div>
          </>) })}

          {Section({ sec: 'pricing', title: 'Price & deposit', description: 'Amounts in naira. Never enter bank account details here — buyers are directed to contact the company for payment instructions.', children: (<>
            <div className="space-y-2">
              {pricingItems.map((it, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_9rem_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label htmlFor={id(`price-label-${i}`)} className="text-xs text-muted-foreground">Option</label>
                    <Input id={id(`price-label-${i}`)} value={it.label || ''} placeholder="e.g. Fully finished 3-bedroom bungalow" onChange={(e) => setListItem('pricing', 'items', i, { label: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={id(`price-${i}`)} className="text-xs text-muted-foreground">Price (₦)</label>
                    <Input id={id(`price-${i}`)} inputMode="numeric" value={it.price ?? ''} onChange={(e) => setListItem('pricing', 'items', i, { price: e.target.value })} aria-invalid={!isValidAmount(it.price)} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={id(`deposit-${i}`)} className="text-xs text-muted-foreground">Initial deposit (₦)</label>
                    <Input id={id(`deposit-${i}`)} inputMode="numeric" value={it.deposit ?? ''} onChange={(e) => setListItem('pricing', 'items', i, { deposit: e.target.value })} aria-invalid={!isValidAmount(it.deposit)} />
                  </div>
                  <RemoveButton onClick={() => removeListItem('pricing', 'items', i)} label={`Remove price option ${i + 1}`} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addListItem('pricing', 'items', { label: '', price: '', deposit: '' })}>
                <Plus className="w-4 h-4 mr-1" /> Add price option
              </Button>
            </div>
            {TextField({ sec: 'pricing', field: 'note', label: 'Price note (shown with the prices)', placeholder: 'e.g. Price and deposit shown in promotional flyer; please contact us to confirm current price and terms.' })}
          </>) })}

          {Section({ sec: 'paymentPlan', title: 'Payment plan summary', children: (<>
            {TextField({ sec: 'paymentPlan', field: 'summary', label: 'Summary', long: true })}
          </>) })}

          {Section({ sec: 'charges', title: 'Additional charges & ongoing costs', children: (<>
            {TextField({ sec: 'charges', field: 'oneTime', label: 'One-time charges', long: true })}
            {TextField({ sec: 'charges', field: 'ongoing', label: 'Ongoing costs', long: true })}
          </>) })}

          {Section({ sec: 'specifications', title: 'Specifications & facilities', children: (<>
            {TextField({ sec: 'specifications', field: 'specifications', label: 'Specifications', long: true })}
            {TextField({ sec: 'specifications', field: 'finishes', label: 'Finishes', long: true })}
            {TextField({ sec: 'specifications', field: 'fittings', label: 'Fittings', long: true })}
            {TextField({ sec: 'specifications', field: 'utilities', label: 'Utilities', long: true })}
            {TextField({ sec: 'specifications', field: 'facilities', label: 'Included facilities', long: true })}
          </>) })}

          {Section({ sec: 'floorPlans', title: 'Floor plans', description: 'PDF or image, up to 4 MB each.', children: (<>
            {FilesEditor({ sec: 'floorPlans', noun: 'Floor plan' })}
          </>) })}

          {Section({ sec: 'documents', title: 'Downloadable property documents', description: 'Brochures, layouts and other files buyers may download.', children: (<>
            {FilesEditor({ sec: 'documents', noun: 'Document' })}
          </>) })}

          {Section({ sec: 'construction', title: 'Construction status & progress', children: (<>
            {TextField({ sec: 'construction', field: 'status', label: 'Construction status', placeholder: 'e.g. Ongoing' })}
            <div className="space-y-2">
              <p className="text-sm font-medium">Dated progress updates</p>
              {updates.map((u, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <Input type="date" aria-label={`Update ${i + 1} date`} value={u.date || ''} onChange={(e) => setListItem('construction', 'updates', i, { date: e.target.value })} className="sm:w-44" />
                  <Textarea aria-label={`Update ${i + 1} note`} rows={2} value={u.note || ''} onChange={(e) => setListItem('construction', 'updates', i, { note: e.target.value })} className="flex-1" />
                  <RemoveButton onClick={() => removeListItem('construction', 'updates', i)} label={`Remove update ${i + 1}`} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addListItem('construction', 'updates', { date: '', note: '' })}>
                <Plus className="w-4 h-4 mr-1" /> Add progress update
              </Button>
            </div>
          </>) })}

          {Section({ sec: 'delivery', title: 'Expected delivery', children: (<>
            {TextField({ sec: 'delivery', field: 'expected', label: 'Expected delivery', placeholder: 'Q1 2027', hint: 'Use "Q1 2027", "2027-03" or "2027-03-31".' })}
            <div className="flex items-center gap-2">
              <Switch id={id('delivery-confirmed')} checked={!!section('delivery').confirmed} onCheckedChange={(v) => setField('delivery', 'confirmed', v)} />
              <label htmlFor={id('delivery-confirmed')} className="text-sm">Company has confirmed this date as final</label>
            </div>
            <p className="text-xs text-muted-foreground">Unconfirmed dates are shown as “(estimate — contact us to confirm)”.</p>
          </>) })}

          {Section({ sec: 'titleDocuments', title: 'Title & approval documents', description: 'Document types the company says are available. The public page always states they have not been independently verified and invites buyers to arrange review.', children: (<>
            <div className="space-y-2">
              {titleDocs.map((doc, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label={`Document type ${i + 1}`} value={doc} onChange={(e) => setListItem('titleDocuments', 'items', i, e.target.value)} />
                  <RemoveButton onClick={() => removeListItem('titleDocuments', 'items', i)} label={`Remove document type ${i + 1}`} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addListItem('titleDocuments', 'items', '')}>
                <Plus className="w-4 h-4 mr-1" /> Add document type
              </Button>
            </div>
          </>) })}

          {Section({ sec: 'images', title: 'Marketing images', description: 'When approved, these replace the listing photos on the public page. Choose a category only if you know what the image shows — uncategorised images are captioned as promotional.', children: (<>
            <div className="space-y-3">
              {imageItems.map((img, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-3 rounded-md border p-3">
                  {img.url ? (
                    <img src={img.url.startsWith('http') ? img.url : getImageUrl(img.url)} alt="" className="w-full sm:w-24 h-24 object-cover rounded" />
                  ) : (
                    <Button type="button" variant="outline" className="sm:w-24 h-24" onClick={() => pickFile('image/jpeg,image/png,image/webp', (url) => setListItem('images', 'items', i, { url }), 'image')}>
                      <Upload className="w-4 h-4" /><span className="sr-only">Upload image {i + 1}</span>
                    </Button>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="space-y-1">
                      <label htmlFor={id(`img-alt-${i}`)} className="text-xs text-muted-foreground">Alt text (describe what the image shows) *</label>
                      <Input id={id(`img-alt-${i}`)} value={img.alt || ''} onChange={(e) => setListItem('images', 'items', i, { alt: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={id(`img-cat-${i}`)} className="text-xs text-muted-foreground">Image category</label>
                      <select
                        id={id(`img-cat-${i}`)}
                        className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                        value={img.category || ''}
                        onChange={(e) => setListItem('images', 'items', i, { category: e.target.value })}
                      >
                        <option value="">Not confirmed (captioned as promotional)</option>
                        {Object.entries(IMAGE_CATEGORY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <RemoveButton onClick={() => removeListItem('images', 'items', i)} label={`Remove image ${i + 1}`} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addListItem('images', 'items', { url: '', alt: '', category: '' })}>
                <Plus className="w-4 h-4 mr-1" /> Add image
              </Button>
            </div>
          </>) })}

          {Section({ sec: 'promotion', title: 'Event offer or promotion', description: 'Hidden automatically after the end date.', children: (<>
            {TextField({ sec: 'promotion', field: 'title', label: 'Offer title' })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TextField({ sec: 'promotion', field: 'startDate', label: 'Start date', type: 'date' })}
              {TextField({ sec: 'promotion', field: 'endDate', label: 'End date', type: 'date' })}
            </div>
            {TextField({ sec: 'promotion', field: 'terms', label: 'Terms', long: true })}
          </>) })}

          {Section({ sec: 'contacts', title: 'Contacts', description: 'Use only verified company contact details. Leave blank to send buyers to the Contact page.', children: (<>
            {TextField({ sec: 'contacts', field: 'enquiry', label: 'Enquiry contact', long: true })}
            {TextField({ sec: 'contacts', field: 'afterSales', label: 'After-sales contact', long: true })}
          </>) })}

          <div className="space-y-1 rounded-lg border border-dashed p-4">
            <label htmlFor={id('internal-notes')} className="text-sm font-medium">Internal notes (never shown publicly)</label>
            <Textarea
              id={id('internal-notes')}
              rows={3}
              value={details.internalNotes || ''}
              placeholder="e.g. Delivery date awaiting company confirmation"
              onChange={(e) => setDetails((prev) => ({ ...prev, internalNotes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !!uploading}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save details</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
