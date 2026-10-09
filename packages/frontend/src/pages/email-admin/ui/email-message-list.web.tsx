'use client'

import { useRef } from 'react'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function safeFormatDate(timestamp?: number | string): string {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

/** Decodifica entidades HTML comuns em texto vindo da API (ex.: &lt; &gt;) para exibição correta. &amp; é aplicado primeiro para que sequências como &amp;lt; sejam decodificadas corretamente numa única passagem (evita double-decode). */
function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function safeDecode(text: string | undefined): string {
  if (text == null || text === '') return ''
  return decodeHtmlEntities(text)
}

export type { EmailMessage } from '../model/tipos'
import type { EmailMessage } from '../model/tipos'

/** Chave do remetente para "destacar" (estrela por remetente). */
function getSenderKey(msg: EmailMessage): string {
  if (!msg?.fromAddress) return ''
  const email = msg.fromAddress.emailAddress?.trim()
  const name = msg.fromAddress.displayName?.trim()
  return (email ?? name ?? '').trim()
}

interface EmailMessageListProps {
  messages: EmailMessage[]
  selectedMessageId?: string
  onSelectMessage: (_messageId: string) => void
  /**
   * Remetentes "importantes": qualquer mensagem desse remetente mostra estrela.
   * Ao clicar na estrela de uma mensagem, o remetente inteiro é marcado/desmarcado
   * como importante (todas as mensagens dele passam a mostrar ou deixar de mostrar estrela).
   */
  highlightedSenderKeys?: Set<string>
  /** Toggle "remetente importante" na lista. Afeta todas as mensagens desse remetente. (messageId, isStarred) */
  onToggleStar?: (_messageId: string, _isStarred: boolean) => void
  onLoadMore?: () => void
  loadMoreLoading?: boolean
  hasMoreMessages?: boolean
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
  /** Exclusão em massa em andamento: botão mostra "Excluindo..." e fica desabilitado */
  bulkDeleteLoading?: boolean
  onBulkMarkRead?: () => void
  onBulkMove?: (_targetFolderId: string) => void
  /** Denunciar mensagens selecionadas como spam */
  onBulkSpam?: () => void
  /** Marcar mensagens selecionadas como não spam */
  onBulkNotSpam?: () => void
  /** Indica se estamos na pasta Spam */
  isSpamFolder?: boolean
  moveOptions?: Array<{ id: string; label: string }>
  onQuickArchive?: (_messageId: string) => void
  onQuickUnarchive?: (_messageId: string) => void
  isArchiveFolder?: boolean
  onQuickDelete?: (_messageId: string) => void
  onQuickToggleRead?: (_messageId: string, _isRead: boolean) => void
  loading?: boolean
  className?: string
}

export function EmailMessageList({
  messages,
  selectedMessageId,
  onSelectMessage,
  highlightedSenderKeys,
  onToggleStar,
  onLoadMore,
  loadMoreLoading = false,
  hasMoreMessages = false,
  searchQuery: _searchQuery = '',
  onSearchChange: _onSearchChange,
  quickFilter: _quickFilter = 'all',
  onQuickFilterChange: _onQuickFilterChange,
  selectionMode = false,
  onSelectionModeChange,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBulkArchive,
  onBulkDelete,
  bulkDeleteLoading = false,
  onBulkMarkRead,
  onBulkMove,
  onBulkSpam,
  onBulkNotSpam,
  isSpamFolder = false,
  moveOptions = [],
  onQuickArchive,
  onQuickUnarchive,
  isArchiveFolder = false,
  onQuickDelete,
  onQuickToggleRead,
  loading,
  className,
}: EmailMessageListProps) {
  const hasSelection = selectedIds.length > 0
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className={cn(
        'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
        className
      )}
    >
      <div className="flex flex-col gap-2 border-b border-slate-200/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-semibold text-slate-900">
              Mensagens
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <span className="text-xs text-slate-600">
                {selectedIds.length} selecionada(s)
              </span>
            )}
            <Badge variant="secondary" className="text-xs">
              {loading ? 'Carregando...' : `${messages.length}`}
            </Badge>
          </div>
        </div>
        {(onSelectionModeChange || hasSelection) && (
          <div className="flex items-center gap-2 flex-wrap">
            {!selectionMode ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                onClick={() => onSelectionModeChange?.(true)}
                aria-label="Selecionar mensagens"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                Selecionar
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                  onClick={onClearSelection}
                  aria-label="Cancelar seleção"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancelar
                </Button>
                {onSelectAll && messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                    onClick={onSelectAll}
                    aria-label="Selecionar todas"
                  >
                    Selecionar todas
                  </Button>
                )}
                {onBulkMove && moveOptions.length > 0 && (
                  <Select onValueChange={onBulkMove}>
                    <SelectTrigger
                      className="h-7 text-xs w-fit min-w-[120px] max-w-[160px] border bg-background hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                      aria-label="Mover mensagens selecionadas"
                    >
                      <SelectValue placeholder="Mover para" />
                    </SelectTrigger>
                    <SelectContent>
                      {moveOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {hasSelection && (
                  <>
                    {onBulkMarkRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        onClick={onBulkMarkRead}
                      >
                        Marcar lido
                      </Button>
                    )}
                    {onBulkArchive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        onClick={onBulkArchive}
                      >
                        Arquivar
                      </Button>
                    )}
                    {isSpamFolder && onBulkNotSpam && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-green-600 hover:[transform:scale(1)] transition-all duration-200"
                        onClick={onBulkNotSpam}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        Não é spam
                      </Button>
                    )}
                    {!isSpamFolder && onBulkSpam && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-red-600 hover:[transform:scale(1)] transition-all duration-200"
                        onClick={onBulkSpam}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                        Spam
                      </Button>
                    )}
                    {onBulkDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={bulkDeleteLoading}
                        className="h-7 text-xs border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        onClick={onBulkDelete}
                      >
                        {bulkDeleteLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            Excluindo...
                          </>
                        ) : (
                          'Excluir'
                        )}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-100 rounded-md animate-pulse"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Nenhuma mensagem nesta pasta
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0 overflow-y-auto admin-scrollbar">
          <div className="space-y-1 p-2 min-w-0">
            {messages.map((msg) => {
              const time = msg.receivedTime ?? msg.sentTime
              const timeLabel = safeFormatDate(time)
              const from = safeDecode(
                msg.fromAddress?.displayName ??
                  msg.fromAddress?.emailAddress ??
                  'Sem remetente'
              )

              const isRowSelected = msg.messageId === selectedMessageId
              const isBulkSelected = selectedIds.includes(msg.messageId)
              const handleRowActivate = () => {
                if (selectionMode && onToggleSelect) {
                  onToggleSelect(msg.messageId)
                } else {
                  onSelectMessage(msg.messageId)
                }
              }
              const handleContentPointerDown = (e: React.PointerEvent) => {
                pointerDownRef.current = { x: e.clientX, y: e.clientY }
              }
              const handleContentClick = (e: React.MouseEvent) => {
                const sel = window.getSelection()
                const hasSelection = sel && sel.toString().trim().length > 0
                if (hasSelection) return
                const down = pointerDownRef.current
                if (
                  down &&
                  (Math.abs(e.clientX - down.x) > 5 ||
                    Math.abs(e.clientY - down.y) > 5)
                )
                  return
                handleRowActivate()
              }

              return (
                <div
                  key={msg.messageId}
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir mensagem: ${safeDecode(msg.subject) || 'Sem assunto'}`}
                  className={cn(
                    'group relative w-full min-w-0 text-left pl-4 pr-3 py-3 rounded-md transition-all flex flex-wrap items-start gap-x-2 gap-y-1 overflow-hidden select-text shadow hover:shadow-md cursor-pointer',
                    isRowSelected
                      ? 'bg-orange-50 border border-orange-200'
                      : 'hover:bg-slate-50 border border-transparent',
                    !msg.isRead && 'font-semibold'
                  )}
                  onClick={handleContentClick}
                  onPointerDown={handleContentPointerDown}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleRowActivate()
                    }
                  }}
                >
                  {/* Indicador de não lido - barra lateral estilo Outlook */}
                  {!msg.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-full" />
                  )}
                  {selectionMode && onToggleSelect && (
                    <Checkbox
                      checked={isBulkSelected}
                      onCheckedChange={() => onToggleSelect(msg.messageId)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={isBulkSelected ? 'Desmarcar' : 'Selecionar'}
                      className="shrink-0 mt-0.5 h-5 w-5 rounded border-2"
                    />
                  )}
                  <div className="flex-1 min-w-0 overflow-hidden text-left select-text">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-slate-900 truncate min-w-0">
                          {from}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                        {timeLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1 min-w-0">
                      <span
                        className={cn(
                          'text-sm flex-1 min-w-0 break-words line-clamp-2',
                          msg.isRead ? 'text-slate-700' : 'text-slate-900'
                        )}
                      >
                        {safeDecode(msg.subject) || '(Sem assunto)'}
                      </span>
                    </div>
                    {msg.summary && (
                      <p className="w-full text-xs text-slate-500 break-words line-clamp-2 min-w-0 basis-full select-text mt-0.5">
                        {safeDecode(msg.summary)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0 self-start">
                    {msg.hasAttachments && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {onQuickToggleRead && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickToggleRead(msg.messageId, msg.isRead === true)
                        }}
                        aria-label={
                          msg.isRead
                            ? 'Marcar como não lido'
                            : 'Marcar como lido'
                        }
                      >
                        {msg.isRead ? (
                          <MailOpen className="w-3.5 h-3.5" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                    {isArchiveFolder && onQuickUnarchive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickUnarchive(msg.messageId)
                        }}
                        aria-label="Desarquivar mensagem (voltar para Caixa de entrada)"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      </Button>
                    ) : onQuickArchive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickArchive(msg.messageId)
                        }}
                        aria-label="Arquivar mensagem"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}
                    {onQuickDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickDelete(msg.messageId)
                        }}
                        aria-label="Excluir mensagem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {onToggleStar ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Estrela = "remetente importante": o toggle afeta TODAS as mensagens
                          // desse remetente (ver handleToggleStar na página e comentário acima).
                          const currentlyStarred =
                            msg.isStarred === true ||
                            highlightedSenderKeys?.has(getSenderKey(msg))
                          onToggleStar(msg.messageId, !currentlyStarred)
                        }}
                        aria-label={
                          msg.isStarred === true ||
                          highlightedSenderKeys?.has(getSenderKey(msg))
                            ? 'Remover destaque'
                            : 'Destacar'
                        }
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            msg.isStarred ||
                              highlightedSenderKeys?.has(getSenderKey(msg))
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          )}
                          fill={
                            msg.isStarred ||
                            highlightedSenderKeys?.has(getSenderKey(msg))
                              ? 'currentColor'
                              : 'none'
                          }
                          strokeWidth={
                            msg.isStarred ||
                            highlightedSenderKeys?.has(getSenderKey(msg))
                              ? 0
                              : undefined
                          }
                        />
                      </Button>
                    ) : msg.isStarred ||
                      highlightedSenderKeys?.has(getSenderKey(msg)) ? (
                      <Star
                        className="w-3.5 h-3.5 text-amber-500"
                        fill="currentColor"
                        strokeWidth={0}
                      />
                    ) : null}
                  </div>
                </div>
              )
            })}
            {onLoadMore && hasMoreMessages && messages.length > 0 && (
              <div className="p-3 border-t border-slate-200/70">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onLoadMore}
                  disabled={loadMoreLoading || loading}
                  aria-label="Carregar mais mensagens"
                >
                  {loadMoreLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    'Carregar mais'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
