// Onda 134 (lote vitrine-conteúdo): a leitura pública do texto legal (`getPublicLegalDocument`) e do conteúdo
// institucional (`getPublicSettings`) com um papel restrito de verdade (NOSUPERUSER, NOBYPASSRLS) sob a RLS FORCE de
// "settings": cada locadora lê só o próprio documento, e só dentro da transação dela (`app.tenant_id` local). Sem a
// transação, a RLS esconde até o documento da própria locadora; com o contexto de outra, vem o da outra.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import type { PrismaClient } from '@prisma/client'
import { createPublicCatalog } from '../../packages/backend/src/modules/catalog/public'
import { requireTestDatabase } from '../helpers/test-database'
import { createLoginRole } from '../helpers/database-roles'
import { alterSharedAcl } from '../helpers/shared-acl'

const documento = (nome: string) => ({
  version: 1,
  lastUpdated: '19 de janeiro de 2026',
  intro: `Termos da ${nome}.`,
  sections: [
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: `Fale com a ${nome}.` }],
      contactCard: true,
    },
  ],
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'textos legais e conteúdo da vitrine sob a RLS de settings (papel restrito)',
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const role = 'w134_legal_rls_' + suffix
    const alfa = randomUUID()
    const bravo = randomUUID()
    let admin: Pool
    let restricted: { pool: Pool; prisma: PrismaClient }

    beforeAll(async () => {
      const connectionString = requireTestDatabase(process.env)
      const { Pool } = await import('pg')
      const { PrismaPg } = await import('@prisma/adapter-pg')
      const { PrismaClient } = await import('@prisma/client')
      admin = new Pool({ connectionString, max: 2 })
      for (const [id, nome] of [
        [alfa, 'Locadora Alfa'],
        [bravo, 'Locadora Bravo'],
      ] as const) {
        await admin.query(
          'INSERT INTO organizations (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())',
          [id, 'w134-rls-' + id.slice(0, 8), nome]
        )
        await admin.query(
          `INSERT INTO settings (id, "tenantId", "updatedAt", "siteContent", "termsDocument", "termsPublishedAt")
           VALUES ($1, $2, now(), $3::jsonb, $4::jsonb, now())`,
          [
            randomUUID(),
            id,
            JSON.stringify({ featuredClients: [`Cliente da ${nome}`] }),
            JSON.stringify(documento(nome)),
          ]
        )
      }
      const url = await createLoginRole(
        admin,
        connectionString,
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      await alterSharedAcl(admin, [
        `GRANT USAGE ON SCHEMA public TO "${role}"`,
        `GRANT SELECT ON "settings", "organizations" TO "${role}"`,
      ])
      const pool = new Pool({ connectionString: url, max: 1 })
      restricted = {
        pool,
        prisma: new PrismaClient({ adapter: new PrismaPg(pool) }),
      }
    })

    afterAll(async () => {
      await restricted?.prisma.$disconnect()
      await restricted?.pool.end()
      if (admin) {
        await admin
          .query('DELETE FROM settings WHERE "tenantId" = ANY($1)', [
            [alfa, bravo],
          ])
          .catch(() => undefined)
        await admin
          .query('DELETE FROM organizations WHERE id = ANY($1)', [
            [alfa, bravo],
          ])
          .catch(() => undefined)
        await alterSharedAcl(admin, [
          `REVOKE ALL ON "settings", "organizations" FROM "${role}"`,
          `REVOKE USAGE ON SCHEMA public FROM "${role}"`,
          `DROP ROLE IF EXISTS "${role}"`,
        ]).catch(() => undefined)
        await admin.end()
      }
    })

    it('o papel é restrito e a tabela tem RLS FORCE (sem contexto, nenhuma linha)', async () => {
      const { rows } = await restricted.pool.query(
        `SELECT r.rolsuper, r.rolbypassrls, c.relforcerowsecurity
           FROM pg_roles r CROSS JOIN pg_class c
          WHERE r.rolname = current_user AND c.oid = 'settings'::regclass`
      )
      expect(rows).toEqual([
        { rolsuper: false, rolbypassrls: false, relforcerowsecurity: true },
      ])
      expect(
        (await restricted.pool.query('SELECT id FROM settings')).rows
      ).toEqual([])
    })

    it('cada locadora lê só o próprio texto legal, na própria transação', async () => {
      const catalog = createPublicCatalog(restricted.prisma)
      const lidoAlfa = await catalog.getPublicLegalDocument(
        { tenantId: alfa },
        'terms'
      )
      expect(lidoAlfa?.document).toEqual(documento('Locadora Alfa'))
      const lidoBravo = await catalog.getPublicLegalDocument(
        { tenantId: bravo },
        'terms'
      )
      expect(lidoBravo?.document).toEqual(documento('Locadora Bravo'))
      expect(JSON.stringify(lidoBravo)).not.toContain('Alfa')
      expect(
        await catalog.getPublicLegalDocument({ tenantId: alfa }, 'privacy')
      ).toBeNull()
    })

    it('o conteúdo institucional e a disponibilidade vêm da própria locadora', async () => {
      const catalog = createPublicCatalog(restricted.prisma)
      const alfaSettings = await catalog.getPublicSettings({ tenantId: alfa })
      expect(alfaSettings?.siteContent).toEqual({
        featuredClients: ['Cliente da Locadora Alfa'],
      })
      expect(alfaSettings?.legalDocuments).toEqual({
        terms: true,
        privacy: false,
        returnPolicy: false,
      })
      const bravoSettings = await catalog.getPublicSettings({ tenantId: bravo })
      expect(JSON.stringify(bravoSettings)).not.toContain('Alfa')
    })
  }
)
