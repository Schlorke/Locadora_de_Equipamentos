// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { DEFAULT_DESIGN } from '../../../shared/lib/category-design'
import { useCategoriesData } from './carga.web'

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('../../../shared/lib', () => ({ useIsMobile: () => false }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('carrega envelope/array, salva icon null e conserva o erro de duplicação', async () => {
  const category = { id: 'cat', name: 'Ferramentas', createdAt: '2026-10-03' }
  let duplicate = false
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (_url, init) =>
      init?.method === 'GET'
        ? Response.json({ categories: [category] })
        : duplicate
          ? Response.json({ error: 'duplicada' }, { status: 409 })
          : Response.json(category, { status: 201 })
    )
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useCategoriesData, {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  await waitFor(() =>
    expect(hook.result.current.categories).toEqual([category])
  )
  const draft = {
    name: 'Nova',
    description: 'Descrição',
    design: { ...DEFAULT_DESIGN, icon: null },
  }
  await act(async () => hook.result.current.handleCategorySave(draft))
  const write = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(write[0]).toBe('https://api.example.test/api/admin/categories')
  expect(write[1]).toMatchObject({
    credentials: 'include',
    headers: { 'x-tenant-id': 'alfa' },
  })
  expect(JSON.parse(write[1]!.body as string)).toMatchObject({
    icon: null,
    name: 'Nova',
  })
  act(() => hook.result.current.openEditCategoryModal(category))
  duplicate = true
  await act(async () => {
    await expect(hook.result.current.handleCategorySave(draft)).rejects.toThrow(
      'Categoria já existente'
    )
  })
  expect(
    fetcher.mock.calls.some(
      ([url, init]) => url.endsWith('/cat') && init?.method === 'PUT'
    )
  ).toBe(true)
  expect(notify.success).toHaveBeenCalledTimes(1)
})

it('aborta a leitura antiga ao trocar o transporte e não aplica a resposta atrasada', async () => {
  let finish!: (value: Response) => void
  const old = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
  let client = createHttpClient({
    baseUrl: 'https://old.example.test',
    fetcher: old,
  })
  const hook = renderHook(useCategoriesData, {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  await waitFor(() => expect(old).toHaveBeenCalledTimes(1))
  client = createHttpClient({
    baseUrl: 'https://new.example.test',
    fetcher: async () => Response.json([]),
  })
  hook.rerender()
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(old.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  await act(async () => finish(Response.json([{ id: 'old', name: 'Old' }])))
  expect(hook.result.current.categories).toEqual([])
  expect(notify.error).not.toHaveBeenCalled()
})
