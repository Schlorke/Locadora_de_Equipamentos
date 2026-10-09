'use client'
import { useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '../../../shared/lib'
import { HIGHLIGHTED_SENDERS_STORAGE_KEY } from '../../../features/correio'
import { useEmailPage as useModel } from './carga'
import type { EmailPagePorts } from './ports'
const browser = {
  readHighlighted() {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(HIGHLIGHTED_SENDERS_STORAGE_KEY),
        arr = raw ? JSON.parse(raw) : null
      return Array.isArray(arr)
        ? arr.filter((v): v is string => typeof v === 'string')
        : []
    } catch {
      return []
    }
  },
  persistHighlighted(keys: string[]) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        HIGHLIGHTED_SENDERS_STORAGE_KEY,
        JSON.stringify(keys)
      )
    } catch {
      /* Preferência opcional; mantém o fallback existente. */
    }
  },
  download(blob: Blob, name: string) {
    const objectUrl = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = objectUrl
    a.download = name
    a.click()
    URL.revokeObjectURL(objectUrl)
  },
  focusSearch(id: string) {
    const input = document.getElementById(id) as HTMLInputElement | null
    if (input) {
      input.focus()
      input.select()
    }
  },
  connect() {
    window.location.href = '/api/admin/zoho-mail/oauth/authorize'
  },
}
export function useEmailPage() {
  const query = useSearchParams(),
    isMobile = useIsMobile(),
    ports = useMemo<EmailPagePorts>(
      () => ({ ...browser, query, isMobile }),
      [query, isMobile]
    )
  const model = useModel(ports)
  const {
    focusSearchInput,
    selectAdjacentMessage,
    openComposerReply,
    openComposerForward,
    handleArchiveMessage,
  } = model
  const selectedMessageIdRef = useRef(model.selectedMessageId)
  selectedMessageIdRef.current = model.selectedMessageId
  // --- Keyboard shortcuts ---
  const handlersRef = useRef({
    focusSearchInput,
    selectAdjacentMessage,
    openComposerReply,
    openComposerForward,
    handleArchiveMessage,
  })
  handlersRef.current = {
    focusSearchInput,
    selectAdjacentMessage,
    openComposerReply,
    openComposerForward,
    handleArchiveMessage,
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === '/' && !event.shiftKey) {
        event.preventDefault()
        handlersRef.current.focusSearchInput()
        return
      }

      if (event.key === 'j') {
        event.preventDefault()
        handlersRef.current.selectAdjacentMessage('next')
        return
      }

      if (event.key === 'k') {
        event.preventDefault()
        handlersRef.current.selectAdjacentMessage('prev')
        return
      }

      if (event.key === 'r') {
        event.preventDefault()
        handlersRef.current.openComposerReply()
        return
      }

      if (event.key === 'f') {
        event.preventDefault()
        handlersRef.current.openComposerForward()
        return
      }

      if (event.key === 'e') {
        event.preventDefault()
        const id = selectedMessageIdRef.current
        if (id) {
          void handlersRef.current.handleArchiveMessage(id)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return model
}
