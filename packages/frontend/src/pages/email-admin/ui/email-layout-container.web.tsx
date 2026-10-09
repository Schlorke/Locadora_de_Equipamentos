'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@gb-locacoes/ui'
import type { Layout } from 'react-resizable-panels'
import { EmailFolderList, type EmailFolder } from './email-folder-list.web'
import { EmailMessageList, type EmailMessage } from './email-message-list.web'
import { EmailViewer, type EmailViewerMessage } from './email-viewer.web'
import { Button, FOCUS_RING } from '@gb-locacoes/ui'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@gb-locacoes/ui'

interface EmailLayoutContainerProps {
  folders: EmailFolder[]
  selectedFolderId: string | null
  onSelectFolder: (_folderId: string) => void
  foldersLoading: boolean
  messages: EmailMessage[]
  selectedMessageId: string | null
  onSelectMessage: (_messageId: string) => void
  messagesLoading: boolean
  currentMessage: EmailViewerMessage | null
  messageLoading: boolean
  /** Chaves de remetentes destacados (qualquer mensagem desse remetente mostra estrela). */
  highlightedSenderKeys?: Set<string>
  /** Se o remetente da mensagem em preview está destacado (estrela ao lado do assunto). */
  isSenderHighlightedForPreview?: boolean
  onReply?: () => void
  onForward?: () => void
  onExpand?: (_message: EmailViewerMessage) => void
  onMarkRead?: () => void
  onStar?: () => void
  onUnstar?: () => void
  /** Toggle estrela na lista (messageId, isStarred). */
  onToggleStar?: (_messageId: string, _isStarred: boolean) => void
  onLoadMore?: () => void
  loadMoreLoading?: boolean
  hasMoreMessages?: boolean
  onDownloadAttachment?: (_attachmentId: string, _fileName: string) => void
  isDraftFolder?: boolean
  onSendDraft?: () => void
  searchQuery?: string
  onSearchChange?: (_q: string) => void
  quickFilter?: 'all' | 'unread' | 'starred' | 'attachments'
  onQuickFilterChange?: (
    _f: 'all' | 'unread' | 'starred' | 'attachments'
  ) => void
  selectionMode?: boolean
  onSelectionModeChange?: (_on: boolean) => void
  selectedIds?: string[]
  onToggleSelect?: (_messageId: string) => void
  onSelectAll?: () => void
  onClearSelection?: () => void
  onBulkArchive?: () => void
  onBulkDelete?: () => void
  /** Exclusão em massa em andamento (mostra "Excluindo..." e desabilita o botão) */
  bulkDeleteLoading?: boolean
  onBulkMarkRead?: () => void
  /** Denunciar mensagens selecionadas como spam */
  onBulkSpam?: () => void
  /** Marcar mensagens selecionadas como não spam */
  onBulkNotSpam?: () => void
  moveOptions?: Array<{ id: string; label: string }>
  onBulkMove?: (_targetFolderId: string) => void
  onQuickArchive?: (_messageId: string) => void
  onQuickUnarchive?: (_messageId: string) => void
  isArchiveFolder?: boolean
  /** Indica se estamos na pasta Spam */
  isSpamFolder?: boolean
  /** Denunciar mensagem atual como spam */
  onMarkSpam?: () => void
  /** Marcar mensagem atual como não spam */
  onMarkNotSpam?: () => void
  onQuickDelete?: (_messageId: string) => void
  onQuickToggleRead?: (_messageId: string, _isRead: boolean) => void
  onDisconnect?: () => void
  /** Em mobile: ao fechar o Sheet de preview, chama isto em vez de onSelectMessage('') para evitar fetch com messageId vazio. */
  onClearMessage?: () => void
  isMobile?: boolean
  /** Atualizar mensagens da pasta atual (botão no cabeçalho Pastas). */
  onRefresh?: () => void
}

