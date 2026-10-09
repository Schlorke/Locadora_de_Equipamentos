import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import {
  PrismaClient,
  type EquipmentUnit,
  type EquipmentUnitStatus,
  type Permission,
  type Role,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminEquipmentsApi } from '../../packages/frontend/src/pages/equipamentos-admin/api/equipments'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

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
  'x-platform-client-ip': context.directory.ips[59]!,
}
const projection = {
  equipment: {
    select: { id: true, name: true, category: { select: { name: true } } },
  },
} as const
const created: string[] = []
const permissions: string[] = []
let jar: string
let outsider: string
let target: EquipmentUnit
let saved: Array<{ id: string; role: Role }>
let fixtureWriteGrant: Permission | undefined
type Method = 'PATCH' | 'DELETE'
type Options = {
  body?: string
  cookie?: string
  headers?: Record<string, string | undefined>
}
const snapshot = async () => ({
  units: await prisma.equipmentUnit.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  equipment: await prisma.equipment.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
})
async function fixture(
  tenant = context.alfa,
  status: EquipmentUnitStatus = 'AVAILABLE',
  uniqueCode = `Mutate-${randomUUID()}`
) {
  const row = await prisma.equipmentUnit.create({
    data: {
      tenantId: tenant.id,
      equipmentId: tenant.equipmentIds[0]!,
      uniqueCode,
      status,
      hourMeter: 12.345,
      odometer: 45.67,
      serialNumber: 'Serial',
      notes: 'Notes',
    },
  })
  created.push(row.id)
  return row
}
async function restore(row: EquipmentUnit) {
  const { id, ...data } = row
  await prisma.equipmentUnit.upsert({
    where: { id },
    create: row,
    update: data,
  })
}
async function request(
  host: string,
  method: string,
  id = target.id,
  options: Options = {}
) {
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
    `${host}/api/admin/equipment-units/${id}?tenantId=foreign&role=ADMIN`,
    {
      method,
      headers,
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? { body: options.body ?? '{}' }
        : {}),
    }
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
/** Issues completos do Zod esperados para cada PATCH inválido da unidade (onda 135, B2). */
function unitPatchIssues(value: unknown): unknown[] {
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
  if (row.status === 'UNKNOWN')
    return [
      {
        code: 'invalid_value',
        values: ['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'RETIRED'],
        path: ['status'],
        message:
          'Invalid option: expected one of "AVAILABLE"|"RESERVED"|"RENTED"|"MAINTENANCE"|"RETIRED"',
      },
    ]
  if (row.hourMeter === -1)
    return [
      tooSmall('number', 'hourMeter', 'Too small: expected number to be >=0'),
    ]
  if (row.odometer === '1')
    return [invalidType('number', 'string', ['odometer'])]
  if (row.notes === null) return [invalidType('string', 'null', ['notes'])]
  if (row.uniqueCode === '')
    return [
      tooSmall(
        'string',
        'uniqueCode',
        'Too small: expected string to have >=1 characters'
      ),
    ]
  throw new Error('Unknown invalid equipment-unit patch fixture')
}
async function refused(
  method: Method,
  status: number,
  error: string,
  options: Options = {},
  id = target.id,
  cache: string | null = null
) {
  const before = await snapshot()
  for (const host of hosts) {
    expect(await request(host, method, id, options)).toEqual({
      status,
      body: { error },
      cache,
      vary: frameworkVary,
      cookie: null,
      allow: null,
    })
    expect(await snapshot()).toEqual(before)
  }
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
  action: string,
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
beforeEach(async () => {
  target = await fixture()
})
afterEach(async () => {
  await prisma.equipmentUnit.deleteMany({ where: { id: { in: created } } })
  created.length = 0
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

describe('equipment unit PATCH/DELETE with real sessions and tenant RLS', () => {
  it('consumidor de unidades mantém medidores, vínculo e recusa de unidade locada', async () => {
    for (const host of hosts) {
      const api = createAdminEquipmentsApi(
        createHttpClient({
          baseUrl: host,
          getHeaders: () => ({
            ...edge,
            Cookie: jar,
            'x-tenant-id': context.alfa.id,
            Origin: edge['x-platform-origin'],
            'Sec-Fetch-Site': 'same-origin',
          }),
        })
      )
      const listed = await api.units<Array<{ id: string }>>(target.equipmentId)
      expect(listed.data.some((row) => row.id === target.id)).toBe(true)
      const response = await api.updateUnit(
        target.id,
        JSON.stringify({
          hourMeter: 0,
          odometer: 1.234,
          serialNumber: '',
          notes: '',
        })
      )
      expect(response).toMatchObject({
        ok: true,
        status: 200,
        data: {
          id: target.id,
          equipmentId: target.equipmentId,
          hourMeter: '0',
          odometer: '1.234',
          serialNumber: null,
          notes: null,
        },
      })
      await prisma.equipmentUnit.update({
        where: { id: target.id },
        data: { status: 'RENTED' },
      })
      expect(await api.removeUnit(target.id)).toMatchObject({
        ok: false,
        status: 400,
      })
      expect(
        await prisma.equipmentUnit.findUnique({ where: { id: target.id } })
      ).not.toBeNull()
    }
  })
  it.each([context.alfa, context.bravo])(
    'PATCH in tenant %j preserves complete DTO and equipment/stock',
    async (tenant) => {
      const row = tenant.id === context.alfa.id ? target : await fixture(tenant)
      const before = await snapshot()
      const code = ` New ${randomUUID()} `
      const label = tenant.id === context.alfa.id ? 'alfa' : 'bravo'
      const body = JSON.stringify({
        uniqueCode: code,
        status: 'MAINTENANCE',
        hourMeter: 0,
        odometer: 1.234,
        serialNumber: '',
        notes: '',
        equipmentId: context.bravo.equipmentIds[0],
        tenantId: 'foreign',
        id: 'foreign',
        extra: true,
      })
      for (const host of hosts) {
        const response = await request(host, 'PATCH', row.id, {
          body,
          headers: {
            'x-tenant-id': tenant.id,
            Origin: edge['x-platform-origin'],
            'Sec-Fetch-Site': 'same-origin',
          },
        })
        expect(response.status).toBe(200)
        const stored = await prisma.equipmentUnit.findUniqueOrThrow({
          where: { id: row.id },
          include: projection,
        })
        expect(response.body).toEqual(JSON.parse(JSON.stringify(stored)))
        expect(response.body).toMatchObject({
          id: row.id,
          tenantId: tenant.id,
          equipmentId: row.equipmentId,
          status: 'MAINTENANCE',
          hourMeter: '0',
          odometer: '1.234',
          serialNumber: null,
          notes: null,
        })
        expect(stored.updatedAt.getTime()).toBeGreaterThanOrEqual(
          row.updatedAt.getTime()
        )
        expect(response.body.createdAt).toBe(row.createdAt.toISOString())
        // DTO completo esperado, montado da entrada e da unidade da fixture (onda 135, B2).
        expect(response).toEqual({
          status: 200,
          body: {
            id: row.id,
            tenantId: tenant.id,
            equipmentId: row.equipmentId,
            uniqueCode: code,
            status: 'MAINTENANCE',
            hourMeter: '0',
            odometer: '1.234',
            serialNumber: null,
            notes: null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: expect.any(String),
            equipment: {
              id: row.equipmentId,
              name: `Betoneira ${label} 00`,
              category: { name: label === 'alfa' ? 'Andaimes' : 'Betoneiras' },
            },
          },
          cache: null,
          vary: frameworkVary,
          cookie: null,
          allow: null,
        })
        expect((await snapshot()).equipment).toEqual(before.equipment)
        await restore(row)
      }
    }
  )
  it.each([
    'AVAILABLE',
    'RESERVED',
    'RENTED',
    'MAINTENANCE',
    'RETIRED',
  ] as const)(
    'PATCH accepts status %s without extra inventory transition',
    async (status) => {
      const before = await snapshot()
      for (const host of hosts) {
        const response = await request(host, 'PATCH', target.id, {
          body: JSON.stringify({ status }),
        })
        expect(response.status).toBe(200)
        expect(response.body.status).toBe(status)
        expect((await snapshot()).equipment).toEqual(before.equipment)
        await restore(target)
      }
    }
  )
  it.each([{}, { extra: true, equipmentId: 'foreign', tenantId: 'foreign' }])(
    'empty/extra-only PATCH %j leaves row and updatedAt unchanged',
    async (body) => {
      const before = await snapshot()
      for (const host of hosts) {
        expect(
          (
            await request(host, 'PATCH', target.id, {
              body: JSON.stringify(body),
            })
          ).status
        ).toBe(200)
        expect(await snapshot()).toEqual(before)
      }
    }
  )
  it('partial PATCH preserves omitted fields and untrimmed text', async () => {
    for (const host of hosts) {
      const response = await request(host, 'PATCH', target.id, {
        body: JSON.stringify({ notes: ' ', serialNumber: ' S ' }),
      })
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        uniqueCode: target.uniqueCode,
        hourMeter: '12.345',
        odometer: '45.67',
        notes: ' ',
        serialNumber: ' S ',
      })
      await restore(target)
    }
  })
  it('same own code and code belonging only to another tenant are allowed; own duplicate is not', async () => {
    const other = await fixture(context.alfa, 'AVAILABLE', 'Taken')
    await fixture(context.bravo, 'AVAILABLE', 'ForeignCode')
    for (const host of hosts) {
      expect(
        (
          await request(host, 'PATCH', target.id, {
            body: JSON.stringify({ uniqueCode: target.uniqueCode }),
          })
        ).status
      ).toBe(200)
      expect(
        (
          await request(host, 'PATCH', target.id, {
            body: JSON.stringify({ uniqueCode: 'ForeignCode' }),
          })
        ).status
      ).toBe(200)
      await restore(target)
    }
    await refused('PATCH', 400, 'Código único já existe', {
      body: JSON.stringify({ uniqueCode: other.uniqueCode }),
    })
  })
  it.each(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as const)(
    'DELETE accepts %s and ignores malformed body, without stock effects',
    async (status) => {
      await prisma.equipmentUnit.update({
        where: { id: target.id },
        data: { status },
      })
      const row = await prisma.equipmentUnit.findUniqueOrThrow({
        where: { id: target.id },
      })
      const before = await snapshot()
      for (const host of hosts) {
        expect(await request(host, 'DELETE', row.id, { body: '{' })).toEqual({
          status: 200,
          body: { message: 'Unidade deletada com sucesso' },
          cache: null,
          vary: frameworkVary,
          cookie: null,
          allow: null,
        })
        expect(
          await prisma.equipmentUnit.findUnique({ where: { id: row.id } })
        ).toBeNull()
        const after = await snapshot()
        expect(after.equipment).toEqual(before.equipment)
        expect(after.units).toEqual(
          before.units.filter((unit) => unit.id !== row.id)
        )
        await restore(row)
      }
    }
  )
  it.each(['RENTED', 'RESERVED'] as const)(
    'DELETE refuses unit in use (%s)',
    async (status) => {
      await prisma.equipmentUnit.update({
        where: { id: target.id },
        data: { status },
      })
      await refused('DELETE', 400, 'Não é possível deletar unidade em uso', {
        body: '{',
      })
    }
  )
  describe.each(['PATCH', 'DELETE'] as const)(
    '%s authorization/ownership',
    (method) => {
      const action = method === 'PATCH' ? 'WRITE' : 'DELETE'
      it.each(['OPERATOR', 'FINANCIAL'] as const)(
        '%s needs a live exact grant',
        async (memberRole) => {
          await asRole(memberRole, async () => {
            await refused(
              method,
              403,
              'Permissão insuficiente nesta locadora',
              { body: '{' }
            )
            const id = await grant(context.alfa.id, memberRole, action)
            for (const host of hosts) {
              expect(
                (
                  await request(host, method, target.id, {
                    body: '{"notes":"Changed"}',
                  })
                ).status
              ).toBe(200)
              await restore(target)
            }
            await prisma.permission.delete({ where: { id } })
            await refused(
              method,
              403,
              'Permissão insuficiente nesta locadora',
              { body: '{' }
            )
          })
        }
      )
      it('other action/module/tenant/role does not authorize; CLIENT remains denied with a grant', async () => {
        await asRole('FINANCIAL', async () => {
          for (const [tenant, memberRole, module, otherAction] of [
            [
              context.alfa.id,
              'FINANCIAL',
              'EQUIPMENTS',
              method === 'PATCH' ? 'DELETE' : 'WRITE',
            ],
            [context.alfa.id, 'FINANCIAL', 'QUOTES', action],
            [context.bravo.id, 'FINANCIAL', 'EQUIPMENTS', action],
            [context.alfa.id, 'OPERATOR', 'EQUIPMENTS', action],
          ] as const) {
            const id = await grant(tenant, memberRole, otherAction, module)
            await refused(
              method,
              403,
              'Permissão insuficiente nesta locadora',
              { body: '{' }
            )
            await prisma.permission.delete({ where: { id } })
          }
        })
        await asRole('CLIENT', async () => {
          await grant(context.alfa.id, 'CLIENT', action)
          await refused(method, 403, 'Acesso administrativo não permitido', {
            body: '{',
          })
        })
      })
      it('no session/global ADMIN without membership do not authorize', async () => {
        await refused(method, 401, 'Authentication required', {
          cookie: '',
          body: '{',
        })
        await refused(method, 403, 'Organization access denied', {
          cookie: outsider,
          body: '{',
        })
      })
      it('inactive membership or organization refuses before body', async () => {
        const id = context.identity.memberships[0]!
        await prisma.membership.update({
          where: { id },
          data: { status: 'SUSPENDED' },
        })
        try {
          await refused(method, 403, 'Organization access denied', {
            body: '{',
          })
        } finally {
          await prisma.membership.update({
            where: { id },
            data: { status: 'ACTIVE' },
          })
        }
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'SUSPENDED' },
          })
        )
        try {
          await refused(method, 403, 'Organization access denied', {
            body: '{',
          })
        } finally {
          await withTestPlatformTransaction(prisma, async (tx) =>
            tx.organization.update({
              where: { id: context.alfa.id },
              data: { status: 'ACTIVE' },
            })
          )
        }
      })
      it.each([
        { label: 'foreign-tenant', id: context.units.bravo[0]! },
        { label: 'unassigned-tenant', id: context.units.unassigned },
        { label: 'missing', id: 'missing-unit' },
      ])('$label unit is 404 before malformed JSON', async ({ id }) => {
        await refused(
          method,
          404,
          method === 'PATCH'
            ? 'Registro não encontrado'
            : 'Unidade não encontrada',
          { body: '{' },
          id
        )
      })
      it.each([
        {
          Origin: 'https://bravo.platform.test',
          'Sec-Fetch-Site': 'same-site',
        },
        { Origin: 'null' },
        { Origin: edge['x-platform-origin'], 'Sec-Fetch-Site': 'same-site' },
        { 'Sec-Fetch-Site': 'cross-site' },
      ])('CSRF %j is refused before body', async (headers) => {
        await refused(
          method,
          403,
          'Origem não permitida',
          { headers, body: '{' },
          target.id,
          'no-store'
        )
      })
      it('no selection and conflicting cookie/header retain their refusals', async () => {
        await refused(method, 409, 'Select an organization', {
          headers: { 'x-tenant-id': undefined },
          body: '{',
        })
        await refused(method, 400, 'Conflicting tenant selection', {
          cookie: `${jar}; selected-tenant-id=${context.bravo.id}`,
          body: '{',
        })
      })
    }
  )
  it.each([
    { value: null, paths: [''] },
    { value: { status: 'UNKNOWN' }, paths: ['status'] },
    { value: { hourMeter: -1 }, paths: ['hourMeter'] },
    { value: { odometer: '1' }, paths: ['odometer'] },
    { value: { notes: null }, paths: ['notes'] },
    { value: { uniqueCode: '' }, paths: ['uniqueCode'] },
  ])(
    'invalid PATCH %j has complete Zod parity with no write',
    async ({ value, paths }) => {
      const before = await snapshot()
      // Cada host contra o envelope e os issues explícitos do contrato (onda 135, B2).
      for (const host of hosts) {
        const response = await request(host, 'PATCH', target.id, {
          body: JSON.stringify(value),
        })
        expect(response).toEqual({
          status: 400,
          body: { error: 'Dados inválidos', details: unitPatchIssues(value) },
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
    'malformed PATCH %s keeps generic 500',
    async (body) => {
      await refused('PATCH', 500, 'Erro ao atualizar unidade', { body })
    }
  )
  it('concurrent duplicate code patches serialize to one update and one 400', async () => {
    const second = await fixture()
    const code = `Race-${randomUUID()}`
    const responses = await Promise.all(
      [target, second].map((row, index) =>
        request(rotatingTarget(context, index), 'PATCH', row.id, {
          body: JSON.stringify({ uniqueCode: code }),
        })
      )
    )
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ])
    expect(
      await prisma.equipmentUnit.count({
        where: { tenantId: context.alfa.id, uniqueCode: code },
      })
    ).toBe(1)
  })
  it('concurrent deletes yield one deletion and one 404', async () => {
    const responses = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host) => request(host, 'DELETE'))
    )
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 404,
    ])
    expect(
      await prisma.equipmentUnit.findUnique({ where: { id: target.id } })
    ).toBeNull()
  })
  it('RENTED patch racing with delete has only serialized lifecycle outcomes', async () => {
    const [patch, removal] = await Promise.all([
      request(hosts[0]!, 'PATCH', target.id, { body: '{"status":"RENTED"}' }),
      request(hosts.at(-1)!, 'DELETE'),
    ])
    const row = await prisma.equipmentUnit.findUnique({
      where: { id: target.id },
    })
    if (patch.status === 200) {
      expect(removal.status).toBe(400)
      expect(row?.status).toBe('RENTED')
    } else {
      expect(patch.status).toBe(404)
      expect(removal.status).toBe(200)
      expect(row).toBeNull()
    }
  })
  it.each(['PATCH', 'DELETE'] as const)(
    '%s database privilege failure remains generic 500 with no effects',
    async (method) => {
      const privilege = method === 'PATCH' ? 'UPDATE' : 'DELETE'
      await alterSharedAcl(
        pool,
        `REVOKE ${privilege} ON equipment_units FROM ${role}`
      )
      try {
        await refused(
          method,
          500,
          method === 'PATCH'
            ? 'Erro ao atualizar unidade'
            : 'Erro ao deletar unidade',
          { body: '{"notes":"Changed"}' }
        )
      } finally {
        await alterSharedAcl(
          pool,
          `GRANT ${privilege} ON equipment_units TO ${role}`
        )
      }
    }
  )
  it('RLS scopes UPDATE/DELETE for missing, foreign and own GUC with rollback controls', async () => {
    const before = await snapshot()
    const connection = await pool.connect()
    try {
      for (const tenant of ['', context.bravo.id, context.alfa.id])
        for (const sql of [
          'UPDATE equipment_units SET notes=$2 WHERE id=$1',
          'DELETE FROM equipment_units WHERE id=$1',
        ]) {
          await connection.query('BEGIN')
          await connection.query(`SET LOCAL ROLE ${role}`)
          if (tenant)
            await connection.query(
              "SELECT set_config('app.tenant_id',$1,true)",
              [tenant]
            )
          const result = await connection.query(
            sql,
            sql.startsWith('UPDATE') ? [target.id, 'Changed'] : [target.id]
          )
          expect(result.rowCount).toBe(tenant === context.alfa.id ? 1 : 0)
          await connection.query('ROLLBACK')
        }
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
    expect(await snapshot()).toEqual(before)
  })
  it.each(['PATCH', 'DELETE'] as const)(
    'AFTER %s fault rolls back the actual mutation',
    async (method) => {
      const operation = method === 'PATCH' ? 'UPDATE' : 'DELETE'
      const name = `api_unit_fault_${randomUUID().replaceAll('-', '')}`
      await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id = '${target.id}' THEN RAISE EXCEPTION 'private fixture failure'; END IF; RETURN NULL; END $$`
      )
      try {
        await pool.query(
          `CREATE TRIGGER ${name} AFTER ${operation} ON equipment_units FOR EACH ROW EXECUTE FUNCTION ${name}()`
        )
        await refused(
          method,
          500,
          method === 'PATCH'
            ? 'Erro ao atualizar unidade'
            : 'Erro ao deletar unidade',
          { body: '{"notes":"Changed"}' }
        )
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${name} ON equipment_units`)
        await pool.query(`DROP FUNCTION ${name}()`)
      }
    }
  )
  it('OPTIONS advertises PATCH/DELETE while POST/PUT remain 405', async () => {
    for (const host of hosts) {
      const response = await request(host, 'OPTIONS')
      expect({
        ...response,
        allow: response.allow?.split(', ').sort(),
      }).toEqual({
        status: 204,
        body: null,
        cache: null,
        vary: frameworkVary,
        cookie: null,
        allow: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH'],
      })
      for (const method of ['POST', 'PUT'])
        expect((await request(host, method)).status).toBe(405)
    }
  })
})
