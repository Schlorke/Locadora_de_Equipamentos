import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Pool } from 'pg'
import type { ApiParityContext } from './global-setup'
import { parityTargets } from './targets'

const context: ApiParityContext = inject('apiParity')
const edge = (slug: string, auth = context.secret) => ({
  'x-platform-edge-auth': auth,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
async function snapshot(
  origin: string,
  suffix: string,
  headers: Record<string, string> = {},
  method = 'GET'
) {
  const response = await fetch(origin + '/api/categories' + suffix, {
    headers,
    method,
  })
  return {
    status: response.status,
    body: await response.text(),
    headers: Object.fromEntries(
      [
        'content-type',
        'cache-control',
        'vary',
        'cdn-cache-control',
        'allow',
        'set-cookie',
      ].map((key) => [key, response.headers.get(key)])
    ),
  }
}

const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const run = context.alfa.id.slice('api-alfa-'.length)
/** Categoria pública da fixture com a contagem de equipamentos (global-setup.ts). */
const categoryRow = (tenant: 'alfa' | 'bravo') => ({
  id: context[tenant].categoryId,
  name: tenant === 'alfa' ? 'Andaimes' : 'Betoneiras',
  description: null,
  icon: null,
  iconColor: '#ea580c',
  bgColor: '#fff7ed',
  fontColor: '#7c2d12',
  slug: `cat-${tenant}-${run}`,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  placement: null,
  customIcon: null,
  _count: { equipments: context[tenant].equipmentIds.length },
})
const ERRORS: Record<number, unknown> = {
  409: { error: 'Selecione uma locadora' },
  404: { error: 'Locadora não encontrada' },
  400: { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
}
/** Resposta completa esperada (corpo já interpretado), montada da fixture (onda 135, B2). */
function expectedSnapshot(
  status: number,
  tenant: 'alfa' | 'bravo',
  host: boolean
) {
  return {
    status,
    body: status === 200 ? [categoryRow(tenant)] : ERRORS[status],
    headers: {
      'content-type': 'application/json',
      'cache-control':
        status !== 200
          ? 'no-store'
          : host
            ? 'public, max-age=60'
            : 'public, max-age=60, stale-while-revalidate=300',
      vary: host ? `${frameworkVary}, Host` : frameworkVary,
      'cdn-cache-control': null,
      allow: null,
      'set-cookie': null,
    },
  }
}

describe('categorias: contrato HTTP explícito em cada host', () => {
  it.each([
    ['sem seleção', '', {}, 409],
    ['slug inválido', '?tenantSlug=Bad_Slug', {}, 404],
    ['reservado', '?tenantSlug=api', {}, 404],
    ['desconhecido', '?tenantSlug=unknown', {}, 404],
    ['suspenso', `?tenantSlug=${context.suspended}`, {}, 404],
    [
      'conflito na query',
      `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`,
      {},
      400,
    ],
    ['host sem query', '', edge(context.alfa.slug), 200],
    [
      'conflito com host',
      `?tenantSlug=${context.bravo.slug}`,
      edge(context.alfa.slug),
      400,
    ],
    ['borda forjada', '', edge(context.alfa.slug, 'wrong-secret'), 409],
    ['mobile alfa', `?tenantSlug=${context.alfa.slug}`, {}, 200],
    ['mobile bravo', `?tenantSlug=${context.bravo.slug}`, {}, 200],
    [
      'cookie não seleciona público',
      '',
      { cookie: `selected-tenant-id=${context.alfa.id}` },
      409,
    ],
  ] as const)('%s', async (_name, query, headers, status) => {
    const tenant = query.includes(context.bravo.slug) ? 'bravo' : 'alfa'
    const host =
      'x-platform-edge-auth' in headers &&
      headers['x-platform-edge-auth'] === context.secret
    for (const origin of parityTargets(context)) {
      const current = await snapshot(origin, query, headers)
      expect({ ...current, body: JSON.parse(current.body) }).toEqual(
        expectedSnapshot(status, tenant, host && status === 200)
      )
    }
  })
  it.each(['HEAD', 'OPTIONS', 'POST'])(
    'preserva o método %s do Next',
    async (method) => {
      const head = expectedSnapshot(200, 'alfa', false)
      const framework = {
        'content-type': null,
        'cache-control': null,
        vary: frameworkVary,
        'cdn-cache-control': null,
        allow: method === 'OPTIONS' ? 'GET, HEAD, OPTIONS' : null,
        'set-cookie': null,
      }
      for (const origin of parityTargets(context))
        expect(
          await snapshot(origin, `?tenantSlug=${context.alfa.slug}`, {}, method)
        ).toEqual(
          method === 'HEAD'
            ? { status: 200, body: '', headers: head.headers }
            : {
                status: method === 'OPTIONS' ? 204 : 405,
                body: '',
                headers: framework,
              }
        )
    }
  )
  it('cada host serve a sessão anônima pelo motor de identidade instalado', async () => {
    const endpoint =
      context.identity.mode === 'legacy'
        ? '/api/auth/session'
        : '/api/auth/get-session'
    for (const origin of parityTargets(context)) {
      const response = await fetch(origin + endpoint, { redirect: 'manual' })
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      // Sessão anônima: o NextAuth responde objeto vazio e o Better Auth, null.
      expect(await response.json()).toEqual(
        context.identity.mode === 'legacy' ? {} : null
      )
    }
  })
  it('health preserva o envelope sem cookies', async () => {
    for (const origin of parityTargets(context)) {
      const response = await fetch(origin + '/api/health')
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(await response.json()).toEqual({
        status: 'healthy',
        database: 'connected',
        timestamp: expect.any(String),
      })
    }
  })
})

describe('o banco aplica RLS, além do filtro da aplicação', () => {
  const pool = new Pool({ connectionString: context.runtimeUrl, max: 1 })
  beforeAll(async () => {
    const { rows } = await pool.query(
      "SELECT r.rolsuper, r.rolbypassrls, c.relforcerowsecurity, pg_get_userbyid(c.relowner) = current_user AS owner FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname = current_user AND c.oid = 'categories'::regclass"
    )
    expect(rows).toEqual([
      {
        rolsuper: false,
        rolbypassrls: false,
        relforcerowsecurity: true,
        owner: false,
      },
    ])
  })
  afterAll(() => pool.end())
  it('sem contexto não lê categorias', async () => {
    expect((await pool.query('SELECT id FROM categories')).rows).toEqual([])
  })
  it.each(['alfa', 'bravo'] as const)(
    'contexto %s não lê a outra locadora mesmo sem WHERE',
    async (tenant) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [
          context[tenant].id,
        ])
        expect((await client.query('SELECT id FROM categories')).rows).toEqual([
          { id: context[tenant].categoryId },
        ])
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }
  )
})
