'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createWhatsAppApi } from '../api/whatsapp'
import type { WhatsAppConversationItem, WhatsAppMessageItem } from './tipos'
const CONVERSATIONS_LIMIT = 50
const MESSAGES_LIMIT = 50

function normalizeConversations(raw: unknown): WhatsAppConversationItem[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const list = obj.conversations as unknown[]
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (c): c is Record<string, unknown> =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as Record<string, unknown>).id === 'string'
    )
    .map((c) => ({
      id: String(c.id),
      phone: String(c.phone ?? ''),
      displayName: c.displayName != null ? String(c.displayName) : null,
      lastMessageAt: String(c.lastMessageAt ?? ''),
      createdAt: String(c.createdAt ?? ''),
      updatedAt: String(c.updatedAt ?? ''),
      messageCount:
        typeof c.messageCount === 'number' ? c.messageCount : undefined,
    }))
}

function normalizeMessages(raw: unknown): WhatsAppMessageItem[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const list = obj.messages as unknown[]
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (m): m is Record<string, unknown> =>
        m != null &&
        typeof m === 'object' &&
        typeof (m as Record<string, unknown>).id === 'string'
    )
    .map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversationId ?? ''),
      providerMessageId:
        m.providerMessageId != null ? String(m.providerMessageId) : null,
      direction: (m.direction === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND') as
        'INBOUND' | 'OUTBOUND',
      type: String(m.type ?? 'TEXT'),
      body: String(m.body ?? ''),
      mediaUrl: m.mediaUrl != null ? String(m.mediaUrl) : null,
      timestamp: String(m.timestamp ?? ''),
      status: m.status != null ? String(m.status) : null,
      createdAt: String(m.createdAt ?? ''),
    }))
}

export function useWhatsAppPage() {
  const [conversations, setConversations] = useState<
    WhatsAppConversationItem[]
  >([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [loadMoreMessagesLoading, setLoadMoreMessagesLoading] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const client = useScopedApiClient(null)
  const messageClient = useScopedApiClient(selectedConversationId)
  const sendClient = useScopedApiClient(
    JSON.stringify([selectedConversationId, composerOpen])
  )
  const api = useMemo(() => createWhatsAppApi(client), [client])
  const messageApi = useMemo(
    () => createWhatsAppApi(messageClient),
    [messageClient]
  )
  const sendApi = useMemo(() => createWhatsAppApi(sendClient), [sendClient])
  useEffect(() => {
    setSending(false)
  }, [sendClient])
  const messagesBeforeRef = useRef<string | null>(null)

  const currentConversation: {
    id: string
    phone: string
    displayName: string | null
  } | null =
    selectedConversationId && conversations.length > 0
      ? (() => {
          const c = conversations.find((x) => x.id === selectedConversationId)
          return c
            ? {
                id: c.id,
                phone: c.phone,
                displayName: c.displayName,
              }
            : null
        })()
      : null

  const fetchConversations = useCallback(async () => {
    setConversationsLoading(true)
    try {
      const data = await api.conversations(CONVERSATIONS_LIMIT)
      setConversations(normalizeConversations(data))
    } catch (e) {
      if (isAbortError(e) || !client.isCurrent()) return
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar conversas')
      setConversations([])
    } finally {
      if (client.isCurrent()) setConversationsLoading(false)
    }
  }, [api, client])

  const fetchMessages = useCallback(
    async (conversationId: string, before?: string) => {
      if (before) setLoadMoreMessagesLoading(true)
      else setMessagesLoading(true)
      try {
        const data = await messageApi.messages(
          conversationId,
          MESSAGES_LIMIT,
          before
        )
        const list = normalizeMessages(data)
        if (before) {
          setMessages((prev) => [...list, ...prev])
        } else {
          setMessages(list)
        }
        const first = list[0]
        messagesBeforeRef.current = first != null ? first.timestamp : null
        setHasMoreMessages(list.length >= MESSAGES_LIMIT)
      } catch (e) {
        if (isAbortError(e) || !messageClient.isCurrent()) return
        toast.error(
          e instanceof Error ? e.message : 'Erro ao carregar mensagens'
        )
        if (!before) setMessages([])
      } finally {
        if (messageClient.isCurrent()) {
          setMessagesLoading(false)
          setLoadMoreMessagesLoading(false)
        }
      }
    },
    [messageApi, messageClient]
  )

  useEffect(() => {
    void fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      setHasMoreMessages(false)
      return
    }
    void fetchMessages(selectedConversationId)
  }, [selectedConversationId, fetchMessages])

  const handleLoadMoreMessages = useCallback(() => {
    if (!selectedConversationId || !messagesBeforeRef.current) return
    void fetchMessages(selectedConversationId, messagesBeforeRef.current)
  }, [selectedConversationId, fetchMessages])

  const handleReply = useCallback(() => {
    setComposerOpen(true)
  }, [])

  const handleSendReply = useCallback(
    async (text: string) => {
      if (!selectedConversationId || !text.trim()) return
      setSending(true)
      try {
        const data = await sendApi.send(selectedConversationId, text)
        const msg = normalizeMessages({ messages: [data] })[0]
        if (msg) setMessages((prev) => [...prev, msg])
        toast.success('Mensagem enviada')
        void fetchConversations()
        void fetchMessages(selectedConversationId)
      } catch (e) {
        if (isAbortError(e) || !sendClient.isCurrent()) return
        toast.error(e instanceof Error ? e.message : 'Erro ao enviar mensagem')
      } finally {
        if (sendClient.isCurrent()) setSending(false)
      }
    },
    [
      selectedConversationId,
      fetchConversations,
      fetchMessages,
      sendApi,
      sendClient,
    ]
  )

  const handleExpand = useCallback(() => {
    setIsFullViewOpen(true)
  }, [])

  const handleCloseFullView = useCallback(() => {
    setIsFullViewOpen(false)
  }, [])

  const conversationLabel =
    currentConversation?.displayName ?? currentConversation?.phone ?? 'Conversa'

  return {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    conversationsLoading,
    messages,
    messagesLoading,
    loadMoreMessagesLoading,
    hasMoreMessages,
    isFullViewOpen,
    setIsFullViewOpen,
    composerOpen,
    setComposerOpen,
    sending,
    currentConversation,
    fetchConversations,
    fetchMessages,
    handleLoadMoreMessages,
    handleReply,
    handleSendReply,
    handleExpand,
    handleCloseFullView,
    conversationLabel,
  }
}
