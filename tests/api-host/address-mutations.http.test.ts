import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { PrismaClient, type Address } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { alterSharedAcl } from '../helpers/shared-acl'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity')
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const users = context.identity.users.map((row) => row.id)
const user = users[0]!
const other = users[1]!
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
const b = { 'x-tenant-id': context.bravo.id }
const jars: string[] = []
const input = {
  street: 'Cut 23 street',
  number: '23',
  complement: null,
  neighborhood: 'Cut 23 neighborhood',
  city: 'Cut 23 city',
  state: 'SP',
  zipCode: '01001-000',
}
type Method = 'POST' | 'PATCH' | 'DELETE'
type Options = {
  id?: string
  jar?: string
  headers?: Record<string, string>
  body?: string
  query?: string
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value))
/** Issues completos do Zod esperados para cada corpo inválido (contrato de endereço; onda 135, B2). */
function addressIssues(_method: Method, body: string): unknown[] {
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
  if (['{', '', 'null'].includes(body)) return [invalidType('object', 'null')]
  if (body === '[]') return [invalidType('object', 'array')]
  if (body === '"string"') return [invalidType('object', 'string')]
  const value = JSON.parse(body) as Record<string, unknown>
  if (value.street === '')
    return [
      {
        origin: 'string',
        code: 'too_small',
        minimum: 1,
        inclusive: true,
        path: ['street'],
        message: 'Too small: expected string to have >=1 characters',
      },
    ]
  if (value.state === 'ABC')
    return [
      {
        origin: 'string',
        code: 'invalid_format',
        format: 'regex',
        pattern: '/^[a-zA-Z]{2}$/',
        path: ['state'],
        message: 'Invalid string: must match pattern /^[a-zA-Z]{2}$/',
      },
    ]
  if (value.zipCode === 'invalid')
    return [
      {
        origin: 'string',
        code: 'invalid_format',
        format: 'regex',
        pattern: '/^\\d{5}-?\\d{3}$/',
        path: ['zipCode'],
        message: 'Invalid string: must match pattern /^\\d{5}-?\\d{3}$/',
      },
    ]
  if (value.isPrimary === 'true')
    return [invalidType('boolean', 'string', ['isPrimary'])]
  throw new Error('Unknown invalid address fixture')
}
const snapshot = () =>
  prisma.address.findMany({
    where: { userId: { in: users } },
    orderBy: { id: 'asc' },
  })
async function restore(rows: Address[]) {
  // Only this run's users; restore old primary flags together to avoid index conflicts.
  await prisma.$transaction(async (tx) => {
    await tx.address.deleteMany({ where: { userId: { in: users } } })
    await tx.address.createMany({ data: rows })
  })
}
beforeAll(async () => {
  for (let index = 0; index < users.length; index++)
    jars.push(await signInParityUser(context, edge, index))
})
afterAll(async () => {
  await prisma.$disconnect()
  await pool.end()
})

async function mutate(origin: string, method: Method, options: Options = {}) {
  const path =
    '/api/addresses' +
    (method === 'POST' ? '' : '/' + (options.id ?? context.addresses.alfa[1]!))
  const headers = new Headers({
    Cookie: options.jar ?? jars[0]!,
    ...a,
    ...options.headers,
  })
  // An empty fixture selection means an absent header, not a second candidate.
  if (headers.get('x-tenant-id') === '') headers.delete('x-tenant-id')
  const response = await fetch(`${origin}${path}${options.query ?? ''}`, {
    method,
    headers,
    body:
      options.body ??
      (method === 'POST'
        ? JSON.stringify(input)
        : method === 'PATCH'
          ? '{"city":"Changed city"}'
          : undefined),
  })
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    cookie: response.headers.get('set-cookie'),
    vary: response.headers.get('vary'),
  }
}
const frameworkVary =
  'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch'
