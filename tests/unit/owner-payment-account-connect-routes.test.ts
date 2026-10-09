import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  gate: vi.fn(),
  connect: vi.fn(),
  session: vi.fn(),
}))
vi.mock('../../lib/tenant', () => ({ resolveTenantPrincipal: mock.gate }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mock.gate,
}))
vi.mock('../../lib/application-session', () => ({
  getServerSession: mock.session,
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: mock.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredPaymentAccountConnection: mock.connect,
}))
import { POST as legacy } from '../../app/api/admin/payment-account/connect/route'
import { POST as api } from '../../apps/services/api/src/app/api/admin/payment-account/connect/route'
const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.gate.mockResolvedValue({ ok: true, principal })
  mock.connect.mockResolvedValue(
    Response.json({ accepted: true }, { status: 202 })
  )
})
it.each([
  ['legacy', legacy],
  ['api', api],
] as const)(
  '%s guards identity and role before connecting; delegates verified session getter',
  async (_name, route) => {
    const request = () =>
      new Request('https://api.test/api/admin/payment-account/connect', {
        method: 'POST',
      })
    expect((await route(request())).status).toBe(202)
    expect(mock.connect).toHaveBeenCalledWith(
      expect.any(Request),
      principal,
      mock.session
    )
    mock.connect.mockClear()
    mock.gate.mockResolvedValueOnce({
      ok: false,
      response: Response.json(
        { code: 'TENANT_REQUIRED' },
        { status: 409, headers: { 'Retry-After': '3' } }
      ),
    })
    const denied = await route(request())
    expect(denied.status).toBe(409)
    expect(denied.headers.get('cache-control')).toBe('private, no-store')
    expect(denied.headers.get('retry-after')).toBe('3')
    for (const role of ['CLIENT', 'FINANCIAL', 'OPERATOR']) {
      mock.gate.mockResolvedValueOnce({
        ok: true,
        principal: { ...principal, role },
      })
      expect((await route(request())).status).toBe(403)
    }
    expect(mock.connect).not.toHaveBeenCalled()
    mock.connect.mockRejectedValueOnce(new Error('private-key-secret'))
    const failed = await route(request())
    expect(failed.status).toBe(503)
    expect(failed.headers.get('cache-control')).toBe('private, no-store')
    expect(await failed.text()).not.toContain('private-key-secret')
  }
)
