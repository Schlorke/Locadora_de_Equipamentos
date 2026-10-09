import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Prisma, PrismaClient, type NotificationType } from '@prisma/client'
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
const user = context.identity.users[0]!.id
const other = context.identity.users[1]!.id
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[58]!,
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
const types: NotificationType[] = [
  'QUOTE',
  'ORDER',
  'PAYMENT',
  'EQUIPMENT',
  'SYSTEM',
  'RENTAL',
  'DELIVERY',
  'CONTRACT',
]
const fixture = (
  tenantId: string | null,
  userId: string,
  type: NotificationType,
  isRead: boolean,
  index: number
) => ({
  id: randomUUID(),
  tenantId,
  userId,
  type,
  isRead,
  title: `Private notification ${index}`,
  message: `Private message ${index}`,
  priority: index % 2 ? ('MEDIUM' as const) : ('HIGH' as const),
  actionUrl: index === 4 ? null : `/area-cliente/historico?fixture=${index}`,
  metadata:
    index === 4
      ? null
      : {
          source: 'fixture-notification',
          amount: `${index}.25`,
          nested: { index },
        },
  createdAt: new Date(Date.UTC(2026, 0, 1, index)),
  readAt: isRead ? new Date('2026-01-10T00:00:00.000Z') : null,
})
const fixtures = [
  ...types.map((type, index) =>
    fixture(context.alfa.id, user, type, index === 1 || index === 4, index)
  ),
  fixture(context.alfa.id, user, 'QUOTE', true, 8),
  fixture(context.bravo.id, user, 'PAYMENT', false, 9),
  fixture(context.bravo.id, user, 'QUOTE', true, 10),
  fixture(context.alfa.id, other, 'CONTRACT', false, 11),
  fixture(context.bravo.id, other, 'SYSTEM', false, 12),
  fixture(context.alfa.id, context.identity.users[2]!.id, 'RENTAL', false, 13),
  fixture(null, user, 'SYSTEM', false, 14),
]
const ids = fixtures.map((row) => row.id)
beforeAll(async () => {
  await prisma.notification.createMany({
    data: fixtures.map((row) => ({
      ...row,
      metadata: row.metadata ?? Prisma.JsonNull,
    })),
  })
  for (let index = 0; index < context.identity.users.length; index++)
    jars.push(await signInParityUser(context, edge, index))
})
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
  await pool.end()
})

