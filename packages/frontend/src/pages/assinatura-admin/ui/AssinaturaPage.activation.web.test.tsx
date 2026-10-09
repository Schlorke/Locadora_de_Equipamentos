// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import {
  invoiceFixture,
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { AssinaturaAdminPage } from './AssinaturaPage.web'

afterEach(cleanup)
function setup(
  command: (path: string, init?: RequestInit) => Promise<Response>,
  status: 'INCOMPLETE' | 'TRIALING' = 'INCOMPLETE'
) {
  const summary = subscriptionFixture(status)
  let invoiced = false
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const response = await command(path, init)
      if (response.ok) invoiced = true
      return response
    }
    return Response.json(
      path.endsWith('/invoices')
        ? { invoices: invoiced ? [invoiceFixture()] : [] }
        : summary
    )
  })
  const client = createHttpClient({ fetcher })
  const page = (slug = 'alfa') => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={subscriptionTenant(slug)}>
        <AssinaturaAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  return { ...render(page()), page, fetcher, summary }
}

it.each(['INCOMPLETE', 'TRIALING'] as const)(
  'confirma plano e mensalidade em %s e relê a cobrança sem presumir pagamento',
  async (status) => {
    const command = vi.fn(async (_path: string, _init?: RequestInit) =>
      Response.json({ accepted: true })
    )
    const { fetcher } = setup(command, status)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ativar assinatura' })
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText(/plano Plano de teste por R\$ 199,90/)).toBeTruthy()
    expect(
      screen.getByText(/O pagamento é confirmado separadamente/)
    ).toBeTruthy()
    expect(command).not.toHaveBeenCalled()
    expect(
      (
        screen
          .getByText('Cancelar assinatura')
          .closest('button') as HTMLButtonElement
      ).disabled
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
    await screen.findByText(
      'Pedido de ativação registrado. Consulte as faturas; o pagamento ainda precisa ser confirmado.'
    )
    await screen.findByRole('link', { name: /Ver fatura no Asaas/ })
    expect(screen.getByText('Pendente', { exact: true })).toBeTruthy()
    expect(command).toHaveBeenCalledTimes(1)
    expect(command.mock.calls[0]?.[0]).toBe('/api/admin/subscription/activate')
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method !== 'POST')
    ).toHaveLength(4)
    expect(screen.queryByText('Ativa', { exact: true })).toBeNull()
  }
)

it('Voltar não envia; a ativação só acontece após nova confirmação', async () => {
  const command = vi.fn(async () => Response.json({ accepted: true }))
  setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ativar assinatura' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(command).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Ativar assinatura' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
  await screen.findByText(/Pedido de ativação registrado/)
  expect(command).toHaveBeenCalledTimes(1)
})

it.each([
  ['BILLING_PROFILE_REQUIRED', /Complete os dados de cobrança/],
  [
    'LEGAL_ACCEPTANCE_REQUIRED',
    /Os aceites dos termos da plataforma estão incompletos/,
  ],
  ['PROVIDER_ENVIRONMENT_CONFLICT', /A ativação está indisponível/],
] as const)(
  'explica %s sem expor detalhes nem repetir automaticamente',
  async (code, message) => {
    const command = vi.fn(async () =>
      Response.json({ code, error: 'segredo privado' }, { status: 409 })
    )
    setup(command)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ativar assinatura' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
    await screen.findByText(message)
    expect(screen.queryByText('segredo privado')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(command).toHaveBeenCalledTimes(1)
  }
)

it('reauth exige novo login e revisão, sem transportar comando ou chave no link', async () => {
  const command = vi.fn(async () =>
    Response.json({ code: 'FRESH_SESSION_REQUIRED' }, { status: 401 })
  )
  setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ativar assinatura' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
  const link = await screen.findByRole('link', { name: 'Entrar novamente' })
  const url = new URL((link as HTMLAnchorElement).href)
  expect(url.pathname).toBe('/login')
  expect([...url.searchParams.keys()].sort()).toEqual([
    'callbackUrl',
    'reauthenticate',
  ])
  expect(url.searchParams.get('callbackUrl')).toBe(
    '/admin/assinatura?locadora=alfa'
  )
  expect(command).toHaveBeenCalledTimes(1)
})

it('resultado incerto bloqueia cancelamento e só repete activate com a mesma chave após novo clique', async () => {
  const command = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ativar assinatura' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
  await screen.findByRole('button', { name: 'Repetir o mesmo pedido' })
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(
    (
      screen.getByRole('button', {
        name: 'Cancelar assinatura',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Ativar assinatura' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Repetir o mesmo pedido' })
  )
  await screen.findByText(/Pedido de ativação registrado/)
  expect(command.mock.calls.map((call) => call[0])).toEqual([
    '/api/admin/subscription/activate',
    '/api/admin/subscription/activate',
  ])
  const keys = command.mock.calls.map((call) =>
    new Headers(call[1]?.headers).get('Idempotency-Key')
  )
  expect(keys[0]).toBeTruthy()
  expect(keys[1]).toBe(keys[0])
})

it('resposta tardia de ativação não aparece na outra locadora', async () => {
  let finish!: (response: Response) => void
  const command = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { rerender, page } = setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Ativar assinatura' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }))
  await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
  rerender(page('bravo'))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  await act(async () => finish(Response.json({ accepted: true })))
  await screen.findByText('Plano e faturas de Locadora bravo')
  expect(screen.queryByText(/Pedido de ativação registrado/)).toBeNull()
})
