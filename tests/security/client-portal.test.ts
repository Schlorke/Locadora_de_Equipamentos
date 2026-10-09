import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  })
  return {
    principal: {
      userId: 'client-A',
      tenantId: 'tenant-A',
      membershipId: 'member-A',
      role: 'CLIENT',
    },
    denied: 0,
    scope: vi.fn(),
    tx: {
      notification: model(),
      rentals: model(),
      quote: model(),
      payment: model(),
      clientProfile: model(),
      membership: model(),
      organization: model(),
      auditLog: model(),
      user: model(),
      $executeRaw: vi.fn(),
    },
  }
})
vi.mock('@/lib/tenant', () => ({
  resolveTenantPrincipal: async () =>
    mocks.denied
      ? { ok: false, response: Response.json({}, { status: mocks.denied }) }
      : { ok: true, principal: mocks.principal },
  withTenantTransaction: async (
    context: unknown,
    callback: (_tx: unknown) => unknown
  ) => {
    mocks.scope(context)
    return callback(mocks.tx)
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/middlewares/require-admin', () => ({
  requireAdmin: async () =>
    mocks.denied || mocks.principal.role !== 'ADMIN'
      ? { success: false, error: 'Forbidden', status: mocks.denied || 403 }
      : { success: true, principal: mocks.principal },
}))
import { createAdminNotifications } from '@/lib/notification-service'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: {} }),
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
          : { ok: true, principal: mocks.principal },
      withTenantTransaction: async (
        context: unknown,
        callback: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return callback(mocks.tx)
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
          : { ok: true, principal: mocks.principal },
      withTenantTransaction: async (
        context: unknown,
        callback: (_tx: unknown) => unknown
      ) => {
        mocks.scope(context)
        return callback(mocks.tx)
      },
    }))()),
  })
)
// As composições do serviço abrem a transação da locadora direto no backend (`withTenantTransaction` com o banco do
// runtime): o mesmo dublê de escopo e de transação da fachada legada atende esse caminho.
vi.mock('@gb-locacoes/backend/identity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/identity')>()),
  withTenantTransaction: async (
    _database: unknown,
    context: unknown,
    callback: (_tx: unknown) => unknown
  ) => {
    mocks.scope(context)
    return callback(mocks.tx)
  },
}))
import * as legacyRoute0 from '@/app/api/client/rentals/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/client/rentals/route'
import * as legacyRoute1 from '@/app/api/client/rentals/[id]/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/client/rentals/[id]/route'
import * as legacyRoute2 from '@/app/api/client/rentals/[id]/request-pickup/route'
import * as serviceRoute2 from '../../apps/services/api/src/app/api/client/rentals/[id]/request-pickup/route'
import * as legacyRoute3 from '@/app/api/client/rentals/[id]/request-extension/route'
import * as serviceRoute3 from '../../apps/services/api/src/app/api/client/rentals/[id]/request-extension/route'
import * as legacyRoute4 from '@/app/api/client/notifications/route'
import * as serviceRoute4 from '../../apps/services/api/src/app/api/client/notifications/route'
import * as legacyRoute5 from '@/app/api/client/notifications/stats/route'
import * as serviceRoute5 from '../../apps/services/api/src/app/api/client/notifications/stats/route'
import * as legacyRoute6 from '@/app/api/client/notifications/mark-all-read/route'
import * as serviceRoute6 from '../../apps/services/api/src/app/api/client/notifications/mark-all-read/route'
import * as legacyRoute7 from '@/app/api/client/notifications/[id]/route'
import * as serviceRoute7 from '../../apps/services/api/src/app/api/client/notifications/[id]/route'
import * as legacyRoute8 from '@/app/api/client/activities/route'
import * as serviceRoute8 from '../../apps/services/api/src/app/api/client/activities/route'
import * as legacyRoute9 from '@/app/api/user/profile/route'
import * as serviceRoute9 from '../../apps/services/api/src/app/api/user/profile/route'
import * as legacyRoute10 from '@/app/api/quotes/[id]/route'
import * as serviceRoute10 from '../../apps/services/api/src/app/api/quotes/[id]/route'
import * as legacyRoute11 from '@/app/api/quotes/[id]/download/route'
import * as serviceRoute11 from '../../apps/services/api/src/app/api/quotes/[id]/download/route'
import * as legacyRoute12 from '@/app/api/admin/notifications/sync/route'
import * as serviceRoute12 from '../../apps/services/api/src/app/api/admin/notifications/sync/route'

