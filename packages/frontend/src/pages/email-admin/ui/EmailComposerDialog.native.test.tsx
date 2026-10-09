// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EmailComposerDialog } from './EmailComposerDialog.native'
import type { ComposerSelection } from '../model/ports'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
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
function setup(deny = false) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(deny ? { error: 'Envio recusado' } : {}, {
        status: deny ? 403 : 200,
      })
    ),
    onClose = vi.fn(),
    onSent = vi.fn()
  const device = {
    readHighlighted: vi.fn(async () => []),
    persistHighlighted: vi.fn(),
    download: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    pickFiles: vi.fn(async (): Promise<ComposerSelection | null> => null),
    uuid: () => '12345678-1234-4123-8123-123456789012',
    html: () => null,
  }
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  render(
    <ApiClientProvider client={client}>
      <EmailComposerDialog
        device={device}
        isOpen
        mode="reply"
        messageId="original"
        onClose={onClose}
        onSent={onSent}
        fromAddress="owner@example.test"
        initialTo="client@example.test"
        initialSubject=" Assunto "
        initialContent=" <b>Texto</b> "
      />
    </ApiClientProvider>
  )
  return { fetcher, onClose, onSent, device }
}
it('envia resposta HTML e idempotência pela porta, sem alterar envelope', async () => {
  const { fetcher, onSent, onClose } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/admin/zoho-mail/messages/original/reply'
  )
  expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
    fromAddress: 'owner@example.test',
    toAddress: 'client@example.test',
    subject: 'Assunto',
    content: '<b>Texto</b>',
    mailFormat: 'html',
  })
  expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
    'X-Idempotency-Key': '12345678-1234-4123-8123-123456789012',
  })
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(capture.classes).toEqual([])
})
it('recusa preserva texto/compositor aberto, sem sucesso ou fechamento', async () => {
  const { onClose, onSent } = setup(true)
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() =>
    expect(capture.toast.error).toHaveBeenCalledWith('Envio recusado')
  )
  expect(
    (screen.getByRole('textbox', { name: 'Mensagem' }) as HTMLInputElement)
      .value
  ).toBe(' <b>Texto</b> ')
  expect(onClose).not.toHaveBeenCalled()
  expect(onSent).not.toHaveBeenCalled()
})
it('limite 20MB impede multipart de chegar ao servidor', async () => {
  const { device, fetcher } = setup()
  vi.mocked(device.pickFiles).mockResolvedValue({
    files: [{ name: 'grande', size: 20 * 1024 * 1024 + 1 }],
    multipart: new FormData(),
  })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar anexos' }))
  await waitFor(() =>
    expect(capture.toast.error).toHaveBeenCalledWith(
      'Arquivo "grande" excede o limite de 20 MB'
    )
  )
  expect(fetcher).not.toHaveBeenCalled()
})
