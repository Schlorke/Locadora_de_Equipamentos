import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE, PUBLIC_ORGANIZATION_SELECT } from '../helpers/public-site'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  organization: vi.fn(),
  membership: vi.fn(),
  transaction: vi.fn(),
  sql: vi.fn(),
}))
vi.mock('@/lib/application-session', () => ({
  getServerSession: state.session,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: state.organization },
    $transaction: state.transaction,
  },
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: state.organization },
      $transaction: state.transaction,
    },
  }),
}))
import { GET as legacy } from '@/app/api/auth/organizations/current/route'
import { GET as service } from '../../apps/services/api/src/app/api/auth/organizations/current/route'

const secret = 'local-current-host-fixture-secret-0123456789'
const tenant = {
  id: 'fixture-tenant',
  slug: 'alfa',
  name: 'Fixture',
  status: 'ACTIVE',
}
const row = {
  id: 'fixture-membership',
  role: 'CLIENT',
  status: 'ACTIVE',
  tenantId: tenant.id,
  userId: 'fixture-user',
  organization: tenant,
}
const expected = {
  membership: {
    membershipId: row.id,
    role: row.role,
    tenant,
  },
}
const edge = (slug = 'alfa') => ({
  'x-platform-edge-auth': secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-origin': `https://${slug}.platform.test`,
  'x-platform-tenant-slug': slug,
})
const outside = [
  ['no edge', {}],
  [
    'app',
    {
      'x-platform-edge-auth': secret,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.platform.test',
    },
  ],
  [
    'apex',
    {
      'x-platform-edge-auth': secret,
      'x-platform-host-kind': 'apex',
      'x-platform-origin': 'https://platform.test',
    },
  ],
  ['forged', { ...edge(), 'x-platform-edge-auth': 'wrong-fixture-secret' }],
] as const
const request = (headers: Record<string, string> = edge(), query = '') =>
  new Request(
    `https://api.platform.test/api/auth/organizations/current${query}`,
    { headers }
  )

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', secret)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  state.organization.mockResolvedValue({
    id: tenant.id,
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  state.session.mockResolvedValue({ user: { id: row.userId, role: 'ADMIN' } })
  state.membership.mockResolvedValue(row)
  state.sql.mockResolvedValue([])
  state.transaction.mockImplementation(async (operation) =>
    operation({
      membership: { findUnique: state.membership },
      $queryRaw: state.sql,
    })
  )
})
afterAll(() => vi.unstubAllEnvs())

