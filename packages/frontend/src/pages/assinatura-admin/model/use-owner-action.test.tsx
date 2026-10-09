// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import {
  subscriptionFixture,
  subscriptionOfferFixture,
} from '../../../../../../tests/helpers/subscription-account'
import type {
  PublicPlan,
  SubscriptionSummary,
} from '@gb-locacoes/contracts/subscription'
import { useOwnerAction } from './use-owner-action'

afterEach(cleanup)
function setup(
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
  summary = subscriptionFixture(),
  offers?: PublicPlan[]
) {
  const client = createHttpClient({ fetcher }),
    reload = vi.fn(),
    newKey = vi.fn(() => 'fixture-intent-1')
  const initialProps: {
    scope: string
    summary: SubscriptionSummary | null | undefined
    offers?: PublicPlan[]
  } = {
    scope: 'scope-alfa',
    summary: summary as SubscriptionSummary | null | undefined,
    offers,
  }
  const hook = renderHook(
    (props) => useOwnerAction({ ...props, reload, newKey }),
    {
      initialProps,
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      ),
    }
  )
  return { ...hook, reload, newKey }
}
it('exige confirmação e bloqueia duplo clique; accepted só relê, sem alterar o resumo', async () => {
  let resolve!: (value: Response) => void
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      })
  )
  const { result, reload } = setup(fetcher)
  act(() => result.current.begin())
  expect(fetcher).not.toHaveBeenCalled()
  let pending!: Promise<void>
  act(() => {
    pending = result.current.confirm()
    void result.current.confirm()
  })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(result.current.isBusy).toBe(true)
  act(() => result.current.dismiss())
  expect(result.current.dialogOpen).toBe(true)
  await act(async () => {
    resolve(Response.json({ accepted: true }))
    await pending
  })
  expect(result.current.state.kind).toBe('accepted')
  expect(reload).toHaveBeenCalledTimes(1)
  expect(result.current.action).toBe('cancel')
})
it('resultado incerto conserva a chave mesmo fechando/reabrindo; nunca repete automaticamente', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  const { result, newKey } = setup(fetcher)
  act(() => result.current.begin())
  await act(async () => result.current.confirm())
  expect(result.current.state.kind).toBe('uncertain')
  expect(fetcher).toHaveBeenCalledTimes(1)
  act(() => result.current.dismiss())
  act(() => result.current.begin())
  await act(async () => result.current.confirm())
  expect(newKey).toHaveBeenCalledTimes(1)
  expect(
    fetcher.mock.calls.map((call) =>
      new Headers(call[1]?.headers).get('Idempotency-Key')
    )
  ).toEqual(['fixture-intent-1', 'fixture-intent-1'])
})
it.each(['scope', 'summary'] as const)(
  'mudança de %s encerra a confirmação e impede usar o handler antigo',
  async (change) => {
    const fetcher = vi.fn(async () => Response.json({ accepted: true }))
    const { result, rerender } = setup(fetcher)
    act(() => result.current.begin())
    const oldConfirm = result.current.confirm
    rerender({
      scope: change === 'scope' ? 'scope-bravo' : 'scope-alfa',
      summary: {
        ...subscriptionFixture(),
        cancelAtPeriodEnd: change === 'summary',
      },
    })
    await act(async () => oldConfirm())
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.dialogOpen).toBe(false)
  }
)
it('mudança de escopo aborta o transporte e descarta resposta mesmo se fetch ignora abort', async () => {
  let resolve!: (value: Response) => void
  const fetcher = vi.fn(
    (_input: string, _init?: RequestInit) =>
      new Promise<Response>((done) => {
        resolve = done
      })
  )
  const { result, rerender, reload } = setup(fetcher)
  act(() => result.current.begin())
  let pending!: Promise<void>
  act(() => {
    pending = result.current.confirm()
  })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  rerender({ scope: 'scope-bravo', summary: subscriptionFixture() })
  expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await act(async () => {
    resolve(Response.json({ accepted: true }))
    await pending
  })
  expect(result.current.state.kind).toBe('idle')
  expect(reload).not.toHaveBeenCalled()
})
it('sessão antiga exige autenticar de novo; não transforma retorno em novo POST', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ code: 'FRESH_SESSION_REQUIRED' }, { status: 401 })
  )
  const { result, reload } = setup(fetcher)
  act(() => result.current.begin())
  await act(async () => result.current.confirm())
  expect(result.current.state).toEqual({
    kind: 'problem',
    problem: 'reauthentication',
  })
  expect(result.current.dialogOpen).toBe(false)
  expect(reload).not.toHaveBeenCalled()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('ausência ou encerramento não permite cancelar; agendamento oferece desfazer', () => {
  const fetcher = vi.fn(async () => Response.json({ accepted: true }))
  const { result, rerender } = setup(fetcher)
  rerender({ scope: 'scope-alfa', summary: null })
  act(() => result.current.begin())
  expect(result.current.action).toBeNull()
  expect(result.current.dialogOpen).toBe(false)
  rerender({ scope: 'scope-alfa', summary: subscriptionFixture('CANCELED') })
  expect(result.current.action).toBeNull()
  rerender({
    scope: 'scope-alfa',
    summary: { ...subscriptionFixture(), cancelAtPeriodEnd: true },
  })
  expect(result.current.action).toBe('undo-cancel')
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['INCOMPLETE', 'TRIALING'] as const)(
  'ativação de %s espera confirmação, envia uma vez e relê sem presumir ACTIVE',
  async (status) => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn(
      (_path: string, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          finish = resolve
        })
    )
    const { result, reload } = setup(fetcher, subscriptionFixture(status))
    act(() => result.current.begin('activate'))
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.canStart('cancel')).toBe(false)
    let pending!: Promise<void>
    act(() => {
      pending = result.current.confirm()
      void result.current.confirm()
    })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/admin/subscription/activate')
    act(() => result.current.dismiss())
    expect(result.current.dialogOpen).toBe(true)
    await act(async () => {
      finish(Response.json({ accepted: true }))
      await pending
    })
    expect(result.current.state).toEqual({
      kind: 'accepted',
      action: 'activate',
    })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(result.current.canActivate).toBe(true)
  }
)

