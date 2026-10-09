import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { PrismaClient, type Permission, type Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const hosts = parityTargets(context)
const role = new URL(context.runtimeUrl).searchParams
  .get('options')!
  .slice('-c role='.length)
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[60]!,
}
const created: string[] = []
const permissions: string[] = []
let jar: string
let outsider: string
let saved: Array<{ id: string; role: Role }>
let fixtureWriteGrant: Permission | undefined
type Options = {
  body?: string
  cookie?: string
  headers?: Record<string, string | undefined>
}
const payload = () => ({
  name: `Equipment-${randomUUID()}`,
  description: 'Description',
  pricePerDay: 12.5,
  categoryId: context.alfa.categoryId,
})
const snapshot = async () => ({
  equipments: await prisma.equipment.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  units: await prisma.equipmentUnit.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  categories: await prisma.category.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
})
async function request(host: string, options: Options = {}, method = 'POST') {
  const headers = Object.fromEntries(
    Object.entries({
      ...edge,
      Cookie: options.cookie ?? jar,
      'x-tenant-id': context.alfa.id,
      'Content-Type': 'application/json',
      ...options.headers,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  const response = await fetch(
    `${host}/api/admin/equipments?tenantId=foreign&role=ADMIN`,
    {
      method,
      headers,
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? { body: options.body ?? JSON.stringify(payload()) }
        : {}),
    }
  )
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (response.status === 201) created.push(body.id)
  return {
    status: response.status,
    body,
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
    limit: response.headers.get('x-ratelimit-limit'),
    remaining: response.headers.get('x-ratelimit-remaining'),
    reset: response.headers.get('x-ratelimit-reset'),
    retry: response.headers.get('retry-after'),
  }
}
async function refused(
  status: number,
  error: string,
  options: Options = {},
  cache: string | null = null
) {
  const before = await snapshot()
  for (const host of hosts) {
    expect(await request(host, options)).toEqual({
      status,
      body: { error },
      cache,
      vary: frameworkVary,
      cookie: null,
      allow: null,
      limit: null,
      remaining: null,
      reset: null,
      retry: null,
    })
    expect(await snapshot()).toEqual(before)
  }
}
async function cleanup() {
  await prisma.equipment.deleteMany({ where: { id: { in: created } } })
  created.length = 0
}
async function asRole(value: Role, operation: () => Promise<void>) {
  const id = context.identity.memberships[0]!
  await prisma.membership.update({ where: { id }, data: { role: value } })
  try {
    await operation()
  } finally {
    await prisma.membership.update({ where: { id }, data: { role: 'ADMIN' } })
  }
}
async function grant(
  tenantId: string,
  memberRole: Role,
  action = 'WRITE',
  module = 'EQUIPMENTS'
) {
  const row = await prisma.permission.create({
    data: { tenantId, role: memberRole, action, module },
  })
  permissions.push(row.id)
  return row.id
}
beforeAll(async () => {
  saved = await prisma.membership.findMany({
    where: { id: { in: context.identity.memberships.slice(0, 2) } },
    select: { id: true, role: true },
  })
  jar = await signInParityUser(context, edge, 0)
  outsider = await signInParityUser(context, edge, 2)
  fixtureWriteGrant = await prisma.permission.findUniqueOrThrow({
    where: { id: context.permissions.wrongAction },
  })
  expect(fixtureWriteGrant).toMatchObject({
    tenantId: context.alfa.id,
    role: 'FINANCIAL',
    module: 'EQUIPMENTS',
    action: 'WRITE',
  })
  await prisma.permission.delete({ where: { id: fixtureWriteGrant.id } })
  await prisma.membership.updateMany({
    where: { id: { in: saved.map((row) => row.id) } },
    data: { role: 'ADMIN' },
  })
})
afterEach(async () => {
  await cleanup()
  await prisma.permission.deleteMany({ where: { id: { in: permissions } } })
  permissions.length = 0
})
afterAll(async () => {
  if (fixtureWriteGrant)
    await prisma.permission.upsert({
      where: { id: fixtureWriteGrant.id },
      create: fixtureWriteGrant,
      update: fixtureWriteGrant,
    })
  for (const row of saved ?? [])
    await prisma.membership.update({
      where: { id: row.id },
      data: { role: row.role },
    })
  await prisma.$disconnect()
  await pool.end()
})

describe('administrative equipment creation with real sessions and RLS', () => {
  it.each([context.alfa, context.bravo])(
    'ADMIN creates in %j with normalized complete DTO and tenant ownership',
    async (tenant) => {
      const before = await snapshot()
      const input = {
        ...payload(),
        categoryId: tenant.categoryId,
        name: ' Equipment ',
        description: ' Description ',
        pricePerDay: '12.5suffix',
        images: [' image ', '', ' ', null, 7, 'second.jpg'],
        isAvailable: false,
        maxStock: 0,
        dailyDiscount: -2,
        weeklyDiscount: 150,
        biweeklyDiscount: 25,
        monthlyDiscount: 60,
        popularPeriod: 'monthly',
        dailyDirectValue: 1.25,
        weeklyDirectValue: 2.345,
        biweeklyDirectValue: 3.5,
        monthlyDirectValue: 4.67,
        dailyUseDirectValue: true,
        weeklyUseDirectValue: true,
        biweeklyUseDirectValue: true,
        monthlyUseDirectValue: true,
        dailyRentalEnabled: false,
        weeklyRentalEnabled: false,
        biweeklyRentalEnabled: true,
        monthlyRentalEnabled: true,
        tenantId: 'foreign',
        id: 'forged',
        available: true,
        specifications: { extra: 'ignored' },
        unknown: true,
      }
      const category = JSON.parse(
        JSON.stringify(
          before.categories.find((row) => row.id === tenant.categoryId)
        )
      )
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify(input),
          headers: {
            'x-tenant-id': tenant.id,
            Origin: edge['x-platform-origin'],
            'Sec-Fetch-Site': 'same-origin',
          },
        })
        expect(response.status).toBe(201)
        const stored = await prisma.equipment.findUniqueOrThrow({
          where: { id: response.body.id },
          include: { category: true },
        })
        expect(response.body).toEqual({
          ...JSON.parse(JSON.stringify(stored)),
          pricePerDay: Number(stored.pricePerDay),
          isAvailable: stored.available,
        })
        // DTO completo esperado, montado da entrada e da categoria da fixture (onda 135, B2).
        expect(response.body).toEqual({
          id: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          tenantId: tenant.id,
          name: 'Equipment',
          description: 'Description',
          pricePerDay: 12.5,
          categoryId: tenant.categoryId,
          category,
          images: [' image ', 'second.jpg'],
          available: false,
          isAvailable: false,
          maxStock: 0,
          dailyDiscount: 0,
          weeklyDiscount: 100,
          biweeklyDiscount: 25,
          monthlyDiscount: 60,
          popularPeriod: 'monthly',
          dailyDirectValue: '1.25',
          weeklyDirectValue: '2.345',
          biweeklyDirectValue: '3.5',
          monthlyDirectValue: '4.67',
          dailyUseDirectValue: true,
          weeklyUseDirectValue: true,
          biweeklyUseDirectValue: true,
          monthlyUseDirectValue: true,
          dailyRentalEnabled: false,
          weeklyRentalEnabled: false,
          biweeklyRentalEnabled: true,
          monthlyRentalEnabled: true,
          specifications: null,
          depreciationRate: null,
          hourMeter: null,
          odometer: null,
          purchaseDate: null,
          purchasePrice: null,
          partsLossHistory: null,
          partsLossCount: 0,
        })
        expect(response.body.id).not.toBe('forged')
        expect(response.body).not.toHaveProperty('_count')
        expect(response.body.category.tenantId).toBe(tenant.id)
        expect(response).toMatchObject({
          cache: null,
          vary: frameworkVary,
          cookie: null,
          limit: null,
        })
        const after = await snapshot()
        expect(after.units).toEqual(before.units)
        expect(after.categories).toEqual(before.categories)
        expect(
          after.equipments.filter((row) => !created.includes(row.id))
        ).toEqual(before.equipments)
        await cleanup()
      }
    }
  )
  it.each([
    { label: 'numeric-zero', pricePerDay: 0 },
    { label: 'string-zero', pricePerDay: '0' },
    { label: 'padded-decimal', pricePerDay: ' 12.50 ' },
    { label: 'numeric-prefix', pricePerDay: '19.5suffix' },
  ])(
    'price $label retains existing parseFloat coercion and numeric DTO',
    async ({ pricePerDay }) => {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({ ...payload(), pricePerDay }),
        })
        expect(response.status).toBe(201)
        expect(response.body.pricePerDay).toBe(
          Number.parseFloat(String(pricePerDay))
        )
      }
    }
  )
  it.each([undefined, 'ignored'])(
    'optional fields default on omission/wrong type %s',
    async (value) => {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({
            ...payload(),
            images: value,
            isAvailable: value,
            maxStock: value,
            dailyDiscount: value,
            dailyDirectValue: value,
            dailyUseDirectValue: value,
            dailyRentalEnabled: value,
            popularPeriod: value === undefined ? undefined : 1,
          }),
        })
        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          images: [],
          available: true,
          isAvailable: true,
          maxStock: 1,
          dailyDiscount: 0,
          weeklyDiscount: 0,
          biweeklyDiscount: 0,
          monthlyDiscount: 0,
          popularPeriod: 'weekly',
          dailyDirectValue: '0',
          weeklyDirectValue: '0',
          biweeklyDirectValue: '0',
          monthlyDirectValue: '0',
          dailyUseDirectValue: false,
          weeklyUseDirectValue: false,
          biweeklyUseDirectValue: false,
          monthlyUseDirectValue: false,
          dailyRentalEnabled: true,
          weeklyRentalEnabled: true,
          biweeklyRentalEnabled: true,
          monthlyRentalEnabled: true,
        })
      }
    }
  )
  it.each([
    [{}, 'Nome do equipamento é obrigatório.'],
    [{ ...payload(), name: ' ' }, 'Nome do equipamento é obrigatório.'],
    [{ ...payload(), name: 1 }, 'Nome do equipamento é obrigatório.'],
    [
      { ...payload(), description: '' },
      'Descrição do equipamento é obrigatória.',
    ],
    [
      { ...payload(), description: null },
      'Descrição do equipamento é obrigatória.',
    ],
    [{ ...payload(), categoryId: '' }, 'ID da categoria é obrigatório.'],
    [{ ...payload(), pricePerDay: null }, 'Preço por dia é obrigatório.'],
    [
      { ...payload(), pricePerDay: 'invalid' },
      'Preço por dia inválido. Deve ser um número positivo.',
    ],
    [
      { ...payload(), pricePerDay: -1 },
      'Preço por dia inválido. Deve ser um número positivo.',
    ],
    [[], 'Nome do equipamento é obrigatório.'],
    [false, 'Nome do equipamento é obrigatório.'],
  ] as const)(
    'invalid body %j retains domain 400 with no effects',
    async (body, error) => {
      await refused(400, error, { body: JSON.stringify(body) })
    }
  )
  it.each(['{', '', 'undefined', 'null'])(
    'malformed/null body %s remains production generic 500',
    async (body) => {
      await refused(500, 'Erro interno do servidor ao criar equipamento.', {
        body,
      })
    }
  )
  it.each([
    { label: 'foreign-tenant', categoryId: context.bravo.categoryId },
    { label: 'unknown', categoryId: randomUUID() },
  ])('category $label is neutral 404', async ({ categoryId }) => {
    await refused(404, 'Categoria não encontrada.', {
      body: JSON.stringify({ ...payload(), categoryId }),
    })
  })
  it('non-UUID category retains generic database-code 400', async () => {
    await refused(400, 'Erro ao processar dados do equipamento.', {
      body: JSON.stringify({ ...payload(), categoryId: 'not-a-uuid' }),
    })
  })
  it('fractional integer fields retain the legacy integer coercion', async () => {
    const before = await snapshot()
    for (const field of ['maxStock', 'dailyDiscount'] as const) {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({ ...payload(), [field]: 1.5 }),
        })
        expect(response.status).toBe(201)
        expect(response.body[field]).toBe(1)
        const stored = await prisma.equipment.findUniqueOrThrow({
          where: { id: response.body.id },
        })
        expect(stored[field]).toBe(1)
        expect(stored.tenantId).toBe(context.alfa.id)
      }
    }
    const after = await snapshot()
    expect(after.units).toEqual(before.units)
    expect(after.categories).toEqual(before.categories)
  })
  it.each(['OPERATOR', 'FINANCIAL'] as const)(
    '%s requires a live WRITE grant',
    async (memberRole) => {
      await asRole(memberRole, async () => {
        await refused(403, 'Permissão insuficiente nesta locadora', {
          body: '{',
        })
        const id = await grant(context.alfa.id, memberRole)
        for (const host of hosts) expect((await request(host)).status).toBe(201)
        await prisma.permission.delete({ where: { id } })
        await refused(403, 'Permissão insuficiente nesta locadora', {
          body: '{',
        })
      })
    }
  )
  it('READ/DELETE, other module/role/tenant do not authorize; CLIENT stays denied with a grant', async () => {
    await asRole('FINANCIAL', async () => {
      for (const [tenant, memberRole, module, action] of [
        [context.alfa.id, 'FINANCIAL', 'EQUIPMENTS', 'READ'],
        [context.alfa.id, 'FINANCIAL', 'EQUIPMENTS', 'DELETE'],
        [context.alfa.id, 'FINANCIAL', 'QUOTES', 'WRITE'],
        [context.bravo.id, 'FINANCIAL', 'EQUIPMENTS', 'WRITE'],
        [context.alfa.id, 'OPERATOR', 'EQUIPMENTS', 'WRITE'],
      ] as const) {
        const id = await grant(tenant, memberRole, action, module)
        await refused(403, 'Permissão insuficiente nesta locadora', {
          body: '{',
        })
        await prisma.permission.delete({ where: { id } })
      }
    })
    await asRole('CLIENT', async () => {
      await grant(context.alfa.id, 'CLIENT')
      await refused(403, 'Acesso administrativo não permitido', { body: '{' })
    })
  })
  it('no session/global ADMIN without membership refuses before malformed body', async () => {
    await refused(401, 'Authentication required', { cookie: '', body: '{' })
    await refused(403, 'Organization access denied', {
      cookie: outsider,
      body: '{',
    })
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'membership %s refuses before parsing',
    async (status) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({ where: { id }, data: { status } })
      try {
        await refused(403, 'Organization access denied', { body: '{' })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('organization suspension refuses before parsing', async () => {
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'SUSPENDED' },
      })
    )
    try {
      await refused(403, 'Organization access denied', { body: '{' })
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it('missing and conflicting selectors retain their errors', async () => {
    await refused(409, 'Select an organization', {
      headers: { 'x-tenant-id': undefined },
      body: '{',
    })
    await refused(400, 'Conflicting tenant selection', {
      cookie: `${jar}; selected-tenant-id=${context.bravo.id}`,
      body: '{',
    })
  })
  it('tenant host supplies selection and rejects conflicting explicit selector', async () => {
    const headers = {
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': context.alfa.slug,
      'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
      'x-tenant-id': undefined,
    }
    for (const host of hosts)
      expect((await request(host, { headers })).status).toBe(201)
    await refused(400, 'Conflicting tenant selection', {
      headers: { ...headers, 'x-tenant-id': context.bravo.id },
      body: '{',
    })
  })
  it.each<Record<string, string>>([
    { Origin: 'https://bravo.platform.test' },
    { Origin: 'null' },
    { Origin: edge['x-platform-origin'], 'Sec-Fetch-Site': 'same-site' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('CSRF %j refuses before malformed body', async (headers) => {
    await refused(
      403,
      'Origem não permitida',
      { headers, body: '{' },
      'no-store'
    )
  })
  it('same payload/name concurrently creates separate equipment rows as before', async () => {
    const input = payload()
    const results = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host) =>
        request(host, { body: JSON.stringify(input) })
      )
    )
    expect(results.map((response) => response.status)).toEqual([201, 201])
    // parity-scan: duas criações reais e simultâneas (raiz e API, ou a API duas vezes) geram dois IDs distintos.
    expect(new Set(results.map((response) => response.body.id)).size).toBe(2)
    expect(
      await prisma.equipment.count({
        where: { tenantId: context.alfa.id, name: input.name },
      })
    ).toBe(2)
  })
  it('revoked INSERT returns production generic database-code 400 without effects', async () => {
    await alterSharedAcl(pool, `REVOKE INSERT ON equipments FROM ${role}`)
    try {
      await refused(400, 'Erro ao processar dados do equipamento.')
    } finally {
      await alterSharedAcl(pool, `GRANT INSERT ON equipments TO ${role}`)
    }
  })
  it('RLS rejects missing/foreign GUC and composite FK rejects foreign category under own GUC', async () => {
    const before = await snapshot()
    const connection = await pool.connect()
    try {
      for (const [tenant, categoryId, code] of [
        ['', context.alfa.categoryId, '42501'],
        [context.bravo.id, context.alfa.categoryId, '42501'],
        [context.alfa.id, context.bravo.categoryId, '23503'],
        [context.alfa.id, context.alfa.categoryId, null],
      ] as const) {
        await connection.query('BEGIN')
        await connection.query(`SET LOCAL ROLE ${role}`)
        if (tenant)
          await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
            tenant,
          ])
        const operation = connection.query(
          'INSERT INTO equipments (id,"tenantId",name,description,"categoryId",images,"pricePerDay","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
          [
            randomUUID(),
            context.alfa.id,
            'RLS Probe',
            'Description',
            categoryId,
            [],
            12.5,
          ]
        )
        if (code) await expect(operation).rejects.toMatchObject({ code })
        else expect((await operation).rowCount).toBe(1)
        await connection.query('ROLLBACK')
      }
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
    expect(await snapshot()).toEqual(before)
  })
  it('AFTER INSERT failure rolls back equipment without category/unit changes', async () => {
    const name = `api_equipment_fault_${randomUUID().replaceAll('-', '')}`
    const marker = `Rollback-${randomUUID()}`
    await pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = '${marker}' THEN RAISE EXCEPTION 'private fixture error'; END IF; RETURN NULL; END $$`
    )
    try {
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT ON equipments FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      await refused(400, 'Erro ao processar dados do equipamento.', {
        body: JSON.stringify({ ...payload(), name: marker }),
      })
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON equipments`)
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
  it('GET/POST consume the same fixed window before auth; hosts keep independent counters', async () => {
    const started = Date.now()
    const headers = {
      'x-platform-client-ip': context.directory.ips[54]!,
      Origin: edge['x-platform-origin'],
      'Sec-Fetch-Site': 'same-origin',
    }
    const before = await snapshot()
    for (const [index, host] of hosts.entries()) {
      let first = 0
      if (index > 0) {
        expect(
          (await request(host, { headers, cookie: '', body: '{' })).status
        ).toBe(401)
        first = 1
      }
      for (let index = first; index < 200; index++)
        expect(
          (
            await request(
              host,
              { headers, cookie: '', body: '{' },
              index % 2 ? 'POST' : 'GET'
            )
          ).status
        ).toBe(401)
      const response = await request(host, {
        headers: {
          ...headers,
          'x-real-ip': '198.51.100.99',
          'x-forwarded-for': '198.51.100.100',
        },
        cookie: '',
        body: '{',
      })
      expect(response.status).toBe(429)
      expect(response.limit).toBe('200')
      expect(response.remaining).toBe('0')
      expect(response.body).toEqual({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Number(response.retry),
      })
      expect(Number(response.retry)).toBeGreaterThanOrEqual(1)
      expect(Number(response.retry)).toBeLessThanOrEqual(60)
      expect(Number(response.reset) * 1000).toBeGreaterThanOrEqual(
        started + 60_000
      )
      expect(Number(response.reset) * 1000).toBeLessThanOrEqual(
        Date.now() + 61_000
      )
      expect((await request(host, { headers, cookie: '' }, 'GET')).status).toBe(
        429
      )
      const head = await request(host, { headers, cookie: '' }, 'HEAD')
      expect(head.status).toBe(429)
      expect(head.body).toBeNull()
    }
    expect(await snapshot()).toEqual(before)
  })
  it('OPTIONS advertises POST and PUT/PATCH/DELETE remain unsupported', async () => {
    for (const host of hosts) {
      const response = await request(host, {}, 'OPTIONS')
      expect({
        ...response,
        allow: response.allow?.split(', ').sort(),
      }).toEqual({
        status: 204,
        body: null,
        cache: null,
        vary: frameworkVary,
        cookie: null,
        allow: ['GET', 'HEAD', 'OPTIONS', 'POST'],
        limit: null,
        remaining: null,
        reset: null,
        retry: null,
      })
      for (const method of ['PUT', 'PATCH', 'DELETE'])
        expect((await request(host, {}, method)).status).toBe(405)
    }
  })
})
