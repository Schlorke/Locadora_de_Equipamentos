'use client'
import { useEffect } from 'react'
export function useActiveRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const active = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(active, 30000)
    document.addEventListener('visibilitychange', active)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', active)
    }
  }, [refresh, enabled])
}
