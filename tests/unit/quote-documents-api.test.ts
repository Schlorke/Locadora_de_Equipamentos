import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'

const state = vi.hoisted(() => ({
  denied: 0,
  transaction: false,
  permission: vi.fn(),
  principal: vi.fn(),
  quote: vi.fn(),
  payment: vi.fn(),
  organization: vi.fn(),
  setting: vi.fn(),
  quotePdf: vi.fn(),
  adjustmentPdf: vi.fn(),
  oficioPdf: vi.fn(),
}))
const principal = {
  tenantId: 'tenant-A',
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
  _context: unknown,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
) {
  state.transaction = true
  try {
    return await operation({
      quote: { findFirst: state.quote, findUnique: state.quote },
      payment: { findUnique: state.payment },
      organization: {
        findFirst: state.organization,
        findUnique: state.organization,
      },
      setting: { findFirst: state.setting },
      financialSetting: { findFirst: async () => null },
      clientProfile: { findFirst: async () => null },
      address: { findFirst: async () => null },
    } as unknown as Prisma.TransactionClient)
  } finally {
    state.transaction = false
  }
}
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: state.permission,
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: transaction,
}))
vi.mock('../../packages/backend/src/modules/documents/quote-pdf', () => ({
  renderQuotePdf: state.quotePdf,
}))
vi.mock(
  '../../packages/backend/src/modules/documents/quote-adjustment-pdf',
  () => ({ renderQuoteAdjustmentPdf: state.adjustmentPdf })
)
vi.mock(
  '../../packages/backend/src/modules/documents/oficio-generator',
  () => ({ generateOficioPdf: state.oficioPdf })
)
import { GET as serviceAdmin } from '../../apps/services/api/src/app/api/admin/quotes/[id]/download/route'
import { GET as serviceClient } from '../../apps/services/api/src/app/api/quotes/[id]/download/route'
import { GET as serviceAdjustments } from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/download/route'
import { GET as serviceQuoteOficio } from '../../apps/services/api/src/app/api/admin/quotes/[id]/pdf-oficio/route'
import { GET as servicePaymentOficio } from '../../apps/services/api/src/app/api/admin/financial/entries/[id]/pdf-oficio/route'

function quote() {
  return {
    id: 'quote-A',
    tenantId: 'tenant-A',
    userId: 'owner-A',
    name: 'Cliente A',
    company: null,
    email: 'fixture@example.test',
    phone: '',
    quoteCode: 'A/"\r\ncode',
    legacyExternalCode: null,
    createdAt: new Date('2030-01-01'),
    validUntil: new Date('2030-02-01'),
    startDate: new Date('2030-01-02'),
    endDate: new Date('2030-01-05'),
    total: 100.5,
    finalTotal: 110.5,
    originalTotal: 100.5,
    message: 'nota',
    status: 'APPROVED',
    paymentTerms: 'UPFRONT',
    payments: [],
    items: [
      {
        equipment: { name: 'Equipamento A' },
        quantity: 1,
        days: 3,
        pricePerDay: 33.5,
        total: 100.5,
        startDate: new Date('2030-01-02'),
        endDate: new Date('2030-01-05'),
      },
    ],
    adjustments: [
      {
        id: 'adj-A',
        category: 'OTHER',
        amount: 10,
        justification: 'ajuste',
        createdAt: new Date('2030-01-01'),
      },
    ],
  }
}
const params = { params: Promise.resolve({ id: 'quote-A' }) }
const request = (query = '') =>
  new NextRequest(
    'https://app.example.test/api/quotes/quote-A/download' + query
  )
