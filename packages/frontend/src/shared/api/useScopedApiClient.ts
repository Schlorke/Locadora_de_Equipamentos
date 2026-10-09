'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApiClient } from './ApiClientProvider'
import type { HttpClient, HttpRequest } from './http-client'

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** Identidade opaca do transporte para reiniciar o estado de uma tela. */
export function useApiClientRevision(): number {
  const client = useApiClient()
  const [cycle, setCycle] = useState({ client, revision: 0 })
  if (cycle.client !== client) {
    const next = { client, revision: cycle.revision + 1 }
    setCycle(next)
    return next.revision
  }
  return cycle.revision
}

/** Ciclo do transporte; a chave é opaca e não resolve identidade ou locadora. */
export function useScopedApiClient(scope: string | null): HttpClient & {
  isCurrent(): boolean
} {
  const client = useApiClient()
  const state = useMemo(
    () => ({
      active: false,
      revision: 0,
      controllers: new Set<AbortController>(),
    }),
    [client, scope]
  )
  useEffect(() => {
    state.active = true
    state.revision++
    return () => {
      state.active = false
      state.revision++
      for (const controller of state.controllers) controller.abort()
      state.controllers.clear()
    }
  }, [state])

  return useMemo(
    () => ({
      isCurrent: () => state.active,
      async request<T>(path: string, options: HttpRequest = {}) {
        const revision = state.revision
        const cancelled = () =>
          !state.active ||
          state.revision !== revision ||
          options.signal?.aborted
        const stale = () =>
          Object.assign(new Error('Solicitação de um escopo encerrado.'), {
            name: 'AbortError',
          })
        if (cancelled()) throw stale()
        const controller = new AbortController()
        const abort = () => controller.abort()
        options.signal?.addEventListener('abort', abort, { once: true })
        state.controllers.add(controller)
        try {
          const data = await client.request<T>(path, {
            ...options,
            signal: controller.signal,
          })
          if (cancelled()) throw stale()
          return data
        } catch (error) {
          if (cancelled()) throw stale()
          throw error
        } finally {
          options.signal?.removeEventListener('abort', abort)
          state.controllers.delete(controller)
        }
      },
    }),
    [client, state]
  )
}
