import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  role: 'ADMIN',
  denied: 0,
  calls: Object.fromEntries(
    [
      'createAdminRental',
      'listAdminRentals',
      'readAdminRental',
      'updateRental',
      'checkoutRental',
      'checkinRental',
      'extendRental',
      'applyRentalLateFee',
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
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: resolve }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: resolve,
}))
vi.mock('@/lib/rental-lifecycle', () => state.calls)
vi.mock('../../apps/services/api/src/host/rentals', () => state.calls)
import { POST as oldCreate } from '@/app/api/admin/rentals/route'
import { POST as newCreate } from '../../apps/services/api/src/app/api/admin/rentals/route'
import {
  PATCH as oldPatch,
  DELETE as oldCancel,
} from '@/app/api/admin/rentals/[id]/route'
import {
  PATCH as newPatch,
  DELETE as newCancel,
} from '../../apps/services/api/src/app/api/admin/rentals/[id]/route'
import { POST as oldOut } from '@/app/api/admin/rentals/[id]/checkout/route'
import { POST as newOut } from '../../apps/services/api/src/app/api/admin/rentals/[id]/checkout/route'
import { POST as oldIn } from '@/app/api/admin/rentals/[id]/checkin/route'
import { POST as newIn } from '../../apps/services/api/src/app/api/admin/rentals/[id]/checkin/route'
import { POST as oldExtend } from '@/app/api/admin/rentals/[id]/extend/route'
import { POST as newExtend } from '../../apps/services/api/src/app/api/admin/rentals/[id]/extend/route'
import { POST as oldClientExtend } from '@/app/api/client/rentals/[id]/extend/route'
import { POST as newClientExtend } from '../../apps/services/api/src/app/api/client/rentals/[id]/extend/route'
import { POST as oldFee } from '@/app/api/admin/rentals/[id]/calculate-late-fee/route'
import { POST as newFee } from '../../apps/services/api/src/app/api/admin/rentals/[id]/calculate-late-fee/route'

const cases = [
  {
    name: 'create',
    methods: [oldCreate, newCreate],
    use: 'createAdminRental',
    body: {
      userId: 'customer',
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      items: [
        {
          equipmentId: 'equipment',
          quantity: 2,
          days: 3,
          pricePerDay: '10.005',
        },
      ],
      extra: 'discard',
    },
    code: 201,
  },
  {
    name: 'patch',
    methods: [oldPatch, newPatch],
    use: 'updateRental',
    body: { lateFee: '1.005', notes: '', extra: true },
    code: 200,
  },
  {
    name: 'cancel',
    methods: [oldCancel, newCancel],
    use: 'updateRental',
    body: {},
    code: 200,
  },
  {
    name: 'checkout',
    methods: [oldOut, newOut],
    use: 'checkoutRental',
    body: {},
    code: 200,
  },
  {
    name: 'checkin',
    methods: [oldIn, newIn],
    use: 'checkinRental',
    body: { damageFee: 1.005, notes: '', extra: true },
    code: 200,
  },
  {
    name: 'admin extend',
    methods: [oldExtend, newExtend],
    use: 'extendRental',
    body: { additionalDays: 2 },
    code: 202,
  },
  {
    name: 'client extend',
    methods: [oldClientExtend, newClientExtend],
    use: 'extendRental',
    body: { extensionDays: 2, extra: true },
    code: 200,
  },
  {
    name: 'late fee',
    methods: [oldFee, newFee],
    use: 'applyRentalLateFee',
    body: {},
    code: 200,
  },
] as const
const params = { params: Promise.resolve({ id: 'rental' }) }
function request(body: unknown, malformed = false) {
  return new NextRequest('https://test.invalid/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: malformed ? '{' : JSON.stringify(body),
  })
}
beforeEach(() => {
  state.role = 'ADMIN'
  state.denied = 0
  for (const fn of Object.values(state.calls))
    fn.mockReset().mockResolvedValue({
      id: 'rental',
      paymentId: 'payment',
      outcome: 'not_overdue',
    })
})
describe.each(cases)(
  '$name adapters retain the legacy rental contract',
  (testCase) => {
    it.each([401, 403, 409])(
      'rejects principal status %i before parsing/effect',
      async (denied) => {
        state.denied = denied
        for (const handler of testCase.methods)
          expect(
            (await handler(request(testCase.body, true), params)).status
          ).toBe(denied)
        expect(state.calls[testCase.use]).not.toHaveBeenCalled()
      }
    )
    if (testCase.name !== 'client extend')
      it('requires tenant ADMIN before malformed body', async () => {
        state.role = 'OPERATOR'
        for (const handler of testCase.methods)
          expect(
            (await handler(request(testCase.body, true), params)).status
          ).toBe(403)
        expect(state.calls[testCase.use]).not.toHaveBeenCalled()
      })
    it('preserves schema output, argument order, envelope and status', async () => {
      const output: unknown[] = []
      const calls: unknown[][][] = []
      for (const handler of testCase.methods) {
        state.calls[testCase.use]!.mockClear()
        const response = await handler(request(testCase.body), params)
        expect(response.status).toBe(testCase.code)
        output.push(await response.json())
        calls.push(state.calls[testCase.use]!.mock.calls)
      }
      expect(output[1]).toEqual(output[0])
      expect(calls[1]).toEqual(calls[0])
      const args = calls[0]![0]!
      expect(args[0]).toEqual(principal)
      if (testCase.name === 'create') {
        const parsed = args[1] as {
          items: { pricePerDay: { toString(): string } }[]
          startDate: Date
          extra?: unknown
        }
        expect(parsed.items[0]!.pricePerDay.toString()).toBe('10.005')
        expect(parsed.startDate).toEqual(new Date('2026-11-01'))
        expect(parsed.extra).toBeUndefined()
      } else expect(args[1]).toBe('rental')
      if (testCase.name === 'admin extend')
        expect(args[2]).toEqual({
          additionalDays: 2,
          generateBoleto: true,
          boletoDueDate: undefined,
        })
      if (testCase.name === 'client extend')
        expect(args[2]).toEqual({ additionalDays: 2, customerId: 'user' })
      if (testCase.name === 'cancel')
        expect(args[2]).toEqual({ status: 'CANCELLED' })
    })
    it('maps domain failures without exposing the internal cause', async () => {
      const { RentalMutationError } =
        await import('@gb-locacoes/backend/rentals')
      state.calls[testCase.use]!.mockRejectedValue(
        new RentalMutationError('business rule', 409)
      )
      for (const handler of testCase.methods) {
        const response = await handler(request(testCase.body), params)
        expect(response.status).toBe(409)
        expect(await response.json()).toEqual({ error: 'business rule' })
      }
    })
    it.each([402, 403, 503])(
      'preserves transactional subscription refusal %i in both hosts',
      async (status) => {
        const { RentalMutationError } =
          await import('@gb-locacoes/backend/rentals')
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
        for (const handler of testCase.methods) {
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
  }
)
