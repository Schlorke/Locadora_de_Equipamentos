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
  'x-platform-client-ip': context.directory.ips[58]!,
}
let jar: string
let outsider: string
let saved: Array<{ id: string; role: Role }>
let fixtureWriteGrant: Permission | undefined
const created: string[] = []
const permissions: string[] = []
type Options = {
  body?: string
  cookie?: string
  headers?: Record<string, string | undefined>
}
const payload = (uniqueCode = `Fixture-unit-${randomUUID()}`) => ({
  equipmentId: context.alfa.equipmentIds[0]!,
  uniqueCode,
})
const snapshot = async () => ({
  units: await prisma.equipmentUnit.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  equipments: await prisma.equipment.findMany({
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
    `${host}/api/admin/equipment-units?tenantId=foreign&role=ADMIN`,
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
  }
}
/** Issues completos do Zod esperados para cada corpo inválido da unidade (onda 135, B2). */
function unitIssues(value: unknown): unknown[] {
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
  const row = value as Record<string, unknown>
  if (!Object.keys(row).length)
    return ['equipmentId', 'uniqueCode'].map((path) =>
      invalidType('string', 'undefined', [path])
    )
  if (row.uniqueCode === '')
    return [tooSmall('string', 'uniqueCode', 'Código único é obrigatório')]
  if (row.hourMeter === -1)
    return [
      tooSmall('number', 'hourMeter', 'Too small: expected number to be >=0'),
    ]
  if (row.odometer === '1')
    return [invalidType('number', 'string', ['odometer'])]
  if (row.serialNumber === null)
    return [invalidType('string', 'null', ['serialNumber'])]
  throw new Error('Unknown invalid equipment-unit fixture')
}
async function refused(
  status: number,
  body: unknown,
  options: Options = {},
  cache: string | null = null,
  targets: readonly string[] = hosts
) {
  const before = await snapshot()
  // Cada host da rodada contra a mesma expectativa explícita (onda 135, B2): vale com e sem a raiz.
  for (const host of targets) {
    const response = await request(host, options)
    expect(response).toEqual({
      status,
      body,
      cache,
      vary: frameworkVary,
      cookie: null,
      allow: null,
    })
    expect(await snapshot()).toEqual(before)
  }
}
async function cleanup() {
  await prisma.equipmentUnit.deleteMany({ where: { id: { in: created } } })
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
    data: { tenantId, role: memberRole, module, action },
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

describe('compiled HTTP equipment-unit creation with tenant ACL, stock fidelity and RLS', () => {
  it.each([context.alfa, context.bravo])(
    'ADMIN creates in selected tenant %j with full DTO and no stock/availability change',
    async (tenant) => {
      const before = await snapshot()
      const input = {
        ...payload(`  Code ${randomUUID()}  `),
        equipmentId: tenant.equipmentIds[0]!,
        serialNumber: ' Serial ',
        notes: ' Notes ',
        hourMeter: 12.345,
        odometer: 45.67,
        status: 'RENTED',
        tenantId: context.bravo.id,
        id: 'forged-id',
        extra: true,
      }
      const label = tenant.id === context.alfa.id ? 'alfa' : 'bravo'
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
        const row = await prisma.equipmentUnit.findUniqueOrThrow({
          where: { id: response.body.id },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                category: { select: { name: true } },
              },
            },
          },
        })
        expect(response.body).toEqual(JSON.parse(JSON.stringify(row)))
        expect(response.body).toMatchObject({
          tenantId: tenant.id,
          equipmentId: input.equipmentId,
          uniqueCode: input.uniqueCode,
          serialNumber: ' Serial ',
          notes: ' Notes ',
          status: 'AVAILABLE',
          hourMeter: '12.345',
          odometer: '45.67',
        })
        expect(response.body.id).not.toBe('forged-id')
        // DTO completo esperado, montado da entrada e do equipamento da fixture (onda 135, B2).
        expect(response.body).toEqual({
          id: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          tenantId: tenant.id,
          equipmentId: input.equipmentId,
          uniqueCode: input.uniqueCode,
          status: 'AVAILABLE',
          hourMeter: '12.345',
          odometer: '45.67',
          serialNumber: ' Serial ',
          notes: ' Notes ',
          equipment: {
            id: input.equipmentId,
            name: `Betoneira ${label} 00`,
            category: { name: label === 'alfa' ? 'Andaimes' : 'Betoneiras' },
          },
        })
        expect(response.cache).toBeNull()
        expect(response.cookie).toBeNull()
        expect(response.vary).toBe(frameworkVary)
        const after = await snapshot()
        expect(after.equipments).toEqual(before.equipments)
        expect(
          after.units.filter((unit) => !created.includes(unit.id))
        ).toEqual(before.units)
        await cleanup()
      }
    }
  )
  it.each([undefined, 0])(
    'zero/omitted meters %s are null and omitted text fields retain null defaults',
    async (meter) => {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({
            ...payload(),
            hourMeter: meter,
            odometer: meter,
          }),
        })
        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
          hourMeter: null,
          odometer: null,
          serialNumber: null,
          notes: null,
        })
        const stored = await prisma.equipmentUnit.findUniqueOrThrow({
          where: { id: response.body.id },
        })
        expect(stored.hourMeter).toBeNull()
        expect(stored.odometer).toBeNull()
      }
    }
  )
  it('whitespace-only uniqueCode and empty serial/notes are accepted without trim', async () => {
    for (const host of hosts) {
      const response = await request(host, {
        body: JSON.stringify({ ...payload(' '), serialNumber: '', notes: '' }),
      })
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        uniqueCode: ' ',
        serialNumber: '',
        notes: '',
      })
      await cleanup()
    }
  })
  it.each([2, 10])(
    'creation on zero-stock/unavailable equipment %s retains existing policy without changing it',
    async (index) => {
      const before = await snapshot()
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({
            ...payload(),
            equipmentId: context.alfa.equipmentIds[index]!,
          }),
        })
        expect(response.status).toBe(201)
        expect(response.body.status).toBe('AVAILABLE')
      }
      expect((await snapshot()).equipments).toEqual(before.equipments)
    }
  )
  it.each(['OPERATOR', 'FINANCIAL'] as const)(
    '%s requires a live WRITE grant and loses access on revocation',
    async (memberRole) => {
      await asRole(memberRole, async () => {
        await refused(
          403,
          { error: 'Permissão insuficiente nesta locadora' },
          { body: '{' }
        )
        const id = await grant(context.alfa.id, memberRole)
        for (const host of hosts) expect((await request(host)).status).toBe(201)
        await prisma.permission.delete({ where: { id } })
        await refused(
          403,
          { error: 'Permissão insuficiente nesta locadora' },
          { body: '{' }
        )
      })
    }
  )
  it('READ/DELETE, wrong module/role/tenant do not authorize WRITE', async () => {
    await asRole('FINANCIAL', async () => {
      for (const [tenant, memberRole, module, action] of [
        [context.alfa.id, 'FINANCIAL', 'EQUIPMENTS', 'READ'],
        [context.alfa.id, 'FINANCIAL', 'EQUIPMENTS', 'DELETE'],
        [context.alfa.id, 'FINANCIAL', 'QUOTES', 'WRITE'],
        [context.alfa.id, 'OPERATOR', 'EQUIPMENTS', 'WRITE'],
        [context.bravo.id, 'FINANCIAL', 'EQUIPMENTS', 'WRITE'],
      ] as const) {
        const id = await grant(tenant, memberRole, action, module)
        await refused(403, { error: 'Permissão insuficiente nesta locadora' })
        await prisma.permission.delete({ where: { id } })
      }
    })
  })
  it('CLIENT cannot create even with an exact WRITE grant', async () => {
    await asRole('CLIENT', async () => {
      await grant(context.alfa.id, 'CLIENT')
      await refused(
        403,
        { error: 'Acesso administrativo não permitido' },
        { body: '{' }
      )
    })
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'membership %s is denied before parsing',
    async (status) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({ where: { id }, data: { status } })
      try {
        await refused(
          403,
          { error: 'Organization access denied' },
          { body: '{' }
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('inactive organization is denied before parsing', async () => {
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'SUSPENDED' },
      })
    )
    try {
      await refused(403, { error: 'Organization access denied' }, { body: '{' })
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it('no session is denied before malformed body', async () => {
    await refused(
      401,
      { error: 'Authentication required' },
      { cookie: '', body: '{' }
    )
  })
  it('global ADMIN without membership cannot create', async () => {
    await refused(
      403,
      { error: 'Organization access denied' },
      { cookie: outsider, body: '{' }
    )
  })
  it('no selector and a conflicting cookie/header preserve their refusals', async () => {
    await refused(
      409,
      { error: 'Select an organization' },
      { headers: { 'x-tenant-id': undefined }, body: '{' }
    )
    await refused(
      400,
      { error: 'Conflicting tenant selection' },
      { cookie: `${jar}; selected-tenant-id=${context.bravo.id}` }
    )
  })
  it('genuine tenant host supplies selection and rejects an explicit conflict', async () => {
    const headers = {
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': context.alfa.slug,
      'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
      'x-tenant-id': undefined,
    }
    for (const host of hosts)
      expect((await request(host, { headers })).status).toBe(201)
    await refused(
      400,
      { error: 'Conflicting tenant selection' },
      { headers: { ...headers, 'x-tenant-id': context.bravo.id } }
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
  it.each([
    { value: {}, paths: ['equipmentId', 'uniqueCode'] },
    { value: null, paths: [''] },
    { value: { ...payload(), uniqueCode: '' }, paths: ['uniqueCode'] },
    { value: { ...payload(), hourMeter: -1 }, paths: ['hourMeter'] },
    { value: { ...payload(), odometer: '1' }, paths: ['odometer'] },
    { value: { ...payload(), serialNumber: null }, paths: ['serialNumber'] },
  ])(
    'invalid schema %j retains full validation-error parity',
    async ({ value, paths }) => {
      const before = await snapshot()
      // Cada host contra o envelope e os issues explícitos do contrato (onda 135, B2).
      for (const host of hosts) {
        const response = await request(host, { body: JSON.stringify(value) })
        expect(response).toEqual({
          status: 400,
          body: { error: 'Dados inválidos', details: unitIssues(value) },
          cache: null,
          vary: frameworkVary,
          cookie: null,
          allow: null,
        })
        expect(
          response.body.details.map((issue: { path: Array<string | number> }) =>
            issue.path.join('.')
          )
        ).toEqual(paths)
        expect(await snapshot()).toEqual(before)
      }
    }
  )
  it.each(['{', '', 'undefined'])(
    'malformed JSON %s remains generic 500 with no effects',
    async (body) => {
      await refused(500, { error: 'Erro ao criar unidade' }, { body })
    }
  )
  it.each([
    { label: 'foreign-tenant', equipmentId: context.bravo.equipmentIds[0]! },
    { label: 'unassigned-tenant', equipmentId: context.unassignedEquipment },
    { label: 'empty-id', equipmentId: '' },
    { label: 'unknown', equipmentId: randomUUID() },
  ])('equipment $label is 404', async ({ equipmentId }) => {
    await refused(
      404,
      { error: 'Equipamento não encontrado' },
      { body: JSON.stringify({ ...payload(), equipmentId }) }
    )
  })
  it('code uniqueness is exact and local to tenant; duplicate precedes equipment lookup', async () => {
    const code = `Code-${randomUUID()}`
    for (const host of hosts) {
      const first = await request(host, { body: JSON.stringify(payload(code)) })
      expect(first.status).toBe(201)
      await refused(
        400,
        { error: 'Código único já existe' },
        {
          body: JSON.stringify({
            ...payload(code),
            equipmentId: context.bravo.equipmentIds[0]!,
          }),
        },
        null,
        [host]
      )
      expect(
        (
          await request(host, {
            body: JSON.stringify({
              ...payload(code),
              equipmentId: context.bravo.equipmentIds[0]!,
            }),
            headers: { 'x-tenant-id': context.bravo.id },
          })
        ).status
      ).toBe(201)
      for (const variant of [code.toLowerCase(), ` ${code} `])
        expect(
          (await request(host, { body: JSON.stringify(payload(variant)) }))
            .status
        ).toBe(201)
      await cleanup()
    }
  })
  it('concurrent same-tenant/code requests produce one row and one domain 400', async () => {
    const input = payload()
    const results = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host) =>
        request(host, { body: JSON.stringify(input) })
      )
    )
    expect(results.map((row) => row.status).sort()).toEqual([201, 400])
    expect(
      await prisma.equipmentUnit.count({
        where: { tenantId: context.alfa.id, uniqueCode: input.uniqueCode },
      })
    ).toBe(1)
    expect(results.find((row) => row.status === 400)?.body).toEqual({
      error: 'Código único já existe',
    })
  })
  it('revoking INSERT keeps generic 500 without unit or equipment effects', async () => {
    await alterSharedAcl(pool, `REVOKE INSERT ON equipment_units FROM ${role}`)
    try {
      await refused(500, { error: 'Erro ao criar unidade' })
    } finally {
      await alterSharedAcl(pool, `GRANT INSERT ON equipment_units TO ${role}`)
    }
  })
  it('RLS rejects missing/foreign GUC and composite FK rejects a foreign equipment under own GUC', async () => {
    const before = await snapshot()
    const connection = await pool.connect()
    try {
      for (const [tenant, equipmentId, code] of [
        ['', context.alfa.equipmentIds[0]!, '42501'],
        [context.bravo.id, context.alfa.equipmentIds[0]!, '42501'],
        [context.alfa.id, context.bravo.equipmentIds[0]!, '23503'],
      ]) {
        await connection.query('BEGIN')
        await connection.query(`SET LOCAL ROLE ${role}`)
        if (tenant)
          await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
            tenant,
          ])
        await expect(
          connection.query(
            'INSERT INTO equipment_units (id,"tenantId","equipmentId","uniqueCode","updatedAt") VALUES ($1,$2,$3,$4,now())',
            [
              randomUUID(),
              context.alfa.id,
              equipmentId,
              `Probe-${randomUUID()}`,
            ]
          )
        ).rejects.toMatchObject({ code })
        await connection.query('ROLLBACK')
      }
      await connection.query('BEGIN')
      await connection.query(`SET LOCAL ROLE ${role}`)
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect(
        (
          await connection.query(
            'INSERT INTO equipment_units (id,"tenantId","equipmentId","uniqueCode","updatedAt") VALUES ($1,$2,$3,$4,now())',
            [
              randomUUID(),
              context.alfa.id,
              context.alfa.equipmentIds[0]!,
              `Probe-${randomUUID()}`,
            ]
          )
        ).rowCount
      ).toBe(1)
      await connection.query('ROLLBACK')
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
    expect(await snapshot()).toEqual(before)
  })
  it('AFTER INSERT failure rolls the unit back and never changes inventory', async () => {
    const name = `api_unit_fault_${randomUUID().replaceAll('-', '')}`
    const marker = `Fixture-${name}`
    await pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."uniqueCode" = '${marker}' THEN RAISE EXCEPTION 'private fixture unit failure'; END IF; RETURN NEW; END $$`
    )
    try {
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT ON equipment_units FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      await refused(
        500,
        { error: 'Erro ao criar unidade' },
        { body: JSON.stringify(payload(marker)) }
      )
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON equipment_units`)
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
  it('OPTIONS includes POST, while PUT/PATCH/DELETE remain unsupported', async () => {
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
      })
      for (const method of ['PUT', 'PATCH', 'DELETE'])
        expect((await request(host, {}, method)).status).toBe(405)
    }
  })
})
