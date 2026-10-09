'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@gb-locacoes/ui'
import { HEADER_MENU_TRIGGER } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { NotificationBadge } from '@gb-locacoes/ui'
import {
  useNotifications,
  type Notification,
} from '../../../features/notificacoes'
import { toast, useIsMobile } from '../../../shared/lib'
import { cn } from '../../../shared/lib/cn.web'
import { Bell, CheckSquare, LogOut, Settings, Trash2, User } from 'lucide-react'
import { useSignOut, useSession } from '../../../entities/sessao'
import { useRouter } from 'next/navigation'

export interface AdminHeaderActionsProps {
  className?: string
}

function getUserInitials(name?: string | null) {
  if (!name) return 'U'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) {
    const firstChar = parts[0]?.[0]
    return firstChar ? firstChar.toUpperCase() : 'U'
  }
  const firstChar = parts[0]?.[0] ?? ''
  const lastChar = parts[parts.length - 1]?.[0] ?? ''
  return (firstChar + lastChar).toUpperCase() || 'U'
}

function formatTimeAgo(date: Date) {
  const now = new Date()
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  )

  if (diffInMinutes < 1) return 'Agora mesmo'
  if (diffInMinutes < 60) return `${diffInMinutes}m atrás`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h atrás`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d atrás`

  return date.toLocaleDateString('pt-BR')
}

