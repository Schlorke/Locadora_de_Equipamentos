-- At most one current charge per quote/method/type. Cancelled and refunded charges remain as
-- history (with their PaymentAttempt rows) and no longer block a new charge for the same quote.
-- Preflight: abort on duplicated current charges. No data is deleted, merged or reactivated.
--
-- Failure and recovery: whatever stops this migration (a busy "payments", 55P03 below; the preflight,
-- P0001; any other error) rolls the whole script back, so nothing changed. But `prisma migrate deploy`
-- stops with P3018 and records the migration as failed, and every later deploy refuses to run (P3009)
-- until it is marked rolled back: deploying again, even after reconciling, does not help. Once the
-- cause is gone ("payments" is quiet, or the duplicated charges were reconciled as the preflight
-- message asks), run:
--     pnpm exec prisma migrate resolve --rolled-back 202609260004_payment_active_charge_unique
--     pnpm exec prisma migrate deploy
--
-- Locks (the previous application version may be online while this runs):
-- - lock_timeout: a lock that is not granted within 5 s aborts the migration instead of queueing
--   every later query on "payments" behind it; statement_timeout bounds each statement. Recovery as
--   above, once "payments" is quiet.
-- - The unique index build is the check itself: it reads every row of the table whatever the row
--   level security of the migrator (202609250005 FORCE), so nothing has to be lifted first. It holds
--   SHARE on "payments": reads go on, writes wait. ACCESS EXCLUSIVE is only taken by the final
--   DROP INDEX, for an instant, and on the failure path below.
-- - On duplicates (unique_violation) the block lifts FORCE ROW LEVEL SECURITY only to list them for
--   the operator (under FORCE the owner would count zero rows) and raises; the whole migration rolls
--   back, FORCE included, so no other session ever sees the table without it.
-- - A migrator that does not own the table fails on CREATE INDEX with "must be owner".
-- - The legacy full index "payments_quote_method_type_unique" may already be gone: the preflight only
--   fires in a database without it, and recreating it would mean deleting the cancelled history it
--   rejects. So it is dropped only if it exists.
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
    CREATE UNIQUE INDEX "payments_quote_method_type_active_unique"
      ON "payments"("quoteId", "method", "type")
      WHERE "quoteId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'REFUNDED');
  EXCEPTION WHEN unique_violation THEN
    IF (SELECT relforcerowsecurity FROM pg_class WHERE oid = '"payments"'::regclass) THEN
      ALTER TABLE "payments" NO FORCE ROW LEVEL SECURITY;
    END IF;
    SELECT count(*) INTO conflicts FROM (
      SELECT 1 FROM "payments"
      WHERE "quoteId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY "quoteId", "method", "type"
      HAVING count(*) > 1
    ) AS duplicated;
    IF conflicts = 0 THEN
      RAISE;
    END IF;
    SELECT string_agg(format('quote=%s method=%s type=%s payments=%s', "quoteId", "method", "type", total), '; ')
      INTO sample
    FROM (
      SELECT "quoteId", "method", "type", count(*) AS total FROM "payments"
      WHERE "quoteId" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY "quoteId", "method", "type"
      HAVING count(*) > 1
      ORDER BY "quoteId", "method", "type"
      LIMIT 10
    ) AS listed;
    RAISE EXCEPTION 'Preflight payments_quote_method_type_active_unique: % quote obligation(s) have more than one current charge (%). Reconcile them manually; no data was changed. Then mark this migration rolled back and deploy again: pnpm exec prisma migrate resolve --rolled-back 202609260004_payment_active_charge_unique, then pnpm exec prisma migrate deploy.', conflicts, sample;
  END;
END $$;

DROP INDEX IF EXISTS "payments_quote_method_type_unique";
