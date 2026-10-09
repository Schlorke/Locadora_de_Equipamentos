// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider } from './ApiClientProvider'
import { useScopedApiClient, useApiClientRevision } from './useScopedApiClient'
import {
  createHttpClient,
  type HttpClient,
  type HttpRequest,
} from './http-client'

afterEach(cleanup)
it('a revisão muda somente com a identidade do cliente, inclusive ao voltar ao anterior', () => {
  const first = createHttpClient()
  const second = createHttpClient()
  let selected = first
  const hook = renderHook(useApiClientRevision, {
    wrapper: ({ children }) => (
      <ApiClientProvider client={selected}>{children}</ApiClientProvider>
    ),
  })
  expect(hook.result.current).toBe(0)
  hook.rerender()
  expect(hook.result.current).toBe(0)
  selected = second
  hook.rerender()
  expect(hook.result.current).toBe(1)
  selected = first
  hook.rerender()
  expect(hook.result.current).toBe(2)
})
it('permite verificar o contexto depois de aguardar outro callback sem iniciar uma nova requisição', async () => {
  const hook = renderHook(({ scope }) => useScopedApiClient(scope), {
    initialProps: { scope: 'a' },
  })
  const previous = hook.result.current
  expect(previous.isCurrent()).toBe(true)
  hook.rerender({ scope: 'b' })
  expect(previous.isCurrent()).toBe(false)
  expect(hook.result.current.isCurrent()).toBe(true)
  hook.unmount()
  expect(hook.result.current.isCurrent()).toBe(false)
})
it('invalida também o download cujo cabeçalho chegou antes da troca e corpo chegou depois', async () => {
  let complete!: (value: Blob) => void
  const response = new Response('placeholder')
  vi.spyOn(response, 'blob').mockImplementation(
    () =>
      new Promise((done) => {
        complete = done
      })
  )
  const fetcher = vi.fn().mockResolvedValue(response)
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(({ scope }) => useScopedApiClient(scope), {
    initialProps: { scope: 'a' },
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  const pending = hook.result.current
    .request('/api/contracts/id/download', { responseType: 'binary' })
    .catch((error) => error)
  await act(async () => {
    await Promise.resolve()
  })
  expect(complete).toBeTypeOf('function')
  hook.rerender({ scope: 'b' })
  await act(async () => complete(new Blob(['private bytes'])))
  expect(await pending).toMatchObject({ name: 'AbortError' })
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true)
})
it('respeita cancelamento explícito mesmo quando o transporte ignora abort', async () => {
  let resolve!: (value: unknown) => void
  const request = vi.fn(
    (_path: string, _options?: HttpRequest) =>
      new Promise((done) => {
        resolve = done
      })
  )
  const client = { request } as HttpClient
  const hook = renderHook(() => useScopedApiClient('opaco'), {
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  const controller = new AbortController()
  const pending = hook.result.current
    .request('/api/addresses', { signal: controller.signal })
    .catch((error) => error)
  controller.abort()
  expect(request.mock.calls[0]![1]?.signal?.aborted).toBe(true)
  await act(async () => resolve({ addresses: [] }))
  expect(await pending).toMatchObject({ name: 'AbortError' })
  await expect(
    hook.result.current.request('/api/addresses', { signal: controller.signal })
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(request).toHaveBeenCalledTimes(1)
})
it('troca da chave opaca invalida resposta e impede nova chamada pelo cliente antigo', async () => {
  let resolve!: (value: unknown) => void
  const request = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const client = { request } as HttpClient
  const hook = renderHook(({ scope }) => useScopedApiClient(scope), {
    initialProps: { scope: 'a' },
    wrapper: ({ children }) => (
      <ApiClientProvider client={client}>{children}</ApiClientProvider>
    ),
  })
  const old = hook.result.current
  const pending = old.request('/api/user/profile').catch((error) => error)
  hook.rerender({ scope: 'b' })
  resolve({ user: {} })
  expect(await pending).toMatchObject({ name: 'AbortError' })
  await expect(
    old.request('/api/user/profile', { method: 'PUT' })
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(request).toHaveBeenCalledTimes(1)
})
