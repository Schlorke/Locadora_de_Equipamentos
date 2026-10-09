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
  Prisma,
  type Category,
  type Permission,
  type Role,
} from '@prisma/client'
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
  'x-platform-client-ip': context.directory.ips[57]!,
}
let jar: string
let outsider: string
let saved: Array<{ id: string; role: Role }>
let fixtureWriteGrant: Permission | undefined
let target: Category
let foreign: Category
const created: string[] = []
const permissions: string[] = []
type Method = 'PUT' | 'DELETE'
type Options = {
  body?: string
  cookie?: string
  headers?: Record<string, string | undefined>
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value))
const snapshot = async () => ({
  categories: await prisma.category.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  equipments: await prisma.equipment.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
})
async function create(tenantId: string) {
  const marker = randomUUID()
  const row = await prisma.category.create({
    data: {
      id: marker,
      tenantId,
      name: `Fixture ${marker}`,
      slug: `fixture-${marker}`,
      description: 'Original description',
      icon: 'hammer',
      iconColor: '#123456',
      bgColor: '#ffffff',
      fontColor: '#000000',
      placement: 'types',
      customIcon: { source: 'emoji', extra: true },
    },
  })
  created.push(row.id)
  return row
}
async function resetTarget() {
  const data = {
    ...target,
    customIcon: target.customIcon as Prisma.InputJsonValue,
  }
  await prisma.category.upsert({
    where: { id: target.id },
    create: data,
    update: data,
  })
}
async function request(
  host: string,
  method: Method | 'OPTIONS' | 'GET' | 'HEAD' | 'PATCH' | 'POST',
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
    `${host}/api/admin/categories/${id}?tenantId=foreign&role=ADMIN`,
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
async function refused(
  method: Method,
  status: number,
  body: unknown,
  id = target.id,
  options: Options = {},
  cache: string | null = null
) {
  const before = await snapshot()
  // Cada host da rodada contra a mesma expectativa explícita (onda 135, B2): vale com e sem a raiz.
  for (const host of hosts) {
    const response = await request(host, method, id, options)
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
    data: { tenantId, role: memberRole, module, action },
  })
  permissions.push(row.id)
  return row.id
}
const withoutUpdatedAt = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'updatedAt')
  )
/**
 * Sucesso em cada host contra o DTO esperado: a categoria-alvo restaurada mais `changes` (PUT), ou o envelope de
 * exclusão (DELETE). Nenhum host serve de gabarito do outro (onda 135, B2).
 */
