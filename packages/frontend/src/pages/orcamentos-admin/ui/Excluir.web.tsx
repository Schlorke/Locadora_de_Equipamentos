'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
  quoteName: string
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
  quoteName,
}: DeleteDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex-col items-start gap-1 pb-3">
              <Dialog.CloseButton />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Excluir Orçamento Permanentemente?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                <Dialog.BodyContent className="space-y-2 py-2">
                  <p className="text-sm text-gray-600">
                    Esta ação não pode ser desfeita. O orçamento de{' '}
                    <strong>{quoteName}</strong> será removido com todos os
                    itens e registros associados.
                  </p>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isDeleting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
