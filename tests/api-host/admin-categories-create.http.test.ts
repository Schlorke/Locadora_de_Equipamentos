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
import { PrismaClient, type Role, type Permission } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { createHttpClient } from '../../packages/frontend/src/shared/api/http-client'
import { createAdminCategoriesApi } from '../../packages/frontend/src/pages/categorias/api/categories'
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
const created: string[] = []
const permissions: string[] = []
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[56]!,
}
let jar: string
let outsider: string
let saved: Array<{ id: string; role: Role }>
let fixtureWriteGrant: Permission | undefined
type Options = {
  body?: string
  cookie?: string
  headers?: Record<string, string | undefined>
}
const payload = (name = `Fixture category ${randomUUID()}`) => ({
  name,
  iconColor: ' #abcdef ',
  bgColor: ' #f0f0f0 ',
  fontColor: ' #123456 ',
})
const state = async () => ({
  categories: await prisma.category.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
    orderBy: { id: 'asc' },
  }),
  equipments: await prisma.equipment.findMany({
    where: { tenantId: { in: [context.alfa.id, context.bravo.id] } },
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
    `${host}/api/admin/categories?tenantId=foreign&userId=foreign&role=ADMIN`,
    {
      method: 'POST',
      headers,
      body: options.body ?? JSON.stringify(payload()),
    }
  )
  const body = await response.json()
  if (response.status === 201) created.push(body.id)
  return {
    status: response.status,
    body,
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
  }
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
async function cleanupCategories() {
  await prisma.category.deleteMany({ where: { id: { in: created } } })
  created.length = 0
}
async function membershipRole(value: Role, run: () => Promise<void>) {
  const id = context.identity.memberships[0]!
  await prisma.membership.update({ where: { id }, data: { role: value } })
  try {
    await run()
  } finally {
    await prisma.membership.update({ where: { id }, data: { role: 'ADMIN' } })
  }
}
async function grant(
  tenantId: string,
  membershipRole: 'OPERATOR' | 'FINANCIAL' | 'CLIENT',
  module = 'EQUIPMENTS',
  action = 'WRITE'
) {
  const permission = await prisma.permission.create({
    data: { tenantId, role: membershipRole, module, action },
  })
  permissions.push(permission.id)
  return permission.id
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
  // This fixture is a wrong action for GET, but a valid grant for this POST.
  // Isolate it while proving grant creation/revocation, then restore it exactly.
  await prisma.permission.delete({ where: { id: fixtureWriteGrant.id } })
  await prisma.membership.updateMany({
    where: { id: { in: saved.map((row) => row.id) } },
    data: { role: 'ADMIN' },
  })
})
afterEach(async () => {
  await cleanupCategories()
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

describe('compiled HTTP administrative category creation with real ACL and tenant RLS', () => {
  it('consumidor de categorias preserva CRUD, duplicação e recusa de outra locadora', async () => {
    for (const host of hosts) {
      const api = createAdminCategoriesApi(
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
      const input = JSON.stringify(payload())
      const made = await api.save(null, input)
      expect(made).toMatchObject({ ok: true, status: 201 })
      const id = (made.data as { id?: string }).id!
      expect(id).toBeTruthy()
      created.push(id)
      expect(await api.save(null, input)).toMatchObject({
        ok: false,
        status: 409,
      })
      expect(
        await api.save(
          id,
          JSON.stringify(payload('Atualizada ' + randomUUID()))
        )
      ).toMatchObject({ ok: true, status: 200 })
      const listed = await api.list()
      expect(listed.status).toBe(200)
      expect(
        Array.isArray(listed.data) && listed.data.some((row) => row.id === id)
      ).toBe(true)
      expect(await api.remove(context.bravo.categoryId)).toMatchObject({
        ok: false,
        status: 404,
      })
      expect(await api.remove(id)).toMatchObject({ ok: true, status: 200 })
      expect(await prisma.category.findUnique({ where: { id } })).toBeNull()
    }
  })
  it.each([context.alfa, context.bravo])(
    'ADMIN creates only in selected tenant %j and retains the complete DTO',
    async (tenant) => {
      const input = {
        ...payload(`  Fixture Árvore ${randomUUID()}  `),
        description: '  Description  ',
        icon: '  hammer  ',
        placement: 'types',
        customIcon: {
          source: 'emoji',
          emoji: '🌳',
          name: ' Fixture icon ',
          extra: true,
        },
      }
      const before = await state()
      for (const host of hosts) {
        const response = await request(host, {
          headers: {
            'x-tenant-id': tenant.id,
            Origin: edge['x-platform-origin'],
            'Sec-Fetch-Site': 'same-origin',
          },
          body: JSON.stringify(input),
        })
        expect(response.status).toBe(201)
        const row = await prisma.category.findUniqueOrThrow({
          where: { id: response.body.id },
        })
        expect(response.body).toEqual(JSON.parse(JSON.stringify(row)))
        // DTO completo esperado, montado da entrada (sem comparar um host com o outro; onda 135, B2).
        expect({
          ...response.body,
          id: 'generated',
          createdAt: 'generated',
          updatedAt: 'generated',
        }).toEqual({
          id: 'generated',
          tenantId: tenant.id,
          name: input.name.trim(),
          description: 'Description',
          icon: 'hammer',
          iconColor: '#abcdef',
          bgColor: '#f0f0f0',
          fontColor: '#123456',
          slug: input.name
            .trim()
            .toLowerCase()
            .replace('á', 'a')
            .replaceAll(' ', '-'),
          createdAt: 'generated',
          updatedAt: 'generated',
          placement: 'types',
          customIcon: { source: 'emoji', emoji: '🌳', name: ' Fixture icon ' },
        })
        expect(response.body.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
        expect(response.cache).toBeNull()
        expect(response.vary).toBe(frameworkVary)
        expect(response.cookie).toBeNull()
        const after = await state()
        expect(after.equipments).toEqual(before.equipments)
        expect(after.users).toEqual(before.users)
        expect(
          after.categories.filter((category) => !created.includes(category.id))
        ).toEqual(before.categories)
        await cleanupCategories()
      }
    }
  )
  it.each([null, '', false, 0])(
    'falsy icon %s is removed before the strict schema',
    async (icon) => {
      for (const host of hosts) {
        const response = await request(host, {
          body: JSON.stringify({ ...payload(), icon }),
        })
        expect(response.status).toBe(201)
        expect(response.body.icon).toBeNull()
      }
    }
  )
  it('whitespace-only required values retain the backend defaults', async () => {
    for (const host of hosts) {
      const response = await request(host, {
        body: JSON.stringify({
          name: ' ',
          iconColor: ' ',
          bgColor: '\t',
          fontColor: ' ',
          description: ' ',
          placement: null,
          customIcon: null,
        }),
      })
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({
        name: '',
        slug: '',
        description: null,
        icon: null,
        iconColor: '#000000',
        bgColor: '#e0e0e0',
        fontColor: '#000000',
        placement: null,
        customIcon: null,
      })
      await cleanupCategories()
    }
  })
  it.each(['OPERATOR', 'FINANCIAL'] as const)(
    '%s needs a live EQUIPMENTS/WRITE grant in the current tenant',
    async (membershipRoleValue) => {
      await membershipRole(membershipRoleValue, async () => {
        await refused(
          403,
          { error: 'Permissão insuficiente nesta locadora' },
          { body: '{' }
        )
        const id = await grant(context.alfa.id, membershipRoleValue)
        for (const host of hosts) {
          const response = await request(host)
          expect(response.status).toBe(201)
          expect(response.body.tenantId).toBe(context.alfa.id)
        }
        await prisma.permission.delete({ where: { id } })
        await refused(403, { error: 'Permissão insuficiente nesta locadora' })
      })
    }
  )
  it.each(['wrong-tenant', 'wrong-role', 'wrong-module', 'read-only'] as const)(
    'grant %s does not authorize creation',
    async (kind) => {
      await membershipRole('FINANCIAL', async () => {
        if (kind === 'wrong-tenant') await grant(context.bravo.id, 'FINANCIAL')
        if (kind === 'wrong-role') await grant(context.alfa.id, 'OPERATOR')
        if (kind === 'wrong-module')
          await grant(context.alfa.id, 'FINANCIAL', 'QUOTES')
        // READ is already present for FINANCIAL in bravo only; this is a distinct local grant.
        if (kind === 'read-only')
          await grant(context.alfa.id, 'FINANCIAL', 'EQUIPMENTS', 'READ')
        await refused(
          403,
          { error: 'Permissão insuficiente nesta locadora' },
          { body: '{' }
        )
      })
    }
  )
  it('CLIENT stays forbidden even with an EQUIPMENTS/WRITE row', async () => {
    await grant(context.alfa.id, 'CLIENT')
    await membershipRole('CLIENT', async () => {
      await refused(
        403,
        { error: 'Acesso administrativo não permitido' },
        { body: '{' }
      )
    })
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'inactive membership %s has no effects',
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
  it('no session is refused before malformed body', async () => {
    await refused(
      401,
      { error: 'Authentication required' },
      { cookie: '', body: '{' }
    )
  })
  it('global ADMIN with no tenant membership cannot create', async () => {
    await refused(
      403,
      { error: 'Organization access denied' },
      { cookie: outsider }
    )
  })
  it('no tenant selection is a 409', async () => {
    await refused(
      409,
      { error: 'Select an organization' },
      { headers: { 'x-tenant-id': undefined }, body: '{' }
    )
  })
  it('conflicting cookie and header cannot choose either tenant', async () => {
    await refused(
      400,
      { error: 'Conflicting tenant selection' },
      { cookie: `${jar}; selected-tenant-id=${context.bravo.id}` }
    )
  })
  it('a genuine tenant host supplies the tenant; an explicit conflict is refused', async () => {
    const headers = {
      'x-platform-host-kind': 'tenant',
      'x-platform-tenant-slug': context.alfa.slug,
      'x-platform-origin': `https://${context.alfa.slug}.platform.test`,
      'x-tenant-id': undefined,
    }
    for (const host of hosts) {
      const response = await request(host, { headers })
      expect(response.status).toBe(201)
      expect(response.body.tenantId).toBe(context.alfa.id)
    }
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
  ])('CSRF %j is refused before malformed JSON', async (headers) => {
    await refused(
      403,
      { error: 'Origem não permitida' },
      { headers, body: '{' },
      'no-store'
    )
  })
  it.each(['{', '', 'undefined'])(
    'malformed JSON %s keeps 400 and no writes',
    async (body) => {
      await refused(400, { error: 'JSON inválido' }, { body })
    }
  )
  it('null body keeps the observed 500 with no writes', async () => {
    await refused(500, { error: 'Erro ao criar categoria' }, { body: 'null' })
  })
  it.each([
    { value: [] },
    { value: {} },
    { value: false },
    { value: 'category' },
    { value: { ...payload(), name: '' } },
    { value: { ...payload(), iconColor: '' } },
    { value: { ...payload(), description: null } },
    { value: { ...payload(), placement: 'other' } },
    { value: { ...payload(), customIcon: {} } },
    { value: { ...payload(), customIcon: { source: 'other' } } },
    { value: { ...payload(), tenantId: context.bravo.id } },
    { value: { ...payload(), id: randomUUID() } },
  ])(
    'strict schema %j returns the same 400 before writes',
    async ({ value }) => {
      await refused(
        400,
        { error: 'Dados inválidos' },
        { body: JSON.stringify(value) }
      )
    }
  )
  it('name/slug uniqueness is local to the tenant, including case and accent collisions', async () => {
    for (const host of hosts) {
      const name = `São José ${randomUUID()}`
      const first = await request(host, { body: JSON.stringify(payload(name)) })
      expect(first.status).toBe(201)
      const other = await request(host, {
        headers: { 'x-tenant-id': context.bravo.id },
        body: JSON.stringify(payload(name)),
      })
      expect(other.status).toBe(201)
      expect(other.body.tenantId).toBe(context.bravo.id)
      const before = await state()
      for (const duplicate of [
        name,
        ` ${name.toUpperCase()} `,
        name.replace('São José', 'Sao Jose'),
      ]) {
        const response = await request(host, {
          body: JSON.stringify(payload(duplicate)),
        })
        expect(response.status).toBe(409)
        expect(response.body).toEqual({ error: 'Categoria já existente' })
        expect(await state()).toEqual(before)
      }
    }
  })
  it('an inactive organization is denied before reading malformed JSON', async () => {
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
  it('percent and underscore remain literal in duplicate-name comparison', async () => {
    for (const host of hosts) {
      const suffix = randomUUID()
      for (const name of [
        `Rolo ${suffix}`,
        `Ro_o ${suffix}`,
        `AndaimeX ${suffix}`,
        `Andaime% ${suffix}`,
      ]) {
        expect(
          (await request(host, { body: JSON.stringify(payload(name)) })).status
        ).toBe(201)
      }
    }
  })
  it('concurrent creation for the same tenant/name yields one row and one 409', async () => {
    const input = JSON.stringify(payload())
    const responses = await Promise.all(
      [hosts[0]!, hosts.at(-1)!].map((host) => request(host, { body: input }))
    )
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ])
    expect(
      await prisma.category.count({
        where: { tenantId: context.alfa.id, name: JSON.parse(input).name },
      })
    ).toBe(1)
  })
  it('revoking INSERT produces the observed database-error envelope without persistence', async () => {
    await alterSharedAcl(pool, `REVOKE INSERT ON categories FROM ${role}`)
    try {
      await refused(400, { error: 'Erro ao processar dados da categoria.' })
    } finally {
      await alterSharedAcl(pool, `GRANT INSERT ON categories TO ${role}`)
    }
  })
  it('RLS rejects INSERT without a tenant GUC or with a foreign GUC', async () => {
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
            'INSERT INTO categories (id, "tenantId", name, slug, "updatedAt") VALUES ($1,$2,$3,$4,now())',
            [
              randomUUID(),
              context.alfa.id,
              'Fixture denied category',
              'fixture-denied',
            ]
          )
        ).rejects.toMatchObject({ code: '42501' })
        await connection.query('ROLLBACK')
      }
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
    }
  })
  it('an AFTER INSERT failure rolls the entire category creation back', async () => {
    const name = `api_category_fault_${randomUUID().replaceAll('-', '')}`
    const marker = `fixture-${name}`
    await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.name = '${marker}' THEN RAISE EXCEPTION 'private fixture category failure'; END IF;
      RETURN NEW;
    END $$`)
    try {
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT ON categories FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      await refused(
        400,
        { error: 'Erro ao processar dados da categoria.' },
        { body: JSON.stringify(payload(marker)) }
      )
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON categories`)
      await pool.query(`DROP FUNCTION ${name}()`)
    }
  })
})
