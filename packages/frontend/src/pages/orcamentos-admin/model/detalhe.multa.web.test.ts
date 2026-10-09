// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('../../../features/selos-admin', () => ({
  invalidateAdminBadges: vi.fn(),
}))

import { useQuoteDetails } from './detalhe.web'

const RECONCILIATION =
  'Cobrança emitida ou paga requer reconciliação antes de alterar o valor do orçamento'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function details() {
  return renderHook(() =>
    useQuoteDetails({
      updateQuoteInState: vi.fn(async () => null),
      fetchQuotes: vi.fn(async () => []),
      quotesRef: { current: [] },
      boletoActionLocksRef: { current: new Set<string>() },
      loading: false,
      quotes: [],
    })
  )
}

/** Asaas fora da conversa: só a rota de cálculo e a de aprovação (PATCH) respondem. */
function server(patchResponse: () => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) =>
      url.endsWith('/calculate-late-fee')
        ? Response.json({ lateFee: 10, daysLate: 2 })
        : init?.method === 'PATCH'
          ? patchResponse()
          : Response.json({ adjustments: [] })
    )
  )
}

async function calculateAndApprove(
  result: ReturnType<typeof details>['result']
) {
  await act(async () => {
    await result.current.calculateLateFee('quote-1')
  })
  await act(async () => {
    await result.current.approveLateFee('quote-1')
  })
}

describe('aprovar multa no detalhe do orçamento', () => {
  it('mostra a mensagem do servidor quando a cobrança emitida exige conciliação (409), senão o texto de sempre', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server(() =>
      Response.json(
        {
          error: RECONCILIATION,
          code: 'PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION',
        },
        { status: 409 }
      )
    )
    const { result } = details()
    await calculateAndApprove(result)
    expect(toast.error).toHaveBeenLastCalledWith('Erro', {
      description: RECONCILIATION,
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(result.current.isUpdating).toBe(false)

    // Sem mensagem do servidor, o texto de sempre.
    server(() => new Response('falha', { status: 500 }))
    await calculateAndApprove(result)
    expect(toast.error).toHaveBeenLastCalledWith('Erro', {
      description: 'Erro ao aprovar multa. Tente novamente.',
    })
    expect(toast.success).not.toHaveBeenCalled()
  })
})
