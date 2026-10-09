// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useMaintenanceData } from './carga'

const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const rows = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  equipment: { name: 'Betoneira' },
  technician: 'José',
  type: i % 2 ? 'CORRECTIVE' : 'PREVENTIVE',
  status: 'SCHEDULED',
}))

it('usa agenda com atrasos e conserva pesquisa, tipo e paginação de dez', async () => {
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url) =>
      Response.json(
        url.includes('/scheduled') ? { scheduled: [] } : { maintenances: rows }
      )
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(useMaintenanceData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMaintenances).toHaveLength(12)
  )
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/api/admin/maintenance',
    'https://api.example.test/api/admin/maintenance/scheduled?includeOverdue=true',
  ])
  expect(hook.result.current.viewMode).toBe('list')
  expect(hook.result.current.paginatedMaintenances).toHaveLength(10)
  act(() => hook.result.current.setTablePage(2))
  expect(hook.result.current.paginatedMaintenances).toHaveLength(2)
  act(() => {
    hook.result.current.setTypeFilter('CORRECTIVE')
    hook.result.current.setSearchTerm('josé')
  })
  await waitFor(() =>
    expect(hook.result.current.filteredMaintenances).toHaveLength(6)
  )
  expect(hook.result.current.tableCurrentPage).toBe(1)
  act(() => hook.result.current.setStatusFilter('COMPLETED'))
  await waitFor(() =>
    expect(hook.result.current.filteredMaintenances).toHaveLength(0)
  )
})

it('recusa agendada mantém a política anterior de lista vazia e feedback', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const client = createHttpClient({
    fetcher: async (url) =>
      url.includes('/scheduled')
        ? new Response('falha', { status: 503 })
        : Response.json({ maintenances: rows }),
  })
  const hook = renderHook(useMaintenanceData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.maintenances).toEqual([])
  expect(notify.error).toHaveBeenCalledWith('Erro', {
    description: 'Erro ao carregar manutenções. Tente novamente.',
  })
})

it('transporte novo limpa seleção/filtros e não recebe resposta antiga', async () => {
  let finish!: (response: Response) => void
  const old = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url) =>
      url.includes('/scheduled')
        ? Response.json({})
        : new Promise((resolve) => {
            finish = resolve
          })
    )
  let client = createHttpClient({ fetcher: old })
  const hook = renderHook(useMaintenanceData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(old).toHaveBeenCalledTimes(2))
  act(() => {
    hook.result.current.setSearchTerm('antiga')
    hook.result.current.setViewMode('calendar')
  })
  client = createHttpClient({
    fetcher: async (url) =>
      Response.json(url.includes('/scheduled') ? {} : { maintenances: [] }),
  })
  hook.rerender()
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.searchTerm).toBe('')
  expect(hook.result.current.viewMode).toBe('list')
  expect(old.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  await act(async () => finish(Response.json({ maintenances: rows })))
  expect(hook.result.current.maintenances).toEqual([])
  expect(notify.error).not.toHaveBeenCalled()
})
