-- ===========================================================================
-- 2026-10-01: Branch system + Ads/CRM lead capture (additive only)
--
-- Brings an existing tenant DB up to what the branch, leads, integrations and
-- webhooks modules expect. Every statement is idempotent and ADD-only:
-- no DROP, no data rewrite. Deliberately excludes unrelated drift that
-- `prisma migrate diff` also reported (2FA columns, FK re-creations).
-- ===========================================================================

-- ── Branch system ──────────────────────────────────────────────────────────
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BRANCH_MANAGER';

CREATE TABLE IF NOT EXISTS "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "property_transfers" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_transfers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users"      ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "sales"      ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "expenses"   ADD COLUMN IF NOT EXISTS "branchId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_code_key"      ON "branches"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "branches_managerId_key" ON "branches"("managerId");
CREATE INDEX IF NOT EXISTS "branches_city_idx"     ON "branches"("city");
CREATE INDEX IF NOT EXISTS "branches_isActive_idx" ON "branches"("isActive");
CREATE INDEX IF NOT EXISTS "property_transfers_propertyId_idx"   ON "property_transfers"("propertyId");
CREATE INDEX IF NOT EXISTS "property_transfers_fromBranchId_idx" ON "property_transfers"("fromBranchId");
CREATE INDEX IF NOT EXISTS "property_transfers_toBranchId_idx"   ON "property_transfers"("toBranchId");
CREATE INDEX IF NOT EXISTS "property_transfers_status_idx"       ON "property_transfers"("status");
CREATE INDEX IF NOT EXISTS "users_branchId_idx"      ON "users"("branchId");
CREATE INDEX IF NOT EXISTS "properties_branchId_idx" ON "properties"("branchId");
CREATE INDEX IF NOT EXISTS "sales_branchId_idx"      ON "sales"("branchId");
CREATE INDEX IF NOT EXISTS "expenses_branchId_idx"   ON "expenses"("branchId");

