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
import {
  ApiClientProvider,
  createHttpClient,
  type HttpClient,
} from '../../../shared/api'
import { AccountRecovery } from './AccountRecovery.web'

afterEach(cleanup)
const view = {
  state: 'WAITING',
  checked: 0,
  lastCheckedAt: null,
  canRequest: true,
  requestPending: false,
}
const tree = (client: HttpClient, scope = 'owner-a:alfa') => (
  <ApiClientProvider client={client}>
    <AccountRecovery
      scope={scope}
      reauthenticationUrl="/entrar?callbackUrl=%2Fadmin%2Frecebimentos"
    />
  </ApiClientProvider>
)
const confirm = async () => {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Solicitar nova conferência' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar conferência' }))
}
it('consults only on load and cancel, requires explicit confirmation, and submits once before rereading', async () => {
  let finish!: (response: Response) => void
  let pending = false
  const fetcher = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          finish = resolve
        })
      : Promise.resolve(
          Response.json({
            recovery: {
              ...view,
              requestPending: pending,
              canRequest: !pending,
            },
          })
        )
  )
  render(tree(createHttpClient({ fetcher })))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Solicitar nova conferência' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(fetcher).toHaveBeenCalledOnce()
  fireEvent.click(
    screen.getByRole('button', { name: 'Solicitar nova conferência' })
  )
  const button = screen.getByRole('button', { name: 'Confirmar conferência' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
    ).toHaveLength(1)
  )
  expect(fetcher.mock.calls[1]).toMatchObject([
    '/api/admin/payment-account/recovery',
    { method: 'POST', cache: 'no-store', body: '{"confirmation":true}' },
  ])
  pending = true
  await act(async () =>
    finish(Response.json({ accepted: true }, { status: 202 }))
  )
  await screen.findByText(
    'Uma conferência já está aguardando ou em processamento.'
  )
  expect(screen.getByText(/Os recebimentos continuam restritos/)).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: 'Solicitar nova conferência' })
  ).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it.each(['network', '503', 'invalid receipt'])(
  'an uncertain %s cannot auto-repeat; a fresh consultation precedes a new confirmation',
  async (failure) => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Response.json({ recovery: view })
      if (failure === 'network') throw new Error('private-provider-secret')
      return Response.json(
        failure === '503'
          ? { error: 'private-provider-secret' }
          : { accepted: true, private: 'private-provider-secret' },
        { status: failure === '503' ? 503 : 202 }
      )
    })
    render(tree(createHttpClient({ fetcher })))
    await confirm()
    await screen.findByText(
      'Não foi possível confirmar o pedido. Atualize a consulta antes de solicitar novamente.'
    )
    expect(document.body.textContent).not.toContain('private-provider-secret')
    expect(
      screen.queryByRole('button', { name: 'Solicitar nova conferência' })
    ).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(2)
    fireEvent.click(
      screen.getByRole('button', { name: 'Atualizar conferência' })
    )
    await screen.findByRole('button', { name: 'Solicitar nova conferência' })
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
    ).toHaveLength(1)
    await confirm()
    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
      ).toHaveLength(2)
    )
  }
)
it('requires reauthentication without exposing the response or repeating the request', async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? Response.json(
          { code: 'FRESH_SESSION_REQUIRED', error: 'private-provider-secret' },
          { status: 401 }
        )
      : Response.json({ recovery: view })
  )
  render(tree(createHttpClient({ fetcher })))
  await confirm()
  expect(
    (
      await screen.findByRole('link', {
        name: 'Entrar novamente para confirmar',
      })
    ).getAttribute('href')
  ).toBe('/entrar?callbackUrl=%2Fadmin%2Frecebimentos')
  expect(document.body.textContent).not.toContain('private-provider-secret')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('snapshot completion still states restriction; review cannot submit', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      recovery: { ...view, state: 'SNAPSHOT_COMPLETE', checked: 17 },
    })
  )
  const client = createHttpClient({ fetcher })
  const mounted = render(tree(client))
  await screen.findByText('17 pagamentos conferidos.')
  expect(
    screen.getByText(/Isso não confirma que a comunicação foi recuperada/)
  ).toBeTruthy()
  fetcher.mockResolvedValue(
    Response.json({
      recovery: { ...view, state: 'REVIEW_REQUIRED', canRequest: false },
    })
  )
  mounted.rerender(tree(client, 'owner-b:bravo'))
  await screen.findByText(/Existem divergências/)
  expect(
    screen.queryByRole('button', { name: 'Solicitar nova conferência' })
  ).toBeNull()
})
it('a completed snapshot can be refreshed on the existing agenda with history preserved and a fresh waiting projection', async () => {
  let requested = false
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      requested = true
      return Response.json({ accepted: true }, { status: 202 })
    }
    return Response.json({
      recovery: requested
        ? { ...view, canRequest: false, requestPending: true }
        : {
            ...view,
            state: 'SNAPSHOT_COMPLETE',
            checked: 17,
            canRequest: true,
            requestPending: true,
          },
    })
  })
  render(tree(createHttpClient({ fetcher })))
  await screen.findByText('17 pagamentos conferidos.')
  expect(screen.getByText(/A próxima inspeção já está agendada/)).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', { name: 'Solicitar nova conferência' })
  )
  expect(
    screen.getByText(/A conferência anterior será mantida no histórico/)
  ).toBeTruthy()
  expect(fetcher).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar conferência' }))
  await screen.findByText('A conferência dos pagamentos aguarda processamento.')
  expect(screen.getByText('0 pagamentos conferidos.')).toBeTruthy()
  expect(screen.queryByText('17 pagamentos conferidos.')).toBeNull()
  expect(screen.getByText(/Os recebimentos continuam restritos/)).toBeTruthy()
  expect(
    fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
  ).toHaveLength(1)
  expect(fetcher).toHaveBeenCalledTimes(3)
})
it('late POST from a former scope cannot replace the new company projection or request state', async () => {
  let finish!: (response: Response) => void
  let reads = 0
  const fetcher = vi.fn((_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Promise<Response>((resolve) => {
          finish = resolve
        })
      : Promise.resolve(
          Response.json({ recovery: { ...view, checked: ++reads } })
        )
  )
  const client = createHttpClient({ fetcher })
  const mounted = render(tree(client))
  await confirm()
  mounted.rerender(tree(client, 'owner-b:bravo'))
  await screen.findByText('2 pagamentos conferidos.')
  await act(async () =>
    finish(Response.json({ accepted: true }, { status: 202 }))
  )
  expect(screen.queryByText(/Conferência solicitada/)).toBeNull()
  expect(screen.getByText('2 pagamentos conferidos.')).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(3)
})
