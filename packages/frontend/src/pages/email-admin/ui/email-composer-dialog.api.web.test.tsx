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
import { EmailComposerDialog } from './email-composer-dialog.web'
const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('envia pelo transporte configurado e mantém HTML, destinatário e idempotência', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const onSent = vi.fn(),
    onClose = vi.fn()
  render(
    <ApiClientProvider client={client}>
      <EmailComposerDialog
        isOpen
        onClose={onClose}
        onSent={onSent}
        mode="reply"
        messageId="original"
        fromAddress="owner@example.test"
        initialTo="client@example.test"
        initialSubject=" Assunto "
        initialContent=" <b>texto</b> "
      />
    </ApiClientProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://api.example.test/api/admin/zoho-mail/messages/original/reply'
  )
  const init = fetcher.mock.calls[0]?.[1]
  expect(init).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(
    (init?.headers as Record<string, string>)['X-Idempotency-Key']
  ).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.parse(String(init?.body))).toEqual({
    fromAddress: 'owner@example.test',
    toAddress: 'client@example.test',
    subject: 'Assunto',
    content: '<b>texto</b>',
    mailFormat: 'html',
  })
  expect(onClose).toHaveBeenCalledTimes(1)
})
it('atualizar o ID do rascunho não apaga a digitação nem reinicia o formulário', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ draftId: 'draft-new' }))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const onDraftSaved = vi.fn()
  const props = {
    onClose: vi.fn(),
    onDraftSaved,
    mode: 'new' as const,
    fromAddress: 'owner@example.test',
    initialTo: 'client@example.test',
    initialSubject: 'Original',
    initialContent: 'Texto',
    draftFolderId: 'drafts',
  }
  const ui = (draftMessageId: string) => (
    <ApiClientProvider client={client}>
      <EmailComposerDialog {...props} isOpen draftMessageId={draftMessageId} />
    </ApiClientProvider>
  )
  const rendered = render(ui('draft-old'))
  fireEvent.change(screen.getByLabelText('Assunto'), {
    target: { value: 'Digitado' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
  await waitFor(() => expect(onDraftSaved).toHaveBeenCalledWith('draft-new'))
  rendered.rerender(ui('draft-new'))
  expect((screen.getByLabelText('Assunto') as HTMLInputElement).value).toBe(
    'Digitado'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(fetcher.mock.calls[1]?.[0]).toBe(
    'https://api.example.test/api/admin/zoho-mail/messages/drafts'
  )
  expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toMatchObject({
    draftFolderId: 'drafts',
    draftMessageId: 'draft-new',
    subject: 'Digitado',
    content: 'Texto',
    mailFormat: 'html',
  })
})
it('fechar e reabrir o compositor invalida o envio anterior sem fechar o novo', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const client = createHttpClient({ fetcher })
  const onSent = vi.fn(),
    onClose = vi.fn()
  const props = {
    onSent,
    onClose,
    mode: 'new' as const,
    fromAddress: 'owner@example.test',
    initialTo: 'client@example.test',
    initialSubject: 'Assunto',
    initialContent: 'Texto',
  }
  const ui = (open: boolean) => (
    <ApiClientProvider client={client}>
      <EmailComposerDialog {...props} isOpen={open} />
    </ApiClientProvider>
  )
  const rendered = render(ui(true))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  rendered.rerender(ui(false))
  rendered.rerender(ui(true))
  await act(async () => {
    finish(Response.json({}))
  })
  expect(onSent).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy()
})
