'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'

interface DeleteAdjustmentDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteAdjustmentDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteAdjustmentDialogProps) {
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
              <Dialog.CloseButton aria-label="Fechar" />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Excluir reajuste?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                <Dialog.BodyContent className="space-y-2 py-2">
                  <p className="text-sm text-gray-600">
                    O valor total do orçamento será recalculado e a
                    justificativa atualizada. Esta ação não pode ser desfeita.
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
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
