import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  gate: vi.fn(),
  creation: vi.fn(),
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
  handleConfiguredPaymentAccountCreation: mock.creation,
}))
import {
  GET as legacyGET,
  POST as legacyPOST,
} from '../../app/api/admin/payment-account/create/route'
import {
  GET as apiGET,
  POST as apiPOST,
} from '../../apps/services/api/src/app/api/admin/payment-account/create/route'
const principal = {
  tenantId: 'alfa',
  userId: 'owner-alfa',
  membershipId: 'member-alfa',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.gate.mockResolvedValue({ ok: true, principal })
  mock.creation.mockImplementation(async (request: Request) =>
    Response.json(
      request.method === 'POST' ? { accepted: true } : { available: false },
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
      new Request('https://api.test/api/admin/payment-account/create', {
        method,
      })
    expect((await route(request())).status).toBe(method === 'POST' ? 202 : 200)
    expect(mock.creation).toHaveBeenCalledWith(
      expect.any(Request),
      principal,
      mock.session
    )
    mock.creation.mockClear()
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
    expect(mock.creation).not.toHaveBeenCalled()
    mock.creation.mockRejectedValueOnce(new Error('private-provider-secret'))
    const failure = await route(request())
    expect(failure.status).toBe(503)
    expect(failure.headers.get('cache-control')).toBe('private, no-store')
    expect(await failure.text()).not.toContain('private-provider-secret')
  }
)
