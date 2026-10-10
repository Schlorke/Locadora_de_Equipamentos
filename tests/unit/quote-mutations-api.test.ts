import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'
import { QuoteUpdateRejected } from '@gb-locacoes/backend/quotations'

const state = vi.hoisted(() => ({
  role: 'ADMIN',
  denied: 0,
  crossOrigin: false,
  limited: false,
  calls: Object.fromEntries(
    [
      'updateQuote',
      'deleteQuote',
      'listQuoteAdjustments',
      'createQuoteAdjustment',
      'hasQuoteAdjustment',
      'calculateQuoteLateFee',
      'convertQuoteToRental',
      'requestAdjustedQuoteDelivery',
      'createQuoteRequest',
      'readAdminQuote',
      'listClientQuotes',
    ].map((name) => [name, vi.fn()])
  ),
}))
const principal = {
  tenantId: 'tenant',
  userId: 'user',
  membershipId: 'member',
  role: 'ADMIN',
}
async function resolve() {
  return state.denied
    ? {
        ok: false,
        response: Response.json({ error: 'denied' }, { status: state.denied }),
      }
    : { ok: true, principal: { ...principal, role: state.role } }
}
async function publicTenant() {
  return state.denied
    ? {
        ok: false,
        response: Response.json({ error: 'denied' }, { status: state.denied }),
      }
    : { ok: true, context: { tenantId: 'tenant' }, edge: {} }
}
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: resolve,
}))
vi.mock('../../apps/services/api/src/host/runtime', () => ({
  resolvePublicRequestTenant: publicTenant,
}))
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: resolve,
}))
vi.mock('../../apps/services/api/src/host/quotations', () => ({
  ...state.calls,
  QuoteUpdateRejected,
}))
vi.mock('../../apps/services/api/src/host/portal', () => state.calls)
function limit() {
  return state.limited
    ? {
        allowed: false,
        response: Response.json({ error: 'limited' }, { status: 429 }),
      }
    : { allowed: true }
}
vi.mock('../../apps/services/api/src/host/rate-limit', () => ({
  checkRateLimit: limit,
  adminApiRateLimit: {},
  strictRateLimit: {},
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: async () => ({ user: { id: 'user' } }),
}))
vi.mock('@gb-locacoes/backend/identity', async (importActual) => ({
  ...(await importActual<typeof import('@gb-locacoes/backend/identity')>()),
  rejectCrossOriginMutation: () =>
    state.crossOrigin
      ? Response.json({ error: 'origin' }, { status: 403 })
      : null,
  isSameOriginMutation: () => !state.crossOrigin,
}))

import {
  PATCH as newPatch,
  DELETE as newDelete,
} from '../../apps/services/api/src/app/api/admin/quotes/[id]/route'
import {
  GET as newList,
  POST as newAdjust,
} from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/route'
import { DELETE as newHistory } from '../../apps/services/api/src/app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route'
import { POST as newFee } from '../../apps/services/api/src/app/api/admin/quotes/[id]/calculate-late-fee/route'
import { POST as newConvert } from '../../apps/services/api/src/app/api/admin/quotes/[id]/convert-to-rental/route'
import { POST as newSend } from '../../apps/services/api/src/app/api/admin/quotes/[id]/send-adjusted-quote/route'
import { POST as newCreate } from '../../apps/services/api/src/app/api/quotes/route'

