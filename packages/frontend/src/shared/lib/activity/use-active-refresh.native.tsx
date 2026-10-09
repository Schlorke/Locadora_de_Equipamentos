import { useEffect } from 'react'
import { AppState } from 'react-native'
export function useActiveRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let state = AppState.currentState
    const timer = setInterval(() => {
      if (state === 'active') refresh()
    }, 30000)
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = state
      state = next
      if (next === 'active' && previous !== 'active') refresh()
    })
    return () => {
      clearInterval(timer)
      subscription.remove()
    }
  }, [refresh, enabled])
}
