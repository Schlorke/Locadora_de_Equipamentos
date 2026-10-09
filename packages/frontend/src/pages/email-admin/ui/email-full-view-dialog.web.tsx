'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { EmailViewer, type EmailViewerMessage } from './email-viewer.web'
import { Mail, Reply, Forward, X, Star } from 'lucide-react'

interface EmailFullViewDialogProps {
  message: EmailViewerMessage | null
  isOpen: boolean
  onClose: () => void
  onReply?: () => void
  onForward?: () => void
  onDownloadAttachment?: (_attachmentId: string, _fileName: string) => void
  isDraftFolder?: boolean
  onSendDraft?: () => void
  /** Quando true, aplica o mecanismo nested: overlay escuro e recuo/animação na dialog pai. */
  nestedDialogOpen?: boolean
  /** Remetente destacado: exibe estrela amarela ao lado do título. */
  isSenderHighlighted?: boolean
  /** Handlers para o dropdown "Mais opções" no header da mensagem */
  onMarkRead?: () => void
  onMarkUnread?: () => void
  onStar?: () => void
  onUnstar?: () => void
  onArchive?: () => void
  onDelete?: () => void
  onMarkSpam?: () => void
  onMarkNotSpam?: () => void
  isSpamFolder?: boolean
  isArchiveFolder?: boolean
}

export function EmailFullViewDialog({
  message,
  isOpen,
  onClose,
  onReply,
  onForward,
  onDownloadAttachment,
  isDraftFolder = false,
  onSendDraft,
  nestedDialogOpen = false,
  isSenderHighlighted = false,
  onMarkRead,
  onMarkUnread,
  onStar,
  onUnstar,
  onArchive,
  onDelete,
  onMarkSpam,
  onMarkNotSpam,
  isSpamFolder = false,
  isArchiveFolder = false,
}: EmailFullViewDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-4xl h-[85vh]"
          data-nested-parent={nestedDialogOpen ? '' : undefined}
        >
          <Dialog.Content className="relative h-full">
            <Dialog.Header data-dialog-section="header">
              <Dialog.HeaderIcon>
                <Mail className="h-4 w-4" />
              </Dialog.HeaderIcon>
              <div className="flex min-w-0 flex-1 items-center gap-2 pr-10">
                {isSenderHighlighted && (
                  <Star
                    className="h-5 w-5 shrink-0 text-amber-500"
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden
                  />
                )}
                <Dialog.Title className="text-xl font-semibold text-gray-800 truncate">
                  {message
                    ? `${message.subject || '(Sem assunto)'}`
                    : 'Visualização Completa'}
                </Dialog.Title>
              </div>
              <Dialog.CloseButton aria-label="Fechar visualização completa" />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport style={{ scrollbarGutter: 'stable' }}>
                <Dialog.BodyContent>
                  {message ? (
                    <EmailViewer
                      message={message}
                      loading={false}
                      onReply={onReply}
                      onForward={onForward}
                      onDownloadAttachment={onDownloadAttachment}
                      isDraftFolder={isDraftFolder}
                      onSendDraft={onSendDraft}
                      embedMode
                      isSenderHighlighted={isSenderHighlighted}
                      onMarkRead={onMarkRead}
                      onMarkUnread={onMarkUnread}
                      onStar={onStar}
                      onUnstar={onUnstar}
                      onArchive={isArchiveFolder ? undefined : onArchive}
                      onDelete={onDelete}
                      onMarkSpam={onMarkSpam}
                      onMarkNotSpam={onMarkNotSpam}
                      isSpamFolder={isSpamFolder}
                    />
                  ) : (
                    <div className="py-12 text-center">
                      <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">
                        Nenhuma mensagem selecionada
                      </p>
                    </div>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer data-dialog-section="footer">
              <div className="flex gap-4 w-full xs:gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 bg-transparent shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
                >
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
                {isDraftFolder && onSendDraft ? (
                  <Button
                    onClick={onSendDraft}
                    className="flex-1 h-10 shadow-md transition-all duration-300 hover:shadow-lg"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Editar e enviar
                  </Button>
                ) : (
                  <>
                    {onReply && (
                      <Button
                        variant="outline"
                        onClick={onReply}
                        className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 bg-transparent shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
                      >
                        <Reply className="w-4 h-4 mr-2" />
                        Responder
                      </Button>
                    )}
                    {onForward && (
                      <Button
                        variant="outline"
                        onClick={onForward}
                        className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 bg-transparent shadow-md hover:scale-105 hover:shadow-lg transition-all duration-300"
                      >
                        <Forward className="w-4 h-4 mr-2" />
                        Encaminhar
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Dialog.Footer>
            {nestedDialogOpen && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
              />
            )}
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
