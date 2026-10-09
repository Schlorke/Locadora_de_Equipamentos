// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useDashboardData } from './carga'

const notify = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('sonner', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('inicia quatro leituras paralelas e exibe o principal antes dos dados secundários', async () => {
  let finishQuotes!: (response: Response) => void
  const stats = {
    totalQuotes: 9,
    pendingQuotes: 2,
    approvedQuotes: 1,
    rejectedQuotes: 0,
    completedQuotes: 0,
  }
  const fetcher = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async (url) => {
      if (url.endsWith('/dashboard')) return Response.json(stats)
      if (url.endsWith('limit=5'))
        return new Promise((resolve) => {
          finishQuotes = resolve
        })
      if (url.includes('/revenue'))
        return Response.json({ revenueHistory: [], revenueByCategory: [] })
      return Response.json({ agingData: [], topDebtors: [] })
    })
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
    getHeaders: () => ({ 'x-tenant-id': 'alfa' }),
  })
  const hook = renderHook(useDashboardData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(hook.result.current.stats).toEqual(stats))
  expect(hook.result.current.isLoading).toBe(false)
  expect(hook.result.current.recentQuotes).toEqual([])
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://api.example.test/api/admin/dashboard',
    'https://api.example.test/api/admin/quotes?limit=5',
    'https://api.example.test/api/admin/financial/revenue?months=12',
    'https://api.example.test/api/admin/financial/aging',
  ])
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: { 'x-tenant-id': 'alfa' },
    })
  await act(async () =>
    finishQuotes(
      Response.json({
        quotes: Array.from({ length: 6 }, (_, i) => ({
          id: String(i),
          name: 'Cliente',
          email: 'cliente@example.test',
          company: 'Empresa',
          finalTotal: 0,
          status: 'approved',
          createdAt: '2026-10-03',
          items: [{ id: 'item' }],
        })),
      })
    )
  )
  await waitFor(() => expect(hook.result.current.recentQuotes).toHaveLength(5))
  expect(hook.result.current.recentQuotes[0]).toMatchObject({
    customerName: 'Cliente',
    customerEmail: 'cliente@example.test',
    customerCompany: 'Empresa',
    totalAmount: 0,
    itemsCount: 1,
    status: 'approved',
  })
  expect(
    hook.result.current.statusChartData.map((value) => value.name)
  ).toEqual(['Pendentes', 'Aprovados'])
})

it('conserva o principal diante de JSON secundário inválido e informa a falha parcial', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const client = createHttpClient({
    fetcher: async (url) =>
      url.endsWith('/dashboard')
        ? Response.json({ totalQuotes: 1 })
        : new Response('<html>erro</html>'),
  })
  const hook = renderHook(useDashboardData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(notify.error).toHaveBeenCalledWith(
      'Alguns dados do dashboard não puderam ser carregados'
    )
  )
  expect(hook.result.current.stats).toEqual({ totalQuotes: 1 })
  expect(hook.result.current.statsError).toBeNull()
  expect(hook.result.current.recentQuotes).toEqual([])
  expect(hook.result.current.revenueData).toBeNull()
})

it('falha principal não deixa rejeições secundárias sem tratamento', async () => {
  const client = createHttpClient({
    fetcher: async (url) => {
      if (url.endsWith('/dashboard')) return new Response('', { status: 403 })
      throw new Error('secundário indisponível')
    },
  })
  const hook = renderHook(useDashboardData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(hook.result.current.statsError).toBe(
      'Não foi possível carregar os dados principais do dashboard.'
    )
  )
  expect(hook.result.current.isLoading).toBe(false)
  expect(notify.error).not.toHaveBeenCalled()
})

it('falha secundária é informada sem esperar outra consulta pendente', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const finish: Array<(response: Response) => void> = []
  const client = createHttpClient({
    fetcher: async (url) => {
      if (url.endsWith('/dashboard')) return Response.json({ totalQuotes: 1 })
      if (url.endsWith('limit=5')) throw new Error('falha de rede')
      return new Promise((resolve) => finish.push(resolve))
    },
  })
  const hook = renderHook(useDashboardData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() =>
    expect(notify.error).toHaveBeenCalledWith(
      'Alguns dados do dashboard não puderam ser carregados'
    )
  )
  expect(hook.result.current.stats).toEqual({ totalQuotes: 1 })
  await act(async () => finish.forEach((resolve) => resolve(Response.json({}))))
})

it('troca de transporte descarta corpo principal e secundários antigos', async () => {
  const finish: Array<(response: Response) => void> = []
  const old = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(() => new Promise((resolve) => finish.push(resolve)))
  let client = createHttpClient({ fetcher: old })
  const hook = renderHook(useDashboardData, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  await waitFor(() => expect(old).toHaveBeenCalledTimes(4))
  client = createHttpClient({
    fetcher: async (url) =>
      Response.json(url.endsWith('/dashboard') ? { totalQuotes: 2 } : []),
  })
  hook.rerender()
  await waitFor(() =>
    expect(hook.result.current.stats).toEqual({ totalQuotes: 2 })
  )
  expect(old.mock.calls.every(([, init]) => init!.signal!.aborted)).toBe(true)
  await act(async () =>
    finish.forEach((resolve) => resolve(Response.json({ totalQuotes: 99 })))
  )
  expect(hook.result.current.stats).toEqual({ totalQuotes: 2 })
  expect(notify.error).not.toHaveBeenCalled()
})
