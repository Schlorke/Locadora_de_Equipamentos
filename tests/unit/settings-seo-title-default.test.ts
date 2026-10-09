// Onda 135, A4 (SEO da vitrine por locadora), migration 202610080101_settings_seo_title_neutral_default: a leitura
// pública das configurações passou a expor o título SEO da locadora. O padrão antigo da coluna "seoTitle" trazia o nome
// da GB (raiz legada), e uma linha criada sem título daria à vitrine de outra locadora o título da GB (T12; achado 143).
// Com o padrão vazio, a leitura pública devolve null e a vitrine monta o título com o nome do cartão da própria locadora.
// Tudo numa transação desfeita no fim: nenhuma linha fica no banco descartável.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { publicSeoText } from '../../packages/backend/src/modules/catalog/public-settings'
import { requireTestDatabase } from '../helpers/test-database'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'settings: título SEO com padrão neutro (banco descartável)',
  () => {
    let pool: Pool
    let client: PoolClient
    const tenantId = randomUUID()
    const settingId = randomUUID()

    beforeAll(async () => {
      const { Pool } = await import('pg')
      pool = new Pool({
        connectionString: requireTestDatabase(process.env),
        max: 1,
      })
      client = await pool.connect()
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO organizations (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())',
        [tenantId, 'w135-seo-' + tenantId.slice(0, 8), 'Locadora Nova']
      )
    })

    afterAll(async () => {
      await client?.query('ROLLBACK').catch(() => undefined)
      client?.release()
      await pool?.end()
    })

    it('o padrão da coluna é vazio: nada da GB no catálogo do banco', async () => {
      const { rows } = await client.query<{ column_default: string | null }>(
        `SELECT column_default FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'settings' AND column_name = 'seoTitle'`
      )
      expect(rows).toHaveLength(1)
      expect(rows[0]!.column_default).toBe("''::text")
    })

    it('linha criada sem título fica com o título vazio, e a leitura pública devolve null', async () => {
      await client.query(
        'INSERT INTO settings (id, "tenantId", "updatedAt") VALUES ($1, $2, now())',
        [settingId, tenantId]
      )
      const { rows } = await client.query<{ seoTitle: string }>(
        'SELECT "seoTitle" FROM settings WHERE id = $1',
        [settingId]
      )
      expect(rows[0]!.seoTitle).toBe('')
      expect(publicSeoText(rows[0]!.seoTitle)).toBeNull()
    })
  }
)
