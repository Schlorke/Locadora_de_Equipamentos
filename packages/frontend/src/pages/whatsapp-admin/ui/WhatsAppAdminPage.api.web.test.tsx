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
import { AdminWhatsAppPage } from './WhatsAppAdminPage.web'
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('./Layout.web', () => ({
  WhatsAppLayoutContainer: ({
    onSelectConversation,
    onReply,
    onLoadMoreMessages,
    messages,
    messagesLoading,
  }: {
    onSelectConversation: (id: string) => void
    onReply: () => void
    onLoadMoreMessages: () => void
    messages: { body: string }[]
    messagesLoading: boolean
  }) => (
    <div>
      <button onClick={() => onSelectConversation('a')}>Conversa A</button>
      <button onClick={() => onSelectConversation('b')}>Conversa B</button>
      <button onClick={onReply}>Responder</button>
      <button onClick={onLoadMoreMessages}>Mais</button>
      <output>
        {messagesLoading ? 'loading' : messages.map((m) => m.body).join(',')}
      </output>
    </div>
  ),
}))
vi.mock('./DialogoCompleto.web', () => ({ WhatsAppFullViewDialog: () => null }))
vi.mock('./DialogoCompositor.web', () => ({
  WhatsAppComposerDialog: ({
    isOpen,
    onSend,
    onClose,
  }: {
    isOpen: boolean
    onSend: (text: string) => Promise<void>
    onClose: () => void
  }) =>
    isOpen ? (
      <div>
        <button onClick={() => void onSend('  Mensagem  ')}>
          Enviar resposta
        </button>
        <button onClick={onClose}>Fechar compositor</button>
      </div>
    ) : null,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function conversations() {
  return Response.json({
    conversations: [
      { id: 'a', phone: '1' },
      { id: 'b', phone: '2' },
    ],
  })
}
it('trocar conversa impede uma resposta antiga de ocupar a mensagem atual', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    String(url).includes('/a/messages')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : String(url).includes('/b/messages')
        ? Response.json({ messages: [{ id: 'b1', body: 'Atual' }] })
        : conversations()
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(
    <FrontendSessionFixture>
      <ApiClientProvider client={client}>
        <AdminWhatsAppPage />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Conversa A' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Conversa B' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Atual')
  )
  await act(async () => {
    finish(Response.json({ messages: [{ id: 'a1', body: 'Antiga' }] }))
  })
  expect(screen.getByRole('status').textContent).toBe('Atual')
  expect(toast.error).not.toHaveBeenCalled()
})
it('trocar usuário reinicia a caixa mesmo mantendo o transporte', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      String(url).includes('/messages')
        ? Response.json({ messages: [{ id: 'a1', body: 'Usuário anterior' }] })
        : conversations()
    )
  const client = createHttpClient({ fetcher })
  const ui = (userId: string) => (
    <FrontendSessionFixture userId={userId}>
      <ApiClientProvider client={client}>
        <AdminWhatsAppPage />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  const rendered = render(ui('first'))
  fireEvent.click(screen.getByRole('button', { name: 'Conversa A' }))
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Usuário anterior')
  )
  rendered.rerender(ui('second'))
  expect(screen.getByRole('status').textContent).toBe('')
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([url]) => !String(url).includes('/messages'))
    ).toHaveLength(2)
  )
})
it('um envio encerrado não dá feedback nem recarrega a conversa', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) =>
    init?.method === 'POST'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : String(url).includes('/messages')
        ? Response.json({ messages: [] })
        : conversations()
  )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(
    <FrontendSessionFixture>
      <ApiClientProvider client={client}>
        <AdminWhatsAppPage />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Conversa A' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Fechar compositor' }))
  await act(async () => {
    finish(Response.json({ id: 'sent', body: 'Mensagem' }))
  })
  expect(
    fetcher.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body
  ).toBe('{"text":"Mensagem"}')
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
  expect(fetcher).toHaveBeenCalledTimes(3)
})
