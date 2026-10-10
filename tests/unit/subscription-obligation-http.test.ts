import { beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
const state = vi.hoisted(() => ({
  access: vi.fn(),
  write: vi.fn(),
  accepted: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.access,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.access,
}))
vi.mock('../../apps/services/api/src/host/payments', () => ({
  requestQuoteBoletoPayment: state.write,
  requestQuoteBoletoDelivery: state.write,
  ensureQuoteBoletoPayment: state.accepted,
}))
vi.mock('../../apps/services/api/src/host/financial-mutations', () => ({
  requestBoletoReissue: state.write,
  updateFinancialStatus: state.write,
}))
vi.mock('../../apps/services/api/src/host/rentals', () => ({
  readAdminRental: vi.fn(),
  updateRental: state.write,
  checkinRental: state.write,
}))
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  strictRateLimit: {},
}))
import { POST as apiGenerate } from '../../apps/services/api/src/app/api/admin/quotes/[id]/generate-boleto/route'
import { POST as apiSend } from '../../apps/services/api/src/app/api/admin/quotes/[id]/send-boleto/route'
import { PUT as apiReissue } from '../../apps/services/api/src/app/api/payments/boleto/[id]/regenerate/route'
import { POST as apiReturn } from '../../apps/services/api/src/app/api/admin/rentals/[id]/checkin/route'
import { PATCH as apiClose } from '../../apps/services/api/src/app/api/admin/rentals/[id]/route'
import { PATCH as apiSettlement } from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/status/route'
const principal = {
  tenantId: 'alfa',
  userId: 'admin',
  membershipId: 'member',
  role: 'ADMIN',
}
const cases = [
  ...[apiGenerate].map((handler) => ({
    handler,
    name: 'generate',
    method: 'POST',
    body: {},
    billing: true,
  })),
  ...[apiSend].map((handler) => ({
    handler,
    name: 'send',
    method: 'POST',
    body: {},
    billing: true,
  })),
  ...[apiReissue].map((handler) => ({
    handler,
    name: 'reissue',
    method: 'PUT',
    body: {},
    billing: true,
  })),
  ...[apiReturn].map((handler) => ({
    handler,
    name: 'return',
    method: 'POST',
    body: {},
    billing: false,
  })),
  ...[apiClose].map((handler) => ({
    handler,
    name: 'close',
    method: 'PATCH',
    body: { status: 'COMPLETED' },
    billing: false,
  })),
  ...[apiSettlement].map((handler) => ({
    handler,
    name: 'settlement',
    method: 'PATCH',
    body: { billingStatus: 'PAID' },
    billing: false,
  })),
]
beforeEach(() => {
  vi.resetAllMocks()
  state.access.mockResolvedValue({ ok: true, principal })
})
describe.each(cases)(
  'paired obligation adapter $name',
  ({ handler, name, method, body, billing }) => {
    const run = () =>
      handler(
        new NextRequest('http://localhost/api/fixture', {
          method,
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: 'one' }) }
      )
    it.each([
      [402, 'SUBSCRIPTION_RESTRICTED'],
      [403, 'TENANT_ARCHIVED'],
    ] as const)(
      'keeps exact commercial %s envelope and private cache',
      async (status, code) => {
        const policy = { error: 'Fixture refusal', code }
        state.write.mockRejectedValue(
          billing
            ? new PaymentRequestError(status, policy.error, policy)
            : new RentalMutationError(
                policy.error,
                status,
                code,
                undefined,
                policy
              )
        )
        const response = await run()
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(policy)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(response.headers.get('Vary')).toBe('Cookie, Host')
        expect(state.accepted).not.toHaveBeenCalled()
      }
    )
    it('retains existing domain errors including closure missingDocuments and financial code', async () => {
      state.write.mockRejectedValue(
        billing
          ? new PaymentRequestError(409, 'Existing failure')
          : new RentalMutationError('Existing failure', 409, 'existing', [
              'idCard',
            ])
      )
      const response = await run()
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Existing failure',
        ...(name === 'close' ? { missingDocuments: ['idCard'] } : {}),
        ...(name === 'settlement' ? { code: 'existing' } : {}),
      })
      expect(response.headers.get('Cache-Control')).toBeNull()
    })
    it('authorization precedes the manual command and never invokes the accepted-job entry', async () => {
      state.access.mockResolvedValue({
        ok: false,
        response: Response.json({ error: 'Forbidden' }, { status: 403 }),
      })
      expect((await run()).status).toBe(403)
      expect(state.write).not.toHaveBeenCalled()
      expect(state.accepted).not.toHaveBeenCalled()
    })
  }
)
