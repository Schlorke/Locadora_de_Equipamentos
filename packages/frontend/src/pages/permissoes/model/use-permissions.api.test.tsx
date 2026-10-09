// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { usePermissions } from './use-permissions'
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('../../../shared/lib/toast', () => ({ toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('salva somente o perfil selecionado pelo mesmo transporte', async () => {
  const entries = [
    { id: '1', role: 'ADMIN', module: 'EQUIPMENTS', action: 'READ' },
    { id: '2', role: 'OPERATOR', module: 'EQUIPMENTS', action: 'WRITE' },
  ]
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (_, init) =>
      Response.json(init?.method === 'PUT' ? {} : { permissions: entries })
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(usePermissions, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.setSelectedRole('OPERATOR'))
  await act(async () => hook.result.current.handleSave())
  const call = fetcher.mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(call[0]).toBe('https://api.example.test/api/admin/permissions')
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    permissions: [entries[1]],
  })
  expect(toast.success).toHaveBeenCalledWith('Permissões salvas com sucesso')
})
it('troca de perfil encerra a continuação de um salvamento antigo', async () => {
  let finish!: (r: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_, init) =>
    init?.method === 'PUT'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Response.json({ permissions: [] })
  )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(usePermissions, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleSave()
  })
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  act(() => hook.result.current.setSelectedRole('CLIENT'))
  await act(async () => {
    finish(Response.json({}))
    await pending
  })
  expect(hook.result.current.saving).toBe(false)
  expect(toast.success).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()
  expect(fetcher).toHaveBeenCalledTimes(2)
})
