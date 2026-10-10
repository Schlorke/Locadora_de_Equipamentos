import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ access: vi.fn(), publish: vi.fn() }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.access,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredSitePublication: mocks.publish,
}))
import * as api from '../../apps/services/api/src/app/api/admin/site/publish/route'
const principal = {
  tenantId: 'alfa',
  userId: 'owner',
  membershipId: 'owner-member',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.access.mockResolvedValue({ ok: true, principal })
  mocks.publish.mockResolvedValue(
    Response.json({ published: true, publishedAt: '2026-10-04T12:00:00.000Z' })
  )
})
describe.each([['API', api]] as const)(
  '%s publication adapter',
  (_name, route) => {
    const req = () =>
      new Request('https://app.example.test/api/admin/site/publish', {
        method: 'POST',
      })
    it('delegates the original request/current principal without duplicating rules', async () => {
      const request = req(),
        response = await route.POST(request)
      expect(response.status).toBe(200)
      expect(await response.json()).toHaveProperty('published', true)
      expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(request, principal)
    })
    it('preserves denial body/status/headers with explicit private caching', async () => {
      mocks.access.mockResolvedValue({
        ok: false,
        response: Response.json(
          { error: 'denied' },
          { status: 429, headers: { Vary: 'Accept', 'Retry-After': '20' } }
        ),
      })
      const response = await route.POST(req())
      expect(response.status).toBe(429)
      expect(await response.json()).toEqual({ error: 'denied' })
      expect(response.headers.get('Retry-After')).toBe('20')
      expect(response.headers.get('Vary')).toBe('Accept, Cookie, Host')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(mocks.publish).not.toHaveBeenCalled()
    })
    it.each(['CLIENT', 'DRIVER'])(
      'refuses role %s before publication composition',
      async (role) => {
        mocks.access.mockResolvedValue({
          ok: true,
          principal: { ...principal, role },
        })
        expect((await route.POST(req())).status).toBe(403)
        expect(mocks.publish).not.toHaveBeenCalled()
      }
    )
    it('keeps bootstrap failures private without exposing credentials', async () => {
      mocks.publish.mockRejectedValue(new Error('secret connection'))
      const response = await route.POST(req())
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(JSON.stringify(await response.json())).not.toContain('secret')
    })
  }
)
