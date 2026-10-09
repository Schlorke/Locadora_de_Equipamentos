'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createMailApi } from '../api/mail'
import { toast } from '../../../shared/lib/toast'
import type { EmailComposerDialogProps, ComposerAttachment } from './tipos'
import type { ComposerSelection, ComposerPorts } from './ports'
const MAX_FILE_SIZE_MB = 20
const MAX_TOTAL_SIZE_MB = 50
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_TOTAL_SIZE = MAX_TOTAL_SIZE_MB * 1024 * 1024

/** Valida formato básico de email. Suporta múltiplos emails separados por vírgula. */
function isValidEmailList(emailString: string): boolean {
  if (!emailString || typeof emailString !== 'string') return false
  const emails = emailString
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  if (emails.length === 0) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emails.every((email) => emailRegex.test(email))
}

export function useEmailComposer(
  {
    isOpen,
    onClose,
    mode,
    fromAddress,
    messageId,
    draftMessageId,
    draftFolderId,
    initialTo = '',
    initialSubject = '',
    initialContent = '',
    onSent,
    onDraftSaved,
  }: EmailComposerDialogProps,
  ports: ComposerPorts
) {
  const client = useScopedApiClient(
    JSON.stringify([
      isOpen,
      mode,
      messageId,
      fromAddress,
      initialTo,
      initialSubject,
      initialContent,
    ])
  )
  const mail = useMemo(() => createMailApi(client), [client])
  const [to, setTo] = useState(initialTo)
  const [cc, setCc] = useState('')
  const [showBcc, setShowBcc] = useState(false)
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [content, setContent] = useState(initialContent)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    draftMessageId ?? null
  )
  const [draftSaving, setDraftSaving] = useState(false)
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null)
  const [sending, setSending] = useState(false)
  const handleSaveDraftRef = useRef<(_silent?: boolean) => Promise<void>>(() =>
    Promise.resolve()
  )

  useEffect(() => {
    setSending(false)
    setUploading(false)
    setDraftSaving(false)
  }, [mail])

  // Confirmation dialog states
  const [showEmptySubjectConfirm, setShowEmptySubjectConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Reset form only when dialog opens or initial content changes (e.g. new/reply/forward).
  // Do NOT depend on draftMessageId: when a draft is auto-saved, parent updates draftMessageId
  // and we must not reset the form — only sync activeDraftId in a separate effect below.
  useEffect(() => {
    if (isOpen) {
      setTo(initialTo)
      setCc('')
      setShowBcc(false)
      setBcc('')
      setSubject(initialSubject)
      setContent(initialContent)
      setAttachments([])
      setActiveDraftId(draftMessageId ?? null)
      setDraftSaving(false)
      setLastDraftSavedAt(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftMessageId omitted on purpose: including it would reset the form when parent updates it after auto-save.
  }, [isOpen, initialTo, initialSubject, initialContent])

  // When parent passes updated draft id (e.g. after auto-save), update activeDraftId without
  // resetting form fields. Also clear when draftMessageId becomes null (e.g. cancel).
  useEffect(() => {
    if (isOpen) {
      setActiveDraftId(draftMessageId ?? null)
    }
  }, [isOpen, draftMessageId])

  const totalAttachmentSize = useMemo(
    () => attachments.reduce((sum, att) => sum + (att.size ?? 0), 0),
    [attachments]
  )

  const handleUploadAttachments = useCallback(
    async (selection: ComposerSelection) => {
      const files = selection.files
      if (files.length === 0) return

      // Frontend file size validation
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(
            `Arquivo "${file.name}" excede o limite de ${MAX_FILE_SIZE_MB} MB`
          )
          return
        }
      }
      const newTotal =
        totalAttachmentSize + files.reduce((s, f) => s + f.size, 0)
      if (newTotal > MAX_TOTAL_SIZE) {
        toast.error(
          `O total de anexos excederia o limite de ${MAX_TOTAL_SIZE_MB} MB`
        )
        return
      }

      setUploading(true)

      const formData = selection.multipart

      try {
        const res = await mail.request(
          '/api/admin/zoho-mail/attachments/upload',
          {
            method: 'POST',
            body: formData,
          }
        )
        const data = await res.json().catch(() => {
          mail.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(data?.error || 'Erro ao enviar anexos')
        }
        const incoming = Array.isArray(data?.attachments)
          ? (data.attachments as ComposerAttachment[])
          : []
        const normalized = incoming.filter(
          (att) =>
            att &&
            typeof att.storeName === 'string' &&
            typeof att.attachmentName === 'string' &&
            typeof att.attachmentPath === 'string'
        )
        if (normalized.length === 0) {
          throw new Error('Nenhum anexo válido retornado')
        }
        setAttachments((prev) => [...prev, ...normalized])
      } catch (e) {
        if (!mail.isCurrent() || isAbortError(e)) return

        toast.error(e instanceof Error ? e.message : 'Erro ao enviar anexos')
      } finally {
        if (mail.isCurrent()) {
          setUploading(false)
          ports.afterUpload()
        }
      }
    },
    [mail, totalAttachmentSize, ports]
  )

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const shouldSaveDraft = useMemo(() => {
    return Boolean(
      to.trim() ||
      cc.trim() ||
      bcc.trim() ||
      subject.trim() ||
      content.trim() ||
      attachments.length > 0
    )
  }, [to, cc, bcc, subject, content, attachments])

  const handleSaveDraft = useCallback(
    async (silent = false) => {
      if (!draftFolderId || !shouldSaveDraft || sending || uploading) return
      setDraftSaving(true)
      try {
        const attachmentPayload = attachments.map((att) => ({
          storeName: att.storeName,
          attachmentName: att.attachmentName,
          attachmentPath: att.attachmentPath,
        }))
        const res = await mail.request('/api/admin/zoho-mail/messages/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftFolderId,
            draftMessageId: activeDraftId,
            fromAddress,
            toAddress: to.trim() || undefined,
            ccAddress: cc.trim() || undefined,
            bccAddress: bcc.trim() || undefined,
            subject: subject.trim() || undefined,
            content: content.trim() || '',
            mailFormat: 'html',
            attachments:
              attachmentPayload.length > 0 ? attachmentPayload : undefined,
          }),
        })
        const data = await res.json().catch(() => {
          mail.assertCurrent()
          return {}
        })
        if (!res.ok) {
          throw new Error(data?.error || 'Erro ao salvar rascunho')
        }
        const nextDraftId =
          typeof data?.draftId === 'string' ? data.draftId : activeDraftId
        setActiveDraftId(nextDraftId ?? null)
        onDraftSaved?.(nextDraftId ?? null)
        setLastDraftSavedAt(new Date())
      } catch (e) {
        if (!mail.isCurrent() || isAbortError(e)) return

        if (!silent) {
          toast.error(
            e instanceof Error ? e.message : 'Erro ao salvar rascunho'
          )
        }
      } finally {
        if (mail.isCurrent()) {
          setDraftSaving(false)
        }
      }
    },
    [
      mail,
      draftFolderId,
      shouldSaveDraft,
      sending,
      uploading,
      attachments,
      activeDraftId,
      fromAddress,
      to,
      cc,
      bcc,
      subject,
      content,
      onDraftSaved,
    ]
  )
  handleSaveDraftRef.current = handleSaveDraft

  // Auto-save debounced: do NOT depend on handleSaveDraft (it changes every
  // keystroke and would clear/reset the timeout constantly). We depend only
  // on form fields so the timer resets 2.5s after last change; the ref ensures
  // the timeout callback invokes the latest save logic when it fires.
  useEffect(() => {
    if (!isOpen || !draftFolderId || !shouldSaveDraft) return
    const timeout = setTimeout(() => {
      void handleSaveDraftRef.current(true)
    }, 2500)
    return () => clearTimeout(timeout)
  }, [
    isOpen,
    draftFolderId,
    shouldSaveDraft,
    to,
    cc,
    bcc,
    subject,
    content,
    attachments,
  ])

  /**
   * Core send logic, separated so confirmation dialogs can call it
   * after user confirms empty subject or body.
   */
  const doSend = useCallback(
    async (opts?: { skipSubjectCheck?: boolean }) => {
      const toTrim = to.trim()
      if (!toTrim) {
        toast.error('Informe o e-mail do destinatário.')
        return
      }
      if (!isValidEmailList(toTrim)) {
        toast.error('O e-mail do destinatário é inválido.')
        return
      }
      if (cc.trim() && !isValidEmailList(cc.trim())) {
        toast.error('O e-mail no campo Cc é inválido.')
        return
      }
      if (bcc.trim() && !isValidEmailList(bcc.trim())) {
        toast.error('O e-mail no campo Cco é inválido.')
        return
      }
      if (!opts?.skipSubjectCheck && !subject.trim()) {
        setShowEmptySubjectConfirm(true)
        return
      }
      if (!content.trim()) {
        toast.error('Escreva uma mensagem antes de enviar.')
        return
      }

      setSending(true)

      const idempotencyKey = ports.uuid()
      const finalSubject = subject.trim() || '(sem assunto)'

      try {
        const attachmentPayload = attachments.map((att) => ({
          storeName: att.storeName,
          attachmentName: att.attachmentName,
          attachmentPath: att.attachmentPath,
        }))
        const commonBody = {
          fromAddress,
          toAddress: toTrim,
          subject: finalSubject,
          content: content.trim() || '',
          ccAddress: cc.trim() || undefined,
          bccAddress: bcc.trim() || undefined,
          mailFormat: 'html' as const,
          attachments:
            attachmentPayload.length > 0 ? attachmentPayload : undefined,
        }
        const headers = {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        }

        if (mode === 'reply' && messageId) {
          const res = await mail.request(
            `/api/admin/zoho-mail/messages/${messageId}/reply`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(commonBody),
            }
          )
          if (!res.ok) {
            const data = await res.json().catch(() => {
              mail.assertCurrent()
              return {}
            })
            throw new Error(data?.error || 'Erro ao enviar resposta')
          }
        } else {
          const res = await mail.request('/api/admin/zoho-mail/messages/send', {
            method: 'POST',
            headers,
            body: JSON.stringify(commonBody),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => {
              mail.assertCurrent()
              return {}
            })
            throw new Error(data?.error || 'Erro ao enviar e-mail')
          }
        }
        onSent?.()
        onClose()
      } catch (e) {
        if (!mail.isCurrent() || isAbortError(e)) return

        toast.error(e instanceof Error ? e.message : 'Erro ao enviar')
      } finally {
        if (mail.isCurrent()) {
          setSending(false)
        }
      }
    },
    [
      mail,
      mode,
      messageId,
      fromAddress,
      to,
      cc,
      bcc,
      subject,
      content,
      attachments,
      onSent,
      onClose,
      ports,
    ]
  )

  const handleSend = useCallback(() => {
    void doSend()
  }, [doSend])

  const handleCancel = useCallback(() => {
    if (shouldSaveDraft) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [shouldSaveDraft, onClose])

  const nestedDialogOpen = showEmptySubjectConfirm || showDiscardConfirm

  const title =
    mode === 'reply'
      ? 'Responder'
      : mode === 'forward'
        ? 'Encaminhar'
        : 'Novo e-mail'

  return {
    to,
    setTo,
    cc,
    setCc,
    showBcc,
    setShowBcc,
    bcc,
    setBcc,
    subject,
    setSubject,
    content,
    setContent,
    attachments,
    uploading,
    activeDraftId,
    draftSaving,
    lastDraftSavedAt,
    sending,
    showEmptySubjectConfirm,
    setShowEmptySubjectConfirm,
    showDiscardConfirm,
    setShowDiscardConfirm,
    totalAttachmentSize,
    handleUploadAttachments,
    handleRemoveAttachment,
    shouldSaveDraft,
    handleSaveDraft,
    doSend,
    handleSend,
    handleCancel,
    nestedDialogOpen,
    title,
    MAX_FILE_SIZE_MB,
    MAX_TOTAL_SIZE_MB,
    isCurrent: mail.isCurrent,
  }
}
