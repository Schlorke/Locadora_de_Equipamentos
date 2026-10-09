import { platformRateLimitDigest } from '../../packages/backend/src/modules/directory/rate-limit'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { Pool } from 'pg'
import { namedParityTargets, parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: context.runtimeUrl, max: 1 })
afterAll(() => pool.end())
const edge = (ip: string) => ({
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'apex',
  'x-platform-origin': 'https://platform.test',
  'x-platform-client-ip': ip,
})
const url = `?q=${encodeURIComponent(context.directory.marker)}`
async function read(origin: string, query: string, ip: string, method = 'GET') {
  const response = await fetch(`${origin}/api/public/tenants${query}`, {
    headers: edge(ip),
    method,
  })
  return {
    status: response.status,
    body: await response.text(),
    headers: Object.fromEntries(
      [
        'content-type',
        'cache-control',
        'retry-after',
        'vary',
        'allow',
        'set-cookie',
      ].map((key) => [key, response.headers.get(key)])
    ),
  }
}
async function keysFor(ip: string) {
  const digest = platformRateLimitDigest(
    context.directory.secret,
    'ip',
    ip.replace(/::1$/, '::/64')
  )
  return (
    await pool.query(
      'SELECT key, count FROM platform_rate_limits WHERE key LIKE $1',
      [`directory-search:ip:${digest}:%`]
    )
  ).rows
}

// Cada host usa a sua faixa de IPs da rodada (a janela de busca é por IP): a raiz 0–7, a API 8–15.
describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'serviço' }).map(
    ([label, origin]) => [label, origin, label === 'legado' ? 0 : 8] as const
  )
)('%s — diretório público', (_host, origin, base) => {
  it.each([
    '',
    '?q=ab',
    '?q=abc&q=def',
    '?q=abc&page=1',
    '?q=%00%00%00',
    `?q=${'x'.repeat(81)}`,
  ])('query inválida %s recusa sem consumir janela', async (query) => {
    const ip = context.directory.ips[base]!
    const response = await read(origin, query, ip)
    expect(response.status).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Informe apenas q, com 3 a 80 caracteres.',
      code: 'INVALID_QUERY',
    })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(await keysFor(ip)).toEqual([])
  })
  it('no máximo dez locadoras ACTIVE com opt-in, ordenadas e sem dados de contato', async () => {
    const response = await read(origin, url, context.directory.ips[base + 1]!)
    expect(response.status).toBe(200)
    const results = JSON.parse(response.body).results
    expect(results).toHaveLength(10)
    expect(results.map((row: { name: string }) => row.name)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) =>
          `${context.directory.marker} ${String(index).padStart(2, '0')}`
      )
    )
    for (const row of results)
      expect(Object.keys(row).sort()).toEqual(['city', 'name', 'slug', 'state'])
    expect(response.body).not.toContain('12345678000199')
    expect(response.body).not.toContain('hidden')
    expect(response.headers['cache-control']).toBe('public, max-age=60')
  })
  it('curingas e barra invertida continuam literais', async () => {
    const response = await read(
      origin,
      `?q=${encodeURIComponent(`${context.directory.marker} wildcard %_\\`)}`,
      context.directory.ips[base + 2]!
    )
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body).results).toEqual([
      {
        slug: `api-dir-${context.alfa.id.slice('api-alfa-'.length)}-14`,
        name: `${context.directory.marker} wildcard %_\\`,
        city: 'Porto Alegre',
        state: 'RS',
      },
    ])
  })
  it.each(['HEAD', 'OPTIONS', 'POST'])(
    'conserva o método %s',
    async (method) => {
      const response = await read(
        origin,
        url,
        context.directory.ips[base + 3]!,
        method
      )
      expect(response.status).toBe(
        method === 'HEAD' ? 200 : method === 'OPTIONS' ? 204 : 405
      )
      expect(response.body).toBe('')
      if (method === 'OPTIONS')
        expect(response.headers.allow).toBe('GET, HEAD, OPTIONS')
    }
  )
})

