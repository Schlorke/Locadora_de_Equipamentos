import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { alterSharedAclInTransaction } from './shared-acl'
import { requireTestDatabase } from './test-database'

/**
 * Fatos de uma locadora com o site no ar e indexável (S13; ADR docs/architecture/adr-saas-subscription.md, B.5 e
 * B.10): publicada, com acesso FULL e `siteIndexable`. É o estado em que a migration 0104 deixou as locadoras ACTIVE
 * que já existiam (`sitePublishedAt = createdAt`, `access` FULL). Organização criada fora do contexto de plataforma
 * nasce sem publicação e com acesso SETUP: o site fica desligado (OFF, 404 do D10) até ser publicada.
 */
export const LIVE_SITE = Object.freeze({
  access: 'FULL' as const,
  sitePublishedAt: new Date('2026-01-01T00:00:00.000Z'),
  siteIndexable: true,
})

/** Consulta de organização do resolvedor público no host API (`apps/services/api/src/host/runtime.ts`). */
export const PUBLIC_ORGANIZATION_SELECT = Object.freeze({
  id: true,
  status: true,
  access: true,
  sitePublishedAt: true,
  siteIndexable: true,
})

/**
 * Publica organizações de teste com um papel restrito de plataforma (sem privilégio de negócio, sem BYPASSRLS),
 * nunca desligando os triggers de projeção. Papel, grant, escrita e remoção do papel ficam numa só transação,
 * serializada pelo lock de `./shared-acl`, o mesmo de toda alteração de ACL dos testes: arquivos em paralelo não
 * disputam a mesma linha de catálogo (XX000 "tuple concurrently updated").
 */
export async function publishTestOrganizations(
  prisma: PrismaClient,
  ids: readonly string[]
): Promise<void> {
  const target = new URL(requireTestDatabase(process.env)).pathname.slice(1)
  const role = 'test_site_publish_' + randomUUID().replaceAll('-', '')
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (rows[0]?.name !== target)
      throw new Error('Public site fixture database mismatch')
    await alterSharedAclInTransaction(tx, [
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      `GRANT USAGE ON SCHEMA public TO "${role}"`,
      `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
    ])
    await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`)
    await tx.$queryRaw`SELECT set_config('app.platform_scope','on',true)`
    await tx.organization.updateMany({
      where: { id: { in: [...ids] } },
      data: LIVE_SITE,
    })
    await tx.$executeRawUnsafe('RESET ROLE')
    await alterSharedAclInTransaction(tx, [
      `DROP OWNED BY "${role}"`,
      `DROP ROLE "${role}"`,
    ])
  })
}

/**
 * Mesma publicação para quem semeia com `pg` dentro de uma transação já aberta (o e2e dos hosts). O chamador abre e
 * fecha a transação; o papel restrito nasce e some dentro dela, sob o mesmo lock de `./shared-acl`.
 */
export async function publishTestOrganizationsInTransaction(
  client: { query(text: string, values?: unknown[]): Promise<unknown> },
  ids: readonly string[]
): Promise<void> {
  const role = 'test_site_publish_' + randomUUID().replaceAll('-', '')
  await alterSharedAclInTransaction(client, [
    `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
    `GRANT USAGE ON SCHEMA public TO "${role}"`,
    `GRANT SELECT, UPDATE ON organizations TO "${role}"`,
  ])
  await client.query(`SET LOCAL ROLE "${role}"`)
  await client.query(`SELECT set_config('app.platform_scope','on',true)`)
  await client.query(
    `UPDATE organizations SET access = 'FULL', "sitePublishedAt" = $2, "siteIndexable" = true WHERE id = ANY($1::text[])`,
    [[...ids], LIVE_SITE.sitePublishedAt]
  )
  await client.query(`SELECT set_config('app.platform_scope','',true)`)
  await client.query('RESET ROLE')
  await alterSharedAclInTransaction(client, [
    `DROP OWNED BY "${role}"`,
    `DROP ROLE "${role}"`,
  ])
}
