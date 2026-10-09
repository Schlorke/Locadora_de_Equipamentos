import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PaymentRequestError } from '@gb-locacoes/backend/billing'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { VehicleError } from '@gb-locacoes/backend/operations'

const state = vi.hoisted(() => ({ access: vi.fn(), write: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: state.access }))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.access,
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.access,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.access,
}))
vi.mock('@/lib/payment-request', () => ({ requestPayment: state.write }))
vi.mock('../../apps/services/api/src/host/payments', () => ({
  requestPayment: state.write,
}))
vi.mock('@/lib/payment-obligation', async () => {
  const { PaymentRequestError } = await import('@gb-locacoes/backend/billing')
  return { PaymentRequestError }
})
vi.mock('@/lib/rental-transaction', async () => {
  const { RentalMutationError } = await import('@gb-locacoes/backend/rentals')
  return { RentalMutationError }
})
vi.mock('@/lib/drivers', () => ({
  createDriver: state.write,
  listDrivers: vi.fn(),
}))
vi.mock('@/lib/vehicles', async () => {
  const { VehicleError } = await import('@gb-locacoes/backend/operations')
  return { VehicleError, createVehicle: state.write, listVehicles: vi.fn() }
})
vi.mock('@/lib/logistics', () => ({ updateDelivery: state.write }))
vi.mock('@/lib/maintenance-http', () => ({
  createMaintenance: state.write,
  listMaintenances: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/operations', () => ({
  createDriver: state.write,
  listDrivers: vi.fn(),
  createVehicle: state.write,
  listVehicles: vi.fn(),
  updateDelivery: state.write,
}))
vi.mock('../../apps/services/api/src/host/maintenance', () => ({
  createMaintenance: state.write,
  listMaintenances: vi.fn(),
}))
import { POST as legacyPix } from '../../app/api/payments/pix/route'
import { POST as apiPix } from '../../apps/services/api/src/app/api/payments/pix/route'
import { POST as legacyBoleto } from '../../app/api/payments/boleto/generate/route'
import { POST as apiBoleto } from '../../apps/services/api/src/app/api/payments/boleto/generate/route'
import { POST as legacyDriver } from '../../app/api/admin/drivers/route'
import { POST as apiDriver } from '../../apps/services/api/src/app/api/admin/drivers/route'
import { POST as legacyVehicle } from '../../app/api/admin/vehicles/route'
import { POST as apiVehicle } from '../../apps/services/api/src/app/api/admin/vehicles/route'
import { PATCH as legacyDelivery } from '../../app/api/admin/logistics/[id]/route'
import { PATCH as apiDelivery } from '../../apps/services/api/src/app/api/admin/logistics/[id]/route'
import { POST as legacyMaintenance } from '../../app/api/admin/maintenance/route'
import { POST as apiMaintenance } from '../../apps/services/api/src/app/api/admin/maintenance/route'

const principal = {
  tenantId: 'tenant-alfa',
  userId: 'owner',
  membershipId: 'member',
  role: 'ADMIN',
}
const cases = [
  [
    'legacy PIX',
    legacyPix,
    '/api/payments/pix',
    { rentalId: 'rental', amount: 10, dueDate: '2026-10-10' },
    true,
  ],
  [
    'API PIX',
    apiPix,
    '/api/payments/pix',
    { rentalId: 'rental', amount: 10, dueDate: '2026-10-10' },
    true,
  ],
  [
    'legacy boleto',
    legacyBoleto,
    '/api/payments/boleto/generate',
    { rentalId: 'rental', amount: 10, dueDate: '2026-10-10' },
    true,
  ],
  [
    'API boleto',
    apiBoleto,
    '/api/payments/boleto/generate',
    { rentalId: 'rental', amount: 10, dueDate: '2026-10-10' },
    true,
  ],
  [
    'legacy driver',
    legacyDriver,
    '/api/admin/drivers',
    { name: 'Fixture', phone: '00000000000' },
    false,
  ],
  [
    'API driver',
    apiDriver,
    '/api/admin/drivers',
    { name: 'Fixture', phone: '00000000000' },
    false,
  ],
  [
    'legacy vehicle',
    legacyVehicle,
    '/api/admin/vehicles',
    { plate: 'FIXTURE' },
    false,
  ],
  [
    'API vehicle',
    apiVehicle,
    '/api/admin/vehicles',
    { plate: 'FIXTURE' },
    false,
  ],
  [
    'legacy delivery',
    legacyDelivery,
    '/api/admin/logistics/one',
    { status: 'COMPLETED' },
    false,
  ],
  [
    'API delivery',
    apiDelivery,
    '/api/admin/logistics/one',
    { status: 'COMPLETED' },
    false,
  ],
  [
    'legacy maintenance',
    legacyMaintenance,
    '/api/admin/maintenance',
    { equipmentId: 'one', type: 'INSPECTION', scheduledAt: '2026-10-10' },
    false,
  ],
  [
    'API maintenance',
    apiMaintenance,
    '/api/admin/maintenance',
    { equipmentId: 'one', type: 'INSPECTION', scheduledAt: '2026-10-10' },
    false,
  ],
] as const
beforeEach(() => {
  vi.resetAllMocks()
  state.access.mockResolvedValue({ ok: true, principal })
})
describe.each(cases)(
  '%s commercial error transport',
  (_label, handler, path, body, billing) => {
    const run = () =>
      handler(
        new NextRequest('http://localhost' + path, {
          method: path.includes('/logistics/') ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: 'one' }) }
      )
    it.each([
      [402, 'SUBSCRIPTION_RESTRICTED'],
      [403, 'TENANT_ARCHIVED'],
    ] as const)(
      'keeps status %s, exact code and private cache after transactional denial',
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
      }
    )
    if (!path.endsWith('/drivers'))
      it('preserves legacy domain error body/cache when there is no subscription policy envelope', async () => {
        state.write.mockRejectedValue(
          billing
            ? new PaymentRequestError(409, 'Existing failure')
            : path.endsWith('/vehicles')
              ? new VehicleError('Existing failure')
              : new RentalMutationError('Existing failure', 409)
        )
        const response = await run()
        expect(response.status).toBe(path.endsWith('/vehicles') ? 400 : 409)
        expect(await response.json()).toEqual({ error: 'Existing failure' })
        expect(response.headers.get('Cache-Control')).toBeNull()
      })
    it('authorization refusal still precedes the command', async () => {
      state.access.mockResolvedValue({
        ok: false,
        response: Response.json({ error: 'Forbidden' }, { status: 403 }),
      })
      expect((await run()).status).toBe(403)
      expect(state.write).not.toHaveBeenCalled()
    })
  }
)
