'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { CurrencyInput } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { DollarSign, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../../shared/lib/cn.web'
import type { PriceAdjustmentItem } from '../../../entities/orcamento'

// ─── Types ────────────────────────────────────────────────────────

interface PriceAdjustmentDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  items: PriceAdjustmentItem[]
  onAddItem: () => void
  onRemoveItem: (_id: string) => void
  onUpdateItem: (_id: string, _updates: Partial<PriceAdjustmentItem>) => void
  /** The original quote/entry amount before adjustments */
  originalAmount: number
  isSubmitting: boolean
  onSubmit: () => void
  onCancel: () => void
  /** Whether editing an existing adjustment (hides "add" buttons and item counters) */
  isEditing?: boolean
  formatCurrency: (_value: number) => string
}

// ─── Component ────────────────────────────────────────────────────

export function PriceAdjustmentDialog({
  open,
  onOpenChange,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  originalAmount,
  isSubmitting,
  onSubmit,
  onCancel,
  isEditing = false,
  formatCurrency,
}: PriceAdjustmentDialogProps) {
  const totalAdjustments = items.reduce(
    (sum, i) => sum + (Number.isFinite(i.value) ? i.value : 0),
    0
  )

  const isFormInvalid =
    items.length === 0 ||
    items.some(
      (item) =>
        !item.category ||
        !item.reason.trim() ||
        isNaN(item.value) ||
        item.value <= 0 ||
        (item.category === 'OTHER' &&
          (!item.categoryOther || !item.categoryOther.trim()))
    )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-xl max-h-[90vh] md:max-h-[85vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex-col items-start gap-2">
              <Dialog.CloseButton />
              <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
                <Dialog.HeaderIcon>
                  <DollarSign className="w-4 h-4" />
                </Dialog.HeaderIcon>
                <Dialog.Title className="min-w-0 break-words text-xl font-semibold text-gray-900">
                  Registrar Reajuste de Orçamento
                </Dialog.Title>
              </div>
              <Dialog.Description className="text-sm text-gray-600">
                Adicione um custo complementar por categoria. O reajuste
                atualiza o total e é enviado automaticamente ao cliente por
                e-mail e WhatsApp (quando disponível).
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport className="max-h-[45vh] overflow-y-auto">
                <Dialog.BodyContent className="space-y-4">
                  {/* Container Orçamento - valor original */}
                  <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                    <Label htmlFor="original-value">
                      Valor Original do Orçamento
                    </Label>
                    <Input
                      id="original-value"
                      value={formatCurrency(originalAmount)}
                      readOnly
                      className="mt-1 bg-white"
                    />
                  </div>
                  {/* Container Reajustes - separado do orçamento */}
                  <div className="bg-white/50 border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className={cn(
                          'space-y-4 rounded-md p-3',
                          index > 0 && 'border-t border-gray-200 pt-4'
                        )}
                      >
                        {!isEditing && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[16px] font-bold text-gray-900">
                              Item {index + 1} de {items.length}
                            </span>
                            {items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onRemoveItem(item.id)}
                                className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remover item de reajuste"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                        <div>
                          <Label htmlFor={`adjustment-category-${item.id}`}>
                            Categoria do Reajuste{' '}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={item.category || undefined}
                            onValueChange={(value) =>
                              onUpdateItem(item.id, {
                                category: value as
                                  'LABOR' | 'TRAVEL' | 'MAINTENANCE' | 'OTHER',
                                categoryOther:
                                  value === 'OTHER'
                                    ? (item.categoryOther ?? '')
                                    : undefined,
                              })
                            }
                          >
                            <SelectTrigger
                              id={`adjustment-category-${item.id}`}
                              className="mt-1"
                            >
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const usedByOtherItems = items
                                  .filter(
                                    (i) => i.id !== item.id && i.category !== ''
                                  )
                                  .map((i) => i.category)
                                return (
                                  <>
                                    <SelectItem
                                      value="LABOR"
                                      disabled={usedByOtherItems.includes(
                                        'LABOR'
                                      )}
                                    >
                                      Mão de obra
                                    </SelectItem>
                                    <SelectItem
                                      value="TRAVEL"
                                      disabled={usedByOtherItems.includes(
                                        'TRAVEL'
                                      )}
                                    >
                                      Deslocamento (Frete)
                                    </SelectItem>
                                    <SelectItem
                                      value="MAINTENANCE"
                                      disabled={usedByOtherItems.includes(
                                        'MAINTENANCE'
                                      )}
                                    >
                                      Manutenção
                                    </SelectItem>
                                    <SelectItem
                                      value="OTHER"
                                      disabled={usedByOtherItems.includes(
                                        'OTHER'
                                      )}
                                    >
                                      Outro
                                    </SelectItem>
                                  </>
                                )
                              })()}
                            </SelectContent>
                          </Select>
                          {item.category === 'OTHER' && (
                            <div className="mt-3">
                              <Label
                                htmlFor={`adjustment-category-other-${item.id}`}
                              >
                                Especifique a categoria{' '}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`adjustment-category-other-${item.id}`}
                                value={item.categoryOther ?? ''}
                                onChange={(e) =>
                                  onUpdateItem(item.id, {
                                    categoryOther: e.target.value,
                                  })
                                }
                                placeholder="Ex: Taxa de portaria, Taxa administrativa..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`final-value-${item.id}`}>
                            Valor adicional{' '}
                            <span className="text-red-500">*</span>
                          </Label>
                          <CurrencyInput
                            id={`final-value-${item.id}`}
                            value={item.value}
                            onValueChange={(value) =>
                              onUpdateItem(item.id, {
                                value: value || 0,
                              })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`adjustment-reason-${item.id}`}>
                            Justificativa do Ajuste{' '}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            id={`adjustment-reason-${item.id}`}
                            value={item.reason}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                reason: e.target.value,
                              })
                            }
                            placeholder="Ex: Taxa de quebra/avaria, ajuste por perdas de peças, etc."
                            rows={3}
                            className="mt-1"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {!isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onAddItem}
                      className="w-fit px-4 bg-transparent border-gray-200 hover:bg-background hover:text-foreground hover:scale-105 hover:shadow-sm transition-all duration-300 group"
                    >
                      <Plus className="h-4 w-4 mr-2 group-hover:text-orange-500 transition-colors duration-200" />
                      <span className="group-hover:text-orange-500 transition-colors duration-200">
                        Adicionar reajuste
                      </span>
                    </Button>
                  )}
                  {/* Container Resumo - total dos reajustes e novo valor final (separado) */}
                  {items.length > 0 && (
                    <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md text-card-foreground">
                      <CardContent className="p-0">
                        <div className="space-y-6 px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">
                              Total dos reajustes ({items.length}{' '}
                              {items.length === 1 ? 'item' : 'itens'})
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(totalAdjustments)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm pt-1 border-t border-orange-200/80">
                            <span className="font-medium text-gray-700">
                              Novo valor final
                            </span>
                            <span className="font-semibold text-orange-600">
                              {formatCurrency(
                                originalAmount + totalAdjustments
                              )}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                variant="outline"
                disabled={isSubmitting}
                onClick={onCancel}
                className="w-full"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onSubmit}
                disabled={isSubmitting || isFormInvalid}
                className="w-full"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar Reajuste'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