const STORAGE_KEY = 'email-panel-sizes'
const DEFAULT_SIZES = {
  messages: 44,
  preview: 56,
}
const PREVIEW_MIN_PX = 500
const PREVIEW_MAX_PX = 800
/** Bounds conservadores antes do ResizeObserver: ~500px–800px em ~1200px de largura. Evita preview 0% no primeiro frame. */
const DEFAULT_PREVIEW_BOUNDS = {
  min: 40,
  max: 70,
}
const MIN_BOUND_RANGE = 5
const MESSAGES_MIN_PERCENT = 30
const USER_RESIZE_COOLDOWN_MS = 300

const clampPercent = (value: number | undefined | null): number => {
  const n = typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

// react-resizable-panels: números são tratados como px; percentuais exigem "%".
const toPercentString = (value: number): string => `${clampPercent(value)}%`

const normalizePanelSizes = (input?: {
  messages?: number
  preview?: number
}) => {
  const messagesRaw =
    typeof input?.messages === 'number' && Number.isFinite(input.messages)
      ? input.messages
      : DEFAULT_SIZES.messages
  const previewRaw =
    typeof input?.preview === 'number' && Number.isFinite(input.preview)
      ? input.preview
      : DEFAULT_SIZES.preview

  if (messagesRaw < 0 || previewRaw < 0) {
    return { ...DEFAULT_SIZES }
  }

  const total = messagesRaw + previewRaw
  if (!Number.isFinite(total) || total <= 0) {
    return { ...DEFAULT_SIZES }
  }

  const scale = 100 / total
  return {
    messages: clampPercent(messagesRaw * scale),
    preview: clampPercent(previewRaw * scale),
  }
}

const getEffectivePreviewBounds = (bounds: { min: number; max: number }) => {
  const maxFromMessages = clampPercent(100 - MESSAGES_MIN_PERCENT)
  let max = Math.min(bounds.max, maxFromMessages)
  let min = Math.min(bounds.min, max)
  if (max - min < MIN_BOUND_RANGE) {
    min = Math.max(0, max - MIN_BOUND_RANGE)
  }
  return { min, max }
}

export function EmailLayoutContainer({
  folders,
  selectedFolderId,
  onSelectFolder,
  foldersLoading,
  messages,
  selectedMessageId,
  onSelectMessage,
  messagesLoading,
  currentMessage,
  messageLoading,
  highlightedSenderKeys,
  isSenderHighlightedForPreview = false,
  onReply,
  onForward,
  onExpand,
  onMarkRead,
  onStar,
  onUnstar,
  onToggleStar,
  onLoadMore,
  loadMoreLoading = false,
  hasMoreMessages = false,
  onDownloadAttachment,
  isDraftFolder = false,
  onSendDraft,
  searchQuery = '',
  onSearchChange,
  quickFilter = 'all',
  onQuickFilterChange,
  selectionMode = false,
  onSelectionModeChange,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  bulkDeleteLoading,
  onBulkMarkRead,
  onBulkSpam,
  onBulkNotSpam,
  moveOptions = [],
  onBulkMove,
  onQuickArchive,
  onQuickUnarchive,
  isArchiveFolder = false,
  isSpamFolder = false,
  onMarkSpam,
  onMarkNotSpam,
  onQuickDelete,
  onQuickToggleRead,
  onDisconnect,
  onClearMessage,
  isMobile = false,
  onRefresh,
}: EmailLayoutContainerProps) {
  const [panelSizes, setPanelSizes] = useState(DEFAULT_SIZES)
  const [previewBounds, setPreviewBounds] = useState(DEFAULT_PREVIEW_BOUNDS)
  const panelsContainerRef = useRef<HTMLDivElement | null>(null)
  const lastUserResizeRef = useRef<number>(0)
  const effectivePreviewBounds = getEffectivePreviewBounds(previewBounds)

  // Carregar preferências salvas
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setPanelSizes(normalizePanelSizes(parsed))
      } else {
        setPanelSizes(normalizePanelSizes())
      }
    } catch (error) {
      console.error('[EmailLayout] Erro ao carregar preferências:', error)
      setPanelSizes(normalizePanelSizes())
    }
  }, [])

  // Converter limites em px para % do container (ResizablePanel espera 0-100)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const container = panelsContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    const updateBounds = () => {
      const width = container.getBoundingClientRect().width
      if (!Number.isFinite(width) || width <= 0) return
      const minPercent = clampPercent((PREVIEW_MIN_PX / width) * 100)
      const maxPercent = clampPercent((PREVIEW_MAX_PX / width) * 100)
      let min = Math.min(minPercent, maxPercent)
      let max = Math.max(minPercent, maxPercent)
      if (max - min < MIN_BOUND_RANGE) {
        if (minPercent >= 100) {
          min = Math.max(0, 100 - MIN_BOUND_RANGE)
          max = 100
        } else if (minPercent + MIN_BOUND_RANGE > 100) {
          // minPercent em 95–99%: minPercent+5 estoura 100; fixar max=100 e min=100-MIN_BOUND_RANGE para range >= 5
          min = Math.max(0, 100 - MIN_BOUND_RANGE)
          max = 100
        } else {
          min = minPercent
          max = minPercent + MIN_BOUND_RANGE
        }
      }
      setPreviewBounds({ min, max })
    }

    updateBounds()
    const observer = new ResizeObserver(updateBounds)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Garantir que o layout atual respeita os novos limites calculados.
  // Pula enquanto o usuário arrasta o handle (evita snap inesperado durante resize).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (Date.now() - lastUserResizeRef.current < USER_RESIZE_COOLDOWN_MS) {
      return
    }
    setPanelSizes((current) => {
      const effectiveBounds = getEffectivePreviewBounds(previewBounds)
      const preview = clampPercent(
        Math.min(
          Math.max(current.preview, effectiveBounds.min),
          effectiveBounds.max
        )
      )
      const messages = clampPercent(100 - preview)
      if (preview === current.preview && messages === current.messages) {
        return current
      }
      const next = { messages, preview }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('[EmailLayout] Erro ao salvar preferências:', error)
      }
      return next
    })
  }, [previewBounds])

  // Salvar preferências quando painéis são redimensionados
  const handleResize = useCallback((layout: Layout) => {
    lastUserResizeRef.current = Date.now()
    // Layout é um array de números representando as porcentagens de cada painel
    if (Array.isArray(layout) && layout.length === 2) {
      const newSizes = {
        messages: layout[0] ?? DEFAULT_SIZES.messages,
        preview: layout[1] ?? DEFAULT_SIZES.preview,
      }
      setPanelSizes(newSizes)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSizes))
      } catch (error) {
        console.error('[EmailLayout] Erro ao salvar preferências:', error)
      }
    }
  }, [])

  // Em mobile, usar layout simplificado com Sheet para preview
  if (isMobile) {
    const isPreviewOpen = !!currentMessage
    return (
      <>
        <div className="h-full rounded-2xl bg-white shadow-xl overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-[200px] max-h-[45%] flex-col">
              <EmailFolderList
                folders={folders}
                selectedFolderId={selectedFolderId ?? undefined}
                onSelectFolder={onSelectFolder}
                loading={foldersLoading}
                onRefresh={onRefresh}
                refreshLoading={messagesLoading}
                className="flex-1 min-h-0"
              />
              {onDisconnect && (
                <div className="border-t border-slate-200/70 p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    className="w-full"
                    aria-label="Desconectar conta Zoho Mail"
                  >
                    Desconectar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 border-t border-slate-200/70">
              <EmailMessageList
                messages={messages}
                selectedMessageId={selectedMessageId ?? undefined}
                onSelectMessage={onSelectMessage}
                highlightedSenderKeys={highlightedSenderKeys}
                onToggleStar={onToggleStar}
                onQuickArchive={onQuickArchive}
                onQuickUnarchive={onQuickUnarchive}
                isArchiveFolder={isArchiveFolder}
                isSpamFolder={isSpamFolder}
                onQuickDelete={onQuickDelete}
                onQuickToggleRead={onQuickToggleRead}
                onLoadMore={onLoadMore}
                loadMoreLoading={loadMoreLoading}
                hasMoreMessages={hasMoreMessages}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                quickFilter={quickFilter}
                onQuickFilterChange={onQuickFilterChange}
                selectionMode={selectionMode}
                onSelectionModeChange={onSelectionModeChange}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onSelectAll={onSelectAll}
                onClearSelection={onClearSelection}
                onBulkArchive={onBulkArchive}
                onBulkDelete={onBulkDelete}
                bulkDeleteLoading={bulkDeleteLoading}
                onBulkMarkRead={onBulkMarkRead}
                onBulkSpam={onBulkSpam}
                onBulkNotSpam={onBulkNotSpam}
                onBulkMove={onBulkMove}
                moveOptions={moveOptions}
                loading={messagesLoading}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Sheet para preview em mobile */}
        <Sheet
          open={isPreviewOpen}
          onOpenChange={(open) => {
            if (!open && currentMessage) {
              if (onClearMessage) {
                onClearMessage()
              }
              // Nunca chamar onSelectMessage('') aqui: causaria fetch para
              // /api/.../messages/?accountId=... (path vazio) e falha. Quem usa
              // em mobile deve passar onClearMessage.
            }
          }}
        >
          <SheetContent
            side="right"
            className="w-full sm:max-w-2xl overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle className="sr-only">
                Visualização de Mensagem
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-full">
              {currentMessage && (
                <EmailViewer
                  message={currentMessage}
                  loading={messageLoading}
                  isSenderHighlighted={isSenderHighlightedForPreview}
                  onReply={onReply}
                  onForward={onForward}
                  onExpand={onExpand}
                  onMarkRead={onMarkRead}
                  onMarkUnread={
                    onQuickToggleRead && currentMessage
                      ? () =>
                          onQuickToggleRead(
                            currentMessage.messageId,
                            currentMessage.isRead === true
                          )
                      : undefined
                  }
                  onStar={onStar}
                  onUnstar={onUnstar}
                  onArchive={
                    currentMessage && onQuickArchive && !isArchiveFolder
                      ? () => onQuickArchive(currentMessage.messageId)
                      : undefined
                  }
                  onDelete={
                    currentMessage && onQuickDelete
                      ? () => onQuickDelete(currentMessage.messageId)
                      : undefined
                  }
                  onMarkSpam={onMarkSpam}
                  onMarkNotSpam={onMarkNotSpam}
                  isSpamFolder={isSpamFolder}
                  onDownloadAttachment={onDownloadAttachment}
                  isDraftFolder={isDraftFolder}
                  onSendDraft={onSendDraft}
                  className="h-full"
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <div className="h-full min-h-[600px]">
      <div className="h-full rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex h-full min-w-0">
          {/* Painel de Pastas (largura fixa) */}
          <div className="shrink-0 basis-[20%] min-w-[200px] max-w-[280px] border-r border-slate-200/70 bg-slate-50/60">
            <div className="flex h-full min-h-0 flex-col">
              <EmailFolderList
                folders={folders}
                selectedFolderId={selectedFolderId ?? undefined}
                onSelectFolder={onSelectFolder}
                loading={foldersLoading}
                onRefresh={onRefresh}
                refreshLoading={messagesLoading}
                className="flex-1 min-h-0"
              />
              {onDisconnect && (
                <div className="border-t border-slate-200/70 p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    className="w-full"
                  >
                    Desconectar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0" ref={panelsContainerRef}>
            <ResizablePanelGroup
              orientation="horizontal"
              onLayoutChanged={handleResize}
              className="h-full"
            >
              {/* Painel de Lista de Mensagens */}
              <ResizablePanel
                defaultSize={toPercentString(panelSizes.messages)}
                minSize={toPercentString(MESSAGES_MIN_PERCENT)}
                maxSize={toPercentString(
                  clampPercent(100 - effectivePreviewBounds.min)
                )}
                className="flex min-h-0 flex-col bg-white"
              >
                <EmailMessageList
                  messages={messages}
                  selectedMessageId={selectedMessageId ?? undefined}
                  onSelectMessage={onSelectMessage}
                  highlightedSenderKeys={highlightedSenderKeys}
                  onToggleStar={onToggleStar}
                  onQuickArchive={onQuickArchive}
                  onQuickUnarchive={onQuickUnarchive}
                  isArchiveFolder={isArchiveFolder}
                  isSpamFolder={isSpamFolder}
                  onQuickDelete={onQuickDelete}
                  onQuickToggleRead={onQuickToggleRead}
                  onLoadMore={onLoadMore}
                  loadMoreLoading={loadMoreLoading}
                  hasMoreMessages={hasMoreMessages}
                  searchQuery={searchQuery}
                  onSearchChange={onSearchChange}
                  quickFilter={quickFilter}
                  onQuickFilterChange={onQuickFilterChange}
                  selectionMode={selectionMode}
                  onSelectionModeChange={onSelectionModeChange}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onSelectAll={onSelectAll}
                  onClearSelection={onClearSelection}
                  onBulkArchive={onBulkArchive}
                  onBulkDelete={onBulkDelete}
                  bulkDeleteLoading={bulkDeleteLoading}
                  onBulkMarkRead={onBulkMarkRead}
                  onBulkSpam={onBulkSpam}
                  onBulkNotSpam={onBulkNotSpam}
                  onBulkMove={onBulkMove}
                  moveOptions={moveOptions}
                  loading={messagesLoading}
                  className="h-full"
                />
              </ResizablePanel>

              {/* Handle entre Mensagens e Preview */}
              <ResizableHandle
                withHandle
                className={`cursor-col-resize hover:bg-orange-100 transition-colors ${FOCUS_RING}`}
                aria-label="Ajustar largura do painel de preview"
              />

              {/* Painel de Preview */}
              <ResizablePanel
                defaultSize={toPercentString(panelSizes.preview)}
                minSize={toPercentString(effectivePreviewBounds.min)}
                maxSize={toPercentString(effectivePreviewBounds.max)}
                className="flex min-h-0 flex-col bg-white"
              >
                <EmailViewer
                  message={currentMessage}
                  loading={messageLoading}
                  isSenderHighlighted={isSenderHighlightedForPreview}
                  onReply={onReply}
                  onForward={onForward}
                  onExpand={onExpand}
                  onMarkRead={onMarkRead}
                  onMarkUnread={
                    currentMessage && onQuickToggleRead
                      ? () =>
                          onQuickToggleRead(
                            currentMessage.messageId,
                            currentMessage.isRead === true
                          )
                      : undefined
                  }
                  onStar={onStar}
                  onUnstar={onUnstar}
                  onArchive={
                    currentMessage && onQuickArchive && !isArchiveFolder
                      ? () => onQuickArchive(currentMessage.messageId)
                      : undefined
                  }
                  onDelete={
                    currentMessage && onQuickDelete
                      ? () => onQuickDelete(currentMessage.messageId)
                      : undefined
                  }
                  onMarkSpam={onMarkSpam}
                  onMarkNotSpam={onMarkNotSpam}
                  isSpamFolder={isSpamFolder}
                  onDownloadAttachment={onDownloadAttachment}
                  isDraftFolder={isDraftFolder}
                  onSendDraft={onSendDraft}
                  className="h-full"
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </div>
    </div>
  )
}
