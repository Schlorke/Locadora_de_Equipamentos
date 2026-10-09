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
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { AssinaturaAdminPage } from './AssinaturaPage.web'

afterEach(cleanup)
function setup(
  command: (input: string, init?: RequestInit) => Promise<Response>,
  scheduled = false
) {
  const summary = { ...subscriptionFixture(), cancelAtPeriodEnd: scheduled }
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === 'POST') return command(input, init)
    return Response.json(
      input.endsWith('/invoices') ? { invoices: [] } : summary
    )
  })
  const client = createHttpClient({ fetcher })
  const renderPage = (slug = 'alfa') => (
    <ApiClientProvider client={client}>
      <FrontendSessionFixture tenant={subscriptionTenant(slug)}>
        <AssinaturaAdminPage />
      </FrontendSessionFixture>
    </ApiClientProvider>
  )
  const rendered = render(renderPage())
  return { summary, fetcher, ...rendered, renderPage }
}
it.each([false, true])(
  'confirma explicitamente %s, informa efeito e relê resumo/faturas após accepted',
  async (scheduled) => {
    const command = vi.fn(async (_input: string, _init?: RequestInit) =>
      Response.json({ accepted: true })
    )
    const { summary, fetcher } = setup(command, scheduled)
    fireEvent.click(
      await screen.findByRole('button', {
        name: scheduled ? 'Desfazer cancelamento' : 'Cancelar assinatura',
      })
    )
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(command).not.toHaveBeenCalled()
    expect(
      (screen.getByText('Atualizar consulta') as HTMLButtonElement).disabled
    ).toBe(true)
    if (!scheduled)
      expect(
        screen.getByText(/Faturas e dívidas existentes não serão apagadas/)
      ).toBeTruthy()
    summary.cancelAtPeriodEnd = !scheduled
    fireEvent.click(
      screen.getByRole('button', {
        name: scheduled ? 'Confirmar desfazimento' : 'Confirmar cancelamento',
      })
    )
    await screen.findByText(
      'Pedido registrado. Confira o estado atualizado da assinatura.'
    )
    await screen.findByRole('button', {
      name: scheduled ? 'Cancelar assinatura' : 'Desfazer cancelamento',
    })
    expect(command).toHaveBeenCalledTimes(1)
    expect(command.mock.calls[0]?.[0]).toBe(
      `/api/admin/subscription/${scheduled ? 'undo-cancel' : 'cancel'}`
    )
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method !== 'POST')
    ).toHaveLength(4)
  }
)
it('Voltar não envia; a recusa de autenticação abre link interno sem transmitir pedido', async () => {
  const command = vi.fn(async (_input: string, _init?: RequestInit) =>
    Response.json(
      { code: 'FRESH_SESSION_REQUIRED', error: 'privado' },
      { status: 401 }
    )
  )
  setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancelar assinatura' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(command).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar assinatura' }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar cancelamento' })
  )
  const link = await screen.findByRole('link', { name: 'Entrar novamente' })
  const url = new URL((link as HTMLAnchorElement).href)
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('reauthenticate')).toBe('1')
  expect(url.searchParams.get('callbackUrl')).toBe(
    '/admin/assinatura?locadora=alfa'
  )
  expect([...url.searchParams.keys()].sort()).toEqual([
    'callbackUrl',
    'reauthenticate',
  ])
  expect(screen.queryByText('privado')).toBeNull()
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(command).toHaveBeenCalledTimes(1)
})
it('falha de conexão permite repetir com a mesma chave, sem retry automático', async () => {
  const command = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancelar assinatura' })
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar cancelamento' })
  )
  await screen.findByRole('button', { name: 'Repetir o mesmo pedido' })
  expect(command).toHaveBeenCalledTimes(1)
  fireEvent.click(
    screen.getByRole('button', { name: 'Repetir o mesmo pedido' })
  )
  await screen.findByText(
    'Pedido registrado. Confira o estado atualizado da assinatura.'
  )
  expect(command).toHaveBeenCalledTimes(2)
  const keys = command.mock.calls.map((call) =>
    new Headers(call[1]?.headers).get('Idempotency-Key')
  )
  expect(keys[0]).toBeTruthy()
  expect(keys[1]).toBe(keys[0])
})
it('pedido pendente não fecha nem duplica, e a locadora nova não recebe confirmação antiga', async () => {
  let finish!: (response: Response) => void
  const command = vi.fn(
    (_input: string, _init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { rerender, renderPage } = setup(command)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Cancelar assinatura' })
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar cancelamento' })
  )
  const confirm = screen.getByRole('button', {
    name: 'Confirmar cancelamento',
  }) as HTMLButtonElement
  const back = screen.getByRole('button', {
    name: 'Voltar',
  }) as HTMLButtonElement
  expect(confirm.disabled).toBe(true)
  expect(back.disabled).toBe(true)
  fireEvent.click(confirm)
  await waitFor(() => expect(command).toHaveBeenCalledTimes(1))
  rerender(renderPage('bravo'))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  await act(async () => finish(Response.json({ accepted: true })))
  await screen.findByText('Plano e faturas de Locadora bravo')
  await waitFor(() =>
    expect(screen.queryByText(/Pedido registrado/)).toBeNull()
  )
})
