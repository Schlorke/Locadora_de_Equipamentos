'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@gb-locacoes/ui'
import type { Layout } from 'react-resizable-panels'
import { WhatsAppConversationList } from './ListaConversas.web'
import { WhatsAppMessageList } from './ListaMensagens.web'
import { WhatsAppViewer } from './Visualizador.web'
import type { WhatsAppConversationItem } from './ListaConversas.web'
import type { WhatsAppMessageItem } from './ListaMensagens.web'

const STORAGE_KEY = 'whatsapp-panel-sizes'
const DEFAULT_SIZES = { messages: 44, preview: 56 }
const MESSAGES_MIN_PERCENT = 30

function clampPercent(value: number | undefined | null): number {
  const n = typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function toPercentString(value: number): string {
  return `${clampPercent(value)}%`
}

interface WhatsAppLayoutContainerProps {
  conversations: WhatsAppConversationItem[]
  selectedConversationId: string | null
  onSelectConversation: (_id: string) => void
  conversationsLoading: boolean
  messages: WhatsAppMessageItem[]
  messagesLoading: boolean
  currentConversation: {
    id: string
    phone: string
    displayName: string | null
  } | null
  onReply?: () => void
  onExpand?: () => void
  onLoadMoreMessages?: () => void
  loadMoreMessagesLoading?: boolean
  hasMoreMessages?: boolean
  onRefresh?: () => void
  refreshLoading?: boolean
}

export function WhatsAppLayoutContainer({
  conversations,
  selectedConversationId,
  onSelectConversation,
  conversationsLoading,
  messages,
  messagesLoading,
  currentConversation,
  onReply,
  onExpand,
  onLoadMoreMessages,
  loadMoreMessagesLoading = false,
  hasMoreMessages = false,
  onRefresh,
  refreshLoading = false,
}: WhatsAppLayoutContainerProps) {
  const [panelSizes, setPanelSizes] = useState(DEFAULT_SIZES)
  const panelsContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as {
          messages?: number
          preview?: number
        }
        const messagesRaw =
          typeof parsed.messages === 'number' &&
          Number.isFinite(parsed.messages)
            ? parsed.messages
            : DEFAULT_SIZES.messages
        const previewRaw =
          typeof parsed.preview === 'number' && Number.isFinite(parsed.preview)
            ? parsed.preview
            : DEFAULT_SIZES.preview
        const total = messagesRaw + previewRaw
        if (total > 0) {
          const scale = 100 / total
          setPanelSizes({
            messages: clampPercent(messagesRaw * scale),
            preview: clampPercent(previewRaw * scale),
          })
        }
      }
    } catch {
      setPanelSizes(DEFAULT_SIZES)
    }
  }, [])

  const handleResize = useCallback((layout: Layout) => {
    if (Array.isArray(layout) && layout.length === 2) {
      const newSizes = {
        messages: layout[0] ?? DEFAULT_SIZES.messages,
        preview: layout[1] ?? DEFAULT_SIZES.preview,
      }
      setPanelSizes(newSizes)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSizes))
      } catch {
        // ignore
      }
    }
  }, [])

  return (
    <div className="h-full min-h-[600px]">
      <div className="h-full rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex h-full min-w-0">
          {/* Painel de Conversas (largura fixa) */}
          <div className="shrink-0 basis-[20%] min-w-[200px] max-w-[280px] border-r border-slate-200/70 bg-slate-50/60">
            <WhatsAppConversationList
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={onSelectConversation}
              loading={conversationsLoading}
              onRefresh={onRefresh}
              refreshLoading={refreshLoading}
              className="h-full"
            />
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
                className="flex min-h-0 flex-col bg-white"
              >
                <WhatsAppMessageList
                  messages={messages}
                  loading={messagesLoading}
                  onLoadMore={onLoadMoreMessages}
                  loadMoreLoading={loadMoreMessagesLoading}
                  hasMore={hasMoreMessages}
                  className="h-full"
                />
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className="cursor-col-resize hover:bg-green-100 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                aria-label="Ajustar largura do painel de preview"
              />

              {/* Painel de Preview */}
              <ResizablePanel
                defaultSize={toPercentString(panelSizes.preview)}
                minSize={toPercentString(30)}
                className="flex min-h-0 flex-col bg-white"
              >
                <WhatsAppViewer
                  conversation={currentConversation}
                  messages={messages}
                  loading={messagesLoading}
                  onReply={onReply}
                  onExpand={onExpand}
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
