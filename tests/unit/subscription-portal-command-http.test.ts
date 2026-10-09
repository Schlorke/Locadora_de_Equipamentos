import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

const state = vi.hoisted(() => ({
  principal: vi.fn(),
  hideClientQuote: vi.fn(),
  hideClientRental: vi.fn(),
  requestClientRentalAction: vi.fn(),
}))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: state.principal }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('@/lib/quote-request', () => ({
  hideClientQuote: state.hideClientQuote,
  readClientQuote: vi.fn(),
}))
vi.mock('@/lib/client-rental-requests', () => ({
  ...state,
  readClientRental: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/portal', () => ({
  ...state,
  readClientRental: vi.fn(),
  readClientQuote: vi.fn(),
}))
vi.mock('@/lib/rental-transaction', async () => {
  const { RentalMutationError } = await import('@gb-locacoes/backend/rentals')
  return { RentalMutationError }
})

import { DELETE as legacyQuote } from '@/app/api/quotes/[id]/route'
import { DELETE as serviceQuote } from '../../apps/services/api/src/app/api/quotes/[id]/route'
import { DELETE as legacyRental } from '@/app/api/client/rentals/[id]/route'
import { DELETE as serviceRental } from '../../apps/services/api/src/app/api/client/rentals/[id]/route'
import { POST as legacyPickup } from '@/app/api/client/rentals/[id]/request-pickup/route'
import { POST as servicePickup } from '../../apps/services/api/src/app/api/client/rentals/[id]/request-pickup/route'
import { POST as legacyExtension } from '@/app/api/client/rentals/[id]/request-extension/route'
import { POST as serviceExtension } from '../../apps/services/api/src/app/api/client/rentals/[id]/request-extension/route'

const principal = {
  tenantId: 'alfa',
  userId: 'client',
  membershipId: 'member',
  role: 'CLIENT' as const,
}
const cases = [
  {
    name: 'hide quote',
    methods: [legacyQuote, serviceQuote],
    call: state.hideClientQuote,
    method: 'DELETE',
  },
  {
    name: 'hide rental',
    methods: [legacyRental, serviceRental],
    call: state.hideClientRental,
    method: 'DELETE',
  },
  {
    name: 'request pickup',
    methods: [legacyPickup, servicePickup],
    call: state.requestClientRentalAction,
    method: 'POST',
  },
  {
    name: 'request extension',
    methods: [legacyExtension, serviceExtension],
    call: state.requestClientRentalAction,
    method: 'POST',
  },
] as const
const params = { params: Promise.resolve({ id: 'existing' }) }
beforeEach(() => {
  vi.resetAllMocks()
  state.principal.mockResolvedValue({ ok: true, principal })
})
describe.each(cases)('$name keeps current policy in both hosts', (entry) => {
  const request = () =>
    new NextRequest('https://app.test/api', {
      method: entry.method,
      body:
        entry.method === 'POST'
          ? JSON.stringify({ additionalDays: 2 })
          : undefined,
    })
  it.each([402, 403, 503])(
    'returns private subscription refusal %i unchanged',
    async (status) => {
      const policy = {
        error: 'Synthetic current refusal',
        code: 'SUBSCRIPTION_RESTRICTED' as const,
      }
      entry.call.mockRejectedValue(
        new RentalMutationError(
          policy.error,
          status,
          policy.code,
          undefined,
          policy
        )
      )
      for (const handler of entry.methods) {
        const response = await handler(request(), params)
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(policy)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('vary')).toBe('Cookie, Host')
        expect(entry.call.mock.lastCall?.slice(0, 2)).toEqual([
          principal,
          'existing',
        ])
      }
    }
  )
  it('preserves principal rejection before reaching the command', async () => {
    const denied = Response.json({ error: 'denied' }, { status: 409 })
    state.principal.mockResolvedValue({ ok: false, response: denied })
    for (const handler of entry.methods)
      expect(await handler(request(), params)).toBe(denied)
    expect(entry.call).not.toHaveBeenCalled()
  })
  it('retains the successful legacy envelope and scoped command arguments', async () => {
    entry.call.mockResolvedValue(
      entry.method === 'DELETE'
        ? true
        : { requestId: 'synthetic', duplicate: false }
    )
    const responses = []
    for (const handler of entry.methods) {
      const response = await handler(request(), params)
      expect(response.status).toBe(200)
      responses.push(await response.json())
      expect(entry.call.mock.lastCall?.slice(0, 2)).toEqual([
        principal,
        'existing',
      ])
    }
    expect(responses[0]).toEqual(responses[1])
  })
})
