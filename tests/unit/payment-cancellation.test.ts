import { cancelAttempt } from '../../packages/backend/src/modules/billing/cancel-attempt'
import { beforeEach, expect, it, vi } from 'vitest'
import { type CancellationState } from '@gb-locacoes/backend/billing'
import { BillingProviderError } from '../../packages/backend/src/modules/billing/asaas-http'
import { ReconciliationRequired } from '../../packages/backend/src/modules/billing/issue-payment'
let state: CancellationState
const charge = {
  id: 'pay-old',
  externalReference: 'tenant:old',
  value: 100,
  billingType: 'BOLETO',
  status: 'PENDING',
}
const gateway = { get: vi.fn(), cancel: vi.fn() }
const repository = {
  load: async () => ({
    id: 'old',
    externalId: charge.id,
    reference: charge.externalReference,
    amount: 100,
    state,
  }),
  claim: vi.fn(async () => {
    if (state !== 'REQUESTED') return false
    state = 'PROCESSING'
    return true
  }),
  unknown: vi.fn(async () => {
    state = 'UNKNOWN'
  }),
  release: vi.fn(async () => {
    if (state === 'PROCESSING') state = 'REQUESTED'
  }),
  confirmed: vi.fn(async () => {
    state = 'CONFIRMED'
  }),
  paid: vi.fn(),
}
beforeEach(() => {
  vi.clearAllMocks()
  // Sem respostas "once" de um caso anterior que falhou: cada linha da tabela é independente.
  gateway.get.mockReset()
  gateway.cancel.mockReset()
  state = 'REQUESTED'
  gateway.get.mockResolvedValue(charge)
  gateway.cancel.mockResolvedValue(undefined)
})
it('checks the stored charge before cancelling and acknowledges confirmed deletion', async () => {
  await cancelAttempt(repository, gateway)
  expect(gateway.get).toHaveBeenCalledExactlyOnceWith('pay-old')
  expect(gateway.cancel).toHaveBeenCalledExactlyOnceWith('pay-old')
  expect(state).toBe('CONFIRMED')
})
it('never repeats an uncertain DELETE while its remote result remains unconfirmed', async () => {
  gateway.cancel.mockRejectedValueOnce(new Error('timeout'))
  await expect(cancelAttempt(repository, gateway)).rejects.toThrow('timeout')
  expect(state).toBe('UNKNOWN')
  await expect(cancelAttempt(repository, gateway)).rejects.toBeInstanceOf(
    ReconciliationRequired
  )
  expect(gateway.cancel).toHaveBeenCalledTimes(1)
  gateway.get.mockResolvedValue({ ...charge, deleted: true })
  await cancelAttempt(repository, gateway)
  expect(repository.confirmed).toHaveBeenCalledTimes(1)
  expect(gateway.cancel).toHaveBeenCalledTimes(1)
})
it('does not interpret not-found or provider failure as successful cancellation', async () => {
  state = 'UNKNOWN'
  gateway.get.mockRejectedValue(new Error('404'))
  await expect(cancelAttempt(repository, gateway)).rejects.toThrow()
  expect(repository.confirmed).not.toHaveBeenCalled()
  expect(gateway.cancel).not.toHaveBeenCalled()
})
it('records an already paid charge without cancelling or issuing a replacement', async () => {
  gateway.get.mockResolvedValue({ ...charge, status: 'RECEIVED' })
  await cancelAttempt(repository, gateway)
  expect(repository.paid).toHaveBeenCalledTimes(1)
  expect(repository.confirmed).not.toHaveBeenCalled()
  expect(gateway.cancel).not.toHaveBeenCalled()
})
it('checks external identity, amount and method before cancelling', async () => {
  gateway.get.mockResolvedValue({
    ...charge,
    externalReference: 'another-payment',
  })
  await expect(cancelAttempt(repository, gateway)).rejects.toBeInstanceOf(
    ReconciliationRequired
  )
  expect(gateway.cancel).not.toHaveBeenCalled()
})
it('two workers cannot both start cancellation', async () => {
  const outcomes = await Promise.allSettled([
    cancelAttempt(repository, gateway),
    cancelAttempt(repository, gateway),
  ])
  expect(gateway.cancel).toHaveBeenCalledTimes(1)
  expect(outcomes.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
})
it('resumes committed cancellation without another network request', async () => {
  state = 'CONFIRMED'
  await cancelAttempt(repository, gateway)
  expect(repository.confirmed).toHaveBeenCalledExactlyOnceWith('old')
  expect(gateway.get).not.toHaveBeenCalled()
})
it.each([
  [
    '429',
    'timeout',
    new BillingProviderError('UNAVAILABLE', {
      reason: 'RATE_LIMITED',
      status: 429,
    }),
    new BillingProviderError('UNAVAILABLE', {
      reason: 'TIMEOUT',
      maybeApplied: true,
    }),
  ],
  // O DELETE aplicado com resposta estragada chega com maybeApplied=true (cliente HTTP e gateway);
  // o código INVALID_RESPONSE, sozinho, não decide nada.
  [
    '401',
    'resposta ilegível do DELETE',
    new BillingProviderError('REJECTED', {
      reason: 'AUTHENTICATION',
      status: 401,
    }),
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
      maybeApplied: true,
    }),
  ],
  [
    'resposta inválida sem efeito',
    'DELETE com corpo ilegível',
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'MALFORMED_BODY',
      status: 200,
    }),
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'MALFORMED_BODY',
      status: 200,
      maybeApplied: true,
    }),
  ],
  [
    'interruptor ligado',
    'erro desconhecido',
    new BillingProviderError('UNAVAILABLE', { reason: 'OUTBOUND_DISABLED' }),
    new Error('unexpected'),
  ],
])(
  'a DELETE proven not applied (%s) goes back to REQUESTED and is retried; one that may have been applied (%s) stays UNKNOWN',
  async (_released, _uncertain, notApplied, uncertain) => {
    gateway.cancel
      .mockRejectedValueOnce(notApplied)
      .mockRejectedValueOnce(uncertain)
    await expect(cancelAttempt(repository, gateway)).rejects.toBe(notApplied)
    expect(repository.release).toHaveBeenCalledExactlyOnceWith('old')
    expect(repository.unknown).not.toHaveBeenCalled()
    expect(state).toBe('REQUESTED')
    await expect(cancelAttempt(repository, gateway)).rejects.toBe(uncertain)
    expect(repository.release).toHaveBeenCalledTimes(1)
    expect(state).toBe('UNKNOWN')
    await expect(cancelAttempt(repository, gateway)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(gateway.cancel).toHaveBeenCalledTimes(2)
  }
)
