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
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import { subscriptionTenant } from '../../../../../../tests/helpers/subscription-account'
import { RecebimentosAdminPage } from './RecebimentosPage.web'

afterEach(cleanup)
const unavailableCreation = {
  available: false,
  blocker: 'CREATION_UNAVAILABLE',
  model: null,
  company: null,
  suggestedMobilePhone: null,
  companyDataVersion: null,
  lastRequestOutcome: null,
}
/**
 * The creation switch is off in today's deployment (wave 134): the page reads the creation offer, gets
 * CREATION_UNAVAILABLE and must stay exactly as before. The offer read is answered here, so every count below is
 * still the connection's own traffic.
 */
const creationOff =
  (fetcher: (path: string, init?: RequestInit) => Promise<Response>) =>
  (path: string, init?: RequestInit) =>
    path === '/api/admin/payment-account/create' && init?.method !== 'POST'
      ? Promise.resolve(Response.json(unavailableCreation))
      : fetcher(path, init)
const apiKey = '$aact_hmlg_' + 'synthetic'.repeat(8)
const restricted = {
  kind: 'CONNECTED',
  status: 'RESTRICTED',
  environment: 'sandbox',
  healthIssue: 'WEBHOOK_MISSING',
  providerStatusText: null,
  commercialInfoExpiresAt: null,
  commercialInfoExpired: false,
  approvedAt: null,
  lastSyncedAt: null,
}
const tree = (client: HttpClient, tenant = 'alfa', userId = 'owner-a') => (
  <ApiClientProvider client={client}>
    <FrontendSessionFixture tenant={subscriptionTenant(tenant)} userId={userId}>
      <RecebimentosAdminPage />
    </FrontendSessionFixture>
  </ApiClientProvider>
)
async function open() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Conectar conta própria' })
  )
  const input = screen.getByLabelText(
    'Chave de API do Asaas'
  ) as HTMLInputElement
  fireEvent.change(input, { target: { value: apiKey } })
  return input
}
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar conexão' }))

/**
 * Rendered page once every pending read settled. React ids are numbered per render and the header's entrance
 * animation writes a different inline frame each time: both are normalized, everything else is compared.
 */
