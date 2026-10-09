'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Checkbox } from '@gb-locacoes/ui'
import { HybridTooltip } from '@gb-locacoes/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@gb-locacoes/ui'
import { Calendar as CalendarPicker } from '../../../widgets/seletor-data'
import { Calendar, Info, Package } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '../../../shared/lib/cn.web'
import { parseLocalDate } from '../../../entities/orcamento'
import Image from 'next/image'
import type { Quote } from '../../../entities/orcamento'

// ─── Types ────────────────────────────────────────────────────────

export type QuoteItemType = NonNullable<Quote['items']>[number]

export interface EditItemDatesDraft {
  startDate: string
  endDate: string
  includeWeekends: boolean
}

export interface EditItemPreview {
  days: number
  total: number
  pricePerDay: number
  quantity: number
  periodLabel: string
  startStr: string
  endStr: string
  includeWeekends: boolean
}

export interface CalendarRange {
  fromDate: Date
  toDate: Date
  startMonth: Date
  endMonth: Date
}

export interface RangeModifiers {
  modifiers: Record<string, (_date: Date) => boolean>
  modifiersClassNames: Record<string, string>
}

interface EditItemDatesDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingItem: QuoteItemType | null
  draft: EditItemDatesDraft
  onDraftChange: (
    _updater: (_prev: EditItemDatesDraft) => EditItemDatesDraft
  ) => void
  onSave: () => void
  isSaving: boolean
  rangeModifiers: RangeModifiers | null
  preview: EditItemPreview | null
  calendarRange: CalendarRange
  formatCurrency: (_value: number) => string
}

// ─── Component ────────────────────────────────────────────────────