/** Cabeçalhos esperados de uma recusa, pela camada que responde (onda 135, B2). */
function refusalHeaders(_status: number, body: unknown) {
  const error = (body as { error?: string } | null)?.error
  return {
    cache:
      error === 'Locadora não encontrada' || error === 'Origem não permitida'
        ? 'no-store'
        : null,
    vary: frameworkVary,
  }
}
/** Cada host da rodada contra a recusa explícita esperada (nenhum host serve de gabarito do outro). */
async function refused(
  method: Method,
  status: number,
  body: unknown,
  options: Options = {}
) {
  const before = await snapshot()
  let last: Awaited<ReturnType<typeof mutate>> | undefined
  for (const origin of parityTargets(context)) {
    const result = await mutate(origin, method, options)
    expect(result).toEqual({
      status,
      body,
      ...refusalHeaders(status, body),
      cookie: null,
    })
    expect(await snapshot()).toEqual(before)
    last = result
  }
  return last!
}
async function success(
  method: Method,
  options: Options = {},
  patch: Partial<typeof input> & { isPrimary?: boolean } = {},
  tenant = context.alfa.id,
  owner = user
) {
  const before = await snapshot()
  try {
    for (const origin of parityTargets(context)) {
      await restore(before)
      const started = Date.now()
      const result = await mutate(origin, method, options)
      const finished = Date.now()
      expect(result.status).toBe(method === 'POST' ? 201 : 200)
      expect(result.cache).toBeNull()
      expect(result.cookie).toBeNull()
      expect(result.vary).toBe(frameworkVary)
      const after = await snapshot()
      const owned = before.filter(
        (row) => row.tenantId === tenant && row.userId === owner
      )
      const id = options.id ?? context.addresses.alfa[1]!
      const target = owned.find((row) => row.id === id)
      const expected = before.map((row) => ({ ...row }))
      const stamp = (date: Date) => {
        expect(date.getTime()).toBeGreaterThanOrEqual(started)
        expect(date.getTime()).toBeLessThanOrEqual(finished)
      }
      const change = (id: string, fields: Partial<Address>) => {
        const actual = after.find((row) => row.id === id)!
        expect(actual).toBeDefined()
        const previous = expected.find((row) => row.id === id)!
        if (actual.updatedAt.getTime() !== previous.updatedAt.getTime())
          stamp(actual.updatedAt)
        Object.assign(previous, fields, { updatedAt: actual.updatedAt })
      }
      if (method === 'POST') {
        const created = after.filter(
          (row) => !before.some((old) => old.id === row.id)
        )
        expect(created).toHaveLength(1)
        const saved = created[0]!
        expect(saved.id).toMatch(/^c[a-z0-9]{24}$/)
        stamp(saved.createdAt)
        stamp(saved.updatedAt)
        const primary = owned.length === 0 || patch.isPrimary === true
        expect(saved).toEqual({
          id: saved.id,
          ...input,
          ...patch,
          tenantId: tenant,
          userId: owner,
          isPrimary: primary,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        })
        if (primary)
          for (const row of owned.filter((row) => row.isPrimary))
            change(row.id, { isPrimary: false })
        expected.push(saved)
        expect(result.body).toEqual({ address: json(saved) })
      } else if (method === 'PATCH') {
        expect(target).toBeDefined()
        if (patch.isPrimary === true)
          for (const row of owned.filter(
            (row) => row.isPrimary && row.id !== id
          ))
            change(row.id, { isPrimary: false })
        change(id, patch)
        const saved = after.find((row) => row.id === id)!
        expect(result.body).toEqual({ address: json(saved) })
      } else {
        expect(target).toBeDefined()
        expected.splice(
          expected.findIndex((row) => row.id === id),
          1
        )
        if (target!.isPrimary) {
          const next = owned
            .filter((row) => row.id !== id)
            .sort(
              (left, right) =>
                left.createdAt.getTime() - right.createdAt.getTime() ||
                left.id.localeCompare(right.id)
            )[0]
          if (next) change(next.id, { isPrimary: true })
        }
        expect(result.body).toEqual({
          message: 'Endereço removido com sucesso',
        })
      }
      expect(after).toEqual(
        expected.sort((left, right) => left.id.localeCompare(right.id))
      )
    }
  } finally {
    await restore(before)
  }
}

