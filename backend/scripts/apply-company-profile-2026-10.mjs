/**
 * One-off content update for the easylandng.com tenant (Oct 2026 company brief):
 *   - CMS `company_profile` (new section shown on /about#company-profile)
 *   - CMS `about.content`, `mission`, `core_values` replaced with the supplied wording
 *     (other `about` fields — title, subtitle, images — are kept as they are)
 *   - Harmony Gardens (residential listing) `listingDetails`
 *
 * Contains ONLY facts supplied by the company. Dry run by default: prints the
 * current and proposed values and changes nothing.
 *
 *   MASTER_DATABASE_URL=... node scripts/apply-company-profile-2026-10.mjs           # dry run
 *   MASTER_DATABASE_URL=... node scripts/apply-company-profile-2026-10.mjs --apply   # write
 *
 * Prerequisites for --apply:
 *   - prisma/manual-migrations/2026-10-18-property-listing-details.sql applied to the tenant
 *     (the script refuses to write listing details otherwise)
 *   - the company has confirmed the open items in the release notes (entity naming, delivery date, prices)
 * Public CMS responses are cached for up to 10 minutes after writing.
 */
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const DOMAIN = 'easylandng.com';
const HARMONY_GARDENS_ID = 'd7874aa5-8b29-4d60-8e50-6252195411b9'; // "HARMONY GARDENS" (RESIDENTIAL)

const COMPANY_NAME = 'Princy and Eddy Resources Nigeria Limited';

const companyProfile = {
  legalName: COMPANY_NAME,
  registrationNumber: 'RC 7378240',
  establishedYear: '2024',
  ambition: 'Building A City',
  sectors: 'Residential, commercial and investment',
  portfolio: [
    { name: 'Salvation View Estate' },
    { name: 'Savannah Estate' },
    { name: 'Harmony Gardens Estate and Apartments' },
  ],
};

const aboutContent =
  `<p>${COMPANY_NAME} operates in real estate, specializing in the marketing, sale, and building of lands and properties. ` +
  'The company serves residential, commercial, and investment sectors and aims to make property ownership seamless, ' +
  'secure, and rewarding through transparent processes, innovative marketing, and a client-focused approach.</p>';

const missionContent =
  '<p>To make property ownership seamless, secure, and rewarding.</p>' +
  '<p>We value transparent processes, innovative marketing strategies, and a client-first approach.</p>';

const visionContent =
  '<p>To be a preferred real estate company in the region, delivering sustainable solutions and value to stakeholders, ' +
  'and providing genuine and affordable lands and properties while promoting safety, efficiency, and environmental stewardship.</p>';

const coreValues = ['Integrity', 'Customer Focus', 'Innovation', 'Safety', 'Sustainability']
  .map((title) => ({ title, description: '' }));

const harmonyGardensDetails = {
  overview: {
    approved: true,
    location: 'Rivers State, Nigeria',
    propertyType: '3-bedroom bungalow and 4-bedroom duplex',
  },
  units: { approved: true, totalUnits: 16 },
  construction: { approved: true, status: 'Ongoing' },
  // Shown publicly as "Q1 2027 (estimate — contact us to confirm)" until `confirmed` is set
  delivery: { approved: true, expected: 'Q1 2027', confirmed: false },
  pricing: {
    approved: true,
    items: [
      { label: 'Harmony Gardens land', price: 25000000, deposit: 17000000 },
      { label: 'Fully finished 3-bedroom bungalow', price: 75000000, deposit: 30000000 },
    ],
    note: 'Price and deposit shown in promotional flyer; please contact us to confirm current price and terms.',
  },
  titleDocuments: {
    approved: true,
    items: [
      "Certificate of Deposit from the Surveyor-General's Office",
      'Deed of Conveyance',
      'Registered Survey Plan',
      'Survey Layout',
      'Search Reports',
      'Developmental Approval Letters',
      'Environmental Assessment Clearance',
    ],
  },
  internalNotes:
    'Oct 2026 brief. To confirm with the company: Q1 2027 delivery date; whether flyer prices/deposits are current. ' +
    'Existing listing description says "32 units of 3bedroom bungalow" and a ₦65M pre-launch price, which conflicts ' +
    'with the supplied 16 units (3-bed bungalow + 4-bed duplex) — description needs company review.',
};

