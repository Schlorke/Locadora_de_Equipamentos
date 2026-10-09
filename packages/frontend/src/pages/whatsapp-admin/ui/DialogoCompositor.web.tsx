'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { MessageCircle, Send } from 'lucide-react'
import { useCallback } from 'react'
import { useReplyComposer } from '../model/use-reply-composer'

interface WhatsAppComposerDialogProps {
  isOpen: boolean
  onClose: () => void
  conversationLabel?: string
  onSend: (_text: string) => Promise<void>
  sending?: boolean
}

export function WhatsAppComposerDialog({
  isOpen,
  onClose,
  conversationLabel = 'Conversa',
  onSend,
  sending = false,
}: WhatsAppComposerDialogProps) {
  const { text, setText, handleSend } = useReplyComposer(
    onSend,
    onClose,
    sending
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup variant="default" className="max-w-md">
          <Dialog.Content>
            <Dialog.Header data-dialog-section="header">
              <Dialog.HeaderIcon>
                <MessageCircle className="h-4 w-4 text-green-600" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-lg font-semibold text-gray-800">
                Responder – {conversationLabel}
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar" />
            </Dialog.Header>
            <Dialog.Body>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-reply-body">Mensagem</Label>
                  <textarea
                    id="whatsapp-reply-body"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem…"
                    rows={4}
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    disabled={sending}
                  />
                </div>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={sending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={!text.trim() || sending}
                className="bg-green-600 hover:bg-green-700"
              >
                {sending ? (
                  'Enviando…'
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
