import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ gate: vi.fn(), read: vi.fn() }))
vi.mock('../../lib/tenant', () => ({ resolveTenantPrincipal: mock.gate }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mock.gate,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredPaymentAccount: mock.read,
}))
import { GET as legacy } from '../../app/api/admin/payment-account/route'
import { GET as api } from '../../apps/services/api/src/app/api/admin/payment-account/route'
const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.gate.mockResolvedValue({ ok: true, principal })
  mock.read.mockResolvedValue(
    Response.json(
      { account: null },
      {
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  )
})
it.each([
  ['legacy', legacy],
  ['api', api],
] as const)(
  '%s keeps refusals private and never calls storage before identity/role',
  async (_name, route) => {
    mock.gate.mockResolvedValueOnce({
      ok: false,
      response: Response.json(
        { code: 'TENANT_REQUIRED' },
        { status: 409, headers: { 'Retry-After': '3' } }
      ),
    })
    const response = await route(
      new Request('https://api.test/api/admin/payment-account')
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ code: 'TENANT_REQUIRED' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Host')
    expect(response.headers.get('retry-after')).toBe('3')
    expect(mock.read).not.toHaveBeenCalled()
    for (const role of ['CLIENT', 'OPERATOR', 'FINANCIAL']) {
      mock.gate.mockResolvedValueOnce({
        ok: true,
        principal: { ...principal, role },
      })
      expect(
        (
          await route(
            new Request(
              response.url || 'https://api.test/api/admin/payment-account'
            )
          )
        ).status
      ).toBe(403)
    }
    expect(mock.read).not.toHaveBeenCalled()
  }
)
it.each([
  ['legacy', legacy],
  ['api', api],
] as const)(
  '%s delegates the original request/principal and hides internal failures',
  async (_name, route) => {
    const request = new Request('https://api.test/api/admin/payment-account')
    expect((await route(request)).status).toBe(200)
    expect(mock.read).toHaveBeenCalledWith(request, principal)
    mock.read.mockRejectedValueOnce(new Error('private-database-password'))
    const response = await route(request)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('private-database-password')
  }
)
