import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { PrismaClient } from '@prisma/client'
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
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const role = new URL(context.runtimeUrl).searchParams
  .get('options')!
  .slice('-c role='.length)
const created: string[] = []
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[57]!,
}
const payload = { name: '  Fixture created driver  ', phone: '(11) 90000-0000' }
let jar: string
let outsider: string
let saved: Array<{
  id: string
  role: 'CLIENT' | 'ADMIN' | 'OPERATOR' | 'FINANCIAL'
}>
type Options = {
  headers?: Record<string, string | undefined>
  cookie?: string
  body?: string
  query?: string
}
const state = async () => ({
  drivers: await prisma.driver.findMany({
    where: {
      OR: [
        { tenantId: { in: [context.alfa.id, context.bravo.id] } },
        { id: context.drivers.unassigned },
      ],
    },
    orderBy: { id: 'asc' },
  }),
  memberships: await prisma.membership.findMany({
    where: { userId: { in: context.identity.users.map((user) => user.id) } },
    orderBy: { id: 'asc' },
  }),
  users: await prisma.user.findMany({
    where: { id: { in: context.identity.users.map((user) => user.id) } },
    orderBy: { id: 'asc' },
  }),
})
async function request(host: string, options: Options = {}) {
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
    `${host}/api/admin/drivers${options.query ?? ''}`,
    {
      method: 'POST',
      headers,
      body: options.body ?? JSON.stringify(payload),
    }
  )
  const body = await response.json()
  if (response.status === 201) created.push(body.driver.id)
  return {
    status: response.status,
    body,
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
  }
}
/** Issues completos do Zod esperados para cada corpo inválido do motorista (onda 135, B2). */
function driverIssues(value: unknown): unknown[] {
  const invalidType = (
    expected: string,
    received: string,
    path: string[] = []
  ) => ({
    expected,
    code: 'invalid_type',
    path,
    message: `Invalid input: expected ${expected}, received ${received}`,
  })
  const tooSmall = (
    origin: 'string' | 'number',
    path: string,
    message: string
  ) => ({
    origin,
    code: 'too_small',
    minimum: origin === 'string' ? 1 : 0,
    inclusive: true,
    path: [path],
    message,
  })
  if (value === null) return [invalidType('object', 'null')]
  if (Array.isArray(value)) return [invalidType('object', 'array')]
  const row = value as Record<string, unknown>
  if (!Object.keys(row).length)
    return ['name', 'phone'].map((path) =>
      invalidType('string', 'undefined', [path])
    )
  if (row.name === '') return [tooSmall('string', 'name', 'Nome é obrigatório')]
  if (row.phone === '')
    return [tooSmall('string', 'phone', 'Telefone é obrigatório')]
  if (row.cnh === null) return [invalidType('string', 'null', ['cnh'])]
  if (row.cnhCategory === 1)
    return [invalidType('string', 'number', ['cnhCategory'])]
  if (row.status === 'AVAILABLE')
    return [
      {
        code: 'invalid_value',
        values: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'],
        path: ['status'],
        message:
          'Invalid option: expected one of "ACTIVE"|"INACTIVE"|"ON_LEAVE"',
      },
    ]
  throw new Error('Unknown invalid driver fixture')
}
async function refused(
  status: number,
  body: unknown,
  options: Options = {},
  cache: string | null = null
) {
  const before = await state()
  // Cada host da rodada contra a mesma expectativa explícita (onda 135, B2): vale com e sem a raiz.
  for (const host of hosts) {
    const response = await request(host, options)
    expect(response).toEqual({
      status,
      body,
      cache,
      vary: frameworkVary,
      cookie: null,
    })
    expect(await state()).toEqual(before)
  }
}
beforeAll(async () => {
  saved = await prisma.membership.findMany({
    where: { id: { in: context.identity.memberships.slice(0, 2) } },
    select: { id: true, role: true },
  })
  jar = await signInParityUser(context, edge, 0)
  outsider = await signInParityUser(context, edge, 2)
  await prisma.membership.updateMany({
    where: { id: { in: saved.map((row) => row.id) } },
    data: { role: 'ADMIN' },
  })
})
afterEach(async () => {
  await prisma.driver.deleteMany({ where: { id: { in: created } } })
  created.length = 0
})
afterAll(async () => {
  for (const row of saved ?? [])
    await prisma.membership.update({
      where: { id: row.id },
      data: { role: row.role },
    })
  await prisma.$disconnect()
  await pool.end()
})

