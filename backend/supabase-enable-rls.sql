-- ===========================================
-- Easyland - Supabase Row Level Security
-- ===========================================
-- Enables RLS on every app table and installs an event trigger so that any
-- table created later (Prisma migrations, db push, tenant provisioning, raw SQL)
-- gets RLS enabled automatically.
--
-- No policies are defined: this blocks the Supabase REST/GraphQL API (anon and
-- authenticated keys), while Prisma connects as `postgres` (BYPASSRLS) and is
-- unaffected.
--
-- Idempotent. Run against the master DB and every tenant DB.
-- Supabase-managed schemas (auth, storage, realtime, vault, ...) are left alone.

-- Schemas owned by Postgres/Supabase that must not be touched
CREATE OR REPLACE FUNCTION public.rls_is_app_schema(schema_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT schema_name NOT LIKE 'pg\_%'
     AND schema_name NOT LIKE '\_%'
     AND schema_name NOT IN (
       'information_schema', 'auth', 'storage', 'realtime', 'vault',
       'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'net', 'cron',
       'pgsodium', 'pgsodium_masks', 'supabase_functions', 'supabase_migrations'
     );
$$;

-- 1. Backfill: enable RLS on all existing app tables
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
      AND public.rls_is_app_schema(n.nspname)
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.tbl);
  END LOOP;
END $$;

-- 2. Event trigger: enable RLS on every newly created app table
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE object_type IN ('table', 'partitioned table')
  LOOP
    IF public.rls_is_app_schema(cmd.schema_name) THEN
      BEGIN
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN
        -- Never block the DDL itself (e.g. table owned by another role)
        RAISE WARNING 'rls_auto_enable: could not enable RLS on %: %', cmd.object_identity, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS rls_auto_enable;
CREATE EVENT TRIGGER rls_auto_enable
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();
