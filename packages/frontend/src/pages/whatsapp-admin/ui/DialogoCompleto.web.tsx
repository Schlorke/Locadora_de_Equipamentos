'use client'

import { Dialog } from '@gb-locacoes/ui'
import { MessageCircle } from 'lucide-react'
import { WhatsAppViewer } from './Visualizador.web'
import type { WhatsAppMessageItem } from './ListaMensagens.web'
import type { WhatsAppViewerConversation } from './Visualizador.web'

interface WhatsAppFullViewDialogProps {
  isOpen: boolean
  onClose: () => void
  conversation: WhatsAppViewerConversation | null
  messages: WhatsAppMessageItem[]
  onReply?: () => void
  onExpand?: () => void
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

export function WhatsAppFullViewDialog({
  isOpen,
  onClose,
  conversation,
  messages,
  onReply,
}: WhatsAppFullViewDialogProps) {
  const title = conversation
    ? `${conversation.displayName ?? formatPhoneDisplay(conversation.phone)} – WhatsApp`
    : 'Visualização Completa – WhatsApp'

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup variant="default" className="max-w-2xl h-[85vh]">
          <Dialog.Content className="relative h-full">
            <Dialog.Header data-dialog-section="header">
              <Dialog.HeaderIcon>
                <MessageCircle className="h-4 w-4 text-green-600" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-xl font-semibold text-gray-800 truncate pr-10">
                {title}
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar visualização completa" />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport style={{ scrollbarGutter: 'stable' }}>
                <Dialog.BodyContent>
                  <WhatsAppViewer
                    conversation={conversation}
                    messages={messages}
                    loading={false}
                    onReply={onReply}
                    onExpand={undefined}
                  />
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