function expected(
  options: {
    tenant?: string
    owner?: string
    page?: number
    limit?: number
    type?: NotificationType
    isRead?: boolean
  } = {}
) {
  const {
    tenant = context.alfa.id,
    owner = user,
    page = 1,
    limit = 20,
    type,
    isRead,
  } = options
  const owned = fixtures.filter(
    (row) => row.tenantId === tenant && row.userId === owner
  )
  const filtered = owned.filter(
    (row) =>
      (!type || row.type === type) &&
      (isRead === undefined || row.isRead === isRead)
  )
  const unread = owned.filter((row) => !row.isRead)
  const byType: Record<string, number> = {}
  for (const row of unread)
    byType[row.type.toLowerCase()] = (byType[row.type.toLowerCase()] ?? 0) + 1
  return JSON.parse(
    JSON.stringify({
      notifications: [...filtered]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      stats: { total: filtered.length, unread: unread.length, byType },
    })
  )
}
async function read(
  origin: string,
  jar = '',
  headers: Record<string, string> = {},
  query = '',
  method = 'GET',
  path = '/api/client/notifications'
) {
  const response = await fetch(`${origin}${path}${query}`, {
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
/** Cabeçalhos esperados de uma leitura da caixa, pela camada que responde (onda 135, B2). */
function readHeaders(_status: number, body: unknown) {
  const error = (body as { error?: string } | null)?.error
  return {
    cache:
      error === 'Locadora não encontrada' || error === 'Origem não permitida'
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
  query = '',
  path = '/api/client/notifications'
) {
  let last: Awaited<ReturnType<typeof read>> | undefined
  for (const origin of parityTargets(context)) {
    const result = await read(origin, jar, headers, query, 'GET', path)
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
const statsPath = '/api/client/notifications/stats'
const parityStats = (
  jar: string,
  headers: Record<string, string>,
  status: number,
  body: unknown,
  query = ''
) => parity(jar, headers, status, body, query, statsPath)
function expectedStats(tenant = context.alfa.id, owner = user) {
  const own = fixtures.filter(
    (row) => row.tenantId === tenant && row.userId === owner
  )
  const byType: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const unread = own.filter((row) => !row.isRead)
  for (const row of unread) {
    const type = row.type.toLowerCase()
    const priority = row.priority.toLowerCase()
    byType[type] = (byType[type] ?? 0) + 1
    byPriority[priority] = (byPriority[priority] ?? 0) + 1
  }
  return { total: own.length, unread: unread.length, byType, byPriority }
}
/** Issue completo do Zod para um parâmetro de consulta inválido (o mesmo contrato nos dois hosts). */
function validationIssue(field: string, code: string) {
  const path = [field]
  if (code === 'too_small')
    return {
      origin: 'number',
      code,
      minimum: 1,
      inclusive: true,
      path,
      message: 'Too small: expected number to be >=1',
    }
  if (code === 'too_big')
    return {
      origin: 'number',
      code,
      maximum: 100,
      inclusive: true,
      path,
      message: 'Too big: expected number to be <=100',
    }
  if (code === 'invalid_type')
    return {
      expected: 'number',
      code,
      received: 'NaN',
      path,
      message: 'Invalid input: expected number, received NaN',
    }
  if (code === 'invalid_value' && field === 'type')
    return {
      code,
      values: [
        'QUOTE',
        'ORDER',
        'PAYMENT',
        'EQUIPMENT',
        'SYSTEM',
        'RENTAL',
        'DELIVERY',
        'CONTRACT',
      ],
      path,
      message:
        'Invalid option: expected one of "QUOTE"|"ORDER"|"PAYMENT"|"EQUIPMENT"|"SYSTEM"|"RENTAL"|"DELIVERY"|"CONTRACT"',
    }
  if (code === 'invalid_value' && field === 'isRead')
    return {
      code,
      values: ['true', 'false'],
      path,
      message: 'Invalid option: expected one of "true"|"false"',
    }
  throw new Error('Unknown invalid notification-query fixture')
}
type MutationMethod = 'PATCH' | 'DELETE' | 'POST'
const inboxSnapshot = () =>
  prisma.notification.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
  })
async function restoreNotifications(rows = fixtures) {
  for (const row of rows) {
    const data = { ...row, metadata: row.metadata ?? Prisma.JsonNull }
    await prisma.notification.upsert({
      where: { id: row.id },
      create: data,
      update: data,
    })
  }
}
async function mutation(
  origin: string,
  method: MutationMethod,
  jar = jars[0]!,
  headers: Record<string, string> = a,
  id: string = fixtures[0]!.id,
  query = '',
  body?: string
) {
  const path = method === 'POST' ? 'mark-all-read' : id
  const response = await fetch(
    `${origin}/api/client/notifications/${path}${query}`,
    { method, headers: { Cookie: jar, ...headers }, body }
  )
  return {
    status: response.status,
    body: await response.json(),
    cache: response.headers.get('cache-control'),
    cookie: response.headers.get('set-cookie'),
  }
}
async function refusedMutation(
  method: MutationMethod,
  status: number,
  body: unknown,
  jar = jars[0]!,
  headers: Record<string, string> = a,
  id: string = fixtures[0]!.id
) {
  const before = await inboxSnapshot()
  let last: Awaited<ReturnType<typeof mutation>> | undefined
  // Cada host da rodada contra a recusa explícita esperada (onda 135, B2).
  for (const origin of parityTargets(context)) {
    const result = await mutation(origin, method, jar, headers, id)
    expect(result).toEqual({
      status,
      body,
      cache: readHeaders(status, body).cache,
      cookie: null,
    })
    expect(await inboxSnapshot()).toEqual(before)
    last = result
  }
  return last!
}
async function changedMutation(
  method: MutationMethod,
  options: {
    jar?: string
    headers?: Record<string, string>
    row?: (typeof fixtures)[number]
    tenant?: string
    owner?: string
    query?: string
    body?: string
  } = {}
) {
  const {
    jar = jars[0]!,
    headers = a,
    row = fixtures[0]!,
    tenant = context.alfa.id,
    owner = user,
    query = '',
    body,
  } = options
  const affected =
    method === 'POST'
      ? fixtures.filter(
          (item) => item.tenantId === tenant && item.userId === owner
        )
      : [row]
  for (const origin of parityTargets(context)) {
    const before = await inboxSnapshot()
    const start = Date.now()
    try {
      const result = await mutation(
        origin,
        method,
        jar,
        headers,
        row.id,
        query,
        body
      )
      const end = Date.now()
      expect(result.status).toBe(200)
      expect(result.cache).toBeNull()
      expect(result.cookie).toBeNull()
      const after = await inboxSnapshot()
      if (method === 'PATCH') {
        const readAt = new Date(result.body.notification.readAt)
        expect(readAt.getTime()).toBeGreaterThanOrEqual(start)
        expect(readAt.getTime()).toBeLessThanOrEqual(end)
        expect(result.body).toEqual({
          success: true,
          notification: JSON.parse(
            JSON.stringify({ ...row, isRead: true, readAt })
          ),
        })
        expect(after).toEqual(
          before.map((item) =>
            item.id === row.id ? { ...item, isRead: true, readAt } : item
          )
        )
      } else if (method === 'DELETE') {
        expect(result.body).toEqual({
          success: true,
          message: 'Notificação removida com sucesso',
        })
        expect(after).toEqual(before.filter((item) => item.id !== row.id))
        const repeated = await mutation(origin, method, jar, headers, row.id)
        expect(repeated.status).toBe(404)
        expect(repeated.body).toEqual({ error: 'Notificação não encontrada' })
      } else {
        const unread = before.filter(
          (item) =>
            item.tenantId === tenant && item.userId === owner && !item.isRead
        )
        expect(result.body).toEqual({
          success: true,
          updated: unread.length,
          message: `${unread.length} notificação(ões) marcada(s) como lida(s)`,
        })
        const changedIds = new Set(unread.map((item) => item.id))
        const timestamps = after
          .filter((item) => changedIds.has(item.id))
          .map((item) => item.readAt!.getTime())
        // parity-scan: uma única marcação real grava o mesmo instante em todas as notificações afetadas.
        expect(new Set(timestamps).size).toBe(unread.length ? 1 : 0)
        for (const time of timestamps) {
          expect(time).toBeGreaterThanOrEqual(start)
          expect(time).toBeLessThanOrEqual(end)
        }
        expect(after).toEqual(
          before.map((item) =>
            changedIds.has(item.id)
              ? { ...item, isRead: true, readAt: new Date(timestamps[0]!) }
              : item
          )
        )
        const repeated = await mutation(origin, method, jar, headers, row.id)
        expect(repeated.body).toEqual({
          success: true,
          updated: 0,
          message: '0 notificação(ões) marcada(s) como lida(s)',
        })
        expect(await inboxSnapshot()).toEqual(after)
      }
    } finally {
      await restoreNotifications(affected)
    }
  }
}
describe(`${context.identity.mode} — recipient inbox parity`, () => {
  it.each([
    '',
    'next-auth.session-token=forged',
    '__Host-locadora.session_token=forged',
  ])('requires a real live session before invalid query: %s', async (jar) => {
    await parity(
      jar,
      a,
      401,
      { error: 'Authentication required' },
      '?page=invalid'
    )
    await parityStats(
      jar,
      a,
      401,
      { error: 'Authentication required' },
      '?type=invalid'
    )
  })
  it('never selects a tenant or owner from query parameters', async () => {
    await parity(
      jars[0]!,
      {},
      409,
      { error: 'Select an organization' },
      `?tenantId=${context.alfa.id}&userId=${other}&page=invalid`
    )
    await parityStats(
      jars[0]!,
      {},
      409,
      { error: 'Select an organization' },
      `?tenantId=${context.alfa.id}&userId=${other}`
    )
  })
  it('never grants inbox access from an existing notification or global ADMIN', async () => {
    await parity(jars[2]!, a, 403, { error: 'Organization access denied' })
    await parity(
      jars[1]!,
      a,
      403,
      { error: 'Organization access denied' },
      '?page=invalid'
    )
    await parityStats(jars[2]!, a, 403, { error: 'Organization access denied' })
    await parityStats(jars[1]!, a, 403, { error: 'Organization access denied' })
  })
  it('keeps full DTO, order, nullable metadata and unread counts without marking anything read', async () => {
    const result = await parity(jars[0]!, a, 200, expected())
    expect(JSON.parse(result.body).stats).toEqual({
      total: 9,
      unread: 6,
      byType: {
        quote: 1,
        payment: 1,
        equipment: 1,
        rental: 1,
        delivery: 1,
        contract: 1,
      },
    })
    expect(
      JSON.parse(result.body).notifications.map((row: { id: string }) => row.id)
    ).toEqual(ids.slice(0, 9).reverse())
    expect(result.cache).toBeNull()
    expect(
      (
        await prisma.notification.findMany({ where: { id: { in: ids } } })
      ).filter((row) => !row.isRead)
    ).toHaveLength(fixtures.filter((row) => !row.isRead).length)
  })
  it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
    'keeps the own inbox for live membership role %s',
    async (role) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { role } })
        await parity(jars[0]!, a, 200, expected())
        await parityStats(jars[0]!, a, 200, expectedStats())
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { role: 'CLIENT' },
        })
      }
    }
  )
  it.each(['header', 'cookie', 'host', 'matching'] as const)(
    'selects the other own inbox via %s',
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
      await parity(jar, headers, 200, expected({ tenant: context.bravo.id }))
      await parityStats(jar, headers, 200, expectedStats(context.bravo.id))
    }
  )
  it('keeps another recipient separate even with owner/projection overrides', async () => {
    await parity(
      jars[1]!,
      b,
      200,
      expected({ tenant: context.bravo.id, owner: other }),
      `?userId=${user}&tenantId=${context.alfa.id}&fields=password&role=ADMIN`
    )
    await parity(
      jars[0]!,
      a,
      200,
      expected(),
      `?userId=${other}&tenantId=${context.bravo.id}&role=ADMIN&sort=asc&fields=id`
    )
    await parityStats(
      jars[1]!,
      b,
      200,
      expectedStats(context.bravo.id, other),
      `?userId=${user}&tenantId=${context.alfa.id}&role=ADMIN`
    )
    await parityStats(
      jars[0]!,
      a,
      200,
      expectedStats(),
      `?userId=${other}&tenantId=${context.bravo.id}&role=ADMIN`
    )
  })
  it.each(types)(
    'filters %s without restricting unread stats to that type',
    async (type) => {
      await parity(jars[0]!, a, 200, expected({ type }), `?type=${type}`)
    }
  )
  it.each([
    ['?isRead=true', true, undefined],
    ['?isRead=false', false, undefined],
    ['?type=QUOTE&isRead=true', true, 'QUOTE'],
    ['?type=QUOTE&isRead=false', false, 'QUOTE'],
  ] as const)(
    'keeps read filters and independent statistics for %s',
    async (query, isRead, type) => {
      await parity(jars[0]!, a, 200, expected({ isRead, type }), query)
    }
  )
  it.each([
    ['', 1, 20],
    ['?page=&limit=&type=&isRead=', 1, 20],
    ['?page=2&limit=3', 2, 3],
    ['?page=99&limit=3', 99, 3],
    ['?limit=100', 1, 100],
    ['?page=2abc&limit=3suffix', 2, 3],
    ['?page=2.9&limit=3.5', 2, 3],
    ['?page=1e2&limit=1e2', 1, 1],
    ['?page=%20%2B3%20&limit=%2002%20', 3, 2],
    ['?page=2&page=8&limit=3&limit=9', 2, 3],
    ['?type=&type=QUOTE&isRead=&isRead=true', 1, 20],
  ] as const)(
    'preserves parsing, pagination and first query values: %s',
    async (query, page, limit) => {
      await parity(jars[0]!, a, 200, expected({ page, limit }), query)
    }
  )
  it.each([
    ['?page=0', 'page', 'too_small'],
    ['?page=-1', 'page', 'too_small'],
    ['?page=0x10', 'page', 'too_small'],
    ['?page=abc', 'page', 'invalid_type'],
    ['?page=%20', 'page', 'invalid_type'],
    ['?page=Infinity', 'page', 'invalid_type'],
    ['?limit=0', 'limit', 'too_small'],
    ['?limit=101', 'limit', 'too_big'],
    ['?limit=abc', 'limit', 'invalid_type'],
    ['?type=quote', 'type', 'invalid_value'],
    ['?type=UNKNOWN', 'type', 'invalid_value'],
    ['?type=%20QUOTE', 'type', 'invalid_value'],
    ['?isRead=True', 'isRead', 'invalid_value'],
    ['?isRead=1', 'isRead', 'invalid_value'],
    ['?isRead=false%20', 'isRead', 'invalid_value'],
  ] as const)(
    'keeps exact validation details for %s',
    async (query, field, code) => {
      await parity(
        jars[0]!,
        a,
        400,
        {
          error: 'Parâmetros inválidos',
          details: [validationIssue(field, code)],
        },
        query
      )
    }
  )
  it('returns an empty selected tenant without notifications or implicit creation', async () => {
    const id = context.identity.memberships[3]!
    try {
      await prisma.membership.update({
        where: { id },
        data: { status: 'ACTIVE' },
      })
      await parity(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        200,
        expected({ tenant: context.unconfigured })
      )
      await parityStats(
        jars[0]!,
        { 'x-tenant-id': context.unconfigured },
        200,
        { total: 0, unread: 0, byType: {}, byPriority: {} }
      )
      expect(
        await prisma.notification.count({
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
  it.each(['header-cookie', 'host-header', 'host-cookie'] as const)(
    'refuses selection conflict %s before validation',
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
      await parity(
        jar,
        headers,
        400,
        { error: 'Conflicting tenant selection' },
        '?page=invalid'
      )
      await parityStats(jar, headers, 400, {
        error: 'Conflicting tenant selection',
      })
    }
  )
  it.each(['REVOKED', 'SUSPENDED'] as const)(
    'revalidates a %s membership after login',
    async (status) => {
      const id = context.identity.memberships[0]!
      try {
        await prisma.membership.update({ where: { id }, data: { status } })
        await parity(jars[0]!, a, 403, { error: 'Organization access denied' })
        await parityStats(jars[0]!, a, 403, {
          error: 'Organization access denied',
        })
      } finally {
        await prisma.membership.update({
          where: { id },
          data: { status: 'ACTIVE' },
        })
      }
    }
  )
  it('revalidates organization suspension', async () => {
    try {
      await withTestPlatformTransaction(prisma, async (tx) =>
        tx.organization.update({
          where: { id: context.alfa.id },
          data: { status: 'SUSPENDED' },
        })
      )
      await parity(jars[0]!, a, 403, { error: 'Organization access denied' })
      await parityStats(jars[0]!, a, 403, {
        error: 'Organization access denied',
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
  it.each(['unknown-locadora', context.suspended])(
    'keeps the neutral host %s 404 before identity',
    async (slug) => {
      await parity(
        '',
        tenantEdge(slug),
        404,
        { error: 'Locadora não encontrada' },
        '?page=invalid'
      )
      await parityStats('', tenantEdge(slug), 404, {
        error: 'Locadora não encontrada',
      })
    }
  )
  it('sanitizes a real notification SELECT failure while invalid queries still have their original precedence', async () => {
    const role = new URL(context.runtimeUrl).searchParams
      .get('options')!
      .slice('-c role='.length)
    expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
    try {
      await alterSharedAcl(pool, `REVOKE SELECT ON notifications FROM ${role}`)
      await parity(jars[0]!, a, 500, { error: 'Erro interno do servidor' })
      await parityStats(
        jars[0]!,
        a,
        500,
        { error: 'Erro interno do servidor' },
        '?page=invalid'
      )
      await parity(
        '',
        a,
        401,
        { error: 'Authentication required' },
        '?page=invalid'
      )
      await parity(
        jars[0]!,
        a,
        400,
        {
          error: 'Parâmetros inválidos',
          details: [validationIssue('page', 'invalid_type')],
        },
        '?page=invalid'
      )
      await parityStats('', a, 401, { error: 'Authentication required' })
    } finally {
      await alterSharedAcl(pool, `GRANT SELECT ON notifications TO ${role}`)
    }
  })
  it('proves SQL RLS excludes another tenant and unassigned rows without runtime ownership/bypass', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    try {
      const flags = (
        await connection.query(
          "SELECT r.rolsuper, r.rolbypassrls, c.relrowsecurity, c.relforcerowsecurity, pg_has_role(current_user,c.relowner,'MEMBER') AS owns FROM pg_roles r JOIN pg_class c ON c.relname='notifications' WHERE r.rolname=current_user"
        )
      ).rows[0]
      expect(flags).toEqual({
        rolsuper: false,
        rolbypassrls: false,
        relrowsecurity: true,
        relforcerowsecurity: true,
        owns: false,
      })
      await connection.query('BEGIN')
      expect(
        (await connection.query('SELECT id FROM notifications')).rows
      ).toEqual([])
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      const got = (await connection.query('SELECT id FROM notifications')).rows
        .map((row) => row.id)
        .sort()
      expect(got).toEqual(
        fixtures
          .filter((row) => row.tenantId === context.alfa.id)
          .map((row) => row.id)
          .sort()
      )
      expect(
        (
          await connection.query(
            'SELECT id FROM notifications WHERE "tenantId"=$1',
            [context.bravo.id]
          )
        ).rows
      ).toEqual([])
      await connection.query('ROLLBACK')
      expect(
        (await connection.query('SELECT id FROM notifications')).rows
      ).toEqual([])
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await scoped.end()
    }
  })
  it('keeps HEAD and OPTIONS, refuses service writes and leaves legacy mutations installed', async () => {
    for (const origin of parityTargets(context)) {
      expect(await read(origin, jars[0]!, a, '?limit=3', 'HEAD')).toEqual({
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
      ])
    }
    for (const origin of parityTargets(context)) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        expect((await read(origin, jars[0]!, a, '', method)).status).toBe(405)
      // As mutações por ID continuam instaladas em cada host da rodada.
      const mutations = await fetch(
        `${origin}/api/client/notifications/${ids[0]}`,
        { method: 'OPTIONS' }
      )
      expect(mutations.headers.get('allow')?.split(/,\s*/).sort()).toEqual([
        'DELETE',
        'OPTIONS',
        'PATCH',
      ])
    }
  })
  describe('complete recipient statistics', () => {
    it('keeps exact whole-inbox counts and priority buckets without writes', async () => {
      const before = await prisma.notification.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
      })
      const result = await parityStats(jars[0]!, a, 200, expectedStats())
      expect(JSON.parse(result.body)).toEqual({
        total: 9,
        unread: 6,
        byType: {
          quote: 1,
          payment: 1,
          equipment: 1,
          rental: 1,
          delivery: 1,
          contract: 1,
        },
        byPriority: { high: 3, medium: 3 },
      })
      expect(result.cache).toBeNull()
      expect(
        await prisma.notification.findMany({
          where: { id: { in: ids } },
          orderBy: { id: 'asc' },
        })
      ).toEqual(before)
    })
    it.each([
      '?page=invalid&limit=-1',
      '?type=QUOTE&isRead=true&priority=LOW',
      '?type=unknown&type=QUOTE&isRead=unknown',
      '?userId=foreign&tenantId=foreign&fields=password',
      '?page=2&limit=1&isRead=false',
    ])(
      'ignores every list filter, malformed value and ownership override: %s',
      async (query) => {
        await parityStats(jars[0]!, a, 200, expectedStats(), query)
      }
    )
    it('includes all eight unread types in lowercase', async () => {
      const changed = [fixtures[1]!, fixtures[4]!]
      try {
        await prisma.notification.updateMany({
          where: { id: { in: changed.map((row) => row.id) } },
          data: { isRead: false, readAt: null },
        })
        await parityStats(jars[0]!, a, 200, {
          total: 9,
          unread: 8,
          byType: {
            quote: 1,
            order: 1,
            payment: 1,
            equipment: 1,
            system: 1,
            rental: 1,
            delivery: 1,
            contract: 1,
          },
          byPriority: { high: 4, medium: 4 },
        })
      } finally {
        for (const row of changed)
          await prisma.notification.update({
            where: { id: row.id },
            data: { isRead: row.isRead, readAt: row.readAt },
          })
      }
    })
    it('aggregates LOW along with HIGH and MEDIUM without counting read rows', async () => {
      const row = fixtures[0]!
      try {
        await prisma.notification.update({
          where: { id: row.id },
          data: { priority: 'LOW' },
        })
        await parityStats(jars[0]!, a, 200, {
          ...expectedStats(),
          byPriority: { high: 2, medium: 3, low: 1 },
        })
      } finally {
        await prisma.notification.update({
          where: { id: row.id },
          data: { priority: row.priority },
        })
      }
    })
    it('observes a newly read notification without changing the total or other recipients', async () => {
      const row = fixtures[0]!
      try {
        await prisma.notification.update({
          where: { id: row.id },
          data: { isRead: true, readAt: new Date('2026-01-11T00:00:00Z') },
        })
        await parityStats(jars[0]!, a, 200, {
          total: 9,
          unread: 5,
          byType: {
            payment: 1,
            equipment: 1,
            rental: 1,
            delivery: 1,
            contract: 1,
          },
          byPriority: { high: 2, medium: 3 },
        })
        await parityStats(jars[0]!, b, 200, expectedStats(context.bravo.id))
        await parityStats(
          jars[1]!,
          b,
          200,
          expectedStats(context.bravo.id, other)
        )
      } finally {
        await prisma.notification.update({
          where: { id: row.id },
          data: { isRead: row.isRead, readAt: row.readAt },
        })
      }
    })
    it('returns empty bucket maps but retains total when all own notifications are read', async () => {
      const own = fixtures.filter(
        (row) => row.tenantId === context.alfa.id && row.userId === user
      )
      try {
        await prisma.notification.updateMany({
          where: { id: { in: own.map((row) => row.id) } },
          data: { isRead: true, readAt: new Date('2026-01-11T00:00:00Z') },
        })
        await parityStats(jars[0]!, a, 200, {
          total: 9,
          unread: 0,
          byType: {},
          byPriority: {},
        })
      } finally {
        for (const row of own)
          await prisma.notification.update({
            where: { id: row.id },
            data: { isRead: row.isRead, readAt: row.readAt },
          })
      }
    })
    it('preserves HEAD/OPTIONS and does not mount mutations at stats', async () => {
      for (const origin of parityTargets(context)) {
        expect(await read(origin, jars[0]!, a, '', 'HEAD', statsPath)).toEqual({
          status: 200,
          body: '',
          ...readHeaders(200, {}),
          cookie: null,
          allow: null,
        })
        const options = await read(origin, '', {}, '', 'OPTIONS', statsPath)
        expect(options.status).toBe(204)
        expect(options.allow?.split(/,\s*/).sort()).toEqual([
          'GET',
          'HEAD',
          'OPTIONS',
        ])
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
          expect(
            (await read(origin, jars[0]!, a, '', method, statsPath)).status
          ).toBe(405)
      }
    })
  })
  describe.each(['PATCH', 'DELETE', 'POST'] as const)(
    '%s recipient notification mutation',
    (method) => {
      it.each([
        '',
        'next-auth.session-token=forged',
        '__Host-locadora.session_token=forged',
      ])('requires a real session: %s', async (jar) => {
        await refusedMutation(
          method,
          401,
          { error: 'Authentication required' },
          jar
        )
      })
      it('requires explicit tenant selection', async () => {
        await refusedMutation(
          method,
          409,
          { error: 'Select an organization' },
          jars[0]!,
          {}
        )
      })
      it.each([1, 2])(
        'does not grant access from global role or existing notification: user %i',
        async (index) => {
          await refusedMutation(
            method,
            403,
            { error: 'Organization access denied' },
            jars[index]!
          )
        }
      )
      it.each<Record<string, string>>([
        {
          Origin: 'https://bravo.platform.test',
          'Sec-Fetch-Site': 'same-site',
        },
        { Origin: 'null' },
        { Origin: 'https://app.platform.test', 'Sec-Fetch-Site': 'cross-site' },
        { 'Sec-Fetch-Site': 'same-site' },
      ])(
        'rejects cross-origin browser transport before identity and effects: %j',
        async (headers) => {
          const result = await refusedMutation(
            method,
            403,
            { error: 'Origem não permitida' },
            '',
            { ...edge, ...a, ...headers }
          )
          expect(result.cache).toBe('no-store')
          await refusedMutation(
            method,
            403,
            { error: 'Origem não permitida' },
            jars[0]!,
            { ...edge, ...a, ...headers }
          )
        }
      )
      it.each(['native', 'same-origin', 'none'])(
        'preserves real effects for accepted %s transport',
        async (transport) => {
          const headers =
            transport === 'native'
              ? a
              : {
                  ...edge,
                  ...a,
                  Origin: 'https://app.platform.test',
                  'Sec-Fetch-Site': transport,
                }
          await changedMutation(method, { headers })
        }
      )
      it.each(['CLIENT', 'ADMIN', 'FINANCIAL', 'OPERATOR'] as const)(
        'only changes the own inbox for live membership role %s',
        async (role) => {
          const id = context.identity.memberships[0]!
          try {
            await prisma.membership.update({ where: { id }, data: { role } })
            await changedMutation(method)
          } finally {
            await prisma.membership.update({
              where: { id },
              data: { role: 'CLIENT' },
            })
          }
        }
      )
      it.each(['header', 'cookie', 'host', 'matching'])(
        'selects the other own inbox via %s',
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
          await changedMutation(method, {
            jar,
            headers,
            row: fixtures[9]!,
            tenant: context.bravo.id,
          })
        }
      )
      it('keeps another recipient separate even for a global ADMIN', async () => {
        await changedMutation(method, {
          jar: jars[1]!,
          headers: b,
          row: fixtures[12]!,
          tenant: context.bravo.id,
          owner: other,
        })
      })
      it.each(['REVOKED', 'SUSPENDED'] as const)(
        'revalidates %s membership before writes',
        async (status) => {
          const id = context.identity.memberships[0]!
          try {
            await prisma.membership.update({ where: { id }, data: { status } })
            await refusedMutation(method, 403, {
              error: 'Organization access denied',
            })
          } finally {
            await prisma.membership.update({
              where: { id },
              data: { status: 'ACTIVE' },
            })
          }
        }
      )
      it('revalidates organization suspension before writes', async () => {
        try {
          await withTestPlatformTransaction(prisma, async (tx) =>
            tx.organization.update({
              where: { id: context.alfa.id },
              data: { status: 'SUSPENDED' },
            })
          )
          await refusedMutation(method, 403, {
            error: 'Organization access denied',
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
      it.each(['unknown-locadora', context.suspended])(
        'keeps neutral host 404 for %s',
        async (slug) => {
          await refusedMutation(
            method,
            404,
            { error: 'Locadora não encontrada' },
            '',
            tenantEdge(slug)
          )
        }
      )
      it.each(['header-cookie', 'host-header', 'host-cookie'])(
        'refuses conflicting tenant selection: %s',
        async (transport) => {
          const headers =
            transport === 'header-cookie'
              ? b
              : transport === 'host-header'
                ? { ...tenantEdge(context.bravo.slug), ...a }
                : tenantEdge(context.bravo.slug)
          const jar =
            transport === 'host-header'
              ? jars[0]!
              : `${jars[0]}; selected-tenant-id=${context.alfa.id}`
          await refusedMutation(
            method,
            400,
            { error: 'Conflicting tenant selection' },
            jar,
            headers
          )
        }
      )
      it.each([
        'invalid-json',
        '{"userId":"foreign","tenantId":"foreign","isRead":false}',
        '',
      ])(
        'ignores body and query overrides without changing the scope: %s',
        async (body) => {
          await changedMutation(method, {
            headers: { ...a, 'Content-Type': 'application/json' },
            body,
            query:
              '?userId=foreign&tenantId=foreign&id=foreign&type=SYSTEM&isRead=true',
          })
        }
      )
      it('sanitizes a real denied write privilege and leaves every notification unchanged', async () => {
        const role = new URL(context.runtimeUrl).searchParams
          .get('options')!
          .slice('-c role='.length)
        expect(role).toMatch(/^api_parity_[a-f0-9]{12}$/)
        const privilege = method === 'DELETE' ? 'DELETE' : 'UPDATE'
        try {
          await alterSharedAcl(
            pool,
            `REVOKE ${privilege} ON notifications FROM ${role}`
          )
          await refusedMutation(method, 500, {
            error: 'Erro interno do servidor',
          })
          await refusedMutation(
            method,
            401,
            { error: 'Authentication required' },
            ''
          )
          await refusedMutation(
            method,
            403,
            { error: 'Origem não permitida' },
            '',
            { ...edge, ...a, Origin: 'https://foreign.platform.test' }
          )
        } finally {
          await alterSharedAcl(
            pool,
            `GRANT ${privilege} ON notifications TO ${role}`
          )
        }
      })
      it('rolls back a SQL failure raised after the write inside the transaction', async () => {
        const name = `api_notify_fail_${randomUUID().replaceAll('-', '').slice(0, 12)}`
        const event = method === 'DELETE' ? 'DELETE' : 'UPDATE'
        const tuple = method === 'DELETE' ? 'OLD' : 'NEW'
        try {
          await pool.query(
            `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-sql-failure' USING ERRCODE='42501'; RETURN NULL; END $$`
          )
          await pool.query(
            `CREATE TRIGGER ${name} AFTER ${event} ON notifications FOR EACH ROW WHEN (${tuple}.id = '${fixtures[0]!.id}') EXECUTE FUNCTION ${name}()`
          )
          await refusedMutation(method, 500, {
            error: 'Erro interno do servidor',
          })
        } finally {
          await pool.query(`DROP TRIGGER IF EXISTS ${name} ON notifications`)
          await pool.query(`DROP FUNCTION IF EXISTS ${name}()`)
        }
      })
      if (method !== 'POST') {
        it.each([
          { label: 'foreign-tenant', id: fixtures[9]!.id },
          { label: 'other-recipient', id: fixtures[11]!.id },
          { label: 'unassigned-tenant', id: fixtures[14]!.id },
          { label: 'non-uuid', id: 'non-uuid-id' },
          { label: 'unknown', id: randomUUID() },
        ])(
          'returns the same 404 for $label notification without writes',
          async ({ id }) => {
            await refusedMutation(
              method,
              404,
              { error: 'Notificação não encontrada' },
              jars[0]!,
              a,
              id
            )
          }
        )
      } else {
        it('returns zero without creating notifications in an empty selected tenant', async () => {
          const id = context.identity.memberships[3]!
          try {
            await prisma.membership.update({
              where: { id },
              data: { status: 'ACTIVE' },
            })
            await changedMutation(method, {
              headers: { 'x-tenant-id': context.unconfigured },
              tenant: context.unconfigured,
            })
          } finally {
            await prisma.membership.update({
              where: { id },
              data: { status: 'REVOKED' },
            })
          }
        })
      }
    }
  )
  it('refreshes an already-read notification timestamp on repeated PATCH without other effects', async () => {
    const row = fixtures[8]!
    for (const origin of parityTargets(context)) {
      const before = await inboxSnapshot()
      try {
        const start = Date.now()
        const first = await mutation(origin, 'PATCH', jars[0]!, a, row.id)
        const second = await mutation(origin, 'PATCH', jars[0]!, a, row.id)
        expect(first.status).toBe(200)
        expect(second.status).toBe(200)
        const time = new Date(second.body.notification.readAt)
        expect(time.getTime()).toBeGreaterThanOrEqual(start)
        expect(time.getTime()).toBeGreaterThanOrEqual(
          new Date(first.body.notification.readAt).getTime()
        )
        expect(time.getTime()).toBeLessThanOrEqual(Date.now())
        expect(second.body).toEqual({
          success: true,
          notification: JSON.parse(
            JSON.stringify({ ...row, isRead: true, readAt: time })
          ),
        })
        expect(await inboxSnapshot()).toEqual(
          before.map((item) =>
            item.id === row.id ? { ...item, readAt: time } : item
          )
        )
      } finally {
        await restoreNotifications([row])
      }
    }
  })
  it('keeps method routing and explicit mutation-only OPTIONS in both hosts', async () => {
    for (const origin of parityTargets(context)) {
      for (const [path, allow] of [
        [fixtures[0]!.id, ['DELETE', 'OPTIONS', 'PATCH']],
        ['mark-all-read', ['OPTIONS', 'POST']],
      ] as const) {
        const response = await fetch(
          `${origin}/api/client/notifications/${path}`,
          { method: 'OPTIONS' }
        )
        expect(response.status).toBe(204)
        expect(response.headers.get('allow')?.split(/,\s*/).sort()).toEqual(
          allow
        )
        for (const method of ['GET', 'HEAD', 'PUT'])
          expect(
            (
              await fetch(`${origin}/api/client/notifications/${path}`, {
                method,
                headers: { Cookie: jars[0]!, ...a },
              })
            ).status
          ).toBe(405)
      }
    }
  })
  it('proves notification INSERT, UPDATE and DELETE cannot escape runtime RLS', async () => {
    const scoped = new Pool({ connectionString: context.runtimeUrl, max: 1 })
    const connection = await scoped.connect()
    const before = await inboxSnapshot()
    try {
      expect(
        (
          await connection.query(
            "SELECT has_table_privilege(current_user,'notifications','UPDATE') AS updates, has_table_privilege(current_user,'notifications','DELETE') AS deletes, has_table_privilege(current_user,'notifications','INSERT') AS inserts"
          )
        ).rows[0]
      ).toEqual({ updates: true, deletes: true, inserts: true })
      const insert = (tenantId: string) =>
        connection.query(
          "INSERT INTO notifications (id, \"tenantId\", \"userId\", type, title, message) VALUES ($1,$2,$3,'RENTAL','Scoped insert','Local fixture')",
          [randomUUID(), tenantId, user]
        )
      await connection.query('BEGIN')
      await expect(insert(context.alfa.id)).rejects.toMatchObject({
        code: '42501',
      })
      await connection.query('ROLLBACK')
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      await expect(insert(context.bravo.id)).rejects.toMatchObject({
        code: '42501',
      })
      await connection.query('ROLLBACK')
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect((await insert(context.alfa.id)).rowCount).toBe(1)
      await connection.query('ROLLBACK')
      await connection.query('BEGIN')
      await connection.query("SELECT set_config('app.tenant_id',$1,true)", [
        context.alfa.id,
      ])
      expect(
        (
          await connection.query(
            'UPDATE notifications SET "isRead"=true WHERE id=$1',
            [fixtures[9]!.id]
          )
        ).rowCount
      ).toBe(0)
      expect(
        (
          await connection.query('DELETE FROM notifications WHERE id=$1', [
            fixtures[9]!.id,
          ])
        ).rowCount
      ).toBe(0)
      expect(
        (
          await connection.query('DELETE FROM notifications WHERE id=$1', [
            fixtures[14]!.id,
          ])
        ).rowCount
      ).toBe(0)
      await expect(
        connection.query('UPDATE notifications SET "tenantId"=$1 WHERE id=$2', [
          context.bravo.id,
          fixtures[0]!.id,
        ])
      ).rejects.toMatchObject({ code: '42501' })
      await connection.query('ROLLBACK')
      expect(await inboxSnapshot()).toEqual(before)
    } finally {
      await connection.query('ROLLBACK')
      connection.release()
      await scoped.end()
    }
  })
  it('refuses a session revoked by the actual identity engine', async () => {
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: user },
      select: { password: true },
    })
    try {
      if (context.identity.mode === 'better-auth')
        await prisma.authSession.deleteMany({ where: { userId: user } })
      else
        await prisma.user.update({
          where: { id: user },
          data: { password: 'fixture-rotated-credential' },
        })
      await parity(jars[0]!, a, 401, { error: 'Authentication required' })
      await parityStats(jars[0]!, a, 401, { error: 'Authentication required' })
      for (const method of ['PATCH', 'DELETE', 'POST'] as const)
        await refusedMutation(method, 401, { error: 'Authentication required' })
    } finally {
      await prisma.user.update({
        where: { id: user },
        data: { password: saved.password },
      })
    }
  })
})
