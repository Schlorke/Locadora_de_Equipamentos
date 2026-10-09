// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_STATUSES } from '@gb-locacoes/contracts/subscription'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  invoiceFixture,
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { subscriptionPresentation } from '../../../entities/assinatura'
import { AssinaturaAdminPage } from './AssinaturaPage.web'
afterEach(cleanup)
function setup(
  options: {
    status?: (typeof SUBSCRIPTION_STATUSES)[number]
    summaryStatus?: number
    summary?: unknown
    invoices?: unknown
    invoiceStatus?: number
  } = {}
) {
  const fetcher = vi.fn(async (path: string) =>
    Response.json(
      path.endsWith('/invoices')
        ? (options.invoices ?? { invoices: [invoiceFixture()] })
        : (options.summary ?? subscriptionFixture(options.status)),
      {
        status: path.endsWith('/invoices')
          ? (options.invoiceStatus ?? 200)
          : (options.summaryStatus ?? 200),
      }
    )
  )
  render(
    <ApiClientProvider client={createHttpClient({ fetcher })}>
      <FrontendSessionFixture tenant={subscriptionTenant()}>
        <AssinaturaAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  return fetcher
}
it.each(SUBSCRIPTION_STATUSES)(
  'apresenta %s com texto e sem inferir acesso por cor',
  async (status) => {
    setup({ status })
    expect(screen.getByRole('status').textContent).toContain('Consultando')
    await screen.findByText(subscriptionPresentation[status].label)
    expect(
      screen.getByText(subscriptionPresentation[status].message)
    ).toBeTruthy()
    expect(screen.getByText('Plano de teste')).toBeTruthy()
    expect(screen.getByText('R$ 199,90 / mês')).toBeTruthy()
    expect(screen.getByText('7 de 30')).toBeTruthy()
    expect(screen.getByText('2 de ilimitadas')).toBeTruthy()
    expect(screen.getByText('15/10/2026')).toBeTruthy()
    const link = screen.getByRole('link', {
      name: /Ver fatura no Asaas/,
    }) as HTMLAnchorElement
    expect(link.href).toBe('https://www.asaas.com/i/fixture')
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')
    expect(link.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(
      Boolean(screen.queryByRole('button', { name: 'Ativar assinatura' }))
    ).toBe(status === 'INCOMPLETE' || status === 'TRIALING')
    expect(screen.queryByRole('button', { name: 'Trocar plano' })).toBeNull()
    expect(
      Boolean(screen.queryByRole('button', { name: 'Cancelar assinatura' }))
    ).toBe(status !== 'CANCELED')
  }
)
it('mostra plano agendado, cortesia e cancelamento sem calcular preço novo', async () => {
  setup({
    summary: {
      ...subscriptionFixture(),
      billingMode: 'COMPLIMENTARY',
      complimentaryUntil: '2026-12-01',
      cancelAtPeriodEnd: true,
      scheduledPlan: {
        ...subscriptionFixture().plan,
        name: 'Outro plano de teste',
      },
      scheduledChangeAt: '2026-11-01',
    },
  })
  await screen.findByText('Cortesia')
  expect(
    screen.getByText(/Outro plano de teste, a partir de 01\/11\/2026/)
  ).toBeTruthy()
  expect(
    screen.getByText('Cancelamento agendado para o fim do período atual.')
  ).toBeTruthy()
  expect(screen.getByText('01/12/2026')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Desfazer cancelamento' })
  ).toBeTruthy()
})
it.each([
  [401, 'Entre na sua conta'],
  [403, 'dono atual'],
  [409, 'Selecione uma locadora'],
] as const)(
  'recusa %s sem montar plano/faturas',
  async (summaryStatus, message) => {
    setup({
      summaryStatus,
      summary: { code: 'TENANT_REQUIRED', error: 'detalhe privado' },
    })
    await screen.findByText(new RegExp(message))
    expect(screen.queryByText('Plano de teste')).toBeNull()
    expect(screen.queryByRole('link', { name: /Asaas/ })).toBeNull()
    expect(screen.queryByText('detalhe privado')).toBeNull()
  }
)
it('legado sem assinatura não recebe plano fictício e conserva faturas anteriores', async () => {
  setup({ summaryStatus: 404, summary: { code: 'SUBSCRIPTION_NOT_FOUND' } })
  await screen.findByText(
    'Esta locadora ainda não tem uma assinatura cadastrada.'
  )
  expect(screen.queryByText('Plano atual')).toBeNull()
  expect(screen.getByText('Faturas da plataforma')).toBeTruthy()
})
it('fatura vazia difere de erro e o retry refaz as duas consultas', async () => {
  const fetcher = setup({ invoices: { invoices: [] } })
  await screen.findByText('Nenhuma fatura cadastrada.')
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar consulta' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
  await screen.findByText('Nenhuma fatura cadastrada.')
})
it('a recusa de faturas invalida o resumo obtido em paralelo', async () => {
  setup({ invoices: { code: 'OWNER_REQUIRED' }, invoiceStatus: 403 })
  await screen.findByText(/dono atual/)
  expect(screen.queryByText('Plano de teste')).toBeNull()
})
it('URL inválida gera erro neutro e retry, sem montar link inseguro', async () => {
  const fetcher = setup({
    invoices: {
      invoices: [invoiceFixture({ invoiceUrl: 'javascript:alert(1)' })],
    },
  })
  await screen.findByRole('button', { name: 'Tentar novamente' })
  expect(screen.queryByRole('link')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
})
it('exibe estados históricos inclusive estorno/cancelamento sem oferecer reemissão', async () => {
  setup({
    invoices: {
      invoices: [
        invoiceFixture({
          id: 'refunded',
          status: 'REFUNDED',
          invoiceUrl: null,
        }),
        invoiceFixture({
          id: 'canceled',
          status: 'CANCELED',
          canceledReason: 'PROVIDER_DELETED',
          invoiceUrl: null,
        }),
      ],
    },
  })
  await screen.findByText('Estornada')
  expect(screen.getByText('Cancelada')).toBeTruthy()
  expect(screen.getAllByText('Link da fatura indisponível.')).toHaveLength(2)
  expect(screen.queryByRole('button', { name: /emitir/i })).toBeNull()
})