// ── helpers ──────────────────────────────────────────────────────────────────
function sessionMode(url) {
  const u = new URL(url);
  if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
  const schema = u.searchParams.get('schema');
  for (const k of ['pgbouncer', 'connection_limit', 'schema']) u.searchParams.delete(k);
  return { url: u.toString(), schema };
}

async function connect(rawUrl) {
  const { url, schema } = sessionMode(rawUrl);
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  if (schema) await client.query(`SET search_path TO "${schema.replace(/"/g, '')}"`);
  return client;
}

const show = (label, value) => console.log(`\n── ${label}\n${JSON.stringify(value, null, 2)}`);

// ── main ─────────────────────────────────────────────────────────────────────
if (!process.env.MASTER_DATABASE_URL) {
  console.error('Set MASTER_DATABASE_URL (e.g. from `vercel env pull` for the backend project).');
  process.exit(1);
}

const master = await connect(process.env.MASTER_DATABASE_URL);
const { rows: [company] } = await master.query(
  'SELECT id, slug, "databaseUrl" FROM companies WHERE domain = $1 AND "isActive" = true',
  [DOMAIN],
);
await master.end();
if (!company?.databaseUrl) throw new Error(`No active tenant with domain ${DOMAIN}`);
console.log(`Tenant: ${company.slug} (${company.id}) — ${APPLY ? 'APPLY' : 'DRY RUN'}`);

const db = await connect(company.databaseUrl);
const getSetting = async (key) =>
  (await db.query('SELECT value FROM system_settings WHERE key = $1', [key])).rows[0]?.value ?? null;

const currentAbout = (await getSetting('cms_about')) || {};
const currentMission = (await getSetting('cms_mission')) || {};
const proposed = {
  cms_company_profile: companyProfile,
  cms_about: { ...currentAbout, content: aboutContent },
  cms_mission: { ...currentMission, missionContent, visionContent },
  cms_core_values: { values: coreValues },
};

for (const [key, value] of Object.entries(proposed)) {
  show(`${key} (current)`, await getSetting(key));
  show(`${key} (proposed)`, value);
}

const { rows: [hasColumn] } = await db.query(
  `SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'properties' AND column_name = 'listingDetails'`,
);
const { rows: [harmony] } = await db.query(
  `SELECT id, title, type${hasColumn ? ', "listingDetails"' : ''} FROM properties WHERE id = $1`,
  [HARMONY_GARDENS_ID],
);
if (!harmony) throw new Error(`Harmony Gardens listing ${HARMONY_GARDENS_ID} not found`);
show(`${harmony.title} listingDetails (current)`, hasColumn ? harmony.listingDetails : '(column missing — run the migration first)');
show(`${harmony.title} listingDetails (proposed)`, harmonyGardensDetails);

if (!APPLY) {
  console.log('\nDry run only — nothing written. Re-run with --apply once the company has confirmed.');
  await db.end();
  process.exit(0);
}
if (!hasColumn) {
  console.error('\nRefusing to apply: properties."listingDetails" does not exist. Apply the 2026-10-18 migration first.');
  await db.end();
  process.exit(1);
}

await db.query('BEGIN');
try {
  for (const [key, value] of Object.entries(proposed)) {
    await db.query(
      `INSERT INTO system_settings (id, key, value, "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()`,
      [key, JSON.stringify(value)],
    );
  }
  await db.query('UPDATE properties SET "listingDetails" = $1, "updatedAt" = now() WHERE id = $2', [
    JSON.stringify(harmonyGardensDetails),
    HARMONY_GARDENS_ID,
  ]);
  await db.query('COMMIT');
  console.log('\nApplied. Public pages may take up to 10 minutes to refresh (CMS cache).');
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
