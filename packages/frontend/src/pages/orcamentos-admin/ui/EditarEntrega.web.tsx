'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { CurrencyInput } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { Truck } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────

export interface EditDeliveryDraft {
  deliveryType: 'DELIVERY' | 'PICKUP' | null
  deliveryFee: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

interface EditDeliveryDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  draft: EditDeliveryDraft
  onDraftChange: (
    _updater: (_prev: EditDeliveryDraft) => EditDeliveryDraft
  ) => void
  onSave: () => void
  isSaving: boolean
  formatCEP: (_val: string) => string
  /** Whether a TRAVEL adjustment already exists (hides delivery fee field) */
  hasTravelAdjustment: boolean
  /** Called when the delivery fee changes so the parent can sync with price adjustments */
  onDeliveryFeeChange?: (_value: number) => void
}

// ─── Component ────────────────────────────────────────────────────

export function EditDeliveryDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
  isSaving,
  formatCEP,
  hasTravelAdjustment,
  onDeliveryFeeChange,
}: EditDeliveryDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex-wrap items-start gap-2 pr-12 sm:items-center sm:gap-3 pb-3">
              <Dialog.HeaderIcon>
                <Truck className="h-4 w-4" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Editar entrega e endereço
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar dialog" />
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport
                style={{ scrollbarGutter: 'stable' }}
                className="max-h-[50vh] overflow-y-auto"
              >
                <Dialog.BodyContent className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-delivery-type"
                      className="text-sm font-medium text-gray-700"
                    >
                      Tipo de entrega
                    </Label>
                    <Select
                      value={draft.deliveryType ?? ''}
                      onValueChange={(value: 'DELIVERY' | 'PICKUP') =>
                        onDraftChange((prev) => ({
                          ...prev,
                          deliveryType: value,
                          ...(value === 'PICKUP' ? { deliveryFee: '' } : {}),
                        }))
                      }
                    >
                      <SelectTrigger id="edit-delivery-type">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="z-[var(--layer-tooltip)]">
                        <SelectItem value="DELIVERY">
                          Entrega no Endereço
                        </SelectItem>
                        <SelectItem value="PICKUP">Retirada em Loja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {draft.deliveryType === 'DELIVERY' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="edit-addr-zip"
                            className="text-sm font-medium text-gray-700"
                          >
                            CEP
                          </Label>
                          <Input
                            id="edit-addr-zip"
                            value={draft.zipCode}
                            onChange={(e) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                zipCode: formatCEP(e.target.value),
                              }))
                            }
                            placeholder="00000-000"
                            maxLength={9}
                            className="font-mono"
                          />
                        </div>
                        {!hasTravelAdjustment && (
                          <div className="space-y-2">
                            <Label
                              htmlFor="edit-delivery-fee"
                              className="text-sm font-medium text-gray-700"
                            >
                              Valor do frete (R$)
                            </Label>
                            <CurrencyInput
                              id="edit-delivery-fee"
                              value={(() => {
                                const raw = draft.deliveryFee
                                const num = parseFloat(
                                  String(raw).replace(',', '.')
                                )
                                return Number.isFinite(num) ? num : 0
                              })()}
                              onValueChange={(num) => {
                                onDraftChange((prev) => ({
                                  ...prev,
                                  deliveryFee: String(num),
                                }))
                                if (
                                  Number.isFinite(num) &&
                                  num >= 0 &&
                                  onDeliveryFeeChange
                                ) {
                                  onDeliveryFeeChange(num)
                                }
                              }}
                              className="border-slate-200"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="edit-addr-street"
                          className="text-sm font-medium text-gray-700"
                        >
                          Logradouro
                        </Label>
                        <Input
                          id="edit-addr-street"
                          value={draft.street}
                          onChange={(e) =>
                            onDraftChange((prev) => ({
                              ...prev,
                              street: e.target.value,
                            }))
                          }
                          placeholder="Rua, avenida..."
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="edit-addr-number"
                            className="text-sm font-medium text-gray-700"
                          >
                            Número
                          </Label>
                          <Input
                            id="edit-addr-number"
                            value={draft.number}
                            onChange={(e) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                number: e.target.value,
                              }))
                            }
                            placeholder="123"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="edit-addr-complement"
                            className="text-sm font-medium text-gray-700"
                          >
                            Complemento
                          </Label>
                          <Input
                            id="edit-addr-complement"
                            value={draft.complement}
                            onChange={(e) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                complement: e.target.value,
                              }))
                            }
                            placeholder="Apto, sala..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="edit-addr-neighborhood"
                          className="text-sm font-medium text-gray-700"
                        >
                          Bairro
                        </Label>
                        <Input
                          id="edit-addr-neighborhood"
                          value={draft.neighborhood}
                          onChange={(e) =>
                            onDraftChange((prev) => ({
                              ...prev,
                              neighborhood: e.target.value,
                            }))
                          }
                          placeholder="Bairro"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="edit-addr-city"
                            className="text-sm font-medium text-gray-700"
                          >
                            Cidade
                          </Label>
                          <Input
                            id="edit-addr-city"
                            value={draft.city}
                            onChange={(e) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                city: e.target.value,
                              }))
                            }
                            placeholder="Cidade"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="edit-addr-state"
                            className="text-sm font-medium text-gray-700"
                          >
                            Estado (UF)
                          </Label>
                          <Input
                            id="edit-addr-state"
                            value={draft.state}
                            onChange={(e) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                state: e.target.value,
                              }))
                            }
                            placeholder="SP"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onSave}
                disabled={isSaving || !draft.deliveryType}
                className="flex-1"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
