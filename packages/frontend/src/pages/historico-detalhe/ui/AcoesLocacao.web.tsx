'use client'

import { useRentalActions } from '../model/use-rental-actions'
import { useRentalDetailScope } from '../model/use-rental-detail'
import type { RentalActionsProps } from '../model/actions-contract'
import { Button } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Calendar, Truck, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

function RentalActionsContent({
  rentalId,
  status,
  endDate,
  hasBoleto,
  boletoPaymentId,
  className,
}: RentalActionsProps) {
  const router = useRouter()
  const {
    loading,
    extensionDays,
    setExtensionDays,
    showExtensionDialog,
    setShowExtensionDialog,
    showPickupDialog,
    setShowPickupDialog,
    handleRequestExtension,
    handleRequestPickup,
  } = useRentalActions(rentalId, router.refresh)

  const handleViewBoleto = () => {
    if (boletoPaymentId) {
      router.push(`/area-cliente/pagamentos/${boletoPaymentId}`)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Botão para ver boleto */}
      {hasBoleto && status === 'PENDING' && (
        <Button variant="outline" className="w-full" onClick={handleViewBoleto}>
          <FileText className="w-4 h-4 mr-2" />
          Ver Boleto
        </Button>
      )}

      {/* Solicitar prorrogação */}
      {status === 'ACTIVE' && new Date() < endDate && (
        <Dialog.Root
          open={showExtensionDialog}
          onOpenChange={setShowExtensionDialog}
        >
          <Dialog.Trigger
            render={<Button variant="outline" className="w-full" />}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Solicitar Prorrogação
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Header>
                <Dialog.Title>Solicitar Prorrogação</Dialog.Title>
                <Dialog.Description>
                  Informe quantos dias adicionais você precisa
                </Dialog.Description>
              </Dialog.Header>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="days">Dias Adicionais</Label>
                  <Input
                    id="days"
                    type="number"
                    min="1"
                    value={extensionDays}
                    onChange={(e) =>
                      setExtensionDays(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <Button
                  onClick={handleRequestExtension}
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? 'Enviando...' : 'Solicitar Prorrogação'}
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Solicitar coleta */}
      {status === 'ACTIVE' && (
        <Dialog.Root open={showPickupDialog} onOpenChange={setShowPickupDialog}>
          <Dialog.Trigger
            render={<Button variant="outline" className="w-full" />}
          >
            <Truck className="w-4 h-4 mr-2" />
            Solicitar Coleta
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Header>
                <Dialog.Title>Solicitar Coleta</Dialog.Title>
                <Dialog.Description>
                  Solicite a coleta do equipamento no endereço da obra
                </Dialog.Description>
              </Dialog.Header>
              <Button
                onClick={handleRequestPickup}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {loading ? 'Enviando...' : 'Confirmar Solicitação'}
              </Button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}

export function RentalActions(props: RentalActionsProps) {
  return (
    <RentalActionsContent
      key={useRentalDetailScope(props.rentalId)}
      {...props}
    />
  )
}
