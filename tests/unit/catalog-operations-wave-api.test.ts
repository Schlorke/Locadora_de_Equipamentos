import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CatalogError } from '@gb-locacoes/backend/catalog'
import { VehicleError } from '@gb-locacoes/backend/operations'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

const state = vi.hoisted(() => ({
  permission: vi.fn(),
  principal: vi.fn(),
  updateEquipment: vi.fn(),
  deleteEquipment: vi.fn(),
  listVehicles: vi.fn(),
  createVehicle: vi.fn(),
  listDeliveries: vi.fn(),
  createDelivery: vi.fn(),
  updateDelivery: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('../../apps/services/api/src/host/catalog', () => ({
  readEquipment: vi.fn(),
  updateEquipment: state.updateEquipment,
  deleteEquipment: state.deleteEquipment,
}))
vi.mock('../../apps/services/api/src/host/operations', () => ({
  listVehicles: state.listVehicles,
  createVehicle: state.createVehicle,
  listDeliveries: state.listDeliveries,
  createDelivery: state.createDelivery,
  updateDelivery: state.updateDelivery,
}))
import {
  PUT as apiEquipmentPUT,
  DELETE as apiEquipmentDELETE,
} from '../../apps/services/api/src/app/api/admin/equipments/[id]/route'
import {
  GET as apiVehiclesGET,
  POST as apiVehiclesPOST,
} from '../../apps/services/api/src/app/api/admin/vehicles/route'
import {
  GET as apiDeliveriesGET,
  POST as apiDeliveriesPOST,
} from '../../apps/services/api/src/app/api/admin/logistics/route'
import { PATCH as apiDeliveryPATCH } from '../../apps/services/api/src/app/api/admin/logistics/[id]/route'

const principal = {
  tenantId: 'tenant',
  userId: 'user',
  membershipId: 'member',
  role: 'ADMIN',
}
const input = {
  name: ' Equipment ',
  description: 'Description',
  pricePerDay: '12.5suffix',
  categoryId: 'category',
  plate: ' Plate ',
  rentalId: 'rental',
  type: 'DELIVERY',
  scheduledAt: '2026-12-01T10:00:00Z',
  address: {
    street: 'Rua',
    number: '1',
    neighborhood: 'Bairro',
    city: 'Cidade',
    state: 'SP',
    zipCode: '01001000',
  },
  distance: 0,
  notes: '',
  extra: true,
}
const cases = [
  {
    method: 'PUT',
    path: 'equipments',
    use: 'updateEquipment',
    handlers: [apiEquipmentPUT],
    action: 'WRITE',
    module: 'EQUIPMENTS',
    body: true,
    detail: true,
    envelope: null,
    status: 200,
  },
  {
    method: 'DELETE',
    path: 'equipments',
    use: 'deleteEquipment',
    handlers: [apiEquipmentDELETE],
    action: 'DELETE',
    module: 'EQUIPMENTS',
    body: false,
    detail: true,
    envelope: 'delete',
    status: 200,
  },
  {
    method: 'GET',
    path: 'vehicles',
    use: 'listVehicles',
    handlers: [apiVehiclesGET],
    action: 'READ',
    module: 'LOGISTICS',
    body: false,
    detail: false,
    envelope: 'vehicles',
    status: 200,
  },
  {
    method: 'POST',
    path: 'vehicles',
    use: 'createVehicle',
    handlers: [apiVehiclesPOST],
    action: 'WRITE',
    module: 'LOGISTICS',
    body: true,
    detail: false,
    envelope: 'vehicle',
    status: 201,
  },
  {
    method: 'GET',
    path: 'logistics',
    use: 'listDeliveries',
    handlers: [apiDeliveriesGET],
    action: null,
    module: null,
    body: false,
    detail: false,
    envelope: 'deliveries',
    status: 200,
  },
  {
    method: 'POST',
    path: 'logistics',
    use: 'createDelivery',
    handlers: [apiDeliveriesPOST],
    action: null,
    module: null,
    body: true,
    detail: false,
    envelope: 'delivery',
    status: 201,
  },
  {
    method: 'PATCH',
    path: 'logistics',
    use: 'updateDelivery',
    handlers: [apiDeliveryPATCH],
    action: null,
    module: null,
    body: true,
    detail: true,
    envelope: 'delivery',
    status: 200,
  },
] as const
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  state.permission.mockResolvedValue({ ok: true, principal })
  state.principal.mockResolvedValue({ ok: true, principal })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => vi.unstubAllEnvs())

for (const entry of cases) {
  describe.each(
    entry.handlers.map(
      (handler, index) => [index ? 'service' : 'legacy', handler] as const
    )
  )(`%s ${entry.method} ${entry.path}`, (_host, handler) => {
    const request = (raw?: string) =>
      new NextRequest(
        `https://app.platform.test/api/admin/${entry.path}${entry.detail ? '/own' : ''}?status=AVAILABLE&type=TRUCK&startDate=2026-01-01&endDate=2027-01-01&tenantId=forged`,
        {
          method: entry.method,
          ...(entry.method !== 'GET'
            ? {
                body:
                  raw ??
                  JSON.stringify(
                    entry.path === 'vehicles'
                      ? { ...input, type: 'TRUCK' }
                      : input
                  ),
                headers: { 'Content-Type': 'application/json' },
              }
            : {}),
        }
      )
    const run = (incoming = request()) =>
      handler(incoming, { params: Promise.resolve({ id: 'own' }) })
    it.each([401, 400, 403, 409, 503])(
      'refusal %s precedes body and use case',
      async (status) => {
        const refusal = Response.json(
          { error: 'Fixture refusal' },
          { status, headers: { 'Cache-Control': 'no-store' } }
        )
        state.permission.mockResolvedValue({ ok: false, response: refusal })
        state.principal.mockResolvedValue({ ok: false, response: refusal })
        const incoming = request('{')
        const body = vi.spyOn(incoming, 'json')
        expect(await run(incoming)).toBe(refusal)
        expect(body).not.toHaveBeenCalled()
        expect(state[entry.use]).not.toHaveBeenCalled()
      }
    )
    it('forwards only the authorized principal, exact permission, id and deferred parsed input', async () => {
      const dto = { id: 'fixture', tenantId: principal.tenantId }
      const use = state[entry.use]
      use.mockImplementation(async (...args: unknown[]) => {
        const deferred = args.at(-1)
        if (typeof deferred === 'function') await deferred()
        return dto
      })
      const response = await run()
      expect(response.status).toBe(entry.status)
      expect(use).toHaveBeenCalledTimes(1)
      expect(use.mock.calls[0]![0]).toEqual(principal)
      if (entry.detail) expect(use.mock.calls[0]![1]).toBe('own')
      if (entry.action)
        expect(state.permission).toHaveBeenCalledWith(
          expect.any(NextRequest),
          entry.module,
          entry.action
        )
      else expect(state.principal).toHaveBeenCalledWith(expect.any(NextRequest))
      expect(await response.json()).toEqual(
        entry.envelope === 'delete'
          ? { message: 'Equipamento removido com sucesso' }
          : entry.envelope
            ? { [entry.envelope]: dto }
            : dto
      )
      expect(response.headers.get('set-cookie')).toBeNull()
    })
    it('production failures do not expose private errors', async () => {
      state[entry.use].mockRejectedValue(
        new Error('private fixture database details')
      )
      const response = await run()
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('private fixture')
    })
    if (!entry.action)
      it.each(['OPERATOR', 'FINANCIAL', 'CLIENT'])(
        'logistics requires ADMIN membership, not %s',
        async (role) => {
          state.principal.mockResolvedValue({
            ok: true,
            principal: { ...principal, role },
          })
          const response = await run(request('{'))
          expect(response.status).toBe(403)
          expect(await response.json()).toEqual({ error: 'Forbidden' })
          expect(state[entry.use]).not.toHaveBeenCalled()
        }
      )
    if (entry.body)
      it('malformed JSON retains the generic 500 boundary', async () => {
        state[entry.use].mockImplementation(async (...args: unknown[]) => {
          const deferred = args.at(-1)
          if (typeof deferred === 'function') return deferred()
        })
        const response = await run(request('{'))
        expect(response.status).toBe(500)
      })
    if (entry.path === 'equipments')
      it('domain errors preserve their status/message', async () => {
        state[entry.use].mockRejectedValue(
          new CatalogError('Fixture domain', 404)
        )
        const response = await run()
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Fixture domain' })
      })
    if (entry.method === 'PUT')
      it('development keeps error details while production hides them', async () => {
        vi.stubEnv('NODE_ENV', 'development')
        state.updateEquipment.mockRejectedValue(
          new Error('Fixture development details')
        )
        expect(await (await run()).json()).toEqual({
          error: 'Fixture development details',
          details: 'Fixture development details',
        })
      })
    if (entry.path === 'vehicles' && entry.method === 'POST')
      it('duplicate plate stays a domain 400', async () => {
        state.createVehicle.mockRejectedValue(
          new VehicleError('Placa já cadastrada')
        )
        const response = await run()
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Placa já cadastrada' })
      })
    if (entry.path === 'logistics')
      it('foreign delivery resources retain neutral 404', async () => {
        state[entry.use].mockRejectedValue(
          new RentalMutationError('Veículo não encontrado', 404)
        )
        const response = await run()
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Veículo não encontrado',
        })
      })
  })
}
