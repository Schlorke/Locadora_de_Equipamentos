-- rentals.status becomes the RentalStatus enum. Values written by the application:
-- PENDING (creation), ACTIVE (checkout), OVERDUE (cron/late fee), PENDING_RETURN (admin PATCH),
-- COMPLETED (check-in) and CANCELLED (cancellation/quote rejection).
-- Preflight: abort on NULL or unknown values. The meaning of NULL is never inferred.
-- Full visibility under FORCE ROW LEVEL SECURITY (202609250005): FORCE is lifted and restored
-- inside this single DO statement, so the owner sees every "rentals" row (also those of every
-- organization and those without one) and an abort rolls the change back.
--
-- Locks (the previous application version may be online while this runs), as in 202609260004:
-- lifting FORCE takes ACCESS EXCLUSIVE on "rentals", which queues every later query on the table
-- behind it. lock_timeout: a lock that is not granted within 5 s aborts the migration instead;
-- statement_timeout bounds each statement. The whole script rolls back (nothing changed), but
-- `prisma migrate deploy` stops with P3018 (55P03, lock timeout) and records it as failed, so the
-- next deploy refuses to run (P3009) until it is marked rolled back. Recovery, once "rentals" is
-- quiet:
--     pnpm exec prisma migrate resolve --rolled-back 202609260002_rental_status_pending
--     pnpm exec prisma migrate deploy
-- Lifting FORCE stays: the status counts must see every row (NULL or unknown values in every
-- organization and without one), and a table owner without BYPASSRLS only sees them once FORCE is
-- lifted (no index can do this check).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  missing bigint;
  unknown text;
  forced boolean;
BEGIN
  -- Also inside the block, so the limit holds when a runner sends each statement on its own.
  PERFORM set_config('lock_timeout', '5s', true);
  SELECT relforcerowsecurity INTO STRICT forced FROM pg_class WHERE oid = '"rentals"'::regclass;
  IF forced THEN
    ALTER TABLE "rentals" NO FORCE ROW LEVEL SECURITY;
  END IF;

  SELECT count(*) INTO missing FROM "rentals" WHERE "status" IS NULL;
  SELECT string_agg(format('%L=%s', "status", total), ', ' ORDER BY "status") INTO unknown
  FROM (
    SELECT "status", count(*) AS total FROM "rentals"
    WHERE "status" NOT IN ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE', 'PENDING_RETURN')
    GROUP BY "status"
  ) AS invalid;
  IF missing > 0 OR unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight rentals.status: % rental(s) without status; unknown values: %. A human decision is required before converting to RentalStatus; no data was changed. Then mark this migration rolled back and deploy again: pnpm exec prisma migrate resolve --rolled-back 202609260002_rental_status_pending, then pnpm exec prisma migrate deploy.', missing, coalesce(unknown, 'none');
  END IF;

  IF forced THEN
    ALTER TABLE "rentals" FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

-- The new value only becomes usable after this migration commits (see 202609260003).
ALTER TYPE "RentalStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ACTIVE';