it.each(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] as const)(
  'não oferece ativação em %s',
  (status) => {
    const fetcher = vi.fn(async () => Response.json({ accepted: true }))
    const { result } = setup(fetcher, subscriptionFixture(status))
    act(() => result.current.begin('activate'))
    expect(result.current.canActivate).toBe(false)
    expect(result.current.dialogOpen).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  }
)

it.each([
  { billingMode: 'COMPLIMENTARY' as const },
  { cancelAtPeriodEnd: true },
  { plan: { ...subscriptionFixture().plan, amount: '0.00' } },
  { plan: { ...subscriptionFixture().plan, interval: 'YEARLY' as const } },
])('não oferece ativação sem modalidade/plano disponível (%j)', (override) => {
  const fetcher = vi.fn(async () => Response.json({ accepted: true }))
  const { result } = setup(fetcher, {
    ...subscriptionFixture('TRIALING'),
    ...override,
  })
  act(() => result.current.begin('activate'))
  expect(result.current.canActivate).toBe(false)
  expect(fetcher).not.toHaveBeenCalled()
})

it('ativação incerta conserva ação e chave, mesmo ao fechar, e bloqueia outro comando', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  const { result, newKey } = setup(fetcher, subscriptionFixture('TRIALING'))
  act(() => result.current.begin('activate'))
  await act(async () => result.current.confirm())
  act(() => result.current.dismiss())
  act(() => result.current.begin('cancel'))
  expect(result.current.dialogOpen).toBe(false)
  expect(result.current.canStart('cancel')).toBe(false)
  act(() => result.current.begin('activate'))
  await act(async () => result.current.confirm())
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    '/api/admin/subscription/activate',
    '/api/admin/subscription/activate',
  ])
  expect(
    fetcher.mock.calls.map((call) =>
      new Headers(call[1]?.headers).get('Idempotency-Key')
    )
  ).toEqual(['fixture-intent-1', 'fixture-intent-1'])
  expect(newKey).toHaveBeenCalledTimes(1)
})

