// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import type { Delivery } from './contracts'
import { useLogisticsData } from './carga'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
const delivery: Delivery = {
  id: 'entrega /1',
  rentalId: 'rental',
  type: 'DELIVERY',
  status: 'SCHEDULED',
  scheduledAt: '2026-10-03T12:00:00Z',
  completedAt: null,
  address: {},
  distance: 0,
  vehicleId: null,
  driverId: null,
  driverName: null,
  photos: [],
  checklist: null,
  notes: null,
  rental: {
    id: 'rental',
    users: { name: 'Cliente', email: 'cliente@example.test', phone: null },
  },
}

it('carrega auxiliares filtrados, edita campos opcionais e atualiza status pelo transporte', async () => {
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url, init) => {
      if (init?.method === 'PATCH') return new Response('', { status: 200 })
      if (url.includes('/vehicles'))
        return Response.json({ vehicles: [{ id: 'veiculo' }] })
      if (url.includes('/drivers'))
        return Response.json({ drivers: [{ id: 'motorista' }] })
      return Response.json({ deliveries: [delivery] })
    })
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useLogisticsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.filteredDeliveries).toEqual([delivery])
  )
  expect(fetcher.mock.calls.slice(0, 3).map(([url]) => url)).toEqual([
    'https://api.example.test/api/admin/logistics',
    'https://api.example.test/api/admin/vehicles?status=AVAILABLE',
    'https://api.example.test/api/admin/drivers?status=ACTIVE',
  ])
  expect(hook.result.current.vehicles).toEqual([{ id: 'veiculo' }])
  expect(hook.result.current.drivers).toEqual([{ id: 'motorista' }])
  act(() => hook.result.current.handleEditDelivery(delivery))
  expect(hook.result.current.editingDelivery.distance).toBeUndefined()
  act(() =>
    hook.result.current.setEditingDelivery({
      photos: ['photo'],
      checklist: { checked: false },
      notes: '',
      distance: 0,
    })
  )
  await act(async () => hook.result.current.handleSaveDelivery())
  const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(write[0]).toBe(
    'https://api.example.test/api/admin/logistics/entrega%20%2F1'
  )
  expect(JSON.parse(write[1]!.body as string)).toEqual({
    photos: ['photo'],
    checklist: { checked: false },
    notes: '',
    distance: 0,
  })
  expect(write[1]).toMatchObject({
    method: 'PATCH',
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa', 'Content-Type': 'application/json' },
  })
  expect(hook.result.current.selectedDelivery).toBeNull()
  expect(notify.success).toHaveBeenCalledWith(
    'Entrega/coleta atualizada com sucesso'
  )
  await act(async () =>
    hook.result.current.handleUpdateStatus(delivery.id, 'COMPLETED')
  )
  expect(
    JSON.parse(
      fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH')[1]![1]!
        .body as string
    )
  ).toEqual({ status: 'COMPLETED' })
  expect(notify.success).toHaveBeenCalledWith('Status atualizado com sucesso')
})

it('PATCH recusado conserva seleção e informa erro sem aplicar sucesso', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const client = createHttpClient({
    fetcher: async (_url, init) =>
      init?.method === 'PATCH'
        ? new Response('<html>recusado</html>', { status: 404 })
        : Response.json({ deliveries: [delivery] }),
  })
  const hook = renderHook(useLogisticsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.handleEditDelivery(delivery))
  await act(async () => hook.result.current.handleSaveDelivery())
  expect(notify.error).toHaveBeenCalledWith('Erro ao atualizar entrega/coleta')
  expect(hook.result.current.selectedDelivery).toEqual(delivery)
  expect(hook.result.current.isEditing).toBe(true)
  expect(notify.success).not.toHaveBeenCalled()
})

it('cancelar edição invalida PATCH atrasado e conserva a próxima seleção', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'PATCH'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Response.json({ deliveries: [delivery] })
    )
  const client = createHttpClient({ fetcher })
  const hook = renderHook(useLogisticsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => hook.result.current.handleEditDelivery(delivery))
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleSaveDelivery()
  })
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')
    ).toBe(true)
  )
  act(() => {
    hook.result.current.handleCancelEditing()
    hook.result.current.handleEditDelivery({ ...delivery, id: 'nova' })
  })
  expect(
    fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]!.signal!
      .aborted
  ).toBe(true)
  await act(async () => {
    finish(new Response('ok'))
    await pending
  })
  expect(hook.result.current.selectedDelivery?.id).toBe('nova')
  expect(hook.result.current.isEditing).toBe(true)
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
})

it('troca de transporte aborta leituras e uma atualização de status antiga', async () => {
  let finish!: (response: Response) => void
  const old = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'PATCH'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Response.json({ deliveries: [delivery] })
    )
  let client = createHttpClient({ fetcher: old })
  const hook = renderHook(useLogisticsData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleUpdateStatus(delivery.id, 'COMPLETED')
  })
  await waitFor(() =>
    expect(old.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
      true
    )
  )
  client = createHttpClient({
    fetcher: async () => Response.json({ deliveries: [] }),
  })
  hook.rerender()
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  await act(async () => {
    finish(new Response('ok'))
    await pending
  })
  expect(hook.result.current.deliveries).toEqual([])
  expect(notify.success).not.toHaveBeenCalled()
  expect(notify.error).not.toHaveBeenCalled()
  expect(
    old.mock.calls.filter(([, init]) => init?.method === 'GET')
  ).toHaveLength(3)
})
