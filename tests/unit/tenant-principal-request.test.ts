import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  organization: vi.fn(),
  membership: vi.fn(),
  transaction: vi.fn(),
  sql: vi.fn(),
  subscriptionOrganization: vi.fn(),
  subscription: vi.fn(),
  overrides: vi.fn(),
  events: [] as string[],
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
import { resolveTenantPrincipal as legacy } from '@/lib/tenant'
import { resolveTenantPrincipal as service } from '../../apps/services/api/src/host/private-identity'
import { createTenantPrincipalResolver } from '@gb-locacoes/backend/identity'
import type { MutationRequest } from '@gb-locacoes/backend/identity'

const secret = 'local-private-principal-fixture-secret-0123456789'
const member = {
  id: 'membership-fixture',
  tenantId: 'tenant-alfa',
  userId: 'user-fixture',
  role: 'CLIENT',
  status: 'ACTIVE',
  organization: { status: 'ACTIVE' },
}
const edge = (slug = 'alfa') => ({
  'x-platform-edge-auth': secret,
  'x-platform-host-kind': 'tenant',
  'x-platform-origin': `https://${slug}.platform.test`,
  'x-platform-tenant-slug': slug,
})
const request = (
  headers: Record<string, string | undefined> = {},
  method = 'GET'
): MutationRequest =>
  new Request('https://api.platform.test/api/admin/drivers', {
    method,
    headers: Object.fromEntries(
      Object.entries(headers).flatMap(([name, value]) =>
        value === undefined ? [] : [[name, value] as const]
      )
    ),
  })

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('PLATFORM_ENV', 'production')
  vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'platform.test')
  vi.stubEnv('PLATFORM_EDGE_SECRET', secret)
  vi.stubEnv('PLATFORM_EDGE_SECRET_PREVIOUS', '')
  vi.stubEnv('WEB_API_ORIGIN', '')
  vi.stubEnv('WEB_PUBLIC_ORIGIN', '')
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
  state.events.length = 0
  state.session.mockImplementation(async () => {
    state.events.push('session')
    return { user: { id: member.userId, role: 'ADMIN' } }
  })
  state.organization.mockImplementation(async () => {
    state.events.push('organization')
    return { id: member.tenantId, status: 'ACTIVE' }
  })
  state.membership.mockImplementation(async () => {
    state.events.push('membership')
    return member
  })
  state.sql.mockImplementation(async () => {
    state.events.push('scope')
    return []
  })
  state.transaction.mockImplementation(async (operation) => {
    state.events.push('transaction')
    return operation({
      $queryRaw: state.sql,
      membership: { findUnique: state.membership },
      organization: { findUnique: state.subscriptionOrganization },
      subscription: { findFirst: state.subscription },
      entitlementOverride: { findMany: state.overrides },
    })
  })
})
afterAll(() => vi.unstubAllEnvs())

