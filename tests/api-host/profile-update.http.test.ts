import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { PrismaClient, type ClientProfile } from '@prisma/client'
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
const ids = Array.from({ length: 6 }, () => randomUUID())
const users = context.identity.users.map((row) => row.id)
const user = users[0]!
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[57]!,
}
const tenantEdge = (slug = context.alfa.slug) => ({
  ...edge,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const a = { 'x-tenant-id': context.alfa.id }
const jars: string[] = []
const role = new URL(context.runtimeUrl).searchParams
  .get('options')!
  .slice('-c role='.length)
type Options = {
  body?: string
  jar?: string
  headers?: Record<string, string>
  query?: string
}
const hosts = parityTargets(context)

async function snapshot() {
  return prisma.clientProfile.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
  })
}
async function restore(rows: ClientProfile[]) {
  await prisma.$transaction(async (tx) => {
    for (const row of rows)
      await tx.clientProfile.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      })
  })
}
const dto = (row: ClientProfile) => ({
  id: row.userId,
  name: row.name,
  email: row.email,
  phone: row.phone,
  cpf: row.document?.length === 11 ? row.document : null,
  cnpj: row.document?.length === 14 ? row.document : null,
  company: row.company,
})
function headersFor(options: Options) {
  const headers = new Headers({
    Cookie: options.jar ?? jars[0]!,
    ...a,
    ...options.headers,
  })
  if (headers.get('x-tenant-id') === '') headers.delete('x-tenant-id')
  return headers
}
async function request(origin: string, options: Options = {}) {
  const headers = headersFor(options)
  const response = await fetch(
    `${origin}/api/user/profile${options.query ?? ''}`,
    {
      method: 'PUT',
      headers,
      body:
        options.body ??
        JSON.stringify({
          phone: '(11) 98888-7777',
          company: ' Updated company ',
        }),
    }
  )
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
  }
}
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
/** Cabeçalhos esperados de cada recusa, pela camada que a produz (principal, origem ou rota). */
function refusalHeaders(error: string) {
  return {
    cache:
      error === 'Locadora não encontrada' || error === 'Origem não permitida'
        ? 'no-store'
        : null,
    vary: frameworkVary,
  }
}
async function refused(status: number, error: string, options: Options = {}) {
  const before = await snapshot()
  // Cada host da rodada contra a mesma expectativa explícita (onda 135, B2): vale com e sem a raiz.
  for (const origin of hosts) {
    const result = await request(origin, options)
    expect(result).toEqual({
      status,
      body: { error },
      ...refusalHeaders(error),
      cookie: null,
    })
    expect(await snapshot()).toEqual(before)
  }
}
async function success(
  body: unknown,
  changes: Partial<ClientProfile>,
  options: Options = {},
  profileId = ids[0]!
) {
  const before = await snapshot()
  const globals = await prisma.user.findMany({
    where: { id: { in: users } },
    orderBy: { id: 'asc' },
  })
  const own = before.find((row) => row.id === profileId)!
  try {
    for (const origin of hosts) {
      await restore(before)
      const started = Date.now()
      const result = await request(origin, {
        ...options,
        body: JSON.stringify(body),
      })
      expect(result).toEqual({
        status: 200,
        body: { success: true, user: dto({ ...own, ...changes }) },
        cache: 'no-store',
        vary: frameworkVary,
        cookie: null,
      })
      const after = await snapshot()
      expect(after.filter((row) => row.id !== own.id)).toEqual(
        before.filter((row) => row.id !== own.id)
      )
      const updated = after.find((row) => row.id === own.id)!
      if (Object.keys(changes).length === 0)
        expect(updated.updatedAt).toEqual(own.updatedAt)
      else expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(started)
      expect(updated).toEqual({
        ...own,
        ...changes,
        updatedAt: updated.updatedAt,
      })
      expect(
        await prisma.user.findMany({
          where: { id: { in: users } },
          orderBy: { id: 'asc' },
        })
      ).toEqual(globals)
      const read = await fetch(`${origin}/api/user/profile`, {
        headers: headersFor(options),
      })
      expect(read.status).toBe(200)
      expect(await read.json()).toEqual({ user: dto(updated) })
    }
  } finally {
    await restore(before)
  }
}

