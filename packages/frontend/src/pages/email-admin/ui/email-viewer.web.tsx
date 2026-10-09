'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@gb-locacoes/ui'
import {
  Reply,
  Forward,
  Download,
  Paperclip,
  Mail,
  Maximize2,
  Star,
  MoreHorizontal,
  Archive,
  Trash2,
  MailOpen,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { sanitizeHtml } from '../../../shared/lib/sanitize'

function safeFormatFullDate(timestamp?: number | string): string {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return format(date, 'EEE, dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return ''
  }
}

export type { EmailViewerMessage } from '../model/tipos'
import type { EmailViewerMessage } from '../model/tipos'

interface EmailViewerProps {
  message: EmailViewerMessage | null
  loading?: boolean
  onReply?: () => void
  onForward?: () => void
  onExpand?: (_message: EmailViewerMessage) => void
  onMarkRead?: () => void
  onMarkUnread?: () => void
  onStar?: () => void
  onUnstar?: () => void
  onArchive?: () => void
  onDelete?: () => void
  /** Denunciar mensagem como spam */
  onMarkSpam?: () => void
  /** Marcar mensagem como não spam (tirar da pasta Spam) */
  onMarkNotSpam?: () => void
  /** Indica se estamos na pasta Spam */
  isSpamFolder?: boolean
  /** Download de anexo: (attachmentId, fileName) */
  onDownloadAttachment?: (_attachmentId: string, _fileName: string) => void
  /** Exibir botão "Editar e enviar" (quando a mensagem é um rascunho) */
  isDraftFolder?: boolean
  onSendDraft?: () => void
  /** Quando true, não exibe a barra de ações (usado em dialogs onde ações vão no Footer) */
  embedMode?: boolean
  /** Remetente destacado: exibe estrela amarela ao lado do assunto. */
  isSenderHighlighted?: boolean
  className?: string
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Botão adaptativo estilo Outlook: mostra ícone+texto quando há espaço,
 * apenas ícone com tooltip quando o container é reduzido.
 */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'outline',
  compact = false,
  className = '',
  iconClassName = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  variant?: 'outline' | 'ghost' | 'default'
  compact?: boolean
  className?: string
  iconClassName?: string
}) {
  const button = (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      className={className}
      aria-label={label}
    >
      <Icon className={`w-4 h-4 ${compact ? '' : 'mr-1.5'} ${iconClassName}`} />
      {!compact && label}
    </Button>
  )

  // Quando compacto, envolve com tooltip para manter acessibilidade
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}