it('creates a resolver without reading dependencies', () => {
  const getDatabase = vi.fn()
  const getSession = vi.fn()
  const resolvePublicTenant = vi.fn()
  expect(
    createTenantPrincipalResolver({
      getDatabase,
      getSession,
      resolvePublicTenant,
    })
  ).toBeTypeOf('function')
  expect(getDatabase).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
  expect(resolvePublicTenant).not.toHaveBeenCalled()
})
describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s private principal characterization', (_host, resolve) => {
  it.each([
    ['FULL', 'GET', 200, undefined],
    ['RESTRICTED', 'GET', 200, undefined],
    ['RESTRICTED', 'POST', 402, 'SUBSCRIPTION_RESTRICTED'],
    ['SETUP', 'POST', 402, 'SUBSCRIPTION_RESTRICTED'],
    ['ARCHIVED', 'GET', 403, 'TENANT_ARCHIVED'],
  ] as const)(
    'subscription on: %s %s preserves the shared admission contract',
    async (access, method, status, code) => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      state.subscriptionOrganization.mockResolvedValue({
        access,
        ownerUserId: member.userId,
        status: 'ACTIVE',
      })
      const result = await resolve(
        request({ 'x-tenant-id': member.tenantId }, method)
      )
      if (status === 200) {
        expect(result).toMatchObject({
          ok: true,
          principal: { access, isOwner: true, actor: 'owner', role: 'CLIENT' },
        })
      } else {
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected refusal')
        expect(result.response.status).toBe(status)
        expect(await result.response.json()).toMatchObject({ code })
        expect(result.response.headers.get('Cache-Control')).toBe(
          'private, no-store'
        )
        expect(result.response.headers.get('Vary')).toBe('Cookie, Host')
      }
      expect(state.membership.mock.invocationCallOrder[0]).toBeLessThan(
        state.subscriptionOrganization.mock.invocationCallOrder[0]!
      )
    }
  )
  it('enforcement never bypasses CSRF or a revoked membership', async () => {
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
    const csrf = await resolve(
      request({ ...edge(), origin: 'https://bravo.platform.test' }, 'POST')
    )
    expect(csrf.ok).toBe(false)
    expect(state.subscriptionOrganization).not.toHaveBeenCalled()
    expect(state.session).not.toHaveBeenCalled()
    state.membership.mockResolvedValue({ ...member, status: 'INACTIVE' })
    const stale = await resolve(
      request({ 'x-tenant-id': member.tenantId }, 'POST')
    )
    expect(stale.ok).toBe(false)
    expect(state.subscriptionOrganization).not.toHaveBeenCalled()
  })
  const denial = async (
    input: MutationRequest,
    status: number,
    error: string,
    cache: string | null = null
  ) => {
    const access = await resolve(input)
    expect(access.ok).toBe(false)
    if (access.ok) throw new Error('Expected denial')
    // OAuth redirects can reuse the exact refusal without reading a Response body.
    expect(access.error).toBe(error)
    expect(access.response.status).toBe(status)
    expect(await access.response.json()).toEqual({ error })
    expect(access.response.headers.get('cache-control')).toBe(cache)
    expect(access.response.headers.get('set-cookie')).toBeNull()
  }
  it.each([
    ['header', { 'x-tenant-id': member.tenantId }],
    ['cookie', { cookie: `selected-tenant-id=${member.tenantId}` }],
    ['host', edge()],
    [
      'matching sources',
      {
        ...edge(),
        'x-tenant-id': member.tenantId,
        cookie: `selected-tenant-id=${member.tenantId}`,
      },
    ],
  ])(
    'resolves %s and revalidates membership under RLS, never global ADMIN',
    async (_label, headers) => {
      expect(await resolve(request(headers))).toEqual({
        ok: true,
        principal: {
          userId: member.userId,
          tenantId: member.tenantId,
          membershipId: member.id,
          role: 'CLIENT',
        },
      })
      expect(state.events).toEqual([
        'session',
        ...('x-platform-host-kind' in headers ? ['organization'] : []),
        'transaction',
        'scope',
        'membership',
      ])
      expect(state.transaction).toHaveBeenCalledWith(expect.any(Function), {
        timeout: 15000,
        maxWait: 15000,
      })
      expect(state.sql.mock.calls[0]?.[0].join('?')).toContain(
        "set_config('app.tenant_id', ?, true)"
      )
      expect(state.sql.mock.calls[0]?.[1]).toBe(member.tenantId)
      expect(state.membership).toHaveBeenCalledWith({
        where: {
          tenantId_userId: { tenantId: member.tenantId, userId: member.userId },
        },
        include: { organization: { select: { status: true } } },
      })
    }
  )
  it('reads current membership every time', async () => {
    const input = request({ 'x-tenant-id': member.tenantId })
    expect((await resolve(input)).ok).toBe(true)
    state.membership.mockResolvedValueOnce({ ...member, status: 'INACTIVE' })
    await denial(input, 403, 'Organization access denied')
    expect(state.membership).toHaveBeenCalledTimes(2)
  })
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects sibling %s before session, cookie or database',
    async (method) => {
      await denial(
        request(
          {
            ...edge(),
            Origin: 'https://bravo.platform.test',
            cookie: 'selected-tenant-id=%zz',
          },
          method
        ),
        403,
        'Origem não permitida',
        'no-store'
      )
      expect(state.events).toEqual([])
    }
  )
  it('preserves headers-only method:null CSRF refusal', async () => {
    await denial(
      {
        method: null,
        url: null,
        headers: new Headers({
          ...edge(),
          Origin: 'https://bravo.platform.test',
        }),
      },
      403,
      'Origem não permitida',
      'no-store'
    )
    expect(state.events).toEqual([])
  })
  // Wave 132, finding 144: this case used to assert that a safe method kept its principal despite a sibling Origin
  // (the generic safe-method policy). The common principal now refuses an explicit foreign Origin on reads too,
  // after the membership (the role) and before the subscription admission and any data.
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'safe %s with a sibling Origin is refused after the membership, before subscription and data',
    async (method) => {
      vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
      const access = await resolve(
        request({ ...edge(), Origin: 'https://bravo.platform.test' }, method)
      )
      expect(access.ok).toBe(false)
      if (access.ok) throw new Error('Expected denial')
      expect(access.error).toBe('Origem não permitida')
      expect(access.response.status).toBe(403)
      expect(await access.response.json()).toEqual({
        error: 'Origem não permitida',
      })
      expect(access.response.headers.get('cache-control')).toBe('no-store')
      expect(access.response.headers.get('set-cookie')).toBeNull()
      expect(state.events).toEqual([
        'session',
        'organization',
        'transaction',
        'scope',
        'membership',
      ])
      expect(state.subscriptionOrganization).not.toHaveBeenCalled()
    }
  )
  it.each([
    ['opaque Origin', { Origin: 'null' }],
    [
      'cross-site metadata on its own Origin',
      { Origin: 'https://alfa.platform.test', 'Sec-Fetch-Site': 'cross-site' },
    ],
    ['panel Origin on a tenant host', { Origin: 'https://app.platform.test' }],
  ])('safe GET refuses an explicit %s', async (_label, headers) => {
    await denial(
      request({ ...edge(), ...headers }),
      403,
      'Origem não permitida',
      'no-store'
    )
  })
  it.each([
    ['without Origin', {}],
    [
      'without Origin on a cross-site navigation',
      { 'Sec-Fetch-Site': 'cross-site' },
    ],
    ['with its own Origin', { Origin: 'https://alfa.platform.test' }],
    [
      'with its own Origin and same-origin metadata',
      { Origin: 'https://alfa.platform.test', 'Sec-Fetch-Site': 'same-origin' },
    ],
  ])('safe GET keeps its principal %s', async (_label, headers) => {
    expect(await resolve(request({ ...edge(), ...headers }))).toMatchObject({
      ok: true,
      principal: { tenantId: member.tenantId, role: 'CLIENT' },
    })
  })
  it('safe GET with a sibling Origin keeps the earlier refusals and their envelopes', async () => {
    const sibling = { ...edge(), Origin: 'https://bravo.platform.test' }
    state.session.mockResolvedValueOnce(null)
    await denial(request(sibling), 401, 'Authentication required')
    state.membership.mockResolvedValueOnce(null)
    await denial(request(sibling), 403, 'Organization access denied')
    state.organization.mockResolvedValueOnce(null)
    const unknownHost = await resolve(request(sibling))
    expect(unknownHost.ok).toBe(false)
    if (unknownHost.ok) throw new Error('Expected denial')
    expect(unknownHost.response.status).toBe(404)
  })
  it('safe GET from headers only without Origin keeps its principal', async () => {
    expect(
      (
        await resolve({
          method: null,
          url: null,
          headers: new Headers({ ...edge(), host: 'alfa.platform.test' }),
        })
      ).ok
    ).toBe(true)
  })
  it('accepts native mutation without browser headers', async () => {
    expect(
      (await resolve(request({ 'x-tenant-id': member.tenantId }, 'POST'))).ok
    ).toBe(true)
  })
  it('accepts same-origin browser mutation', async () => {
    expect(
      (
        await resolve(
          request(
            {
              ...edge(),
              Origin: 'https://alfa.platform.test',
              'Sec-Fetch-Site': 'same-origin',
            },
            'POST'
          )
        )
      ).ok
    ).toBe(true)
  })
  it.each([
    'selected-tenant-id=%zz',
    'selected-tenant-id=tenant-alfa; selected-tenant-id=tenant-alfa',
  ])(
    'malformed or duplicate cookie fails after session, before host: %s',
    async (cookie) => {
      state.session.mockResolvedValueOnce(null)
      await denial(
        request({ ...edge(), cookie }),
        400,
        'Invalid tenant selection'
      )
      expect(state.organization).not.toHaveBeenCalled()
      expect(state.membership).not.toHaveBeenCalled()
      expect(state.session).toHaveBeenCalledOnce()
    }
  )
  it.each([
    {},
    { 'x-tenant-id': member.tenantId },
    { 'x-tenant-id': 'foreign', cookie: 'selected-tenant-id=tenant-alfa' },
  ])('missing session gives 401 before candidate policy', async (headers) => {
    state.session.mockResolvedValueOnce(null)
    await denial(request(headers), 401, 'Authentication required')
    expect(state.membership).not.toHaveBeenCalled()
  })
  it.each([{}, { 'x-tenant-id': '' }, { cookie: 'selected-tenant-id=' }])(
    'never selects a default tenant',
    async (headers) => {
      await denial(request(headers), 409, 'Select an organization')
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it.each(['space value', 'x'.repeat(129)])(
    'invalid tenant ID stays 400',
    async (value) => {
      await denial(
        request({ 'x-tenant-id': value }),
        400,
        'Invalid tenant selection'
      )
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it.each([
    { ...edge(), 'x-tenant-id': 'tenant-bravo' },
    { ...edge(), cookie: 'selected-tenant-id=tenant-bravo' },
    {
      'x-tenant-id': member.tenantId,
      cookie: 'selected-tenant-id=tenant-bravo',
    },
  ])(
    'conflicting sources stay 400 without membership lookup',
    async (headers) => {
      await denial(request(headers), 400, 'Conflicting tenant selection')
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it.each([null, { id: 'suspended-fixture', status: 'SUSPENDED' }])(
    'unknown or suspended host stays neutral 404 before authentication policy',
    async (organization) => {
      state.session.mockResolvedValueOnce(null)
      state.organization.mockResolvedValueOnce(organization)
      const access = await resolve(request(edge()))
      expect(access.ok).toBe(false)
      if (access.ok) throw new Error('Expected denial')
      expect(access.response.status).toBe(404)
      expect(access.response.headers.get('cache-control')).toBe('no-store')
      expect(state.membership).not.toHaveBeenCalled()
    }
  )
  it('forged host cannot grant a tenant', async () => {
    await denial(
      request({ ...edge(), 'x-platform-edge-auth': 'wrong' }),
      409,
      'Select an organization'
    )
    expect(state.organization).not.toHaveBeenCalled()
  })
  it.each([
    null,
    { ...member, tenantId: 'foreign' },
    { ...member, userId: 'foreign' },
    { ...member, status: 'INACTIVE' },
    { ...member, organization: { status: 'SUSPENDED' } },
  ])('denies stale or foreign membership', async (row) => {
    state.membership.mockResolvedValueOnce(row)
    await denial(
      request({ 'x-tenant-id': member.tenantId }),
      403,
      'Organization access denied'
    )
  })
  it.each(['session', 'organization', 'membership'] as const)(
    'propagates %s failures to its HTTP caller',
    async (dependency) => {
      state[dependency].mockRejectedValueOnce(new Error('local-fixture-error'))
      await expect(resolve(request(edge()))).rejects.toThrow(
        'local-fixture-error'
      )
    }
  )
})
