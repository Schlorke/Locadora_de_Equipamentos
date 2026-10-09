import { beforeEach, expect, it, vi } from 'vitest'
import { BillingProviderError } from '../../packages/backend/src/modules/billing/asaas-http'
import {
  ChargeRequestRejected,
  issuePayment,
  ReconciliationRequired,
  type IssuanceAttempt,
} from '../../packages/backend/src/modules/billing/issue-payment'
const request = {
  reference: 'tenant-a:payment:1',
  amount: 120,
  dueDate: '2030-01-10',
  description: 'Fixture',
  method: 'PIX' as const,
  customer: {
    name: 'Fixture',
    email: 'fixture@example.test',
    document: '12345678909',
  },
}
const remote = {
  id: 'pay-1',
  externalReference: request.reference,
  value: 120,
  billingType: 'PIX',
  status: 'PENDING',
}
// FAILED: recusa definitiva gravada por `reject`; a aplicação nunca entrega essa tentativa à emissão.
let state: IssuanceAttempt['state'] | 'FAILED'
const gateway = { find: vi.fn(), create: vi.fn(), details: vi.fn() }
const repository = {
  load: async () => ({
    id: 'attempt-1',
    state: state as IssuanceAttempt['state'],
    request,
  }),
  claim: vi.fn(async () => {
    if (state !== 'QUEUED') return false
    state = 'PROCESSING'
    return true
  }),
  unknown: vi.fn(async () => {
    state = 'UNKNOWN'
  }),
  release: vi.fn(async () => {
    if (state === 'PROCESSING') state = 'QUEUED'
  }),
  reject: vi.fn(async (_id: string, _error: BillingProviderError) => {
    if (state === 'PROCESSING') state = 'FAILED'
  }),
  // Sem `unknownSince` a conciliação por janela nunca é pedida nestes casos.
  requeue: vi.fn(async () => {
    if (state !== 'UNKNOWN') return false
    state = 'QUEUED'
    return true
  }),
  issued: vi.fn(async () => {
    state = 'ISSUED'
  }),
}
beforeEach(() => {
  vi.clearAllMocks()
  // Sem respostas "once" de um caso anterior que falhou: cada linha da tabela é independente.
  gateway.find.mockReset()
  gateway.create.mockReset()
  gateway.details.mockReset()
  state = 'QUEUED'
  gateway.find.mockResolvedValue(null)
  gateway.create.mockResolvedValue(remote)
  gateway.details.mockResolvedValue({
    pixCode: 'provider-code',
    pixQrCode: 'provider-image',
  })
})
it('records an uncertain issuance and never repeats its POST without reconciliation', async () => {
  gateway.create.mockRejectedValueOnce(new Error('provider timeout'))
  await expect(issuePayment(repository, gateway)).rejects.toThrow(
    'provider timeout'
  )
  expect(state).toBe('UNKNOWN')
  await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
    ReconciliationRequired
  )
  expect(gateway.create).toHaveBeenCalledTimes(1)
  expect(repository.requeue).not.toHaveBeenCalled()
  gateway.find.mockResolvedValue(remote)
  await issuePayment(repository, gateway)
  expect(repository.issued).toHaveBeenCalledWith('attempt-1', remote, {
    pixCode: 'provider-code',
    pixQrCode: 'provider-image',
  })
  expect(gateway.create).toHaveBeenCalledTimes(1)
})
it('a crash after provider success is recovered by external reference', async () => {
  state = 'PROCESSING'
  gateway.find.mockResolvedValue(remote)
  await issuePayment(repository, gateway)
  expect(gateway.create).not.toHaveBeenCalled()
  expect(repository.issued).toHaveBeenCalledTimes(1)
})
it('two simultaneous deliveries cannot both issue the same attempt', async () => {
  const results = await Promise.allSettled([
    issuePayment(repository, gateway),
    issuePayment(repository, gateway),
  ])
  expect(gateway.create).toHaveBeenCalledTimes(1)
  expect(
    results.filter((result) => result.status === 'fulfilled')
  ).toHaveLength(1)
})
it('does not attach an ambiguous provider charge with a different amount or reference', async () => {
  gateway.find.mockResolvedValue({ ...remote, value: 999 })
  await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
    ReconciliationRequired
  )
  expect(repository.issued).not.toHaveBeenCalled()
  expect(gateway.create).not.toHaveBeenCalled()
})
it.each([
  [
    '429 no GET /customers',
    'timeout depois do POST',
    new BillingProviderError('UNAVAILABLE', {
      reason: 'RATE_LIMITED',
      status: 429,
    }),
    new BillingProviderError('UNAVAILABLE', {
      reason: 'TIMEOUT',
      maybeApplied: true,
    }),
  ],
  [
    '401 com chave revogada',
    '5xx numa escrita',
    new BillingProviderError('REJECTED', {
      reason: 'AUTHENTICATION',
      status: 401,
    }),
    new BillingProviderError('UNAVAILABLE', {
      reason: 'PROVIDER_ERROR',
      status: 502,
      maybeApplied: true,
    }),
  ],
  // A resposta estragada de uma escrita chega com maybeApplied=true (cliente HTTP e gateway);
  // a de uma leitura, com maybeApplied=false: o código INVALID_RESPONSE não decide nada.
  [
    '403 no POST /customers',
    'resposta ilegível do POST',
    new BillingProviderError('REJECTED', { reason: 'FORBIDDEN', status: 403 }),
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'MALFORMED_BODY',
      status: 200,
      maybeApplied: true,
    }),
  ],
  [
    'resposta ilegível do GET /customers',
    'forma inesperada depois do POST',
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'MALFORMED_BODY',
      status: 200,
    }),
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
      maybeApplied: true,
    }),
  ],
  [
    'forma inesperada do GET /customers',
    'erro sem maybeApplied que não é do provedor',
    new BillingProviderError('INVALID_RESPONSE', {
      reason: 'UNEXPECTED_SHAPE',
    }),
    new TypeError('cannot read properties of undefined'),
  ],
  [
    'interruptor ligado',
    'erro desconhecido',
    new BillingProviderError('UNAVAILABLE', { reason: 'OUTBOUND_DISABLED' }),
    new Error('unexpected'),
  ],
])(
  '%s is proven not applied: back to QUEUED and retried; then %s may have been applied: UNKNOWN, never another POST',
  async (_released, _uncertain, notApplied, uncertain) => {
    gateway.create
      .mockRejectedValueOnce(notApplied)
      .mockRejectedValueOnce(uncertain)
    await expect(issuePayment(repository, gateway)).rejects.toBe(notApplied)
    expect(repository.release).toHaveBeenCalledExactlyOnceWith('attempt-1')
    expect(repository.unknown).not.toHaveBeenCalled()
    expect(repository.reject).not.toHaveBeenCalled()
    expect(state).toBe('QUEUED')
    await expect(issuePayment(repository, gateway)).rejects.toBe(uncertain)
    expect(repository.release).toHaveBeenCalledTimes(1)
    expect(state).toBe('UNKNOWN')
    await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(gateway.create).toHaveBeenCalledTimes(2)
    gateway.find.mockResolvedValue(remote)
    await issuePayment(repository, gateway)
    expect(state).toBe('ISSUED')
    expect(gateway.create).toHaveBeenCalledTimes(2)
  }
)
// Achado 116, segunda rodada: o pedido recusado (400 do Asaas, ou recusado pela validação local
// depois da reserva) dá sempre a mesma recusa. Voltar à fila fazia a religação repeti-lo para sempre.
it.each([
  [
    '400 no POST /payments (vencimento no passado)',
    new BillingProviderError('REJECTED', {
      reason: 'VALIDATION',
      status: 400,
      providerCodes: ['invalid_dueDate'],
    }),
  ],
  [
    '400 no POST /customers (e-mail recusado)',
    new BillingProviderError('REJECTED', {
      reason: 'VALIDATION',
      status: 400,
      providerCodes: ['invalid_email'],
    }),
  ],
  [
    'pedido recusado pelo cliente HTTP antes da rede',
    new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' }),
  ],
])(
  '%s: a tentativa encerra (reject), nunca volta à fila nem fica incerta, e nenhuma rodada seguinte faz POST',
  async (_label, rejection) => {
    gateway.create.mockRejectedValueOnce(rejection)
    // A recusa sai como o erro próprio do domínio (o único que a aplicação encerra), com os códigos do Asaas.
    const refused = await issuePayment(repository, gateway).then(
      () => null,
      (error: unknown) => error
    )
    expect(refused).toBeInstanceOf(ChargeRequestRejected)
    expect(refused).toMatchObject({
      code: rejection.code,
      reason: rejection.reason,
      status: rejection.status,
      providerCodes: rejection.providerCodes,
      maybeApplied: false,
    })
    expect(repository.reject).toHaveBeenCalledTimes(1)
    expect(repository.reject.mock.calls[0]![0]).toBe('attempt-1')
    expect(repository.reject.mock.calls[0]![1]).toBe(refused)
    expect(repository.release).not.toHaveBeenCalled()
    expect(repository.unknown).not.toHaveBeenCalled()
    expect(state).toBe('FAILED')
    await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(gateway.create).toHaveBeenCalledTimes(1)
  }
)
// Achado 125: só a recusa do PEDIDO encerra. Um 400 numa leitura (a busca pela referência, os dados
// do PIX/boleto de uma cobrança que o Asaas já aceitou) é passageiro: nunca vira ChargeRequestRejected,
// nunca encerra nem devolve a tentativa, e a rodada seguinte concilia pela referência.
const readRejection = () =>
  new BillingProviderError('REJECTED', {
    reason: 'VALIDATION',
    status: 400,
    providerCodes: ['invalid_action'],
  })
