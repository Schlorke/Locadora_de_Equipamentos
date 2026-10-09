import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { namedParityTargets, parityTargets } from './targets'

const context = inject('apiParity')
// Onda 134: conteúdo institucional da alfa (a bravo fica sem nenhum), gravado pelo administrador do banco descartável e
// desfeito no fim do arquivo. Uma chave inválida gravada fora do painel prova a leitura tolerante por chave.
const ALFA_SITE_CONTENT = {
  experienceYears: 12,
  featuredClients: ['Construtora Alfa Ltda'],
  commitments: { support24h: true, freeDelivery: false },
  clientsServed: -1,
}
const fixtureAdmin = new Pool({
  connectionString: requireTestDatabase(process.env),
  max: 1,
})
beforeAll(async () => {
  await fixtureAdmin.query(
    'UPDATE settings SET "siteContent" = $1::jsonb WHERE "tenantId" = $2',
    [JSON.stringify(ALFA_SITE_CONTENT), context.alfa.id]
  )
})
afterAll(async () => {
  await fixtureAdmin.query(
    `UPDATE settings SET "siteContent" = '{}'::jsonb WHERE "tenantId" = $1`,
    [context.alfa.id]
  )
  await fixtureAdmin.end()
})
const edge = (slug: string, auth = context.secret) => ({
  'x-platform-edge-auth': auth,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const endpoints = [
  '/api/equipments',
  '/api/equipamentos/search',
  '/api/settings/public',
] as const

async function snapshot(
  origin: string,
  endpoint: string,
  query: string,
  headers: Record<string, string> = {},
  method = 'GET'
) {
  const response = await fetch(origin + endpoint + query, { headers, method })
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

// O contrato foi caracterizado no legado antes de montar as rotas no serviço.
describe.each(
  namedParityTargets(context, { legacy: 'legado', api: 'serviço' })
)('%s — catálogo público', (_host, origin) => {
  describe.each(endpoints)('%s', (endpoint) => {
    it.each([
      ['sem seleção', '', {}, 409],
      ['inválido', '?tenantSlug=Bad_Slug', {}, 404],
      ['reservado', '?tenantSlug=api', {}, 404],
      ['desconhecido', '?tenantSlug=unknown', {}, 404],
      ['suspenso', `?tenantSlug=${context.suspended}`, {}, 404],
      [
        'conflito na query',
        `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`,
        {},
        400,
      ],
      [
        'conflito com host',
        `?tenantSlug=${context.bravo.slug}`,
        edge(context.alfa.slug),
        400,
      ],
      ['borda forjada', '', edge(context.alfa.slug, 'wrong-secret'), 409],
      [
        'cookie/header privados não escolhem público',
        '',
        {
          cookie: `selected-tenant-id=${context.alfa.id}`,
          'x-tenant-id': context.alfa.id,
        },
        409,
      ],
    ] as const)('%s', async (_case, query, headers, status) => {
      const response = await snapshot(origin, endpoint, query, headers)
      expect(response.status).toBe(status)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['set-cookie']).toBeNull()
      expect(JSON.parse(response.body)).toEqual(
        status === 404
          ? { error: 'Locadora não encontrada' }
          : status === 400
            ? {
                error: 'Seleção de locadora conflitante',
                code: 'TENANT_CONFLICT',
              }
            : endpoint === '/api/settings/public'
              ? { error: 'Selecione uma locadora', code: 'TENANT_REQUIRED' }
              : { error: 'Selecione uma locadora' }
      )
    })

    it.each(['HEAD', 'OPTIONS', 'POST'])(
      'método %s conserva o contrato Next',
      async (method) => {
        const response = await snapshot(
          origin,
          endpoint,
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

  it.each(['alfa', 'bravo'] as const)(
    'listagem %s: ordenação, Decimal, imagens e projeção pública',
    async (tenant) => {
      const expected = context[tenant]
      const response = await snapshot(
        origin,
        endpoints[0],
        `?tenantSlug=${expected.slug}`
      )
      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toBe(
        'public, max-age=60, stale-while-revalidate=300'
      )
      const rows = JSON.parse(response.body)
      expect(rows.map((row: { id: string }) => row.id)).toEqual(
        [...expected.equipmentIds].reverse()
      )
      for (const row of rows) {
        expect(row.pricePerDay).toBe(12.5)
        expect(row.dailyDirectValue).toBe(17.25)
        expect(row.reviews).toEqual([])
        expect(row.category.id).toBe(expected.categoryId)
        for (const key of [
          'tenantId',
          'purchasePrice',
          'partsLossHistory',
          'specifications',
        ]) {
          expect(row).not.toHaveProperty(key)
        }
      }
      expect(
        rows.find((row: { id: string }) => row.id === expected.equipmentIds[0])
          .imageUrl
      ).toBe(`https://assets.example.test/${tenant}.jpg`)
      expect(rows[0].imageUrl).toBeNull()
      if (tenant === 'alfa')
        expect(
          rows.find(
            (row: { id: string }) => row.id === expected.equipmentIds[10]
          ).isAvailable
        ).toBe(false)
    }
  )

  it('borda válida seleciona catálogo e mantém Vary Host/cache', async () => {
    const response = await snapshot(
      origin,
      endpoints[0],
      '',
      edge(context.alfa.slug)
    )
    expect(response.status).toBe(200)
    expect(response.headers.vary).toBe(
      'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Host'
    )
    expect(response.headers['cache-control']).toBe('public, max-age=60')
    expect(response.headers['cdn-cache-control']).toBeNull()
    expect(
      JSON.parse(response.body).map((row: { id: string }) => row.id)
    ).toEqual([...context.alfa.equipmentIds].reverse())
  })

  it.each(['', '&q=', '&q=b', '&q=%20b%20', '&q=%20%20'])(
    'busca curta %s retorna lista vazia',
    async (query) => {
      const response = await snapshot(
        origin,
        endpoints[1],
        `?tenantSlug=${context.alfa.slug}${query}`
      )
      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual([])
    }
  )

  it('busca mantém limite 8, ordem, disponibilidade, seleção e Decimal textual', async () => {
    const response = await snapshot(
      origin,
      endpoints[1],
      `?tenantSlug=${context.alfa.slug}&q=BETONEIRA`
    )
    expect(response.status).toBe(200)
    const rows = JSON.parse(response.body)
    expect(rows.map((row: { id: string }) => row.id)).toEqual(
      context.alfa.equipmentIds.slice(0, 8)
    )
    for (const row of rows) {
      expect(row.pricePerDay).toBe('12.5')
      expect(Object.keys(row).sort()).toEqual(
        [
          'id',
          'name',
          'description',
          'pricePerDay',
          'category',
          'images',
        ].sort()
      )
    }
  })

  it('busca exclui o equipamento indisponível mesmo quando o nome corresponde', async () => {
    const response = await snapshot(
      origin,
      endpoints[1],
      `?tenantSlug=${context.alfa.slug}&q=Betoneira%20alfa%2010`
    )
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual([])
  })

  it('busca por descrição não altera o termo com espaços e usa o primeiro q', async () => {
    const description = await snapshot(
      origin,
      endpoints[1],
      `?tenantSlug=${context.alfa.slug}&q=GUINDASTE`
    )
    expect(
      JSON.parse(description.body).map((row: { id: string }) => row.id)
    ).toEqual([context.alfa.equipmentIds[11]])
    const spaced = await snapshot(
      origin,
      endpoints[1],
      `?tenantSlug=${context.alfa.slug}&q=%20Betoneira%20`
    )
    expect(JSON.parse(spaced.body)).toEqual([])
    const first = await snapshot(
      origin,
      endpoints[1],
      `?tenantSlug=${context.alfa.slug}&q=b&q=Betoneira`
    )
    expect(JSON.parse(first.body)).toEqual([])
  })

  it.each(['alfa', 'bravo'] as const)(
    'settings %s aceita trim e expõe apenas os campos públicos (com horário e identificação legal da própria locadora)',
    async (tenant) => {
      const response = await snapshot(
        origin,
        endpoints[2],
        `?tenantSlug=%20${context[tenant].slug}%20`
      )
      expect(response.status).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.contactEmail).toBe(`${tenant}@example.test`)
      expect(body.companyPhone).toBe(`phone-${tenant}`)
      expect(Object.keys(body).sort()).toEqual(
        [
          'companyPhone',
          'whatsappNumber',
          'contactEmail',
          'companyAddress',
          'companyIconUrl',
          'marketingEmail',
          'aboutUsText',
          'socialLinks',
          'heroCarousel',
          'waveAnimation',
          'businessHours',
          'legalIdentity',
          'siteContent',
          'legalDocuments',
          'seoTitle',
          'seoDescription',
        ].sort()
      )
      // Onda 135 (A4): SEO da vitrine, aditivo e normalizado; a fixture não grava título (padrão neutro da coluna).
      expect({
        seoTitle: body.seoTitle,
        seoDescription: body.seoDescription,
      }).toEqual({
        seoTitle: null,
        seoDescription:
          'Locação de equipamentos para construção civil com qualidade e segurança',
      })
      expect(response.body).not.toContain('fixture-private')
      // Onda 134: o conteúdo é o da própria locadora, chave a chave (a inválida sai); nenhum texto legal publicado.
      expect(body.legalDocuments).toEqual({
        terms: false,
        privacy: false,
        returnPolicy: false,
      })
      if (tenant === 'alfa')
        expect(body.siteContent).toEqual({
          experienceYears: 12,
          featuredClients: ['Construtora Alfa Ltda'],
          commitments: { support24h: true, freeDelivery: false },
        })
      else {
        expect(body.siteContent).toEqual({})
        expect(response.body).not.toContain('Construtora Alfa')
      }
      // Achado 147: horário das configurações e CNPJ da organização da PRÓPRIA locadora; a bravo não tem nenhum dos
      // dois e não recebe os da alfa.
      if (tenant === 'alfa') {
        expect(body.businessHours).toEqual({
          monday: { closed: false, open: '08:00', close: '18:00' },
          friday: { closed: false, open: '08:00', close: '18:00' },
          saturday: { closed: false, open: '08:00', close: '12:00' },
          sunday: { closed: true },
        })
        expect(body.legalIdentity).toEqual({
          legalName: 'Alfa Equipamentos Ltda',
          cnpj: '11.222.333/0001-81',
        })
      } else {
        expect(body.businessHours).toBeNull()
        expect(body.legalIdentity).toEqual({ legalName: null, cnpj: null })
        expect(response.body).not.toMatch(/11\.222\.333|Alfa Equipamentos/)
      }
    }
  )

  it('locadora ativa sem settings conserva o 409 específico e catálogo vazio', async () => {
    const response = await snapshot(
      origin,
      endpoints[2],
      `?tenantSlug=${context.unconfigured}`
    )
    expect(response.status).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Configurações públicas indisponíveis nesta locadora',
      code: 'SETTINGS_NOT_CONFIGURED',
    })
    const list = await snapshot(
      origin,
      endpoints[0],
      `?tenantSlug=${context.unconfigured}`
    )
    expect(list.status).toBe(200)
    expect(JSON.parse(list.body)).toEqual([])
  })
})

/** Resposta completa esperada (corpo interpretado) de cada caso por endpoint, montada da fixture (onda 135, B2). */
function expectedPublic(endpoint: string, name: string): unknown {
  const vary =
    'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
  const headers = {
    'content-type': 'application/json' as string | null,
    'cache-control': null as string | null,
    vary,
    'cdn-cache-control': null,
    allow: null as string | null,
    'set-cookie': null,
  }
  if (name === 'OPTIONS' || name === 'POST')
    return {
      status: name === 'OPTIONS' ? 204 : 405,
      body: '',
      headers: {
        ...headers,
        'content-type': null,
        allow: name === 'OPTIONS' ? 'GET, HEAD, OPTIONS' : null,
      },
    }
  const settings = endpoint === '/api/settings/public'
  if (['sem seleção', 'borda forjada'].includes(name))
    return {
      status: 409,
      body: {
        error: 'Selecione uma locadora',
        ...(settings ? { code: 'TENANT_REQUIRED' } : {}),
      },
      headers: { ...headers, 'cache-control': 'no-store' },
    }
  if (
    ['desconhecido', 'suspenso'].includes(name) ||
    (name === 'slug com espaços' && !settings)
  )
    return {
      status: 404,
      body: { error: 'Locadora não encontrada' },
      headers: { ...headers, 'cache-control': 'no-store' },
    }
  if (name === 'conflito')
    return {
      status: 400,
      body: {
        error: 'Seleção de locadora conflitante',
        code: 'TENANT_CONFLICT',
      },
      headers: { ...headers, 'cache-control': 'no-store' },
    }
  const tenant = name.includes('bravo') ? 'bravo' : 'alfa'
  const selected = context[tenant]
  let body: unknown = []
  let status = 200
  if (settings) {
    if (name === 'sem configuração') {
      status = 409
      body = {
        error: 'Configurações públicas indisponíveis nesta locadora',
        code: 'SETTINGS_NOT_CONFIGURED',
      }
    } else {
      body = {
        companyPhone: `phone-${tenant}`,
        whatsappNumber: `whatsapp-${tenant}`,
        contactEmail: `${tenant}@example.test`,
        companyAddress: `Endereço ${tenant}`,
        companyIconUrl: `https://assets.example.test/${tenant}-logo.svg`,
        marketingEmail: `marketing-${tenant}@example.test`,
        aboutUsText: `Sobre ${tenant}`,
        socialLinks: { website: `https://${tenant}.example.test` },
        heroCarousel: [
          {
            title: `Destaque ${tenant}`,
            imageUrl: `https://assets.example.test/${tenant}-hero.jpg`,
          },
        ],
        waveAnimation: 'animated',
        businessHours:
          tenant === 'alfa'
            ? {
                monday: { closed: false, open: '08:00', close: '18:00' },
                friday: { closed: false, open: '08:00', close: '18:00' },
                saturday: { closed: false, open: '08:00', close: '12:00' },
                sunday: { closed: true },
              }
            : null,
        legalIdentity:
          tenant === 'alfa'
            ? {
                legalName: 'Alfa Equipamentos Ltda',
                cnpj: '11.222.333/0001-81',
              }
            : { legalName: null, cnpj: null },
        siteContent:
          tenant === 'alfa'
            ? {
                experienceYears: 12,
                featuredClients: ['Construtora Alfa Ltda'],
                commitments: { support24h: true, freeDelivery: false },
              }
            : {},
        legalDocuments: { terms: false, privacy: false, returnPolicy: false },
        seoTitle: null,
        seoDescription:
          'Locação de equipamentos para construção civil com qualidade e segurança',
      }
    }
  } else if (endpoint === '/api/equipments') {
    headers['cache-control'] = name.startsWith('host ')
      ? 'public, max-age=60'
      : 'public, max-age=60, stale-while-revalidate=300'
    if (name.startsWith('host ')) headers.vary = `${vary}, Host`
    if (name !== 'sem configuração')
      body = selected.equipmentIds
        .map((id, index) => ({
          id,
          name:
            index === selected.equipmentIds.length - 1
              ? `Andaime exclusivo ${tenant}`
              : `Betoneira ${tenant} ${String(index).padStart(2, '0')}`,
          description:
            index === selected.equipmentIds.length - 1
              ? `guindaste na descrição ${tenant}`
              : `Concreto ${tenant}`,
          pricePerDay: 12.5,
          imageUrl:
            index === 0 ? `https://assets.example.test/${tenant}.jpg` : null,
          images:
            index === 0 ? [`https://assets.example.test/${tenant}.jpg`] : [],
          isAvailable: index !== 10,
          category: {
            id: selected.categoryId,
            name: tenant === 'alfa' ? 'Andaimes' : 'Betoneiras',
            icon: null,
            iconColor: '#ea580c',
            bgColor: '#fff7ed',
            fontColor: '#7c2d12',
            customIcon: null,
          },
          reviews: [],
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
        }))
        .reverse()
  } else if (name === 'busca disponível') {
    body = context.alfa.equipmentIds.slice(0, 8).map((id, index) => ({
      id,
      name: `Betoneira alfa ${String(index).padStart(2, '0')}`,
      description: 'Concreto alfa',
      pricePerDay: '12.5',
      category: { name: 'Andaimes' },
      images: index === 0 ? ['https://assets.example.test/alfa.jpg'] : [],
    }))
  }
  return { status, body: name === 'HEAD' ? '' : body, headers }
}
describe.each(endpoints)(
  '%s — contrato HTTP explícito em cada host',
  (endpoint) => {
    it.each([
      ['alfa', `?tenantSlug=${context.alfa.slug}`, {}, 'GET'],
      ['bravo', `?tenantSlug=${context.bravo.slug}`, {}, 'GET'],
      ['host alfa', '', edge(context.alfa.slug), 'GET'],
      ['host bravo', '', edge(context.bravo.slug), 'GET'],
      ['sem seleção', '', {}, 'GET'],
      ['borda forjada', '', edge(context.alfa.slug, 'wrong-secret'), 'GET'],
      ['desconhecido', '?tenantSlug=unknown', {}, 'GET'],
      ['suspenso', `?tenantSlug=${context.suspended}`, {}, 'GET'],
      ['sem configuração', `?tenantSlug=${context.unconfigured}`, {}, 'GET'],
      ['slug com espaços', `?tenantSlug=%20${context.alfa.slug}%20`, {}, 'GET'],
      [
        'conflito',
        `?tenantSlug=${context.bravo.slug}`,
        edge(context.alfa.slug),
        'GET',
      ],
      ['busca curta', `?tenantSlug=${context.alfa.slug}&q=b`, {}, 'GET'],
      [
        'busca disponível',
        `?tenantSlug=${context.alfa.slug}&q=BETONEIRA`,
        {},
        'GET',
      ],
      [
        'termo com espaços',
        `?tenantSlug=${context.alfa.slug}&q=%20Betoneira%20`,
        {},
        'GET',
      ],
      [
        'primeiro q',
        `?tenantSlug=${context.alfa.slug}&q=b&q=Betoneira`,
        {},
        'GET',
      ],
      ['HEAD', `?tenantSlug=${context.alfa.slug}`, {}, 'HEAD'],
      ['OPTIONS', '', {}, 'OPTIONS'],
      ['POST', `?tenantSlug=${context.alfa.slug}`, {}, 'POST'],
    ] as const)(
      '%s: status, corpo e cabeçalhos esperados',
      async (name, query, headers, method) => {
        for (const origin of parityTargets(context)) {
          const response = await snapshot(
            origin,
            endpoint,
            query,
            headers,
            method
          )
          expect({
            ...response,
            body: response.body ? JSON.parse(response.body) : '',
          }).toEqual(expectedPublic(endpoint, name))
        }
      }
    )
  }
)

describe('RLS real de equipamentos e configurações', () => {
  const pool = new Pool({ connectionString: context.runtimeUrl, max: 1 })
  beforeAll(async () => {
    const { rows } = await pool.query(
      "SELECT c.relname, r.rolsuper, r.rolbypassrls, c.relforcerowsecurity, pg_get_userbyid(c.relowner) = current_user AS owner FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname = current_user AND c.oid IN ('equipments'::regclass, 'settings'::regclass) ORDER BY c.relname"
    )
    expect(rows).toEqual(
      ['equipments', 'settings'].map((relname) => ({
        relname,
        rolsuper: false,
        rolbypassrls: false,
        relforcerowsecurity: true,
        owner: false,
      }))
    )
  })
  afterAll(() => pool.end())
  it.each(['equipments', 'settings'])(
    '%s sem contexto não retorna dados',
    async (table) => {
      expect((await pool.query(`SELECT id FROM ${table}`)).rows).toEqual([])
    }
  )
  it.each(['alfa', 'bravo'] as const)(
    'contexto %s isola as duas tabelas sem WHERE',
    async (tenant) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [
          context[tenant].id,
        ])
        const equipmentRows = (await client.query('SELECT id FROM equipments'))
          .rows
        expect(
          equipmentRows.map((row: { id: string }) => row.id).sort()
        ).toEqual([...context[tenant].equipmentIds].sort())
        expect(
          (await client.query('SELECT "contactEmail" FROM settings')).rows
        ).toEqual([{ contactEmail: `${tenant}@example.test` }])
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }
  )
})
