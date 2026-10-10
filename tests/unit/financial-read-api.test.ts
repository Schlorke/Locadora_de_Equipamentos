import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

const state = vi.hoisted(() => ({
  denied: 0,
  fault: false,
  permission: vi.fn(),
  payments: vi.fn(),
  profiles: vi.fn(),
  setting: vi.fn(),
  organization: vi.fn(),
  aggregate: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
}))
const principal = {
  tenantId: 'financial-A',
  userId: 'owner-A',
  membershipId: 'member-A',
  role: 'ADMIN',
}
async function access() {
  return state.denied
    ? {
        ok: false,
        response: Response.json({ error: 'denied' }, { status: state.denied }),
      }
    : { ok: true, principal }
}
async function transaction<T>(
  context: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<T>
) {
  state.transaction(context)
  if (state.fault) throw Error('private SQL password')
  return work({
    payment: {
      findMany: state.payments,
      count: state.count,
      aggregate: state.aggregate,
    },
    clientProfile: { findMany: state.profiles },
    financialSetting: { findFirst: state.setting },
    organization: { findUniqueOrThrow: state.organization },
  } as unknown as Prisma.TransactionClient)
}
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: transaction,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
import { GET as sa } from '../../apps/services/api/src/app/api/admin/financial/aging/route'
import { GET as sc } from '../../apps/services/api/src/app/api/admin/financial/calendar/route'
import { GET as se } from '../../apps/services/api/src/app/api/admin/financial/entries/route'
import { GET as sr } from '../../apps/services/api/src/app/api/admin/financial/revenue/route'
import { GET as ss } from '../../apps/services/api/src/app/api/admin/financial/settings/route'
import { GET as sx } from '../../apps/services/api/src/app/api/admin/financial/export/route'
const names = ['aging', 'calendar', 'entries', 'revenue', 'settings', 'export']
const request = (query = '') =>
  new NextRequest('http://financial.example.test/api/admin/financial' + query)
beforeEach(() => {
  vi.clearAllMocks()
  state.denied = 0
  state.fault = false
  state.permission.mockImplementation(access)
  state.payments.mockResolvedValue([])
  state.profiles.mockResolvedValue([])
  state.setting.mockResolvedValue(null)
  state.organization.mockResolvedValue({ name: 'Tenant A' })
  state.count.mockResolvedValue(0)
  state.aggregate.mockResolvedValue({
    _sum: { grossAmount: null, netAmount: null, amount: null },
    _count: 0,
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())
for (const [host, handlers] of [['service', [sa, sc, se, sr, ss, sx]]] as const)
  describe(host, () => {
    it.each(handlers.map((handler, index) => [names[index], handler] as const))(
      'requires FINANCIAL READ before SQL on %s',
      async (_name, handler) => {
        state.denied = 403
        expect((await handler(request('?format=csv'))).status).toBe(403)
        expect(state.permission).toHaveBeenCalledWith(
          expect.any(Request),
          'FINANCIAL',
          'READ'
        )
        expect(state.transaction).not.toHaveBeenCalled()
      }
    )
    it.each(handlers.map((handler, index) => [names[index], handler] as const))(
      'keeps unexpected failures generic on %s',
      async (_name, handler) => {
        state.fault = true
        const result = await handler(request('?format=csv'))
        expect(result.status).toBe(500)
        expect(await result.text()).not.toMatch(/private SQL|password/)
      }
    )
    it('preserves default settings and zero totals without inserting defaults', async () => {
      expect(await (await handlers[4](request())).json()).toEqual({
        settings: {
          cpfRate: 6,
          cnpjRate: 2.5,
          cniRate: 6,
          taxRegime: 'SIMPLES_NACIONAL',
          issRate: 2.5,
          issExemptRental: true,
          irpjPresumidoRate: null,
          csllPresumidoRate: null,
          pisCofinsRate: null,
          simplesAnexo: 'III',
          simplesAliquota: null,
          ibsCbsRate: null,
          ibsCbsActive: false,
        },
      })
      expect(await (await handlers[2](request())).json()).toEqual({
        entries: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        totals: {
          gross: 0,
          net: 0,
          paid: 0,
          paidNet: 0,
          paidCount: 0,
          unpaid: 0,
          unpaidCount: 0,
          awaiting: 0,
          awaitingCount: 0,
          count: 0,
        },
      })
    })
    it('preserves paid aging shortcut before any payment or profile query', async () => {
      const result = await handlers[0](request('?status=paid'))
      const json = await result.json()
      expect(json.agingData.map((row: { count: number }) => row.count)).toEqual(
        [0, 0, 0, 0, 0]
      )
      expect(json.topDebtors).toEqual([])
      expect(state.payments).not.toHaveBeenCalled()
      expect(state.profiles).not.toHaveBeenCalled()
    })
    it('preserves revenue received-date filter and twelve-month fallback', async () => {
      await handlers[3](
        request(
          '?months=invalid&status=invalid&search=%20A%20&endDate=2030-02-01'
        )
      )
      expect(state.payments).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: principal.tenantId,
            method: 'BOLETO',
            type: { in: ['RENTAL', 'DEPOSIT'] },
            AND: expect.arrayContaining([
              { billingStatus: 'PAID' },
              {
                paidAt: { gte: expect.any(Date), lte: new Date('2030-02-01') },
              },
            ]),
          }),
        })
      )
    })
    it('keeps calendar start/end aliases and ignores its unsupported search', async () => {
      await handlers[1](
        request('?start=2030-01-01&end=2030-02-01&search=not-supported')
      )
      expect(state.payments).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                dueDate: {
                  gte: new Date('2030-01-01'),
                  lte: new Date('2030-02-01'),
                },
              },
            ]),
          }),
        })
      )
      expect(state.payments.mock.calls[0]![0].where.AND).toHaveLength(2)
    })
    it('preserves export format rejection before queries and CSV BOM', async () => {
      expect((await handlers[5](request('?format=xml'))).status).toBe(400)
      expect(state.transaction).not.toHaveBeenCalled()
      const result = await handlers[5](request('?format=CSV'))
      expect(result.status).toBe(200)
      expect(result.headers.get('cache-control')).toBe('no-store')
      expect(result.headers.get('content-disposition')).toBe(
        'attachment; filename="relatorio-financeiro.csv"'
      )
      const bytes = Buffer.from(await result.arrayBuffer())
      expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191])
      expect(bytes.subarray(3).toString()).toBe(
        'Código;Cód. Legado;Cliente;Empresa;CNPJ/CPF;Valor Bruto;Valor Líquido;Alíquota %;Nº Nota;Data Boleto;Data NF;Vencimento;Pagamento;Status'
      )
    })
  })
