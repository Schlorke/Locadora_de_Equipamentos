import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { requestOwnerAction } from './owner-action'

it.each(['activate', 'cancel', 'undo-cancel'] as const)(
  'envia %s com chave, corpo vazio e recibo estrito',
  async (action) => {
    const fetcher = vi.fn(async () => Response.json({ accepted: true }))
    await requestOwnerAction(
      createHttpClient({ fetcher }),
      action,
      'fixture-request-1'
    )
    expect(fetcher).toHaveBeenCalledWith(
      `/api/admin/subscription/${action}`,
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        credentials: 'include',
        headers: expect.objectContaining({
          'Idempotency-Key': 'fixture-request-1',
          'Content-Type': 'application/json',
        }),
      })
    )
  }
)
it.each([
  [401, 'FRESH_SESSION_REQUIRED', 'reauthentication'],
  [401, 'UNAUTHENTICATED', 'session'],
  [403, 'OWNER_REQUIRED', 'owner'],
  [409, 'TENANT_REQUIRED', 'selection'],
  [409, 'CANCELLATION_ALREADY_DUE', 'changed'],
  [409, 'IDEMPOTENCY_KEY_REUSED', 'changed'],
  [409, 'BILLING_PROFILE_REQUIRED', 'profile'],
  [409, 'LEGAL_ACCEPTANCE_REQUIRED', 'legal'],
  [409, 'PROVIDER_ENVIRONMENT_CONFLICT', 'configuration'],
  [409, 'SUBSCRIPTION_NOT_ACTIVATABLE', 'changed'],
  [409, 'PLAN_NOT_AVAILABLE', 'offer'],
  [404, 'SUBSCRIPTION_NOT_FOUND', 'changed'],
  [429, 'RATE_LIMITED', 'rate'],
  [503, 'UNAVAILABLE', 'uncertain'],
] as const)(
  'classifica %s/%s sem publicar o erro privado',
  async (status, code, problem) => {
    const client = createHttpClient({
      fetcher: async () =>
        Response.json({ code, error: 'segredo privado' }, { status }),
    })
    await expect(
      requestOwnerAction(client, 'activate', 'fixture-request-1')
    ).rejects.toMatchObject({
      problem,
      message: 'Não foi possível confirmar o pedido da assinatura.',
    })
  }
)
it.each([{}, { accepted: false }, { accepted: true, extra: 'privado' }, null])(
  'não assume sucesso a partir de %j',
  async (body) => {
    const client = createHttpClient({
      fetcher: async () => Response.json(body),
    })
    await expect(
      requestOwnerAction(client, 'activate', 'fixture-request-1')
    ).rejects.toMatchObject({ problem: 'uncertain' })
  }
)
it('recusa chave inválida antes de enviar', async () => {
  const fetcher = vi.fn()
  await expect(
    requestOwnerAction(createHttpClient({ fetcher }), 'cancel', 'invalid key')
  ).rejects.toMatchObject({ problem: 'uncertain' })
  expect(fetcher).not.toHaveBeenCalled()
})

it('reativação envia somente a versão escolhida, sem preço, prazo ou locadora', async () => {
  const fetcher = vi.fn(async () => Response.json({ accepted: true }))
  await requestOwnerAction(
    createHttpClient({ fetcher }),
    'reactivate',
    'fixture-reactivation-1',
    { planVersionId: 'offer-fixture' }
  )
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/subscription/reactivate',
    expect.objectContaining({
      method: 'POST',
      body: '{"planVersionId":"offer-fixture"}',
      credentials: 'include',
      headers: expect.objectContaining({
        'Idempotency-Key': 'fixture-reactivation-1',
      }),
    })
  )
})
it.each([
  {},
  { planVersionId: '' },
  { planVersionId: 'a/b' },
  { planVersionId: 'offer-fixture', amount: '1.00' },
])('não envia reativação com entrada inválida %j', async (body) => {
  const fetcher = vi.fn()
  await expect(
    requestOwnerAction(
      createHttpClient({ fetcher }),
      'reactivate',
      'fixture-reactivation-1',
      JSON.parse(JSON.stringify(body))
    )
  ).rejects.toMatchObject({ problem: 'offer' })
  expect(fetcher).not.toHaveBeenCalled()
})
