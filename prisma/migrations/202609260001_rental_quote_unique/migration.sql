-- One rental per quote inside each organization. The partial unique index was introduced by
-- 202609250005; this migration makes the guarantee explicit and verifiable in every database.
-- Preflight: abort with a clear message on duplicates. No data is deleted or merged.
--
-- Locks (the previous application version may be online while this runs), as in 202609260004:
-- - lock_timeout: a lock that is not granted within 5 s aborts the migration instead of queueing
--   every later query on "rentals" behind it; statement_timeout bounds each statement. The whole
--   script rolls back (nothing changed), but `prisma migrate deploy` stops with P3018 (55P03, lock
--   timeout) and records it as failed, so the next deploy refuses to run (P3009) until it is marked
--   rolled back. Recovery, once "rentals" is quiet:
--     pnpm exec prisma migrate resolve --rolled-back 202609260001_rental_quote_unique
--     pnpm exec prisma migrate deploy
-- - The unique index build is the check itself: it reads every row of the table whatever the row
--   level security of the migrator (202609250005 FORCE), so nothing has to be lifted first. It holds
--   SHARE on "rentals": reads go on, writes wait. When the index already exists (every database
--   migrated through 202609250005) it only takes that SHARE lock and skips.
-- - On duplicates (unique_violation) the block lifts FORCE ROW LEVEL SECURITY only to list them for
--   the operator (under FORCE the owner would count zero rows) and raises; the whole migration rolls
--   back, FORCE included, so no other session ever sees the table without it.
-- - A migrator that does not own the table fails on CREATE INDEX with "must be owner".
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  conflicts bigint;
  sample text;
BEGIN
  -- Also inside the block, so the limit holds when a runner sends each statement on its own.
  PERFORM set_config('lock_timeout', '5s', true);
  BEGIN
    -- Rows without an organization never conflict (NULLs are distinct), so this predicate is
    -- equivalent to WHERE "quoteId" IS NOT NULL. Kept identical to 202609250005 on purpose.
    CREATE UNIQUE INDEX IF NOT EXISTS "rentals_tenant_quote_unique"
      ON "rentals"("tenantId", "quoteId") WHERE "tenantId" IS NOT NULL AND "quoteId" IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = '"rentals"'::regclass) THEN
      ALTER TABLE "rentals" NO FORCE ROW LEVEL SECURITY;
    END IF;
    SELECT count(*) INTO conflicts FROM (
      SELECT 1 FROM "rentals"
      WHERE "tenantId" IS NOT NULL AND "quoteId" IS NOT NULL
      GROUP BY "tenantId", "quoteId"
      HAVING count(*) > 1
    ) AS duplicated;
    IF conflicts = 0 THEN
      RAISE;
    END IF;
    SELECT string_agg(format('tenant=%s quote=%s rentals=%s', "tenantId", "quoteId", total), '; ')
      INTO sample
    FROM (
      SELECT "tenantId", "quoteId", count(*) AS total FROM "rentals"
      WHERE "tenantId" IS NOT NULL AND "quoteId" IS NOT NULL
      GROUP BY "tenantId", "quoteId"
      HAVING count(*) > 1
      ORDER BY "tenantId", "quoteId"
      LIMIT 10
    ) AS listed;
    RAISE EXCEPTION 'Preflight rentals_tenant_quote_unique: % quote(s) have more than one rental in the same organization (%). Reconcile them manually; no data was changed. Then mark this migration rolled back and deploy again: pnpm exec prisma migrate resolve --rolled-back 202609260001_rental_quote_unique, then pnpm exec prisma migrate deploy.', conflicts, sample;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index AS i
    JOIN pg_class AS c ON c.oid = i.indexrelid
    WHERE c.relname = 'rentals_tenant_quote_unique'
      AND i.indrelid = '"rentals"'::regclass
      AND i.indisunique AND i.indisvalid
      AND pg_get_indexdef(i.indexrelid) LIKE '%("tenantId", "quoteId")%'
  ) THEN
    RAISE EXCEPTION 'rentals_tenant_quote_unique exists with an unexpected definition; review it manually; no data was changed. Then mark this migration rolled back and deploy again: pnpm exec prisma migrate resolve --rolled-back 202609260001_rental_quote_unique, then pnpm exec prisma migrate deploy.';
  END IF;
END $$;
