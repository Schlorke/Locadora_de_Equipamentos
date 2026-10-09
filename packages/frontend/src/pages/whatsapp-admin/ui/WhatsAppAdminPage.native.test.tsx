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
import { AdminWhatsAppPage } from './WhatsAppAdminPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
const capture = vi.hoisted(() => ({
  classes: [] as string[],
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(capture.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/Textarea.native')),
}))
vi.mock('../../../shared/lib/toast', () => ({ toast: capture.toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  capture.classes.length = 0
})
const conversations = () =>
  Response.json({
    conversations: [
      { id: 'a', phone: '1', displayName: 'Conversa A' },
      { id: 'b', phone: '2', displayName: 'Conversa B' },
    ],
  })
function ui(fetcher: ReturnType<typeof vi.fn<typeof fetch>>, userId = 'one') {
  return (
    <FrontendSessionFixture userId={userId}>
      <ApiClientProvider
        client={createHttpClient({
          baseUrl: 'https://api.example.test',
          fetcher,
          getHeaders: () => ({ Authorization: 'Bearer fixture' }),
        })}
      >
        <AdminWhatsAppPage />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
}
it('conversa real, resposta aparada e mesma autenticação; native não repassa className', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) =>
    init?.method === 'POST'
      ? Response.json({})
      : String(url).includes('/messages')
        ? Response.json({
            messages: [
              {
                id: 'm',
                body: 'Mensagem recebida',
                timestamp: '2026-10-03T12:00:00Z',
              },
            ],
          })
        : conversations()
  )
  render(ui(fetcher))
  fireEvent.click(await screen.findByRole('button', { name: 'Conversa A' }))
  await screen.findByText('Mensagem recebida')
  fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
    target: { value: '  Resposta  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(capture.toast.success).toHaveBeenCalled())
  const write = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(write[0]).toBe(
    'https://api.example.test/api/admin/whatsapp/conversations/a/messages'
  )
  expect(JSON.parse(String(write[1]?.body))).toEqual({ text: 'Resposta' })
  expect(write[1]?.headers).toMatchObject({ Authorization: 'Bearer fixture' })
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://api.example.test/api/admin/whatsapp/conversations?limit=50&offset=0'
  )
  expect(capture.classes).toEqual([])
})
it('seleção seguinte descarta mensagem atrasada e mudança de usuário reinicia a caixa', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    String(url).includes('/a/messages')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : String(url).includes('/b/messages')
        ? Response.json({
            messages: [
              { id: 'b1', body: 'Atual', timestamp: '2026-10-03T12:00:00Z' },
            ],
          })
        : conversations()
  )
  const rendered = render(ui(fetcher))
  fireEvent.click(await screen.findByRole('button', { name: 'Conversa A' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: 'Conversa B' }))
  await screen.findByText('Atual')
  await act(async () =>
    finish(Response.json({ messages: [{ id: 'a1', body: 'Antiga' }] }))
  )
  expect(screen.queryByText('Antiga')).toBeNull()
  rendered.rerender(ui(fetcher, 'two'))
  await screen.findByText('Selecione uma conversa para ver as mensagens.')
  expect(screen.queryByText('Atual')).toBeNull()
  expect(capture.toast.error).not.toHaveBeenCalled()
})
it('403 do envio conserva a recusa observada, sem afirmar sucesso', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url, init) =>
      init?.method === 'POST'
        ? Response.json({ error: 'Envio recusado' }, { status: 403 })
        : String(url).includes('/messages')
          ? Response.json({ messages: [] })
          : conversations()
    )
  render(ui(fetcher))
  fireEvent.click(await screen.findByRole('button', { name: 'Conversa A' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Responder' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
    target: { value: 'Texto' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() =>
    expect(capture.toast.error).toHaveBeenCalledWith('Envio recusado')
  )
  expect(capture.toast.success).not.toHaveBeenCalled()
})
