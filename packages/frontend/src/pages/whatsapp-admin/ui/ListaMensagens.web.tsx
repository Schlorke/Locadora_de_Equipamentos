'use client'

import { cn } from '../../../shared/lib/cn.web'
import { ScrollArea } from '@gb-locacoes/ui'

export type { WhatsAppMessageItem } from '../model/tipos'
import type { WhatsAppMessageItem } from '../model/tipos'

interface WhatsAppMessageListProps {
  messages: WhatsAppMessageItem[]
  loading?: boolean
  onLoadMore?: () => void
  loadMoreLoading?: boolean
  hasMore?: boolean
  className?: string
}

function formatMessageTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function truncateBody(body: string, maxLen = 80): string {
  if (!body || typeof body !== 'string') return '(mídia)'
  const t = body.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}

export function WhatsAppMessageList({
  messages,
  loading,
  onLoadMore,
  loadMoreLoading = false,
  hasMore = false,
  className,
}: WhatsAppMessageListProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-2 p-4',
          className
        )}
      >
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
      </div>
    )
  }

  return (
    <ScrollArea className={cn('flex-1', className)}>
      <div className="flex flex-col gap-2 p-3">
        {hasMore && onLoadMore && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadMoreLoading}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              {loadMoreLoading ? 'Carregando…' : 'Carregar mais'}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Nenhuma mensagem nesta conversa.
          </div>
        ) : (
          messages.map((msg) => {
            const isOut = msg.direction === 'OUTBOUND'
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex w-full',
                  isOut ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2 text-sm',
                    isOut
                      ? 'bg-green-600 text-white rounded-br-md'
                      : 'bg-slate-200 text-slate-900 rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {truncateBody(msg.body)}
                  </p>
                  <div
                    className={cn(
                      'mt-1 text-xs',
                      isOut ? 'text-green-100' : 'text-slate-500'
                    )}
                  >
                    {formatMessageTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </ScrollArea>
  )
}
