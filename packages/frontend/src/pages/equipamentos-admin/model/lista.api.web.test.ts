// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useEquipmentListData } from './lista.web'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../../../shared/lib', () => ({ useIsMobile: () => false }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('preserva ordenação/filtros e não encerra a seleção quando DELETE é recusado', async () => {
  const rows = ['Zebra', 'Betoneira'].map((name, index) => ({
    id: String(index),
    name,
    createdAt: '2026-10-03',
    pricePerDay: 10,
    isAvailable: true,
    images: [],
    category: { id: 'cat', name: 'Obra' },
  }))
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url, init) =>
      init?.method === 'DELETE'
        ? Response.json({ error: 'Equipamento em uso' }, { status: 409 })
        : Response.json(url.includes('/categories') ? [] : { equipments: rows })
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useEquipmentListData, {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  await waitFor(() =>
    expect(
      hook.result.current.currentEquipments.map((row) => row.name)
    ).toEqual(['Betoneira', 'Zebra'])
  )
  act(() => {
    hook.result.current.setSearchTerm('beta')
    hook.result.current.setSearchTerm('bet')
    hook.result.current.setEquipmentToDelete(rows[1]!)
  })
  await act(async () => hook.result.current.handleConfirmDelete())
  expect(hook.result.current.equipmentToDelete?.id).toBe('1')
  expect(hook.result.current.currentEquipments.map((row) => row.name)).toEqual([
    'Betoneira',
  ])
  expect(
    fetcher.mock.calls.find(([, init]) => init?.method === 'DELETE')
  ).toMatchObject([
    'https://api.example.test/api/admin/equipments/1',
    { credentials: 'include', headers: { 'x-tenant-id': 'alfa' } },
  ])
  expect(notify.error).toHaveBeenCalledWith('Erro', {
    description: 'Equipamento em uso',
  })
  expect(notify.success).not.toHaveBeenCalled()
})
