// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { TenantProvider } from '../../organizacao'
import { ApplicationSessionProvider } from '../../sessao'
import {
  subscriptionFixture,
  subscriptionTenant,
} from '../../../../../../tests/helpers/subscription-account'
import { useOwnerSubscription } from './useOwnerSubscription'
afterEach(cleanup)

function setup() {
  const pending: Array<{
    signal: AbortSignal | null | undefined
    resolve(response: Response): void
  }> = []
  const fetcher = vi.fn(
    (_path: string, init?: RequestInit) =>
      new Promise<Response>((resolve) =>
        pending.push({ signal: init?.signal, resolve })
      )
  )
  let tenant = subscriptionTenant(),
    userId = 'owner',
    status: 'authenticated' | 'unauthenticated' = 'authenticated'
  let client = createHttpClient({ fetcher })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiClientProvider client={client}>
      <TenantProvider value={tenant}>
        <ApplicationSessionProvider
          value={{
            data: { user: { id: userId, role: 'ADMIN' } },
            status,
            update: async () => null,
            signOut: async () => {},
          }}
        >
          {children}
        </ApplicationSessionProvider>
      </TenantProvider>
    </ApiClientProvider>
  )
  const hook = renderHook(() => useOwnerSubscription(), { wrapper })
  return {
    hook,
    fetcher,
    pending,
    change(next: {
      tenant?: typeof tenant
      userId?: string
      status?: typeof status
      client?: typeof client
    }) {
      tenant = next.tenant ?? tenant
      userId = next.userId ?? userId
      status = next.status ?? status
      client = next.client ?? client
      hook.rerender()
    },
  }
}
it('trocar locadora apaga imediatamente dados anteriores e aborta resposta atrasada', async () => {
  const s = setup()
  await waitFor(() => expect(s.pending).toHaveLength(1))
  await act(async () =>
    s.pending[0]!.resolve(Response.json(subscriptionFixture()))
  )
  await waitFor(() => expect(s.hook.result.current.state.kind).toBe('ready'))
  s.hook.result.current.reload()
  await waitFor(() => expect(s.pending).toHaveLength(2))
  s.change({ tenant: subscriptionTenant('bravo') })
  expect(s.hook.result.current.state.kind).toBe('loading')
  expect(s.pending[1]!.signal?.aborted).toBe(true)
  await waitFor(() => expect(s.pending).toHaveLength(3))
  await act(async () =>
    s.pending[1]!.resolve(
      Response.json({
        ...subscriptionFixture(),
        plan: { ...subscriptionFixture().plan, name: 'Plano privado antigo' },
      })
    )
  )
  expect(s.hook.result.current.state.kind).toBe('loading')
  await act(async () =>
    s.pending[2]!.resolve(
      Response.json({
        ...subscriptionFixture(),
        plan: { ...subscriptionFixture().plan, name: 'Plano de bravo' },
      })
    )
  )
  await waitFor(() =>
    expect(s.hook.result.current.state).toMatchObject({
      kind: 'ready',
      summary: { plan: { name: 'Plano de bravo' } },
    })
  )
})
it.each(['user', 'membership', 'transport'] as const)(
  'resposta do ciclo anterior não passa após mudar %s',
  async (change) => {
    const s = setup()
    await waitFor(() => expect(s.pending).toHaveLength(1))
    if (change === 'user') s.change({ userId: 'new-owner' })
    if (change === 'membership')
      s.change({
        tenant: { ...subscriptionTenant(), membershipId: 'new-membership' },
      })
    if (change === 'transport')
      s.change({ client: createHttpClient({ fetcher: s.fetcher }) })
    await waitFor(() => expect(s.pending).toHaveLength(2))
    expect(s.pending[0]!.signal?.aborted).toBe(true)
    await act(async () =>
      s.pending[0]!.resolve(Response.json(subscriptionFixture()))
    )
    expect(s.hook.result.current.state.kind).toBe('loading')
    await act(async () =>
      s.pending[1]!.resolve(
        Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 })
      )
    )
    await waitFor(() =>
      expect(s.hook.result.current.state).toEqual({
        kind: 'problem',
        problem: 'owner',
      })
    )
  }
)
it('ADMIN global não supera papel CLIENT da locadora', async () => {
  const s = setup()
  await waitFor(() => expect(s.pending).toHaveLength(1))
  s.change({ tenant: subscriptionTenant('alfa', 'CLIENT') })
  expect(s.hook.result.current.state).toEqual({
    kind: 'problem',
    problem: 'owner',
  })
  await act(async () =>
    s.pending[0]!.resolve(Response.json(subscriptionFixture()))
  )
  expect(s.fetcher).toHaveBeenCalledTimes(1)
  expect(s.hook.result.current.state.kind).toBe('problem')
})
it('logout esconde o resumo e invalida requisições', async () => {
  const s = setup()
  await waitFor(() => expect(s.pending).toHaveLength(1))
  s.change({ status: 'unauthenticated' })
  await act(async () =>
    s.pending[0]!.resolve(Response.json(subscriptionFixture()))
  )
  expect(s.hook.result.current.state).toEqual({
    kind: 'problem',
    problem: 'session',
  })
  expect(s.pending[0]!.signal?.aborted).toBe(true)
})
it('retry com duas respostas fora de ordem conserva só a tentativa atual', async () => {
  const s = setup()
  act(() => s.hook.result.current.reload())
  await waitFor(() => expect(s.pending).toHaveLength(2))
  await act(async () =>
    s.pending[1]!.resolve(
      Response.json({ code: 'OWNER_REQUIRED' }, { status: 403 })
    )
  )
  await waitFor(() => expect(s.hook.result.current.state.kind).toBe('problem'))
  await act(async () =>
    s.pending[0]!.resolve(Response.json(subscriptionFixture()))
  )
  expect(s.hook.result.current.state).toEqual({
    kind: 'problem',
    problem: 'owner',
  })
})
