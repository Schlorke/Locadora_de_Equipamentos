// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useEmailPage } from './carga.web'
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})
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
  return Response.json({
    messages: [
      { messageId: 'a', subject: 'Assunto', isRead: true },
      { messageId: 'b', subject: 'Outro', isRead: true },
    ],
  })
}
it('carrega conta/pasta/lista e conserva atualização pelo host configurado', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url, init) =>
      init?.method === 'PUT' ? Response.json({}) : bootstrap(String(url))
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useEmailPage, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMessages).toHaveLength(2)
  )
  expect(fetcher.mock.calls.map(([u]) => u)).toContain(
    'https://api.example.test/api/admin/zoho-mail/messages?accountId=account&folderId=inbox&limit=50&start=0'
  )
  await act(async () => hook.result.current.handleArchiveMessage('a'))
  const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(write[0]).toBe(
    'https://api.example.test/api/admin/zoho-mail/messages/update'
  )
  expect(JSON.parse(String(write[1]?.body))).toEqual({
    messageIds: ['a'],
    action: 'archive',
  })
  expect(write[1]).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
})
it('uma mensagem atrasada não substitui a seleção seguinte', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
    String(url).includes('/messages/a?')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : String(url).includes('/messages/b?')
        ? Response.json({ message: { messageId: 'b', subject: 'Atual' } })
        : bootstrap(String(url))
  )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useEmailPage, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMessages).toHaveLength(2)
  )
  act(() => hook.result.current.handleSelectMessage('a'))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  act(() => hook.result.current.handleSelectMessage('b'))
  await waitFor(() =>
    expect(hook.result.current.currentMessage?.messageId).toBe('b')
  )
  await act(async () => {
    finish(Response.json({ message: { messageId: 'a', subject: 'Antiga' } }))
  })
  expect(hook.result.current.currentMessage?.messageId).toBe('b')
  expect(toast.error).not.toHaveBeenCalled()
})
it('a troca de pasta interrompe o lote antes da próxima exclusão', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) =>
    init?.method === 'DELETE'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : bootstrap(String(url))
  )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useEmailPage, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMessages).toHaveLength(2)
  )
  act(() => hook.result.current.handleSelectAll())
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleBulkDelete()
  })
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  act(() => hook.result.current.setSelectedFolderId('other'))
  await act(async () => {
    finish(Response.json({}))
    await pending
  })
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')
  ).toHaveLength(1)
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
  expect(hook.result.current.isBulkDeleting).toBe(false)
})
it('a troca de pasta encerra uma confirmação de exclusão da lixeira anterior', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) => bootstrap(String(url)))
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useEmailPage, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMessages).toHaveLength(2)
  )
  act(() => hook.result.current.setSelectedFolderId('trash'))
  await waitFor(() => expect(hook.result.current.isTrashFolder).toBe(true))
  await act(async () => hook.result.current.handleDeleteMessage('a'))
  expect(hook.result.current.showDeleteFromTrashConfirm).toBe(true)
  expect(hook.result.current.pendingDeleteFromTrashIds).toEqual(['a'])
  act(() => hook.result.current.setSelectedFolderId('inbox'))
  expect(hook.result.current.showDeleteFromTrashConfirm).toBe(false)
  expect(hook.result.current.pendingDeleteFromTrashIds).toEqual([])
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')
  ).toHaveLength(0)
})
it('uma conta não conectada mantém 401 sem virar erro de caixa', async () => {
  const client = createHttpClient({
    fetcher: async () => Response.json({ error: 'Conecte' }, { status: 401 }),
  })
  const hook = renderHook(useEmailPage, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.connected).toBe(false)
  expect(hook.result.current.error).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
})
