/**
 * Human-readable URL slugs for public property pages (/properties/harmony-gardens).
 * Keep slugify() in sync with the backfill in
 * prisma/manual-migrations/2026-10-19-property-slugs.sql.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugify(title: string): string {
  const base = (title || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
  return base || 'property';
}

/** A slug for `title` not used by any other property ("x", then "x-2", "x-3", …). */
export async function uniqueSlug(
  prisma: { property: { findMany: (args: any) => Promise<{ id: string; slug: string | null }[]> } },
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await prisma.property.findMany({
        where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true, slug: true },
      })
    ).map((p) => p.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
