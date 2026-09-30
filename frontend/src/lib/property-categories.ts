/**
 * Homepage / browse categories, derived from the property type the admin
 * picks when listing a property. Keep in sync with the backend PropertyType enum.
 */
export type PropertyCategory = 'land' | 'homes' | 'commercial';

export const CATEGORY_TYPES: Record<PropertyCategory, string[]> = {
  land: ['LAND'],
  homes: ['APARTMENT', 'RESIDENTIAL', 'CONDO', 'TOWNHOUSE', 'VILLA'],
  commercial: ['COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE'],
};

export const CATEGORY_LABELS: Record<PropertyCategory, string> = {
  land: 'Land & Plots',
  homes: 'Apartments & Homes',
  commercial: 'Commercial',
};

export function categoryOf(type?: string | null): PropertyCategory {
  const t = (type || '').toUpperCase();
  if (CATEGORY_TYPES.land.includes(t)) return 'land';
  if (CATEGORY_TYPES.commercial.includes(t)) return 'commercial';
  return 'homes';
}

/** `/properties` link filtered to a whole category (backend accepts comma lists). */
export function categoryHref(category: PropertyCategory): string {
  return `/properties?type=${CATEGORY_TYPES[category].join(',')}`;
}
