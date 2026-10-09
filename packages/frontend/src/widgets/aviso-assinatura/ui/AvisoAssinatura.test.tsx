// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_STATUSES } from '@gb-locacoes/contracts/subscription'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { subscriptionPresentation } from '../../../entities/assinatura'
import { OwnerSubscriptionNotice } from './AvisoAssinatura'
afterEach(cleanup)
it.each(SUBSCRIPTION_STATUSES)(
  'faixa apresenta %s por texto, sem consultar faturas',
  async (status) => {
    const fetcher = vi.fn(async () =>
      Response.json(subscriptionFixture(status))
    )
    render(
      <ApiClientProvider client={createHttpClient({ fetcher })}>
        <FrontendSessionFixture tenant={subscriptionTenant()}>
          <OwnerSubscriptionNotice />
        </FrontendSessionFixture>
      </ApiClientProvider>
    )
    await screen.findByText(subscriptionPresentation[status].label)
    expect(
      screen.getByText(subscriptionPresentation[status].message)
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Consultar assinatura' })
        .getAttribute('href')
    ).toBe('/admin/assinatura')
    expect(fetcher).toHaveBeenCalledTimes(1)
  }
)
it('equipe sem propriedade não recebe faixa comercial', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 })
  )
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <OwnerSubscriptionNotice />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('heading')).toBeNull()
})
