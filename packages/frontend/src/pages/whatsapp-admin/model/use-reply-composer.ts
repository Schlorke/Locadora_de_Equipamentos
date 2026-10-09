import { useCallback, useState } from 'react'
export function useReplyComposer(
  onSend: (text: string) => Promise<void>,
  onClose: () => void,
  sending: boolean
) {
  const [text, setText] = useState('')
  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    await onSend(trimmed)
    setText('')
    onClose()
  }, [text, sending, onSend, onClose])
  return { text, setText, handleSend }
}
