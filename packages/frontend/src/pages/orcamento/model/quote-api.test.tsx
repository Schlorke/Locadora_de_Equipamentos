// @vitest-environment jsdom
import { createElement, StrictMode, type ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ApiClientProvider,
  type HttpClient,
  type HttpRequest,
} from '../../../shared/api'
import { useQuoteApi } from './quote-api'

afterEach(cleanup)
function deferred() {
  let resolve!: (value: unknown) => void
  const promise = new Promise((resolveValue) => {
    resolve = resolveValue
  })
  return { promise, resolve }
}
function wrapper(client: HttpClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(ApiClientProvider, { client, children })
}
it('descarta resposta de um escopo encerrado mesmo se o transporte ignorar abort', async () => {
  const pending = deferred(),
    request = vi.fn((_path: string, _options?: HttpRequest) => pending.promise)
  const hook = renderHook(({ slug }) => useQuoteApi(slug), {
    initialProps: { slug: 'alfa' },
    wrapper: wrapper({ request } as HttpClient),
  })
  const old = hook.result.current,
    result = old.profile().catch((error) => error)
  hook.rerender({ slug: 'bravo' })
  expect(request.mock.calls[0]![1]?.signal?.aborted).toBe(true)
  await act(async () => {
    pending.resolve({ user: { company: 'Alfa' } })
  })
  expect(await result).toMatchObject({ name: 'AbortError' })
  await expect(old.saveProfile({ company: 'Antigo' })).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(request).toHaveBeenCalledTimes(1)
})
it('também cancela chamadas antigas após mudar o cliente e ao desmontar', async () => {
  const pending = deferred(),
    first = { request: vi.fn(() => pending.promise) } as unknown as HttpClient
  const second = {
    request: vi.fn(async () => ({ user: { company: 'Atual' } })),
  } as unknown as HttpClient
  let client = first
  const hook = renderHook(() => useQuoteApi('alfa'), {
    wrapper: ({ children }) =>
      createElement(ApiClientProvider, { client, children }),
  })
  const old = hook.result.current,
    result = old.profile().catch((error) => error)
  client = second
  hook.rerender()
  await expect(hook.result.current.profile()).resolves.toEqual({
    user: { company: 'Atual' },
  })
  pending.resolve({ user: { company: 'Antigo' } })
  expect(await result).toMatchObject({ name: 'AbortError' })
  await expect(old.saveProfile({})).rejects.toMatchObject({
    name: 'AbortError',
  })
  const current = hook.result.current
  hook.unmount()
  await expect(current.saveProfile({})).rejects.toMatchObject({
    name: 'AbortError',
  })
})
it('permanece utilizável em StrictMode e conserva erros do escopo atual', async () => {
  const request = vi.fn(async () => {
    throw new Error('offline')
  })
  const hook = renderHook(() => useQuoteApi('alfa'), {
    wrapper: ({ children }) =>
      createElement(
        StrictMode,
        null,
        createElement(ApiClientProvider, {
          client: { request } as HttpClient,
          children,
        })
      ),
  })
  await expect(hook.result.current.profile()).rejects.toThrow('offline')
})
