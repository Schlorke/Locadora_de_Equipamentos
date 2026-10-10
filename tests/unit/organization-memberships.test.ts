import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  session: vi.fn(),
  memberships: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: state.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: { membership: { findMany: state.memberships } },
  }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/auth/organizations/route'

beforeEach(() => {
  vi.resetAllMocks()
  state.session.mockResolvedValue({
    user: { id: 'fixture-user', role: 'ADMIN' },
  })
  state.memberships.mockResolvedValue([])
})

describe.each([['service', service]])(
  '%s organization memberships HTTP characterization',
  (_host, GET) => {
    it.each([null, {}, { user: {} }, { user: { id: '' } }])(
      'rejects a missing identity before querying memberships: %j',
      async (session) => {
        state.session.mockResolvedValue(session)
        const response = await GET()
        expect(response.status).toBe(401)
        expect(await response.json()).toEqual({
          error: 'Authentication required',
        })
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(response.headers.get('Vary')).toBe('Cookie')
        expect(state.memberships).not.toHaveBeenCalled()
      }
    )

    it('filters only the current user active memberships and active organizations with the existing projection/order', async () => {
      const tenant = {
        id: 'fixture-tenant',
        slug: 'fixture-rental',
        name: 'Fixture',
        status: 'ACTIVE',
      }
      state.memberships.mockResolvedValue([
        { id: 'fixture-membership', role: 'CLIENT', organization: tenant },
      ])
      const response = await GET()
      expect(state.session).toHaveBeenCalledExactlyOnceWith()
      expect(state.memberships).toHaveBeenCalledExactlyOnceWith({
        where: {
          userId: 'fixture-user',
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
        orderBy: { organization: { name: 'asc' } },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        memberships: [
          { membershipId: 'fixture-membership', role: 'CLIENT', tenant },
        ],
      })
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Vary')).toBe('Cookie')
    })

    it('keeps an empty list and never chooses a default tenant', async () => {
      expect(await (await GET()).json()).toEqual({ memberships: [] })
    })

    it('leaves an unexpected session failure to the existing framework error path', async () => {
      const failure = new Error('fixture session failure')
      state.session.mockRejectedValue(failure)
      await expect(GET()).rejects.toBe(failure)
      expect(state.memberships).not.toHaveBeenCalled()
    })

    it('leaves an unexpected database failure to the existing framework error path', async () => {
      const failure = new Error('fixture database failure')
      state.memberships.mockRejectedValue(failure)
      await expect(GET()).rejects.toBe(failure)
      expect(state.session).toHaveBeenCalledExactlyOnceWith()
    })
  }
)
