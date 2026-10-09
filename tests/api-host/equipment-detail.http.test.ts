import { describe, expect, inject, it } from 'vitest'
import { namedParityTargets, parityTargets } from './targets'

const context = inject('apiParity')
const edge = (slug: string) => ({
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
async function read(
  origin: string,
  id: string,
  query: string,
  headers: Record<string, string> = {},
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/equipments/${id}${query}`, {
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
)('%s — detalhe público', (_host, origin) => {
  it.each(['alfa', 'bravo'] as const)(
    'DTO %s conserva os campos públicos e Decimal numérico',
    async (tenant) => {
      const id = context[tenant].equipmentIds[0]!
      const response = await read(
        origin,
        id,
        `?tenantSlug=${context[tenant].slug}`
      )

      expect(response.status).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.id).toBe(id)
      expect(body.pricePerDay).toBe(12.5)
      expect(body.dailyDirectValue).toBe(17.25)
      expect(body.dailyUseDirectValue).toBe(true)
      expect(body.maxStock).toBe(3)
      expect(body.imageUrl).toBe(`https://assets.example.test/${tenant}.jpg`)
      expect(body.images).toEqual([body.imageUrl])
      expect(body.category.id).toBe(context[tenant].categoryId)
      expect(body.category.slug).toEqual(expect.any(String))
      expect(body.updatedAt).toEqual(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      )
      expect(Object.keys(body).sort()).toEqual(
        [
          'id',
          'name',
          'description',
          'pricePerDay',
          'imageUrl',
          'images',
          'isAvailable',
          'category',
          'dailyDiscount',
          'weeklyDiscount',
          'biweeklyDiscount',
          'monthlyDiscount',
          'popularPeriod',
          'maxStock',
          'dailyDirectValue',
          'weeklyDirectValue',
          'biweeklyDirectValue',
          'monthlyDirectValue',
          'dailyUseDirectValue',
          'weeklyUseDirectValue',
          'biweeklyUseDirectValue',
          'monthlyUseDirectValue',
          'dailyRentalEnabled',
          'weeklyRentalEnabled',
          'biweeklyRentalEnabled',
          'monthlyRentalEnabled',
          'updatedAt',
        ].sort()
      )
      expect(Object.keys(body.category).sort()).toEqual(
        [
          'id',
          'name',
          'slug',
          'icon',
          'iconColor',
          'bgColor',
          'fontColor',
          'customIcon',
        ].sort()
      )
      expect(response.body).not.toContain('fixture-private')
      expect(response.headers['cache-control']).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
    }
  )
  it('host confiável conserva cache e variação por Host', async () => {
    const response = await read(
      origin,
      context.alfa.equipmentIds[0]!,
      '',
      edge(context.alfa.slug)
    )
    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('public, max-age=60')
    expect(response.headers.vary).toBe(
      'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Host'
    )
    expect(response.headers['cdn-cache-control']).toBeNull()
  })
  it.each([
    'missing',
    context.bravo.equipmentIds[0]!,
    'x'.repeat(129),
    'invalid%20id',
  ])(
    'ID %s desconhecido, cruzado ou inválido mantém 404 neutro',
    async (id) => {
      const response = await read(
        origin,
        id,
        `?tenantSlug=${context.alfa.slug}`
      )
      expect(response.status).toBe(404)
      expect(JSON.parse(response.body)).toEqual({
        error: 'Equipamento não encontrado',
      })
      expect(response.headers['cache-control']).toBe('no-store')
    }
  )
  it.each([
    ['sem locadora', '', {}, 409, 'Selecione uma locadora'],
    [
      'slug com espaços',
      `?tenantSlug=%20${context.alfa.slug}%20`,
      {},
      404,
      'Locadora não encontrada',
    ],
    [
      'suspenso',
      `?tenantSlug=${context.suspended}`,
      {},
      404,
      'Locadora não encontrada',
    ],
    [
      'host divergente',
      `?tenantSlug=${context.bravo.slug}`,
      edge(context.alfa.slug),
      400,
      'Seleção de locadora conflitante',
    ],
  ] as const)(
    '%s precede o ID inválido',
    async (_case, query, headers, status, error) => {
      const response = await read(origin, 'invalid%20id', query, headers)
      expect(response.status).toBe(status)
      expect(JSON.parse(response.body).error).toBe(error)
    }
  )
  it('estoque zero, ausência de imagem e indisponibilidade ficam explícitos', async () => {
    const zero = await read(
      origin,
      context.alfa.equipmentIds[2]!,
      `?tenantSlug=${context.alfa.slug}`
    )
    expect(zero.status).toBe(200)
    expect(JSON.parse(zero.body)).toMatchObject({
      maxStock: 0,
      imageUrl: null,
      images: [],
    })
    const inactive = await read(
      origin,
      context.alfa.equipmentIds[10]!,
      `?tenantSlug=${context.alfa.slug}`
    )
    expect(inactive.status).toBe(200)
    expect(JSON.parse(inactive.body).isAvailable).toBe(false)
  })
  it.each(['HEAD', 'OPTIONS', 'POST'])(
    'conserva o método %s',
    async (method) => {
      const response = await read(
        origin,
        context.alfa.equipmentIds[0]!,
        `?tenantSlug=${context.alfa.slug}`,
        {},
        method
      )
      expect(response.status).toBe(
        method === 'POST' ? 405 : method === 'HEAD' ? 200 : 204
      )
      expect(response.body).toBe('')
      if (method === 'OPTIONS')
        expect(response.headers.allow).toBe('GET, HEAD, OPTIONS')
    }
  )
})

