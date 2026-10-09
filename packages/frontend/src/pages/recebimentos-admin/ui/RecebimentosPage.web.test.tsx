// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  PAYMENT_ACCOUNT_STATUSES,
  PAYMENT_ACCOUNT_HEALTH_ISSUES,
} from '@gb-locacoes/contracts/payment-account'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { subscriptionTenant } from '../../../../../../tests/helpers/subscription-account'
import {
  receivingStatus,
  receivingHealth,
} from '../../../entities/conta-recebimentos'
import { RecebimentosAdminPage } from './RecebimentosPage.web'
afterEach(cleanup)
const account = {
  kind: 'CONNECTED',
  status: 'APPROVED',
  environment: 'sandbox',
  healthIssue: null,
  providerStatusText: null,
  commercialInfoExpiresAt: null,
  commercialInfoExpired: false,
  approvedAt: null,
  lastSyncedAt: null,
}
function setup(body: unknown = { account }, status = 200) {
  const fetcher = vi.fn(async (_path: string) =>
    Response.json(body, { status })
  )
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <RecebimentosAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  return fetcher
}
it.each(PAYMENT_ACCOUNT_STATUSES)(
  'shows actual %s and no effect controls',
  async (status) => {
    const fetcher = setup({ account: { ...account, status } })
    await screen.findByText(receivingStatus[status].label)
    expect(screen.getByText(receivingStatus[status].message)).toBeTruthy()
    expect(screen.getByText('Ambiente de testes')).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: /Ativar|Conectar|Sacar|Enviar documentos/,
      })
    ).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar consulta' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(
      fetcher.mock.calls.every(
        (call) => call[0] === '/api/admin/payment-account'
      )
    ).toBe(true)
  }
)
it.each(PAYMENT_ACCOUNT_HEALTH_ISSUES)(
  'shows %s in plain language',
  async (healthIssue) => {
    setup({ account: { ...account, status: 'RESTRICTED', healthIssue } })
    await screen.findByText(receivingHealth[healthIssue])
    expect(screen.getByText('Recebimentos restritos')).toBeTruthy()
  }
)
it('distinguishes absence, retryable failure and ownership refusal without provider text', async () => {
  setup({ account: null })
  await screen.findByText(
    'Nenhuma conta de recebimentos conectada a esta locadora.'
  )
  cleanup()
  const fetcher = setup({ error: 'private-provider-key' }, 503)
  await screen.findByRole('button', { name: 'Tentar novamente' })
  expect(screen.queryByText('private-provider-key')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  cleanup()
  setup({}, 403)
  await screen.findByText('Esta consulta é exclusiva do dono da locadora.')
  expect(screen.queryByRole('button')).toBeNull()
})
it('escapes contract text and immediately discards the account after tenant/session replacement', async () => {
  const pending: Array<(response: Response) => void> = []
  const fetcher = vi.fn(
    (_path: string) => new Promise<Response>((resolve) => pending.push(resolve))
  )
  const client = createHttpClient({ fetcher })
  const tree = (id: string, userId: string) => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={subscriptionTenant(id)} userId={userId}>
        <RecebimentosAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const rendered = render(tree('alfa', 'owner-a'))
  await waitFor(() => expect(pending).toHaveLength(1))
  pending[0]!(
    Response.json({
      account: {
        ...account,
        providerStatusText: '<img src=x onerror=private-secret>',
      },
    })
  )
  await screen.findByText('<img src=x onerror=private-secret>')
  expect(document.querySelector('img[onerror]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consulta' }))
  await waitFor(() => expect(pending).toHaveLength(2))
  rendered.rerender(tree('bravo', 'owner-b'))
  expect(screen.queryByText('<img src=x onerror=private-secret>')).toBeNull()
  await waitFor(() => expect(pending).toHaveLength(3))
  pending[1]!(
    Response.json({
      account: { ...account, providerStatusText: 'Dados privados antigos' },
    })
  )
  pending[2]!(Response.json({ account: null }))
  await screen.findByText(
    'Nenhuma conta de recebimentos conectada a esta locadora.'
  )
  expect(screen.queryByText('Dados privados antigos')).toBeNull()
})
