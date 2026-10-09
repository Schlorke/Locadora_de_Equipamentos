'use client'
import { useEffect } from 'react'
import { useNotificationsModel } from './use-notifications-model'
const UNREAD_COUNT_KEY = 'gb-locacoes-unread-count'
export function useNotifications() {
  const m = useNotificationsModel()
  useEffect(() => {
    localStorage.setItem(UNREAD_COUNT_KEY, m.stats.unread.toString())
    window.dispatchEvent(
      new CustomEvent('notificationUpdate', {
        detail: { unreadCount: m.stats.unread },
      })
    )
  }, [m.stats.unread])
  return m
}
