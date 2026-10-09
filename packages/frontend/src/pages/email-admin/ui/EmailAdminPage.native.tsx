import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Button, Card, Dialog, Input, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { useEmailPage } from '../model/carga'
import { EmailComposerDialog } from './EmailComposerDialog.native'
import { formatBytes } from '../model/format'
import type { NativeMailPorts } from '../model/native-ports'
import type { EmailViewerMessage } from '../model/tipos'
type MailModel = ReturnType<typeof useEmailPage>
const emptyQuery = { get: () => null }
function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.text,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
      }}
    >
      {children}
    </Text>
  )
}
function Message({
  message,
  m,
  device,
  expanded = false,
}: {
  message: EmailViewerMessage
  m: MailModel
  device: NativeMailPorts
  expanded?: boolean
}) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.sm }}>
      <Heading>{message.subject || '(sem assunto)'}</Heading>
      <Text style={{ color: theme.text }}>
        De:{' '}
        {message.fromAddress?.displayName ||
          message.fromAddress?.emailAddress ||
          '—'}
      </Text>
      <Text style={{ color: theme.text }}>
        Para:{' '}
        {message.toAddress
          ?.map((x) => x.emailAddress || x.displayName)
          .join(', ') || '—'}
      </Text>
      <Text style={{ color: theme.text }}>
        {new Date(message.receivedTime || message.sentTime || 0).toLocaleString(
          'pt-BR'
        )}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button variant="outline" onClick={m.openComposerReply}>
          Responder
        </Button>
        <Button variant="outline" onClick={m.openComposerForward}>
          Encaminhar
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void (m.isArchiveFolder
              ? m.handleUnarchiveMessage(message.messageId)
              : m.handleArchiveMessage(message.messageId))
          }
        >
          {m.isArchiveFolder ? 'Desarquivar' : 'Arquivar'}
        </Button>
        <Button
          variant="outline"
          onClick={() => m.handleDeleteMessage(message.messageId)}
        >
          Excluir mensagem
        </Button>
        <Button variant="outline" onClick={m.handleMarkRead}>
          Marcar como lida
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            m.handleToggleStar(message.messageId, !message.isStarred)
          }
        >
          {message.isStarred ? 'Remover destaque' : 'Destacar'}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void (m.isSpamFolder ? m.handleMarkNotSpam() : m.handleMarkSpam())
          }
        >
          {m.isSpamFolder ? 'Não é spam' : 'Marcar como spam'}
        </Button>
        {!expanded ? (
          <Button
            variant="outline"
            onClick={() => m.handleExpandMessage(message)}
          >
            Expandir mensagem
          </Button>
        ) : null}
        {m.isDraftFolder ? (
          <Button onClick={m.handleSendDraft}>Editar rascunho</Button>
        ) : null}
      </View>
      {message.attachments?.map((a) => (
        <View key={a.attachmentId} style={{ gap: space.xs }}>
          <Text style={{ color: theme.text }}>
            {a.fileName} · {formatBytes(a.size)}
          </Text>
          <Button
            aria-label={'Baixar ' + a.fileName}
            variant="outline"
            onClick={() =>
              void m.handleDownloadAttachment(a.attachmentId, a.fileName)
            }
          >
            Baixar {a.fileName}
          </Button>
        </View>
      ))}
      {device.html(
        message.htmlContent || message.content || '<p>Sem conteúdo</p>',
        space.xl * (expanded ? 16 : 10)
      )}
    </View>
  )
}
function Filters({ m }: { m: MailModel }) {
  const theme = useTheme()
  const [start, setStart] = useState(''),
    [end, setEnd] = useState('')
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const date = new Date(value + 'T00:00:00')
    return Number.isNaN(date.getTime()) ||
      date.getFullYear() !== Number(value.slice(0, 4)) ||
      date.getMonth() + 1 !== Number(value.slice(5, 7)) ||
      date.getDate() !== Number(value.slice(8, 10))
      ? null
      : date
  }
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <Input
          id={m.searchInputId}
          aria-label="Buscar por remetente, assunto"
          value={m.searchQuery}
          onChangeText={m.setSearchQuery}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(
            [
              ['all', 'Todas'],
              ['unread', 'Não lidas'],
              ['starred', 'Destacadas'],
              ['attachments', 'Com anexos'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={m.quickFilter === key ? 'default' : 'outline'}
              onClick={() => m.setQuickFilter(key)}
            >
              {label}
            </Button>
          ))}
        </View>
        <Text style={{ color: theme.text }}>
          Filtrar por período (AAAA-MM-DD)
        </Text>
        <Input
          aria-label="Data inicial"
          value={start}
          onChangeText={(value) => {
            setStart(value)
            m.handleDateRangeChange(parse(value), m.dateEnd)
          }}
        />
        <Input
          aria-label="Data final"
          value={end}
          onChangeText={(value) => {
            setEnd(value)
            m.handleDateRangeChange(m.dateStart, parse(value))
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            setStart('')
            setEnd('')
            m.handleResetFilters()
          }}
        >
          Limpar filtros
        </Button>
        <Button onClick={m.openComposerNew}>Novo e-mail</Button>
      </View>
    </Card>
  )
}
function Bulk({ m }: { m: MailModel }) {
  const theme = useTheme()
  return (
    <Card>
      <View style={{ gap: space.sm }}>
        <Text style={{ color: theme.text }}>
          {m.selectedIds.length} mensagem(ns) selecionada(s)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button variant="outline" onClick={m.handleSelectAll}>
            Selecionar todas
          </Button>
          <Button variant="outline" onClick={m.handleClearSelection}>
            Limpar seleção
          </Button>
          <Button
            variant="outline"
            disabled={!m.selectedIds.length}
            onClick={() => void m.handleBulkArchive()}
          >
            Arquivar seleção
          </Button>
          <Button
            variant="outline"
            disabled={!m.selectedIds.length}
            onClick={() => void m.handleBulkMarkRead()}
          >
            Marcar seleção como lida
          </Button>
          <Button
            variant="outline"
            disabled={!m.selectedIds.length || m.isBulkDeleting}
            onClick={() => void m.handleBulkDelete()}
          >
            {m.isBulkDeleting ? 'Excluindo...' : 'Excluir seleção'}
          </Button>
          <Button
            variant="outline"
            disabled={!m.selectedIds.length}
            onClick={() =>
              void (m.isSpamFolder ? m.handleBulkNotSpam() : m.handleBulkSpam())
            }
          >
            {m.isSpamFolder
              ? 'Seleção não é spam'
              : 'Denunciar seleção como spam'}
          </Button>
        </View>
        <Text style={{ color: theme.text }}>Mover seleção para</Text>
        {m.moveFolderOptions.map((f) => (
          <Button
            key={f.id}
            variant="outline"
            disabled={!m.selectedIds.length}
            onClick={() => void m.handleBulkMove(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </View>
    </Card>
  )
}
function Content({
  device,
  seed,
  storageKey,
}: {
  device: NativeMailPorts
  seed: string[]
  storageKey: string
}) {
  const [connectionRevision, setConnectionRevision] = useState(0)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const ports = useMemo(
    () => ({
      query: emptyQuery,
      isMobile: true,
      readHighlighted: () => seed,
      persistHighlighted: (keys: string[]) =>
        device.persistHighlighted(storageKey, keys),
      download: device.download,
      focusSearch: () => {},
      connect: async () => {
        try {
          await device.connect()
          if (active.current) setConnectionRevision((value) => value + 1)
        } catch (error) {
          if (active.current)
            toast.error(
              error instanceof Error
                ? error.message
                : 'Falha ao conectar Zoho Mail'
            )
        }
      },
    }),
    [device, seed, storageKey]
  )
  return <Mailbox key={connectionRevision} device={device} ports={ports} />
}
function Mailbox({
  device,
  ports,
}: {
  device: NativeMailPorts
  ports: Parameters<typeof useEmailPage>[0]
}) {
  const m = useEmailPage(ports),
    theme = useTheme()
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Heading>E-mail</Heading>
      <Text style={{ color: theme.text }}>
        Gerencie a caixa Zoho Mail pelo painel
      </Text>
      <Text style={{ color: theme.text }}>
        {m.connected ? 'Conectado: ' + m.accountLabel : 'Não conectado'}
      </Text>
      {m.loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : m.error ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {m.error}
        </Text>
      ) : !m.connected ? (
        <Card>
          <View style={{ gap: space.sm }}>
            <Text style={{ color: theme.text }}>
              Conecte a conta Zoho Mail para ver e gerenciar os e-mails
              diretamente aqui. Conclua a conexão no navegador e volte aqui.
            </Text>
            <Button onClick={m.handleConnect}>Conectar Zoho Mail</Button>
          </View>
        </Card>
      ) : (
        <>
          <Filters m={m} />
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            <Button
              variant="outline"
              disabled={m.messagesLoading}
              onClick={m.handleRefreshMessages}
            >
              Atualizar mensagens
            </Button>
            <Button variant="outline" onClick={() => void m.handleDisconnect()}>
              Desconectar Zoho Mail
            </Button>
          </View>
          <Heading>Pastas</Heading>
          {m.foldersLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            m.folders.map((folder) => (
              <Button
                key={folder.folderId}
                variant={
                  m.selectedFolderId === folder.folderId ? 'default' : 'outline'
                }
                onClick={() => m.setSelectedFolderId(folder.folderId)}
              >
                {folder.folderName}
                {folder.unreadCount ? ' (' + folder.unreadCount + ')' : ''}
              </Button>
            ))
          )}
          <Bulk m={m} />
          <Heading>Mensagens</Heading>
          {m.messagesLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : m.filteredMessages.length === 0 ? (
            <Text style={{ color: theme.text }}>
              Nenhuma mensagem nesta pasta.
            </Text>
          ) : (
            m.filteredMessages.map((message) => (
              <Card key={message.messageId}>
                <View style={{ gap: space.sm }}>
                  <Button
                    variant={
                      m.selectedMessageId === message.messageId
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => m.handleSelectMessage(message.messageId)}
                  >
                    {message.subject || '(sem assunto)'}
                  </Button>
                  <Text style={{ color: theme.text }}>
                    {message.fromAddress?.displayName ||
                      message.fromAddress?.emailAddress ||
                      '—'}{' '}
                    · {message.isRead ? 'Lida' : 'Não lida'}
                  </Text>
                  <Text style={{ color: theme.text }}>
                    {message.summary || ''}
                  </Text>
                  <Button
                    variant="outline"
                    aria-label={
                      (m.selectedIds.includes(message.messageId)
                        ? 'Desmarcar '
                        : 'Selecionar ') + (message.subject || '(sem assunto)')
                    }
                    onClick={() => m.handleToggleSelect(message.messageId)}
                  >
                    {m.selectedIds.includes(message.messageId)
                      ? 'Desmarcar'
                      : 'Selecionar'}{' '}
                    {message.subject || '(sem assunto)'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      m.handleQuickToggleRead(
                        message.messageId,
                        Boolean(message.isRead)
                      )
                    }
                  >
                    {message.isRead
                      ? 'Marcar como não lida'
                      : 'Marcar como lida'}{' '}
                    {message.subject || ''}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      m.handleToggleStar(message.messageId, !message.isStarred)
                    }
                  >
                    {message.isStarred ? 'Remover destaque' : 'Destacar'}{' '}
                    {message.subject || ''}
                  </Button>
                </View>
              </Card>
            ))
          )}
          {m.hasMoreMessages ? (
            <Button
              variant="outline"
              disabled={m.messagesLoadMoreLoading}
              onClick={m.handleLoadMore}
            >
              {m.messagesLoadMoreLoading
                ? 'Carregando...'
                : 'Carregar mais mensagens'}
            </Button>
          ) : null}
          {m.messageLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : m.currentMessage ? (
            <Card>
              <Message message={m.currentMessage} m={m} device={device} />
            </Card>
          ) : (
            <Text style={{ color: theme.text }}>
              Selecione uma mensagem para visualizar.
            </Text>
          )}
        </>
      )}
      <Dialog.Root
        open={m.isFullViewOpen}
        onOpenChange={(open) => {
          if (!open) m.handleCloseFullView()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Visualização completa</Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar mensagem" />
            </Dialog.Header>
            <Dialog.BodyViewport>
              {m.fullViewMessage ? (
                <Message
                  message={m.fullViewMessage}
                  m={m}
                  device={device}
                  expanded
                />
              ) : null}
            </Dialog.BodyViewport>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <EmailComposerDialog
        device={device}
        isOpen={m.composerOpen}
        onClose={() => m.setComposerOpen(false)}
        mode={m.composerMode}
        fromAddress={m.primaryEmail}
        messageId={m.composerMessageId ?? undefined}
        draftMessageId={m.composerDraftId ?? undefined}
        draftFolderId={m.draftFolderId}
        initialTo={m.composerInitialTo}
        initialSubject={m.composerInitialSubject}
        initialContent={m.composerInitialContent}
        onSent={m.handleComposerSent}
        onDraftSaved={m.handleDraftSaved}
      />
      <Dialog.Root
        open={m.showDeleteFromTrashConfirm}
        onOpenChange={(open) => {
          if (!open) {
            m.setShowDeleteFromTrashConfirm(false)
            m.setPendingDeleteFromTrashIds([])
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Excluir permanentemente da lixeira?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text style={{ color: theme.text }}>
                Esta ação não pode ser desfeita.{' '}
                {m.pendingDeleteFromTrashIds.length} mensagem(ns) será(ão)
                excluída(s) permanentemente.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                disabled={m.isDeletingFromTrash}
                onClick={() => {
                  m.setShowDeleteFromTrashConfirm(false)
                  m.setPendingDeleteFromTrashIds([])
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={m.isDeletingFromTrash}
                onClick={() => void m.handleConfirmDeleteFromTrash()}
              >
                {m.isDeletingFromTrash ? 'Excluindo...' : 'Excluir'}
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={m.showSpamConfirm}
        onOpenChange={(open) => {
          if (!open) {
            m.setShowSpamConfirm(false)
            m.setPendingSpamIds([])
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>Marcar como spam?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text style={{ color: theme.text }}>
                A(s) mensagem(ns) será(ão) movida(s) para Spam e o(s)
                remetente(s) poderá(ão) ser tratado(s) como spam pelo Zoho Mail.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                disabled={m.isMarkingSpam}
                onClick={() => {
                  m.setShowSpamConfirm(false)
                  m.setPendingSpamIds([])
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={m.isMarkingSpam}
                onClick={() => void m.handleConfirmSpam()}
              >
                {m.isMarkingSpam ? 'Marcando...' : 'Marcar como spam'}
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ScrollView>
  )
}
function Seed({
  device,
  storageKey,
}: {
  device: NativeMailPorts
  storageKey: string
}) {
  const [seed, setSeed] = useState<string[] | null>(null)
  useEffect(() => {
    let current = true
    void device.readHighlighted(storageKey).then(
      (value) => {
        if (current) setSeed(value)
      },
      () => {
        if (current) setSeed([])
      }
    )
    return () => {
      current = false
    }
  }, [device, storageKey])
  return seed ? (
    <Content device={device} seed={seed} storageKey={storageKey} />
  ) : (
    <ActivityIndicator />
  )
}
export function AdminEmailPage({ device }: { device: NativeMailPorts }) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.tenant.status,
    tenant?.role,
    slug,
    session?.user?.id,
    revision,
  ])
  const storageKey = JSON.stringify([tenant?.tenant.id, session?.user?.id])
  return <Seed key={scope} storageKey={storageKey} device={device} />
}
