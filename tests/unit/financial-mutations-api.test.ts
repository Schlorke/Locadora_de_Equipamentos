import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

const state = vi.hoisted(() => ({
  denied: 0,
  fault: false,
  permission: vi.fn(),
  transaction: vi.fn(),
  payment: vi.fn(),
  update: vi.fn(),
  attempt: vi.fn(),
  attempts: vi.fn(),
  setting: vi.fn(),
  event: vi.fn(),
}))
const principal = {
  tenantId: 'alfa',
  userId: 'owner',
  role: 'ADMIN' as const,
  membershipId: 'member',
}
async function transaction<T>(
  context: unknown,
  run: (tx: Prisma.TransactionClient) => Promise<T>
) {
  state.transaction(context)
  if (state.fault) throw Error('private SQL credentials')
  return run({
    payment: {
      findFirst: state.payment,
      update: state.update,
      updateMany: state.update,
    },
    paymentAttempt: { findFirst: state.attempt, updateMany: state.attempts },
    financialSetting: { create: state.setting },
    outboxEvent: { upsert: state.event },
    organization: { findUnique: async () => ({ status: 'ACTIVE' }) },
    $executeRaw: async () => 1,
  } as unknown as Prisma.TransactionClient)
}
vi.mock('@/lib/tenant', () => ({ withTenantTransaction: transaction }))
vi.mock('@/lib/security/tenant-webhook', () => ({
  resolveIntegrationCredential: async () => null,
}))
vi.mock('@/lib/rental-transaction', () => ({
  withRentalTransaction: transaction,
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: transaction,
}))
vi.mock('@/lib/tenant-permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
// Shared rental factory's active-company check remains real; the transaction double supplies it.

import { PATCH as ls } from '@/app/api/admin/financial/settings/route'
import { PATCH as lp } from '@/app/api/admin/financial/entries/[id]/status/route'
import { PATCH as ld } from '@/app/api/admin/financial/entries/[id]/due-date/route'
import { DELETE as lx } from '@/app/api/admin/financial/entries/[id]/route'
import { PATCH as ss } from '../../apps/services/api/src/app/api/admin/financial/settings/route'
import { PATCH as sp } from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/status/route'
import { PATCH as sd } from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/due-date/route'
import { DELETE as sx } from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/route'

const params = { params: Promise.resolve({ id: 'payment-A' }) }
const request = (body: unknown, method = 'PATCH') =>
  new NextRequest('http://localhost/api/admin/financial', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
beforeEach(() => {
  vi.clearAllMocks()
  state.denied = 0
  state.fault = false
  state.permission.mockImplementation(async () =>
    state.denied
      ? {
          ok: false,
          response: Response.json(
            { error: 'denied' },
            { status: state.denied }
          ),
        }
      : { ok: true, principal }
  )
  state.payment.mockResolvedValue({
    id: 'payment-A',
    tenantId: 'alfa',
    status: 'PENDING',
    transactionId: 'old-A',
    quoteId: null,
  })
  state.update.mockResolvedValue({
    id: 'payment-A',
    status: 'PENDING',
    billingStatus: 'SETTLED',
    count: 1,
  })
  state.attempt.mockResolvedValue({
    id: 'attempt-A',
    status: 'ISSUED',
    integration: { tenantId: 'alfa', status: 'ACTIVE' },
  })
  state.event.mockResolvedValue({
    id: 'operation-A',
    status: 'PENDING',
    payload: {},
  })
  state.setting.mockImplementation(async ({ data }) => ({
    ...data,
    id: 'setting-A',
    issRate: 2.5,
    updatedAt: new Date('2030-01-01'),
  }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
for (const [name, settings, status, dueDate, deletion] of [
  ['legacy', ls, lp, ld, lx],
  ['service', ss, sp, sd, sx],
] as const)
  describe(name, () => {
    it.each([
      ['settings', settings, 'WRITE'],
      ['status', status, 'WRITE'],
      ['due-date', dueDate, 'WRITE'],
      ['deletion', deletion, 'DELETE'],
    ] as const)(
      'requires exact FINANCIAL permission before body/SQL on %s',
      async (_n, handler, action) => {
        state.denied = 403
        expect((await handler(request('bad'), params)).status).toBe(403)
        expect(state.permission).toHaveBeenCalledWith(
          expect.any(Request),
          'FINANCIAL',
          action
        )
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it('preserves required legacy rates and validation details', async () => {
      const r = await settings(request({ cpfRate: 0, cnpjRate: 100 }))
      expect(r.status).toBe(400)
      expect((await r.json()).details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['cniRate'] })])
      )
      expect(state.setting).not.toHaveBeenCalled()
    })
    it('appends tenant/actor settings and strips unknown keys as before', async () => {
      const r = await settings(
        request({
          cpfRate: 0,
          cnpjRate: 100,
          cniRate: 6,
          ibsCbsRate: null,
          tenantId: 'bravo',
          updatedBy: 'intruder',
        })
      )
      expect(r.status).toBe(200)
      expect(state.setting.mock.calls[0]![0].data).toMatchObject({
        tenantId: 'alfa',
        updatedBy: 'owner',
        cpfRate: 0,
        cnpjRate: 100,
        ibsCbsRate: null,
      })
      expect((await r.json()).settings).toMatchObject({
        cpfRate: 0,
        cnpjRate: 100,
        cniRate: 6,
      })
    })
    it.each(['PAID', 'CANCELLED', 'REFUNDED'])(
      'cannot reopen a %s payment',
      async (statusValue) => {
        state.payment.mockResolvedValue({
          id: 'payment-A',
          status: statusValue,
        })
        const r = await status(request({ billingStatus: 'UNPAID' }), params)
        expect(r.status).toBe(409)
        expect((await r.json()).code).toBe('PAYMENT_RECONCILIATION_REQUIRED')
        expect(state.update).not.toHaveBeenCalled()
      }
    )
    it('does not treat settlement as confirmation', async () => {
      const r = await status(
        request({
          billingStatus: 'SETTLED',
          invoiceNumber: '  NF  ',
          paidAt: null,
        }),
        params
      )
      expect(r.status).toBe(200)
      expect(state.update).toHaveBeenCalledTimes(1)
      expect(state.update.mock.calls[0]![0]).toMatchObject({
        where: { id: 'payment-A', tenantId: 'alfa' },
        data: {
          billingStatus: 'SETTLED',
          invoiceNumber: 'NF',
          settledAt: expect.any(Date),
        },
      })
      expect(state.event).not.toHaveBeenCalled()
    })
    it('keeps the overdue reopening policy', async () => {
      state.payment.mockResolvedValue({ status: 'OVERDUE' })
      const r = await status(
        request({ billingStatus: 'AWAITING_PAYMENT' }),
        params
      )
      expect(r.status).toBe(409)
      expect((await r.json()).code).toBe('PAYMENT_REISSUE_REQUIRED')
    })
    it('keeps missing entry status and generic unexpected error contracts', async () => {
      state.payment.mockResolvedValue(null)
      expect(
        (await status(request({ billingStatus: 'PAID' }), params)).status
      ).toBe(404)
      state.fault = true
      const r = await status(request({ billingStatus: 'PAID' }), params)
      expect(r.status).toBe(500)
      expect(await r.json()).toEqual({
        error: 'Erro ao atualizar status financeiro',
      })
    })
    it('rejects invalid/past dates before queuing any work', async () => {
      for (const date of ['invalid', '2000-01-01'])
        expect((await dueDate(request({ dueDate: date }), params)).status).toBe(
          400
        )
      expect(state.attempts).not.toHaveBeenCalled()
      expect(state.event).not.toHaveBeenCalled()
    })
    it('keeps history preserved and foreign/missing ids hidden', async () => {
      const r = await deletion(request({}, 'DELETE'), params)
      expect(r.status).toBe(409)
      expect((await r.json()).code).toBe('FINANCIAL_HISTORY_PRESERVED')
      state.payment.mockResolvedValue(null)
      expect((await deletion(request({}, 'DELETE'), params)).status).toBe(404)
      expect(state.update).not.toHaveBeenCalled()
      expect(state.event).not.toHaveBeenCalled()
    })
  })
