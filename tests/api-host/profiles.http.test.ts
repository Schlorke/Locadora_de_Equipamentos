import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
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
const ids = Array.from({ length: 5 }, () => randomUUID())
const user = context.identity.users[0]!.id
const other = context.identity.users[1]!.id
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[59]!,
}
const tenantEdge = (slug = context.alfa.slug) => ({
  ...edge,
  'x-platform-host-kind': 'tenant',
  'x-platform-tenant-slug': slug,
  'x-platform-origin': `https://${slug}.platform.test`,
})
const a = { 'x-tenant-id': context.alfa.id }
const b = { 'x-tenant-id': context.bravo.id }
const jars: string[] = []
const expected = (index = 0) => ({
  user: {
    id: index === 2 ? other : user,
    name: ['Commercial Alfa', 'Commercial Bravo', 'Other Bravo'][index],
    email: `commercial-${index}@example.test`,
    phone: `fixture-phone-${index}`,
    cpf: index === 0 ? '12345678901' : null,
    cnpj:
      index === 1 ? '12ABC678000199' : index === 2 ? '98765432000199' : null,
    company: `Company ${index}`,
  },
})

beforeAll(async () => {
  await prisma.clientProfile.createMany({
    data: [
      {
        id: ids[0]!,
        tenantId: context.alfa.id,
        userId: user,
        document: '12345678901',
        name: 'Commercial Alfa',
        email: 'commercial-0@example.test',
        phone: 'fixture-phone-0',
        company: 'Company 0',
      },
      {
        id: ids[1]!,
        tenantId: context.bravo.id,
        userId: user,
        document: '12ABC678000199',
        name: 'Commercial Bravo',
        email: 'commercial-1@example.test',
        phone: 'fixture-phone-1',
        company: 'Company 1',
      },
      {
        id: ids[2]!,
        tenantId: context.bravo.id,
        userId: other,
        document: '98765432000199',
        name: 'Other Bravo',
        email: 'commercial-2@example.test',
        phone: 'fixture-phone-2',
        company: 'Company 2',
      },
      {
        id: ids[3]!,
        tenantId: context.alfa.id,
        userId: context.identity.users[2]!.id,
        document: '22222222222',
        name: 'Profile without membership',
      },
      {
        id: ids[4]!,
        tenantId: context.alfa.id,
        userId: null,
        document: '33333333333',
        name: 'Unlinked historic profile',
      },
    ],
  })
  for (let index = 0; index < context.identity.users.length; index++)
    jars.push(await signInParityUser(context, edge, index))
})
afterAll(async () => {
  await prisma.clientProfile.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
  await pool.end()
})

async function read(
  origin: string,
  jar = '',
  headers: Record<string, string> = {},
  query = '',
  method = 'GET'
) {
  const response = await fetch(`${origin}/api/user/profile${query}`, {
    method,
    headers: { Cookie: jar, ...headers },
  })
  return {
    status: response.status,
    body: await response.text(),
    cache: response.headers.get('cache-control'),
    vary: response.headers.get('vary'),
    cookie: response.headers.get('set-cookie'),
    allow: response.headers.get('allow'),
  }
}
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
/** Cabeçalhos esperados da leitura do perfil, pela camada que responde (onda 135, B2). */
function readHeaders(status: number, body: unknown) {
  const error = (body as { error?: string } | null)?.error
  return {
    cache:
      status === 200 ||
      error === 'Locadora não encontrada' ||
      error === 'Origem não permitida'
        ? 'no-store'
        : null,
    vary: frameworkVary,
  }
}
/** Cada host da rodada contra a resposta explícita esperada (nenhum host serve de gabarito do outro). */
async function parity(
  jar: string,
  headers: Record<string, string>,
  status: number,
  body: unknown,
  query = ''
) {
  let last: Awaited<ReturnType<typeof read>> | undefined
  for (const origin of parityTargets(context)) {
    const result = await read(origin, jar, headers, query)
    expect({ ...result, body: JSON.parse(result.body) }).toEqual({
      status,
      body,
      ...readHeaders(status, body),
      cookie: null,
      allow: null,
    })
    last = result
  }
  return last!
}