describe('contador persistente do diretório', () => {
  it('os dois processos HTTP dividem o mesmo limite de 30 buscas e contador atômico', async () => {
    // Reserva tempo para o ensaio não atravessar a janela fixa de um minuto.
    const remaining = 60_000 - (Date.now() % 60_000)
    if (remaining < 10_000)
      await new Promise((resolve) => setTimeout(resolve, remaining + 50))
    const ip = context.directory.ips[31]!
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        read(rotatingTarget(context, index), url, ip)
      )
    )
    expect(results.filter((result) => result.status === 200)).toHaveLength(30)
    expect(results.filter((result) => result.status === 429)).toHaveLength(10)
    for (const result of results.filter((result) => result.status === 429)) {
      expect(JSON.parse(result.body)).toEqual({
        error: 'Muitas buscas. Tente novamente em instantes.',
        code: 'RATE_LIMITED',
      })
      expect(result.headers['cache-control']).toBe('no-store')
      expect(Number(result.headers['retry-after'])).toBeGreaterThan(0)
      expect(Number(result.headers['retry-after'])).toBeLessThanOrEqual(60)
    }
    const rows = await keysFor(ip)
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(40)
    expect(rows[0].key).not.toContain(ip)
  })
})

const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const directoryRow = (index: number) => ({
  slug: `api-dir-${context.alfa.id.slice('api-alfa-'.length)}-${index}`,
  name:
    index === 14
      ? `${context.directory.marker} wildcard %_\\`
      : `${context.directory.marker} ${String(index).padStart(2, '0')}`,
  city: 'Porto Alegre',
  state: 'RS',
})
const reply = (
  status: number,
  body: unknown,
  cache: string | null,
  extra: Record<string, string | null> = {}
) => ({
  status,
  body: body === '' ? '' : JSON.stringify(body),
  headers: {
    'content-type': body === '' ? null : 'application/json',
    'cache-control': cache,
    'retry-after': null,
    vary: frameworkVary,
    allow: null,
    'set-cookie': null,
    ...extra,
  },
})
const invalidQuery = reply(
  400,
  { error: 'Informe apenas q, com 3 a 80 caracteres.', code: 'INVALID_QUERY' },
  'no-store'
)
/** Resposta completa esperada de cada caso, montada da fixture (onda 135, B2): a mesma em cada host da rodada. */
const expectedReply: Record<string, ReturnType<typeof reply>> = {
  sucesso: reply(
    200,
    { results: Array.from({ length: 10 }, (_, index) => directoryRow(index)) },
    'public, max-age=60'
  ),
  'nenhum resultado': reply(200, { results: [] }, 'public, max-age=60'),
  'q repetido': invalidQuery,
  'parâmetro extra': invalidQuery,
  controle: invalidQuery,
  'curingas literais': reply(
    200,
    { results: [directoryRow(14)] },
    'public, max-age=60'
  ),
  HEAD: {
    ...reply(200, '', 'public, max-age=60'),
    headers: {
      ...reply(200, '', 'public, max-age=60').headers,
      'content-type': 'application/json',
    },
  },
  OPTIONS: reply(204, '', null, { allow: 'GET, HEAD, OPTIONS' }),
  'método não implementado': reply(405, '', null),
}

describe('contrato HTTP explícito do diretório', () => {
  it.each([
    ['sucesso', url, 'GET'],
    ['nenhum resultado', '?q=fixture-nonexistent-directory-name', 'GET'],
    ['q repetido', '?q=abc&q=def', 'GET'],
    ['parâmetro extra', `${url}&page=1`, 'GET'],
    ['controle', '?q=%00%00%00', 'GET'],
    [
      'curingas literais',
      `?q=${encodeURIComponent(`${context.directory.marker} wildcard %_\\`)}`,
      'GET',
    ],
    ['HEAD', url, 'HEAD'],
    ['OPTIONS', url, 'OPTIONS'],
    ['método não implementado', url, 'POST'],
  ])(
    '%s: corpo, status e headers esperados em cada host',
    async (label, query, method) => {
      for (const [index, origin] of parityTargets(context).entries())
        expect(
          await read(origin, query, context.directory.ips[16 + index]!, method)
        ).toEqual(expectedReply[label])
    }
  )
})
