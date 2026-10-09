/**
 * T5 e T6 da ADR docs/architecture/adr-tenant-hosts.md (seção 4.13): hosts de locadora contra o host web real.
 *
 * Exige os servidores no ar (não sobe nada sozinho), sem a raiz legada (onda 135, B7):
 *   - API compartilhada compilada (`pnpm build:api`, `node apps/services/api/.next/standalone/apps/services/api/server.js`
 *     com cwd em apps/services/api) com DATABASE_URL = banco descartável e o mesmo PLATFORM_EDGE_SECRET do host web;
 *   - host web em `next start` (apps/clients/web) com PLATFORM_ENV=development, PLATFORM_ROOT_DOMAIN=localhost,
 *     PLATFORM_PUBLIC_PORT=<porta do web> e WEB_API_ORIGIN=<origem da API>.
 * As jornadas no navegador (J1–J7) ficam em tests/e2e/journeys.spec.ts, sobre os mesmos dois hosts.
 * Rodar:
 *   TENANT_HOSTS_E2E=1 TENANT_HOSTS_E2E_ORIGIN=http://127.0.0.1:<porta do web> \
 *   TEST_DATABASE_URL=postgresql://.../<nome>_test TEST_DATABASE_DISPOSABLE=true \
 *   pnpm exec vitest run --config vitest.web.config.ts tests/e2e/tenant-hosts.spec.ts
 *
 * O spec cria duas locadoras com marcadores próprios (e uma suspensa) no banco descartável e apaga só o que criou.
 * Os hosts `*.localhost` resolvem para o loopback no Chromium; nas requisições HTTP o Host vai explícito.
 */
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const enabled = process.env.TENANT_HOSTS_E2E === '1'
const web = new URL(process.env.TENANT_HOSTS_E2E_ORIGIN ?? 'http://127.0.0.1:3191')
const root = process.env.TENANT_HOSTS_E2E_ROOT ?? 'localhost'
const port = web.port
const run = randomBytes(3).toString('hex')

const A = { id: `e2e-org-alfa-${run}`, slug: `e2e-alfa-${run}`, marker: `MARCADOR-ALFA-${run}`, equipment: `e2e-eq-alfa-${run}`, equipmentName: `Betoneira ALFA ${run}` }
const B = { id: `e2e-org-beta-${run}`, slug: `e2e-beta-${run}`, marker: `MARCADOR-BETA-${run}`, equipment: `e2e-eq-beta-${run}`, equipmentName: `Martelete BETA ${run}` }
const SUSPENDED = { id: `e2e-org-susp-${run}`, slug: `e2e-susp-${run}` }
const host = (label: string | null) => `${label ? label + '.' : ''}${root}:${port}`

interface Hit {
  readonly status: number
  readonly headers: http.IncomingHttpHeaders
  readonly body: string
}

function hit(hostHeader: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Hit> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: web.hostname, port: web.port, path, method: init.method ?? 'GET', headers: { host: hostHeader, ...init.headers } },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }))
      }
    )
    request.on('error', reject)
    if (init.body) request.write(init.body)
    request.end()
  })
}

type Pool = import('pg').Pool
let pool: Pool | undefined

async function seed(db: Pool) {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const [tenant, status, city] of [[A, 'ACTIVE', 'Porto Alegre'], [B, 'ACTIVE', 'Canoas'], [SUSPENDED, 'SUSPENDED', null]] as const) {
      await client.query(
        `INSERT INTO organizations (id, slug, name, status, "updatedAt", city, state) VALUES ($1, $2, $3, $4, now(), $5, $6)`,
        [tenant.id, tenant.slug, 'Locadora ' + tenant.slug, status, city, city ? 'RS' : null]
      )
    }
    // Locadoras vivas, como as que a migration 0104 publicou (S13): a vitrine pública só responde publicada.
    const { publishTestOrganizationsInTransaction } = await import('../helpers/public-site')
    await publishTestOrganizationsInTransaction(client, [A.id, B.id, SUSPENDED.id])
    for (const tenant of [A, B]) {
      // Cada locadora roda na própria transação lógica de tenant (RLS FORCE com app.tenant_id).
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenant.id])
      await client.query(
        `INSERT INTO settings (id, "tenantId", "aboutUsText", "companyPhone", "updatedAt") VALUES ($1, $2, $3, $4, now())`,
        [tenant.id + '-settings', tenant.id, tenant.marker, '51 3000-0000']
      )
      const category = await client.query<{ id: string }>(
        `INSERT INTO categories (id, "tenantId", name, slug, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, now()) RETURNING id`,
        [tenant.id, 'Categoria ' + tenant.marker, 'categoria-' + tenant.slug]
      )
      await client.query(
        `INSERT INTO equipments (id, "tenantId", name, description, "pricePerDay", images, "categoryId", "updatedAt")
         VALUES ($1, $2, $3, $4, 100, ARRAY['https://example.com/e2e.png'], $5, now())`,
        [tenant.equipment, tenant.id, tenant.equipmentName, tenant.marker, category.rows[0]!.id]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function cleanup(db: Pool) {
  const ids = [A.id, B.id, SUSPENDED.id]
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const tenantId of ids) {
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId])
      await client.query(`DELETE FROM equipments WHERE "tenantId" = $1`, [tenantId])
      await client.query(`DELETE FROM categories WHERE "tenantId" = $1`, [tenantId])
      await client.query(`DELETE FROM settings WHERE "tenantId" = $1`, [tenantId])
    }
    await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [ids])
    await client.query('COMMIT')
  } finally {
    client.release()
  }
}