describe(`${context.identity.mode} — tenant commercial profile parity`, () => {
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])('requires the live identity cookie: %s', async (jar) => {
    await parity(jar, a, 401, { error: 'Authentication required' })
  })
  it('never selects a tenant from a query or authenticates using spoofed identity', async () => {
    await parity(
      jars[0]!,
      {},
      409,
      { error: 'Select an organization' },
      `?tenantId=${context.alfa.id}&userId=${other}&role=ADMIN`
    )
  })
  it('never uses an existing profile or global ADMIN to bypass missing membership', async () => {
    await parity(jars[2]!, a, 403, { error: 'Organization access denied' })
    await parity(jars[1]!, a, 403, { error: 'Organization access denied' })
  })
  it('keeps the exact DTO and hides storage identifiers/global identity fields', async () => {
    const result = await parity(jars[0]!, a, 200, expected())
    expect(result.cache).toBe('no-store')
    expect(result.body).not.toContain(ids[0])
    expect(result.body).not.toContain('tenantId')
    expect(result.body).not.toContain(context.identity.users[0]!.email)
    expect(result.body).not.toContain('fixture-private-customer')
    expect(result.body).not.toContain('createdAt')
  })
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'reads the other own commercial profile with %s selection',
    async (transport) => {
      const headers =
        transport === 'cookie'
          ? {}
          : transport === 'header'
            ? b
            : transport === 'host'
              ? tenantEdge(context.bravo.slug)
              : { ...tenantEdge(context.bravo.slug), ...b }
      const jar =
        transport === 'cookie' || transport === 'matching'
          ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
          : jars[0]!
      await parity(jar, headers, 200, expected(1))
    }
  )
  it('reads only the other identity profile in the same tenant', async () => {
    await parity(
      jars[1]!,
      b,
      200,
      expected(2),
      `?userId=${user}&tenantId=${context.alfa.id}&fields=password&role=ADMIN`
    )
  })
  it('ignores projection, document and identity/tenant query overrides', async () => {
    await parity(
      jars[0]!,
      a,
      200,
      expected(),
      `?id=${ids[2]}&userId=${other}&tenantId=${context.bravo.id}&role=ADMIN&cpf=foreign&fields=name`
    )
  })
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'revalidates the %s membership and keeps reading only its own profile',
    async (role) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { role } })
        await parity(jars[0]!, a, 200, expected())
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT' },
        })
      }
    }
  )
  it('never substitutes the global account or creates a profile when the selected tenant has none', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await parity(jars[0]!, { 'x-tenant-id': context.unconfigured }, 404, {
        error: 'Perfil da locadora não encontrado',
      })
      expect(
        await prisma.clientProfile.count({
          where: { tenantId: context.unconfigured },
        })
      ).toBe(0)
    } finally {
      await prisma.membership.update({
        where: { id },
        data: { status: 'REVOKED' },
      })
    }
  })
  it('keeps null commercial values after a live profile change', async () => {
    try {
      await prisma.clientProfile.update({
        where: { id: ids[0]! },
        data: { email: null, phone: null, company: null, document: null },
      })
      await parity(jars[0]!, a, 200, {
        user: {
          ...expected().user,
          email: null,
          phone: null,
          company: null,
          cpf: null,
        },
      })
    } finally {
      await prisma.clientProfile.update({
        where: { id: ids[0]! },
        data: {
          email: 'commercial-0@example.test',
          phone: 'fixture-phone-0',
          company: 'Company 0',
          document: '12345678901',
        },
      })
    }
  })
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'refuses a %s membership with the existing session',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await parity(jars[0]!, a, 403, { error: 'Organization access denied' })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('rechecks the organization suspended after login', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await parity(jars[0]!, a, 403, { error: 'Organization access denied' })
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
    'refuses the %s selection conflict',
    async (kind) => {
      const jar =
        kind === 'host-header'
          ? jars[0]!
          : `${jars[0]}; selected-tenant-id=${context.alfa.id}`
      const headers =
        kind === 'header-cookie'
          ? b
          : kind === 'host-header'
            ? { ...tenantEdge(context.bravo.slug), ...a }
            : tenantEdge(context.bravo.slug)
      await parity(jar, headers, 400, { error: 'Conflicting tenant selection' })
    }
  )
  it.each(['unknown-locadora', context.suspended])(
    'keeps the neutral %s host 404 before identity',
    async (slug) => {
      await parity('', tenantEdge(slug), 404, {
        error: 'Locadora não encontrada',
      })
    }
  )
  it('sanitizes a real profile SELECT failure without returning a missing-profile fallback', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(
        pool,
        `REVOKE SELECT ON client_profiles FROM ${role}`
      )
      await parity(jars[0]!, a, 500, { error: 'Erro ao buscar perfil' })
      await parity('', a, 401, { error: 'Authentication required' })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON client_profiles TO ${role}`)
    }
  })
  it('proves RLS isolation for profile rows with a runtime role without bypass/ownership', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      const state = (
        await connection.query(
          "SELECT r.rolsuper, r.rolbypassrls, c.relrowsecurity, c.relforcerowsecurity, pg_has_role(current_user,c.relowner,'MEMBER') AS owns FROM pg_roles r JOIN pg_class c ON c.relname='client_profiles' WHERE r.rolname=current_user"
        )
      ).rows[0]
      expect(state).toEqual({
        rolsuper: false,
        rolbypassrls: false,
        relrowsecurity: true,
        relforcerowsecurity: true,
        owns: false,
      })
      await connection.query('BEGIN')
      expect(
        (await connection.query('SELECT id FROM client_profiles')).rows
      ).toEqual([])
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect(
        (
          await connection.query('SELECT id FROM client_profiles ORDER BY id')
        ).rows
          .map((row) => row.id)
          .sort()
      ).toEqual([ids[0], ids[3], ids[4]].sort())
      expect(
        (
          await connection.query(
            'SELECT id FROM client_profiles WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect(
        (await connection.query('SELECT id FROM client_profiles')).rows
      ).toEqual([])
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await scoped.end()
    }
  })
  it('keeps GET/HEAD and automatic OPTIONS parity with the shared PUT', async () => {
    for (const origin of parityTargets(context)) {
      expect(await read(origin, jars[0]!, a, '', 'HEAD')).toEqual({
        status: 200,
        body: '',
        ...readHeaders(200, {}),
        cookie: null,
        allow: null,
      })
      const options = await read(origin, '', {}, '', 'OPTIONS')
      expect(options.status).toBe(204)
      expect(options.allow?.split(/,\s*/).sort()).toEqual([
        'GET',
        'HEAD',
        'OPTIONS',
        'PUT',
      ])
      for (const method of ['POST', 'PATCH', 'DELETE'])
        expect((await read(origin, jars[0]!, a, '', method)).status).toBe(405)
    }
  })
  it('refuses an engine-revoked session on the same tenant profile', async () => {
    const userId = context.identity.users[0]!.id
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true },
    })
    try {
      if (context.identity.mode === 'better-auth')
        await prisma.authSession.deleteMany({ where: { userId } })
      else
        await prisma.user.update({
          where: { id: userId },
          data: { password: 'fixture-rotated-credential' },
        })
      await parity(jars[0]!, a, 401, { error: 'Authentication required' })
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { password: saved.password },
      })
    }
  })
})
