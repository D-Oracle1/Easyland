-- ===========================================================================
-- 2026-10-18: Property listing details (additive only)
--
-- Adds the optional JSON column behind the admin "Listing details" editor and
-- the structured section on public property pages. Nullable, no default, no
-- data rewrite — existing listings are untouched and keep rendering as before.
--
-- Run against EVERY tenant schema BEFORE deploying the backend that includes
-- `listingDetails` in schema.prisma (Prisma selects all columns, so a missing
-- column would break every property query).
-- ===========================================================================

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "listingDetails" JSONB;
