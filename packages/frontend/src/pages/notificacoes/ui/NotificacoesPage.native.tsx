import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  Link,
  useTheme,
  useNavigate,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useNotifications,
  useNotificationScope,
  type Notification,
} from '../../../features/notificacoes'
import { toast } from '../../../shared/lib/toast'
import { getTypeLabel, formatTimeAgo } from '../model/notification-presentation'

export function NotificacoesPage() {
  return <NotificationsContent key={useNotificationScope()} />
}
function NotificationsContent() {
  const m = useNotifications(),
    theme = useTheme()
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/area-cliente">Voltar para Área do Cliente</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Notificações
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Mantenha-se atualizado com todas as suas notificações
      </Text>
      <Text
        accessibilityRole="header"
        style={{ color: theme.text, fontSize: typography.size.lg }}
      >
        Lista de Notificações
      </Text>
      <Text style={{ color: theme.textMuted }}>
        {m.isLoading
          ? 'Carregando...'
          : m.notifications.length + ' notificação(ões) encontrada(s)'}
      </Text>
      {m.error ? (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="alert" style={{ color: theme.danger }}>
            {m.error}
          </Text>
          <Button variant="outline" onClick={m.refresh}>
            Tentar novamente
          </Button>
        </View>
      ) : null}
      {m.isLoading ? (
        <ActivityIndicator />
      ) : m.notifications.length ? (
        m.notifications.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            onRead={m.markAsRead}
            onDelete={m.removeNotification}
          />
        ))
      ) : !m.error ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: theme.text }}>Nenhuma notificação</Text>
          <Text style={{ color: theme.textMuted }}>
            Você está em dia! Novas notificações aparecerão aqui.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  )
}
function NotificationCard({
  notification: n,
  onRead,
  onDelete,
}: {
  notification: Notification
  onRead(id: string): Promise<void>
  onDelete(id: string): Promise<void>
}) {
  const theme = useTheme(),
    navigate = useNavigate(),
    [deleting, setDeleting] = useState(false),
    [reading, setReading] = useState(false)
  const mark = async () => {
    if (reading || n.isRead) return
    setReading(true)
    try {
      await onRead(n.id)
    } finally {
      setReading(false)
    }
  }
  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete(n.id)
    } catch {
      toast.error('Falha ao remover notificação. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }
  const open = () => {
    if (!n.actionUrl) return
    void onRead(n.id)
    if (!navigate)
      throw new Error(
        'NavigationProvider deve fornecer a navegação do aplicativo.'
      )
    void navigate(n.actionUrl)
  }
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.text, fontWeight: typography.weight.semibold }}
        >
          {n.title}
        </Text>
        <Badge variant="outline">{getTypeLabel(n.type)}</Badge>
        {!n.isRead ? (
          <Text style={{ color: theme.primary }}>Não lida</Text>
        ) : null}
        <Text style={{ color: theme.textMuted }}>{n.message}</Text>
        <Text style={{ color: theme.textMuted }}>
          {formatTimeAgo(n.createdAt)}
        </Text>
        {n.actionUrl ? (
          <Button variant="outline" onClick={open}>
            Ver
          </Button>
        ) : null}
        {!n.isRead ? (
          <Button
            variant="outline"
            disabled={reading}
            onClick={() => void mark()}
          >
            Lido
          </Button>
        ) : null}
        <Button
          variant="outline"
          aria-label={'Excluir ' + n.title}
          disabled={deleting}
          onClick={() => void remove()}
        >
          {deleting ? 'Excluindo...' : 'Excluir'}
        </Button>
      </View>
    </Card>
  )
}