const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const run = context.alfa.id.slice('api-alfa-'.length)
/** DTO público de um equipamento da fixture (global-setup.ts), sem os campos privados. */
function publicEquipment(tenant: 'alfa' | 'bravo', index: number) {
  const ids = context[tenant].equipmentIds
  const last = index === ids.length - 1
  const image = index === 0 ? `https://assets.example.test/${tenant}.jpg` : null
  return {
    id: ids[index]!,
    name: last
      ? `Andaime exclusivo ${tenant}`
      : `Betoneira ${tenant} ${String(index).padStart(2, '0')}`,
    description: last
      ? `guindaste na descrição ${tenant}`
      : `Concreto ${tenant}`,
    pricePerDay: 12.5,
    imageUrl: image,
    images: image ? [image] : [],
    isAvailable: index !== 10,
    category: {
      id: context[tenant].categoryId,
      name: tenant === 'alfa' ? 'Andaimes' : 'Betoneiras',
      slug: `cat-${tenant}-${run}`,
      icon: null,
      iconColor: '#ea580c',
      bgColor: '#fff7ed',
      fontColor: '#7c2d12',
      customIcon: null,
    },
    dailyDiscount: 0,
    weeklyDiscount: 0,
    biweeklyDiscount: 0,
    monthlyDiscount: 0,
    popularPeriod: 'weekly',
    maxStock: index === 0 ? 3 : index === 2 ? 0 : 1,
    dailyDirectValue: 17.25,
    weeklyDirectValue: 0,
    biweeklyDirectValue: 0,
    monthlyDirectValue: 0,
    dailyUseDirectValue: true,
    weeklyUseDirectValue: false,
    biweeklyUseDirectValue: false,
    monthlyUseDirectValue: false,
    dailyRentalEnabled: true,
    weeklyRentalEnabled: true,
    biweeklyRentalEnabled: true,
    monthlyRentalEnabled: true,
    updatedAt: expect.any(String),
  }
}
const headers200 = (host = false) => ({
  'content-type': 'application/json',
  'cache-control': host
    ? 'public, max-age=60'
    : 'public, max-age=60, stale-while-revalidate=300',
  vary: host ? `${frameworkVary}, Host` : frameworkVary,
  'cdn-cache-control': null,
  allow: null,
  'set-cookie': null,
})
const refusal = (status: number, body: unknown) => ({
  status,
  body,
  headers: { ...headers200(), 'cache-control': 'no-store' },
})
const framework = (status: number) => ({
  status,
  body: '',
  headers: {
    'content-type': null,
    'cache-control': null,
    vary: frameworkVary,
    'cdn-cache-control': null,
    allow: status === 204 ? 'GET, HEAD, OPTIONS' : null,
    'set-cookie': null,
  },
})
const missing = refusal(404, { error: 'Equipamento não encontrado' })
const unknownTenant = refusal(404, { error: 'Locadora não encontrada' })
/** Resposta completa esperada de cada caso (corpo interpretado), montada da fixture (onda 135, B2). */
const expectedDetail: Record<string, unknown> = {
  alfa: {
    status: 200,
    body: publicEquipment('alfa', 0),
    headers: headers200(),
  },
  bravo: {
    status: 200,
    body: publicEquipment('bravo', 0),
    headers: headers200(),
  },
  host: {
    status: 200,
    body: publicEquipment('alfa', 0),
    headers: headers200(true),
  },
  cruzado: missing,
  ausente: missing,
  'ID longo': missing,
  'ID inválido': missing,
  'sem locadora': refusal(409, { error: 'Selecione uma locadora' }),
  'slug inválido': unknownTenant,
  suspenso: unknownTenant,
  conflito: refusal(400, {
    error: 'Seleção de locadora conflitante',
    code: 'TENANT_CONFLICT',
  }),
  'estoque zero': {
    status: 200,
    body: publicEquipment('alfa', 2),
    headers: headers200(),
  },
  indisponível: {
    status: 200,
    body: publicEquipment('alfa', 10),
    headers: headers200(),
  },
  HEAD: { status: 200, body: '', headers: headers200() },
  OPTIONS: framework(204),
  POST: framework(405),
}

