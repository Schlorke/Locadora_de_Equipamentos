'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { AlertTriangle } from 'lucide-react'

export interface CalculatedLateFee {
  lateFee: number
  daysLate: number
}

interface LateFeeDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onConfirm: () => void
  onCancel: () => void
  isUpdating: boolean
  calculatedLateFee: CalculatedLateFee | null
  formatCurrency: (_value: number) => string
}

export function LateFeeDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isUpdating,
  calculatedLateFee,
  formatCurrency,
}: LateFeeDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex-col items-start gap-2">
              <Dialog.Title className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Multa por Atraso
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600">
                {calculatedLateFee
                  ? 'Multa calculada com base no atraso detectado.'
                  : 'Calculando multa por atraso...'}
              </Dialog.Description>
            </Dialog.Header>
            {calculatedLateFee && (
              <Dialog.Body className="flex-none">
                <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                  <Dialog.BodyContent className="space-y-3">
                    <p className="text-sm text-gray-700">
                      Multa calculada automaticamente baseada no atraso de{' '}
                      <strong>{calculatedLateFee.daysLate} dia(s)</strong>.
                    </p>
                    <p className="text-base font-semibold text-red-700">
                      Valor calculado:{' '}
                      <span className="text-red-600">
                        {formatCurrency(calculatedLateFee.lateFee)}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Ao aprovar, a multa será adicionada ao valor final do
                      orçamento e uma justificativa será criada automaticamente.
                    </p>
                  </Dialog.BodyContent>
                </Dialog.BodyViewport>
              </Dialog.Body>
            )}
            {calculatedLateFee && (
              <Dialog.Footer className="flex-col-reverse sm:flex-row gap-3">
                <Button
                  variant="outline"
                  disabled={isUpdating}
                  onClick={onCancel}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isUpdating}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                >
                  {isUpdating ? 'Aprovando...' : 'Aprovar e Aplicar Multa'}
                </Button>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
