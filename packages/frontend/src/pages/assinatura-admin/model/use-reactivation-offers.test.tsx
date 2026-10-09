// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { subscriptionOfferFixture } from '../../../../../../tests/helpers/subscription-account'
import { useReactivationOffers } from './use-reactivation-offers'

afterEach(cleanup)
function setup(
  fetcher: (path: string, init?: RequestInit) => Promise<Response>,
  enabled = true
) {
  const client = createHttpClient({ fetcher })
  return renderHook(
    ({ scope, enabled }) => useReactivationOffers(scope, enabled),
    {
      initialProps: { scope: 'scope-alfa', enabled },
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      ),
    }
  )
}
it('não consulta catálogo antes de uma assinatura encerrada autorizada', async () => {
  const fetcher = vi.fn(async () => Response.json({ plans: [] }))
  const { rerender, result } = setup(fetcher, false)
  expect(fetcher).not.toHaveBeenCalled()
  rerender({ scope: 'scope-alfa', enabled: true })
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('recupera consulta falha somente após retry explícito', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValue(Response.json({ plans: [subscriptionOfferFixture()] }))
  const { result } = setup(fetcher)
  await waitFor(() => expect(result.current.state.kind).toBe('unavailable'))
  expect(fetcher).toHaveBeenCalledTimes(1)
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('ignora retorno antigo e aborta catálogo do escopo anterior', async () => {
  let finish!: (response: Response) => void
  const fetcher = vi.fn(
    (_path: string, _init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        finish = resolve
      })
  )
  const { rerender, result } = setup(fetcher)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  rerender({ scope: 'scope-bravo', enabled: false })
  expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await act(async () =>
    finish(Response.json({ plans: [subscriptionOfferFixture()] }))
  )
  expect(result.current.state.kind).toBe('loading')
})