export function EditItemDatesDialog({
  open,
  onOpenChange,
  editingItem,
  draft,
  onDraftChange,
  onSave,
  isSaving,
  rangeModifiers,
  preview,
  calendarRange,
  formatCurrency,
}: EditItemDatesDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(openState) => {
        if (!openState) {
          onOpenChange(false)
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex flex-wrap items-start gap-2 pr-12 sm:items-center sm:gap-3 pb-3">
              <Dialog.HeaderIcon>
                <Calendar className="h-4 w-4" />
              </Dialog.HeaderIcon>
              <div className="flex-1 min-w-0">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Editar período do item
                </Dialog.Title>
              </div>
              <Dialog.CloseButton aria-label="Fechar dialog" />
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport
                style={{ scrollbarGutter: 'stable' }}
                className="max-h-[50vh] overflow-y-auto"
              >
                <Dialog.BodyContent className="space-y-4 py-2">
                  {/* Prévia em tempo real do item + Inclui finais de semana (bloco único) */}
                  {editingItem && (
                    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md border border-slate-200">
                      <div className="flex gap-3">
                        <div className="shrink-0">
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                            {(() => {
                              const equipmentWithImages =
                                editingItem.equipment as
                                  | {
                                      images?: string[] | string
                                    }
                                  | undefined
                              const raw = equipmentWithImages?.images
                              const thumbnailUrl = Array.isArray(raw)
                                ? raw[0]?.trim() || null
                                : typeof raw === 'string'
                                  ? raw.trim() || null
                                  : null
                              return thumbnailUrl ? (
                                <Image
                                  src={thumbnailUrl}
                                  alt={editingItem.equipment?.name ?? ''}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Package className="h-6 w-6 text-slate-400" />
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm leading-tight mb-1">
                            {editingItem.equipment?.name ?? 'Equipamento'}
                          </p>
                          {preview ? (
                            <>
                              <div className="flex flex-wrap gap-1 mb-1">
                                <span className="text-[13px] text-gray-600 font-medium">
                                  Qtd: {preview.quantity}x
                                </span>
                                <span className="text-[13px] text-gray-400">
                                  ·
                                </span>
                                <span className="text-[13px] text-orange-600 font-medium">
                                  {preview.periodLabel}
                                </span>
                                <span className="text-[13px] text-gray-400">
                                  ·
                                </span>
                                <span className="text-[13px] text-gray-600 font-medium">
                                  {preview.days}{' '}
                                  {preview.days === 1 ? 'dia' : 'dias'}
                                </span>
                              </div>
                              <div className="text-[13px] text-gray-900 font-semibold mb-1">
                                {format(
                                  parseLocalDate(preview.startStr),
                                  'dd/MM/yyyy',
                                  { locale: ptBR }
                                )}{' '}
                                até{' '}
                                {format(
                                  parseLocalDate(preview.endStr),
                                  'dd/MM/yyyy',
                                  { locale: ptBR }
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[13px] mb-1">
                                <span
                                  className={
                                    preview.includeWeekends
                                      ? 'text-green-600 font-semibold'
                                      : 'text-red-600 font-semibold'
                                  }
                                >
                                  {preview.includeWeekends
                                    ? '\u2713'
                                    : '\u2717'}
                                </span>
                                <span className="text-gray-600 font-medium">
                                  {preview.includeWeekends
                                    ? 'Inclui finais de semana'
                                    : 'Não inclui finais de semana'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-[15px] font-semibold text-green-600">
                                  {formatCurrency(preview.total)}
                                </span>
                                <span className="text-[11.5px] text-gray-500">
                                  {formatCurrency(preview.pricePerDay)}
                                  /dia
                                </span>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Defina as datas para ver a prévia e o valor
                              atualizado.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="edit-item-include-weekends"
                          checked={draft.includeWeekends}
                          onCheckedChange={(checked) =>
                            onDraftChange((prev) => ({
                              ...prev,
                              includeWeekends: checked === true,
                            }))
                          }
                        />
                        <Label
                          htmlFor="edit-item-include-weekends"
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Inclui finais de semana
                        </Label>
                        <HybridTooltip
                          content="Quando ativado, sábados e domingos entram na contagem de dias. Quando desativado, apenas dias úteis (segunda a sexta) são contados."
                          side="bottom"
                        >
                          <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
                        </HybridTooltip>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-item-start"
                        className="text-sm font-medium text-gray-700"
                      >
                        Data início
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="edit-item-start"
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal h-10 rounded-md border border-slate-200 bg-background text-slate-900 hover:scale-100',
                              !draft.startDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4 shrink-0" />
                            {draft.startDate ? (
                              format(
                                parseLocalDate(draft.startDate),
                                'dd/MM/yyyy',
                                { locale: ptBR }
                              )
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 border border-gray-200 rounded-md bg-white shadow-md overflow-hidden max-w-full"
                          align="start"
                        >
                          <CalendarPicker
                            mode="single"
                            defaultMonth={
                              draft.startDate
                                ? parseLocalDate(draft.startDate)
                                : undefined
                            }
                            selected={
                              draft.startDate
                                ? parseLocalDate(draft.startDate)
                                : undefined
                            }
                            onSelect={(date) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                startDate: date
                                  ? format(date, 'yyyy-MM-dd')
                                  : '',
                              }))
                            }
                            locale={ptBR}
                            showOutsideDays={false}
                            initialFocus
                            fromDate={calendarRange.fromDate}
                            toDate={calendarRange.toDate}
                            startMonth={calendarRange.startMonth}
                            endMonth={calendarRange.endMonth}
                            includeWeekends={draft.includeWeekends}
                            disabled={
                              !draft.includeWeekends
                                ? (date: Date) =>
                                    date.getDay() === 0 || date.getDay() === 6
                                : undefined
                            }
                            modifiers={rangeModifiers?.modifiers}
                            modifiersClassNames={
                              rangeModifiers?.modifiersClassNames
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-item-end"
                        className="text-sm font-medium text-gray-700"
                      >
                        Data fim
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="edit-item-end"
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal h-10 rounded-md border border-slate-200 bg-background text-slate-900 hover:scale-100',
                              !draft.endDate && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4 shrink-0" />
                            {draft.endDate ? (
                              format(
                                parseLocalDate(draft.endDate),
                                'dd/MM/yyyy',
                                { locale: ptBR }
                              )
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 border border-gray-200 rounded-md bg-white shadow-md overflow-hidden max-w-full"
                          align="start"
                        >
                          <CalendarPicker
                            mode="single"
                            defaultMonth={
                              draft.endDate
                                ? parseLocalDate(draft.endDate)
                                : undefined
                            }
                            selected={
                              draft.endDate
                                ? parseLocalDate(draft.endDate)
                                : undefined
                            }
                            onSelect={(date) =>
                              onDraftChange((prev) => ({
                                ...prev,
                                endDate: date ? format(date, 'yyyy-MM-dd') : '',
                              }))
                            }
                            locale={ptBR}
                            showOutsideDays={false}
                            fromDate={
                              draft.startDate
                                ? parseLocalDate(draft.startDate)
                                : calendarRange.fromDate
                            }
                            toDate={calendarRange.toDate}
                            startMonth={calendarRange.startMonth}
                            endMonth={calendarRange.endMonth}
                            includeWeekends={draft.includeWeekends}
                            disabled={
                              !draft.includeWeekends
                                ? (date: Date) =>
                                    date.getDay() === 0 || date.getDay() === 6
                                : undefined
                            }
                            modifiers={rangeModifiers?.modifiers}
                            modifiersClassNames={
                              rangeModifiers?.modifiersClassNames
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
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
                disabled={
                  isSaving || !draft.startDate?.trim() || !draft.endDate?.trim()
                }
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