beforeEach(() => {
  vi.clearAllMocks()
  state.denied = 0
  state.permission.mockImplementation(access)
  state.principal.mockImplementation(access)
  state.quote.mockResolvedValue(quote())
  state.payment.mockResolvedValue({
    id: 'pay-A',
    quote: quote(),
    grossAmount: 110.5,
    amount: 110.5,
    dueDate: new Date('2030-01-10'),
    createdAt: new Date('2030-01-01'),
  })
  state.organization.mockResolvedValue({
    name: 'Locadora A',
    document: '12345678000100',
    city: 'Cidade A',
    state: 'SP',
    status: 'ACTIVE',
  })
  state.setting.mockResolvedValue({
    publicBaseUrl: 'https://alfa.example.test',
  })
  for (const render of [state.quotePdf, state.adjustmentPdf, state.oficioPdf])
    render.mockImplementation(async () => {
      expect(state.transaction).toBe(false)
      return Buffer.from('%PDF-fixture\0bytes')
    })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())
for (const [host, handlers] of [
  [
    'service',
    [
      serviceAdmin,
      serviceClient,
      serviceAdjustments,
      serviceQuoteOficio,
      servicePaymentOficio,
    ],
  ],
] as const)
  describe(host, () => {
    it.each(handlers.map((handler, index) => [index, handler] as const))(
      'denies endpoint %i before snapshot or rendering',
      async (_index, handler) => {
        state.denied = 403
        expect((await handler(request(), params)).status).toBe(403)
        expect(state.quote).not.toHaveBeenCalled()
        expect(state.payment).not.toHaveBeenCalled()
        expect(state.organization).not.toHaveBeenCalled()
        expect(state.quotePdf).not.toHaveBeenCalled()
        expect(state.oficioPdf).not.toHaveBeenCalled()
      }
    )
    it('keeps QUOTES READ, owner/hidden filter, exact PDF bytes and attachment sanitation', async () => {
      const response = await handlers[0](request(), params)
      expect(state.permission).toHaveBeenCalledWith(
        expect.any(Request),
        'QUOTES',
        'READ'
      )
      expect(response.headers.get('content-disposition')).toBe(
        'attachment; filename="Orcamento-A____code.pdf"'
      )
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        Buffer.from('%PDF-fixture\0bytes')
      )
      await handlers[1](request(), params)
      expect(state.quote).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            id: 'quote-A',
            tenantId: 'tenant-A',
            userId: 'owner-A',
            clientDeletedAt: null,
          },
        })
      )
      expect(state.quotePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          finalTotal: '110.5',
          items: [expect.objectContaining({ pricePerDay: '33.5' })],
        }),
        expect.objectContaining({ name: 'Locadora A' })
      )
    })
    it('returns the existing 404 bodies for absent quote, issuer and adjustment', async () => {
      state.quote.mockResolvedValueOnce(null)
      expect(await (await handlers[0](request(), params)).json()).toEqual({
        error: 'Orçamento não encontrado',
      })
      state.organization.mockResolvedValueOnce(null)
      expect((await handlers[1](request(), params)).status).toBe(404)
      state.quote.mockResolvedValueOnce({ ...quote(), adjustments: [] })
      expect(await (await handlers[2](request(), params)).json()).toEqual({
        error: 'Nenhum reajuste encontrado para este orçamento',
      })
    })
    it('uses the adjustment renderer after transaction and retains exact PDF headers', async () => {
      const response = await handlers[2](request(), params)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(response.headers.get('content-disposition')).toContain('Reajuste-')
      expect(state.adjustmentPdf).toHaveBeenCalledWith(
        expect.objectContaining({ adjustments: expect.any(Array) }),
        expect.objectContaining({ name: 'Locadora A' })
      )
      expect(state.quotePdf).not.toHaveBeenCalled()
    })
    it('handles renderer failure after the transaction without returning a fake success PDF', async () => {
      state.quotePdf.mockRejectedValueOnce(new Error('renderer fixture error'))
      const response = await handlers[0](request(), params)
      expect(response.status).toBe(500)
      expect(response.headers.get('content-disposition')).toBeNull()
      expect(state.transaction).toBe(false)
    })
    it.each([3, 4])(
      'keeps FINANCIAL READ and inline oficio %i including preview semantics',
      async (index) => {
        const q = { ...quote(), quoteCode: 'A-100' }
        state.quote.mockResolvedValue(q)
        state.payment.mockResolvedValue({
          id: 'pay-A',
          quote: q,
          amount: 110.5,
          dueDate: new Date('2030-01-10'),
          createdAt: new Date('2030-01-01'),
        })
        const response = await handlers[index]!(
          request('?preview=true'),
          params
        )
        expect(response.status).toBe(200)
        expect(state.permission).toHaveBeenCalledWith(
          expect.any(Request),
          'FINANCIAL',
          'READ'
        )
        expect(response.headers.get('content-disposition')).toBe(
          index === 3
            ? 'inline; filename="oficio-A-100-dezembro-2029.pdf"'
            : 'inline; filename="oficio-A-100-janeiro-2030.pdf"'
        )
        expect(state.oficioPdf).toHaveBeenCalledWith(
          expect.objectContaining({
            preview: true,
            empresa: expect.objectContaining({ razaoSocial: 'Locadora A' }),
          })
        )
      }
    )
    it('preserves validation errors and incomplete company refusal', async () => {
      state.quote.mockResolvedValueOnce({
        ...quote(),
        quoteCode: null,
        finalTotal: 0,
        total: 0,
      })
      const response = await handlers[3](request(), params)
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        success: false,
        details: [
          'Código do orçamento é obrigatório',
          'Valor bruto deve ser maior que zero',
        ],
      })
      state.organization.mockResolvedValueOnce({
        name: 'Locadora A',
        status: 'ACTIVE',
      })
      const missing = await handlers[3](request(), params)
      expect(missing.status).toBe(409)
      expect(await missing.json()).toMatchObject({
        code: 'COMPANY_PROFILE_REQUIRED',
      })
    })
    it('refuses foreign snapshots at mapping and financial payment without a quote', async () => {
      state.quote.mockResolvedValueOnce({ ...quote(), tenantId: 'tenant-B' })
      expect((await handlers[3](request(), params)).status).toBe(404)
      state.payment.mockResolvedValueOnce({
        id: 'pay-A',
        amount: 110.5,
        quote: null,
        rental: null,
      })
      expect((await handlers[4](request(), params)).status).toBe(422)
    })
    it.each(handlers.map((handler, index) => [index, handler] as const))(
      'returns a generic 500 for endpoint %i without leaking SQL or credentials',
      async (index, handler) => {
        state.quote.mockRejectedValue(
          new Error('password=fixture-only SQL detail')
        )
        state.payment.mockRejectedValue(
          new Error('password=fixture-only SQL detail')
        )
        const response = await handler(request(), params)
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error:
            index < 3
              ? 'Não foi possível gerar o documento do orçamento'
              : 'Erro ao gerar PDF do ofício',
        })
      }
    )
  })