async function success(
  method: Method,
  options: Options = {},
  changes: Record<string, unknown> = {}
) {
  const before = await snapshot()
  let last: Record<string, unknown> = {}
  for (const host of hosts) {
    await resetTarget()
    const response = await request(host, method, target.id, options)
    expect(response.status).toBe(200)
    expect(response.cache).toBeNull()
    expect(response.vary).toBe(frameworkVary)
    expect(response.cookie).toBeNull()
    const stored = await prisma.category.findUnique({
      where: { id: target.id },
    })
    if (method === 'PUT') {
      expect(stored).not.toBeNull()
      expect(response.body).toEqual(json(stored))
      expect(response.body.tenantId).toBe(context.alfa.id)
      expect(withoutUpdatedAt(response.body)).toEqual({
        ...withoutUpdatedAt(json(target)),
        ...changes,
      })
      last = withoutUpdatedAt(response.body)
    } else {
      expect(stored).toBeNull()
      expect(response.body).toEqual({ message: 'Categoria excluída' })
      last = response.body
    }
    const after = await snapshot()
    expect(after.equipments).toEqual(before.equipments)
    expect(after.categories.filter((row) => row.id !== target.id)).toEqual(
      before.categories.filter((row) => row.id !== target.id)
    )
  }
  return last
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
  target = await create(context.alfa.id)
  foreign = await create(context.bravo.id)
})
afterEach(async () => {
  await prisma.category.deleteMany({ where: { id: { in: created } } })
  await prisma.permission.deleteMany({ where: { id: { in: permissions } } })
  created.length = 0
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

describe('compiled HTTP category mutations with live ACL, tenant RLS and rollback', () => {
  it('PUT retains full DTO, normalization and arbitrary nested JSON while ignoring forged fields', async () => {
    const customIcon = { source: 'arbitrary', extra: { retained: true } }
    const changes = {
      name: 'São José',
      slug: 'sao-jose',
      description: 'Description',
      icon: 'Icon',
      iconColor: '#aaaaaa',
      bgColor: '#bbbbbb',
      fontColor: '#cccccc',
      placement: 'phases',
      customIcon,
    }
    const body = await success(
      'PUT',
      {
        body: JSON.stringify({
          name: '  São José  ',
          description: ' Description ',
          icon: ' Icon ',
          iconColor: ' #aaaaaa ',
          bgColor: ' #bbbbbb ',
          fontColor: ' #cccccc ',
          placement: 'phases',
          customIcon,
          id: foreign.id,
          tenantId: context.bravo.id,
        }),
      },
      changes
    )
    expect(body).toMatchObject({
      id: target.id,
      name: 'São José',
      slug: 'sao-jose',
      description: 'Description',
      icon: 'Icon',
      iconColor: '#aaaaaa',
      bgColor: '#bbbbbb',
      fontColor: '#cccccc',
      placement: 'phases',
      customIcon,
    })
  })
  it('PUT omitted fields keep their values and extra top-level keys are ignored', async () => {
    const body = await success('PUT', { body: '{"ignored":true}' })
    expect(body).toEqual(
      Object.fromEntries(
        Object.entries(json(target)).filter(([key]) => key !== 'updatedAt')
      )
    )
  })
  it('PUT whitespace name, optional nulls and invalid placement retain existing fallbacks', async () => {
    const fallbacks = {
      name: '',
      slug: '',
      description: null,
      icon: null,
      iconColor: '#000000',
      bgColor: '#e0e0e0',
      fontColor: '#000000',
      placement: null,
      customIcon: null,
    }
    expect(
      await success(
        'PUT',
        {
          body: JSON.stringify({
            name: ' ',
            description: null,
            icon: '',
            iconColor: null,
            bgColor: ' ',
            fontColor: '',
            placement: 'other',
            customIcon: false,
          }),
        },
        fallbacks
      )
    ).toMatchObject(fallbacks)
  })
  it.each([null, '', false, 0])(
    'PUT falsy name %s is ignored',
    async (name) => {
      expect(
        await success('PUT', { body: JSON.stringify({ name }) })
      ).toMatchObject({ name: target.name, slug: target.slug })
    }
  )
  it.each([[], 42, true, 'fixture'])(
    'PUT scalar/array %j retains the empty-update behavior',
    async (value) => {
      await success('PUT', { body: JSON.stringify(value) })
    }
  )
  it('DELETE ignores malformed JSON and retains the success envelope', async () => {
    await success('DELETE', { body: '{' })
  })
  it.each(['PUT', 'DELETE'] as const)(
    '%s no session is denied before malformed body',
    async (method) => {
      await refused(
        method,
        401,
        { error: 'Authentication required' },
        target.id,
        {
          cookie: '',
          body: '{',
        }
      )
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s global ADMIN with no membership cannot mutate',
    async (method) => {
      await refused(
        method,
        403,
        { error: 'Organization access denied' },
        target.id,
        { cookie: outsider, body: '{' }
      )
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s without tenant selector remains 409',
    async (method) => {
      await refused(
        method,
        409,
        { error: 'Select an organization' },
        target.id,
        { headers: { 'x-tenant-id': undefined }, body: '{' }
      )
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s missing/foreign ID is 404 before parsing',
    async (method) => {
      for (const id of [randomUUID(), foreign.id])
        await refused(
          method,
          404,
          {
            error:
              method === 'PUT'
                ? 'Registro não encontrado'
                : 'Categoria não encontrada',
          },
          id,
          { body: '{' }
        )
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s permission is live and specific to WRITE or DELETE',
    async (method) => {
      await asRole('FINANCIAL', async () => {
        await refused(method, 403, {
          error: 'Permissão insuficiente nesta locadora',
        })
        const id = await grant(
          context.alfa.id,
          'FINANCIAL',
          method === 'PUT' ? 'WRITE' : 'DELETE'
        )
        await success(method)
        await resetTarget()
        await prisma.permission.delete({ where: { id } })
        await refused(
          method,
          403,
          { error: 'Permissão insuficiente nesta locadora' },
          target.id,
          { body: '{' }
        )
      })
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s READ-only, wrong action/module/tenant grants never authorize',
    async (method) => {
      await asRole('FINANCIAL', async () => {
        const action = method === 'PUT' ? 'WRITE' : 'DELETE'
        for (const [tenant, module, wrongAction] of [
          [context.alfa.id, 'EQUIPMENTS', 'READ'],
          [
            context.alfa.id,
            'EQUIPMENTS',
            method === 'PUT' ? 'DELETE' : 'WRITE',
          ],
          [context.alfa.id, 'QUOTES', action],
          [context.bravo.id, 'EQUIPMENTS', action],
        ]) {
          const id = await grant(tenant!, 'FINANCIAL', wrongAction!, module!)
          await refused(method, 403, {
            error: 'Permissão insuficiente nesta locadora',
          })
          await prisma.permission.delete({ where: { id } })
        }
      })
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s CLIENT cannot mutate even with an exact grant',
    async (method) => {
      await asRole('CLIENT', async () => {
        await grant(
          context.alfa.id,
          'CLIENT',
          method === 'PUT' ? 'WRITE' : 'DELETE'
        )
        await refused(
          method,
          403,
          { error: 'Acesso administrativo não permitido' },
          target.id,
          { body: '{' }
        )
      })
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s revoked membership and inactive organization fail before parsing',
    async (method) => {
      const id = context.identity.memberships[0]!
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
      try {
        await refused(
          method,
          403,
          { error: 'Organization access denied' },
          target.id,
          { body: '{' }
        )
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
        await refused(
          method,
          403,
          { error: 'Organization access denied' },
          target.id,
          { body: '{' }
        )
      } finally {
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'ACTIVE' },
          })
        )
      }
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s tenant host reconciles selection and never adopts a foreign ID',
    async (method) => {
      const headers = {
        'x-platform-host-kind': 'tenant',
        'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
        'x-platform-tenant-slug': context.alfa.slug,
        'x-tenant-id': undefined,
      }
      await success(method, { headers })
      await resetTarget()
      await refused(
        method,
        400,
        { error: 'Conflicting tenant selection' },
        target.id,
        { headers: { ...headers, 'x-tenant-id': context.bravo.id } }
      )
    }
  )
  it.each(['PUT', 'DELETE'] as const)(
    '%s rejects a sister Origin before malformed JSON',
    async (method) => {
      await refused(
        method,
        403,
        { error: 'Origem não permitida' },
        target.id,
        {
          body: '{',
          headers: {
            Origin: 'https://bravo.platform.test',
            'Sec-Fetch-Site': 'same-site',
          },
        },
        'no-store'
      )
    }
  )
  it.each([
    ['malformed JSON', '{'],
    ['null', 'null'],
    ['bad name', '{"name":7}'],
    ['bad color', '{"bgColor":{}}'],
  ] as const)(
    'PUT %s keeps generic 500 without persistence',
    async (_label, body) => {
      await refused(
        'PUT',
        500,
        { error: 'Erro ao atualizar categoria' },
        target.id,
        { body }
      )
    }
  )
  it('PUT slug collision retains generic 500 and rolls back all fields', async () => {
    const other = await create(context.alfa.id)
    await refused(
      'PUT',
      500,
      { error: 'Erro ao atualizar categoria' },
      target.id,
      {
        body: JSON.stringify({
          name: other.name,
          description: 'Must roll back',
        }),
      }
    )
  })
  it('DELETE linked category retains generic 500 and leaves every equipment intact', async () => {
    await refused(
      'DELETE',
      500,
      { error: 'Erro ao excluir categoria' },
      context.alfa.categoryId
    )
  })
  it.each(['PUT', 'DELETE'] as const)(
    '%s database privilege refusal remains generic 500 without effects',
    async (method) => {
      const privilege = method === 'PUT' ? 'UPDATE' : 'DELETE'
      await alterSharedAcl(
        pool,
        `REVOKE ${privilege} ON categories FROM ${role}`
      )
      try {
        await refused(
          method,
          500,
          {
            error:
              method === 'PUT'
                ? 'Erro ao atualizar categoria'
                : 'Erro ao excluir categoria',
          },
          target.id,
          { body: '{"description":"Real mutation"}' }
        )
      } finally {
        await alterSharedAcl(
          pool,
          `GRANT ${privilege} ON categories TO ${role}`
        )
      }
    }
  )
  it('RLS prevents UPDATE/DELETE without GUC or under another tenant, with an own-tenant control', async () => {
    const before = await snapshot()
    const connection = await pool.connect()
    try {
      for (const tenant of ['', context.bravo.id, context.alfa.id]) {
        for (const statement of [
          "UPDATE categories SET description = 'fixture' WHERE id=$1",
          'DELETE FROM categories WHERE id=$1',
        ]) {
          await connection.query('BEGIN')
          await connection.query(`SET LOCAL ROLE ${role}`)
          if (tenant)
            await connection.query(
              "SELECT set_config('app.tenant_id',$1,true)",
              [tenant]
            )
          expect(
            (await connection.query(statement, [target.id])).rowCount
          ).toBe(tenant === context.alfa.id ? 1 : 0)
          await connection.query('ROLLBACK')
        }
      }
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
    expect(await snapshot()).toEqual(before)
  })
  it.each(['PUT', 'DELETE'] as const)(
    '%s AFTER mutation failure rolls the entire operation back',
    async (method) => {
      const name = `api_category_mutation_fault_${randomUUID().replaceAll('-', '')}`
      const record = method === 'PUT' ? 'NEW' : 'OLD'
      const event = method === 'PUT' ? 'UPDATE' : 'DELETE'
      await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${record}.id = '${target.id}' THEN RAISE EXCEPTION 'private fixture category mutation failure'; END IF; RETURN ${record}; END $$`
      )
      try {
        await pool.query(
          `CREATE TRIGGER ${name} AFTER ${event} ON categories FOR EACH ROW EXECUTE FUNCTION ${name}()`
        )
        await refused(
          method,
          500,
          {
            error:
              method === 'PUT'
                ? 'Erro ao atualizar categoria'
                : 'Erro ao excluir categoria',
          },
          target.id,
          { body: '{"description":"Rollback"}' }
        )
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${name} ON categories`)
        await pool.query(`DROP FUNCTION ${name}()`)
      }
    }
  )
  it('concurrent DELETE creates no duplicate effects: one success, one owned-record 404', async () => {
    const before = await snapshot()
    const results = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host) => request(host, 'DELETE'))
    )
    expect(results.map((row) => row.status).sort()).toEqual([200, 404])
    expect(
      await prisma.category.findUnique({ where: { id: target.id } })
    ).toBeNull()
    expect((await snapshot()).equipments).toEqual(before.equipments)
  })
  it('concurrent PUT retains serialized last-writer behavior without optimistic locking', async () => {
    const results = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host, index) =>
        request(host, 'PUT', target.id, {
          body: JSON.stringify({ description: `Writer ${index}` }),
        })
      )
    )
    expect(results.map((row) => row.status)).toEqual([200, 200])
    expect(results.map((row) => row.body.description)).toEqual([
      'Writer 0',
      'Writer 1',
    ])
    expect(['Writer 0', 'Writer 1']).toContain(
      (await prisma.category.findUniqueOrThrow({ where: { id: target.id } }))
        .description
    )
  })
  it('OPTIONS retains PUT/DELETE and all unsupported methods remain 405', async () => {
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
        allow: ['DELETE', 'OPTIONS', 'PUT'],
      })
      for (const method of ['GET', 'HEAD', 'PATCH', 'POST'] as const)
        expect((await request(host, method)).status).toBe(405)
    }
  })
})