describe(`${context.identity.mode} — address mutation HTTP parity`, () => {
  describe.each(['POST', 'PATCH', 'DELETE'] as const)('%s', (method) => {
    it('refuses missing identity before parsing or writing', async () => {
      await refused(
        method,
        401,
        { error: 'Authentication required' },
        { jar: '', body: '{' }
      )
    })
    it('refuses forged identity', async () => {
      await refused(
        method,
        401,
        { error: 'Authentication required' },
        {
          jar: 'next-auth.session-token=forged; __Host-locadora.session_token=forged',
          body: '{',
        }
      )
    })
    it('requires explicit tenant selection', async () => {
      await refused(
        method,
        409,
        { error: 'Select an organization' },
        { headers: { 'x-tenant-id': '' }, body: '{' }
      )
    })
    it('global ADMIN cannot access a tenant without membership', async () => {
      await refused(
        method,
        403,
        { error: 'Organization access denied' },
        { jar: jars[1]!, body: '{' }
      )
    })
    it.each(['REVOKED', 'SUSPENDED'] as const)(
      'rechecks %s membership',
      async (status) => {
        const id = context.identity.memberships[0]!
        try {
          await prisma.membership.update({ where: { id }, data: { status } })
          await refused(
            method,
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
    it('rechecks organization suspension after sign in', async () => {
      try {
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'SUSPENDED' },
          })
        )
        await refused(method, 403, { error: 'Organization access denied' })
      } finally {
        await withTestPlatformTransaction(prisma, async (tx) =>
          tx.organization.update({
            where: { id: context.alfa.id },
            data: { status: 'ACTIVE' },
          })
        )
      }
    })
    it.each<Record<string, string>>([
      { Origin: 'https://bravo.platform.test' },
      { Origin: 'null' },
      { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'same-site' },
      { 'Sec-Fetch-Site': 'cross-site' },
    ])('central CSRF rejects %j even without session', async (headers) => {
      for (const jar of ['', jars[0]!]) {
        const result = await refused(
          method,
          403,
          { error: 'Origem não permitida' },
          { jar, headers: { ...edge, ...headers }, body: '{' }
        )
        expect(result.cache).toBe('no-store')
      }
    })
    it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
      'role %s preserves both ownership keys and primary effects',
      async (role) => {
        const id = context.identity.memberships[0]!
        try {
          await prisma.membership.update({ where: { id }, data: { role } })
          await success(
            method,
            {},
            method === 'PATCH' ? { city: 'Changed city' } : {}
          )
        } finally {
          await prisma.membership.update({
            where: { id },
            data: { role: 'CLIENT' },
          })
        }
      }
    )
    it.each(['native', 'app', 'tenant'] as const)(
      'accepts %s transport',
      async (kind) => {
        const headers =
          kind === 'native'
            ? a
            : kind === 'app'
              ? {
                  ...edge,
                  Origin: edge['x-platform-origin'],
                  'Sec-Fetch-Site': 'same-origin',
                }
              : {
                  ...tenantEdge(),
                  Origin: tenantEdge()['x-platform-origin'],
                  'Sec-Fetch-Site': 'same-origin',
                }
        await success(
          method,
          { headers },
          method === 'PATCH' ? { city: 'Changed city' } : {}
        )
      }
    )
    it.each(['header', 'cookie', 'host', 'matching'] as const)(
      'the same identity writes independently in Bravo using %s',
      async (kind) => {
        const jar =
          kind === 'cookie' || kind === 'matching'
            ? `${jars[0]}; selected-tenant-id=${context.bravo.id}`
            : jars[0]!
        const headers =
          kind === 'cookie'
            ? { 'x-tenant-id': '' }
            : kind === 'header'
              ? b
              : { ...tenantEdge(context.bravo.slug), ...b }
        await success(
          method,
          { jar, headers, id: context.addresses.bravo[0]! },
          method === 'PATCH' ? { city: 'Changed city' } : {},
          context.bravo.id
        )
      }
    )
    it('does not confuse another owner with global ADMIN in the same tenant', async () => {
      await success(
        method,
        { jar: jars[1]!, headers: b, id: context.addresses.otherBravo },
        method === 'PATCH' ? { city: 'Changed city' } : {},
        context.bravo.id,
        other
      )
    })
    it.each(['header-cookie', 'host-header', 'host-cookie'])(
      'refuses %s conflict before invalid payload',
      async (kind) => {
        const jar =
          kind === 'host-header'
            ? jars[0]!
            : `${jars[0]}; selected-tenant-id=${context.bravo.id}`
        const headers =
          kind === 'header-cookie'
            ? a
            : kind === 'host-header'
              ? { ...tenantEdge(), ...b }
              : { ...tenantEdge(), 'x-tenant-id': '' }
        await refused(
          method,
          400,
          { error: 'Conflicting tenant selection' },
          { jar, headers, body: '{' }
        )
      }
    )
    it('forged edge cannot select a tenant', async () => {
      await refused(
        method,
        409,
        { error: 'Select an organization' },
        {
          headers: {
            ...tenantEdge(),
            'x-platform-edge-auth': 'forged',
            'x-tenant-id': '',
          },
          body: '{',
        }
      )
    })
    it('suspended tenant host remains neutral', async () => {
      await refused(
        method,
        404,
        { error: 'Locadora não encontrada' },
        { headers: { ...tenantEdge(context.suspended), 'x-tenant-id': '' } }
      )
    })
    it('sanitizes a real missing write privilege and preserves all rows', async () => {
      const role = new URL(context.runtimeUrl).searchParams
        .get('options')!
        .slice('-c role='.length)
      expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
      const privilege =
        method === 'POST' ? 'INSERT' : method === 'PATCH' ? 'UPDATE' : 'DELETE'
      try {
        await alterSharedAcl(
          pool,
          `REVOKE ${privilege} ON addresses FROM ${role}`
        )
        await refused(method, 500, {
          error:
            method === 'POST'
              ? 'Erro ao criar endereço'
              : 'Não foi possível alterar o endereço',
        })
      } finally {
        await alterSharedAcl(pool, `GRANT ${privilege} ON addresses TO ${role}`)
      }
    })
  })
  describe.each(['POST', 'PATCH'] as const)('%s validation', (method) => {
    it.each([
      '{',
      '',
      'null',
      '[]',
      '"string"',
      JSON.stringify({ ...input, street: '' }),
      JSON.stringify({ ...input, state: 'ABC' }),
      JSON.stringify({ ...input, zipCode: 'invalid' }),
      JSON.stringify({ ...input, isPrimary: 'true' }),
    ])(
      'returns identical 400 details without DB effects for %s',
      async (body) => {
        const before = await snapshot()
        for (const origin of parityTargets(context)) {
          const result = await mutate(origin, method, { body })
          expect({ ...result, body: { ...result.body, details: [] } }).toEqual({
            status: 400,
            body: { error: 'Dados inválidos', details: [] },
            cache: null,
            vary: frameworkVary,
            cookie: null,
          })
          expect(result.body.details).toEqual(addressIssues(method, body))
        }
        expect(await snapshot()).toEqual(before)
      }
    )
    it('strips mass assignment and trims/normalizes the accepted payload', async () => {
      const body = JSON.stringify({
        ...input,
        street: ' Cut 23 street ',
        state: 'sp',
        userId: other,
        tenantId: context.bravo.id,
        id: context.addresses.bravo[0],
        isPrimary: true,
        user: { connect: { id: other } },
        createdAt: '2000-01-01',
      })
      await success(
        method,
        {
          body,
          query: `?userId=${other}&tenantId=${context.bravo.id}&role=ADMIN`,
        },
        { ...input, isPrimary: true }
      )
    })
  })
  it.each([undefined, false, true])(
    'first POST is primary even with isPrimary %s',
    async (isPrimary) => {
      const id = context.identity.memberships[3]!
      try {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
        await success(
          'POST',
          {
            headers: { 'x-tenant-id': context.unconfigured },
            body: JSON.stringify({ ...input, isPrimary }),
          },
          isPrimary === undefined ? {} : { isPrimary },
          context.unconfigured
        )
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'REVOKED' },
        })
      }
    }
  )
  it.each(['{}', '{"extra":"ignored"}'])(
    'preserves successful empty PATCH %s',
    async (body) => {
      await success('PATCH', { body }, {})
    }
  )
  it('explicitly clearing primary does not silently promote another address', async () => {
    await success(
      'PATCH',
      { id: context.addresses.alfa[0]!, body: '{"isPrimary":false}' },
      { isPrimary: false }
    )
  })
  it.each(['PATCH', 'DELETE'] as const)(
    '%s hides other tenants, users, quarantine and unknown/non-UUID ids',
    async (method) => {
      for (const id of [
        context.addresses.bravo[0]!,
        context.addresses.otherAlfa,
        context.addresses.unassigned,
        randomUUID(),
        'not-a-uuid',
      ])
        await refused(
          method,
          404,
          { error: 'Endereço não encontrado' },
          { id, body: '{}' }
        )
    }
  )
  it('deleting a primary promotes the oldest secondary', async () => {
    await success('DELETE', { id: context.addresses.alfa[0]! })
  })
  it('DELETE ignores an invalid JSON body and remains non-idempotent at HTTP', async () => {
    const before = await snapshot()
    try {
      for (const origin of parityTargets(context)) {
        await restore(before)
        expect((await mutate(origin, 'DELETE', { body: '{' })).status).toBe(200)
        const after = await snapshot()
        const repeated = await mutate(origin, 'DELETE', { body: '{' })
        expect(repeated.status).toBe(404)
        expect(repeated.body).toEqual({ error: 'Endereço não encontrado' })
        expect(await snapshot()).toEqual(after)
      }
    } finally {
      await restore(before)
    }
  })
  it('simultaneous requests across both hosts serialize primary selection for one owner/tenant', async () => {
    const before = await snapshot()
    try {
      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          mutate(rotatingTarget(context, index), 'POST', {
            body: JSON.stringify({
              ...input,
              number: String(index),
              isPrimary: true,
            }),
          })
        )
      )
      expect(responses.map((row) => row.status)).toEqual(Array(6).fill(201))
      const after = await snapshot()
      const created = after.filter(
        (row) => !before.some((old) => old.id === row.id)
      )
      expect(created).toHaveLength(6)
      // parity-scan: seis criações reais simultâneas (alternando os hosts no ar) geram seis endereços distintos.
      expect(new Set(created.map((row) => row.id)).size).toBe(6)
      const owned = after.filter(
        (row) => row.tenantId === context.alfa.id && row.userId === user
      )
      expect(owned.filter((row) => row.isPrimary)).toHaveLength(1)
      expect(owned).toHaveLength(9)
      expect(
        after.filter(
          (row) => row.tenantId !== context.alfa.id || row.userId !== user
        )
      ).toEqual(
        before.filter(
          (row) => row.tenantId !== context.alfa.id || row.userId !== user
        )
      )
      for (const result of responses)
        expect(result.body.address.tenantId).toBe(context.alfa.id)
    } finally {
      await restore(before)
    }
  })
  it('a failing write after demotion rolls the entire primary switch back', async () => {
    const name = `api_address_fail_${randomUUID().replaceAll('-', '').slice(0, 12)}`
    const marker = 'Rollback primary marker'
    try {
      await pool.query(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.street = '${marker}' THEN RAISE EXCEPTION 'private rollback fixture' USING ERRCODE='42501'; END IF; RETURN NEW; END $$`
      )
      await pool.query(
        `CREATE TRIGGER ${name} AFTER INSERT OR UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION ${name}()`
      )
      for (const method of ['POST', 'PATCH'] as const)
        await refused(
          method,
          500,
          {
            error:
              method === 'POST'
                ? 'Erro ao criar endereço'
                : 'Não foi possível alterar o endereço',
          },
          {
            body: JSON.stringify({ ...input, street: marker, isPrimary: true }),
          }
        )
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON addresses`)
      await pool.query(`DROP FUNCTION IF EXISTS ${name}()`)
    }
  })
  it('the partial unique index rejects a second primary independently of the service', async () => {
    const before = await snapshot()
    await expect(
      prisma.address.create({
        data: {
          ...input,
          tenantId: context.alfa.id,
          userId: user,
          isPrimary: true,
        },
      })
    ).rejects.toMatchObject({ code: 'P2002' })
    expect(await snapshot()).toEqual(before)
  })
  it('RLS blocks INSERT/UPDATE/DELETE outside the scoped tenant without application filters', async () => {
    const runtime = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await runtime.connect()
    const before = await snapshot()
    try {
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      const foreignIds = [
        context.addresses.bravo[0],
        context.addresses.unassigned,
      ]
      expect(
        (
          await connection.query(
            'UPDATE addresses SET city=$1 WHERE id=ANY($2::text[])',
            ['forbidden', foreignIds]
          )
        ).rowCount
      ).toBe(0)
      expect(
        (
          await connection.query(
            'DELETE FROM addresses WHERE id=ANY($1::text[])',
            [foreignIds]
          )
        ).rowCount
      ).toBe(0)
      await expect(
        connection.query('UPDATE addresses SET "tenantId"=$1 WHERE id=$2', [
          context.bravo.id,
          context.addresses.alfa[1],
        ])
      ).rejects.toMatchObject({ code: '42501' })
      await connection.query('ROLLBACK')
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id', $1, true)", [
        context.alfa.id,
      ])
      await expect(
        connection.query(
          'INSERT INTO addresses (id,"tenantId","userId",street,number,neighborhood,city,state,"zipCode","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())',
          [
            randomUUID(),
            context.bravo.id,
            user,
            input.street,
            input.number,
            input.neighborhood,
            input.city,
            input.state,
            input.zipCode,
          ]
        )
      ).rejects.toMatchObject({ code: '42501' })
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await runtime.end()
    }
    expect(await snapshot()).toEqual(before)
  })
  it('OPTIONS and unsupported verbs preserve route method parity', async () => {
    for (const path of [
      '/api/addresses',
      `/api/addresses/${context.addresses.alfa[0]}`,
    ]) {
      for (const origin of parityTargets(context)) {
        const response = await fetch(`${origin}${path}`, { method: 'OPTIONS' })
        expect({
          status: response.status,
          body: await response.text(),
          allow: response.headers.get('allow')?.split(/,\s*/).sort(),
        }).toEqual({
          status: 204,
          body: '',
          allow:
            path === '/api/addresses'
              ? ['GET', 'HEAD', 'OPTIONS', 'POST']
              : ['DELETE', 'OPTIONS', 'PATCH'],
        })
        expect(
          (await fetch(`${origin}${path}`, { method: 'PUT' })).status
        ).toBe(405)
      }
    }
  })
  it('revocation by the real auth engine prevents every mutation', async () => {
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: users[2] },
      select: { password: true },
    })
    try {
      if (context.identity.mode === 'better-auth') {
        await prisma.authSession.deleteMany({ where: { userId: users[2] } })
      } else {
        await prisma.user.update({
          where: { id: users[2] },
          data: { password: 'fixture-rotated-credential' },
        })
      }
      for (const method of ['POST', 'PATCH', 'DELETE'] as const)
        await refused(
          method,
          401,
          { error: 'Authentication required' },
          { jar: jars[2]! }
        )
    } finally {
      await prisma.user.update({
        where: { id: users[2] },
        data: { password: saved.password },
      })
    }
  })
})