-- Foreign keys (added only if missing)
DO $$
DECLARE fk record;
BEGIN
  FOR fk IN SELECT * FROM (VALUES
    ('users',              'users_branchId_fkey',                 'FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
    ('branches',           'branches_managerId_fkey',             'FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
    ('properties',         'properties_branchId_fkey',            'FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
    ('sales',              'sales_branchId_fkey',                 'FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
    ('expenses',           'expenses_branchId_fkey',              'FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE'),
    ('property_transfers', 'property_transfers_propertyId_fkey',  'FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('property_transfers', 'property_transfers_fromBranchId_fkey','FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE'),
    ('property_transfers', 'property_transfers_toBranchId_fkey',  'FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE')
  ) AS t(tbl, name, def)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = fk.name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', fk.tbl, fk.name, fk.def);
    END IF;
  END LOOP;
END $$;

-- ── -- ADS → CRM LEAD CAPTURE SYSTEM
-- ===========================================

-- Enums
DO $$ BEGIN CREATE TYPE "LeadStatus" AS ENUM ('NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','NEGOTIATION','WON','LOST','UNQUALIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK','INSTAGRAM','GOOGLE','WEBSITE','WHATSAPP','MESSENGER','REFERRAL','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeadScore" AS ENUM ('HOT','WARM','COLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IntegrationProvider" AS ENUM ('META','GOOGLE','WEBSITE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AssignmentMode" AS ENUM ('DIRECT','ROUND_ROBIN','LOAD_BALANCE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Leads
CREATE TABLE IF NOT EXISTS "leads" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"       TEXT,
  "name"            TEXT NOT NULL,
  "phone"           TEXT,
  "email"           TEXT,
  "city"            TEXT,
  "country"         TEXT,
  "source"          "LeadSource" NOT NULL DEFAULT 'MANUAL',
  "platform"        TEXT,
  "status"          "LeadStatus" NOT NULL DEFAULT 'NEW',
  "score"           "LeadScore" NOT NULL DEFAULT 'COLD',
  "scoreValue"      INTEGER NOT NULL DEFAULT 0,
  "campaignName"    TEXT,
  "adName"          TEXT,
  "formId"          TEXT,
  "pageId"          TEXT,
  "adAccountId"     TEXT,
  "keyword"         TEXT,
  "adGroupName"     TEXT,
  "costPerLead"     DECIMAL(10,2),
  "adSpend"         DECIMAL(10,2),
  "utmSource"       TEXT,
  "utmMedium"       TEXT,
  "utmCampaign"     TEXT,
  "utmTerm"         TEXT,
  "utmContent"      TEXT,
  "externalId"      TEXT,
  "assignedToId"    TEXT,
  "notes"           TEXT,
  "customFields"    JSONB,
  "rawPayload"      JSONB,
  "firstReplyAt"    TIMESTAMP(3),
  "lastContactedAt" TIMESTAMP(3),
  "convertedAt"     TIMESTAMP(3),
  "isDeleted"       BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leads_companyId_idx"     ON "leads"("companyId");
CREATE INDEX IF NOT EXISTS "leads_source_idx"        ON "leads"("source");
CREATE INDEX IF NOT EXISTS "leads_status_idx"        ON "leads"("status");
CREATE INDEX IF NOT EXISTS "leads_score_idx"         ON "leads"("score");
CREATE INDEX IF NOT EXISTS "leads_assignedToId_idx"  ON "leads"("assignedToId");
CREATE INDEX IF NOT EXISTS "leads_createdAt_idx"     ON "leads"("createdAt");
CREATE INDEX IF NOT EXISTS "leads_phone_idx"         ON "leads"("phone");
CREATE INDEX IF NOT EXISTS "leads_email_idx"         ON "leads"("email");
CREATE INDEX IF NOT EXISTS "leads_externalId_idx"    ON "leads"("externalId");
CREATE INDEX IF NOT EXISTS "leads_campaignName_idx"  ON "leads"("campaignName");
CREATE INDEX IF NOT EXISTS "leads_isDeleted_idx"     ON "leads"("isDeleted");

-- Lead Events (audit trail)
CREATE TABLE IF NOT EXISTS "lead_events" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "leadId"      TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "title"       TEXT,
  "metadata"    JSONB,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "lead_events_leadId_idx"   ON "lead_events"("leadId");
CREATE INDEX IF NOT EXISTS "lead_events_createdAt_idx" ON "lead_events"("createdAt");

-- Lead Notes
CREATE TABLE IF NOT EXISTS "lead_notes" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "leadId"      TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "authorId"    TEXT,
  "authorName"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "lead_notes_leadId_idx" ON "lead_notes"("leadId");

-- Platform Integrations
CREATE TABLE IF NOT EXISTS "integrations" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"          TEXT NOT NULL,
  "provider"           "IntegrationProvider" NOT NULL,
  "name"               TEXT NOT NULL,
  "providerAccountId"  TEXT,
  "accessToken"        TEXT,
  "refreshToken"       TEXT,
  "tokenExpiresAt"     TIMESTAMP(3),
  "webhookVerifyToken" TEXT,
  "settings"           JSONB,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "integrations_companyId_idx"  ON "integrations"("companyId");
CREATE INDEX IF NOT EXISTS "integrations_provider_idx"   ON "integrations"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_company_provider_account_key"
  ON "integrations"("companyId","provider","providerAccountId") WHERE "providerAccountId" IS NOT NULL;

-- Lead Assignment Rules
CREATE TABLE IF NOT EXISTS "lead_assignment_rules" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"      TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "conditions"     JSONB NOT NULL DEFAULT '[]',
  "assignToId"     TEXT,
  "teamIds"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "mode"           "AssignmentMode" NOT NULL DEFAULT 'DIRECT',
  "priority"       INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "triggerCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_assignment_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lead_assignment_rules_companyId_idx" ON "lead_assignment_rules"("companyId");
CREATE INDEX IF NOT EXISTS "lead_assignment_rules_isActive_idx"  ON "lead_assignment_rules"("isActive");

-- Embeddable Lead Forms
CREATE TABLE IF NOT EXISTS "lead_forms" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "fields"    JSONB NOT NULL DEFAULT '[]',
  "settings"  JSONB,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "leadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lead_forms_companyId_idx" ON "lead_forms"("companyId");

-- Round-robin assignment state
CREATE TABLE IF NOT EXISTS "assignment_round_robin" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"    TEXT NOT NULL,
  "ruleId"       TEXT NOT NULL,
  "lastUserId"   TEXT,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_round_robin_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assignment_round_robin_ruleId_key" UNIQUE ("ruleId")
);

-- Leads can belong to a branch
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
CREATE INDEX IF NOT EXISTS "leads_branchId_idx" ON "leads"("branchId");