describe.each([
  ['legacy', legacy],
  ['service', service],
])('%s current organization read characterization', (_host, GET) => {
  const assertReply = async (
    response: Response,
    status: number,
    body: unknown,
    privateCache = true
  ) => {
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual(body)
    expect(response.headers.get('cache-control')).toBe(
      privateCache ? 'private, no-store' : 'no-store'
    )
    expect(response.headers.get('vary')).toBe(
      privateCache ? 'Cookie, Host' : null
    )
    expect(response.headers.get('set-cookie')).toBeNull()
  }
  it.each(
    outside.flatMap(([name, headers]) =>
      [
        '',
        '?tenantSlug=alfa',
        '?tenantSlug=unknown',
        '?tenantSlug=api',
        '?tenantSlug=alfa&tenantSlug=bravo',
      ].map((query) => [name, headers, query] as const)
    )
  )(
    'outside a tenant host (%s, %s, %s) fails before any lookup or session',
    async (_name, headers, query) => {
      await assertReply(await GET(request(headers, query)), 409, {
        error: 'Disponível somente no endereço da locadora',
        code: 'TENANT_REQUIRED',
      })
      expect(state.organization).not.toHaveBeenCalled()
      expect(state.session).not.toHaveBeenCalled()
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each([null, {}, { user: {} }, { user: { id: '' } }])(
    'requires identity after resolving the tenant host: %j',
    async (session) => {
      state.session.mockResolvedValue(session)
      await assertReply(await GET(request()), 401, {
        error: 'Authentication required',
      })
      expect(state.organization).toHaveBeenCalledExactlyOnceWith({
        where: { slug: 'alfa' },
        select: PUBLIC_ORGANIZATION_SELECT,
      })
      expect(state.transaction).not.toHaveBeenCalled()
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it('queries only the host tenant and current identity within a tenant transaction', async () => {
    await assertReply(await GET(request()), 200, expected)
    expect(state.transaction).toHaveBeenCalledTimes(1)
    expect(state.transaction.mock.calls[0]![1]).toEqual({
      timeout: 15_000,
      maxWait: 15_000,
    })
    expect(state.sql.mock.calls[0]![0].join('?')).toBe(
      "SELECT set_config('app.tenant_id', ?, true)"
    )
    expect(state.sql.mock.calls[0]![1]).toBe(tenant.id)
    expect(state.membership).toHaveBeenCalledExactlyOnceWith({
      where: { tenantId_userId: { tenantId: tenant.id, userId: row.userId } },
      select: {
        id: true,
        role: true,
        status: true,
        tenantId: true,
        userId: true,
        organization: {
          select: { id: true, slug: true, name: true, status: true },
        },
      },
    })
  })
  it.each([null, { id: tenant.id, status: 'SUSPENDED' }])(
    'unknown or suspended host stays neutral before identity, even with a conflicting query: %j',
    async (organization) => {
      state.organization.mockResolvedValue(organization)
      await assertReply(
        await GET(request(edge(), '?tenantSlug=bravo')),
        404,
        { error: 'Locadora não encontrada' },
        false
      )
      expect(state.session).not.toHaveBeenCalled()
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each([
    '?tenantSlug=alfa',
    '?tenantSlug=alfa&tenantSlug=alfa',
    '?tenantSlug=',
    '?tenantSlug=%20%20',
  ])(
    'keeps the existing query agreement and lookup order: %s',
    async (query) => {
      await assertReply(await GET(request(edge(), query)), 200, expected)
      expect(state.organization).toHaveBeenCalledTimes(2)
    }
  )
  it.each([
    '?tenantSlug=bravo',
    '?tenantSlug=alfa&tenantSlug=bravo',
    '?tenantSlug=%20alfa%20',
  ])(
    'query conflict precedes authentication and performs no membership read: %s',
    async (query) => {
      state.session.mockResolvedValue(null)
      await assertReply(
        await GET(request(edge(), query)),
        400,
        { error: 'Seleção de locadora conflitante', code: 'TENANT_CONFLICT' },
        false
      )
      expect(state.organization).toHaveBeenCalledTimes(1)
      expect(state.session).not.toHaveBeenCalled()
      expect(state.transaction).not.toHaveBeenCalled()
    }
  )
  it.each([
    { cookie: 'selected-tenant-id=bravo' },
    { 'x-tenant-id': 'bravo', 'x-user-id': 'someone-else' },
    { cookie: 'selected-tenant-id=alfa; selected-tenant-id=bravo' },
    { cookie: 'selected-tenant-id=%FF' },
  ])(
    'ignores private preferences and identity hints on the tenant host: %j',
    async (hints) => {
      await assertReply(
        await GET(
          request({ ...edge(), ...hints }, '?userId=someone-else&role=ADMIN')
        ),
        200,
        expected
      )
      expect(state.membership.mock.calls[0]![0].where).toEqual({
        tenantId_userId: { tenantId: tenant.id, userId: row.userId },
      })
    }
  )
  it.each([null, { ...row, tenantId: 'other' }, { ...row, userId: 'other' }])(
    'missing or mismatched membership remains NO_MEMBERSHIP: %j',
    async (membership) => {
      state.membership.mockResolvedValue(membership)
      await assertReply(await GET(request()), 404, {
        error: 'Sem vínculo com esta locadora',
        code: 'NO_MEMBERSHIP',
      })
    }
  )
  it.each([
    { ...row, status: 'REVOKED' },
    { ...row, status: 'SUSPENDED' },
    { ...row, organization: { ...tenant, status: 'SUSPENDED' } },
  ])(
    'denies an inactive membership or organization: %j',
    async (membership) => {
      state.membership.mockResolvedValue(membership)
      await assertReply(await GET(request()), 403, {
        error: 'Organization access denied',
      })
    }
  )
  it.each(['organization', 'session', 'transaction', 'membership'] as const)(
    'keeps the generic 503 and server log on %s failure',
    async (dependency) => {
      state[dependency].mockRejectedValue(new Error('fixture-private-cause'))
      await assertReply(await GET(request()), 503, {
        error: 'Organization selection unavailable',
      })
      expect(console.error).toHaveBeenCalledWith(
        'Erro ao consultar vínculo da locadora do host:',
        expect.any(Error)
      )
    }
  )
})
