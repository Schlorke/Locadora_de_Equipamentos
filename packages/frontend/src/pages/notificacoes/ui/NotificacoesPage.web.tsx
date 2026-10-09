'use client'
import { getTypeLabel, formatTimeAgo } from '../model/notification-presentation'
import { useNotificationScope } from '../../../features/notificacoes'

import { useState, useEffect } from 'react'
import {
  useNotifications,
  type Notification,
} from '../../../features/notificacoes'
import { toast } from '../../../shared/lib'
import { Button } from '@gb-locacoes/ui'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { ClientAreaBadge } from '../../../features/selo-area-cliente'
import {
  Bell,
  Check,
  ExternalLink,
  Settings,
  CheckCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { Link } from '@gb-locacoes/ui'

interface NotificationCardProps {
  notification: Notification
  onMarkAsRead: (_id: string) => void
  onDelete: (_id: string) => void | Promise<void>
  getNotificationIcon: (
    _type: string
  ) => React.ComponentType<{ className?: string }>
  getTypeLabel: (_type: string) => string
  formatTimeAgo: (_date: Date) => string
}

// Componente de notificação individual com animação controlada
function NotificationCard({
  notification,
  onMarkAsRead,
  onDelete,
  getNotificationIcon,
  getTypeLabel,
  formatTimeAgo,
}: NotificationCardProps) {
  const [showOrange, setShowOrange] = useState(!notification.isRead)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleMarkAsRead = () => {
    if (!notification.isRead) {
      setShowOrange(false)
      onMarkAsRead(notification.id)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const result = onDelete(notification.id)
      if (result instanceof Promise) {
        await result
      }
    } catch {
      toast.error('Falha ao remover notificação. Tente novamente.')
    } finally {
      setIsDeleting(false)
    }
  }

  const Icon = getNotificationIcon(notification.type)

  return (
    <div className="p-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-500 group relative z-0 bg-white">
      {/* Bolinha de notificação não lida - Posicionada no canto superior direito */}
      {!notification.isRead && (
        <div className="absolute top-[0.8rem] right-4 w-2 h-2 bg-blue-500 rounded-full z-20"></div>
      )}

      {/* Background laranja com transição de opacidade */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl transition-opacity duration-1000 ease-in-out bg-gradient-to-br from-orange-50 via-orange-100/50 to-orange-50 ',
          showOrange ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* Conteúdo da notificação */}
      <div className="relative px-2 py-4 md:px-4 z-10">
        <div className="flex flex-col ">
          {/* Header com ícone e título */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-base leading-none">
                  {notification.title}
                </h4>
                {/* Badge de tipo */}
                <ClientAreaBadge
                  variant="outline"
                  className="bg-gray-100 text-gray-700 text-xs"
                >
                  {getTypeLabel(notification.type)}
                </ClientAreaBadge>
              </div>
            </div>
          </div>

          {/* Mensagem */}
          <div className="text-sm md:text-[1rem] text-gray-600 leading-relaxed mb-4">
            {notification.message.includes('\nMotivo:') ? (
              <>
                <p>{notification.message.split('\nMotivo:')[0]}</p>
                <p className="mt-2 text-gray-700">
                  <span className="font-medium">Motivo:</span>{' '}
                  {notification.message.split('\nMotivo:')[1]}
                </p>
              </>
            ) : notification.message.includes(' Motivo:') ? (
              <>
                <p>{notification.message.split(' Motivo:')[0]}</p>
                <p className="mt-2 text-gray-700">
                  <span className="font-medium">Motivo:</span>{' '}
                  {notification.message.split(' Motivo:')[1]}
                </p>
              </>
            ) : (
              <p>{notification.message}</p>
            )}
          </div>

          {/* Footer com timestamp e botões */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <span className="text-sm text-gray-400 ">
              {formatTimeAgo(notification.createdAt)}
            </span>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              {notification.actionUrl && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border-gray-200 hover:border-gray-200 min-w-[80px]"
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <Link href={notification.actionUrl}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver
                  </Link>
                </Button>
              )}
              {!notification.isRead && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAsRead}
                  className="bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg border-gray-200 hover:border-gray-200 min-w-[80px]"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Lido
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-white hover:bg-red-50 hover:text-red-600 font-semibold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg w-10 h-10 p-0 text-red-600 border-gray-200 hover:border-gray-200 flex items-center justify-center disabled:opacity-70"
              >
                {isDeleting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificacoesContent() {
  const { notifications, stats, isLoading, markAsRead, removeNotification } =
    useNotifications()

  const handleDeleteNotification = async (id: string) => {
    await removeNotification(id)
  }

  // Atualizar contador de notificações não lidas no localStorage e disparar evento
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('gb-locacoes-unread-count', stats.unread.toString())
      const event = new CustomEvent('notificationUpdate', {
        detail: { unreadCount: stats.unread },
      })
      window.dispatchEvent(event)
    }
  }, [stats.unread, isLoading])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quote':
        return CheckCircle
      case 'equipment':
        return Settings
      case 'payment':
        return CheckCircle
      case 'system':
        return AlertCircle
      default:
        return Bell
    }
  }

  const filteredNotifications = notifications

  return (
    <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
      {/* Hero Section com Identidade Visual Completa */}
      <section
        id="dashboard-banner"
        className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
      >
        {/* Elementos animados de background removidos nesta seção da área do cliente */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 lg:py-14 relative z-10">
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              Notificações
            </h1>
            <p className="text-sm md:text-base text-white leading-relaxed max-w-2xl mx-auto">
              Mantenha-se atualizado com todas as suas notificações
            </p>
          </motion.div>
        </div>

        {/* Onda SVG no final */}
        <div className="relative w-full overflow-hidden">
          <svg
            className="relative block w-full h-6"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
              fill={
                '#f9fafb' /* token-check-allow: onda SVG da página de notificações; gray-50 ainda não está na paleta */
              }
            />
          </svg>
        </div>
      </section>

      {/* Dashboard Principal - LAYOUT OTIMIZADO */}
      <section className="py-12 md:py-16 lg:py-10 relative -mt-20 md:-mt-24">
        <div className="sm:px-6 lg:px-8 max-w-7xl mx-auto">
          {/* Lista de Notificações */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
              <CardHeader className="relative z-10 p-6">
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                    <Bell className="h-5 w-5" />
                  </div>
                  Lista de Notificações
                </CardTitle>
                <CardDescription>
                  {isLoading
                    ? 'Carregando...'
                    : `${filteredNotifications.length} notificação(ões) encontrada(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative p-6 pb-8 pt-0 md:px-6 lg:px-8 md:pb-6 lg:pb-8 z-0">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bell className="h-12 w-12 text-gray-300 animate-pulse" />
                    </div>
                    <p className="text-base md:text-lg text-gray-500 mb-8 leading-relaxed">
                      Carregando notificações...
                    </p>
                  </div>
                ) : filteredNotifications.length > 0 ? (
                  <div className="space-y-6">
                    {filteredNotifications.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onDelete={handleDeleteNotification}
                        getNotificationIcon={getNotificationIcon}
                        getTypeLabel={getTypeLabel}
                        formatTimeAgo={formatTimeAgo}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bell className="h-12 w-12 text-gray-300" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">
                      Nenhuma notificação
                    </h3>
                    <p className="text-base md:text-lg text-gray-500 mb-8 leading-relaxed">
                      Você está em dia! Novas notificações aparecerão aqui.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export function NotificacoesPage() {
  return <NotificacoesContent key={useNotificationScope()} />
}
