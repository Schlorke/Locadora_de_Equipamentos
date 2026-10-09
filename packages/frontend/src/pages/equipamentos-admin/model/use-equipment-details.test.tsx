// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useEquipmentDetails } from './use-equipment-details'
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('../../../shared/lib/toast', () => ({ toast: notify }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it.each(['registro', 'transporte', 'unmount'])(
  'confirmar exclusão de ciclo encerrado por %s não envia DELETE',
  async (kind) => {
    let resolve!: (approved: boolean) => void
    const requestConfirmation = vi.fn(
        () =>
          new Promise<boolean>((done) => {
            resolve = done
          })
      ),
      navigate = vi.fn()
    const ports = { requestConfirmation, navigate }
    const fetcher = vi.fn(async (_url: string, _options?: RequestInit) =>
      Response.json({ id: 'old', name: 'Antigo' })
    )
    const old = createHttpClient({ fetcher }),
      next = createHttpClient({ fetcher }),
      state = { client: old }
    const hook = renderHook(({ id }) => useEquipmentDetails(id, ports), {
      initialProps: { id: 'old' },
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(ApiClientProvider, { client: state.client, children }),
    })
    await waitFor(() =>
      expect(hook.result.current.equipment?.name).toBe('Antigo')
    )
    let operation!: Promise<void>
    act(() => {
      operation = hook.result.current.handleDelete()
    })
    expect(requestConfirmation).toHaveBeenCalledTimes(1)
    if (kind === 'unmount') hook.unmount()
    else {
      if (kind === 'transporte') state.client = next
      hook.rerender({ id: kind === 'registro' ? 'new' : 'old' })
    }
    await act(async () => {
      resolve(true)
      await operation
    })
    expect(fetcher.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(
      false
    )
    expect(notify.success).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  }
)
