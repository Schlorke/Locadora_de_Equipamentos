// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  currentState: 'active',
  listener: null as null | ((next: string) => void),
  remove: vi.fn(),
}))
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return state.currentState
    },
    addEventListener: (_event: string, listener: (next: string) => void) => {
      state.listener = listener
      return { remove: state.remove }
    },
  },
}))
import { useActiveRefresh } from './use-active-refresh.native'
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  state.currentState = 'active'
  state.listener = null
})
it('refresca a cada 30s apenas ativo, volta do background e encerra timer/listener', () => {
  vi.useFakeTimers()
  const refresh = vi.fn(),
    view = renderHook(() => useActiveRefresh(refresh))
  act(() => vi.advanceTimersByTime(29999))
  expect(refresh).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(refresh).toHaveBeenCalledTimes(1)
  act(() => {
    state.listener?.('background')
    vi.advanceTimersByTime(60000)
  })
  expect(refresh).toHaveBeenCalledTimes(1)
  act(() => state.listener?.('active'))
  expect(refresh).toHaveBeenCalledTimes(2)
  view.unmount()
  act(() => vi.advanceTimersByTime(60000))
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(state.remove).toHaveBeenCalledTimes(1)
})
it('não instala polling quando desabilitado', () => {
  vi.useFakeTimers()
  const refresh = vi.fn()
  renderHook(() => useActiveRefresh(refresh, false))
  act(() => vi.advanceTimersByTime(60000))
  expect(refresh).not.toHaveBeenCalled()
  expect(state.listener).toBeNull()
})
