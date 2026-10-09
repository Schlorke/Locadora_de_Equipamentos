'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { Loader2, Mail, Paperclip, Upload, X } from 'lucide-react'
import { useEffect, useCallback, useMemo, useRef } from 'react'

import { useEmailComposer } from '../model/use-email-composer'
import { formatBytes } from '../model/format'
import type { EmailComposerDialogProps } from '../model/tipos'
export type { ComposerMode } from '../model/tipos'
export function EmailComposerDialog({
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
}: EmailComposerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ports = useMemo(
    () => ({
      uuid: () => crypto.randomUUID(),
      afterUpload() {
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    }),
    []
  )
  const model = useEmailComposer(
    {
      isOpen,
      onClose,
      mode,
      fromAddress,
      messageId,
      draftMessageId,
      draftFolderId,
      initialTo,
      initialSubject,
      initialContent,
      onSent,
      onDraftSaved,
    },
    ports
  )
  const {
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
    draftSaving,
    lastDraftSavedAt,
    sending,
    showEmptySubjectConfirm,
    setShowEmptySubjectConfirm,
    showDiscardConfirm,
    setShowDiscardConfirm,
    totalAttachmentSize,
    handleRemoveAttachment,
    handleSaveDraft,
    doSend,
    handleSend,
    handleCancel,
    nestedDialogOpen,
    title,
    handleUploadAttachments: uploadAttachments,
  } = model
  const handleUploadAttachments = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []),
        multipart = new FormData()
      for (const file of files) multipart.append('files', file, file.name)
      await uploadAttachments({ files, multipart })
    },
    [uploadAttachments]
  )
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend
  // Ctrl+Enter / Cmd+Enter to send
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSendRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-2xl h-[85vh] text-base"
          data-nested-parent={nestedDialogOpen ? '' : undefined}
        >
          <Dialog.Content className="relative h-full flex flex-col">
            {nestedDialogOpen && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
              />
            )}
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <Mail className="h-4 w-4" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-lg font-semibold text-slate-900 sm:text-xl">
                {title}
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar" />
            </Dialog.Header>
            <Dialog.Body className="flex-1 min-h-0">
              <Dialog.BodyViewport>
                <Dialog.BodyContent className="space-y-4">
                  <div>
                    <Label
                      htmlFor="composer-from"
                      className="text-sm font-medium"
                    >
                      De
                    </Label>
                    <Input
                      id="composer-from"
                      value={fromAddress}
                      readOnly
                      className="mt-1.5 bg-slate-50"
                      aria-label="Remetente"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="composer-to"
                      className="text-sm font-medium"
                    >
                      Para *
                    </Label>
                    <Input
                      id="composer-to"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="mt-1.5"
                      aria-label="Destinatário"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="composer-cc"
                        className="text-sm font-medium"
                      >
                        Cc
                      </Label>
                      {!showBcc && (
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline ml-auto"
                          onClick={() => setShowBcc(true)}
                        >
                          Cco
                        </button>
                      )}
                    </div>
                    <Input
                      id="composer-cc"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="Opcional"
                      className="mt-1.5"
                      aria-label="Cópia"
                    />
                  </div>
                  {showBcc && (
                    <div>
                      <Label
                        htmlFor="composer-bcc"
                        className="text-sm font-medium"
                      >
                        Cco
                      </Label>
                      <Input
                        id="composer-bcc"
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        placeholder="Opcional"
                        className="mt-1.5"
                        aria-label="Cópia oculta"
                      />
                    </div>
                  )}
                  <div>
                    <Label
                      htmlFor="composer-subject"
                      className="text-sm font-medium"
                    >
                      Assunto
                    </Label>
                    <Input
                      id="composer-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Assunto do e-mail"
                      className="mt-1.5"
                      aria-label="Assunto"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="composer-content"
                      className="text-sm font-medium"
                    >
                      Mensagem
                    </Label>
                    <Textarea
                      id="composer-content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="mt-1.5 min-h-[200px] resize-y text-base md:text-sm"
                      aria-label="Corpo da mensagem"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Anexos</Label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleUploadAttachments}
                        className="hidden"
                        aria-label="Selecionar anexos"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Adicionar anexo
                          </>
                        )}
                      </Button>
                      {attachments.length > 0 && (
                        <span className="text-xs text-slate-500">
                          {attachments.length} anexo(s) ·{' '}
                          {formatBytes(totalAttachmentSize)}
                        </span>
                      )}
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map((att, index) => (
                          <div
                            key={`${att.storeName}-${att.attachmentName}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="text-sm text-slate-700 truncate">
                                {att.fileName || att.attachmentName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                {formatBytes(att.size)}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRemoveAttachment(index)}
                                aria-label="Remover anexo"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {draftFolderId && (
                      <div className="mt-2 text-xs text-slate-500">
                        {draftSaving
                          ? 'Salvando rascunho...'
                          : lastDraftSavedAt
                            ? `Rascunho salvo às ${lastDraftSavedAt.toLocaleTimeString(
                                'pt-BR',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}`
                            : 'Rascunho ainda não salvo'}
                      </div>
                    )}
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <div className="p-4 border-t border-gray-200 flex flex-wrap justify-between gap-2">
              <span className="text-xs text-slate-400 self-center hidden sm:inline">
                Ctrl+Enter para enviar
              </span>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={sending || uploading}
                >
                  Cancelar
                </Button>
                {draftFolderId && (
                  <Button
                    variant="outline"
                    onClick={() => handleSaveDraft(false)}
                    disabled={sending || uploading || draftSaving}
                  >
                    {draftSaving ? 'Salvando...' : 'Salvar rascunho'}
                  </Button>
                )}
                <Button onClick={handleSend} disabled={sending || uploading}>
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar'
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Content>

          {/* Nested: empty subject confirmation */}
          <Dialog.Root
            open={showEmptySubjectConfirm}
            onOpenChange={setShowEmptySubjectConfirm}
          >
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup
                variant="default"
                className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
              >
                <Dialog.Content>
                  <Dialog.Header className="flex-col items-start gap-1 pb-3">
                    <Dialog.CloseButton aria-label="Fechar" />
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Enviar sem assunto?
                    </Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body className="flex-none">
                    <Dialog.BodyViewport>
                      <Dialog.BodyContent>
                        <p className="text-sm text-gray-600">
                          O assunto está vazio. Deseja enviar o e-mail assim
                          mesmo?
                        </p>
                      </Dialog.BodyContent>
                    </Dialog.BodyViewport>
                  </Dialog.Body>
                  <Dialog.Footer className="flex flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowEmptySubjectConfirm(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        setShowEmptySubjectConfirm(false)
                        void doSend({ skipSubjectCheck: true })
                      }}
                      className="flex-1"
                    >
                      Enviar mesmo assim
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Nested: discard draft confirmation */}
          <Dialog.Root
            open={showDiscardConfirm}
            onOpenChange={setShowDiscardConfirm}
          >
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup
                variant="default"
                className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
              >
                <Dialog.Content>
                  <Dialog.Header className="flex-col items-start gap-1 pb-3">
                    <Dialog.CloseButton aria-label="Fechar" />
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Descartar rascunho?
                    </Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body className="flex-none">
                    <Dialog.BodyViewport>
                      <Dialog.BodyContent>
                        <p className="text-sm text-gray-600">
                          Você tem alterações não salvas. Deseja descartar o
                          rascunho?
                        </p>
                      </Dialog.BodyContent>
                    </Dialog.BodyViewport>
                  </Dialog.Body>
                  <Dialog.Footer className="flex flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDiscardConfirm(false)}
                      className="flex-1"
                    >
                      Continuar editando
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDiscardConfirm(false)
                        onClose()
                      }}
                      className="flex-1"
                    >
                      Descartar
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