describe('compiled HTTP driver creation with real identity and tenant RLS', () => {
  it.each([context.alfa, context.bravo])(
    'creates only in the selected tenant %j and preserves the full database DTO',
    async (tenant) => {
      const before = await state()
      for (const host of hosts) {
        const response = await request(host, {
          headers: { 'x-tenant-id': tenant.id },
          query: '?tenantSlug=foreign&status=ON_LEAVE',
          body: JSON.stringify({
            ...payload,
            tenantId:
              tenant.id === context.alfa.id
                ? context.bravo.id
                : context.alfa.id,
            id: 'forged',
            role: 'ADMIN',
            createdAt: 'forged',
            extra: true,
          }),
        })
        expect(response.status).toBe(201)
        const row = await prisma.driver.findUniqueOrThrow({
          where: { id: response.body.driver.id },
        })
        expect(response.body).toEqual({
          driver: JSON.parse(JSON.stringify(row)),
        })
        expect(row).toMatchObject({
          tenantId: tenant.id,
          ...payload,
          status: 'ACTIVE',
          cnh: null,
          cnhCategory: null,
        })
        expect(row.id).not.toBe('forged')
        expect(response.cache).toBeNull()
        expect(response.vary).toBe(frameworkVary)
        expect(response.cookie).toBeNull()
        const after = await state()
        expect(after.users).toEqual(before.users)
        expect(after.memberships).toEqual(before.memberships)
        expect(
          after.drivers.filter((driver) => !created.includes(driver.id))
        ).toEqual(before.drivers)
      }
    }
  )
  it.each(['ACTIVE', 'INACTIVE', 'ON_LEAVE'])(
    'preserves explicit status %s, raw CNH/category, whitespace names and phones',
    async (status) => {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({
            name: ' ',
            phone: '\t',
            cnh: '  ABC-123  ',
            cnhCategory: ' B ',
            status,
          }),
        })
        expect(response.status).toBe(201)
        expect(response.body.driver).toMatchObject({
          name: ' ',
          phone: '\t',
          cnh: '  ABC-123  ',
          cnhCategory: ' B ',
          status,
          tenantId: context.alfa.id,
        })
      }
    }
  )
  it('keeps repeated and parallel POSTs non-idempotent', async () => {
    for (const host of hosts) {
      const first = await request(host)
      const second = await request(host)
      const parallel = await Promise.all([request(host), request(host)])
      const responses = [first, second, ...parallel]
      expect(responses.map((response) => response.status)).toEqual([
        201, 201, 201, 201,
      ])
      // parity-scan: quatro POSTs reais no mesmo host criam quatro motoristas distintos (sem idempotência).
      expect(
        new Set(responses.map((response) => response.body.driver.id)).size
      ).toBe(4)
    }
  })
  it('matching tenant cookie works without a selection header', async () => {
    for (const host of hosts) {
      const response = await request(host, {
        headers: { 'x-tenant-id': undefined },
        cookie: `${jar}; selected-tenant-id=${context.alfa.id}`,
      })
      expect(response.status).toBe(201)
      expect(response.body.driver.tenantId).toBe(context.alfa.id)
    }
  })
  it('no selection is a 409 before parsing', async () => {
    await refused(
      409,
      { error: 'Select an organization' },
      { headers: { 'x-tenant-id': undefined }, body: '{' }
    )
  })
  it('conflicting header and cookie cannot choose either tenant', async () => {
    await refused(
      400,
      { error: 'Conflicting tenant selection' },
      { cookie: `${jar}; selected-tenant-id=${context.bravo.id}` }
    )
  })
  it('invalid tenant selector is a 400', async () => {
    await refused(
      400,
      { error: 'Invalid tenant selection' },
      { headers: { 'x-tenant-id': 'invalid/id' } }
    )
  })
  it.each(['unknown-driver-fixture', context.suspended])(
    'unavailable tenant host %s is neutral before body parsing',
    async (slug) => {
      await refused(
        404,
        { error: 'Locadora não encontrada' },
        {
          headers: {
            'x-platform-host-kind': 'tenant',
            'x-platform-tenant-slug': slug,
            'x-platform-origin': `https://${slug}.platform.test`,
            'x-tenant-id': undefined,
          },
          body: '{',
        },
        'no-store'
      )
    }
  )
  it.each([
    'selected-tenant-id=%',
    `selected-tenant-id=${context.alfa.id}; selected-tenant-id=${context.alfa.id}`,
  ])('invalid or duplicated cookie %s is refused', async (cookie) => {
    await refused(
      400,
      { error: 'Invalid tenant selection' },
      { cookie: `${jar}; ${cookie}`, body: '{' }
    )
  })
  it('a genuine app Origin can create; forged host context cannot override the explicit tenant', async () => {
    for (const host of hosts) {
      const response = await request(host, {
        headers: {
          Origin: edge['x-platform-origin'],
          'Sec-Fetch-Site': 'same-origin',
        },
      })
      expect(response.status).toBe(201)
      expect(response.body.driver.tenantId).toBe(context.alfa.id)
      const forged = await request(host, {
        headers: {
          'x-platform-edge-auth': 'forged',
          'x-platform-host-kind': 'tenant',
          'x-platform-tenant-slug': context.bravo.slug,
          'x-platform-origin': `https://${context.bravo.slug}.platform.test`,
        },
      })
      expect(forged.status).toBe(201)
      expect(forged.body.driver.tenantId).toBe(context.alfa.id)
    }
  })
  it.each(['CLIENT', 'OPERATOR', 'FINANCIAL'] as const)(
    'global ADMIN with tenant role %s cannot create, before body validation',
    async (membershipRole) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({
        where: { id },
        data: { role: membershipRole },
      })
      try {
        await refused(403, { error: 'Forbidden' }, { body: '{' })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'ADMIN' },
        })
      }
    }
  )
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'inactive membership %s cannot write',
    async (status) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({ where: { id }, data: { status } })
      try {
        await refused(403, { error: 'Organization access denied' })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('no session is a 401 before parsing', async () => {
    await refused(
      401,
      { error: 'Authentication required' },
      { cookie: '', body: '{' }
    )
  })
  it('global ADMIN with no membership cannot create', async () => {
    await refused(
      403,
      { error: 'Organization access denied' },
      { cookie: outsider }
    )
  })
  it.each<Record<string, string>>([
    { Origin: 'https://bravo.platform.test' },
    { Origin: 'null' },
    { Origin: edge['x-platform-origin'], 'Sec-Fetch-Site': 'same-site' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('CSRF %j is rejected before malformed JSON', async (headers) => {
    await refused(
      403,
      { error: 'Origem não permitida' },
      { headers, body: '{' },
      'no-store'
    )
  })
  it.each(['{', '', 'undefined'])(
    'malformed JSON %s retains generic 500 with no writes',
    async (body) => {
      await refused(500, { error: 'Internal server error' }, { body })
    }
  )
  it.each([
    { value: null },
    { value: [] },
    { value: {} },
    { value: { ...payload, name: '' } },
    { value: { ...payload, phone: '' } },
    { value: { ...payload, cnh: null } },
    { value: { ...payload, cnhCategory: 1 } },
    { value: { ...payload, status: 'AVAILABLE' } },
  ])(
    'validation %j remains identical, without persistence',
    async ({ value }) => {
      const before = await state()
      // Cada host contra o envelope e os issues explícitos do contrato (onda 135, B2).
      for (const host of hosts) {
        const response = await request(host, { body: JSON.stringify(value) })
        expect(response).toEqual({
          status: 400,
          body: { error: 'Validation error', details: driverIssues(value) },
          cache: null,
          vary: frameworkVary,
          cookie: null,
        })
        expect(await state()).toEqual(before)
      }
    }
  )
  it('a trusted tenant host can select only its own organization', async () => {
    const headers = {
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': context.alfa.slug,
      'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
    }
    for (const host of hosts) {
      const response = await request(host, {
        headers: { ...headers, Origin: headers['x-platform-origin'] },
      })
      expect(response.status).toBe(201)
      expect(response.body.driver.tenantId).toBe(context.alfa.id)
    }
    await refused(
      400,
      { error: 'Conflicting tenant selection' },
      { headers: { ...headers, 'x-tenant-id': context.bravo.id } }
    )
  })
  it('INSERT permission failure stays generic and leaves the database unchanged', async () => {
    await alterSharedAcl(pool, `REVOKE INSERT ON drivers FROM ${role}`)
    try {
      await refused(500, { error: 'Internal server error' })
    } finally {
      await alterSharedAcl(pool, `GRANT INSERT ON drivers TO ${role}`)
    }
  })
  it('RLS rejects INSERT without tenant context or with another tenant context', async () => {
    const connection = await pool.connect()
    try {
      for (const tenant of ['', context.bravo.id]) {
        await connection.query('BEGIN')
        await connection.query(`SET LOCAL ROLE ${role}`)
        if (tenant)
          await connection.query(
            "SELECT set_config('app.tenant_id', $1, true)",
            [tenant]
          )
        await expect(
          connection.query(
            'INSERT INTO drivers (id, "tenantId", name, phone, "updatedAt") VALUES ($1,$2,$3,$4,now())',
            [randomUUID(), context.alfa.id, 'Fixture denied', 'fixture']
          )
        ).rejects.toMatchObject({ code: '42501' })
        await connection.query('ROLLBACK')
      }
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
  })
  it('an AFTER INSERT failure rolls the driver back and exposes no database details', async () => {
    const name = `api_driver_fault_${randomUUID().replaceAll('-', '')}`
    const marker = `fixture-${name}`
    const before = await state()
    await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.name = '${marker}' THEN RAISE EXCEPTION 'private fixture driver failure'; END IF;
      RETURN NEW;
    END $$`)
    try {
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT ON drivers FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      await refused(
        500,
        { error: 'Internal server error' },
        { body: JSON.stringify({ ...payload, name: marker }) }
      )
      expect(await state()).toEqual(before)
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON drivers`)
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
})
