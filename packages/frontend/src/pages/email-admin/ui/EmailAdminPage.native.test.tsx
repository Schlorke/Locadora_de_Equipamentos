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
import { AdminEmailPage } from './EmailAdminPage.native'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
import type { NativeMailPorts } from '../model/native-ports'
const capture = vi.hoisted(() => ({
  classes: [] as string[],
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
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
function device(): NativeMailPorts {
  return {
    readHighlighted: vi.fn(async () => []),
    persistHighlighted: vi.fn(),
    download: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    pickFiles: vi.fn(async () => null),
    uuid: () => '12345678-1234-4123-8123-123456789012',
    html: vi.fn((html) => <output data-testid="html-body">{html}</output>),
  }
}
function bootstrap(url: string) {
  if (url.endsWith('/accounts'))
    return Response.json({
      accounts: [
        { accountId: 'account', primaryEmailAddress: 'owner@example.test' },
      ],
    })
  if (url.includes('/folders?'))
    return Response.json({
      folders: [
        { folderId: 'inbox', folderName: 'Inbox', folderType: 'Inbox' },
        { folderId: 'trash', folderName: 'Trash', folderType: 'Trash' },
      ],
    })
  if (url.includes('/messages/m?'))
    return Response.json({
      message: {
        messageId: 'm',
        subject: 'Assunto',
        htmlContent: '<table><tr><td>HTML preservado</td></tr></table>',
        isRead: true,
        attachments: [{ attachmentId: 'att', fileName: 'arquivo.pdf' }],
      },
    })
  return Response.json({
    messages: [{ messageId: 'm', subject: 'Assunto', isRead: true }],
  })
}
function ui(
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>,
  d: NativeMailPorts,
  userId = 'one'
) {
  return (
    <FrontendSessionFixture userId={userId}>
      <ApiClientProvider
        client={createHttpClient({
          baseUrl: 'https://api.example.test',
          fetcher,
          getHeaders: () => ({ Authorization: 'Bearer fixture' }),
        })}
      >
        <AdminEmailPage device={d} />
      </ApiClientProvider>
    </FrontendSessionFixture>
  )
}
it('conta, pastas, HTML, download autenticado e arquivamento usam contratos comuns', async () => {
  const d = device(),
    fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, init) =>
        String(url).includes('/attachments/att?')
          ? new Response(new Blob(['bytes'], { type: 'application/pdf' }))
          : init?.method === 'PUT'
            ? Response.json({})
            : bootstrap(String(url))
      )
  await act(async () => {
    render(ui(fetcher, d))
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Assunto' }))
  expect((await screen.findByTestId('html-body')).textContent).toContain(
    'HTML preservado'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Baixar arquivo.pdf' }))
  await waitFor(() => expect(d.download).toHaveBeenCalled())
  const download = fetcher.mock.calls.find(([url]) =>
    String(url).includes('/attachments/att?')
  )!
  expect(download[0]).toBe(
    'https://api.example.test/api/admin/zoho-mail/messages/m/attachments/att?accountId=account&folderId=inbox&filename=arquivo.pdf'
  )
  expect(download[1]?.headers).toMatchObject({
    Authorization: 'Bearer fixture',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }))
  await waitFor(() => expect(capture.toast.success).toHaveBeenCalled())
  const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(JSON.parse(String(write[1]?.body))).toEqual({
    messageIds: ['m'],
    action: 'archive',
  })
  expect(capture.classes).toEqual([])
})
it('caixa não persiste vazio antes da leitura; retorno antigo de storage não revive usuário anterior', async () => {
  let finish!: (keys: string[]) => void
  const d = device()
  vi.mocked(d.readHighlighted)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    .mockResolvedValue([])
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) => bootstrap(String(url)))
  const rendered = render(ui(fetcher, d))
  expect(d.persistHighlighted).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  rendered.rerender(ui(fetcher, d, 'two'))
  await screen.findByRole('button', { name: 'Assunto' })
  await act(async () => finish(['old-sender']))
  expect(
    vi
      .mocked(d.persistHighlighted)
      .mock.calls.every(([, keys]) => !keys.includes('old-sender'))
  ).toBe(true)
})
it('403 de conta é erro, sem caixa fictícia e sem conectar automaticamente', async () => {
  const d = device(),
    fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: 'Acesso recusado' }, { status: 403 })
      )
  render(ui(fetcher, d))
  await screen.findByText('Acesso recusado')
  expect(screen.queryByRole('button', { name: 'Novo e-mail' })).toBeNull()
  expect(d.connect).not.toHaveBeenCalled()
})
it('conexão abre porta web existente e recarrega a conta apenas ao retornar', async () => {
  let finish!: () => void
  const d = device()
  vi.mocked(d.connect).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({}, { status: 401 }))
  render(ui(fetcher, d))
  fireEvent.click(
    await screen.findByRole('button', { name: 'Conectar Zoho Mail' })
  )
  await waitFor(() => expect(d.connect).toHaveBeenCalledTimes(1))
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})
