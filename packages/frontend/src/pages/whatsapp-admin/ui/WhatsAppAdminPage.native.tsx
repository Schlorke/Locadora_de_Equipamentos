import { ScrollView, Text, View, ActivityIndicator } from 'react-native'
import { Button, Card, Dialog, Textarea, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { useWhatsAppPage } from '../model/use-whatsapp-page'
import { useReplyComposer } from '../model/use-reply-composer'
import type { WhatsAppMessageItem } from '../model/tipos'
function MessageList({ messages }: { messages: WhatsAppMessageItem[] }) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.sm }}>
      {messages.length === 0 ? (
        <Text style={{ color: theme.text }}>
          Nenhuma mensagem nesta conversa.
        </Text>
      ) : (
        messages.map((message) => (
          <Card key={message.id}>
            <Text
              style={{
                color: theme.text,
                fontWeight: typography.weight.semibold,
              }}
            >
              {message.direction === 'OUTBOUND' ? 'Enviada' : 'Recebida'}
            </Text>
            <Text selectable style={{ color: theme.text }}>
              {message.body || '(mídia)'}
            </Text>
            <Text style={{ color: theme.text }}>
              {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </Card>
        ))
      )}
    </View>
  )
}
function Composer({
  open,
  onClose,
  onSend,
  sending,
  label,
}: {
  open: boolean
  onClose: () => void
  onSend: (text: string) => Promise<void>
  sending: boolean
  label: string
}) {
  const m = useReplyComposer(onSend, onClose, sending)
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Responder – {label}</Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar" />
            </Dialog.Header>
            <Dialog.Body>
              <Textarea
                aria-label="Mensagem"
                value={m.text}
                onChangeText={m.setText}
                disabled={sending}
                placeholder="Digite sua mensagem…"
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={sending} onClick={onClose}>
                Cancelar
              </Button>
              <Button
                disabled={!m.text.trim() || sending}
                onClick={() => void m.handleSend()}
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
function Content() {
  const m = useWhatsAppPage(),
    theme = useTheme()
  const thread = <MessageList messages={m.messages} />
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        WhatsApp
      </Text>
      <Text style={{ color: theme.text }}>
        Acompanhe e responda mensagens de clientes
      </Text>
      <Button
        variant="outline"
        onClick={() => void m.fetchConversations()}
        disabled={m.conversationsLoading}
      >
        Atualizar conversas
      </Button>
      {m.conversationsLoading ? (
        <ActivityIndicator color={theme.primary} />
      ) : m.conversations.length === 0 ? (
        <Text style={{ color: theme.text }}>
          Nenhuma conversa. Mensagens recebidas pelo webhook aparecerão aqui.
        </Text>
      ) : (
        <View style={{ gap: space.sm }}>
          {m.conversations.map((c) => (
            <Button
              key={c.id}
              variant={
                m.selectedConversationId === c.id ? 'default' : 'outline'
              }
              onClick={() => m.setSelectedConversationId(c.id)}
            >
              {c.displayName ?? c.phone}
              {c.messageCount === undefined ? '' : ' (' + c.messageCount + ')'}
            </Button>
          ))}
        </View>
      )}
      {m.currentConversation ? (
        <>
          <Text accessibilityRole="header" style={{ color: theme.text }}>
            {m.conversationLabel}
          </Text>
          {m.messagesLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            thread
          )}
          {m.hasMoreMessages ? (
            <Button
              variant="outline"
              disabled={m.loadMoreMessagesLoading}
              onClick={m.handleLoadMoreMessages}
            >
              {m.loadMoreMessagesLoading
                ? 'Carregando…'
                : 'Carregar mensagens anteriores'}
            </Button>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button onClick={m.handleReply}>Responder</Button>
            <Button variant="outline" onClick={m.handleExpand}>
              Expandir
            </Button>
          </View>
        </>
      ) : (
        <Text style={{ color: theme.text }}>
          Selecione uma conversa para ver as mensagens.
        </Text>
      )}
      <Dialog.Root open={m.isFullViewOpen} onOpenChange={m.handleCloseFullView}>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{m.conversationLabel} – WhatsApp</Dialog.Title>
                <Dialog.CloseButton aria-label="Fechar conversa" />
              </Dialog.Header>
              <Dialog.BodyViewport>{thread}</Dialog.BodyViewport>
              <Dialog.Footer>
                <Button onClick={m.handleReply}>Responder</Button>
                <Button variant="outline" onClick={m.handleCloseFullView}>
                  Fechar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Composer
        open={m.composerOpen}
        onClose={() => m.setComposerOpen(false)}
        onSend={m.handleSendReply}
        sending={m.sending}
        label={m.conversationLabel}
      />
    </ScrollView>
  )
}
export function AdminWhatsAppPage() {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  return (
    <Content
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.tenant.status,
        tenant?.role,
        slug,
        session?.user?.id,
        revision,
      ])}
    />
  )
}
