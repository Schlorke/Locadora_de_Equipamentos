import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  gate: vi.fn(),
  recovery: vi.fn(),
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
  handleConfiguredPaymentAccountRecovery: mock.recovery,
}))
import {
  GET as legacyGET,
  POST as legacyPOST,
} from '../../app/api/admin/payment-account/recovery/route'
import {
  GET as apiGET,
  POST as apiPOST,
} from '../../apps/services/api/src/app/api/admin/payment-account/recovery/route'
const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.gate.mockResolvedValue({ ok: true, principal })
  mock.recovery.mockImplementation(async (request: Request) =>
    Response.json(
      request.method === 'POST' ? { accepted: true } : { recovery: null },
      { status: request.method === 'POST' ? 202 : 200 }
    )
  )
})
it.each([
  ['legacy GET', legacyGET, 'GET'],
  ['legacy POST', legacyPOST, 'POST'],
  ['service GET', apiGET, 'GET'],
  ['service POST', apiPOST, 'POST'],
] as const)(
  '%s preserves the actual tenant gate and session getter, role refusals and private errors',
  async (_name, route, method) => {
    const request = () =>
      new Request('https://api.test/api/admin/payment-account/recovery', {
        method,
      })
    expect((await route(request())).status).toBe(method === 'POST' ? 202 : 200)
    expect(mock.recovery).toHaveBeenCalledWith(
      expect.any(Request),
      principal,
      mock.session
    )
    mock.recovery.mockClear()
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
    expect(mock.recovery).not.toHaveBeenCalled()
    mock.recovery.mockRejectedValueOnce(new Error('private-provider-secret'))
    const failure = await route(request())
    expect(failure.status).toBe(503)
    expect(failure.headers.get('cache-control')).toBe('private, no-store')
    expect(await failure.text()).not.toContain('private-provider-secret')
  }
)