export function EmailViewer({
  message,
  loading,
  onReply,
  onForward,
  onExpand,
  onMarkRead,
  onMarkUnread,
  onStar,
  onUnstar,
  onArchive,
  onDelete,
  onMarkSpam,
  onMarkNotSpam,
  isSpamFolder = false,
  onDownloadAttachment,
  isDraftFolder = false,
  onSendDraft,
  embedMode = false,
  isSenderHighlighted = false,
  className,
}: EmailViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCompact, setIsCompact] = useState(false)

  // Recurso estilo Outlook: quando o painel de preview é reduzido (resize), os botões
  // Responder/Encaminhar/Expandir passam a mostrar apenas ícone + tooltip. O container
  // precisa de min-w-0 para encolher com o painel em layout flex.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 500)
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  if (loading) {
    return (
      <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
        <div className="border-b border-slate-200/70 px-4 py-4 space-y-3">
          <div className="h-6 bg-slate-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2" />
        </div>
        <div className="p-6 space-y-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-4/6" />
        </div>
      </div>
    )
  }

  if (!message) {
    return (
      <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Selecione uma mensagem para visualizar
            </p>
          </div>
        </div>
      </div>
    )
  }

  const time = message.receivedTime ?? message.sentTime
  const fullDateLabel = safeFormatFullDate(time)
  const from =
    message.fromAddress?.displayName ??
    message.fromAddress?.emailAddress ??
    'Sem remetente'
  const to =
    message.toAddress?.map((a) => a.displayName ?? a.emailAddress).join(', ') ||
    ''

  const hasAnyOption =
    onMarkRead ||
    onMarkUnread ||
    onStar ||
    onUnstar ||
    onArchive ||
    onDelete ||
    onMarkSpam ||
    onMarkNotSpam

  const emailOptionsDropdown = hasAnyOption ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 rounded-md border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
          aria-label="Mais opções"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 min-w-[14rem]">
        {message?.isRead === false && onMarkRead && (
          <DropdownMenuItem onClick={onMarkRead}>
            <Mail className="w-4 h-4 mr-2.5 shrink-0 text-slate-500" />
            Marcar como lido
          </DropdownMenuItem>
        )}
        {message?.isRead !== false && onMarkUnread && (
          <DropdownMenuItem onClick={onMarkUnread}>
            <MailOpen className="w-4 h-4 mr-2.5 shrink-0 text-slate-500" />
            Marcar como não lido
          </DropdownMenuItem>
        )}
        {(message?.isStarred || isSenderHighlighted) && onUnstar && (
          <DropdownMenuItem onClick={onUnstar}>
            <Star
              className="w-4 h-4 mr-2.5 shrink-0 text-amber-500"
              fill="currentColor"
              strokeWidth={0}
            />
            Remover destaque
          </DropdownMenuItem>
        )}
        {!message?.isStarred && !isSenderHighlighted && onStar && (
          <DropdownMenuItem onClick={onStar}>
            <Star className="w-4 h-4 mr-2.5 shrink-0 text-slate-500" />
            Destacar
          </DropdownMenuItem>
        )}
        {onArchive && (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="w-4 h-4 mr-2.5 shrink-0 text-slate-500" />
            Arquivar
          </DropdownMenuItem>
        )}
        {isSpamFolder && onMarkNotSpam && (
          <DropdownMenuItem onClick={onMarkNotSpam}>
            <ShieldCheck className="w-4 h-4 mr-2.5 shrink-0 text-emerald-600" />
            Não é spam
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-slate-200/70" />
        {!isSpamFolder && onMarkSpam && (
          <DropdownMenuItem
            onClick={onMarkSpam}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50 hover:text-red-600"
          >
            <ShieldAlert className="w-4 h-4 mr-2.5 shrink-0" />
            Denunciar spam
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2.5 shrink-0" />
            Excluir
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        className={`flex h-full min-h-0 min-w-0 flex-col ${className ?? ''}`}
      >
        {/* Header com informações e ações */}
        <div className="border-b border-slate-200/70 px-4 py-3">
          {/* Barra de ações (preview) ou linha data + Mais opções (dialog embedMode) */}
          {!embedMode ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  {isDraftFolder && onSendDraft ? (
                    <ActionButton
                      icon={Mail}
                      label="Editar e enviar"
                      onClick={onSendDraft}
                      variant="default"
                      compact={isCompact}
                    />
                  ) : (
                    <>
                      {onReply && (
                        <ActionButton
                          icon={Reply}
                          label="Responder"
                          onClick={onReply}
                          variant="ghost"
                          compact={isCompact}
                          className="border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        />
                      )}
                      {onForward && (
                        <ActionButton
                          icon={Forward}
                          label="Encaminhar"
                          onClick={onForward}
                          variant="ghost"
                          compact={isCompact}
                          className="border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        />
                      )}
                      {onExpand && (
                        <ActionButton
                          icon={Maximize2}
                          label="Expandir"
                          onClick={() => onExpand(message)}
                          variant="ghost"
                          compact={isCompact}
                          className="border border-gray-200 bg-background shadow-sm hover:shadow-md hover:text-orange-600 hover:[transform:scale(1)] transition-all duration-200"
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {emailOptionsDropdown}
                </div>
              </div>
              <div className="text-xs text-slate-500 capitalize mb-3">
                {fullDateLabel}
              </div>
            </>
          ) : (
            /* embedMode: linha única com data à esquerda e "Mais opções" à direita */
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs text-slate-500 capitalize">
                {fullDateLabel}
              </div>
              {emailOptionsDropdown}
            </div>
          )}

          {/* Informações do email (assunto omitido em embedMode - já no Dialog.Title) */}
          <div className="min-w-0">
            {!embedMode && (
              <div className="flex items-center gap-2 mb-2">
                {isSenderHighlighted && (
                  <Star
                    className="w-4 h-4 shrink-0 text-amber-500"
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden
                  />
                )}
                <h2 className="text-lg font-semibold text-slate-900 line-clamp-2">
                  {message.subject || '(Sem assunto)'}
                </h2>
              </div>
            )}
            <div className="grid gap-1 text-sm text-slate-600">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <span className="font-medium text-slate-500">De:</span>
                <span className="min-w-0 truncate">{from}</span>
              </div>
              {to && (
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  <span className="font-medium text-slate-500">Para:</span>
                  <span className="min-w-0 truncate">{to}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-auto admin-scrollbar-hover-only">
          <div className="p-6 w-full min-w-fit">
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">
                    {message.attachments.length} anexo(s)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {message.attachments.map((att) => (
                    <div
                      key={att.attachmentId}
                      className="flex items-center justify-between gap-3 p-2 bg-white rounded border"
                    >
                      <span className="text-sm text-slate-700 truncate flex-1">
                        {att.fileName}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {formatBytes(att.size)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDownloadAttachment?.(
                              att.attachmentId,
                              att.fileName
                            )
                          }
                          disabled={!onDownloadAttachment}
                          aria-label={`Baixar ${att.fileName}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              className="prose prose-sm max-w-none break-words [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  message.htmlContent ||
                    message.content ||
                    '<p class="text-slate-500 italic">Sem conteúdo</p>',
                  {
                    ALLOWED_TAGS: [
                      'p',
                      'br',
                      'strong',
                      'em',
                      'u',
                      's',
                      'h1',
                      'h2',
                      'h3',
                      'h4',
                      'h5',
                      'h6',
                      'ul',
                      'ol',
                      'li',
                      'blockquote',
                      'a',
                      'img',
                      'table',
                      'thead',
                      'tbody',
                      'tr',
                      'td',
                      'th',
                      'div',
                      'span',
                      'hr',
                    ],
                    ALLOWED_ATTR: [
                      'href',
                      'src',
                      'alt',
                      'title',
                      'class',
                      'style',
                      'width',
                      'height',
                      'align',
                      'colspan',
                      'rowspan',
                      'target',
                      'rel',
                    ],
                  }
                ),
              }}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
