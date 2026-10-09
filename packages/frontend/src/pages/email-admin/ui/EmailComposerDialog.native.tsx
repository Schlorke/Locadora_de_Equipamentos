import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { Button, Dialog, Input, Textarea, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { useEmailComposer } from '../model/use-email-composer'
import { formatBytes } from '../model/format'
import type { EmailComposerDialogProps } from '../model/tipos'
import type { NativeMailPorts } from '../model/native-ports'
import { toast } from '../../../shared/lib/toast'
export function EmailComposerDialog(
  props: EmailComposerDialogProps & { device: NativeMailPorts }
) {
  const ports = useMemo(
    () => ({ uuid: props.device.uuid, afterUpload: () => {} }),
    [props.device]
  )
  const m = useEmailComposer(props, ports),
    theme = useTheme()
  const locked = m.sending || m.uploading
  async function pick() {
    try {
      const selection = await props.device.pickFiles()
      if (selection && m.isCurrent()) await m.handleUploadAttachments(selection)
    } catch (error) {
      if (m.isCurrent())
        toast.error(
          error instanceof Error ? error.message : 'Falha ao selecionar anexos'
        )
    }
  }
  return (
    <Dialog.Root
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open && !locked && !m.nestedDialogOpen) m.handleCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{m.title}</Dialog.Title>
              <Button
                variant="outline"
                disabled={locked}
                onClick={m.handleCancel}
              >
                Fechar compositor
              </Button>
            </Dialog.Header>
            <Dialog.BodyViewport>
              <View style={{ gap: space.sm }}>
                <Text style={{ color: theme.text }}>
                  Remetente: {props.fromAddress}
                </Text>
                <Input
                  aria-label="Destinatário"
                  type="email"
                  value={m.to}
                  onChangeText={m.setTo}
                  disabled={locked}
                />
                <Input
                  aria-label="Cc"
                  type="email"
                  value={m.cc}
                  onChangeText={m.setCc}
                  disabled={locked}
                />
                <Button
                  variant="outline"
                  onClick={() => m.setShowBcc(!m.showBcc)}
                >
                  Cco
                </Button>
                {m.showBcc ? (
                  <Input
                    aria-label="Cco"
                    type="email"
                    value={m.bcc}
                    onChangeText={m.setBcc}
                    disabled={locked}
                  />
                ) : null}
                <Input
                  aria-label="Assunto"
                  value={m.subject}
                  onChangeText={m.setSubject}
                  disabled={locked}
                />
                <Textarea
                  aria-label="Mensagem"
                  value={m.content}
                  onChangeText={m.setContent}
                  disabled={locked}
                />
                <Button
                  variant="outline"
                  disabled={locked}
                  onClick={() => void pick()}
                >
                  {m.uploading ? 'Enviando anexos...' : 'Adicionar anexos'}
                </Button>
                <Text style={{ color: theme.text }}>
                  Até {m.MAX_FILE_SIZE_MB} MB por arquivo /{' '}
                  {m.MAX_TOTAL_SIZE_MB} MB no total ·{' '}
                  {formatBytes(m.totalAttachmentSize)}
                </Text>
                {m.attachments.map((attachment, index) => (
                  <View
                    key={attachment.storeName + index}
                    style={{ gap: space.xs }}
                  >
                    <Text style={{ color: theme.text }}>
                      {attachment.fileName} · {formatBytes(attachment.size)}
                    </Text>
                    <Button
                      variant="outline"
                      disabled={locked}
                      onClick={() => m.handleRemoveAttachment(index)}
                    >
                      Remover {attachment.fileName}
                    </Button>
                  </View>
                ))}
                {props.draftFolderId ? (
                  <Text style={{ color: theme.text }}>
                    {m.draftSaving
                      ? 'Salvando rascunho...'
                      : m.lastDraftSavedAt
                        ? 'Rascunho salvo às ' +
                          new Date(m.lastDraftSavedAt).toLocaleTimeString(
                            'pt-BR',
                            { hour: '2-digit', minute: '2-digit' }
                          )
                        : 'Rascunho ainda não salvo'}
                  </Text>
                ) : null}
              </View>
            </Dialog.BodyViewport>
            <Dialog.Footer>
              <Button
                variant="outline"
                disabled={locked}
                onClick={m.handleCancel}
              >
                Cancelar
              </Button>
              {props.draftFolderId ? (
                <Button
                  variant="outline"
                  disabled={locked || m.draftSaving}
                  onClick={() => void m.handleSaveDraft(false)}
                >
                  {m.draftSaving ? 'Salvando...' : 'Salvar rascunho'}
                </Button>
              ) : null}
              <Button disabled={locked} onClick={m.handleSend}>
                {m.sending ? 'Enviando...' : 'Enviar'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
          <Dialog.Root
            open={m.showEmptySubjectConfirm}
            onOpenChange={m.setShowEmptySubjectConfirm}
          >
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup>
                <Dialog.Header>
                  <Dialog.Title>Enviar sem assunto?</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Text style={{ color: theme.text }}>
                    O assunto está vazio. Deseja enviar o e-mail assim mesmo?
                  </Text>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    variant="outline"
                    onClick={() => m.setShowEmptySubjectConfirm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      m.setShowEmptySubjectConfirm(false)
                      void m.doSend({ skipSubjectCheck: true })
                    }}
                  >
                    Enviar mesmo assim
                  </Button>
                </Dialog.Footer>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Dialog.Root
            open={m.showDiscardConfirm}
            onOpenChange={m.setShowDiscardConfirm}
          >
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup>
                <Dialog.Header>
                  <Dialog.Title>Descartar rascunho?</Dialog.Title>
                </Dialog.Header>
                <Dialog.Body>
                  <Text style={{ color: theme.text }}>
                    Você tem alterações não salvas. Deseja descartar o rascunho?
                  </Text>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    variant="outline"
                    onClick={() => m.setShowDiscardConfirm(false)}
                  >
                    Continuar editando
                  </Button>
                  <Button
                    onClick={() => {
                      m.setShowDiscardConfirm(false)
                      props.onClose()
                    }}
                  >
                    Descartar
                  </Button>
                </Dialog.Footer>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
