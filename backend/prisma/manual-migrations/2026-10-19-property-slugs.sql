-- ===========================================================================
-- 2026-10-19: Readable property URLs (/properties/harmony-gardens)
--
-- Adds "slug", backfills it from each title, then makes it unique.
-- Additive and idempotent: only rows without a slug are touched.
-- The slug rule mirrors slugify() in src/modules/property/property-slug.ts:
-- lowercase, "&" → "and", apostrophes dropped, other non [a-z0-9] runs → "-",
-- trimmed, max 80 chars; duplicates get "-2", "-3", … in creation order.
--
-- Run against EVERY tenant schema BEFORE deploying the backend that includes
-- `slug` in schema.prisma.
-- ===========================================================================

BEGIN;

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "slug" TEXT;

WITH base AS (
  SELECT id, "createdAt",
    COALESCE(NULLIF(
      trim(both '-' from left(
        trim(both '-' from regexp_replace(
          regexp_replace(replace(lower(title), '&', ' and '), '[''’]', '', 'g'),
          '[^a-z0-9]+', '-', 'g')),
        80)),
      ''), 'property') AS s
  FROM "properties"
),
ranked AS (
  SELECT id, s, row_number() OVER (PARTITION BY s ORDER BY "createdAt", id) AS n FROM base
)
UPDATE "properties" p
SET "slug" = CASE WHEN r.n = 1 THEN r.s ELSE r.s || '-' || r.n END
FROM ranked r
WHERE p.id = r.id AND p."slug" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "properties_slug_key" ON "properties"("slug");

COMMIT;
