const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return {
    prisma: {
      $transaction: async (operation: (_tx: unknown) => unknown) =>
        operation({
          ...mocks.tx,
          $queryRaw: async (_sql: TemplateStringsArray, tenantId: string) => {
            mocks.scope({ tenantId })
            return []
          },
        }),
    },
  }
}
import { NextRequest } from 'next/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  })
  return {
    role: 'ADMIN',
    denied: 0,
    scope: vi.fn(),
    send: vi.fn(),
    credential: vi.fn(),
    fetch: vi.fn(),
    tx: {
      organization: model(),
      equipment: model(),
      driver: model(),
      vehicle: model(),
      rentals: model(),
      rental_items: model(),
      delivery: model(),
      maintenance: model(),
      auditLog: model(),
      clientProfile: model(),
      tenantIntegration: model(),
      $executeRaw: vi.fn(),
    },
  }
})

// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({
      prisma: {
        $transaction: async (operation: (_tx: unknown) => unknown) =>
          operation({
            ...mocks.tx,
            $queryRaw: async (_sql: TemplateStringsArray, tenantId: string) => {
              mocks.scope({ tenantId })
              return []
            },
          }),
      },
    }),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
vi.mock('@gb-locacoes/backend/communications', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@gb-locacoes/backend/communications')
  >()),
  ...(await (async () => {
    const F = await (() => ({ sendTextMessage: mocks.send }))()
    return { createWhatsAppClient: () => F }
  })()),
}))
vi.mock(
  '../../apps/services/api/src/host/private-identity',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/private-identity')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: async () =>
        mocks.denied
          ? { ok: false, response: Response.json({}, { status: mocks.denied }) }
          : {
              ok: true,
              principal: {
                tenantId: 'tenant-A',
                userId: 'admin-A',
                membershipId: 'member-A',
                role: mocks.role,
              },
            },
      withTenantTransaction: async (
        context: unknown,
        operation: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return operation(mocks.tx)
      },
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      resolveTenantPrincipal: async () =>
        mocks.denied
          ? { ok: false, response: Response.json({}, { status: mocks.denied }) }
          : {
              ok: true,
              principal: {
                tenantId: 'tenant-A',
                userId: 'admin-A',
                membershipId: 'member-A',
                role: mocks.role,
              },
            },
      withTenantTransaction: async (
        context: unknown,
        operation: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return operation(mocks.tx)
      },
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/webhook-authentication',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/webhook-authentication')
    >()),
    ...(await (() => ({
      resolveIntegrationCredential: mocks.credential,
    }))()),
  })
)

import * as serviceRoute0 from '../../apps/services/api/src/app/api/admin/drivers/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/admin/logistics/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/admin/logistics/[id]/route'

import * as serviceRoute3 from '../../apps/services/api/src/app/api/admin/maintenance/route'

import * as serviceRoute4 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/route'

import * as serviceRoute5 from '../../apps/services/api/src/app/api/admin/maintenance/[id]/complete/route'

import * as serviceRoute6 from '../../apps/services/api/src/app/api/admin/maintenance/scheduled/route'

import * as serviceRoute7 from '../../apps/services/api/src/app/api/admin/maintenance/preventive-schedule/route'

import * as serviceRoute8 from '../../apps/services/api/src/app/api/admin/audit-logs/route'

import * as serviceRoute9 from '../../apps/services/api/src/app/api/integrations/whatsapp/send/route'

import * as serviceRoute10 from '../../apps/services/api/src/app/api/integrations/melhor-envio/calculate/route'

import * as serviceRoute11 from '../../apps/services/api/src/app/api/admin/google-merchant/status/route'

import * as serviceRoute12 from '../../apps/services/api/src/app/api/admin/google-merchant/sync/route'

import * as serviceRoute13 from '../../apps/services/api/src/app/api/admin/google-merchant/products/[id]/route'

