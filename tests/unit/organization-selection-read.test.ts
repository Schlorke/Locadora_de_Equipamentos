import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ session: vi.fn(), membership: vi.fn() }))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: { membership: { findFirst: state.membership } },
  }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/auth/organizations/selection/route'

const tenant = {
  id: 'fixture-tenant',
  slug: 'fixture-rental',
  name: 'Fixture',
  status: 'ACTIVE',
}
const preference = (secure = false) =>
  'selected-tenant-id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' +
  (secure ? '; Secure' : '')
const request = (headers: Record<string, string> = {}, query = '') =>
  new Request(
    `https://app.example.test/api/auth/organizations/selection${query}`,
    {
      headers,
    }
  )

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'test')
  state.session.mockResolvedValue({
    user: { id: 'fixture-user', role: 'ADMIN' },
  })
  state.membership.mockResolvedValue({
    id: 'fixture-membership',
    role: 'CLIENT',
    organization: tenant,
  })
})
afterAll(() => vi.unstubAllEnvs())

describe.each([['service', service]])(
  '%s selection read characterization',
  (_host, GET) => {
    const assertReply = async (
      response: Response,
      status: number,
      body: unknown,
      cookie: string | null = null
    ) => {
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual(body)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('vary')).toBe('Cookie, x-tenant-id')
      expect(response.headers.get('set-cookie')).toBe(cookie)
    }

    it.each([null, {}, { user: {} }, { user: { id: '' } }])(
      'clears the preference without querying when identity is absent: %j',
      async (session) => {
        state.session.mockResolvedValue(session)
        await assertReply(
          await GET(request({ cookie: 'selected-tenant-id=fixture-tenant' })),
          401,
          { error: 'Authentication required' },
          preference()
        )
        expect(state.membership).not.toHaveBeenCalled()
      }
    )

    it('never selects a default tenant or uses query/body roles without a preference', async () => {
      await assertReply(
        await GET(
          request({}, '?tenantId=fixture-tenant&userId=other&role=ADMIN')
        ),
        200,
        { selection: null }
      )
      expect(state.membership).not.toHaveBeenCalled()
    })

    it.each([
      { 'x-tenant-id': tenant.id },
      { cookie: 'selected-tenant-id=fixture-tenant' },
      { cookie: 'unrelated=x; selected-tenant-id=fixture%2Dtenant' },
      { cookie: 'selected-tenant-id=fixture-tenant', 'x-tenant-id': tenant.id },
    ])(
      'revalidates an explicit selection and returns the membership role: %j',
      async (headers) => {
        await assertReply(await GET(request(headers)), 200, {
          selection: {
            membershipId: 'fixture-membership',
            role: 'CLIENT',
            tenant,
          },
        })
        expect(state.membership).toHaveBeenCalledExactlyOnceWith({
          where: {
            userId: 'fixture-user',
            tenantId: tenant.id,
            status: 'ACTIVE',
            organization: { status: 'ACTIVE' },
          },
          select: {
            id: true,
            role: true,
            organization: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
        })
      }
    )

    it.each([
      'selected-tenant-id=alfa; selected-tenant-id=bravo',
      'selected-tenant-id=alfa; selected-tenant-id=alfa',
      'selected-tenant-id=%',
      'selected-tenant-id=%FF',
    ])(
      'clears an ambiguous or undecodable cookie before any lookup: %s',
      async (cookie) => {
        await assertReply(
          await GET(request({ cookie })),
          400,
          { error: 'Invalid tenant selection' },
          preference()
        )
        expect(state.membership).not.toHaveBeenCalled()
      }
    )

    it('refuses a header/cookie conflict without arbitrarily choosing or clearing either', async () => {
      await assertReply(
        await GET(
          request({ cookie: 'selected-tenant-id=alfa', 'x-tenant-id': 'bravo' })
        ),
        400,
        { error: 'Conflicting tenant selection' }
      )
      expect(state.membership).not.toHaveBeenCalled()
    })

    it.each(['', '../other', '%20alfa%20', 'a'.repeat(129)])(
      'retains the existing response for an invalid decoded identity: %s',
      async (id) => {
        await assertReply(
          await GET(request({ cookie: `selected-tenant-id=${id}` })),
          400,
          { error: 'Invalid tenant selection' }
        )
        expect(state.membership).not.toHaveBeenCalled()
      }
    )

    it('accepts the existing 128-character identity boundary', async () => {
      await GET(request({ 'x-tenant-id': 'a'.repeat(128) }))
      expect(state.membership.mock.calls[0]![0].where.tenantId).toBe(
        'a'.repeat(128)
      )
    })

    it.each(['cookie', 'header'])(
      'clears a preference whose membership is no longer active: %s',
      async (transport) => {
        state.membership.mockResolvedValue(null)
        await assertReply(
          await GET(
            request(
              transport === 'cookie'
                ? { cookie: 'selected-tenant-id=fixture-tenant' }
                : { 'x-tenant-id': tenant.id }
            )
          ),
          200,
          { selection: null },
          preference()
        )
      }
    )

    it('adds Secure to the clearing cookie in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      state.session.mockResolvedValue(null)
      await assertReply(
        await GET(request()),
        401,
        { error: 'Authentication required' },
        preference(true)
      )
    })

    it.each(['session', 'membership'] as const)(
      'preserves the 503 failure path without exposing the %s cause',
      async (dependency) => {
        state[dependency].mockRejectedValue(new Error('fixture-private-cause'))
        await assertReply(
          await GET(request({ 'x-tenant-id': tenant.id })),
          503,
          {
            error: 'Organization selection unavailable',
          }
        )
        if (dependency === 'session')
          expect(state.membership).not.toHaveBeenCalled()
      }
    )
  }
)
