// Onda 134 (lote vitrine-conteúdo), migration 202610060201_settings_site_content_legal: as colunas do conteúdo
// institucional e dos textos legais em "settings" e os CHECK de forma, de consistência (documento e data da publicação
// juntos) e de tamanho. O tamanho é medido por octet_length(::text), determinístico: um documento grande e muito
// compressível também é recusado, o que pg_column_size (depois da compressão) deixaria passar. Tudo numa transação
// desfeita no fim: nenhuma linha fica no banco descartável.
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'

const DOCUMENTS = ['terms', 'privacy', 'returnPolicy'] as const

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'settings: colunas do conteúdo institucional e dos textos legais (banco descartável)',
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
        [tenantId, 'w134-colunas-' + tenantId.slice(0, 8), 'Locadora Nova']
      )
      await client.query(
        'INSERT INTO settings (id, "tenantId", "updatedAt") VALUES ($1, $2, now())',
        [settingId, tenantId]
      )
    })

    afterAll(async () => {
      await client?.query('ROLLBACK').catch(() => undefined)
      client?.release()
      await pool?.end()
    })

    /** Roda a escrita num savepoint e devolve o nome do CHECK que a recusou (ou `null` se passou). */
    async function violation(sql: string, values: unknown[] = []) {
      await client.query('SAVEPOINT tentativa')
      try {
        await client.query(sql, values)
        await client.query('RELEASE SAVEPOINT tentativa')
        return null
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT tentativa')
        const { code, constraint } = error as {
          code?: string
          constraint?: string
        }
        expect(code).toBe('23514')
        return constraint ?? 'sem-nome'
      }
    }
    const update = (set: string, values: unknown[] = []) =>
      violation(`UPDATE settings SET ${set} WHERE id = $${values.length + 1}`, [
        ...values,
        settingId,
      ])

    it('as colunas existem com o tipo e o padrão esperados', async () => {
      const { rows } = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'settings'
            AND (column_name = 'siteContent' OR column_name LIKE '%Document' OR column_name LIKE '%PublishedAt')
          ORDER BY column_name`
      )
      expect(rows).toEqual(
        [
          ['privacyDocument', 'jsonb', 'YES', null],
          ['privacyPublishedAt', 'timestamp without time zone', 'YES', null],
          ['returnPolicyDocument', 'jsonb', 'YES', null],
          [
            'returnPolicyPublishedAt',
            'timestamp without time zone',
            'YES',
            null,
          ],
          ['siteContent', 'jsonb', 'NO', "'{}'::jsonb"],
          ['termsDocument', 'jsonb', 'YES', null],
          ['termsPublishedAt', 'timestamp without time zone', 'YES', null],
        ].map(([column_name, data_type, is_nullable, column_default]) => ({
          column_name,
          data_type,
          is_nullable,
          column_default,
        }))
      )
      const { rows: linha } = await client.query(
        'SELECT "siteContent", "termsDocument", "termsPublishedAt" FROM settings WHERE id = $1',
        [settingId]
      )
      expect(linha).toEqual([
        { siteContent: {}, termsDocument: null, termsPublishedAt: null },
      ])
    })

    it('siteContent: só objeto e no máximo 65.536 bytes', async () => {
      expect(await update(`"siteContent" = '[]'::jsonb`)).toBe(
        'settings_site_content_object'
      )
      expect(await update(`"siteContent" = '"texto"'::jsonb`)).toBe(
        'settings_site_content_object'
      )
      expect(
        await update(
          `"siteContent" = jsonb_build_object('history', $1::text)`,
          ['x'.repeat(65_536)]
        )
      ).toBe('settings_site_content_size')
      expect(
        await update(
          `"siteContent" = jsonb_build_object('history', $1::text)`,
          ['x'.repeat(1500)]
        )
      ).toBeNull()
    })

    it.each(DOCUMENTS)(
      '%s: documento e data da publicação sempre juntos, só objeto',
      async (kind) => {
        const doc = `"${kind}Document"`
        const at = `"${kind}PublishedAt"`
        expect(await update(`${doc} = '{"version":1}'::jsonb`)).toMatch(
          /_published$/
        )
        expect(await update(`${at} = now()`)).toMatch(/_published$/)
        expect(await update(`${doc} = '[]'::jsonb, ${at} = now()`)).toMatch(
          /_object$/
        )
        expect(
          await update(`${doc} = '{"version":1}'::jsonb, ${at} = now()`)
        ).toBeNull()
        expect(await update(`${doc} = NULL, ${at} = NULL`)).toBeNull()
      }
    )

    it.each(DOCUMENTS)(
      '%s: teto de 262.144 bytes do texto, inclusive para um documento muito compressível',
      async (kind) => {
        const doc = `"${kind}Document"`
        const at = `"${kind}PublishedAt"`
        // 300 mil caracteres repetidos: o pg_column_size comprimido fica em poucos kB; o octet_length do texto não.
        const repetido = 'a'.repeat(300_000)
        // Gravado numa tabela temporária, o valor passa pela compressão do TOAST, como na coluna de verdade.
        await client.query(
          'CREATE TEMP TABLE IF NOT EXISTS compressao (doc jsonb) ON COMMIT DROP'
        )
        await client.query('TRUNCATE compressao')
        await client.query(
          `INSERT INTO compressao VALUES (jsonb_build_object('intro', $1::text))`,
          [repetido]
        )
        const { rows } = await client.query(
          'SELECT pg_column_size(doc) AS comprimido, octet_length(doc::text) AS texto FROM compressao'
        )
        expect(Number(rows[0].comprimido)).toBeLessThan(262_144)
        expect(Number(rows[0].texto)).toBeGreaterThan(262_144)
        expect(
          await update(
            `${doc} = jsonb_build_object('intro', $1::text), ${at} = now()`,
            [repetido]
          )
        ).toMatch(/_size$/)
        expect(
          await update(
            `${doc} = jsonb_build_object('intro', $1::text), ${at} = now()`,
            ['a'.repeat(250_000)]
          )
        ).toBeNull()
        await update(`${doc} = NULL, ${at} = NULL`)
      }
    )

    it('RLS FORCE de settings intacta e nenhum grant por coluna nas colunas novas', async () => {
      const { rows } = await client.query(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'settings'::regclass`
      )
      expect(rows).toEqual([
        { relrowsecurity: true, relforcerowsecurity: true },
      ])
      const { rows: acl } = await client.query(
        `SELECT attname, attacl FROM pg_attribute
          WHERE attrelid = 'settings'::regclass
            AND attname IN ('siteContent','termsDocument','termsPublishedAt','privacyDocument','privacyPublishedAt',
                            'returnPolicyDocument','returnPolicyPublishedAt')
          ORDER BY attname`
      )
      expect(acl).toHaveLength(7)
      for (const column of acl) expect(column.attacl, column.attname).toBeNull()
    })
  }
)
