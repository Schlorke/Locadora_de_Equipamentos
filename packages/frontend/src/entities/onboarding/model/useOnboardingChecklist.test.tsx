// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { onboardingChecklistFixture } from '../../../../../../tests/helpers/onboarding-checklist'
import { useOnboardingChecklist } from './useOnboardingChecklist'
afterEach(cleanup)
function setup(enabled = true) {
  const pending: Array<{
    resolve(response: Response): void
    signal?: AbortSignal | null
  }> = []
  const fetcher = vi.fn(
    (_path: string, init?: RequestInit) =>
      new Promise<Response>((resolve) =>
        pending.push({ resolve, signal: init?.signal })
      )
  )
  let client = createHttpClient({ fetcher })
  const hook = renderHook(
    ({ scope, enabled }) => useOnboardingChecklist(scope, enabled),
    {
      initialProps: { scope: 'alfa', enabled },
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      ),
    }
  )
  return {
    ...hook,
    pending,
    fetcher,
    changeTransport: () => {
      client = createHttpClient({ fetcher })
    },
  }
}
it('espera elegibilidade sem consulta e só consulta quando habilitada', async () => {
  const m = setup(false)
  await act(async () => {})
  expect(m.fetcher).not.toHaveBeenCalled()
  m.rerender({ scope: 'alfa', enabled: true })
  await waitFor(() => expect(m.pending).toHaveLength(1))
  m.rerender({ scope: 'alfa', enabled: false })
  expect(m.pending[0]!.signal?.aborted).toBe(true)
  await act(async () => {
    m.pending[0]!.resolve(Response.json(onboardingChecklistFixture()))
  })
  expect(m.result.current.state.kind).toBe('loading')
  m.rerender({ scope: 'alfa', enabled: true })
  await waitFor(() => expect(m.fetcher).toHaveBeenCalledTimes(2))
})
it('escopo muda: aborta e não mostra checklist da locadora anterior mesmo ignorando abort', async () => {
  const m = setup()
  await waitFor(() => expect(m.pending).toHaveLength(1))
  m.rerender({ scope: 'bravo', enabled: true })
  expect(m.pending[0]!.signal?.aborted).toBe(true)
  expect(m.result.current.state.kind).toBe('loading')
  await act(async () =>
    m.pending[0]!.resolve(
      Response.json(
        onboardingChecklistFixture(['ACCOUNT_CREATED', 'PUBLISH_SITE'])
      )
    )
  )
  expect(m.result.current.state.kind).toBe('loading')
  await act(async () =>
    m.pending[1]!.resolve(Response.json(onboardingChecklistFixture()))
  )
  expect(m.result.current.state).toMatchObject({
    kind: 'ready',
    checklist: onboardingChecklistFixture(),
  })
})
it('recarregar descarta resposta anterior e não altera etapas antes da leitura confirmada', async () => {
  const m = setup()
  await waitFor(() => expect(m.pending).toHaveLength(1))
  act(() => m.result.current.reload())
  await waitFor(() => expect(m.pending).toHaveLength(2))
  expect(m.pending[0]!.signal?.aborted).toBe(true)
  await act(async () =>
    m.pending[0]!.resolve(
      Response.json(
        onboardingChecklistFixture(['ACCOUNT_CREATED', 'PUBLISH_SITE'])
      )
    )
  )
  expect(m.result.current.state.kind).toBe('loading')
  await act(async () =>
    m.pending[1]!.resolve(Response.json(onboardingChecklistFixture()))
  )
  expect(m.result.current.state.kind).toBe('ready')
})
it('desmontagem aborta o transporte', async () => {
  const m = setup()
  await waitFor(() => expect(m.pending).toHaveLength(1))
  m.unmount()
  expect(m.pending[0]!.signal?.aborted).toBe(true)
})
it('falha privada vira somente problema neutro', async () => {
  const m = setup()
  await waitFor(() => expect(m.pending).toHaveLength(1))
  await act(async () =>
    m.pending[0]!.resolve(
      Response.json({ error: 'private-driver' }, { status: 503 })
    )
  )
  expect(m.result.current.state).toEqual({
    kind: 'problem',
    problem: 'unavailable',
  })
})
