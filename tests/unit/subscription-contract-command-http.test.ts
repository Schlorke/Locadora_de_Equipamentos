import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ContractAccessError } from '@gb-locacoes/backend/documents'

const state = vi.hoisted(() => ({
  gate: vi.fn(),
  generate: vi.fn(),
  sign: vi.fn(),
}))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: state.gate }))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.gate,
}))
vi.mock('@/lib/contracts/service', async () => {
  const { ContractAccessError } = await import('@gb-locacoes/backend/documents')
  return {
    ContractAccessError,
    generateRentalContract: state.generate,
    requestContractSignature: state.sign,
  }
})
vi.mock('../../apps/services/api/src/host/contracts', () => ({
  generateRentalContract: state.generate,
  requestContractSignature: state.sign,
}))
vi.mock('@gb-locacoes/backend/identity', async (actual) => ({
  ...(await actual<typeof import('@gb-locacoes/backend/identity')>()),
  rejectCrossOriginMutation: () => null,
}))
import { POST as legacyGenerate } from '@/app/api/contracts/generate/route'
import { POST as legacySign } from '@/app/api/contracts/sign/route'
import { POST as apiGenerate } from '../../apps/services/api/src/app/api/contracts/generate/route'
import { POST as apiSign } from '../../apps/services/api/src/app/api/contracts/sign/route'

const principal = {
  tenantId: 'tenant',
  userId: 'owner',
  role: 'ADMIN',
  membershipId: 'member',
}
const id = '11111111-1111-4111-8111-111111111111'
const request = (body: unknown) =>
  new NextRequest('https://api.example.test/api/contracts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.resetAllMocks()
  state.gate.mockResolvedValue({ ok: true, principal })
  state.generate.mockResolvedValue({ id: 'contract', status: 'DRAFT' })
  state.sign.mockResolvedValue({
    contract: { id: 'contract' },
    queued: true,
    requestId: 'event',
  })
})
describe.each([
  {
    name: 'generate',
    handlers: [legacyGenerate, apiGenerate],
    call: state.generate,
    body: { rentalId: id },
    status: 200,
  },
  {
    name: 'sign',
    handlers: [legacySign, apiSign],
    call: state.sign,
    body: { contractId: id },
    status: 202,
  },
])('$name contract command parity', ({ handlers, call, body, status }) => {
  it.each([402, 403, 503])(
    'preserves subscription refusal %i and private cache',
    async (status) => {
      const policy = {
        error: 'Synthetic subscription refusal',
        code: 'SUBSCRIPTION_RESTRICTED' as const,
      }
      call.mockRejectedValue(
        new ContractAccessError(status, policy.error, policy)
      )
      for (const handler of handlers) {
        const response = await handler(request(body))
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(policy)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('vary')).toBe('Cookie, Host')
      }
    }
  )
  it('keeps successful response and principal', async () => {
    const responses = []
    for (const handler of handlers) {
      const response = await handler(request(body))
      expect(response.status).toBe(status)
      responses.push(await response.json())
    }
    expect(responses[0]).toEqual(responses[1])
    expect(call).toHaveBeenCalledWith(principal, id)
  })
  it.each([403, 404, 409, 503])(
    'retains old domain error %i without subscription envelope',
    async (status) => {
      call.mockRejectedValue(
        new ContractAccessError(status, 'Synthetic domain error')
      )
      for (const handler of handlers) {
        const response = await handler(request(body))
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual({
          error: 'Synthetic domain error',
        })
        expect(response.headers.get('vary')).toBeNull()
      }
    }
  )
  it('rejects principal before body and command', async () => {
    state.gate.mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'No session' }, { status: 401 }),
    })
    for (const handler of handlers)
      expect((await handler(request(null))).status).toBe(401)
    expect(call).not.toHaveBeenCalled()
  })
})
