'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'

interface RemoveAdjustmentConfirmProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  isRemoving: boolean
}

export function RemoveAdjustmentConfirm({
  open,
  onOpenChange,
  onConfirm,
  isRemoving,
}: RemoveAdjustmentConfirmProps) {
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
              <Dialog.CloseButton aria-label="Fechar confirmação" />
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Remover reajuste do orçamento?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                <Dialog.BodyContent className="space-y-2 py-2">
                  <p className="text-sm text-gray-600">
                    Este reajuste será removido. O valor final do orçamento será
                    recalculado.
                  </p>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isRemoving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onConfirm}
                disabled={isRemoving}
                className="flex-1"
              >
                {isRemoving ? 'Removendo...' : 'Confirmar remoção'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
