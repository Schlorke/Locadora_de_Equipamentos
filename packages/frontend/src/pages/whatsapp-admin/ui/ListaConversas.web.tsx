'use client'

import { cn } from '../../../shared/lib/cn.web'
import { MessageCircle, RefreshCw } from 'lucide-react'

export type { WhatsAppConversationItem } from '../model/tipos'
import type { WhatsAppConversationItem } from '../model/tipos'

interface WhatsAppConversationListProps {
  conversations: WhatsAppConversationItem[]
  selectedConversationId?: string | null
  onSelectConversation: (_id: string) => void
  loading?: boolean
  onRefresh?: () => void
  refreshLoading?: boolean
  className?: string
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    if (isToday) {
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
  }
  if (digits.length >= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function WhatsAppConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  loading,
  onRefresh,
  refreshLoading,
  className,
}: WhatsAppConversationListProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex w-full items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <MessageCircle className="h-4 w-4 shrink-0 text-green-600" />
        <span className="text-sm font-semibold text-slate-900">Conversas</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshLoading}
            className="ml-auto rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Atualizar conversas"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshLoading && 'animate-spin')}
            />
          </button>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto admin-scrollbar">
          <nav className="space-y-1 p-2">
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Nenhuma conversa ainda. As mensagens recebidas via webhook
                aparecerão aqui.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId
                const label = conv.displayName ?? formatPhoneDisplay(conv.phone)
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      'w-full rounded-xl px-3 py-3 text-left transition-colors',
                      isSelected
                        ? 'bg-green-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm font-medium',
                          isSelected ? 'text-white' : 'text-slate-900'
                        )}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-xs',
                          isSelected ? 'text-green-100' : 'text-slate-500'
                        )}
                      >
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    {conv.messageCount !== undefined &&
                      conv.messageCount > 0 && (
                        <div
                          className={cn(
                            'mt-0.5 text-xs',
                            isSelected ? 'text-green-200' : 'text-slate-500'
                          )}
                        >
                          {conv.messageCount} mensagem(ns)
                        </div>
                      )}
                  </button>
                )
              })
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
