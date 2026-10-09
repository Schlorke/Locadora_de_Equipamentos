-- Tenant slug = DNS label of the platform (docs/features/tenant-slug-policy.md, ADR
-- docs/architecture/adr-tenant-hosts.md D15): 2..63 characters, [a-z0-9-], no hyphen at either
-- end and no "--" anywhere (blocks "xn--" and the Vercel preview separator "---"). Same rule as
-- TENANT_SLUG_RE in packages/contracts/src/platform.ts. CHECK is not modelled by Prisma, so
-- schema.prisma does not change. Reserved names stay out of the database (single source:
-- packages/contracts/src/platform.json); tools/tenant-slug-preflight.mjs lists them before a deploy.
--
-- "organizations" is a global model (tools/tenant-models.json) without row level security, so the
-- preflight sees every row. The guard makes that assumption explicit instead of trusting it.
-- Preflight: abort when an existing slug violates the rule. No data is changed, but
-- `prisma migrate deploy` stops with P3018 (P0001) and records the migration as failed, so the next
-- deploy refuses to run (P3009) until it is marked rolled back. Recovery, once the slugs are
-- corrected with approval (docs/features/tenant-slug-policy.md, section 8):
--     pnpm exec prisma migrate resolve --rolled-back 202609260005_organization_slug_policy
--     pnpm exec prisma migrate deploy
DO $$
DECLARE
  conflicts bigint;
  sample text;
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = '"organizations"'::regclass) THEN
    RAISE EXCEPTION 'Preflight organizations_slug_dns_label: "organizations" tem row level security; o preflight exige a tabela global para ver todas as linhas. Nada foi alterado. Depois marque esta migration como revertida e rode o deploy: pnpm exec prisma migrate resolve --rolled-back 202609260005_organization_slug_policy e então pnpm exec prisma migrate deploy.';
  END IF;

  SELECT count(*) INTO conflicts FROM "organizations"
  WHERE NOT ("slug" ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$' AND position('--' in "slug") = 0);
  IF conflicts > 0 THEN
    SELECT string_agg(format('id=%s slug=%L', "id", "slug"), '; ') INTO sample FROM (
      SELECT "id", "slug" FROM "organizations"
      WHERE NOT ("slug" ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$' AND position('--' in "slug") = 0)
      ORDER BY "slug", "id"
      LIMIT 10
    ) AS listed;
    RAISE EXCEPTION 'Preflight organizations_slug_dns_label: % organização(ões) fora da política (%). Ajuste com aprovação; nada foi alterado. Depois marque esta migration como revertida e rode o deploy: pnpm exec prisma migrate resolve --rolled-back 202609260005_organization_slug_policy e então pnpm exec prisma migrate deploy.', conflicts, sample;
  END IF;
END $$;

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_slug_dns_label"
  CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$' AND position('--' in "slug") = 0);
