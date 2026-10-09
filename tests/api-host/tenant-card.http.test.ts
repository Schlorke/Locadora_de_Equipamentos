import { describe, expect, inject, it } from 'vitest'
import { namedParityTargets, parityTargets } from './targets'

const context = inject('apiParity')
const edge = (kind: 'tenant' | 'app' | 'apex', slug = context.alfa.slug) => ({
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': kind,
  ...(kind === 'tenant' ? { 'x-platform-tenant-slug': slug } : {}),
  'x-platform-origin': `https://${kind === 'tenant' ? `${slug}.` : kind === 'app' ? 'app.' : ''}platform.test`,
})
async function read(
  origin: string,
  slug: string,
  query = '',
  headers: Record<string, string> = {},
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/public/tenants/${slug}${query}`, {
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

describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'serviço' })
)('%s — cartão público', (_host, origin) => {
  it.each(['alfa', 'bravo'] as const)(
    'cartão %s publica somente os cinco campos e o logo da própria locadora',
    async (name) => {
      const response = await read(origin, context[name].slug)
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({
        slug: context[name].slug,
        name,
        city: null,
        state: null,
        logoUrl: `https://assets.example.test/${name}-logo.svg`,
      })
      expect(response.body).not.toContain('fixture-private')
      expect(response.headers['cache-control']).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
      expect(response.headers['set-cookie']).toBeNull()
    }
  )
  it('locadora sem configuração mantém cartão com logo null', async () => {
    const response = await read(origin, context.unconfigured)
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      slug: context.unconfigured,
      name: 'unconfigured',
      city: null,
      state: null,
      logoUrl: null,
    })
  })
  it.each(['missing', 'api', 'invalid--slug', context.suspended])(
    'slug %s mantém o mesmo 404 neutro',
    async (slug) => {
      const response = await read(origin, slug)
      expect(response.status).toBe(404)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Locadora não encontrada',
      })
      expect(response.headers['cache-control']).toBe('no-store')
    }
  )
  it.each(['tenant', 'app', 'apex'] as const)(
    'borda %s conserva o contrato de cache',
    async (kind) => {
      const response = await read(origin, context.alfa.slug, '', edge(kind))
      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe(
        kind === 'tenant'
          ? 'public, max-age=60'
          : 'public, max-age=60, stale-while-revalidate=300'
      )
      expect(response.headers['cdn-cache-control']).toBeNull()
      if (kind === 'tenant')
        expect(response.headers.vary).toBe(
          'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Host'
        )
    }
  )
  it.each([
    {
      label: 'caminho-versus-borda-assinada',
      slug: context.bravo.slug,
      query: '',
      headers: edge('tenant'),
    },
    {
      label: 'caminho-versus-query',
      slug: context.alfa.slug,
      query: `?tenantSlug=${context.bravo.slug}`,
      headers: {},
    },
    {
      label: 'queries-divergentes',
      slug: context.alfa.slug,
      query: `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`,
      headers: {},
    },
  ] as const)(
    'candidatas conflitantes ($label) recusam antes do cartão',
    async ({ slug, query, headers }) => {
      const response = await read(origin, slug, query, headers)
      expect(response.status).toBe(400)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Seleção de locadora conflitante',
        code: 'TENANT_CONFLICT',
      })
      expect(response.headers['cache-control']).toBe('no-store')
    }
  )
  it('borda forjada não suplanta o slug do caminho', async () => {
    const response = await read(origin, context.bravo.slug, '', {
      ...edge('tenant'),
      'x-platform-edge-auth': 'invalid-local-secret',
    })
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body).slug).toBe(context.bravo.slug)
  })
  it.each(['HEAD', 'OPTIONS', 'POST'])(
    'conserva o método %s',
    async (method) => {
      const response = await read(origin, context.alfa.slug, '', {}, method)
      expect(response.status).toBe(
        method === 'HEAD' ? 200 : method === 'OPTIONS' ? 204 : 405
      )
      expect(response.body).toBe('')
      if (method === 'OPTIONS')
        expect(response.headers.allow).toBe('GET, HEAD, OPTIONS')
    }
  )
})