describe.skipIf(!enabled)('T5/T6: hosts de locadora no host web em execução', () => {
  beforeAll(async () => {
    const { requireTestDatabase } = await import('../helpers/test-database')
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: requireTestDatabase(process.env), max: 2 })
    await seed(pool)
  })

  afterAll(async () => {
    if (pool) {
      await cleanup(pool)
      await pool.end()
    }
  })

  describe('T5: roteamento HTTP em *.localhost', () => {
    it('segmento de outra locadora, /plataforma no host de locadora e locadora no apex dão 404', async () => {
      expect((await hit(host(A.slug), `/${B.slug}/equipamentos`)).status).toBe(404)
      expect((await hit(host(A.slug), '/b/equipamentos')).status).toBe(404)
      expect((await hit(host(A.slug), '/plataforma')).status).toBe(404)
      expect((await hit(host(null), `/${A.slug}/equipamentos`)).status).toBe(404)
    })

    it('/admin no host de locadora vai para o painel no host app', async () => {
      const response = await hit(host(A.slug), '/admin/orcamentos')
      expect(response.status).toBe(308)
      expect(response.headers.location).toBe(`http://${host('app')}/admin/orcamentos?locadora=${A.slug}`)
    })

    it('/api/equipamentos/search no host A chega ao backend e só devolve A (V1)', async () => {
      const response = await hit(host(A.slug), '/api/equipamentos/search?q=' + encodeURIComponent(run))
      expect(response.status).toBe(200)
      expect(response.body).toContain(A.equipmentName)
      expect(response.body).not.toContain(B.equipmentName)
      expect((await hit(host(A.slug), `/api/equipamentos/search?q=${run}&tenantSlug=${B.slug}`)).status).toBe(400)
    })
  })

  describe('T6: duas locadoras não se misturam', () => {
    it('home, catálogo e configurações de A não trazem B (e vice-versa)', async () => {
      const homeA = await hit(host(A.slug), '/')
      expect(homeA.status).toBe(200)
      expect(homeA.body).toContain(A.marker)
      expect(homeA.body).not.toContain(B.marker)
      const homeB = await hit(host(B.slug), '/')
      expect(homeB.body).toContain(B.marker)
      expect(homeB.body).not.toContain(A.marker)
      const settingsA = await hit(host(A.slug), '/api/settings/public')
      expect(JSON.parse(settingsA.body).aboutUsText).toBe(A.marker)
      const catalogA = await hit(host(A.slug), '/api/equipments')
      expect(catalogA.body).toContain(A.equipment)
      expect(catalogA.body).not.toContain(B.equipment)
      // Borda validada pelo backend: política de cache do host de locadora (D11/4.5).
      expect(catalogA.headers['cache-control']).toBe('public, max-age=60')
    })

    it('detalhe: o equipamento de A abre; o de B no host A dá 404', async () => {
      const own = await hit(host(A.slug), `/equipamentos/${A.equipment}`)
      expect(own.status).toBe(200)
      expect(own.body).toContain(A.equipmentName)
      const other = await hit(host(A.slug), `/equipamentos/${B.equipment}`)
      expect(other.status).toBe(404)
      expect(other.body).not.toContain(B.equipmentName)
    })

    it('locadora suspensa e inexistente: o mesmo 404 neutro', async () => {
      const suspended = await hit(host(SUSPENDED.slug), '/')
      const unknown = await hit(host(`e2e-nada-${run}`), '/')
      expect(suspended.status).toBe(404)
      expect(unknown.status).toBe(404)
      const normalize = (value: Hit, slug: string) => value.body.split(slug).join('SLUG')
      expect(normalize(suspended, SUSPENDED.slug)).toBe(normalize(unknown, `e2e-nada-${run}`))
      expect(suspended.body).not.toContain('Locadora ' + SUSPENDED.slug)
    })

    it('no navegador: catálogo de A sem B, nenhum href com tenantSlug= e nenhum aviso de hidratação', async () => {
      const { chromium } = await import('playwright')
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        const problems: string[] = []
        page.on('console', (message) => {
          if (/hydrat|did not match|server rendered HTML/i.test(message.text())) problems.push(message.text())
        })
        page.on('pageerror', (error) => problems.push(String(error)))
        await page.goto(`http://${host(A.slug)}/equipamentos`, { waitUntil: 'load' })
        await page.getByText(A.equipmentName).first().waitFor({ timeout: 30000 })
        const html = await page.content()
        expect(html).not.toContain(B.equipmentName)
        const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''))
        expect(hrefs.length).toBeGreaterThan(0)
        expect(hrefs.filter((href) => href.includes('tenantSlug='))).toEqual([])
        expect(hrefs.filter((href) => href.startsWith(`/${A.slug}`))).toEqual([])
        // Navegação no cliente (RSC pelo rewrite do proxy): o link do catálogo abre o detalhe com a URL visível.
        const detail = hrefs.find((href) => href === `/equipamentos/${A.equipment}`)
        expect(detail).toBeDefined()
        await page.locator(`a[href="/equipamentos/${A.equipment}"]`).first().click()
        await page.waitForURL(`http://${host(A.slug)}/equipamentos/${A.equipment}`, { timeout: 30000 })
        await page.getByRole('heading', { name: A.equipmentName }).first().waitFor({ timeout: 30000 })
        await page.goto(`http://${host(A.slug)}/equipamentos/${A.equipment}`, { waitUntil: 'load' })
        expect(await page.content()).toContain(A.equipmentName)
        await page.waitForTimeout(1500)
        expect(problems).toEqual([])
      } finally {
        await browser.close()
      }
    }, 120000)
  })
})
