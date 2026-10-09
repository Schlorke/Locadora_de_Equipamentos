'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Badge } from '@gb-locacoes/ui'
import { MapPin } from 'lucide-react'
import { formatAddress } from '../../../entities/orcamento'
interface Address {
  id: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isPrimary: boolean
}

interface SelectAddressDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  addresses: Address[]
  onSelect: (_addressId: string) => void
  onUseOther: () => void
  onCancel: () => void
}

export function SelectAddressDialog({
  open,
  onOpenChange,
  addresses,
  onSelect,
  onUseOther,
  onCancel,
}: SelectAddressDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup variant="default">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <MapPin className="h-5 w-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title>Selecione o endereço de entrega</Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  <div className="space-y-3">
                    {addresses.map((address) => {
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
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => onSelect(address.id)}
                          className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-orange-500 hover:bg-orange-50/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {address.isPrimary && (
                                  <Badge
                                    variant="default"
                                    className="bg-orange-600 text-white text-xs"
                                  >
                                    Principal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-900">
                                {formattedAddress}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            <Dialog.Footer>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={onUseOther}
                  className="flex-1"
                >
                  Usar outro endereço
                </Button>
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
