'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from '../../../entities/sessao'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import {
  useScopedApiClient,
  useApiClientRevision,
  isAbortError,
  type HttpJsonResponse,
} from '../../../shared/api'
import type {
  Notification,
  NotificationStats,
  ApiNotification,
  NotificationsResponse,
} from './notification-contract'

interface Snapshot {
  scope: string
  notifications: Notification[]
  stats: NotificationStats
  isLoading: boolean
  error: string | null
}
const empty = (scope: string): Snapshot => ({
  scope,
  notifications: [],
  stats: { total: 0, unread: 0, byType: {} },
  isLoading: true,
  error: null,
})
export function useNotificationScope() {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    session?.user?.role,
    status,
    revision,
  ])
}
function mapApiNotification(apiNotif: ApiNotification): Notification {
  return {
    id: apiNotif.id,
    type: apiNotif.type.toLowerCase() as Notification['type'],
    title: apiNotif.title,
    message: apiNotif.message,
    isRead: apiNotif.isRead,
    createdAt: new Date(apiNotif.createdAt),
    actionUrl: apiNotif.actionUrl,
    priority: apiNotif.priority.toLowerCase() as Notification['priority'],
    readAt: apiNotif.readAt ? new Date(apiNotif.readAt) : null,
    metadata: apiNotif.metadata,
  }
}
export function useNotificationsModel() {
  const { data: session, status } = useSession(),
    scope = useNotificationScope(),
    client = useScopedApiClient(scope)
  const [snapshot, setSnapshot] = useState<Snapshot>(() => empty(scope)),
    readRevision = useRef(0)
  const update = useCallback(
    (change: (s: Snapshot) => Snapshot) => {
      if (client.isCurrent())
        setSnapshot((prev) => (prev.scope === scope ? change(prev) : prev))
    },
    [client, scope]
  )
  const current = snapshot.scope === scope ? snapshot : empty(scope)
  const syncAdminNotifications = useCallback(async () => {
    if (session?.user?.role !== 'ADMIN') return
    try {
      await client.request('/api/admin/notifications/sync', {
        method: 'POST',
        responseType: 'json-response',
      })
    } catch (err) {
      if (isAbortError(err)) throw err
      console.error('[useNotifications] Erro ao sincronizar admin:', err)
    }
  }, [session?.user?.role, client])
  const fetchNotifications = useCallback(async () => {
    const ticket = ++readRevision.current
    if (status !== 'authenticated' || !session?.user?.id) {
      update((s) => ({ ...s, isLoading: false }))
      return
    }
    update((s) => ({ ...s, isLoading: true, error: null }))
    try {
      await syncAdminNotifications()
      const response = await client.request<
        HttpJsonResponse<NotificationsResponse>
      >('/api/client/notifications?limit=50', { responseType: 'json-response' })
      if (!response.ok) throw new Error('Erro ao carregar notificações')
      if (ticket !== readRevision.current) return
      update((s) => ({
        ...s,
        notifications: response.data.notifications.map(mapApiNotification),
        stats: response.data.stats,
        isLoading: false,
        error: null,
      }))
    } catch (err) {
      if (isAbortError(err) || ticket !== readRevision.current) return
      console.error('[useNotifications] Erro ao carregar:', err)
      update((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }))
    }
  }, [status, session?.user?.id, client, syncAdminNotifications, update])
  useEffect(() => {
    setSnapshot(empty(scope))
    if (status !== 'loading') void fetchNotifications()
    return () => {
      readRevision.current++
    }
  }, [scope, status, fetchNotifications])
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const response = await client.request<
          HttpJsonResponse<{ error?: string }>
        >('/api/client/notifications/' + encodeURIComponent(notificationId), {
          method: 'PATCH',
          responseType: 'json-response',
        })
        if (!response.ok)
          throw new Error(response.data?.error || 'Erro ao marcar como lida')
        readRevision.current++
        update((s) => {
          const item = s.notifications.find((n) => n.id === notificationId)
          return {
            ...s,
            isLoading: false,
            error: null,
            notifications: s.notifications.map((n) =>
              n.id === notificationId
                ? { ...n, isRead: true, readAt: new Date() }
                : n
            ),
            stats: {
              ...s.stats,
              unread:
                item && !item.isRead
                  ? Math.max(0, s.stats.unread - 1)
                  : s.stats.unread,
            },
          }
        })
      } catch (err) {
        if (isAbortError(err)) return
        console.error('[useNotifications] Erro ao marcar como lida:', err)
        update((s) => ({
          ...s,
          error:
            err instanceof Error ? err.message : 'Erro ao marcar como lida',
        }))
      }
    },
    [client, update]
  )
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await client.request<HttpJsonResponse<unknown>>(
        '/api/client/notifications/mark-all-read',
        { method: 'POST', responseType: 'json-response' }
      )
      if (!response.ok) throw new Error('Erro ao marcar todas como lidas')
      readRevision.current++
      update((s) => ({
        ...s,
        isLoading: false,
        error: null,
        notifications: s.notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date(),
        })),
        stats: { ...s.stats, unread: 0, byType: {} },
      }))
    } catch (err) {
      if (!isAbortError(err)) {
        console.error(
          '[useNotifications] Erro ao marcar todas como lidas:',
          err
        )
        update((s) => ({
          ...s,
          error:
            err instanceof Error
              ? err.message
              : 'Erro ao marcar todas como lidas',
        }))
      }
    }
  }, [client, update])
  const removeNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await client.request<HttpJsonResponse<unknown>>(
          '/api/client/notifications/' + encodeURIComponent(notificationId),
          { method: 'DELETE', responseType: 'json-response' }
        )
        if (!response.ok) throw new Error('Erro ao remover notificação')
        readRevision.current++
        update((s) => {
          const item = s.notifications.find((n) => n.id === notificationId)
          if (!item) return { ...s, isLoading: false, error: null }
          return {
            ...s,
            isLoading: false,
            error: null,
            notifications: s.notifications.filter(
              (n) => n.id !== notificationId
            ),
            stats: {
              ...s.stats,
              total: Math.max(0, s.stats.total - 1),
              unread: !item.isRead
                ? Math.max(0, s.stats.unread - 1)
                : s.stats.unread,
            },
          }
        })
      } catch (err) {
        if (isAbortError(err)) return
        console.error('[useNotifications] Erro ao remover:', err)
        throw err
      }
    },
    [client, update]
  )
  // Por ora, apenas limpa localmente: API não oferece clearAll.
  const clearAll = useCallback(() => {
    readRevision.current++
    update((s) => ({
      ...s,
      isLoading: false,
      error: null,
      notifications: [],
      stats: { total: 0, unread: 0, byType: {} },
    }))
  }, [update])
  const refresh = useCallback(() => {
    void fetchNotifications()
  }, [fetchNotifications])
  return {
    ...current,
    unreadNotifications: current.notifications.filter((n) => !n.isRead),
    highPriorityNotifications: current.notifications.filter(
      (n) => n.priority === 'high' && !n.isRead
    ),
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    refresh,
  }
}
