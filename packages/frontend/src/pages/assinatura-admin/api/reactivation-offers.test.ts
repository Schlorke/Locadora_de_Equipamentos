import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { subscriptionOfferFixture } from '../../../../../../tests/helpers/subscription-account'
import { readReactivationOffers } from './reactivation-offers'

it('consulta contrato público e oferece somente mensal, sem deduzir preço ou hierarquia', async () => {
  const monthly = subscriptionOfferFixture(),
    yearly = subscriptionOfferFixture({
      planVersionId: 'yearly',
      interval: 'YEARLY',
    })
  const fetcher = vi.fn(async () => Response.json({ plans: [yearly, monthly] }))
  expect(await readReactivationOffers(createHttpClient({ fetcher }))).toEqual([
    monthly,
  ])
  expect(fetcher).toHaveBeenCalledWith(
    '/api/public/plans',
    expect.objectContaining({
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  )
})
it.each([
  [503, { error: 'privado' }],
  [200, { plans: [subscriptionOfferFixture({ amount: '0.00' })] }],
  [200, { plans: [{ ...subscriptionOfferFixture(), tenantId: 'privado' }] }],
  [200, {}],
])(
  'recusa resposta inválida sem publicar conteúdo privado (%s)',
  async (status, body) => {
    await expect(
      readReactivationOffers(
        createHttpClient({
          fetcher: async () => Response.json(body, { status }),
        })
      )
    ).rejects.toThrow('Catálogo indisponível.')
  }
)
it('catálogo vazio continua vazio, sem inventar oferta', async () => {
  expect(
    await readReactivationOffers(
      createHttpClient({ fetcher: async () => Response.json({ plans: [] }) })
    )
  ).toEqual([])
})
