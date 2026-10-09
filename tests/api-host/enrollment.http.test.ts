import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { PrismaClient, type User } from '@prisma/client'
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
const userId = context.identity.users[2]!.id
const hosts = parityTargets(context)
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
const role = new URL(context.runtimeUrl).searchParams
  .get('options')!
  .slice('-c role='.length)
const holder = randomUUID()
const stamp = String(Date.now()).slice(-9)
const document = `78${stamp}`
const edge = (slug = context.alfa.slug): Record<string, string> => ({
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
  'x-platform-client-ip': context.directory.ips[58]!,
})
let jar: string
let original: User
type Options = {
  headers?: Record<string, string>
  body?: string
  query?: string
  cookie?: string
}
const state = async () => ({
  memberships: await prisma.membership.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  }),
  profiles: await prisma.clientProfile.findMany({
    where: { OR: [{ userId }, { id: holder }] },
    orderBy: { id: 'asc' },
  }),
  audits: await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  }),
  user: await prisma.user.findUniqueOrThrow({ where: { id: userId } }),
})
async function reset() {
  await prisma.auditLog.deleteMany({ where: { userId } })
  await prisma.membership.deleteMany({ where: { userId } })
  await prisma.clientProfile.deleteMany({
    where: { OR: [{ userId }, { id: holder }] },
  })
}
async function request(host: string, options: Options = {}) {
  const response = await fetch(
    `${host}/api/client/enroll${options.query ?? ''}`,
    {
      method: 'POST',
      headers: { ...edge(), Cookie: options.cookie ?? jar, ...options.headers },
      body: options.body ?? JSON.stringify({ consent: true }),
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
async function refused(
  status: number,
  body: unknown,
  options: Options = {},
  privateCache = true
) {
  const before = await state()
  // Cada host da rodada contra a mesma expectativa explícita (onda 135, B2): vale com e sem a raiz.
  for (const host of hosts) {
    const result = await request(host, options)
    expect(result).toEqual({
      status,
      body,
      cache: privateCache ? 'private, no-store' : 'no-store',
      vary: privateCache ? `${frameworkVary}, Cookie, Host` : frameworkVary,
      cookie: null,
    })
    expect(await state()).toEqual(before)
  }
}
beforeAll(async () => {
  original = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  jar = await signInParityUser(
    context,
    {
      ...edge(),
      'x-platform-host-kind': 'app',
      'x-platform-tenant-slug': '',
      'x-platform-origin': 'https://app.platform.test',
    },
    2
  )
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: '  Enrollment customer ',
      phone: '(11) 98888-7777',
      cpf: document,
      company: ' Company ',
    },
  })
})
afterAll(async () => {
  await reset()
  if (original)
    await prisma.user.update({ where: { id: userId }, data: original })
  await prisma.$disconnect()
  await pool.end()
})

