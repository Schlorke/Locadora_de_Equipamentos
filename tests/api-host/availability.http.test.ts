import { afterAll, describe, expect, inject, it } from 'vitest'
import { Pool } from 'pg'
import { namedParityTargets, parityTargets } from './targets'

const context = inject('apiParity')
const edge = (slug: string, auth = context.secret) => ({
  'x-platform-edge-auth': auth,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
async function request(
  origin: string,
  id: string,
  query: string,
  headers: Record<string, string> = {},
  method = 'GET'
) {
  const response = await fetch(
    `${origin}/api/equipments/${id}/availability${query}`,
    { headers, method }
  )
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

// Este conjunto roda inicialmente só no legado, antes da adaptação.
describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'serviço' })
)('%s — calendário público', (_host, origin) => {
  const id = context.alfa.equipmentIds[0]!
  const query = `?tenantSlug=${context.alfa.slug}`
  it.each([
    [
      'sem locadora antes de mês inválido',
      '',
      '&month=invalid',
      {},
      409,
      'Selecione uma locadora',
    ],
    [
      'locadora inválida',
      '?tenantSlug=Bad_Slug',
      '&month=invalid',
      {},
      404,
      'Locadora não encontrada',
    ],
    [
      'locadora suspensa',
      `?tenantSlug=${context.suspended}`,
      '',
      {},
      404,
      'Locadora não encontrada',
    ],
    [
      'borda forjada',
      '',
      '',
      edge(context.alfa.slug, 'wrong-secret'),
      409,
      'Selecione uma locadora',
    ],
    [
      'host conflita com query',
      `?tenantSlug=${context.bravo.slug}`,
      '',
      edge(context.alfa.slug),
      400,
      'Seleção de locadora conflitante',
    ],
    [
      'mês fora de faixa',
      query,
      '&month=2030-13',
      {},
      400,
      'Formato de mês inválido. Use YYYY-MM',
    ],
    [
      'mês sem zero',
      query,
      '&month=2030-1',
      {},
      400,
      'Formato de mês inválido. Use YYYY-MM',
    ],
    [
      'data parcial',
      query,
      '&startDate=2030-01-01',
      {},
      400,
      'Informe data de início e fim',
    ],
    [
      'fim parcial',
      query,
      '&endDate=2030-01-01',
      {},
      400,
      'Informe data de início e fim',
    ],
    [
      'data inválida',
      query,
      '&startDate=bad&endDate=2030-01-02',
      {},
      400,
      'Período inválido ou superior a 366 dias',
    ],
    [
      'datas invertidas',
      query,
      '&startDate=2030-01-02&endDate=2030-01-01',
      {},
      400,
      'Período inválido ou superior a 366 dias',
    ],
    [
      'limite de período',
      query,
      '&startDate=2030-01-01&endDate=2031-01-02',
      {},
      400,
      'Período inválido ou superior a 366 dias',
    ],
  ] as const)('%s', async (_case, tenant, period, headers, status, error) => {
    const response = await request(
      origin,
      id,
      tenant ? tenant + period : `?${period.slice(1)}`,
      headers
    )
    expect(response.status).toBe(status)
    expect(JSON.parse(response.body).error).toBe(error)
    expect(response.headers['set-cookie']).toBeNull()
  })
  it('preserva pico simultâneo inclusivo, datas do item/fallback e não expõe locações', async () => {
    const response = await request(origin, id, `${query}&month=2030-01`)
    expect(response.status).toBe(200)
    const body = JSON.parse(response.body)
    expect(Object.keys(body).sort()).toEqual(
      ['equipmentId', 'month', 'availability', 'maxStock'].sort()
    )
    expect(body.equipmentId).toBe(id)
    expect(body.month).toBe('2030-01')
    expect(body.maxStock).toBe(3)
    expect(Object.keys(body.availability)).toHaveLength(31)
    for (const [day, availableQuantity] of [
      [1, 1],
      [2, 1],
      [3, 0],
      [4, 2],
      [5, 2],
      [6, 3],
      [31, 3],
    ]) {
      expect(
        body.availability[`2030-01-${String(day).padStart(2, '0')}`]
      ).toEqual({
        available: availableQuantity! > 0,
        availableQuantity,
        totalQuantity: 3,
      })
    }
    expect(response.body).not.toContain('fixture-private')
  })
  it('a locadora irmã não herda as reservas de alfa', async () => {
    const response = await request(
      origin,
      context.bravo.equipmentIds[0]!,
      `?tenantSlug=${context.bravo.slug}&month=2030-01`
    )
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body).availability['2030-01-03']).toEqual({
      available: true,
      availableQuantity: 2,
      totalQuantity: 3,
    })
  })
  it.each(['missing', context.bravo.equipmentIds[0]!])(
    'equipamento %s desconhecido ou cruzado mantém 404',
    async (equipment) => {
      const response = await request(
        origin,
        equipment,
        `${query}&month=2030-01`
      )
      expect(response.status).toBe(404)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Equipamento não encontrado',
      })
    }
  )
  it('pagamento no fim, quitação e histórico estornado mantêm a política de reserva', async () => {
    const response = await request(
      origin,
      context.alfa.equipmentIds[1]!,
      `${query}&month=2030-01`
    )
    expect(response.status).toBe(200)
    const body = JSON.parse(response.body)
    for (const [day, available] of [
      [10, false],
      [11, true],
      [12, false],
      [13, true],
      [14, false],
    ] as const) {
      expect(body.availability[`2030-01-${day}`]).toEqual({
        available,
        availableQuantity: available ? 1 : 0,
        totalQuantity: 1,
      })
    }
    expect(response.body).not.toContain('fixture-private')
  })
  it('mês tem precedência sobre datas inválidas e ano bissexto mantém 29 dias', async () => {
    const response = await request(
      origin,
      id,
      `${query}&month=2032-02&startDate=bad&endDate=bad`
    )
    expect(response.status).toBe(200)
    expect(Object.keys(JSON.parse(response.body).availability)).toHaveLength(29)
  })
  it('normaliza o intervalo para dias UTC completos', async () => {
    const response = await request(
      origin,
      id,
      `${query}&startDate=2030-01-02T23:30:00-03:00&endDate=2030-01-04T00:00:00Z`
    )
    expect(response.status).toBe(200)
    expect(Object.keys(JSON.parse(response.body).availability)).toEqual([
      '2030-01-03',
      '2030-01-04',
    ])
  })
  it('estoque zero e flag available preservam a semântica atual do calendário', async () => {
    for (const [equipment, stock] of [
      [context.alfa.equipmentIds[2]!, 0],
      [context.alfa.equipmentIds[10]!, 1],
    ] as const) {
      const response = await request(
        origin,
        equipment,
        `${query}&month=2030-01`
      )
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body).availability['2030-01-01']).toEqual({
        available: stock > 0,
        availableQuantity: stock,
        totalQuantity: stock,
      })
    }
  })
  it('borda validada seleciona o calendário sem exigir query', async () => {
    const response = await request(
      origin,
      id,
      '?month=2030-01',
      edge(context.alfa.slug)
    )
    expect(response.status).toBe(200)
    expect(
      JSON.parse(response.body).availability['2030-01-03'].availableQuantity
    ).toBe(0)
  })
  it.each(['HEAD', 'OPTIONS', 'POST'])('mantém o método %s', async (method) => {
    const response = await request(
      origin,
      id,
      `${query}&month=2030-01`,
      {},
      method
    )
    expect(response.status).toBe(
      method === 'POST' ? 405 : method === 'HEAD' ? 200 : 204
    )
    expect(response.body).toBe('')
    if (method === 'OPTIONS')
      expect(response.headers.allow).toBe('GET, HEAD, OPTIONS')
  })
})

