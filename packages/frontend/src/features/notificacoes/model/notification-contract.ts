export interface Notification {
  id: string
  type:
    | 'quote'
    | 'order'
    | 'payment'
    | 'equipment'
    | 'system'
    | 'rental'
    | 'delivery'
    | 'contract'
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  actionUrl?: string
  priority: 'low' | 'medium' | 'high'
  readAt?: Date | null
  metadata?: Record<string, unknown>
}

export interface NotificationStats {
  total: number
  unread: number
  byType: Record<string, number>
}

export interface ApiNotification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  actionUrl?: string
  priority: string
  readAt?: string | null
  metadata?: Record<string, unknown>
}

export interface NotificationsResponse {
  notifications: ApiNotification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  stats: {
    total: number
    unread: number
    byType: Record<string, number>
  }
}
