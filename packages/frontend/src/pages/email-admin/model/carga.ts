'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createMailApi } from '../api/mail'
import { toast } from '../../../shared/lib/toast'
import type {
  Account,
  EmailFolder,
  EmailMessage,
  EmailViewerMessage,
  ComposerMode,
} from './tipos'
import type { EmailPagePorts } from './ports'
import {
  getSenderKey,
  htmlToPlainTextForForward,
  isInboxFolder,
  normalizeEmailFolders,
  normalizeEmailMessages,
  normalizeFolderKey,
} from '../../../features/correio'

export function useEmailPage(ports: EmailPagePorts) {
  const client = useScopedApiClient(null)
  const mail = useMemo(() => createMailApi(client), [client])
  const searchParams = ports.query
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)

  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [foldersLoading, setFoldersLoading] = useState(false)

  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  )
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesLoadMoreLoading, setMessagesLoadMoreLoading] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  const [currentMessage, setCurrentMessage] =
    useState<EmailViewerMessage | null>(null)
  const [messageLoading, setMessageLoading] = useState(false)

  const [isFullViewOpen, setIsFullViewOpen] = useState(false)
  const [fullViewMessage, setFullViewMessage] =
    useState<EmailViewerMessage | null>(null)

  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState<ComposerMode>('new')
  const [composerMessageId, setComposerMessageId] = useState<string | null>(
    null
  )
  const [composerDraftId, setComposerDraftId] = useState<string | null>(null)
  const [composerInitialTo, setComposerInitialTo] = useState('')
  const [composerInitialSubject, setComposerInitialSubject] = useState('')
  const [composerInitialContent, setComposerInitialContent] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'unread' | 'starred' | 'attachments'
  >('all')
  const [dateStart, setDateStart] = useState<Date | null>(null)
  const [dateEnd, setDateEnd] = useState<Date | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showDeleteFromTrashConfirm, setShowDeleteFromTrashConfirm] =
    useState(false)
  const [pendingDeleteFromTrashIds, setPendingDeleteFromTrashIds] = useState<
    string[]
  >([])
  const [isDeletingFromTrash, setIsDeletingFromTrash] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showSpamConfirm, setShowSpamConfirm] = useState(false)
  const [pendingSpamIds, setPendingSpamIds] = useState<string[]>([])
  const [isMarkingSpam, setIsMarkingSpam] = useState(false)

  const [highlightedSenderKeys, setHighlightedSenderKeys] = useState<
    Set<string>
  >(() => {
    return new Set(ports.readHighlighted())
  })

  const searchInputId = 'admin-email-search'

  // --- Refs ---
  const selectedIdsRef = useRef<string[]>([])
  const filteredMessagesRef = useRef<EmailMessage[]>([])
  const messagesRef = useRef<EmailMessage[]>([])
  const selectedMessageIdRef = useRef<string | null>(null)
  const currentMessageRef = useRef<EmailViewerMessage | null>(null)
  const removedMessagesForRevertRef = useRef<Map<string, EmailMessage>>(
    new Map()
  )
  const draftMessageIdToRemoveOnSendRef = useRef<string | null>(null)
  const fullViewMessageRef = useRef<EmailViewerMessage | null>(null)
  const foldersRef = useRef<EmailFolder[]>(folders)
  selectedIdsRef.current = selectedIds
  selectedMessageIdRef.current = selectedMessageId
  currentMessageRef.current = currentMessage
  fullViewMessageRef.current = fullViewMessage
  foldersRef.current = folders
  messagesRef.current = messages

  // --- Derived state ---
  const isMobile = ports.isMobile
  const accountId = accounts[0]?.accountId
  const inboxFolderId = useMemo(
    () => folders.find((folder) => isInboxFolder(folder.folderName))?.folderId,
    [folders]
  )

  const isArchiveFolder =
    folders.some(
      (f) =>
        f.folderId === selectedFolderId &&
        ['archive', 'archived', 'arquivado'].includes(
          normalizeFolderKey(f.folderName)
        )
    ) ?? false

  const isTrashFolder =
    folders.some(
      (f) =>
        f.folderId === selectedFolderId &&
        ['trash', 'lixeira'].includes(normalizeFolderKey(f.folderName))
    ) ?? false

  const isSpamFolder =
    folders.some(
      (f) =>
        f.folderId === selectedFolderId &&
        ['spam', 'junk'].includes(normalizeFolderKey(f.folderName))
    ) ?? false

  const isDraftFolder =
    folders.some(
      (f) =>
        f.folderId === selectedFolderId &&
        ['drafts', 'rascunhos'].includes(normalizeFolderKey(f.folderName))
    ) ?? false

  const draftFolderId = useMemo(
    () =>
      folders.find((f) =>
        ['drafts', 'rascunhos'].includes(normalizeFolderKey(f.folderName))
      )?.folderId ?? null,
    [folders]
  )

  const moveFolderOptions = useMemo(
    () =>
      folders
        .filter((folder) => folder.folderId !== selectedFolderId)
        .map((folder) => ({
          id: folder.folderId,
          label: folder.folderName,
        })),
    [folders, selectedFolderId]
  )

  const filteredMessages = useMemo(() => {
    let list = messages
    if (quickFilter === 'unread') list = list.filter((m) => !m.isRead)
    else if (quickFilter === 'starred')
      list = list.filter(
        (m) => m.isStarred || highlightedSenderKeys.has(getSenderKey(m))
      )
    else if (quickFilter === 'attachments')
      list = list.filter((m) => m.hasAttachments)
    if (dateStart || dateEnd) {
      const start = dateStart
        ? new Date(
            dateStart.getFullYear(),
            dateStart.getMonth(),
            dateStart.getDate(),
            0,
            0,
            0,
            0
          )
        : null
      const end = dateEnd
        ? new Date(
            dateEnd.getFullYear(),
            dateEnd.getMonth(),
            dateEnd.getDate(),
            23,
            59,
            59,
            999
          )
        : null
      list = list.filter((m) => {
        const time = m.receivedTime ?? m.sentTime
        if (time == null) return false
        const timestamp =
          typeof time === 'number' && Number.isFinite(time)
            ? time
            : new Date(time as string | number).getTime()
        if (!Number.isFinite(timestamp)) return false
        if (start && timestamp < start.getTime()) return false
        if (end && timestamp > end.getTime()) return false
        return true
      })
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (m) =>
          (m.subject ?? '').toLowerCase().includes(q) ||
          (m.summary ?? '').toLowerCase().includes(q) ||
          (m.fromAddress?.emailAddress ?? '').toLowerCase().includes(q) ||
          (m.fromAddress?.displayName ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [
    messages,
    quickFilter,
    searchQuery,
    dateStart,
    dateEnd,
    highlightedSenderKeys,
  ])
  filteredMessagesRef.current = filteredMessages

  const primary = accounts[0]
  const accountLabel =
    primary?.primaryEmailAddress ??
    primary?.accountName ??
    primary?.accountId ??
    '—'
  const primaryEmail = primary?.primaryEmailAddress ?? ''
  const mailboxClient = useScopedApiClient(
    JSON.stringify([accountId, selectedFolderId])
  )
  const mailbox = useMemo(() => createMailApi(mailboxClient), [mailboxClient])
  const selectionCycle = useRef(0)
  useEffect(() => {
    selectionCycle.current++
    setIsBulkDeleting(false)
    setIsDeletingFromTrash(false)
    setIsMarkingSpam(false)
    setMessagesLoadMoreLoading(false)
    setShowDeleteFromTrashConfirm(false)
    setPendingDeleteFromTrashIds([])
    setShowSpamConfirm(false)
    setPendingSpamIds([])
  }, [mailbox])

  // --- Effects ---

  useEffect(() => {
    const success = searchParams.get('success')
    const err = searchParams.get('error')
    if (success === 'true') toast.success('Zoho Mail conectado com sucesso.')
    if (err) toast.error(decodeURIComponent(err))
  }, [searchParams])

  useEffect(() => {
    ports.persistHighlighted([...highlightedSenderKeys])
  }, [highlightedSenderKeys, ports])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    mail
      .request('/api/admin/zoho-mail/accounts')
      .then((res) => {
        mail.assertCurrent()

        if (cancelled) return
        if (res.status === 401) {
          setConnected(false)
          setAccounts([])
          return
        }
        if (res.ok) {
          return res.json().then((d) => {
            mail.assertCurrent()

            setConnected(true)
            setAccounts(Array.isArray(d.accounts) ? d.accounts : [])
          })
        } else {
          return res.json().then((d) => {
            mail.assertCurrent()

            setError(d?.error || 'Erro')
            setConnected(false)
            setAccounts([])
          })
        }
      })
      .catch(() => {
        if (!mail.isCurrent()) return

        if (!cancelled) {
          setError('Falha ao verificar conexão')
          setConnected(false)
        }
      })
      .finally(() => {
        if (!mail.isCurrent()) return

        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mail])

  const skipInitialMessagesEffectRef = useRef(false)

  useEffect(() => {
    if (!connected || !accountId) return
    let cancelled = false
    setFoldersLoading(true)
    mail
      .request(`/api/admin/zoho-mail/folders?accountId=${accountId}`)
      .then(async (res) => {
        mail.assertCurrent()

        const data = await res.json().catch(() => {
          mail.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Erro ao carregar pastas'
          )
        }
        return data as { folders?: unknown[] }
      })
      .then((d) => {
        mail.assertCurrent()

        if (cancelled) return
        const raw = Array.isArray(d.folders) ? d.folders : []
        const normalized = normalizeEmailFolders(raw)
        setFolders(normalized)
        const first = normalized[0]
        if (first) {
          setSelectedFolderId(first.folderId)
          skipInitialMessagesEffectRef.current = true
          setMessagesLoading(true)
          setMessages([])
          setSelectedMessageId(null)
          setCurrentMessage(null)
          setSelectionMode(false)
          setSelectedIds([])
          mail
            .request(
              `/api/admin/zoho-mail/messages?accountId=${accountId}&folderId=${first.folderId}&limit=50&start=0`
            )
            .then(async (res) => {
              mail.assertCurrent()

              const msgData = await res.json().catch(() => {
                mail.assertCurrent()
                return {}
              })
              if (!res.ok) {
                throw new Error(
                  typeof (msgData as { error?: string })?.error === 'string'
                    ? (msgData as { error: string }).error
                    : 'Erro ao carregar mensagens'
                )
              }
              return msgData as { messages?: unknown[] }
            })
            .then((msgD) => {
              mail.assertCurrent()

              if (cancelled) return
              const msgRaw = Array.isArray(msgD.messages) ? msgD.messages : []
              const list = normalizeEmailMessages(msgRaw)
              setMessages(list)
              setHasMoreMessages(msgRaw.length >= 50)
            })
            .catch((e) => {
              if (!mail.isCurrent() || isAbortError(e)) return

              if (!cancelled)
                toast.error(
                  e instanceof Error ? e.message : 'Erro ao carregar mensagens'
                )
            })
            .finally(() => {
              if (!mail.isCurrent()) return

              if (!cancelled) {
                setMessagesLoading(false)
                skipInitialMessagesEffectRef.current = false
              }
            })
        }
      })
      .catch((e) => {
        if (!mail.isCurrent() || isAbortError(e)) return

        if (!cancelled)
          toast.error(
            e instanceof Error ? e.message : 'Erro ao carregar pastas'
          )
      })
      .finally(() => {
        if (!mail.isCurrent()) return

        if (!cancelled) setFoldersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mail, connected, accountId])

  useEffect(() => {
    if (!accountId || !selectedFolderId) {
      setMessages([])
      setSelectedMessageId(null)
      setHasMoreMessages(false)
      setSelectionMode(false)
      setSelectedIds([])
      return
    }
    if (skipInitialMessagesEffectRef.current) return
    let cancelled = false
    setMessagesLoading(true)
    setMessages([])
    setSelectedMessageId(null)
    setCurrentMessage(null)
    setSelectionMode(false)
    setSelectedIds([])
    mail
      .request(
        `/api/admin/zoho-mail/messages?accountId=${accountId}&folderId=${selectedFolderId}&limit=50&start=0`
      )
      .then(async (res) => {
        mail.assertCurrent()

        const data = await res.json().catch(() => {
          mail.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Erro ao carregar mensagens'
          )
        }
        return data as { messages?: unknown[] }
      })
      .then((d) => {
        mail.assertCurrent()

        if (cancelled) return
        const raw = Array.isArray(d.messages) ? d.messages : []
        const list = normalizeEmailMessages(raw)
        setMessages(list)
        setHasMoreMessages(raw.length >= 50)
      })
      .catch((e) => {
        if (!mail.isCurrent() || isAbortError(e)) return

        if (!cancelled)
          toast.error(
            e instanceof Error ? e.message : 'Erro ao carregar mensagens'
          )
      })
      .finally(() => {
        if (!mail.isCurrent()) return

        if (!cancelled) setMessagesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mail, accountId, selectedFolderId])

  // Polling: verificar novos emails e atualizar contadores a cada 60 segundos
  useEffect(() => {
    if (!connected || !accountId) return
    const POLLING_INTERVAL = 60000

    const checkForUpdates = async () => {
      try {
        const foldersRes = await mail.request(
          `/api/admin/zoho-mail/folders?accountId=${accountId}`
        )
        if (foldersRes.ok) {
          const foldersData = (await foldersRes.json()) as {
            folders?: unknown[]
          }
          const raw = Array.isArray(foldersData.folders)
            ? foldersData.folders
            : []
          const normalized = normalizeEmailFolders(raw)

          const currentInbox = foldersRef.current.find((f) =>
            isInboxFolder(f.folderName)
          )
          const newInbox = normalized.find((f) => isInboxFolder(f.folderName))
          const currentUnread = currentInbox?.unreadCount ?? 0
          const newUnread = newInbox?.unreadCount ?? 0

          if (newUnread > currentUnread) {
            const diff = newUnread - currentUnread
            toast.info(
              `${diff} ${diff === 1 ? 'novo email' : 'novos emails'} na caixa de entrada`,
              { duration: 5000 }
            )
          }

          setFolders(normalized)
        }
      } catch {
        // Silencioso - polling não deve mostrar erros
      }
    }

    const interval = setInterval(checkForUpdates, POLLING_INTERVAL)
    return () => clearInterval(interval)
  }, [mail, connected, accountId])

  // --- Callbacks ---

  const handleDateRangeChange = useCallback(
    (start: Date | null, end: Date | null) => {
      setDateStart(start)
      setDateEnd(end)
    },
    []
  )

  const handleResetFilters = useCallback(() => {
    setDateStart(null)
    setDateEnd(null)
    setSearchQuery('')
    setQuickFilter('all')
  }, [])

  const handleRefreshMessages = useCallback(() => {
    if (!accountId || !selectedFolderId || messagesLoading) return
    setMessagesLoading(true)
    setMessages([])
    setSelectedMessageId(null)
    setCurrentMessage(null)
    mailbox
      .request(
        `/api/admin/zoho-mail/messages?accountId=${accountId}&folderId=${selectedFolderId}&limit=50&start=0`
      )
      .then(async (res) => {
        mailbox.assertCurrent()

        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Erro ao atualizar mensagens'
          )
        }
        return data as { messages?: unknown[] }
      })
      .then((d) => {
        mailbox.assertCurrent()

        const raw = Array.isArray(d.messages) ? d.messages : []
        const list = normalizeEmailMessages(raw)
        setMessages(list)
        setHasMoreMessages(raw.length >= 50)
        toast.success('Mensagens atualizadas')
      })
      .catch((e) => {
        if (!mailbox.isCurrent()) return
        return toast.error(
          e instanceof Error ? e.message : 'Erro ao atualizar mensagens'
        )
      })
      .finally(() => {
        if (!mailbox.isCurrent()) return
        return setMessagesLoading(false)
      })
  }, [mailbox, accountId, selectedFolderId, messagesLoading])

  const handleLoadMore = useCallback(() => {
    if (
      !accountId ||
      !selectedFolderId ||
      messagesLoadMoreLoading ||
      !hasMoreMessages
    )
      return
    setMessagesLoadMoreLoading(true)
    const start = messages.length
    mailbox
      .request(
        `/api/admin/zoho-mail/messages?accountId=${accountId}&folderId=${selectedFolderId}&limit=50&start=${start}`
      )
      .then(async (res) => {
        mailbox.assertCurrent()

        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(
            typeof (data as { error?: string })?.error === 'string'
              ? (data as { error: string }).error
              : 'Erro ao carregar mais mensagens'
          )
        }
        return data as { messages?: unknown[] }
      })
      .then((d) => {
        mailbox.assertCurrent()

        const raw = Array.isArray(d.messages) ? d.messages : []
        const list = normalizeEmailMessages(raw)
        setMessages((prev) => [...prev, ...list])
        setHasMoreMessages(raw.length >= 50)
      })
      .catch((e) => {
        if (!mailbox.isCurrent()) return
        return toast.error(
          e instanceof Error ? e.message : 'Erro ao carregar mais mensagens'
        )
      })
      .finally(() => {
        if (!mailbox.isCurrent()) return
        return setMessagesLoadMoreLoading(false)
      })
  }, [
    mailbox,
    accountId,
    selectedFolderId,
    messages.length,
    messagesLoadMoreLoading,
    hasMoreMessages,
  ])

  const handleSelectMessage = useCallback(
    (messageId: string) => {
      const cycle = ++selectionCycle.current

      if (!messageId || messageId.trim() === '') {
        setSelectedMessageId(null)
        setCurrentMessage(null)
        setMessageLoading(false)
        return
      }
      if (!accountId || !selectedFolderId) return
      setSelectedMessageId(messageId)
      setMessageLoading(true)
      setCurrentMessage(null)

      const messageInList = messagesRef.current.find(
        (m) => m.messageId === messageId
      )
      if (messageInList?.isRead === false) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === messageId ? { ...m, isRead: true } : m
          )
        )
        const body: {
          messageIds: string[]
          action: 'read'
          threadIds?: string[]
        } = {
          messageIds: [messageId],
          action: 'read',
        }
        if (messageInList.threadId) body.threadIds = [messageInList.threadId]
        mailbox
          .request('/api/admin/zoho-mail/messages/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          .catch(() => {
            if (!mailbox.isCurrent() || selectionCycle.current !== cycle) return

            // Silencioso
          })
      }

      mailbox
        .request(
          `/api/admin/zoho-mail/messages/${messageId}?accountId=${accountId}&folderId=${selectedFolderId}`
        )
        .then(async (res) => {
          mailbox.assertCurrent()
          if (selectionCycle.current !== cycle) return

          const data = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          if (!res.ok) {
            throw new Error(
              typeof (data as { error?: string })?.error === 'string'
                ? (data as { error: string }).error
                : 'Erro ao carregar mensagem'
            )
          }
          return data as { message?: unknown }
        })
        .then((d) => {
          mailbox.assertCurrent()

          if (selectionCycle.current !== cycle) return
          if (!d) return
          const msg = d.message ?? null
          const parsedMsg =
            msg != null &&
            typeof msg === 'object' &&
            typeof (msg as EmailViewerMessage).messageId === 'string'
              ? (msg as EmailViewerMessage)
              : null
          if (parsedMsg) {
            parsedMsg.isRead = true
          }
          setCurrentMessage(parsedMsg)
        })
        .catch((e) => {
          if (
            !mailbox.isCurrent() ||
            isAbortError(e) ||
            selectionCycle.current !== cycle
          )
            return

          toast.error(
            e instanceof Error ? e.message : 'Erro ao carregar mensagem'
          )
        })
        .finally(() => {
          if (!mailbox.isCurrent()) return

          setMessageLoading(false)
        })
    },
    [mailbox, accountId, selectedFolderId]
  )

  const handleArchiveMessage = useCallback(
    async (messageId: string) => {
      if (!messageId) return
      setMessages((prev) => {
        const msg = prev.find((m) => m.messageId === messageId)
        if (msg) removedMessagesForRevertRef.current.set(messageId, msg)
        return prev.filter((m) => m.messageId !== messageId)
      })
      setCurrentMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      setSelectedMessageId((prev) => (prev === messageId ? null : prev))
      if (fullViewMessageRef.current?.messageId === messageId) {
        setIsFullViewOpen(false)
      }
      setFullViewMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      toast.success('Mensagem arquivada')
      try {
        const res = await mailbox.request(
          '/api/admin/zoho-mail/messages/update',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messageIds: [messageId],
              action: 'archive',
            }),
          }
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          const toRestore = removedMessagesForRevertRef.current.get(messageId)
          if (toRestore) {
            setMessages((prev) => [...prev, toRestore])
            removedMessagesForRevertRef.current.delete(messageId)
          }
          toast.error(
            errorData.error || 'Erro ao arquivar mensagem. Tente novamente.'
          )
        } else {
          removedMessagesForRevertRef.current.delete(messageId)
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao arquivar mensagem:', error)
        const toRestore = removedMessagesForRevertRef.current.get(messageId)
        if (toRestore) {
          setMessages((prev) => [...prev, toRestore])
          removedMessagesForRevertRef.current.delete(messageId)
        }
        toast.error(
          'Erro de conexão ao arquivar mensagem. Verifique sua internet e tente novamente.'
        )
      }
    },
    [mailbox]
  )

  const handleUnarchiveMessage = useCallback(
    async (messageId: string) => {
      if (!messageId || !inboxFolderId) {
        toast.error('Não foi possível identificar a Caixa de entrada.')
        return
      }
      setMessages((prev) => {
        const msg = prev.find((m) => m.messageId === messageId)
        if (msg) removedMessagesForRevertRef.current.set(messageId, msg)
        return prev.filter((m) => m.messageId !== messageId)
      })
      setCurrentMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      setSelectedMessageId((prev) => (prev === messageId ? null : prev))
      if (fullViewMessageRef.current?.messageId === messageId) {
        setIsFullViewOpen(false)
      }
      setFullViewMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      toast.success('Mensagem desarquivada (voltou para a Caixa de entrada)')
      try {
        const res = await mailbox.request(
          '/api/admin/zoho-mail/messages/update',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messageIds: [messageId],
              action: 'move',
              targetFolderId: inboxFolderId,
            }),
          }
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          const toRestore = removedMessagesForRevertRef.current.get(messageId)
          if (toRestore) {
            setMessages((prev) => [...prev, toRestore])
            removedMessagesForRevertRef.current.delete(messageId)
          }
          toast.error(
            errorData.error || 'Erro ao desarquivar mensagem. Tente novamente.'
          )
        } else {
          removedMessagesForRevertRef.current.delete(messageId)
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao desarquivar mensagem:', error)
        const toRestore = removedMessagesForRevertRef.current.get(messageId)
        if (toRestore) {
          setMessages((prev) => [...prev, toRestore])
          removedMessagesForRevertRef.current.delete(messageId)
        }
        toast.error(
          'Erro de conexão ao desarquivar mensagem. Verifique sua internet e tente novamente.'
        )
      }
    },
    [mailbox, inboxFolderId]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!messageId || !accountId || !selectedFolderId) return
      if (isTrashFolder) {
        setPendingDeleteFromTrashIds([messageId])
        setShowDeleteFromTrashConfirm(true)
        return
      }
      setMessages((prev) => {
        const msg = prev.find((m) => m.messageId === messageId)
        if (msg) removedMessagesForRevertRef.current.set(messageId, msg)
        return prev.filter((m) => m.messageId !== messageId)
      })
      setCurrentMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      setSelectedMessageId((prev) => (prev === messageId ? null : prev))
      if (fullViewMessageRef.current?.messageId === messageId) {
        setIsFullViewOpen(false)
      }
      setFullViewMessage((prev) =>
        prev && prev.messageId === messageId ? null : prev
      )
      toast.success('Mensagem excluída')
      try {
        const res = await mailbox.request(
          `/api/admin/zoho-mail/messages/${messageId}/delete?accountId=${accountId}&folderId=${selectedFolderId}`,
          { method: 'DELETE' }
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          const toRestore = removedMessagesForRevertRef.current.get(messageId)
          if (toRestore) {
            setMessages((prev) => [...prev, toRestore])
            removedMessagesForRevertRef.current.delete(messageId)
          }
          toast.error(
            errorData.error || 'Erro ao excluir mensagem. Tente novamente.'
          )
        } else {
          removedMessagesForRevertRef.current.delete(messageId)
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao excluir mensagem:', error)
        const toRestore = removedMessagesForRevertRef.current.get(messageId)
        if (toRestore) {
          setMessages((prev) => [...prev, toRestore])
          removedMessagesForRevertRef.current.delete(messageId)
        }
        toast.error(
          'Erro de conexão ao excluir mensagem. Verifique sua internet e tente novamente.'
        )
      }
    },
    [mailbox, accountId, selectedFolderId, isTrashFolder]
  )

  const executeDeleteByIds = useCallback(
    async (ids: string[], options?: { expunge?: boolean }) => {
      if (ids.length === 0 || !accountId || !selectedFolderId) return
      const expunge = options?.expunge === true
      const query =
        `accountId=${accountId}&folderId=${selectedFolderId}` +
        (expunge ? '&expunge=true' : '')
      try {
        let ok = 0
        for (const id of ids) {
          const res = await mailbox.request(
            `/api/admin/zoho-mail/messages/${id}/delete?${query}`,
            { method: 'DELETE' }
          )
          if (res.ok) ok++
        }
        if (ok > 0) {
          toast.success(`${ok} mensagem(ns) excluída(s)`)
          setMessages((prev) => prev.filter((m) => !ids.includes(m.messageId)))
          setSelectedIds([])
          setSelectionMode(false)
          const selId = selectedMessageIdRef.current
          if (selId && ids.includes(selId)) {
            setCurrentMessage(null)
            setSelectedMessageId(null)
          }
          if (
            fullViewMessageRef.current &&
            ids.includes(fullViewMessageRef.current.messageId)
          ) {
            setIsFullViewOpen(false)
          }
          setFullViewMessage((prev) =>
            prev && ids.includes(prev.messageId) ? null : prev
          )
        } else {
          toast.error('Erro ao excluir. Tente novamente.')
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao excluir em massa:', error)
        toast.error('Erro ao excluir. Tente novamente.')
      }
    },
    [mailbox, accountId, selectedFolderId]
  )

  const handleBulkDelete = useCallback(async () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    if (isTrashFolder) {
      setPendingDeleteFromTrashIds(ids)
      setShowDeleteFromTrashConfirm(true)
      return
    }
    setIsBulkDeleting(true)
    try {
      await executeDeleteByIds(ids)
    } finally {
      if (mailbox.isCurrent()) {
        setIsBulkDeleting(false)
      }
    }
  }, [mailbox, isTrashFolder, executeDeleteByIds])

  const handleConfirmDeleteFromTrash = useCallback(async () => {
    const ids = [...pendingDeleteFromTrashIds]
    if (ids.length === 0) {
      setShowDeleteFromTrashConfirm(false)
      setPendingDeleteFromTrashIds([])
      return
    }
    setIsDeletingFromTrash(true)
    try {
      await executeDeleteByIds(ids, { expunge: true })
      setShowDeleteFromTrashConfirm(false)
      setPendingDeleteFromTrashIds([])
    } finally {
      if (mailbox.isCurrent()) {
        setIsDeletingFromTrash(false)
      }
    }
  }, [mailbox, pendingDeleteFromTrashIds, executeDeleteByIds])

  const handleMessageUpdateById = useCallback(
    async (
      messageId: string,
      action: 'read' | 'unread' | 'star' | 'unstar'
    ) => {
      if (!messageId) return
      const isRead =
        action === 'read' ? true : action === 'unread' ? false : undefined
      const isStarred =
        action === 'star' ? true : action === 'unstar' ? false : undefined
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === messageId
            ? {
                ...m,
                ...(isRead !== undefined && { isRead }),
                ...(isStarred !== undefined && { isStarred }),
              }
            : m
        )
      )
      setCurrentMessage((prev) =>
        prev && prev.messageId === messageId
          ? {
              ...prev,
              ...(isRead !== undefined && { isRead }),
              ...(isStarred !== undefined && { isStarred }),
            }
          : prev
      )
      setFullViewMessage((prev) =>
        prev && prev.messageId === messageId
          ? {
              ...prev,
              ...(isRead !== undefined && { isRead }),
              ...(isStarred !== undefined && { isStarred }),
            }
          : prev
      )
      if (action === 'read') toast.success('Marcado como lido')
      else if (action === 'unread') toast.success('Marcado como não lido')
      else if (action === 'star') toast.success('Mensagem destacada')
      else if (action === 'unstar') toast.success('Destaque removido')
      const messageInList = messagesRef.current.find(
        (m) => m.messageId === messageId
      )
      const body: {
        messageIds: string[]
        action: string
        threadIds?: string[]
      } = {
        messageIds: [messageId],
        action,
      }
      if (messageInList?.threadId) body.threadIds = [messageInList.threadId]
      try {
        const res = await mailbox.request(
          '/api/admin/zoho-mail/messages/update',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          const revertRead =
            action === 'read' ? false : action === 'unread' ? true : undefined
          const revertStarred =
            action === 'star' ? false : action === 'unstar' ? true : undefined
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === messageId
                ? {
                    ...m,
                    ...(revertRead !== undefined && { isRead: revertRead }),
                    ...(revertStarred !== undefined && {
                      isStarred: revertStarred,
                    }),
                  }
                : m
            )
          )
          setCurrentMessage((prev) =>
            prev && prev.messageId === messageId
              ? {
                  ...prev,
                  ...(revertRead !== undefined && { isRead: revertRead }),
                  ...(revertStarred !== undefined && {
                    isStarred: revertStarred,
                  }),
                }
              : prev
          )
          setFullViewMessage((prev) =>
            prev && prev.messageId === messageId
              ? {
                  ...prev,
                  ...(revertRead !== undefined && { isRead: revertRead }),
                  ...(revertStarred !== undefined && {
                    isStarred: revertStarred,
                  }),
                }
              : prev
          )
          toast.error(
            errorData.error || 'Erro ao atualizar mensagem. Tente novamente.'
          )
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao atualizar mensagem:', error)
        const revertRead =
          action === 'read' ? false : action === 'unread' ? true : undefined
        const revertStarred =
          action === 'star' ? false : action === 'unstar' ? true : undefined
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === messageId
              ? {
                  ...m,
                  ...(revertRead !== undefined && { isRead: revertRead }),
                  ...(revertStarred !== undefined && {
                    isStarred: revertStarred,
                  }),
                }
              : m
          )
        )
        setCurrentMessage((prev) =>
          prev && prev.messageId === messageId
            ? {
                ...prev,
                ...(revertRead !== undefined && { isRead: revertRead }),
                ...(revertStarred !== undefined && {
                  isStarred: revertStarred,
                }),
              }
            : prev
        )
        setFullViewMessage((prev) =>
          prev && prev.messageId === messageId
            ? {
                ...prev,
                ...(revertRead !== undefined && { isRead: revertRead }),
                ...(revertStarred !== undefined && {
                  isStarred: revertStarred,
                }),
              }
            : prev
        )
        toast.error(
          'Erro de conexão ao atualizar. Verifique sua internet e tente novamente.'
        )
      }
    },
    [mailbox]
  )

  const handleMarkRead = useCallback(() => {
    if (!selectedMessageId) return
    void handleMessageUpdateById(selectedMessageId, 'read')
  }, [selectedMessageId, handleMessageUpdateById])

  const handleStar = useCallback(() => {
    if (!selectedMessageId) return
    const msg = currentMessageRef.current ?? currentMessage
    const key = getSenderKey(msg)
    if (key) {
      setHighlightedSenderKeys((prev) => new Set(prev).add(key))
    }
    void handleMessageUpdateById(selectedMessageId, 'star')
  }, [selectedMessageId, currentMessage, handleMessageUpdateById])

  const handleUnstar = useCallback(() => {
    if (!selectedMessageId) return
    const msg = currentMessageRef.current ?? currentMessage
    const key = getSenderKey(msg)
    if (key) {
      setHighlightedSenderKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
    void handleMessageUpdateById(selectedMessageId, 'unstar')
  }, [selectedMessageId, currentMessage, handleMessageUpdateById])

  const handleDownloadAttachment = useCallback(
    async (attachmentId: string, fileName: string) => {
      if (!accountId || !selectedFolderId || !selectedMessageId) return
      const url = `/api/admin/zoho-mail/messages/${selectedMessageId}/attachments/${attachmentId}?accountId=${accountId}&folderId=${selectedFolderId}&filename=${encodeURIComponent(fileName)}`
      try {
        const res = await mailbox.download(url)
        if (!res.ok) {
          toast.error('Erro ao baixar anexo. Tente novamente.')
          return
        }
        const blob = await res.blob()
        await ports.download(blob, fileName || 'attachment', mailbox.isCurrent)
        mailbox.assertCurrent()
        toast.success('Anexo baixado')
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao baixar anexo:', error)
        toast.error('Erro ao baixar anexo. Tente novamente.')
      }
    },
    [mailbox, accountId, selectedFolderId, selectedMessageId, ports]
  )

  const handleToggleStar = useCallback(
    async (messageId: string, isStarred: boolean) => {
      const msgFromFull = messagesRef.current.find(
        (m) => m.messageId === messageId
      )
      const msgFromFiltered = filteredMessagesRef.current.find(
        (m) => m.messageId === messageId
      )
      const senderKey = getSenderKey(msgFromFiltered ?? msgFromFull ?? null)
      if (senderKey) {
        setHighlightedSenderKeys((prev) => {
          const next = new Set(prev)
          if (isStarred) next.add(senderKey)
          else next.delete(senderKey)
          return next
        })
      }
      setMessages((prev) =>
        prev.map((m) => (m.messageId === messageId ? { ...m, isStarred } : m))
      )
      setCurrentMessage((prev) =>
        prev && prev.messageId === messageId ? { ...prev, isStarred } : prev
      )
      setFullViewMessage((prev) =>
        prev && prev.messageId === messageId ? { ...prev, isStarred } : prev
      )
      toast.success(isStarred ? 'Mensagem destacada' : 'Destaque removido')
      try {
        const body: {
          messageIds: string[]
          action: string
          threadIds?: string[]
        } = {
          messageIds: [messageId],
          action: isStarred ? 'star' : 'unstar',
        }
        if (msgFromFull?.threadId) body.threadIds = [msgFromFull.threadId]
        const res = await mailbox.request(
          '/api/admin/zoho-mail/messages/update',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )
        if (!res.ok) {
          const errorData = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          const revertStarred = !isStarred
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === messageId ? { ...m, isStarred: revertStarred } : m
            )
          )
          setCurrentMessage((prev) =>
            prev && prev.messageId === messageId
              ? { ...prev, isStarred: revertStarred }
              : prev
          )
          setFullViewMessage((prev) =>
            prev && prev.messageId === messageId
              ? { ...prev, isStarred: revertStarred }
              : prev
          )
          toast.error(
            errorData.error || 'Erro ao atualizar destaque. Tente novamente.'
          )
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao destacar mensagem:', error)
        const revertStarred = !isStarred
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === messageId ? { ...m, isStarred: revertStarred } : m
          )
        )
        setCurrentMessage((prev) =>
          prev && prev.messageId === messageId
            ? { ...prev, isStarred: revertStarred }
            : prev
        )
        setFullViewMessage((prev) =>
          prev && prev.messageId === messageId
            ? { ...prev, isStarred: revertStarred }
            : prev
        )
        toast.error('Erro de conexão. Tente novamente.')
      }
    },
    [mailbox]
  )

  const handleBulkMove = useCallback(
    async (targetFolderId: string) => {
      const ids = selectedIdsRef.current
      if (!targetFolderId || ids.length === 0) return
      try {
        const res = await mailbox.request(
          '/api/admin/zoho-mail/messages/update',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messageIds: ids,
              action: 'move',
              targetFolderId,
            }),
          }
        )
        if (res.ok) {
          toast.success(`${ids.length} mensagem(ns) movida(s)`)
          setMessages((prev) => prev.filter((m) => !ids.includes(m.messageId)))
          setSelectedIds([])
          setSelectionMode(false)
          const selId = selectedMessageIdRef.current
          if (selId && ids.includes(selId)) {
            setCurrentMessage(null)
            setSelectedMessageId(null)
          }
        } else {
          const data = await res.json().catch(() => {
            mailbox.assertCurrent()
            return {}
          })
          toast.error(data?.error || 'Erro ao mover mensagens')
        }
      } catch (error) {
        if (!mailbox.isCurrent() || isAbortError(error)) return

        console.error('[Email] Erro ao mover em massa:', error)
        toast.error('Erro ao mover mensagens. Tente novamente.')
      }
    },
    [mailbox]
  )

  const handleQuickToggleRead = useCallback(
    (messageId: string, isRead: boolean) => {
      void handleMessageUpdateById(messageId, isRead ? 'unread' : 'read')
    },
    [handleMessageUpdateById]
  )

  const handleExpandMessage = useCallback((message: EmailViewerMessage) => {
    setFullViewMessage(message)
    setIsFullViewOpen(true)
  }, [])

  const handleCloseFullView = useCallback(() => {
    setIsFullViewOpen(false)
    setFullViewMessage(null)
  }, [])

  const openComposerReply = useCallback(() => {
    const msg = currentMessage ?? fullViewMessage
    if (!msg) return
    const toAddr = msg.fromAddress?.emailAddress ?? ''
    const subj = (msg.subject ?? '').startsWith('Re:')
      ? (msg.subject ?? '')
      : `Re: ${msg.subject ?? ''}`
    setComposerMode('reply')
    setComposerMessageId(msg.messageId)
    setComposerDraftId(null)
    setComposerInitialTo(toAddr)
    setComposerInitialSubject(subj)
    setComposerInitialContent('')
    setComposerOpen(true)
  }, [currentMessage, fullViewMessage])

  const openComposerForward = useCallback(() => {
    const msg = currentMessage ?? fullViewMessage
    if (!msg) return
    const subj = (msg.subject ?? '').startsWith('Fwd:')
      ? (msg.subject ?? '')
      : `Fwd: ${msg.subject ?? ''}`
    const fromLabel =
      msg.fromAddress?.displayName ?? msg.fromAddress?.emailAddress ?? ''
    const raw = msg.content ?? msg.htmlContent ?? ''
    const plain = htmlToPlainTextForForward(raw)
    const quoted = `\n\n---------- Mensagem encaminhada ---------\nDe: ${fromLabel}\nAssunto: ${msg.subject ?? ''}\n\n${plain}`
    setComposerMode('forward')
    setComposerMessageId(null)
    setComposerDraftId(null)
    setComposerInitialTo('')
    setComposerInitialSubject(subj)
    setComposerInitialContent(quoted)
    setComposerOpen(true)
  }, [currentMessage, fullViewMessage])

  const openComposerNew = useCallback(() => {
    setComposerMode('new')
    setComposerMessageId(null)
    setComposerDraftId(null)
    setComposerInitialTo('')
    setComposerInitialSubject('')
    setComposerInitialContent('')
    setComposerOpen(true)
  }, [])

  const handleComposerSent = useCallback(() => {
    const draftId = draftMessageIdToRemoveOnSendRef.current
    if (draftId) {
      setMessages((prev) => prev.filter((m) => m.messageId !== draftId))
      setSelectedMessageId((prev) => (prev === draftId ? null : prev))
      setCurrentMessage((prev) => (prev?.messageId === draftId ? null : prev))
      setFullViewMessage((prev) => (prev?.messageId === draftId ? null : prev))
      draftMessageIdToRemoveOnSendRef.current = null
    }
    setComposerDraftId(null)
    toast.success('E-mail enviado com sucesso.')
  }, [])

  const handleSendDraft = useCallback(() => {
    const msg = currentMessage ?? fullViewMessage
    if (!msg) return
    let toAddr: string
    if (Array.isArray(msg.toAddress)) {
      toAddr = msg.toAddress
        .map((a) => (a.emailAddress ?? a.displayName ?? '').trim())
        .filter(Boolean)
        .join(', ')
    } else if (typeof msg.toAddress === 'string') {
      toAddr = (msg.toAddress as string).trim()
    } else if (
      msg.toAddress &&
      typeof msg.toAddress === 'object' &&
      !Array.isArray(msg.toAddress)
    ) {
      const a = msg.toAddress as {
        emailAddress?: string
        displayName?: string
      }
      toAddr = (a.emailAddress ?? a.displayName ?? '').trim()
    } else {
      toAddr = ''
    }
    if (!toAddr) {
      toast.error(
        'Rascunho sem destinatário válido. Preencha o campo Para antes de enviar.'
      )
      return
    }
    const content = (msg.htmlContent ?? msg.content ?? '').replace(
      /<[^>]+>/g,
      ''
    )
    draftMessageIdToRemoveOnSendRef.current = msg.messageId
    setComposerMode('new')
    setComposerMessageId(null)
    setComposerDraftId(msg.messageId)
    setComposerInitialTo(toAddr)
    setComposerInitialSubject(msg.subject ?? '')
    setComposerInitialContent(content)
    setComposerOpen(true)
  }, [currentMessage, fullViewMessage])

  const handleDraftSaved = useCallback((draftId: string | null) => {
    setComposerDraftId(draftId)
    if (draftId) {
      draftMessageIdToRemoveOnSendRef.current = draftId
    }
  }, [])

  const handleToggleSelect = useCallback((messageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    )
  }, [])
  const handleSelectAll = useCallback(() => {
    setSelectedIds(filteredMessagesRef.current.map((m) => m.messageId))
  }, [])
  const handleClearSelection = useCallback(() => {
    setSelectedIds([])
    setSelectionMode(false)
  }, [])
  const handleBulkArchive = useCallback(async () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    try {
      const res = await mailbox.request(
        '/api/admin/zoho-mail/messages/update',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageIds: ids,
            action: 'archive',
          }),
        }
      )
      if (res.ok) {
        toast.success(`${ids.length} mensagem(ns) arquivada(s)`)
        setMessages((prev) => prev.filter((m) => !ids.includes(m.messageId)))
        setSelectedIds([])
        setSelectionMode(false)
        const selId = selectedMessageIdRef.current
        if (selId && ids.includes(selId)) {
          setCurrentMessage(null)
          setSelectedMessageId(null)
        }
      } else {
        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        toast.error(data?.error || 'Erro ao arquivar')
      }
    } catch (error) {
      if (!mailbox.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao arquivar em massa:', error)
      toast.error('Erro ao arquivar. Tente novamente.')
    }
  }, [mailbox])
  const handleBulkMarkRead = useCallback(async () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    const fullList = messagesRef.current
    const threadIds = [
      ...new Set(
        ids
          .map((id) => fullList.find((m) => m.messageId === id)?.threadId)
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
      ),
    ]
    const body: {
      messageIds: string[]
      action: 'read'
      threadIds?: string[]
    } = {
      messageIds: ids,
      action: 'read',
    }
    if (threadIds.length > 0) body.threadIds = threadIds
    try {
      const res = await mailbox.request(
        '/api/admin/zoho-mail/messages/update',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (res.ok) {
        toast.success(`${ids.length} marcada(s) como lida(s)`)
        setMessages((prev) =>
          prev.map((m) =>
            ids.includes(m.messageId) ? { ...m, isRead: true } : m
          )
        )
        setSelectedIds([])
        setSelectionMode(false)
        const cur = currentMessageRef.current
        if (cur && ids.includes(cur.messageId)) {
          setCurrentMessage((prev) => (prev ? { ...prev, isRead: true } : null))
        }
      } else {
        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        toast.error(data?.error || 'Erro ao marcar como lido')
      }
    } catch (error) {
      if (!mailbox.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao marcar como lido:', error)
      toast.error('Erro. Tente novamente.')
    }
  }, [mailbox])

  const handleMarkSpam = useCallback(() => {
    const messageId = selectedMessageIdRef.current
    if (!messageId) return
    setPendingSpamIds([messageId])
    setShowSpamConfirm(true)
  }, [])

  const handleMarkNotSpam = useCallback(async () => {
    const messageId = selectedMessageIdRef.current
    if (!messageId || !inboxFolderId) {
      toast.error('Não foi possível identificar a Caixa de entrada.')
      return
    }
    setMessages((prev) => {
      const msg = prev.find((m) => m.messageId === messageId)
      if (msg) removedMessagesForRevertRef.current.set(messageId, msg)
      return prev.filter((m) => m.messageId !== messageId)
    })
    setCurrentMessage((prev) =>
      prev && prev.messageId === messageId ? null : prev
    )
    setSelectedMessageId((prev) => (prev === messageId ? null : prev))
    if (fullViewMessageRef.current?.messageId === messageId) {
      setIsFullViewOpen(false)
    }
    setFullViewMessage((prev) =>
      prev && prev.messageId === messageId ? null : prev
    )
    toast.success(
      'Mensagem marcada como não spam (voltou para Caixa de entrada)'
    )
    try {
      const res = await mailbox.request(
        '/api/admin/zoho-mail/messages/update',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageIds: [messageId],
            action: 'notspam',
          }),
        }
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        const toRestore = removedMessagesForRevertRef.current.get(messageId)
        if (toRestore) {
          setMessages((prev) => [...prev, toRestore])
          removedMessagesForRevertRef.current.delete(messageId)
        }
        toast.error(
          errorData.error || 'Erro ao marcar como não spam. Tente novamente.'
        )
      } else {
        removedMessagesForRevertRef.current.delete(messageId)
      }
    } catch (error) {
      if (!mailbox.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao marcar como não spam:', error)
      const toRestore = removedMessagesForRevertRef.current.get(messageId)
      if (toRestore) {
        setMessages((prev) => [...prev, toRestore])
        removedMessagesForRevertRef.current.delete(messageId)
      }
      toast.error('Erro de conexão. Tente novamente.')
    }
  }, [mailbox, inboxFolderId])

  const handleBulkSpam = useCallback(() => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    setPendingSpamIds([...ids])
    setShowSpamConfirm(true)
  }, [])

  const handleConfirmSpam = useCallback(async () => {
    const ids = [...pendingSpamIds]
    if (ids.length === 0) {
      setShowSpamConfirm(false)
      setPendingSpamIds([])
      return
    }
    setIsMarkingSpam(true)
    try {
      const res = await mailbox.request(
        '/api/admin/zoho-mail/messages/update',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageIds: ids,
            action: 'spam',
          }),
        }
      )
      if (res.ok) {
        toast.success(`${ids.length} mensagem(ns) denunciada(s) como spam`)
        setMessages((prev) => prev.filter((m) => !ids.includes(m.messageId)))
        setSelectedIds([])
        setSelectionMode(false)
        const selId = selectedMessageIdRef.current
        if (selId && ids.includes(selId)) {
          setCurrentMessage(null)
          setSelectedMessageId(null)
        }
        if (
          fullViewMessageRef.current &&
          ids.includes(fullViewMessageRef.current.messageId)
        ) {
          setIsFullViewOpen(false)
        }
        setFullViewMessage((prev) =>
          prev && ids.includes(prev.messageId) ? null : prev
        )
        setShowSpamConfirm(false)
        setPendingSpamIds([])
      } else {
        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        toast.error(data?.error || 'Erro ao denunciar spam')
      }
    } catch (error) {
      if (!mailbox.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao denunciar spam em massa:', error)
      toast.error('Erro ao denunciar spam. Tente novamente.')
    } finally {
      if (mailbox.isCurrent()) {
        setIsMarkingSpam(false)
      }
    }
  }, [mailbox, pendingSpamIds])

  const handleBulkNotSpam = useCallback(async () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    try {
      const res = await mailbox.request(
        '/api/admin/zoho-mail/messages/update',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageIds: ids,
            action: 'notspam',
          }),
        }
      )
      if (res.ok) {
        toast.success(`${ids.length} mensagem(ns) marcada(s) como não spam`)
        setMessages((prev) => prev.filter((m) => !ids.includes(m.messageId)))
        setSelectedIds([])
        setSelectionMode(false)
        const selId = selectedMessageIdRef.current
        if (selId && ids.includes(selId)) {
          setCurrentMessage(null)
          setSelectedMessageId(null)
        }
        if (
          fullViewMessageRef.current &&
          ids.includes(fullViewMessageRef.current.messageId)
        ) {
          setIsFullViewOpen(false)
        }
        setFullViewMessage((prev) =>
          prev && ids.includes(prev.messageId) ? null : prev
        )
      } else {
        const data = await res.json().catch(() => {
          mailbox.assertCurrent()
          return {}
        })
        toast.error(data?.error || 'Erro ao marcar como não spam')
      }
    } catch (error) {
      if (!mailbox.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao marcar como não spam em massa:', error)
      toast.error('Erro. Tente novamente.')
    }
  }, [mailbox])

  const handleClearMessage = useCallback(() => {
    setSelectedMessageId(null)
    setCurrentMessage(null)
    setMessageLoading(false)
  }, [])

  const focusSearchInput = useCallback(() => {
    ports.focusSearch(searchInputId)
  }, [searchInputId, ports])

  const selectAdjacentMessage = useCallback(
    (direction: 'next' | 'prev') => {
      const list = filteredMessagesRef.current
      if (list.length === 0) return
      const currentId = selectedMessageIdRef.current
      const currentIndex = currentId
        ? list.findIndex((msg) => msg.messageId === currentId)
        : -1
      const fallbackIndex = direction === 'next' ? 0 : list.length - 1
      const nextIndex =
        currentIndex === -1
          ? fallbackIndex
          : direction === 'next'
            ? Math.min(currentIndex + 1, list.length - 1)
            : Math.max(currentIndex - 1, 0)
      const nextId = list[nextIndex]?.messageId
      if (nextId) handleSelectMessage(nextId)
    },
    [handleSelectMessage]
  )

  // --- Connect / Disconnect ---
  const handleConnect = useCallback(() => {
    void ports.connect()
  }, [ports])

  const handleDisconnect = useCallback(async () => {
    try {
      const res = await mail.request('/api/admin/zoho-mail/oauth/disconnect', {
        method: 'DELETE',
      })
      if (res.ok) {
        setConnected(false)
        setAccounts([])
        setFolders([])
        setMessages([])
        setCurrentMessage(null)
        toast.success('Zoho Mail desconectado.')
      } else {
        const errorData = await res.json().catch(() => {
          mail.assertCurrent()
          return {}
        })
        toast.error(errorData.error || 'Falha ao desconectar. Tente novamente.')
      }
    } catch (error) {
      if (!mail.isCurrent() || isAbortError(error)) return

      console.error('[Email] Erro ao desconectar Zoho Mail:', error)
      toast.error(
        'Erro de conexão ao desconectar. Verifique sua internet e tente novamente.'
      )
    }
  }, [mail])

  return {
    // Loading & connection
    loading,
    connected,
    error,
    accountLabel,
    primaryEmail,

    // Folders
    folders,
    selectedFolderId,
    setSelectedFolderId,
    foldersLoading,
    isArchiveFolder,
    isTrashFolder,
    isSpamFolder,
    isDraftFolder,
    draftFolderId,
    moveFolderOptions,

    // Messages
    filteredMessages,
    selectedMessageId,
    messagesLoading,
    messagesLoadMoreLoading,
    hasMoreMessages,
    currentMessage,
    messageLoading,
    highlightedSenderKeys,

    // Full view
    isFullViewOpen,
    fullViewMessage,
    handleExpandMessage,
    handleCloseFullView,

    // Composer
    composerOpen,
    setComposerOpen,
    composerMode,
    composerMessageId,
    composerDraftId,
    composerInitialTo,
    composerInitialSubject,
    composerInitialContent,
    openComposerNew,
    openComposerReply,
    openComposerForward,
    handleComposerSent,
    handleDraftSaved,
    handleSendDraft,

    // Search & filters
    searchQuery,
    setSearchQuery,
    quickFilter,
    setQuickFilter,
    dateStart,
    dateEnd,
    handleDateRangeChange,
    handleResetFilters,
    searchInputId,

    // Selection & bulk ops
    selectionMode,
    setSelectionMode,
    selectedIds,
    handleToggleSelect,
    handleSelectAll,
    handleClearSelection,
    handleBulkArchive,
    handleBulkDelete,
    isBulkDeleting,
    handleBulkMarkRead,
    handleBulkSpam,
    handleBulkNotSpam,
    handleBulkMove,

    // Message actions
    handleSelectMessage,
    handleRefreshMessages,
    handleLoadMore,
    handleArchiveMessage,
    handleUnarchiveMessage,
    handleDeleteMessage,
    handleMarkRead,
    handleStar,
    handleUnstar,
    handleToggleStar,
    handleQuickToggleRead,
    handleDownloadAttachment,
    handleMarkSpam,
    handleMarkNotSpam,
    handleClearMessage,

    // Trash delete confirm
    showDeleteFromTrashConfirm,
    setShowDeleteFromTrashConfirm,
    pendingDeleteFromTrashIds,
    setPendingDeleteFromTrashIds,
    isDeletingFromTrash,
    handleConfirmDeleteFromTrash,

    // Spam confirm
    showSpamConfirm,
    setShowSpamConfirm,
    pendingSpamIds,
    setPendingSpamIds,
    isMarkingSpam,
    handleConfirmSpam,

    // Connect/disconnect
    handleConnect,
    handleDisconnect,

    selectAdjacentMessage,
    focusSearchInput,
    // Misc
    isMobile,
    getSenderKey: getSenderKey,
  }
}