const HOSTS = [
  [
    'service',
    {
      drivers: serviceRoute0.GET,
      addDriver: serviceRoute0.POST,
      logistics: serviceRoute1.GET,
      addDelivery: serviceRoute1.POST,
      updateDelivery: serviceRoute2.PATCH,
      maintenances: serviceRoute3.GET,
      addMaintenance: serviceRoute3.POST,
      updateMaintenance: serviceRoute4.PATCH,
      completeMaintenance: serviceRoute5.POST,
      scheduled: serviceRoute6.GET,
      preventive: serviceRoute7.POST,
      audit: serviceRoute8.GET,
      whatsapp: serviceRoute9.POST,
      shipping: serviceRoute10.POST,
      merchantStatus: serviceRoute11.GET,
      merchantSync: serviceRoute12.POST,
      merchantProduct: serviceRoute13.POST,
      merchantDelete: serviceRoute13.DELETE,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      drivers,
      addDriver,
      logistics,
      addDelivery,
      updateDelivery,
      maintenances,
      addMaintenance,
      updateMaintenance,
      completeMaintenance,
      scheduled,
      preventive,
      audit,
      whatsapp,
      shipping,
      merchantStatus,
      merchantSync,
      merchantProduct,
      merchantDelete,
    }
  ) => {
    const params = { params: Promise.resolve({ id: 'foreign-id' }) }
    const request = (body?: object, query = '') =>
      new NextRequest(
        'https://test.invalid/api' + query,
        body
          ? {
              method: 'POST',
              body: JSON.stringify(body),
              headers: { 'content-type': 'application/json' },
            }
          : {}
      )
    const maintenanceBody = {
      equipmentId: 'equipment-A',
      type: 'CORRECTIVE',
      scheduledAt: '2026-12-01T10:00:00Z',
    }
    const deliveryBody = {
      rentalId: 'rental-A',
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
    }
    const shippingBody = {
      from: { postal_code: '01001000' },
      to: { postal_code: '01002000' },
      products: [
        { id: 'equipment-A', width: 10, height: 10, length: 10, weight: 1 },
      ],
    }
    const adminHandlers = [
      ['drivers', () => drivers(request())],
      [
        'create driver',
        () => addDriver(request({ name: 'Motorista', phone: '11999999999' })),
      ],
      ['logistics', () => logistics(request())],
      ['create delivery', () => addDelivery(request(deliveryBody))],
      [
        'update delivery',
        () => updateDelivery(request({ notes: 'Nota' }), params),
      ],
      ['maintenance', () => maintenances(request())],
      ['create maintenance', () => addMaintenance(request(maintenanceBody))],
      [
        'update maintenance',
        () => updateMaintenance(request({ notes: 'Nota' }), params),
      ],
      ['complete maintenance', () => completeMaintenance(request({}), params)],
      ['scheduled maintenance', () => scheduled(request())],
      [
        'preventive',
        () =>
          preventive(
            request({ equipmentId: 'equipment-A', rules: { daysInterval: 30 } })
          ),
      ],
      ['audit', () => audit(request())],
      [
        'whatsapp',
        () => whatsapp(request({ to: '5511999999999', message: 'Olá' })),
      ],
      ['merchant status', () => merchantStatus(request())],
      ['merchant sync', () => merchantSync(request())],
      ['merchant product', () => merchantProduct(request())],
      ['merchant deletion', () => merchantDelete(request())],
    ] as const
    beforeEach(() => {
      vi.resetAllMocks()
      mocks.role = 'ADMIN'
      mocks.denied = 0
      vi.stubGlobal('fetch', mocks.fetch)
      for (const model of Object.values(mocks.tx)) {
        if (typeof model !== 'object') continue
        model.findMany.mockResolvedValue([])
        model.findFirst.mockResolvedValue(null)
        model.findUnique.mockResolvedValue(null)
        model.count.mockResolvedValue(0)
      }
      mocks.tx.organization.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        postalCode: '01001000',
      })
      mocks.send.mockResolvedValue({ providerMessageId: 'confirmed-message' })
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })
    describe('operational API tenant ACL', () => {
      it.each([
        ...adminHandlers,
        ['shipping', () => shipping(request(shippingBody))],
      ] as const)(
        'rejects anonymous %s before data/provider effects',
        async (_name, call) => {
          mocks.denied = 401
          expect((await call()).status).toBe(401)
          expect(mocks.scope).not.toHaveBeenCalled()
          expect(mocks.fetch).not.toHaveBeenCalled()
          expect(mocks.send).not.toHaveBeenCalled()
        }
      )
      it.each(adminHandlers)(
        'denies financial membership for %s',
        async (_name, call) => {
          mocks.role = 'FINANCIAL'
          expect((await call()).status).toBe(403)
          expect(mocks.scope).not.toHaveBeenCalled()
          expect(mocks.fetch).not.toHaveBeenCalled()
        }
      )
      it('uses selected tenant on list queries and audit counters', async () => {
        for (const call of [drivers, logistics, maintenances, scheduled, audit])
          expect((await call(request())).status).toBe(200)
        for (const model of [
          mocks.tx.driver,
          mocks.tx.delivery,
          mocks.tx.maintenance,
          mocks.tx.auditLog,
        ])
          for (const [arg] of model.findMany.mock.calls)
            expect(arg.where.tenantId).toBe('tenant-A')
        expect(mocks.tx.auditLog.count.mock.calls[0]![0].where.tenantId).toBe(
          'tenant-A'
        )
      })
      it('ignores caller tenantId on driver creation', async () => {
        mocks.tx.driver.create.mockImplementation(async ({ data }) => data)
        expect(
          (
            await addDriver(
              request({
                name: 'Motorista',
                phone: '11999999999',
                tenantId: 'tenant-B',
              })
            )
          ).status
        ).toBe(201)
        expect(mocks.tx.driver.create.mock.calls[0]![0].data.tenantId).toBe(
          'tenant-A'
        )
      })
      it('does not create maintenance for a foreign equipment id', async () => {
        expect((await addMaintenance(request(maintenanceBody))).status).toBe(
          404
        )
        expect(
          mocks.tx.equipment.findUnique.mock.calls[0]![0].where
        ).toMatchObject({ tenantId: 'tenant-A', id: 'equipment-A' })
        expect(mocks.tx.maintenance.create).not.toHaveBeenCalled()
      })
      it.each([
        ['update', updateMaintenance],
        ['complete', completeMaintenance],
      ] as const)(
        'hides foreign maintenance before %s',
        async (_name, handler) => {
          expect((await handler(request({}), params)).status).toBe(404)
          expect(mocks.tx.maintenance.update).not.toHaveBeenCalled()
          expect(mocks.tx.equipment.update).not.toHaveBeenCalled()
        }
      )
      it('checks rental conflict in the same tenant transaction before starting maintenance', async () => {
        mocks.tx.maintenance.findFirst.mockResolvedValue({
          id: 'foreign-id',
          equipmentId: 'equipment-A',
        })
        mocks.tx.maintenance.findUnique.mockResolvedValue({
          equipmentId: 'equipment-A',
        })
        mocks.tx.rental_items.findFirst.mockResolvedValue({
          rentals: { id: 'rental-A' },
        })
        expect(
          (await updateMaintenance(request({ status: 'IN_PROGRESS' }), params))
            .status
        ).toBe(400)
        expect(
          mocks.tx.rental_items.findFirst.mock.calls[0]![0].where
        ).toMatchObject({ tenantId: 'tenant-A', equipmentid: 'equipment-A' })
        expect(mocks.tx.maintenance.update).not.toHaveBeenCalled()
      })
      it('completes maintenance and restores equipment availability within the same tenant', async () => {
        mocks.tx.maintenance.findUnique.mockResolvedValue({
          equipmentId: 'equipment-A',
        })
        mocks.tx.maintenance.update.mockResolvedValue({ id: 'maintenance-A' })
        expect(
          (await completeMaintenance(request({ hourMeter: 50 }), params)).status
        ).toBe(200)
        expect(
          mocks.tx.maintenance.update.mock.calls[0]![0].where
        ).toMatchObject({
          tenantId: 'tenant-A',
        })
        for (const [arg] of mocks.tx.equipment.update.mock.calls)
          expect(arg.where).toEqual({ tenantId: 'tenant-A', id: 'equipment-A' })
        expect(mocks.scope).toHaveBeenCalledTimes(1)
      })
      it('rejects a rental from another tenant before creating delivery', async () => {
        expect((await addDelivery(request(deliveryBody))).status).toBe(404)
        expect(mocks.tx.delivery.create).not.toHaveBeenCalled()
      })
      it.each(['driverId', 'vehicleId'] as const)(
        'rejects foreign %s assignment',
        async (field) => {
          mocks.tx.rentals.findUnique.mockResolvedValue({ id: 'rental-A' })
          expect(
            (
              await addDelivery(
                request({ ...deliveryBody, [field]: 'foreign' })
              )
            ).status
          ).toBe(404)
          expect(mocks.tx.delivery.create).not.toHaveBeenCalled()
          expect(
            mocks.tx[field === 'driverId' ? 'driver' : 'vehicle'].findFirst.mock
              .calls[0]![0].where
          ).toMatchObject({ tenantId: 'tenant-A', id: 'foreign' })
        }
      )
      it('hides foreign delivery before patching', async () => {
        expect(
          (await updateDelivery(request({ notes: 'test' }), params)).status
        ).toBe(404)
        expect(mocks.tx.delivery.update).not.toHaveBeenCalled()
      })
      it('projects logistics contact from tenant profile rather than global User', async () => {
        mocks.tx.delivery.findMany.mockResolvedValue([
          { id: 'delivery-A', rental: { userid: 'global-user' } },
        ])
        mocks.tx.clientProfile.findMany.mockResolvedValue([
          {
            userId: 'global-user',
            name: 'Cliente local',
            email: 'local@example.test',
            phone: 'local',
          },
        ])
        const result = await (await logistics(request())).json()
        expect(result.deliveries[0].rental.users.name).toBe('Cliente local')
        expect(
          mocks.tx.clientProfile.findMany.mock.calls[0]![0].where
        ).toMatchObject({
          tenantId: 'tenant-A',
          userId: { in: ['global-user'] },
        })
      })
    })
    describe('tenant-only external operations', () => {
      it('reuses the tenant WhatsApp transport and only returns a confirmed provider id', async () => {
        const response = await whatsapp(
          request({ to: '5511999999999', message: 'Olá' })
        )
        expect(await response.json()).toEqual({
          success: true,
          messageId: 'confirmed-message',
        })
        expect(mocks.send.mock.calls[0]![0]).toMatchObject({
          tenantId: 'tenant-A',
        })
      })
      it('does not return mock success when WhatsApp configuration is missing', async () => {
        vi.stubEnv('WHATSAPP_API_KEY', 'legacy-fixture')
        mocks.send.mockRejectedValue(
          new Error('WHATSAPP_INTEGRATION_UNAVAILABLE')
        )
        expect(
          (await whatsapp(request({ to: '5511999999999', message: 'Olá' })))
            .status
        ).toBe(503)
      })
      it.each([merchantStatus, merchantSync, merchantProduct, merchantDelete])(
        'keeps global Merchant credentials inaccessible until a tenant adapter exists',
        async (handler) => {
          vi.stubEnv('GOOGLE_MERCHANT_ID', 'legacy-fixture')
          expect((await handler(request())).status).toBe(503)
          expect(mocks.fetch).not.toHaveBeenCalled()
        }
      )
      function configuredShipping() {
        mocks.tx.equipment.count.mockResolvedValue(1)
        mocks.tx.tenantIntegration.findMany.mockResolvedValue([
          { credentialsRef: 'env:LOCADORA_INTEGRATION_A' },
        ])
        mocks.credential.mockResolvedValue({
          apiKey: 'test-api-key',
          environment: 'sandbox',
          userAgent: 'Fixture (support@example.test)',
        })
      }
      it('rejects unowned shipping product references before network', async () => {
        expect((await shipping(request(shippingBody))).status).toBe(404)
        expect(mocks.fetch).not.toHaveBeenCalled()
      })
      it('does not use the global shipping token or fabricated prices', async () => {
        vi.stubEnv('MELHOR_ENVIO_TOKEN', 'legacy-fixture')
        mocks.tx.equipment.count.mockResolvedValue(1)
        expect((await shipping(request(shippingBody))).status).toBe(503)
        expect(mocks.fetch).not.toHaveBeenCalled()
      })
      it('rejects a shipping origin different from organization configuration', async () => {
        configuredShipping()
        expect(
          (
            await shipping(
              request({ ...shippingBody, from: { postal_code: '99999999' } })
            )
          ).status
        ).toBe(400)
        expect(mocks.fetch).not.toHaveBeenCalled()
      })
      it('uses configured tenant credentials and provider custom prices', async () => {
        configuredShipping()
        mocks.fetch.mockResolvedValue(
          Response.json([
            {
              id: 1,
              name: 'Serviço',
              company: { name: 'Transportadora' },
              price: '12.00',
              custom_price: '10.00',
              delivery_time: 4,
              custom_delivery_time: 3,
            },
          ])
        )
        const response = await shipping(request(shippingBody))
        expect(response.status).toBe(200)
        expect((await response.json()).shippingOptions[0]).toMatchObject({
          price: 10,
          estimatedDays: 3,
        })
        expect(mocks.fetch.mock.calls[0]![0]).toBe(
          'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate'
        )
        expect(mocks.fetch.mock.calls[0]![1]).toMatchObject({
          redirect: 'error',
          signal: expect.any(AbortSignal),
          headers: { Authorization: 'Bearer test-api-key' },
        })
      })
      it('returns failure when provider fails instead of estimated success', async () => {
        configuredShipping()
        mocks.fetch.mockRejectedValue(new Error('Timeout'))
        expect((await shipping(request(shippingBody))).status).toBe(502)
      })
    })
  }
)
