/** Public property URL: readable slug when the listing has one, id otherwise (older listings / links). */
export function propertyHref(property: { id: string; slug?: string | null }, suffix = ''): string {
  return `/properties/${property.slug || property.id}${suffix}`;
}

export const isPropertyId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
