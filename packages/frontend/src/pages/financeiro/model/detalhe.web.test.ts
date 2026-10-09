// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const notify = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: notify }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
import { useFinancialEntryDetails } from './detalhe.web'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
describe('Financial boleto reconciliation', () => {
  it('uses the actual PUT endpoint and preserves a reconciliation denial', async () => {
    vi.stubGlobal('confirm', () => true)
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Reemissão aguarda o fluxo de cancelamento confirmado',
      }),
    })
    vi.stubGlobal('fetch', fetcher)
    const refreshAll = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useFinancialEntryDetails({
        refreshAll,
        viewMode: 'list',
        loadEntries: refreshAll,
        loadCalendar: refreshAll,
        loadDashboardData: refreshAll,
        entries: [],
        searchParams: new URLSearchParams() as Parameters<
          typeof useFinancialEntryDetails
        >[0]['searchParams'],
      })
    )
    await act(async () => {
      await result.current.regenerateBoleto('payment-1')
    })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/api/payments/boleto/payment-1/regenerate',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    )
    expect(notify.error).toHaveBeenCalledExactlyOnceWith(
      'Reemissão aguarda o fluxo de cancelamento confirmado'
    )
    expect(notify.success).not.toHaveBeenCalled()
    expect(refreshAll).not.toHaveBeenCalled()
    expect(result.current.regeneratingBoletoId).toBeNull()
  })

  it('keeps the confirmed due date when the server queues a reissue', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        paymentId: 'payment-1',
        processing: 'PENDING',
        operationId: 'operation-1',
      }),
    })
    vi.stubGlobal('fetch', fetcher)
    const refresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useFinancialEntryDetails({
        refreshAll: refresh,
        viewMode: 'list',
        loadEntries: refresh,
        loadCalendar: refresh,
        loadDashboardData: refresh,
        entries: [],
        searchParams: new URLSearchParams() as Parameters<
          typeof useFinancialEntryDetails
        >[0]['searchParams'],
      })
    )
    const entry = {
      id: 'payment-1',
      dueDate: '2026-10-01T12:00:00.000Z',
      billingStatus: 'UNPAID',
    } as import('./tipos').FinancialEntry
    act(() => result.current.setSelectedEntry(entry))
    await act(async () =>
      result.current.updateEntryDueDate('payment-1', '2026-11-01')
    )
    expect(result.current.selectedEntry).toEqual(entry)
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalledWith(
      'Reemissão solicitada; o vencimento será atualizado após confirmação.'
    )
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('does not claim the PDF is ready after an accepted regeneration', async () => {
    vi.stubGlobal('confirm', () => true)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({
          processing: 'PENDING',
          operationId: 'reissue-1',
        }),
      })
    )
    const refresh = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useFinancialEntryDetails({
        refreshAll: refresh,
        viewMode: 'list',
        loadEntries: refresh,
        loadCalendar: refresh,
        loadDashboardData: refresh,
        entries: [],
        searchParams: new URLSearchParams() as Parameters<
          typeof useFinancialEntryDetails
        >[0]['searchParams'],
      })
    )
    await act(async () => result.current.regenerateBoleto('payment-1'))
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledOnce()
  })
})