export function AdminHeaderActions({ className }: AdminHeaderActionsProps) {
  const { data: session } = useSession()
  const signOut = useSignOut()
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set())
  const [isClearingSelected, setIsClearingSelected] = useState(false)
  const notificationCloseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const userMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const { notifications, stats, isLoading, markAsRead, removeNotification } =
    useNotifications()

  const clearAllCloseTimeouts = () => {
    if (notificationCloseTimeoutRef.current) {
      clearTimeout(notificationCloseTimeoutRef.current)
      notificationCloseTimeoutRef.current = null
    }
    if (userMenuCloseTimeoutRef.current) {
      clearTimeout(userMenuCloseTimeoutRef.current)
      userMenuCloseTimeoutRef.current = null
    }
  }

  useEffect(() => {
    return () => clearAllCloseTimeouts()
  }, [])

  const userName = session?.user?.name || 'Usuário'

  const handleNotificationSelect = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
    }
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/admin/login' })
  }

  const closeNotificationsDropdown = () => {
    setIsNotificationsOpen(false)
    setIsSelectionMode(false)
    setSelectedNotifications(new Set())
  }

  const handleEnterSelectionMode = () => {
    setIsSelectionMode(true)
    setSelectedNotifications(new Set())
  }

  const handleExitSelectionMode = () => {
    setIsSelectionMode(false)
    setSelectedNotifications(new Set())
  }

  const handleToggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId)
      } else {
        newSet.add(notificationId)
      }
      return newSet
    })
  }

  const handleSelectAllNotifications = () => {
    const visibleIds = notifications.slice(0, 6).map((n) => n.id)
    setSelectedNotifications(new Set(visibleIds))
  }

  const handleClearSelectedNotifications = async () => {
    if (isClearingSelected) return
    setIsClearingSelected(true)
    try {
      const idsToDelete = new Set(selectedNotifications)
      const succeeded = new Set<string>()
      let failedCount = 0
      for (const id of idsToDelete) {
        try {
          await removeNotification(id)
          succeeded.add(id)
        } catch {
          failedCount += 1
        }
      }
      if (failedCount > 0) {
        toast.error(
          `Falha ao remover ${failedCount} notificação(ões). Tente novamente.`
        )
      }
      setSelectedNotifications(
        (prev) => new Set([...prev].filter((id) => !succeeded.has(id)))
      )
      if (succeeded.size === idsToDelete.size) {
        setIsSelectionMode(false)
      }
    } finally {
      setIsClearingSelected(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Ícone de Notificações */}
      <DropdownMenu
        modal={false}
        open={isNotificationsOpen}
        onOpenChange={(open) => {
          setIsNotificationsOpen(open)
          if (!open) closeNotificationsDropdown()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full border-0 hover:border-0 focus-visible:outline-hidden focus-visible:ring-0 focus-visible:ring-offset-0 text-white hover:text-white hover:bg-white/10 hover:scale-105 data-[state=open]:bg-white/10 data-[state=open]:text-white data-[state=open]:scale-105 transition-all duration-200 [&_svg]:size-5"
            aria-label="Notificações"
            onMouseEnter={() => {
              clearAllCloseTimeouts()
              setIsUserMenuOpen(false)
              setIsNotificationsOpen(true)
            }}
            onMouseLeave={() => {
              if (notificationCloseTimeoutRef.current) {
                clearTimeout(notificationCloseTimeoutRef.current)
                notificationCloseTimeoutRef.current = null
              }
              notificationCloseTimeoutRef.current = setTimeout(() => {
                closeNotificationsDropdown()
              }, 120)
            }}
          >
            <Bell />
            <NotificationBadge
              count={
                isSelectionMode ? selectedNotifications.size : stats.unread
              }
              variant="pulse"
              size="sm"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={isMobile ? 8 : 4}
          alignOffset={isMobile ? -16 : 0}
          collisionPadding={isMobile ? 16 : 8}
          className={cn(
            'bg-white shadow-xl border border-slate-200 rounded-xl p-2 overflow-hidden flex flex-col',
            isMobile ? 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)]' : 'w-80'
          )}
          onMouseEnter={() => clearAllCloseTimeouts()}
          onMouseLeave={() => {
            if (notificationCloseTimeoutRef.current) {
              clearTimeout(notificationCloseTimeoutRef.current)
              notificationCloseTimeoutRef.current = null
            }
            notificationCloseTimeoutRef.current = setTimeout(() => {
              closeNotificationsDropdown()
            }, 120)
          }}
        >
          <div className="flex flex-col gap-3 px-2 py-1.5 shrink-0">
            <div className="flex items-center gap-2">
              {stats.unread > 0 && !isLoading && !isSelectionMode && (
                <Badge variant="secondary" className="shrink-0">
                  {stats.unread}
                </Badge>
              )}
              {isSelectionMode && selectedNotifications.size > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {selectedNotifications.size}
                </Badge>
              )}
              <DropdownMenuLabel className="p-0 text-sm font-semibold text-slate-700">
                {isSelectionMode ? 'Selecionar notificações' : 'Notificações'}
              </DropdownMenuLabel>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isSelectionMode ? (
                <>
                  {notifications.length > 0 && !isLoading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-600 border border-gray-200 shadow hover:shadow-md hover:text-orange-600 gap-1.5"
                      onClick={handleEnterSelectionMode}
                    >
                      <CheckSquare className="h-3 w-3" />
                      Selecionar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-600 border border-gray-200 shadow hover:shadow-md hover:text-orange-600 gap-1.5 disabled:opacity-70"
                    onClick={handleSelectAllNotifications}
                    disabled={isClearingSelected}
                  >
                    <CheckSquare className="h-3 w-3" />
                    Marcar todas
                  </Button>
                  {selectedNotifications.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-600 border border-gray-200 shadow hover:shadow-md hover:text-red-700 gap-1.5"
                      onClick={handleClearSelectedNotifications}
                      disabled={isClearingSelected}
                    >
                      {isClearingSelected ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Limpar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-600 border border-gray-200 shadow hover:shadow-md hover:text-orange-600 gap-1.5"
                    onClick={handleExitSelectionMode}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
          <DropdownMenuSeparator className="my-2 bg-slate-200 shrink-0" />
          <div className="space-y-1 notification-dropdown-scroll max-h-[280px]">
            {isLoading ? (
              <DropdownMenuItem
                className="cursor-default text-slate-500"
                disabled
              >
                Carregando notificações...
              </DropdownMenuItem>
            ) : notifications.length === 0 ? (
              <DropdownMenuItem
                className="cursor-default text-slate-500"
                disabled
              >
                Nenhuma notificação no momento
              </DropdownMenuItem>
            ) : (
              notifications.slice(0, 6).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600',
                    !notification.isRead &&
                      !isSelectionMode &&
                      'bg-orange-50/60'
                  )}
                  onSelect={(e) => {
                    if (isClearingSelected) {
                      e.preventDefault()
                      return
                    }
                    if (isSelectionMode) {
                      e.preventDefault()
                      handleToggleNotificationSelection(notification.id)
                    } else {
                      handleNotificationSelect(notification)
                    }
                  }}
                >
                  {isSelectionMode && (
                    <Checkbox
                      checked={selectedNotifications.has(notification.id)}
                      onCheckedChange={(checked) => {
                        if (isClearingSelected) return
                        setSelectedNotifications((prev) => {
                          const next = new Set(prev)
                          if (checked === true) next.add(notification.id)
                          else next.delete(notification.id)
                          return next
                        })
                      }}
                      className="mt-0.5"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isClearingSelected}
                    />
                  )}
                  <div className="flex flex-col flex-1 gap-1">
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 line-clamp-1">
                        {notification.title}
                      </span>
                      {!notification.isRead && !isSelectionMode && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500 line-clamp-2">
                      {notification.message}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Avatar do Usuário com Menu */}
      <DropdownMenu
        modal={false}
        open={isUserMenuOpen}
        onOpenChange={setIsUserMenuOpen}
      >
        <DropdownMenuTrigger asChild>
          <button
            data-own-frame
            className={cn(
              'flex items-center justify-center rounded-full',
              HEADER_MENU_TRIGGER
            )}
            aria-label={userName}
            onMouseEnter={() => {
              clearAllCloseTimeouts()
              closeNotificationsDropdown()
              setIsUserMenuOpen(true)
            }}
            onMouseLeave={() => {
              if (userMenuCloseTimeoutRef.current) {
                clearTimeout(userMenuCloseTimeoutRef.current)
                userMenuCloseTimeoutRef.current = null
              }
              userMenuCloseTimeoutRef.current = setTimeout(() => {
                setIsUserMenuOpen(false)
              }, 120)
            }}
          >
            <Avatar className="h-10 w-10 border-2 border-white/20 hover:border-white/40 transition-colors cursor-pointer">
              {session?.user?.image ? (
                <AvatarImage src={session.user.image} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-slate-400 text-white text-sm font-medium">
                {getUserInitials(session?.user?.name)}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          collisionPadding={isMobile ? 16 : 8}
          className={cn(
            'bg-white shadow-xl border border-slate-200 rounded-xl p-2',
            isMobile ? 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)]' : 'w-56'
          )}
          onMouseEnter={() => clearAllCloseTimeouts()}
          onMouseLeave={() => {
            if (userMenuCloseTimeoutRef.current) {
              clearTimeout(userMenuCloseTimeoutRef.current)
              userMenuCloseTimeoutRef.current = null
            }
            userMenuCloseTimeoutRef.current = setTimeout(() => {
              setIsUserMenuOpen(false)
            }, 120)
          }}
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-10 w-10">
              {session?.user?.image ? (
                <AvatarImage src={session.user.image} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-slate-400 text-white text-sm font-medium">
                {getUserInitials(session?.user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="text-sm font-medium text-slate-900 truncate">
                {userName}
              </span>
              <span className="text-xs text-slate-500 truncate">
                {session?.user?.email}
              </span>
            </div>
          </div>
          <DropdownMenuSeparator className="my-2 bg-slate-200" />
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
            onSelect={() => router.push('/admin/perfil')}
          >
            <User className="h-4 w-4" />
            <span>Meu Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-slate-700 hover:bg-orange-50 hover:text-orange-600"
            onSelect={() => router.push('/admin/settings')}
          >
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-2 bg-slate-200" />
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700"
            onSelect={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