const cases = [
  {
    name: 'patch',
    handlers: [newPatch],
    use: 'updateQuote',
    body: { name: 'updated', extra: true },
    status: 200,
  },
  {
    name: 'delete',
    handlers: [newDelete],
    use: 'deleteQuote',
    body: {},
    status: 200,
  },
  {
    name: 'adjustment list',
    handlers: [newList],
    use: 'listQuoteAdjustments',
    body: {},
    status: 200,
  },
  {
    name: 'adjustment create',
    handlers: [newAdjust],
    use: 'createQuoteAdjustment',
    body: {
      category: 'OTHER',
      amount: 1.005,
      justification: '  reason  ',
      extra: true,
    },
    status: 202,
  },
  {
    name: 'immutable history',
    handlers: [newHistory],
    use: 'hasQuoteAdjustment',
    body: {},
    status: 409,
  },
  {
    name: 'late fee',
    handlers: [newFee],
    use: 'calculateQuoteLateFee',
    body: {
      currentDate: '2033-03-12T00:00:00Z',
      config: { dailyRate: 0.02 },
      extra: true,
    },
    status: 200,
  },
  {
    name: 'conversion',
    handlers: [newConvert],
    use: 'convertQuoteToRental',
    body: { generateBoleto: true, boletoDueDate: '2033-03-14', extra: true },
    status: 201,
  },
  {
    name: 'adjusted send',
    handlers: [newSend],
    use: 'requestAdjustedQuoteDelivery',
    body: {},
    status: 202,
  },
] as const
const params = {
  params: Promise.resolve({ id: 'quote', adjustmentId: 'adjustment' }),
}
function request(body: unknown, malformed = false) {
  return new NextRequest('https://test.invalid/api/quotes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: malformed ? '{' : JSON.stringify(body),
  })
}
beforeEach(() => {
  state.role = 'ADMIN'
  state.denied = 0
  state.crossOrigin = false
  state.limited = false
  for (const call of Object.values(state.calls))
    call.mockReset().mockResolvedValue({ id: 'quote' })
  state.calls.listQuoteAdjustments!.mockResolvedValue([
    { id: 'adjustment', amount: 1.01 },
  ])
  state.calls.hasQuoteAdjustment!.mockResolvedValue(true)
  state.calls.calculateQuoteLateFee!.mockResolvedValue({
    outcome: 'calculated',
    lateFee: 2,
    daysLate: 1,
    calculationMethod: 'fixed',
    config: { fixedAmount: 2 },
    baseValue: 100,
    endDate: '2033-03-11',
    calculationDate: '2033-03-12',
  })
})
describe.each(cases)('$name preserves the quote HTTP contract', (testCase) => {
  if (
    [
      'patch',
      'delete',
      'adjustment create',
      'conversion',
      'adjusted send',
    ].includes(testCase.name)
  )
    it.each([402, 403, 503])(
      'transports current subscription refusal %i without losing private cache policy',
      async (status) => {
        const policy = {
          error: 'Synthetic current subscription refusal',
          code: 'SUBSCRIPTION_RESTRICTED' as const,
        }
        state.calls[testCase.use]!.mockRejectedValue(
          new RentalMutationError(
            policy.error,
            status,
            policy.code,
            undefined,
            policy
          )
        )
        for (const handler of testCase.handlers) {
          const response = await handler(request(testCase.body), params)
          expect(response.status).toBe(status)
          expect(await response.json()).toEqual(policy)
          expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
          )
          expect(response.headers.get('vary')).toBe('Cookie, Host')
        }
      }
    )
  it.each([401, 403, 409])(
    'principal rejection %i precedes body/effect',
    async (code) => {
      state.denied = code
      for (const handler of testCase.handlers)
        expect(
          (await handler(request(testCase.body, true), params))!.status
        ).toBe(code)
      expect(state.calls[testCase.use]).not.toHaveBeenCalled()
    }
  )
  it('keeps use-case arguments, schema defaults and response', async () => {
    const responses: unknown[] = []
    const calls: unknown[][][] = []
    for (const handler of testCase.handlers) {
      state.calls[testCase.use]!.mockClear()
      const result = await handler(request(testCase.body), params)
      if (!result) throw new Error('Handler did not return a Response')
      expect(result.status).toBe(testCase.status)
      responses.push(await result.json())
      calls.push(state.calls[testCase.use]!.mock.calls)
    }
    expect(responses[0]).toEqual(expectedQuoteResponses[testCase.name])
    expect(state.calls[testCase.use]).toHaveBeenCalledTimes(1)
    expect(calls[0]![0]!.slice(0, 2)).toEqual([principal, 'quote'])
    if (testCase.name === 'adjustment create')
      expect(calls[0]![0]![2]).toEqual({
        category: 'OTHER',
        amount: 1.005,
        justification: 'reason',
        sendEmail: true,
        sendWhatsapp: true,
      })
    if (testCase.name === 'conversion')
      expect(calls[0]![0]![2]).toEqual({
        generateBoleto: false,
        boletoDueDate: new Date('2033-03-14'),
      })
    if (testCase.name === 'patch')
      expect(calls[0]![0]![2]).toEqual(testCase.body)
    if (testCase.name === 'immutable history')
      expect((responses[0] as { code: string }).code).toBe(
        'ADJUSTMENT_HISTORY_PRESERVED'
      )
  })
})
it('keeps distinct admin/operator/financial roles before malformed payload', async () => {
  for (const testCase of cases.filter((entry) =>
    [
      'patch',
      'delete',
      'adjustment create',
      'conversion',
      'adjusted send',
    ].includes(entry.name)
  )) {
    state.role = 'CLIENT'
    for (const handler of testCase.handlers)
      expect((await handler(request({}, true), params))!.status).toBe(403)
    expect(state.calls[testCase.use]).not.toHaveBeenCalled()
  }
})
it('preserves rate limiting before parsing', async () => {
  state.limited = true
  for (const handler of [newPatch, newCreate])
    expect((await handler(request({}, true), params))!.status).toBe(429)
  expect(state.calls.updateQuote).not.toHaveBeenCalled()
  expect(state.calls.createQuoteRequest).not.toHaveBeenCalled()
})
it('maps QuoteUpdateRejected and reconciliation without changing their bodies', async () => {
  state.calls.updateQuote!.mockRejectedValue(
    new QuoteUpdateRejected(400, { error: 'Campo não editável no orçamento' })
  )
  for (const handler of [newPatch]) {
    const result = await handler(request({}), params)
    if (!result) throw new Error('Handler did not return a Response')
    expect(result.status).toBe(400)
    expect(await result.json()).toEqual({
      error: 'Campo não editável no orçamento',
    })
  }
  state.calls.createQuoteAdjustment!.mockRejectedValue(
    new RentalMutationError(
      'reconcile',
      409,
      'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION'
    )
  )
  for (const handler of [newAdjust])
    expect(
      await (await handler(request(cases[3].body), params)).json()
    ).toEqual({
      error: 'reconcile',
      code: 'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION',
    })
})
it('does not expose unexpected deletion causes', async () => {
  state.calls.deleteQuote!.mockRejectedValue(
    new Error('fixture-private-database-failure')
  )
  for (const handler of [newDelete]) {
    const response = await handler(request({}), params)
    if (!response) throw new Error('Handler did not return a Response')
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
  }
})
it.each([
  ['not_found', 404, 'Orçamento não encontrado'],
  ['missing_end_date', 400, 'Orçamento não possui data de término definida'],
] as const)('retains late-fee outcome %s', async (outcome, status, error) => {
  state.calls.calculateQuoteLateFee!.mockResolvedValue({ outcome })
  for (const handler of [newFee]) {
    const response = await handler(request({}), params)
    if (!response) throw new Error('Handler did not return a Response')
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
  }
})
const publicBody = {
  customerName: 'client',
  customerEmail: 'client@example.test',
  customerPhone: '',
  items: [{ equipmentId: 'equipment', quantity: 1, days: 3 }],
  tenantSlug: 'alfa',
  extra: 'discard',
}
it.each([402, 403, 503])(
  'public creation preserves subscription refusal %i in both hosts',
  async (status) => {
    const policy = {
      error: 'Synthetic current subscription refusal',
      code: 'SUBSCRIPTION_RESTRICTED' as const,
    }
    state.calls.createQuoteRequest!.mockRejectedValue(
      new RentalMutationError(
        policy.error,
        status,
        policy.code,
        undefined,
        policy
      )
    )
    for (const handler of [newCreate]) {
      const response = await handler(request(publicBody))
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual(policy)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('vary')).toBe('Cookie, Host')
    }
  }
)
it('preserves public creation schema and optional session identity', async () => {
  for (const handler of [newCreate]) {
    const response = await handler(request(publicBody))
    if (!response) throw new Error('Handler did not return a Response')
    expect(response.status).toBe(201)
    expect(state.calls.createQuoteRequest!.mock.lastCall).toEqual([
      { tenantId: 'tenant' },
      {
        customerName: 'client',
        customerEmail: 'client@example.test',
        customerPhone: '',
        items: [{ equipmentId: 'equipment', quantity: 1, days: 3 }],
      },
      'user',
    ])
  }
})
it('public creation rejects origin before malformed JSON', async () => {
  state.crossOrigin = true
  for (const handler of [newCreate])
    expect((await handler(request({}, true)))!.status).toBe(403)
  expect(state.calls.createQuoteRequest).not.toHaveBeenCalled()
})
it.each([400, 404, 409])(
  'public tenant rejection %i precedes input validation',
  async (code) => {
    state.denied = code
    for (const handler of [newCreate])
      expect((await handler(request({})))!.status).toBe(code)
    expect(state.calls.createQuoteRequest).not.toHaveBeenCalled()
  }
)

const expectedQuoteResponses = {
  patch: { id: 'quote' },
  delete: { message: 'Quote deleted successfully' },
  'adjustment list': { adjustments: [{ id: 'adjustment', amount: 1.01 }] },
  'adjustment create': { id: 'quote' },
  'immutable history': {
    error:
      'O histórico de reajustes deve ser preservado. Registre uma revisão financeira para corrigir valores.',
    code: 'ADJUSTMENT_HISTORY_PRESERVED',
  },
  'late fee': {
    lateFee: 2,
    daysLate: 1,
    calculationMethod: 'fixed',
    config: { fixedAmount: 2 },
    baseValue: 100,
    endDate: '2033-03-11',
    calculationDate: '2033-03-12',
  },
  conversion: { id: 'quote' },
  'adjusted send': { success: true, emailStatus: 'queued' },
} as const