describe('contrato HTTP explícito — detalhe público', () => {
  const query = `?tenantSlug=${context.alfa.slug}`
  const id = context.alfa.equipmentIds[0]!
  it.each([
    ['alfa', id, query, {}, 'GET'],
    [
      'bravo',
      context.bravo.equipmentIds[0]!,
      `?tenantSlug=${context.bravo.slug}`,
      {},
      'GET',
    ],
    ['host', id, '', edge(context.alfa.slug), 'GET'],
    ['cruzado', context.bravo.equipmentIds[0]!, query, {}, 'GET'],
    ['ausente', 'missing', query, {}, 'GET'],
    ['ID longo', 'x'.repeat(129), query, {}, 'GET'],
    ['ID inválido', 'invalid%20id', query, {}, 'GET'],
    ['sem locadora', id, '', {}, 'GET'],
    ['slug inválido', id, '?tenantSlug=invalid--slug', {}, 'GET'],
    ['suspenso', id, `?tenantSlug=${context.suspended}`, {}, 'GET'],
    [
      'conflito',
      id,
      `?tenantSlug=${context.bravo.slug}`,
      edge(context.alfa.slug),
      'GET',
    ],
    ['estoque zero', context.alfa.equipmentIds[2]!, query, {}, 'GET'],
    ['indisponível', context.alfa.equipmentIds[10]!, query, {}, 'GET'],
    ['HEAD', id, query, {}, 'HEAD'],
    ['OPTIONS', id, '', {}, 'OPTIONS'],
    ['POST', id, query, {}, 'POST'],
  ] as const)(
    '%s: status, corpo e headers esperados em cada host',
    async (name, equipment, selection, headers, method) => {
      for (const origin of parityTargets(context)) {
        const response = await read(
          origin,
          equipment,
          selection,
          headers,
          method
        )
        expect({
          ...response,
          body: response.body ? JSON.parse(response.body) : '',
        }).toEqual(expectedDetail[name])
      }
    }
  )
})