it('mudança do preço entre intenção e confirmação invalida a ativação', async () => {
  const fetcher = vi.fn(async () => Response.json({ accepted: true }))
  const { result, rerender } = setup(fetcher, subscriptionFixture('TRIALING'))
  act(() => result.current.begin('activate'))
  const previous = result.current.confirm
  rerender({
    scope: 'scope-alfa',
    summary: {
      ...subscriptionFixture('TRIALING'),
      plan: { ...subscriptionFixture().plan, amount: '249.90' },
    },
  })
  await act(async () => previous())
  expect(fetcher).not.toHaveBeenCalled()
  expect(result.current.dialogOpen).toBe(false)
})

it('reativar exige oferta explicitamente escolhida e confirmação; duplo clique emite uma vez', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn(
    (_path: string, _init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { result, newKey, reload } = setup(
    fetcher,
    subscriptionFixture('CANCELED'),
    [subscriptionOfferFixture()]
  )
  act(() => result.current.begin('reactivate'))
  expect(result.current.dialogOpen).toBe(false)
  expect(newKey).not.toHaveBeenCalled()
  act(() => result.current.begin('reactivate', 'offer-fixture'))
  expect(result.current.dialogOpen).toBe(true)
  expect(fetcher).not.toHaveBeenCalled()
  let pending!: Promise<void>
  act(() => {
    pending = result.current.confirm()
    void result.current.confirm()
  })
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
    '{"planVersionId":"offer-fixture"}'
  )
  await act(async () => {
    finish(Response.json({ accepted: true }))
    await pending
  })
  expect(reload).toHaveBeenCalledTimes(1)
  expect(result.current.state).toEqual({
    kind: 'accepted',
    action: 'reactivate',
  })
})

it.each(['INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const)(
  'não reativa %s mesmo com oferta',
  (status) => {
    const fetcher = vi.fn()
    const { result, newKey } = setup(fetcher, subscriptionFixture(status), [
      subscriptionOfferFixture(),
    ])
    act(() => result.current.begin('reactivate', 'offer-fixture'))
    expect(result.current.dialogOpen).toBe(false)
    expect(newKey).not.toHaveBeenCalled()
  }
)

it.each(['price', 'removed', 'scope'] as const)(
  'alterar %s invalida oferta revisada e o handler anterior',
  async (change) => {
    const fetcher = vi.fn(),
      offer = subscriptionOfferFixture()
    const { result, rerender } = setup(
      fetcher,
      subscriptionFixture('CANCELED'),
      [offer]
    )
    act(() => result.current.begin('reactivate', offer.planVersionId))
    const confirm = result.current.confirm
    rerender({
      scope: change === 'scope' ? 'scope-bravo' : 'scope-alfa',
      summary: subscriptionFixture('CANCELED'),
      offers: change === 'removed' ? [] : [{ ...offer, amount: '249.90' }],
    })
    await act(async () => confirm())
    expect(result.current.dialogOpen).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  }
)

it('reativação incerta conserva plano/chave e permite repetir o pedido mesmo se oferta sair do catálogo', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ accepted: true }))
  const { result, rerender, newKey } = setup(
    fetcher,
    subscriptionFixture('CANCELED'),
    [subscriptionOfferFixture()]
  )
  act(() => result.current.begin('reactivate', 'offer-fixture'))
  await act(async () => result.current.confirm())
  act(() => result.current.dismiss())
  rerender({
    scope: 'scope-alfa',
    summary: subscriptionFixture('CANCELED'),
    offers: [],
  })
  act(() => result.current.begin('activate'))
  expect(result.current.dialogOpen).toBe(false)
  act(() => result.current.begin('reactivate', 'different-offer'))
  await act(async () => result.current.confirm())
  expect(
    fetcher.mock.calls.map((call) => [
      call[0],
      call[1]?.body,
      new Headers(call[1]?.headers).get('Idempotency-Key'),
    ])
  ).toEqual([
    [
      '/api/admin/subscription/reactivate',
      '{"planVersionId":"offer-fixture"}',
      'fixture-intent-1',
    ],
    [
      '/api/admin/subscription/reactivate',
      '{"planVersionId":"offer-fixture"}',
      'fixture-intent-1',
    ],
  ])
  expect(newKey).toHaveBeenCalledTimes(1)
})
