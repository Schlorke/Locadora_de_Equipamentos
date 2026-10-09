'use client'

import { cn } from '../../../shared/lib/cn.web'
import { Button } from '@gb-locacoes/ui'
import { MessageCircle, Maximize2, Send } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@gb-locacoes/ui'
import type { WhatsAppMessageItem } from './ListaMensagens.web'

export interface WhatsAppViewerConversation {
  id: string
  phone: string
  displayName: string | null
}

interface WhatsAppViewerProps {
  conversation: WhatsAppViewerConversation | null
  messages: WhatsAppMessageItem[]
  loading?: boolean
  onReply?: () => void
  onExpand?: () => void
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

export function WhatsAppViewer({
  conversation,
  messages,
  loading,
  onReply,
  onExpand,
  className,
}: WhatsAppViewerProps) {
  if (!conversation) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-4 p-8 text-slate-500',
          className
        )}
      >
        <MessageCircle className="h-12 w-12 text-slate-300" />
        <p className="text-sm">Selecione uma conversa para ver as mensagens.</p>
      </div>
    )
  }

  const label =
    conversation.displayName ?? formatPhoneDisplay(conversation.phone)

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-slate-200/70 bg-slate-50/50',
          className
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-900">
              {label}
            </h2>
            <p className="truncate text-xs text-slate-500">
              {conversation.phone}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onExpand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onExpand}
                    className="h-8 w-8"
                    aria-label="Expandir conversa"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Expandir</TooltipContent>
              </Tooltip>
            )}
            {onReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onReply}
                    className="h-8 bg-green-600 hover:bg-green-700"
                    aria-label="Responder"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Responder
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Responder</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhuma mensagem nesta conversa.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => {
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
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                        isOut
                          ? 'bg-green-600 text-white rounded-br-md'
                          : 'bg-white text-slate-900 rounded-bl-md border border-slate-200/70'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {msg.body || '(mídia)'}
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
              })}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