const HOSTS = [
  [
    'legacy root',
    {
      listRentals: legacyRoute0.GET,
      readRental: legacyRoute1.GET,
      deleteRental: legacyRoute1.DELETE,
      pickup: legacyRoute2.POST,
      extension: legacyRoute3.POST,
      listNotifications: legacyRoute4.GET,
      notificationStats: legacyRoute5.GET,
      markAll: legacyRoute6.POST,
      markOne: legacyRoute7.PATCH,
      deleteNotification: legacyRoute7.DELETE,
      activities: legacyRoute8.GET,
      getProfile: legacyRoute9.GET,
      putProfile: legacyRoute9.PUT,
      readQuote: legacyRoute10.GET,
      deleteQuote: legacyRoute10.DELETE,
      downloadQuote: legacyRoute11.GET,
      syncNotifications: legacyRoute12.POST,
    },
  ],
  [
    'service',
    {
      listRentals: serviceRoute0.GET,
      readRental: serviceRoute1.GET,
      deleteRental: serviceRoute1.DELETE,
      pickup: serviceRoute2.POST,
      extension: serviceRoute3.POST,
      listNotifications: serviceRoute4.GET,
      notificationStats: serviceRoute5.GET,
      markAll: serviceRoute6.POST,
      markOne: serviceRoute7.PATCH,
      deleteNotification: serviceRoute7.DELETE,
      activities: serviceRoute8.GET,
      getProfile: serviceRoute9.GET,
      putProfile: serviceRoute9.PUT,
      readQuote: serviceRoute10.GET,
      deleteQuote: serviceRoute10.DELETE,
      downloadQuote: serviceRoute11.GET,
      syncNotifications: serviceRoute12.POST,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      listRentals,
      readRental,
      deleteRental,
      pickup,
      extension,
      listNotifications,
      notificationStats,
      markAll,
      markOne,
      deleteNotification,
      activities,
      getProfile,
      putProfile,
      readQuote,
      deleteQuote,
      downloadQuote,
      syncNotifications,
    }
  ) => {
    const request = (body?: unknown, query = '') =>
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
    const params = (id = 'row-A') => ({ params: Promise.resolve({ id }) })
    const handlers = [
      ['list rentals', () => listRentals(request())],
      ['read rental', () => readRental(request(), params())],
      ['delete rental', () => deleteRental(request(), params())],
      ['pickup', () => pickup(request(), params())],
      ['extension', () => extension(request({ additionalDays: 2 }), params())],
      ['list notifications', () => listNotifications(request())],
      ['stats', () => notificationStats(request())],
      ['mark all', () => markAll(request())],
      ['mark one', () => markOne(request(), params())],
      ['delete notification', () => deleteNotification(request(), params())],
      ['activities', () => activities(request())],
      ['get profile', () => getProfile(request())],
      ['put profile', () => putProfile(request({ phone: '11999999999' }))],
      ['read quote', () => readQuote(request(), params())],
      ['delete quote', () => deleteQuote(request(), params())],
      ['download', () => downloadQuote(request(), params())],
      ['sync', () => syncNotifications()],
    ] as const
    const details = [
      ['rental', readRental],
      ['rental removal', deleteRental],
      ['quote', readQuote],
      ['quote removal', deleteQuote],
      ['download', downloadQuote],
      ['notification read', markOne],
      ['notification removal', deleteNotification],
      ['pickup', pickup],
    ] as const
    const profile = {
      userId: 'client-A',
      name: 'Cliente da A',
      email: 'tenant-a@example.test',
      phone: null,
      document: '12345678901',
      company: null,
    }
    beforeEach(() => {
      vi.resetAllMocks()
      mocks.denied = 0
      mocks.principal = {
        userId: 'client-A',
        tenantId: 'tenant-A',
        membershipId: 'member-A',
        role: 'CLIENT',
      }
      for (const model of [
        mocks.tx.notification,
        mocks.tx.rentals,
        mocks.tx.quote,
        mocks.tx.payment,
        mocks.tx.membership,
      ]) {
        model.findMany.mockResolvedValue([])
        model.findFirst.mockResolvedValue(null)
        model.count.mockResolvedValue(0)
        model.groupBy.mockResolvedValue([])
        model.updateMany.mockResolvedValue({ count: 1 })
        model.createMany.mockResolvedValue({ count: 1 })
      }
      mocks.tx.organization.findUnique.mockResolvedValue({ status: 'ACTIVE' })
      mocks.tx.clientProfile.findUnique.mockResolvedValue(profile)
      mocks.tx.clientProfile.update.mockImplementation(async ({ data }) => ({
        ...profile,
        ...data,
      }))
      mocks.tx.auditLog.findFirst.mockResolvedValue(null)
      mocks.tx.auditLog.create.mockResolvedValue({ id: 'request-A' })
    })
    describe('client portal HTTP tenant boundary', () => {
      it.each(handlers)(
        'rejects anonymous %s before data access',
        async (_name, call) => {
          mocks.denied = 401
          expect((await call()).status).toBe(401)
          expect(mocks.scope).not.toHaveBeenCalled()
        }
      )
      it.each([403, 409])(
        'preserves membership or selection rejection %i',
        async (status) => {
          mocks.denied = status
          expect((await getProfile(request())).status).toBe(status)
          expect((await listRentals(request())).status).toBe(status)
          expect((await markAll(request())).status).toBe(status)
          expect(mocks.scope).not.toHaveBeenCalled()
        }
      )
      it.each(details)(
        'hides foreign tenant or owner for %s',
        async (_name, handler) => {
          expect(
            (await handler(request(), params('other-record'))).status
          ).toBe(404)
          const calls = [
            mocks.tx.rentals,
            mocks.tx.quote,
            mocks.tx.notification,
          ].flatMap((model) => model.findFirst.mock.calls)
          expect(calls).toHaveLength(1)
          expect(calls[0]![0].where).toMatchObject({
            tenantId: 'tenant-A',
            id: 'other-record',
          })
          expect(calls[0]![0].where.userId || calls[0]![0].where.userid).toBe(
            'client-A'
          )
          for (const model of [
            mocks.tx.notification,
            mocks.tx.rentals,
            mocks.tx.quote,
          ]) {
            expect(model.update).not.toHaveBeenCalled()
            expect(model.delete).not.toHaveBeenCalled()
          }
        }
      )
      it('hides foreign extension targets before writes', async () => {
        expect(
          (await extension(request({ additionalDays: 2 }), params('other')))
            .status
        ).toBe(404)
        expect(mocks.tx.auditLog.create).not.toHaveBeenCalled()
      })
      it('scopes rentals, quotes and activities to tenant and owner', async () => {
        expect((await listRentals(request())).status).toBe(200)
        expect((await activities(request())).status).toBe(200)
        for (const [arg] of mocks.tx.rentals.findMany.mock.calls)
          expect(arg.where).toMatchObject({
            tenantId: 'tenant-A',
            userid: 'client-A',
            clientDeletedAt: null,
          })
        expect(mocks.tx.quote.findMany.mock.calls[0]![0].where).toMatchObject({
          tenantId: 'tenant-A',
          userId: 'client-A',
          clientDeletedAt: null,
        })
        expect(mocks.tx.payment.findMany.mock.calls[0]![0].where).toMatchObject(
          {
            tenantId: 'tenant-A',
            rental: { userid: 'client-A' },
          }
        )
      })
      it('bounds activity pagination before queries', async () => {
        expect(
          (await activities(request(undefined, '?limit=500000'))).status
        ).toBe(400)
        expect(mocks.tx.quote.findMany).not.toHaveBeenCalled()
      })
      it('scopes notification list, counters and bulk writes to tenant and recipient', async () => {
        await listNotifications(request())
        await notificationStats(request())
        await markAll(request())
        for (const method of [
          'findMany',
          'count',
          'groupBy',
          'updateMany',
        ] as const)
          for (const [arg] of mocks.tx.notification[method].mock.calls)
            expect(arg.where).toMatchObject({
              tenantId: 'tenant-A',
              userId: 'client-A',
            })
      })
      it('retains ownership inside SQL mutations', async () => {
        mocks.tx.notification.findFirst.mockResolvedValue({ id: 'row-A' })
        mocks.tx.notification.update.mockResolvedValue({
          id: 'row-A',
          isRead: true,
        })
        await markOne(request(), params())
        await deleteNotification(request(), params())
        for (const method of ['update', 'delete'] as const)
          expect(mocks.tx.notification[method].mock.calls[0]![0].where).toEqual(
            {
              id: 'row-A',
              tenantId: 'tenant-A',
              userId: 'client-A',
            }
          )
      })
      it('preserves administrative history via client soft deletion', async () => {
        mocks.tx.rentals.findFirst.mockResolvedValue({ id: 'row-A' })
        mocks.tx.quote.findFirst.mockResolvedValue({ id: 'row-A' })
        await deleteRental(request(), params())
        await deleteQuote(request(), params())
        expect(mocks.tx.rentals.update.mock.calls[0]![0]).toMatchObject({
          where: { tenantId: 'tenant-A', userid: 'client-A' },
          data: { clientDeletedAt: expect.any(Date) },
        })
        expect(mocks.tx.quote.update.mock.calls[0]![0]).toMatchObject({
          where: { tenantId: 'tenant-A', userId: 'client-A' },
          data: { clientDeletedAt: expect.any(Date) },
        })
        expect(mocks.tx.rentals.delete).not.toHaveBeenCalled()
        expect(mocks.tx.quote.delete).not.toHaveBeenCalled()
      })
      it('keeps separate business profiles for the same global identity', async () => {
        await putProfile(
          request({ phone: '(11) 99999-9999', company: 'Empresa A' })
        )
        mocks.principal.tenantId = 'tenant-B'
        await getProfile(request())
        expect(mocks.tx.clientProfile.update.mock.calls[0]![0]).toMatchObject({
          where: {
            tenantId_userId: { tenantId: 'tenant-A', userId: 'client-A' },
          },
          data: { phone: '11999999999', company: 'Empresa A' },
        })
        expect(
          mocks.tx.clientProfile.findUnique.mock.lastCall![0].where
        ).toEqual({
          tenantId_userId: { tenantId: 'tenant-B', userId: 'client-A' },
        })
        expect(mocks.tx.user.update).not.toHaveBeenCalled()
      })
      it('does not fall back to a global legacy profile', async () => {
        mocks.tx.clientProfile.findUnique.mockResolvedValue(null)
        expect((await getProfile(request())).status).toBe(404)
        expect(
          (await putProfile(request({ phone: '11999999999' }))).status
        ).toBe(404)
        expect(mocks.tx.clientProfile.update).not.toHaveBeenCalled()
      })
      it.each([
        { cpf: '1' },
        { cpf: '12345678901', cnpj: '12345678901234' },
        { role: 'ADMIN' },
        { tenantId: 'tenant-B' },
      ])('rejects privileged or invalid profile payload %j', async (data) => {
        expect((await putProfile(request(data))).status).toBe(400)
        expect(mocks.tx.clientProfile.update).not.toHaveBeenCalled()
      })
    })
    describe('durable client requests and tenant admin fanout', () => {
      const active = () =>
        mocks.tx.rentals.findFirst.mockResolvedValue({
          id: 'row-A',
          status: 'ACTIVE',
          enddate: new Date('2027-01-01'),
          rental_items: [{ priceperday: 10, quantity: 2 }],
        })
      it('records pickup and alerts active admins only in the current tenant', async () => {
        active()
        mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin-A' }])
        const response = await pickup(request(), params())
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          success: true,
          requestId: 'request-A',
        })
        expect(
          mocks.tx.membership.findMany.mock.calls[0]![0].where
        ).toMatchObject({
          tenantId: 'tenant-A',
          role: 'ADMIN',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        })
        expect(
          mocks.tx.notification.createMany.mock.calls[0]![0].data[0]
        ).toMatchObject({ tenantId: 'tenant-A', userId: 'admin-A' })
        expect(mocks.tx.auditLog.create.mock.calls[0]![0].data).toMatchObject({
          tenantId: 'tenant-A',
          userId: 'client-A',
          entityId: 'row-A',
        })
        expect(mocks.tx.rentals.update).not.toHaveBeenCalled()
      })
      it('records extension estimate without changing rental dates or status', async () => {
        active()
        mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin-A' }])
        const response = await extension(
          request({ additionalDays: 3 }),
          params()
        )
        expect(await response.json()).toMatchObject({
          estimatedFee: 60,
          additionalDays: 3,
        })
        expect(mocks.tx.rentals.update).not.toHaveBeenCalled()
      })
      it('reuses a persisted request on retry', async () => {
        active()
        mocks.tx.auditLog.findFirst.mockResolvedValue({ id: 'existing' })
        expect(await (await pickup(request(), params())).json()).toMatchObject({
          requestId: 'existing',
          duplicate: true,
        })
        expect(mocks.tx.notification.createMany).not.toHaveBeenCalled()
      })
      it('does not falsely acknowledge missing support membership', async () => {
        active()
        expect((await pickup(request(), params())).status).toBe(503)
        expect(mocks.tx.auditLog.create).not.toHaveBeenCalled()
      })
      it('does not acknowledge a failed alert write', async () => {
        active()
        mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin-A' }])
        mocks.tx.notification.createMany.mockRejectedValue(
          new Error('Database unavailable')
        )
        expect((await pickup(request(), params())).status).toBe(500)
      })
      it('filters supplied admin IDs through active tenant membership', async () => {
        mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin-A' }])
        await createAdminNotifications(
          { tenantId: 'tenant-A' },
          {
            type: 'SYSTEM',
            title: 'Notice',
            message: 'Notice',
            adminIds: ['admin-A', 'foreign-admin'],
            dedupeKey: 'notice',
          }
        )
        expect(
          mocks.tx.membership.findMany.mock.calls[0]![0].where
        ).toMatchObject({
          tenantId: 'tenant-A',
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        expect(mocks.tx.user.findMany).not.toHaveBeenCalled()
        expect(
          mocks.tx.notification.createMany.mock.calls[0]![0].data.map(
            (row: { userId: string }) => row.userId
          )
        ).toEqual(['admin-A'])
        expect(
          mocks.tx.notification.findMany.mock.calls[0]![0].where
        ).toMatchObject({ tenantId: 'tenant-A', userId: { in: ['admin-A'] } })
      })
      it('scopes every admin sync query to tenant', async () => {
        mocks.principal.role = 'ADMIN'
        mocks.tx.membership.findMany.mockResolvedValue([{ userId: 'admin-A' }])
        expect((await syncNotifications()).status).toBe(200)
        for (const model of [mocks.tx.quote, mocks.tx.rentals])
          for (const [arg] of model.findMany.mock.calls)
            expect(arg.where.tenantId).toBe('tenant-A')
      })
    })
  }
)
