import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  command: vi.fn(),
  access: vi.fn(),
  status: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: mocks.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredOnboarding: mocks.command,
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.access,
}))
vi.mock('../../apps/services/api/src/host/onboarding-read', () => ({
  readOnboardingStatus: mocks.status,
}))
import * as apiCreate from '../../apps/services/api/src/app/api/onboarding/organizations/route'
import * as apiSlug from '../../apps/services/api/src/app/api/onboarding/slug-availability/route'
import * as apiStatus from '../../apps/services/api/src/app/api/onboarding/status/route'
const principal = {
  tenantId: 'alfa',
  userId: 'authenticated-owner',
  membershipId: 'alfa-owner',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: principal.userId } })
  mocks.access.mockResolvedValue({ ok: true, principal })
  mocks.command.mockResolvedValue(Response.json({ accepted: true }))
  mocks.status.mockResolvedValue(Response.json({ items: [] }))
})
describe.each([['API', apiCreate, apiSlug, apiStatus]] as const)(
  '%s onboarding adapters',
  (_name, create, slug, status) => {
    it.each([null, {}, { user: {} }])(
      'refuses missing authenticated user before the composition: %j',
      async (session) => {
        mocks.session.mockResolvedValue(session)
        expect(
          (
            await create.POST(
              new Request('http://localhost/api/onboarding/organizations', {
                method: 'POST',
              })
            )
          ).status
        ).toBe(401)
        expect(
          (
            await slug.GET(
              new Request('http://localhost/api/onboarding/slug-availability')
            )
          ).status
        ).toBe(401)
        expect(mocks.command).not.toHaveBeenCalled()
      }
    )
    it('does not use body identity or selected tenant as owner', async () => {
      const request = new Request(
        'http://localhost/api/onboarding/organizations',
        { method: 'POST', body: JSON.stringify({ userId: 'forged-user' }) }
      )
      await create.POST(request)
      expect(mocks.command).toHaveBeenCalledWith(
        request,
        principal.userId,
        'create'
      )
      const lookup = new Request(
        'http://localhost/api/onboarding/slug-availability?slug=new-rental'
      )
      await slug.GET(lookup)
      expect(mocks.command).toHaveBeenCalledWith(
        lookup,
        principal.userId,
        'slug'
      )
    })
    it('rejects cross-origin cookie mutation before reading session', async () => {
      const request = new Request(
        'http://localhost/api/onboarding/organizations',
        {
          method: 'POST',
          headers: {
            Origin: 'https://outside.test',
            'Sec-Fetch-Site': 'cross-site',
          },
        }
      )
      const denial = await create.POST(request)
      expect(denial.status).toBe(403)
      expect(denial.headers.get('cache-control')).toBe('private, no-store')
      expect(denial.headers.get('vary')).toBe('Cookie, Host')
      expect(mocks.session).not.toHaveBeenCalled()
      expect(mocks.command).not.toHaveBeenCalled()
    })
    it('keeps principal refusal and refuses non-admin checklist before reads', async () => {
      const request = new Request('http://localhost/api/onboarding/status')
      const denied = Response.json(
        { error: 'denied' },
        { status: 409, headers: { Vary: 'Accept' } }
      )
      mocks.access.mockResolvedValueOnce({ ok: false, response: denied })
      const denial = await status.GET(request)
      expect(denial.status).toBe(denied.status)
      expect(denial.headers.get('cache-control')).toBe('private, no-store')
      expect(denial.headers.get('vary')).toBe('Accept, Cookie, Host')
      expect(denial.headers.get('content-type')).toBe(
        denied.headers.get('content-type')
      )
      expect(await denial.json()).toEqual({ error: 'denied' })
      mocks.access.mockResolvedValueOnce({
        ok: true,
        principal: { ...principal, role: 'OPERATOR' },
      })
      expect((await status.GET(request)).status).toBe(403)
      expect(mocks.status).not.toHaveBeenCalled()
      await status.GET(request)
      expect(mocks.status).toHaveBeenCalledWith(request, principal)
    })
  }
)