describe('compiled HTTP client enrollment parity with real identity and RLS', () => {
  it.each<Record<string, string>>([
    { Origin: 'https://bravo.platform.test' },
    { Origin: 'null' },
    {
      Origin: `https://${context.alfa.slug}.platform.test`,
      'Sec-Fetch-Site': 'same-site',
    },
    { 'Sec-Fetch-Site': 'cross-site' },
  ])('CSRF refused before malformed body %j', async (headers) => {
    await refused(
      403,
      { error: 'Origem não permitida' },
      { headers, body: '{' }
    )
  })
  it.each(['missing', 'forged', 'app', 'apex'])(
    'requires trusted tenant host %s regardless of body/query',
    async (kind) => {
      const headers =
        kind === 'missing'
          ? Object.fromEntries(Object.keys(edge()).map((key) => [key, '']))
          : kind === 'forged'
            ? { 'x-platform-edge-auth': 'forged' }
            : {
                'x-platform-host-kind': kind,
                'x-platform-tenant-slug': '',
                'x-platform-origin':
                  kind === 'app'
                    ? 'https://app.platform.test'
                    : 'https://platform.test',
              }
      await refused(
        409,
        {
          error: 'Disponível somente no endereço da locadora',
          code: 'TENANT_REQUIRED',
        },
        { headers, body: '{', query: `?tenantSlug=${context.alfa.slug}` }
      )
    }
  )
  it.each([context.suspended, 'unknown-enrollment-fixture'])(
    'unavailable host %s is a neutral 404 before body/session',
    async (slug) => {
      await refused(
        404,
        { error: 'Locadora não encontrada' },
        { headers: edge(slug), body: '{', cookie: '' },
        false
      )
    }
  )
  it.each(['{', ''])('malformed JSON %s is 400', async (body) => {
    await refused(400, { error: 'Dados inválidos' }, { body })
  })
  it.each([
    { label: 'null-body', payload: null },
    { label: 'array-body', payload: [] },
    { label: 'missing-consent', payload: {} },
    { label: 'refused-consent', payload: { consent: false } },
    { label: 'string-consent', payload: { consent: 'true' } },
    { label: 'forged-role', payload: { consent: true, role: 'ADMIN' } },
    { label: 'forged-user', payload: { consent: true, userId } },
    {
      label: 'forged-tenant',
      payload: { consent: true, tenantId: context.alfa.id },
    },
    { label: 'null-tenant-slug', payload: { consent: true, tenantSlug: null } },
  ])('strict consent input $label', async ({ payload: body }) => {
    await refused(
      400,
      { error: 'Confirme o consentimento para vincular sua conta' },
      { body: JSON.stringify(body) }
    )
  })
  it.each(['body', 'query', 'duplicate'])(
    'conflicting tenant selection %s',
    async (kind) => {
      await refused(
        400,
        { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
        {
          body: JSON.stringify(
            kind === 'body'
              ? { consent: true, tenantSlug: context.bravo.slug }
              : { consent: true }
          ),
          query:
            kind === 'body'
              ? ''
              : kind === 'query'
                ? `?tenantSlug=${context.bravo.slug}`
                : `?tenantSlug=${context.alfa.slug}&tenantSlug=${context.bravo.slug}`,
        },
        false
      )
    }
  )
  it('conflicting tenant header has private headers', async () => {
    await refused(
      400,
      { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
      { headers: { 'x-tenant-id': context.bravo.id } }
    )
  })
  it('real unauthenticated request is 401', async () => {
    await refused(401, { error: 'Authentication required' }, { cookie: '' })
  })
  it.each([context.alfa, context.bravo])(
    'creates isolated CLIENT, profile and audit then repeats idempotently on $slug',
    async (tenant) => {
      const unrelatedBefore = await prisma.membership.findMany({
        where: {
          userId: { not: userId },
          tenantId: { in: [context.alfa.id, context.bravo.id] },
        },
        orderBy: { id: 'asc' },
      })
      const globals = await prisma.user.findMany({
        where: { id: { in: context.identity.users.map((row) => row.id) } },
        orderBy: { id: 'asc' },
      })
      for (const host of hosts) {
        await reset()
        const result = await request(host, {
          headers: {
            ...edge(tenant.slug),
            Origin: `https://${tenant.slug}.platform.test`,
            'Sec-Fetch-Site': 'same-origin',
            'x-tenant-id': tenant.id,
            'User-Agent': 'x'.repeat(600),
          },
          body: JSON.stringify({ consent: true, tenantSlug: tenant.slug }),
          query: `?tenantSlug=${tenant.slug}`,
        })
        expect(result.status).toBe(201)
        expect(result.cache).toBe('private, no-store')
        expect(result.vary).toBe(`${frameworkVary}, Cookie, Host`)
        expect(result.cookie).toBeNull()
        const after = await state()
        expect(after.memberships).toHaveLength(1)
        expect(after.profiles).toHaveLength(1)
        expect(after.audits).toHaveLength(1)
        const membership = after.memberships[0]!
        expect(membership).toMatchObject({
          userId,
          tenantId: tenant.id,
          role: 'CLIENT',
          status: 'ACTIVE',
        })
        expect(result.body).toEqual({
          created: true,
          membership: {
            membershipId: membership.id,
            role: 'CLIENT',
            tenant: {
              id: tenant.id,
              slug: tenant.slug,
              name: tenant.id === context.alfa.id ? 'alfa' : 'bravo',
              status: 'ACTIVE',
            },
          },
        })
        expect(after.profiles[0]).toMatchObject({
          userId,
          tenantId: tenant.id,
          name: 'Enrollment customer',
          phone: '11988887777',
          document,
          company: 'Company',
          email: original.email,
        })
        expect(after.audits[0]).toMatchObject({
          tenantId: tenant.id,
          userId,
          action: 'CLIENT_ENROLLED',
          entity: 'Membership',
          entityId: membership.id,
          changes: { role: 'CLIENT', consent: true },
          ipAddress: context.directory.ips[58],
          userAgent: 'x'.repeat(512),
        })
        const again = await request(host, { headers: edge(tenant.slug) })
        expect(again).toEqual({
          ...result,
          status: 200,
          body: { ...result.body, created: false },
        })
        expect(await state()).toEqual(after)
        expect(
          await prisma.user.findMany({
            where: { id: { in: context.identity.users.map((row) => row.id) } },
            orderBy: { id: 'asc' },
          })
        ).toEqual(globals)
        expect(
          await prisma.membership.findMany({
            where: {
              userId: { not: userId },
              tenantId: { in: [context.alfa.id, context.bravo.id] },
            },
            orderBy: { id: 'asc' },
          })
        ).toEqual(unrelatedBefore)
      }
      await reset()
    }
  )
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'existing active role %s is not changed or repaired',
    async (role) => {
      await reset()
      const membership = await prisma.membership.create({
        data: { userId, tenantId: context.alfa.id, role, status: 'ACTIVE' },
      })
      const before = await state()
      for (const host of hosts) {
        const result = await request(host)
        expect(result.status).toBe(200)
        expect(result.body.membership).toMatchObject({
          membershipId: membership.id,
          role,
        })
        expect(result.body.created).toBe(false)
        expect(await state()).toEqual(before)
      }
      await reset()
    }
  )
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'never reactivates %s',
    async (status) => {
      await reset()
      await prisma.membership.create({
        data: { userId, tenantId: context.alfa.id, role: 'CLIENT', status },
      })
      await refused(403, {
        error: 'Vínculo com esta locadora indisponível',
        code: 'MEMBERSHIP_INACTIVE',
      })
      await reset()
    }
  )
  it.each([null, context.identity.users[1]!.id])(
    'never adopts document held by %s',
    async (owner) => {
      await reset()
      await prisma.clientProfile.create({
        data: {
          id: holder,
          tenantId: context.alfa.id,
          userId: owner,
          name: 'Do not adopt',
          document,
        },
      })
      await refused(409, {
        error: 'Não foi possível concluir o vínculo. Fale com a locadora.',
        code: 'PROFILE_CONFLICT',
      })
      await reset()
    }
  )
  it('existing own profile is preserved when membership is created', async () => {
    for (const host of hosts) {
      await reset()
      const profile = await prisma.clientProfile.create({
        data: {
          tenantId: context.alfa.id,
          userId,
          name: 'Existing commercial profile',
          document: null,
        },
      })
      expect((await request(host)).status).toBe(201)
      expect((await state()).profiles).toEqual([profile])
    }
    await reset()
  })
  it.each(['memberships', 'client_profiles', 'audit_logs'])(
    'INSERT privilege failure in %s leaves no partial enrollment',
    async (table) => {
      await reset()
      await alterSharedAcl(pool, `REVOKE INSERT ON ${table} FROM ${role}`)
      try {
        await refused(503, { error: 'Vínculo indisponível no momento' })
      } finally {
        await alterSharedAcl(pool, `GRANT INSERT ON ${table} TO ${role}`)
      }
    }
  )
  it('concurrent requests have one creator, one rereader and exactly one consent record', async () => {
    await reset()
    const results = await Promise.all([
      request(hosts[0]!),
      request(hosts.at(-1)!),
    ])
    expect(results.map((row) => row.status).sort()).toEqual([200, 201])
    expect(results.map((row) => row.body.created).sort()).toEqual([false, true])
    // parity-scan: as duas chamadas reais (criadora e releitora) devolvem o mesmo vínculo.
    expect(results[0]!.body.membership).toEqual(results[1]!.body.membership)
    const rows = await state()
    expect(rows.memberships).toHaveLength(1)
    expect(rows.profiles).toHaveLength(1)
    expect(rows.audits).toHaveLength(1)
    await reset()
  })
  it.each(['client_profiles', 'audit_logs'])(
    'runtime INSERT in %s is blocked without tenant GUC and for a foreign tenant',
    async (table) => {
      const connection = await pool.connect()
      try {
        for (const scoped of [false, true]) {
          await connection.query('BEGIN')
          try {
            await connection.query(`SET LOCAL ROLE ${role}`)
            if (scoped)
              await connection.query(
                "SELECT set_config('app.tenant_id', $1, true)",
                [context.alfa.id]
              )
            const id = randomUUID()
            const statement =
              table === 'client_profiles'
                ? `INSERT INTO client_profiles (id,"tenantId","userId",name,"createdAt","updatedAt") VALUES ($1,$2,$3,'No access',now(),now())`
                : `INSERT INTO audit_logs (id,"tenantId","userId",action,entity,"entityId","createdAt") VALUES ($1,$2,$3,'CLIENT_ENROLLED','Membership',$1,now())`
            await expect(
              connection.query(statement, [id, context.bravo.id, userId])
            ).rejects.toMatchObject({ code: '42501' })
          } finally {
            await connection.query('ROLLBACK')
          }
        }
      } finally {
        connection.release()
      }
    }
  )
})
