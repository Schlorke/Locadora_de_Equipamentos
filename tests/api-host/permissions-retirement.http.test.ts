import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) }),
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const tenants = [randomUUID(), randomUUID()],
  member = randomUUID()
const permissions: string[] = Array.from({ length: 6 }, () => randomUUID())
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[61]!,
}
let cookie = '',
  clientCookie = ''
const input = {
  permissions: [
    { role: 'OPERATOR', module: 'FINANCIAL', action: 'READ' },
    { role: 'OPERATOR', module: 'USERS', action: 'MANAGE' },
  ],
}
const retirements = [
  ['GET', 'admin/seed-admin'],
  ['POST', 'admin/seed-admin'],
  ['POST', 'test-login'],
  ['POST', 'fix-storage'],
  ['GET', 'supabase-setup'],
  ['POST', 'supabase-setup'],
] as const
async function request(
  host: string,
  body: unknown = input,
  headers: Record<string, string> = {},
  method = 'PUT',
  endpoint = 'admin/permissions'
) {
  const response = await fetch(`${host}/api/${endpoint}`, {
    method,
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: cookie,
      'x-tenant-id': tenants[0]!,
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(method === 'GET'
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
  const bytes = await response.text()
  return {
    status: response.status,
    body: response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(bytes)
      : bytes,
    cookie: response.headers.get('set-cookie'),
  }
}
async function rows() {
  return prisma.permission.findMany({
    where: { id: { in: permissions } },
    orderBy: { id: 'asc' },
  })
}
async function tenantRows() {
  return prisma.permission.findMany({ where: { tenantId: tenants[0] } })
}
function labels(rows: Array<{ role: string; module: string; action: string }>) {
  return rows.map((p) => `${p.role}/${p.module}/${p.action}`).sort()
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  for (const id of tenants)
    await prisma.organization.create({
      data: { id, slug: id, name: 'Permission parity' },
    })
  await prisma.membership.createMany({
    data: [
      {
        id: member,
        tenantId: tenants[0]!,
        userId: context.identity.users[1]!.id,
        role: 'ADMIN',
      },
      {
        tenantId: tenants[0]!,
        userId: context.identity.users[0]!.id,
        role: 'CLIENT',
      },
    ],
  })
})
beforeEach(async () => {
  await prisma.permission.deleteMany({
    where: { OR: [{ tenantId: { in: tenants } }, { id: { in: permissions } }] },
  })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await withTestPlatformTransaction(prisma, async (tx) =>
    tx.organization.update({
      where: { id: tenants[0] },
      data: { status: 'ACTIVE' },
    })
  )
  await prisma.permission.createMany({
    data: [
      {
        id: permissions[0],
        tenantId: tenants[0],
        role: 'OPERATOR',
        module: 'EQUIPMENTS',
        action: 'READ',
      },
      {
        id: permissions[1],
        tenantId: tenants[0],
        role: 'OPERATOR',
        module: 'QUOTES',
        action: 'WRITE',
      },
      {
        id: permissions[2],
        tenantId: tenants[0],
        role: 'FINANCIAL',
        module: 'FINANCIAL',
        action: 'READ',
      },
      {
        id: permissions[3],
        tenantId: tenants[0],
        role: 'CLIENT',
        module: 'CONTRACTS',
        action: 'READ',
      },
      {
        id: permissions[4],
        tenantId: tenants[1],
        role: 'OPERATOR',
        module: 'EQUIPMENTS',
        action: 'READ',
      },
      {
        id: permissions[5],
        tenantId: null,
        role: 'OPERATOR',
        module: 'EQUIPMENTS',
        action: 'READ',
      },
    ],
  })
})
afterAll(async () => {
  try {
    await prisma.permission.deleteMany({
      where: {
        OR: [{ tenantId: { in: tenants } }, { id: { in: permissions } }],
      },
    })
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenants } } })
    await prisma.organization.deleteMany({ where: { id: { in: tenants } } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})
/** Issues completos do Zod esperados para cada substituição inválida de permissões (onda 135, B2). */
function permissionIssues(body: unknown): unknown[] {
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
  if (body === null) return [invalidType('object', 'null')]
  const row = body as { permissions?: Array<{ role: string }> }
  if (!row.permissions)
    return [invalidType('array', 'undefined', ['permissions'])]
  if (row.permissions.length === 0)
    return [
      {
        origin: 'array',
        code: 'too_small',
        minimum: 1,
        inclusive: true,
        path: ['permissions'],
        message: 'Too small: expected array to have >=1 items',
      },
    ]
  if (row.permissions.length === 101)
    return [
      {
        origin: 'array',
        code: 'too_big',
        maximum: 100,
        inclusive: true,
        path: ['permissions'],
        message: 'Too big: expected array to have <=100 items',
      },
    ]
  if (row.permissions[0]!.role === 'ADMIN')
    return [
      {
        code: 'invalid_value',
        values: ['FINANCIAL', 'OPERATOR', 'CLIENT'],
        path: ['permissions', 0, 'role'],
        message:
          'Invalid option: expected one of "FINANCIAL"|"OPERATOR"|"CLIENT"',
      },
    ]
  return [
    {
      code: 'custom',
      path: [],
      message: 'Todas as permissões devem pertencer ao mesmo papel',
    },
  ]
}
describe('permission replacement and inert contracts in both production hosts', () => {
  it('requires session and explicit active company membership before malformed input', async () => {
    const baseline = await rows()
    for (const host of hosts) {
      expect((await request(host, '{', { Cookie: '' })).status).toBe(401)
      expect((await request(host, '{', { 'x-tenant-id': '' })).status).toBe(409)
      expect(
        (await request(host, '{', { 'x-tenant-id': tenants[1]! })).status
      ).toBe(403)
    }
    await prisma.membership.update({
      where: { id: member },
      data: { status: 'REVOKED' },
    })
    for (const host of hosts)
      expect((await request(host, '{')).status).toBe(403)
    await prisma.membership.update({
      where: { id: member },
      data: { status: 'ACTIVE' },
    })
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: tenants[0] },
        data: { status: 'SUSPENDED' },
      })
    )
    for (const host of hosts)
      expect((await request(host, '{')).status).toBe(403)
    expect(await rows()).toEqual(baseline)
  })
  it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'] as const)(
    'denies %s even with USERS/MANAGE permission',
    async (role) => {
      await prisma.membership.update({ where: { id: member }, data: { role } })
      await prisma.permission.create({
        data: {
          tenantId: tenants[0]!,
          role,
          module: 'USERS',
          action: 'MANAGE',
        },
      })
      const baseline = await tenantRows()
      for (const host of hosts)
        expect(await request(host, '{')).toMatchObject({
          status: 403,
          body: { error: 'Não autorizado' },
        })
      expect(await tenantRows()).toEqual(baseline)
    }
  )
  it('rejects sibling origin through the central principal before parsing or updating', async () => {
    const baseline = await rows()
    for (const host of hosts)
      expect(
        (
          await request(host, '{', {
            Origin: 'https://foreign.platform.test',
            'Sec-Fetch-Site': 'same-site',
          })
        ).status
      ).toBe(403)
    expect(await rows()).toEqual(baseline)
  })
  it('replaces one role, strips foreign tenant/id fields, deduplicates and preserves other roles/foreign/quarantined rows', async () => {
    const preserved = (await rows()).filter(
      (p) => !permissions.slice(0, 2).includes(p.id)
    )
    for (const host of hosts) {
      const body = {
        tenantId: tenants[1],
        permissions: [...input.permissions, input.permissions[0]].map((p) => ({
          ...p,
          tenantId: tenants[1],
          id: 'foreign',
        })),
      }
      const r = await request(host, body)
      expect(r.status).toBe(200)
      expect(r.body.success).toBe(true)
      expect(r.cookie).toBeNull()
      expect(labels(r.body.permissions)).toEqual([
        'OPERATOR/FINANCIAL/READ',
        'OPERATOR/USERS/MANAGE',
      ])
      for (const p of r.body.permissions) {
        expect(p.tenantId).toBe(tenants[0])
        expect(typeof p.id).toBe('string')
        expect(p.id).not.toBe('foreign')
        expect(Number.isFinite(Date.parse(p.createdAt))).toBe(true)
        expect(Number.isFinite(Date.parse(p.updatedAt))).toBe(true)
      }
      expect(labels(await tenantRows())).toEqual([
        'CLIENT/CONTRACTS/READ',
        'FINANCIAL/FINANCIAL/READ',
        'OPERATOR/FINANCIAL/READ',
        'OPERATOR/USERS/MANAGE',
      ])
      expect(
        (await rows()).filter((p) => preserved.some((q) => q.id === p.id))
      ).toEqual(preserved)
      const read = await request(host, undefined, {}, 'GET')
      expect(read.status).toBe(200)
      expect(labels(read.body.permissions)).toEqual(labels(await tenantRows()))
    }
    expect(
      await prisma.auditLog.count({ where: { tenantId: { in: tenants } } })
    ).toBe(0)
    expect(
      await prisma.outboxEvent.count({ where: { tenantId: { in: tenants } } })
    ).toBe(0)
  })
  it.each([
    {},
    null,
    { permissions: [] },
    {
      permissions: [
        input.permissions[0],
        { ...input.permissions[0], role: 'CLIENT' },
      ],
    },
    { permissions: [{ role: 'ADMIN', module: 'USERS', action: 'MANAGE' }] },
    { permissions: Array(101).fill(input.permissions[0]) },
  ])('keeps Zod issue envelope without writes %#', async (body) => {
    const baseline = await rows()
    // Cada host contra o envelope e os issues explícitos do contrato (onda 135, B2).
    for (const host of hosts) {
      const r = await request(host, body)
      expect(r.status).toBe(400)
      expect(r.body).toEqual({
        error: 'Dados inválidos',
        details: permissionIssues(body),
      })
    }
    expect(await rows()).toEqual(baseline)
  })
  it('preserves malformed JSON generic 500 with no replacement', async () => {
    const baseline = await rows()
    for (const host of hosts)
      expect(await request(host, '{')).toMatchObject({
        status: 500,
        body: { error: 'Erro ao atualizar permissões' },
      })
    expect(await rows()).toEqual(baseline)
  })
  it('rolls back the delete when an actual INSERT trigger fails', async () => {
    const name = 'permission_parity_' + randomUUID().replaceAll('-', ''),
      tenant = tenants[0]!
    if (!/^[0-9a-f-]+$/.test(tenant)) throw new Error('Invalid fixture tenant')
    const baseline = await rows()
    await pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId"='${tenant}' AND NEW.module='USERS' THEN RAISE EXCEPTION 'private fixture failure'; END IF; RETURN NEW; END $$`
    )
    try {
      await pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON permissions FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      try {
        for (const host of hosts) {
          expect(await request(host)).toMatchObject({
            status: 500,
            body: { error: 'Erro ao atualizar permissões' },
          })
          expect(await rows()).toEqual(baseline)
        }
      } finally {
        await pool.query(`DROP TRIGGER ${name} ON permissions`)
      }
    } finally {
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
  it('serializes same-role writers across hosts with a separate lock key for other roles', async () => {
    const connection = await pool.connect(),
      key = tenants[0] + ':permissions:OPERATOR'
    const a = {
        permissions: [
          { role: 'OPERATOR', module: 'FINANCIAL', action: 'READ' },
        ],
      },
      b = {
        permissions: [{ role: 'OPERATOR', module: 'USERS', action: 'MANAGE' }],
      }
    let pending: Array<Promise<Awaited<ReturnType<typeof request>>>> = []
    try {
      await connection.query('BEGIN')
      await connection.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [key]
      )
      // Duas escritas reais: uma em cada host com a raiz; sem ela, as duas na API. Cada processo tem uma conexão de
      // runtime, então só a primeira escrita de cada processo chega a esperar a trava (a outra espera o pool).
      pending = [
        request(rotatingTarget(context, 0), a),
        request(rotatingTarget(context, 1), b),
      ]
      const lockWaiters = hosts.length
      let waiting = 0
      for (let i = 0; i < 60 && waiting < lockWaiters; i++) {
        waiting = Number(
          (
            await pool.query(
              "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%pg_advisory_xact_lock%'"
            )
          ).rows[0].count
        )
        if (waiting < lockWaiters)
          await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(waiting).toBeGreaterThanOrEqual(lockWaiters)
      expect(
        labels((await tenantRows()).filter((p) => p.role === 'OPERATOR'))
      ).toEqual(['OPERATOR/EQUIPMENTS/READ', 'OPERATOR/QUOTES/WRITE'])
      // Each host currently has one runtime connection. Another HTTP request
      // would wait for that pool even though its advisory key is independent.
      // Probe only the lock-key contract here, without changing the runtime.
      const otherRole = await pool.connect()
      try {
        await otherRole.query('BEGIN')
        const lock = await otherRole.query(
          'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired',
          [tenants[0] + ':permissions:FINANCIAL']
        )
        expect(lock.rows[0].acquired).toBe(true)
      } finally {
        await otherRole.query('ROLLBACK')
        otherRole.release()
      }
      await connection.query('COMMIT')
      const replies = await Promise.all(pending)
      for (const r of replies) expect(r.status).toBe(200)
      expect([
        ['OPERATOR/FINANCIAL/READ'],
        ['OPERATOR/USERS/MANAGE'],
      ]).toContainEqual(
        labels((await tenantRows()).filter((p) => p.role === 'OPERATOR'))
      )
    } finally {
      await connection.query('ROLLBACK')
      await Promise.allSettled(pending)
      connection.release()
    }
  })
  it.each(retirements)(
    '%s %s remains inert 410, anonymous and authenticated',
    async (method, endpoint) => {
      const baseline = await rows()
      for (const host of hosts)
        for (const headers of [
          { Cookie: '', 'x-tenant-id': '' },
          { Cookie: clientCookie, 'x-tenant-id': tenants[1]! },
        ])
          expect(
            await request(
              host,
              '{',
              headers,
              method,
              endpoint + '?tenantId=foreign'
            )
          ).toEqual({
            status: 410,
            body: { error: 'Endpoint retired' },
            cookie: null,
          })
      expect(await rows()).toEqual(baseline)
    }
  )
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
    '%s unknown path preserves the inert JSON 404 contract',
    async (method) => {
      const baseline = await rows()
      for (const host of hosts)
        expect(
          await request(
            host,
            '{',
            { Cookie: '', 'x-tenant-id': '' },
            method,
            'missing/parity/path'
          )
        ).toEqual({
          status: 404,
          body: {
            error: 'Not Found',
            message: 'Endpoint não encontrado não encontrado',
            code: 'NOT_FOUND',
          },
          cookie: null,
        })
      expect(await rows()).toEqual(baseline)
    }
  )
  it('keeps concrete route precedence and native method 405 rather than falling through', async () => {
    for (const host of hosts) {
      expect((await request(host, undefined, {}, 'GET', 'health')).status).toBe(
        200
      )
      expect(
        (await request(host, {}, {}, 'POST', 'admin/dashboard')).status
      ).toBe(405)
    }
  })
  it('proves the temporary runtime role has FORCE RLS without bypass', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl })
    try {
      expect(
        (
          await runtime.query(
            'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'
          )
        ).rows[0]
      ).toMatchObject({ rolsuper: false, rolbypassrls: false })
      const connection = await runtime.connect()
      try {
        await connection.query('BEGIN')
        await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
          tenants[0],
        ])
        expect(
          (await connection.query('SELECT id FROM permissions')).rows
        ).toHaveLength(4)
        expect(
          (
            await connection.query(
              'SELECT id FROM permissions WHERE id=ANY($1)',
              [permissions.slice(4)]
            )
          ).rows
        ).toEqual([])
        await connection.query('ROLLBACK')
      } finally {
        connection.release()
      }
      expect(
        (
          await pool.query(
            "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='permissions'"
          )
        ).rows[0]
      ).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true })
    } finally {
      await runtime.end()
    }
  })
})