async function settledPage(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>
) {
  const rendered = render(tree(createHttpClient({ fetcher })))
  await screen.findByRole('button', { name: 'Conectar conta própria' })
  await screen.findByText(
    'Nenhuma conta de recebimentos conectada a esta locadora.'
  )
  for (let turn = 0; turn < 3; turn++)
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const html = rendered.container.innerHTML
    .replace(/«[^»]*»|_r_[0-9a-z]+_|:r[0-9a-z]+:/g, '<id>')
    .replace(/ style="[^"]*"/g, '')
  rendered.unmount()
  return html
}
it('with CREATION_UNAVAILABLE the page is exactly the page without any creation offer: no card, no empty text', async () => {
  const offerReads: string[] = []
  const account = async () => Response.json({ account: null })
  const reading =
    (offer: () => Response) => async (path: string, init?: RequestInit) => {
      if (path !== '/api/admin/payment-account/create') return account()
      offerReads.push(init?.method ?? 'GET')
      return offer()
    }
  // Today's deployment: the creation route does not answer, so no offer exists.
  const today = await settledPage(
    reading(() => Response.json({ error: 'not found' }, { status: 404 }))
  )
  const unavailable = await settledPage(
    reading(() => Response.json(unavailableCreation))
  )
  expect(offerReads).toEqual(['GET', 'GET'])
  expect(unavailable).toBe(today)
  expect(unavailable).not.toContain('Criar conta de recebimentos')
  expect(unavailable).not.toMatch(/<p[^>]*><\/p>/)
})
it('never connects on load or typing; cancellation destroys the masked credential', async () => {
  const fetcher = vi.fn(async () => Response.json({ account: null }))
  render(tree(createHttpClient({ fetcher: creationOff(fetcher) })))
  const input = await open()
  expect(input.type).toBe('password')
  expect(input.autocomplete).toBe('off')
  expect(fetcher).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(input.value).toBe('')
  fireEvent.click(
    screen.getByRole('button', { name: 'Conectar conta própria' })
  )
  expect(
    (screen.getByLabelText('Chave de API do Asaas') as HTMLInputElement).value
  ).toBe('')
  expect(fetcher).toHaveBeenCalledOnce()
})
it('clears before sending, prevents duplicate submission and rereads without simulating approval', async () => {
  let finish!: (response: Response) => void
  let connected = false
  const fetcher = vi.fn((path: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    return Promise.resolve(
      Response.json({ account: connected ? restricted : null })
    )
  })
  render(tree(createHttpClient({ fetcher: creationOff(fetcher) })))
  const input = await open()
  submit()
  expect(input.value).toBe('')
  fireEvent.submit(input.closest('form')!)
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
    ).toHaveLength(1)
  )
  expect(screen.getByText('Conectando a conta...')).toBeTruthy()
  connected = true
  await act(async () =>
    finish(Response.json({ accepted: true }, { status: 202 }))
  )
  await screen.findByText('Recebimentos restritos')
  expect(screen.getByText(/Pedido de conexão aceito/)).toBeTruthy()
  expect(screen.queryByText('Conta aprovada')).toBeNull()
  expect(screen.queryByLabelText('Chave de API do Asaas')).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(fetcher.mock.calls[1]![0]).toBe('/api/admin/payment-account/connect')
  expect(fetcher.mock.calls[1]![1]?.cache).toBe('no-store')
})
it('validates the shared input contract before any POST and clears invalid input', async () => {
  const fetcher = vi.fn(async () => Response.json({ account: null }))
  render(tree(createHttpClient({ fetcher: creationOff(fetcher) })))
  const input = await open()
  fireEvent.change(input, { target: { value: 'invalid' } })
  submit()
  await screen.findByText(
    'Informe uma chave de API do Asaas com formato válido.'
  )
  expect(input.value).toBe('')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(fetcher).toHaveBeenCalledOnce()
})
it.each([
  [401, 'FRESH_SESSION_REQUIRED', /Confirme sua identidade/],
  [403, 'EMAIL_NOT_VERIFIED', /Confirme seu e-mail/],
  [409, 'ACCOUNT_DOCUMENT_MISMATCH', /CNPJ/],
])(
  'shows a safe refusal %s/%s and no secret',
  async (status, code, message) => {
    const fetcher = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Response.json({ code, error: apiKey }, { status })
        : Response.json({ account: null })
    )
    render(tree(createHttpClient({ fetcher: creationOff(fetcher) })))
    const input = await open()
    submit()
    await screen.findByText(message)
    expect(input.value).toBe('')
    expect(document.body.textContent).not.toContain(apiKey)
    if (status === 401) {
      expect(
        screen
          .getByRole('link', { name: 'Entrar novamente' })
          .getAttribute('href')
      ).toContain('callbackUrl=%2Fadmin%2Frecebimentos')
      expect(screen.queryByLabelText('Chave de API do Asaas')).toBeNull()
    }
  }
)
it.each(['network', '503', 'invalid receipt'])(
  'an uncertain %s clears the key and permits only consultation, never automatic POST retry',
  async (failure) => {
    const fetcher = vi.fn(async (_path: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Response.json({ account: null })
      if (failure === 'network') throw new Error(apiKey)
      return Response.json(
        failure === '503'
          ? { error: apiKey }
          : { accepted: true, private: apiKey },
        { status: failure === '503' ? 503 : 202 }
      )
    })
    render(tree(createHttpClient({ fetcher: creationOff(fetcher) })))
    const input = await open()
    submit()
    await screen.findByText(/O pedido pode ter sido registrado/)
    expect(input.value).toBe('')
    expect(screen.queryByLabelText('Chave de API do Asaas')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Conectar conta própria' })
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
    ).toHaveLength(1)
    expect(document.body.textContent).not.toContain(apiKey)
  }
)
it.each(['tenant', 'session', 'transport', 'unmount'])(
  'destroys credentials and discards late POST after %s changes',
  async (change) => {
    let finish!: (response: Response) => void
    let signal: AbortSignal | null | undefined
    const fetcher = vi.fn((_: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        signal = init.signal
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      }
      return Promise.resolve(Response.json({ account: null }))
    })
    const client = createHttpClient({ fetcher: creationOff(fetcher) })
    const rendered = render(tree(client))
    const input = await open()
    submit()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    if (change === 'unmount') rendered.unmount()
    else
      rendered.rerender(
        tree(
          change === 'transport'
            ? createHttpClient({ fetcher: creationOff(fetcher) })
            : client,
          change === 'tenant' ? 'bravo' : 'alfa',
          change === 'session' ? 'owner-b' : 'owner-a'
        )
      )
    expect(input.value).toBe('')
    expect(signal?.aborted).toBe(true)
    await act(async () =>
      finish(Response.json({ accepted: true }, { status: 202 }))
    )
    expect(screen.queryByText(/Pedido de conexão aceito/)).toBeNull()
    if (change !== 'unmount') {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Conectar conta própria' })
      )
      expect(
        (screen.getByLabelText('Chave de API do Asaas') as HTMLInputElement)
          .value
      ).toBe('')
    }
    expect(
      fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')
    ).toHaveLength(1)
  }
)
it('clears an unsent key on tenant switch and on unmount', async () => {
  const client = createHttpClient({
    fetcher: creationOff(async () => Response.json({ account: null })),
  })
  const rendered = render(tree(client))
  const input = await open()
  rendered.rerender(tree(client, 'bravo'))
  expect(input.value).toBe('')
  const other = await open()
  rendered.unmount()
  expect(other.value).toBe('')
})
it('clears a key on browser pagehide and while rereading, without persisting it', async () => {
  const store = vi.spyOn(Storage.prototype, 'setItem')
  const client = createHttpClient({
    fetcher: creationOff(async () => Response.json({ account: null })),
  })
  const rendered = render(tree(client))
  try {
    const input = await open()
    fireEvent(window, new Event('pagehide'))
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: apiKey } })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar consulta' }))
    expect(input.value).toBe('')
    await screen.findByLabelText('Chave de API do Asaas')
    expect(store).not.toHaveBeenCalled()
    expect(document.location.href).not.toContain(apiKey)
  } finally {
    rendered.unmount()
    store.mockRestore()
  }
})
it('does not restore an accepted receipt when returning to a previous tenant', async () => {
  const client = createHttpClient({
    fetcher: creationOff(async (_path, init) =>
      init?.method === 'POST'
        ? Response.json({ accepted: true }, { status: 202 })
        : Response.json({ account: null })
    ),
  })
  const rendered = render(tree(client))
  await open()
  submit()
  await screen.findByText(/Pedido de conexão aceito/)
  rendered.rerender(tree(client, 'bravo'))
  await screen.findByRole('button', { name: 'Conectar conta própria' })
  rendered.rerender(tree(client))
  await screen.findByRole('button', { name: 'Conectar conta própria' })
  expect(screen.queryByText(/Pedido de conexão aceito/)).toBeNull()
})
