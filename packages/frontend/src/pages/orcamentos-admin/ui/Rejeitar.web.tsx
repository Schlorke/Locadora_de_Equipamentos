'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'

interface RejectDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  isUpdating: boolean
  updatingAction: string | null
  quoteName: string
  rejectWithReason: boolean
  onRejectWithReasonChange: (_checked: boolean) => void
  rejectionReason: string
  onRejectionReasonChange: (_value: string) => void
}

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isUpdating,
  updatingAction,
  quoteName,
  rejectWithReason,
  onRejectWithReasonChange,
  rejectionReason,
  onRejectionReasonChange,
}: RejectDialogProps) {
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
                Rejeitar Orçamento?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                <Dialog.BodyContent className="space-y-4 py-2">
                  <p className="text-sm text-gray-600">
                    Tem certeza que deseja rejeitar o orçamento de{' '}
                    <strong>{quoteName}</strong>? Esta ação enviará um email ao
                    cliente informando sobre a rejeição.
                  </p>
                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="reject-with-reason"
                      checked={rejectWithReason}
                      onCheckedChange={(checked) =>
                        onRejectWithReasonChange(checked === true)
                      }
                      className="mt-1 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                    />
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor="reject-with-reason"
                        className="text-sm font-medium text-gray-900 cursor-pointer"
                      >
                        Adicionar motivo da rejeição
                      </Label>
                      {rejectWithReason && (
                        <Textarea
                          placeholder="Digite o motivo da rejeição do orçamento..."
                          value={rejectionReason}
                          onChange={(e) =>
                            onRejectionReasonChange(e.target.value)
                          }
                          className="min-h-[100px] resize-none"
                        />
                      )}
                    </div>
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onRejectWithReasonChange(false)
                  onRejectionReasonChange('')
                }}
                disabled={isUpdating}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onConfirm}
                disabled={
                  isUpdating || (rejectWithReason && !rejectionReason.trim())
                }
                className="flex-1"
              >
                {updatingAction === 'rejected'
                  ? 'Rejeitando...'
                  : 'Confirmar Rejeição'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