const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
/**
 * Calendário esperado, montado das reservas da fixture (global-setup.ts): no equipamento 0 da alfa (estoque 3) as
 * locações ativas reservam 2 de 1 a 3/jan e 1 de 3 a 5/jan (a borda conta nas duas); no equipamento 1 (estoque 1) as
 * locações dos orçamentos reservam 10, 12 e 14/jan; o equipamento 2 tem estoque zero.
 */
function calendar(
  equipment: number,
  days: string[],
  month = days[0]!.slice(0, 7)
) {
  const stock = equipment === 0 ? 3 : equipment === 2 ? 0 : 1
  const reserved = (day: string) => {
    if (!day.startsWith('2030-01-')) return 0
    const date = Number(day.slice(8))
    if (equipment === 0)
      return date <= 2 ? 2 : date === 3 ? 3 : date <= 5 ? 1 : 0
    if (equipment === 1) return [10, 12, 14].includes(date) ? 1 : 0
    return 0
  }
  return {
    equipmentId: context.alfa.equipmentIds[equipment]!,
    month,
    availability: Object.fromEntries(
      days.map((day) => {
        const free = Math.max(stock - reserved(day), 0)
        return [
          day,
          {
            available: free > 0,
            availableQuantity: free,
            totalQuantity: stock,
          },
        ]
      })
    ),
    maxStock: stock,
  }
}
const monthDays = (month: string, count: number) =>
  Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`
  )
const headersOf = (cache: string | null = null, vary = frameworkVary) => ({
  'content-type': 'application/json',
  'cache-control': cache,
  vary,
  'cdn-cache-control': null,
  allow: null,
  'set-cookie': null,
})
const ok = (body: unknown) => ({ status: 200, body, headers: headersOf() })
const invalid = (error: string) => ({
  status: 400,
  body: { error },
  headers: headersOf(),
})
const missing = {
  status: 404,
  body: { error: 'Equipamento não encontrado' },
  headers: headersOf(),
}
const framework = (status: number) => ({
  status,
  body: '',
  headers: {
    ...headersOf(),
    'content-type': null,
    allow: status === 204 ? 'GET, HEAD, OPTIONS' : null,
  },
})
/** Resposta completa esperada de cada caso (corpo interpretado), montada da fixture (onda 135, B2). */
const expectedCalendar: Record<string, unknown> = {
  mês: ok(calendar(0, monthDays('2030-01', 31))),
  'intervalo UTC': ok(calendar(0, ['2030-01-03', '2030-01-04'])),
  bissexto: ok(calendar(0, monthDays('2032-02', 29))),
  'mês inválido': invalid('Formato de mês inválido. Use YYYY-MM'),
  'datas parciais': invalid('Informe data de início e fim'),
  'período grande': invalid('Período inválido ou superior a 366 dias'),
  'sem locadora': {
    status: 409,
    body: { error: 'Selecione uma locadora' },
    headers: headersOf('no-store'),
  },
  host: ok(calendar(0, monthDays('2030-01', 31))),
  conflito: {
    status: 400,
    body: {
      error: 'Seleção de locadora conflitante',
      code: 'TENANT_CONFLICT',
    },
    headers: headersOf('no-store'),
  },
  cruzado: missing,
  ausente: missing,
  pagamentos: ok(calendar(1, monthDays('2030-01', 31))),
  'zero estoque': ok(calendar(2, monthDays('2030-01', 31))),
  HEAD: { status: 200, body: '', headers: headersOf() },
  OPTIONS: framework(204),
  POST: framework(405),
}

describe('contrato HTTP explícito do calendário', () => {
  const id = context.alfa.equipmentIds[0]!
  const query = `?tenantSlug=${context.alfa.slug}`
  it.each([
    ['mês', id, `${query}&month=2030-01`, {}, 'GET'],
    [
      'intervalo UTC',
      id,
      `${query}&startDate=2030-01-02T23:30:00-03:00&endDate=2030-01-04`,
      {},
      'GET',
    ],
    ['bissexto', id, `${query}&month=2032-02`, {}, 'GET'],
    ['mês inválido', id, `${query}&month=2030-13`, {}, 'GET'],
    ['datas parciais', id, `${query}&startDate=2030-01-02`, {}, 'GET'],
    [
      'período grande',
      id,
      `${query}&startDate=2030-01-01&endDate=2031-01-02`,
      {},
      'GET',
    ],
    ['sem locadora', id, '?month=2030-01', {}, 'GET'],
    ['host', id, '?month=2030-01', edge(context.alfa.slug), 'GET'],
    [
      'conflito',
      id,
      `?tenantSlug=${context.bravo.slug}`,
      edge(context.alfa.slug),
      'GET',
    ],
    [
      'cruzado',
      context.bravo.equipmentIds[0]!,
      `${query}&month=2030-01`,
      {},
      'GET',
    ],
    ['ausente', 'missing', `${query}&month=2030-01`, {}, 'GET'],
    [
      'pagamentos',
      context.alfa.equipmentIds[1]!,
      `${query}&month=2030-01`,
      {},
      'GET',
    ],
    [
      'zero estoque',
      context.alfa.equipmentIds[2]!,
      `${query}&month=2030-01`,
      {},
      'GET',
    ],
    ['HEAD', id, `${query}&month=2030-01`, {}, 'HEAD'],
    ['OPTIONS', id, '', {}, 'OPTIONS'],
    ['POST', id, query, {}, 'POST'],
  ] as const)(
    '%s: status/corpo/headers esperados em cada host',
    async (name, equipment, period, headers, method) => {
      for (const origin of parityTargets(context)) {
        const response = await request(
          origin,
          equipment,
          period,
          headers,
          method
        )
        expect({
          ...response,
          body: response.body ? JSON.parse(response.body) : '',
        }).toEqual(expectedCalendar[name])
      }
    }
  )
})

describe('RLS das reservas usadas pelo calendário', () => {
  const pool = new Pool({ connectionString: context.runtimeUrl, max: 1 })
  afterAll(() => pool.end())
  it.each(['rentals', 'rental_items', 'payments', 'quotes'])(
    '%s mantém FORCE e não lê sem contexto',
    async (table) => {
      const flags = await pool.query(
        'SELECT r.rolsuper, r.rolbypassrls, c.relforcerowsecurity, pg_get_userbyid(c.relowner) = current_user AS owner FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname = current_user AND c.oid = $1::regclass',
        [table]
      )
      expect(flags.rows).toEqual([
        {
          rolsuper: false,
          rolbypassrls: false,
          relforcerowsecurity: true,
          owner: false,
        },
      ])
      expect((await pool.query(`SELECT id FROM ${table}`)).rows).toEqual([])
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [
          context.alfa.id,
        ])
        const rows = (await client.query(`SELECT "tenantId" FROM ${table}`))
          .rows
        expect(rows.length).toBeGreaterThan(0)
        expect(
          rows.every(
            (row: { tenantId: string }) => row.tenantId === context.alfa.id
          )
        ).toBe(true)
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }
  )
})