beforeAll(async () => {
  expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
  await prisma.clientProfile.createMany({
    data: ids.map((id, index) => ({
      id,
      tenantId: index === 1 || index === 3 ? context.bravo.id : context.alfa.id,
      userId:
        index < 2
          ? user
          : index < 4
            ? users[1]!
            : index === 4
              ? users[2]!
              : null,
      name: `Update profile ${index}`,
      email: `update-${index}@example.test`,
      document: [
        `12345678901`,
        `99999999999`,
        `22222222222`,
        `33333333333`,
        `44444444444`,
        `55555555555`,
      ][index]!,
      phone: `initial-phone-${index}`,
      company: `Initial company ${index}`,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    })),
  })
  for (let index = 0; index < users.length; index++)
    jars.push(await signInParityUser(context, edge, index))
})
afterAll(async () => {
  await prisma.clientProfile.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
  await pool.end()
})

describe(`${context.identity.mode} — own commercial profile update`, () => {
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])('requires a real session before invalid JSON %s', async (jar) => {
    await refused(401, 'Authentication required', { jar, body: '{' })
  })
  it('does not select a tenant from query, profile or global ADMIN', async () => {
    await refused(409, 'Select an organization', {
      headers: { 'x-tenant-id': '' },
      query: `?tenantId=${context.alfa.id}&userId=${users[1]}&role=ADMIN`,
    })
    for (const jar of [jars[1]!, jars[2]!])
      await refused(403, 'Organization access denied', { jar })
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'rechecks the %s membership before writing',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await refused(403, 'Organization access denied')
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('rechecks organization suspension', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await refused(403, 'Organization access denied')
    } finally {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'ACTIVE' },
        })
      )
    }
  })
  it.each(['header-cookie', 'host-header', 'host-cookie'] as const)(
    'refuses conflicting %s selection',
    async (kind) => {
      await refused(400, 'Conflicting tenant selection', {
        jar:
          kind === 'host-header'
            ? jars[0]!
            : `${jars[0]}; selected-tenant-id=${context.bravo.id}`,
        headers:
          kind === 'header-cookie'
            ? a
            : kind === 'host-header'
              ? { ...tenantEdge(), 'x-tenant-id': context.bravo.id }
              : { ...tenantEdge(), 'x-tenant-id': '' },
      })
    }
  )
  it.each(['unknown-locadora', context.suspended])(
    'keeps neutral 404 for %s',
    async (slug) => {
      await refused(404, 'Locadora não encontrada', {
        jar: '',
        headers: { ...tenantEdge(slug), 'x-tenant-id': '' },
      })
    }
  )
  it.each<Record<string, string>>([
    { Origin: 'https://bravo.platform.test' },
    { Origin: 'null' },
    { 'Sec-Fetch-Site': 'same-site' },
    { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'cross-site' },
  ])(
    'refuses browser-origin violation %j before malformed JSON',
    async (headers) => {
      await refused(403, 'Origem não permitida', {
        headers: { ...edge, ...headers },
        body: '{',
      })
    }
  )
  const invalid: unknown[] = [
    null,
    [],
    'profile',
    1,
    true,
    { phone: null },
    { phone: 123 },
    { phone: '1'.repeat(31) },
    { company: null },
    { company: 123 },
    { company: 'a'.repeat(201) },
    { cpf: null },
    { cpf: 123 },
    { cpf: '1'.repeat(21) },
    { cnpj: null },
    { cnpj: {} },
    { cnpj: '1'.repeat(21) },
    { name: 'Override' },
    { email: 'override@example.test' },
    { document: '12345678901' },
    { userId: 'foreign' },
    { tenantId: 'foreign' },
    { role: 'ADMIN' },
    { id: 'foreign' },
  ]
  it.each(invalid)(
    'keeps strict validation and no side effects for %j',
    async (body) => {
      await refused(400, 'Dados inválidos', { body: JSON.stringify(body) })
    }
  )
  it.each(['{', ''])('keeps malformed JSON %j as generic 500', async (body) => {
    await refused(500, 'Erro ao atualizar perfil', { body })
  })
  it.each([
    { cpf: '123' },
    { cnpj: '123' },
    { cpf: '12345678000199' },
    { cnpj: '12345678901' },
    { cpf: '12345678901', cnpj: '12345678000199' },
    { cnpj: '12ABC678000199' },
  ])('preserves numeric document rejection %j', async (body) => {
    await refused(400, 'Informe somente CPF ou CNPJ válido', {
      body: JSON.stringify(body),
    })
  })
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'updates own profile for %s without a global identity change',
    async (membershipRole) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({
          where: { id },
          data: { role: membershipRole },
        })
        await success(
          { phone: '(11) 98888-7777', company: ' Updated ' },
          { phone: '11988887777', company: 'Updated' },
          {
            query: `?userId=${users[1]}&tenantId=${context.bravo.id}&fields=password`,
          }
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT' },
        })
      }
    }
  )
  it.each([
    [{ cpf: '987.654.321-00' }, { document: '98765432100' }],
    [{ cnpj: '12.345.678/0001-99' }, { document: '12345678000199' }],
    [
      { phone: '', company: '   ' },
      { phone: null, company: null },
    ],
    [{ phone: 'letters only' }, { phone: null }],
    [{}, {}],
    [{ cpf: '', cnpj: '' }, {}],
    [{ cpf: 'letters only', cnpj: 'letters only' }, {}],
    [
      { phone: '1'.repeat(30), company: 'a'.repeat(200) },
      { phone: '1'.repeat(30), company: 'a'.repeat(200) },
    ],
  ] as const)('preserves exact normalization for %j', async (body, changes) => {
    await success(body, changes)
  })
  it.each(['app-origin', 'native', 'tenant-host', 'cookie'] as const)(
    'accepts existing %s transport',
    async (transport) => {
      const headers: Record<string, string> =
        transport === 'app-origin'
          ? {
              ...edge,
              Origin: edge['x-platform-origin'],
              'Sec-Fetch-Site': 'same-origin',
            }
          : transport === 'tenant-host'
            ? {
                ...tenantEdge(),
                'x-tenant-id': '',
                Origin: tenantEdge()['x-platform-origin'],
              }
            : transport === 'cookie'
              ? { 'x-tenant-id': '' }
              : {}
      await success(
        { company: 'Transport' },
        { company: 'Transport' },
        {
          headers,
          jar:
            transport === 'cookie'
              ? `${jars[0]}; selected-tenant-id=${context.alfa.id}`
              : jars[0]!,
        }
      )
    }
  )
  it('updates only the other own tenant profile', async () => {
    await success(
      { company: 'Bravo update' },
      { company: 'Bravo update' },
      { headers: { 'x-tenant-id': context.bravo.id } },
      ids[1]!
    )
  })
  it('updates only the second identity own profile in Bravo', async () => {
    await success(
      { company: 'Other owner' },
      { company: 'Other owner' },
      { jar: jars[1]!, headers: { 'x-tenant-id': context.bravo.id } },
      ids[3]!
    )
  })
  it('allows an existing document in a different tenant', async () => {
    await success({ cpf: '99999999999' }, { document: '99999999999' })
  })
  it.each(['22222222222', '55555555555'])(
    'keeps duplicate document %s as 409 with no partial phone/company update',
    async (cpf) => {
      await refused(409, 'Documento já cadastrado nesta locadora', {
        body: JSON.stringify({ cpf, phone: '123', company: 'Must roll back' }),
      })
    }
  )
  it('never creates or substitutes a missing commercial profile', async () => {
    const before = await snapshot()
    try {
      await prisma.clientProfile.delete({ where: { id: ids[0]! } })
      await refused(404, 'Perfil da locadora não encontrado')
      expect(
        await prisma.clientProfile.count({
          where: { tenantId: context.alfa.id, userId: user },
        })
      ).toBe(0)
    } finally {
      await restore(before)
    }
  })
  it('sanitizes a real UPDATE permission failure before any persisted change', async () => {
    try {
      await alterSharedAcl(
        pool,
        `REVOKE UPDATE ON client_profiles FROM ${role}`
      )
      await refused(500, 'Erro ao atualizar perfil')
    } finally {
      await alterSharedAcl(pool, `GRANT UPDATE ON client_profiles TO ${role}`)
    }
  })
  it('rolls back an update rejected by an AFTER trigger', async () => {
    const trigger = `api_profile_fail_${randomUUID().replaceAll('-', '').slice(0, 12)}`
    try {
      await pool.query(
        `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${ids[0]}' AND NEW.company='forced failure' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$`
      )
      await pool.query(
        `CREATE TRIGGER ${trigger} AFTER UPDATE ON client_profiles FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
      )
      await refused(500, 'Erro ao atualizar perfil', {
        body: JSON.stringify({
          company: 'forced failure',
          cpf: '77777777777',
          phone: '123',
        }),
      })
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON client_profiles`)
      await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`)
    }
  })
  it('enforces tenant document uniqueness for concurrent writers across the hosts', async () => {
    const before = await snapshot()
    const membership = randomUUID()
    try {
      await prisma.membership.create({
        data: {
          id: membership,
          tenantId: context.alfa.id,
          userId: users[1]!,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      })
      const results = await Promise.all([
        request(hosts[0]!, {
          body: JSON.stringify({ cpf: '88888888888' }),
        }),
        request(hosts[hosts.length - 1]!, {
          jar: jars[1]!,
          body: JSON.stringify({ cpf: '88888888888' }),
        }),
      ])
      expect(results.map((row) => row.status).sort()).toEqual([200, 409])
      expect(results.find((row) => row.status === 409)!.body).toEqual({
        error: 'Documento já cadastrado nesta locadora',
      })
      const after = await snapshot()
      const changed = after.filter((row) => row.document === '88888888888')
      expect(changed).toHaveLength(1)
      expect([ids[0], ids[2]]).toContain(changed[0]!.id)
      expect(after.filter((row) => row.id !== changed[0]!.id)).toEqual(
        before.filter((row) => row.id !== changed[0]!.id)
      )
    } finally {
      await restore(before)
      await prisma.membership.deleteMany({ where: { id: membership } })
    }
  })
  it('proves RLS UPDATE isolation using a runtime role without bypass or ownership', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await runtime.connect()
    const before = await snapshot()
    try {
      expect(
        (
          await connection.query(
            "SELECT r.rolsuper, r.rolbypassrls, c.relrowsecurity, c.relforcerowsecurity, pg_has_role(current_user,c.relowner,'MEMBER') AS owns FROM pg_roles r JOIN pg_class c ON c.relname='client_profiles' WHERE r.rolname=current_user"
          )
        ).rows[0]
      ).toEqual({
        rolsuper: false,
        rolbypassrls: false,
        relrowsecurity: true,
        relforcerowsecurity: true,
        owns: false,
      })
      await connection.query('BEGIN')
      expect(
        (
          await connection.query(
            'UPDATE client_profiles SET company=$1 WHERE id=$2',
            ['forged', ids[0]]
          )
        ).rowCount
      ).toBe(0)
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect(
        (
          await connection.query(
            'UPDATE client_profiles SET company=$1 WHERE id=$2',
            ['forged', ids[1]]
          )
        ).rowCount
      ).toBe(0)
      expect(
        (
          await connection.query(
            'UPDATE client_profiles SET company=$1 WHERE id=$2',
            ['scoped', ids[0]]
          )
        ).rowCount
      ).toBe(1)
      await connection.query('ROLLBACK')
      expect(await snapshot()).toEqual(before)
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await runtime.end()
    }
  })
})