it('400 nos dados da cobrança depois do POST aceito: sai como falha passageira, a tentativa fica reservada e a rodada seguinte vincula sem outro POST', async () => {
  const failure = readRejection()
  gateway.details.mockRejectedValueOnce(failure)
  const error = await issuePayment(repository, gateway).then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBe(failure)
  expect(error).not.toBeInstanceOf(ChargeRequestRejected)
  expect(repository.reject).not.toHaveBeenCalled()
  expect(repository.release).not.toHaveBeenCalled()
  expect(repository.unknown).not.toHaveBeenCalled()
  expect(repository.issued).not.toHaveBeenCalled()
  expect(state).toBe('PROCESSING')
  // A cobrança existe no Asaas: a próxima rodada a acha pela referência e vincula.
  gateway.find.mockResolvedValue(remote)
  await issuePayment(repository, gateway)
  expect(repository.issued).toHaveBeenCalledExactlyOnceWith(
    'attempt-1',
    remote,
    { pixCode: 'provider-code', pixQrCode: 'provider-image' }
  )
  expect(state).toBe('ISSUED')
  expect(gateway.create).toHaveBeenCalledTimes(1)
})
it('400 na busca pela referência: sai como falha passageira, sem reserva, e a rodada seguinte emite uma vez', async () => {
  const failure = readRejection()
  gateway.find.mockRejectedValueOnce(failure)
  const error = await issuePayment(repository, gateway).then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBe(failure)
  expect(error).not.toBeInstanceOf(ChargeRequestRejected)
  expect(repository.claim).not.toHaveBeenCalled()
  expect(repository.reject).not.toHaveBeenCalled()
  expect(state).toBe('QUEUED')
  await issuePayment(repository, gateway)
  expect(state).toBe('ISSUED')
  expect(gateway.create).toHaveBeenCalledTimes(1)
})
it('400 na busca pela referência de uma cobrança já aceita (reserva em curso): passageiro, e a rodada seguinte vincula', async () => {
  state = 'PROCESSING'
  gateway.find.mockRejectedValueOnce(readRejection()).mockResolvedValue(remote)
  const error = await issuePayment(repository, gateway).then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).not.toBeInstanceOf(ChargeRequestRejected)
  expect(repository.reject).not.toHaveBeenCalled()
  expect(state).toBe('PROCESSING')
  await issuePayment(repository, gateway)
  expect(state).toBe('ISSUED')
  expect(gateway.create).not.toHaveBeenCalled()
})