const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const card = (name: 'alfa' | 'bravo') =>
  JSON.stringify({
    slug: context[name].slug,
    name,
    city: null,
    state: null,
    logoUrl: `https://assets.example.test/${name}-logo.svg`,
  })
const json = 'application/json'
const shared = 'public, max-age=60, stale-while-revalidate=300'
const neutral404 = {
  status: 404,
  body: JSON.stringify({ error: 'Locadora não encontrada' }),
  headers: {
    'content-type': json,
    'cache-control': 'no-store',
    vary: frameworkVary,
    'cdn-cache-control': null,
    allow: null,
    'set-cookie': null,
  },
}
const conflict = {
  status: 400,
  body: JSON.stringify({
    error: 'Seleção de locadora conflitante',
    code: 'TENANT_CONFLICT',
  }),
  headers: { ...neutral404.headers },
}
const ok = (body: string, cache = shared, vary = frameworkVary) => ({
  status: 200,
  body,
  headers: {
    'content-type': json,
    'cache-control': cache,
    vary,
    'cdn-cache-control': null,
    allow: null,
    'set-cookie': null,
  },
})
/** Resposta completa esperada de cada caso, montada da fixture (onda 135, B2): a mesma em cada host da rodada. */
const expected: Record<string, unknown> = {
  alfa: ok(card('alfa')),
  bravo: ok(card('bravo')),
  'sem logo': ok(
    JSON.stringify({
      slug: context.unconfigured,
      name: 'unconfigured',
      city: null,
      state: null,
      logoUrl: null,
    })
  ),
  ausente: neutral404,
  reservado: neutral404,
  suspenso: neutral404,
  'host tenant': ok(
    card('alfa'),
    'public, max-age=60',
    `${frameworkVary}, Host`
  ),
  'host app': ok(card('alfa')),
  apex: ok(card('alfa')),
  'conflito de host': conflict,
  'conflito de query': conflict,
  'borda forjada': ok(card('bravo')),
  HEAD: { ...ok(''), headers: { ...ok('').headers } },
  OPTIONS: {
    status: 204,
    body: '',
    headers: {
      'content-type': null,
      'cache-control': null,
      vary: frameworkVary,
      'cdn-cache-control': null,
      allow: 'GET, HEAD, OPTIONS',
      'set-cookie': null,
    },
  },
  POST: {
    status: 405,
    body: '',
    headers: {
      'content-type': null,
      'cache-control': null,
      vary: frameworkVary,
      'cdn-cache-control': null,
      allow: null,
      'set-cookie': null,
    },
  },
}

describe('contrato HTTP explícito — cartão público', () => {
  it.each([
    ['alfa', context.alfa.slug, '', {}, 'GET'],
    ['bravo', context.bravo.slug, '', {}, 'GET'],
    ['sem logo', context.unconfigured, '', {}, 'GET'],
    ['ausente', 'missing', '', {}, 'GET'],
    ['reservado', 'api', '', {}, 'GET'],
    ['suspenso', context.suspended, '', {}, 'GET'],
    ['host tenant', context.alfa.slug, '', edge('tenant'), 'GET'],
    ['host app', context.alfa.slug, '', edge('app'), 'GET'],
    ['apex', context.alfa.slug, '', edge('apex'), 'GET'],
    ['conflito de host', context.bravo.slug, '', edge('tenant'), 'GET'],
    [
      'conflito de query',
      context.alfa.slug,
      `?tenantSlug=${context.bravo.slug}`,
      {},
      'GET',
    ],
    [
      'borda forjada',
      context.bravo.slug,
      '',
      { ...edge('tenant'), 'x-platform-edge-auth': 'invalid-local-secret' },
      'GET',
    ],
    ['HEAD', context.alfa.slug, '', {}, 'HEAD'],
    ['OPTIONS', context.alfa.slug, '', {}, 'OPTIONS'],
    ['POST', context.alfa.slug, '', {}, 'POST'],
  ] as const)(
    '%s: status, corpo e headers esperados em cada host',
    async (name, slug, query, headers, method) => {
      for (const origin of parityTargets(context))
        expect(await read(origin, slug, query, headers, method)).toEqual(
          expected[name]
        )
    }
  )
})
