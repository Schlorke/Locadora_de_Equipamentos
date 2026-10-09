'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { MapPin } from 'lucide-react'
import { formatAddress } from '../../../entities/orcamento'
import { useState } from 'react'

interface Address {
  id: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

interface ConfirmAddressDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  address: Address
  onConfirm: () => void
  onCancel: () => void
  onDismissChange: (_dismissed: boolean) => void
}

export function ConfirmAddressDialog({
  open,
  onOpenChange,
  address,
  onConfirm,
  onCancel,
  onDismissChange,
}: ConfirmAddressDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleConfirm = () => {
    onDismissChange(dontShowAgain)
    onConfirm()
  }

  const handleCancel = () => {
    setDontShowAgain(false)
    onCancel()
  }

  const formattedAddress = formatAddress({
    street: address.street,
    number: address.number,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup variant="compact">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <MapPin className="h-5 w-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title>Confirmar endereço</Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Você confirma o endereço de entrega?
                  </p>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                      {formattedAddress}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="dont-show-again"
                      checked={dontShowAgain}
                      onCheckedChange={(checked) => {
                        setDontShowAgain(checked === true)
                      }}
                    />
                    <Label
                      htmlFor="dont-show-again"
                      className="text-sm text-gray-700 cursor-pointer"
                    >
                      Não exibir novamente
                    </Label>
                  </div>
                </div>
              </Dialog.BodyContent>
            </Dialog.Body>

            <Dialog.Footer>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="default"
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  Confirmar
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
