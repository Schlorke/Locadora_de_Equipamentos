'use client'

import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { CurrencyInput } from '@gb-locacoes/ui'
import { DatePicker } from '../../../widgets/seletor-data'
import { Dialog } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { StatusTooltip } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { formatDocument } from '../../../entities/orcamento'
import { useFinancialDocument } from '../model/document.web'
import { formatCurrency, getInitials } from '../../../shared/lib/formatting'
import {
  type BillingStatus,
  type FinancialEntry,
  type PriceAdjustmentItem,
  type AdjustmentHistoryItem,
  type TaxRegime,
  statusLabel,
  statusBadgeClass,
  REGIME_LABELS,
  OPERATION_TYPE_LABELS,
  ADJUSTMENT_CATEGORY_LABELS,
  createDefaultAdjustmentItem,
} from '../model/tipos'

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-BR')
}

function formatDateForInput(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface EntryDetailDialogProps {
  selectedEntry: FinancialEntry | null
  setSelectedEntry: (_entry: FinancialEntry | null) => void
  nestedDialogOpen: boolean
  dueDateDraft: string
  setDueDateDraft: (_value: string) => void
  savingStatusId: string | null
  savingDueDateId: string | null
  regeneratingBoletoId: string | null
  adjustmentHistory: AdjustmentHistoryItem[]
  loadingAdjustments: boolean
  showPriceAdjustmentDialog: boolean
  setShowPriceAdjustmentDialog: (_show: boolean) => void
  priceAdjustmentItems: PriceAdjustmentItem[]
  setPriceAdjustmentItems: React.Dispatch<
    React.SetStateAction<PriceAdjustmentItem[]>
  >
  editingAdjustmentId: string | null
  setEditingAdjustmentId: (_id: string | null) => void
  isAdjustingPrice: boolean
  deletingAdjustmentId: string | null
  updateBillingStatus: (_entryId: string, _status: BillingStatus) => void
  updateEntryDueDate: (_entryId: string, _dueDateValue: string) => void
  regenerateBoleto: (_entryId: string) => void
  openQuoteFromEntry: (_entry: FinancialEntry) => void
  addPriceAdjustmentItem: () => void
  removePriceAdjustmentItem: (_id: string) => void
  updatePriceAdjustmentItem: (
    _id: string,
    _patch: Partial<PriceAdjustmentItem>
  ) => void
  adjustQuotePriceForEntry: (_quoteId: string) => void
  setAdjustmentToDelete: (_adj: { id: string; quoteId: string } | null) => void
  setShowAdjustmentDeleteConfirm: (_show: boolean) => void
}

export function EntryDetailDialog({
  selectedEntry,
  setSelectedEntry,
  nestedDialogOpen,
  dueDateDraft,
  setDueDateDraft,
  savingStatusId,
  savingDueDateId,
  regeneratingBoletoId,
  adjustmentHistory,
  loadingAdjustments,
  showPriceAdjustmentDialog,
  setShowPriceAdjustmentDialog,
  priceAdjustmentItems,
  setPriceAdjustmentItems,
  editingAdjustmentId,
  setEditingAdjustmentId,
  isAdjustingPrice,
  deletingAdjustmentId,
  updateBillingStatus,
  updateEntryDueDate,
  regenerateBoleto,
  openQuoteFromEntry,
  addPriceAdjustmentItem,
  removePriceAdjustmentItem,
  updatePriceAdjustmentItem,
  adjustQuotePriceForEntry,
  setAdjustmentToDelete,
  setShowAdjustmentDeleteConfirm,
}: EntryDetailDialogProps) {
  const openOficio = useFinancialDocument(selectedEntry?.id ?? null)
  return (
    <Dialog.Root
      open={!!selectedEntry}
      onOpenChange={(open) => !open && setSelectedEntry(null)}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-4xl ring-0"
          data-nested-parent={nestedDialogOpen ? '' : undefined}
        >
          <Dialog.Content className="relative">
            {nestedDialogOpen && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
              />
            )}
            <Dialog.Header>
              <Dialog.HeaderIcon className="overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-orange-500">
                {(() => {
                  const i = getInitials(selectedEntry?.customerName ?? '')
                  return i ? (
                    <span className="text-xs font-semibold text-white select-none">
                      {i}
                    </span>
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )
                })()}
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-xl font-semibold text-gray-800">
                Detalhes do Lançamento - {selectedEntry?.customerName}
              </Dialog.Title>
              <div className="ml-auto mr-8 flex flex-col items-center gap-2">
                {selectedEntry?.billingStatus && (
                  <span
                    className={statusBadgeClass[selectedEntry.billingStatus]}
                  >
                    {statusLabel[selectedEntry.billingStatus]}
                  </span>
                )}
                {selectedEntry?.dueDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Venc. {formatDate(selectedEntry.dueDate)}</span>
                  </div>
                )}
              </div>
              <Dialog.CloseButton />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {selectedEntry && (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
                      {/* COLUNA ESQUERDA: Cliente + Valores Financeiros + Status Financeiro */}
                      <div className="min-w-0 space-y-4">
                        {/* Informações do Cliente */}
                        <Card className="border border-slate-200 bg-slate-50/60 shadow-md">
                          <CardContent className="p-0">
                            <div className="space-y-2 p-5">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-200 bg-slate-100">
                                  <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-500 to-orange-500 text-sm font-semibold text-white shadow-sm">
                                    {getInitials(
                                      selectedEntry.customerName
                                    ) || <User className="h-5 w-5" />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                    {selectedEntry.customerName}
                                  </p>
                                  {selectedEntry.customerEmail && (
                                    <p className="mt-0.5 text-xs text-slate-600 sm:text-sm truncate">
                                      {selectedEntry.customerEmail}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="border-t border-slate-200">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Nome
                                  </p>
                                  <p className="mt-0.5 text-sm text-slate-900">
                                    {selectedEntry.customerName}
                                  </p>
                                </div>
                              </div>
                              {selectedEntry.customerEmail && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                      Email
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-900">
                                      {selectedEntry.customerEmail}
                                    </p>
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Documento ({selectedEntry.taxDocumentType})
                                  </p>
                                  <p className="mt-0.5 text-sm text-slate-900">
                                    {selectedEntry.customerDocument
                                      ? formatDocument(
                                          selectedEntry.customerDocument
                                        )
                                      : '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Código do Orçamento
                                  </p>
                                  <p className="mt-0.5 font-mono text-sm text-slate-900">
                                    {selectedEntry.quoteCode ||
                                      selectedEntry.quoteId ||
                                      '-'}
                                  </p>
                                  {selectedEntry.legacyExternalCode && (
                                    <p className="text-xs text-slate-500">
                                      Legado: {selectedEntry.legacyExternalCode}
                                    </p>
                                  )}
                                  {(selectedEntry.quoteCode ||
                                    selectedEntry.legacyExternalCode ||
                                    selectedEntry.quoteId) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 h-8 px-3 text-xs w-full sm:w-auto gap-1.5 border-slate-200 text-slate-700"
                                      onClick={() =>
                                        openQuoteFromEntry(selectedEntry)
                                      }
                                    >
                                      Ver orçamento
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Valores Financeiros */}
                        <Card className="rounded-lg text-card-foreground border border-slate-200 bg-slate-50/40 shadow-md">
                          <CardContent className="p-0">
                            <div className="space-y-2 p-5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg text-white shrink-0">
                                  <DollarSign className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                    Valores Financeiros
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="border-t border-slate-200">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    VALOR BRUTO
                                  </p>
                                  <p className="mt-0.5 text-lg font-bold text-green-600">
                                    {formatCurrency(selectedEntry.grossAmount)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    VALOR LÍQUIDO
                                  </p>
                                  <p className="mt-0.5 text-lg font-bold text-blue-600">
                                    {formatCurrency(selectedEntry.netAmount)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    TAXA DE RETENÇÃO
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold text-slate-900">
                                    {selectedEntry.taxRate}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Status e Alteração */}
                        <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md">
                          <CardContent className="p-0">
                            <div className="space-y-2 p-5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white shrink-0">
                                  <Settings className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                    Status Financeiro
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="border-t border-orange-200">
                              <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
                                <div className="flex flex-wrap items-center gap-4">
                                  <div className="shrink-0">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-1.5">
                                      Status Atual
                                    </p>
                                    <StatusTooltip
                                      status={selectedEntry.billingStatus}
                                      label={
                                        statusLabel[selectedEntry.billingStatus]
                                      }
                                      className={
                                        statusBadgeClass[
                                          selectedEntry.billingStatus
                                        ]
                                      }
                                    />
                                  </div>
                                  <div className="flex-1 min-w-[180px]">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-1.5">
                                      Alterar Status
                                    </p>
                                    <Select
                                      value={selectedEntry.billingStatus}
                                      onValueChange={(value: BillingStatus) => {
                                        updateBillingStatus(
                                          selectedEntry.id,
                                          value
                                        )
                                        setSelectedEntry({
                                          ...selectedEntry,
                                          billingStatus: value,
                                        })
                                      }}
                                      disabled={
                                        savingStatusId === selectedEntry.id
                                      }
                                    >
                                      <SelectTrigger className="h-9 w-full bg-white">
                                        <SelectValue placeholder="Selecione o status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PAID">
                                          Pago
                                        </SelectItem>
                                        <SelectItem value="UNPAID">
                                          Não Pago
                                        </SelectItem>
                                        <SelectItem value="AWAITING_PAYMENT">
                                          Aguardando Pagamento
                                        </SelectItem>
                                        <SelectItem value="SETTLED">
                                          Baixado
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-orange-200">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-2">
                                    Alterar Vencimento
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <DatePicker
                                      date={
                                        dueDateDraft
                                          ? new Date(dueDateDraft + 'T00:00:00')
                                          : undefined
                                      }
                                      onDateChange={(d) =>
                                        setDueDateDraft(
                                          d
                                            ? formatDateForInput(
                                                d.toISOString()
                                              )
                                            : ''
                                        )
                                      }
                                      disabled={
                                        savingDueDateId === selectedEntry.id
                                      }
                                      placeholder="Selecione a data"
                                      className="h-9 w-auto hover:scale-100 bg-white"
                                    />
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-9 shrink-0 text-sm hover:scale-100"
                                      disabled={
                                        !dueDateDraft ||
                                        savingDueDateId === selectedEntry.id ||
                                        dueDateDraft ===
                                          formatDateForInput(
                                            selectedEntry.dueDate
                                          )
                                      }
                                      onClick={() =>
                                        updateEntryDueDate(
                                          selectedEntry.id,
                                          dueDateDraft
                                        )
                                      }
                                    >
                                      {savingDueDateId === selectedEntry.id
                                        ? 'Salvando...'
                                        : 'Salvar'}
                                    </Button>
                                  </div>
                                </div>

                                {/* Regenerar Boleto — visível quando vencido e não pago */}
                                {selectedEntry.dueDate &&
                                  new Date(selectedEntry.dueDate) <
                                    new Date() &&
                                  selectedEntry.billingStatus !== 'PAID' &&
                                  selectedEntry.billingStatus !== 'SETTLED' && (
                                    <div className="pt-2 border-t border-orange-200">
                                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900 mb-2">
                                        Boleto Vencido
                                      </p>
                                      <p className="text-xs text-slate-600 mb-3">
                                        O boleto deste lançamento está vencido.
                                        Você pode regenerar um novo boleto com
                                        nova data de vencimento.
                                      </p>
                                      <Button
                                        variant="outline"
                                        size="default"
                                        className="w-full border-gray-200 bg-background shadow-md hover:text-orange-600 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
                                        disabled={
                                          regeneratingBoletoId ===
                                          selectedEntry.id
                                        }
                                        onClick={() =>
                                          regenerateBoleto(selectedEntry.id)
                                        }
                                      >
                                        {regeneratingBoletoId ===
                                        selectedEntry.id ? (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Regenerando...
                                          </>
                                        ) : (
                                          <>
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                            Regenerar Boleto
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* COLUNA DIREITA: Datas + Tributário */}
                      <div className="space-y-4 min-w-0">
                        {/* Datas */}
                        <Card className="border border-slate-200 bg-slate-50/60 shadow-md">
                          <CardContent className="p-0">
                            <div className="space-y-2 p-5">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white shrink-0">
                                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                    Datas
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="border-t border-slate-200">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Vencimento
                                  </p>
                                  <p className="mt-0.5 text-sm text-slate-900">
                                    {formatDate(selectedEntry.dueDate)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Boleto Emitido
                                  </p>
                                  <p className="mt-0.5 text-sm text-slate-900">
                                    {formatDate(selectedEntry.boletoIssuedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Nota Fiscal Emitida
                                  </p>
                                  <p className="mt-0.5 text-sm text-slate-900">
                                    {formatDate(selectedEntry.invoiceIssuedAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                    Data de Pagamento
                                  </p>
                                  <p
                                    className={`mt-0.5 text-sm ${selectedEntry.paidAt ? 'text-green-600 font-semibold' : 'text-slate-900'}`}
                                  >
                                    {formatDate(selectedEntry.paidAt)}
                                  </p>
                                </div>
                              </div>
                              {selectedEntry.settledAt && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                      Data de Baixa
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-900">
                                      {formatDate(selectedEntry.settledAt)}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {selectedEntry.invoiceNumber && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                      Nº da Nota Fiscal
                                    </p>
                                    <p className="mt-0.5 text-sm text-slate-900">
                                      {selectedEntry.invoiceNumber}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Detalhamento Tributário */}
                        {selectedEntry.taxBreakdown &&
                          selectedEntry.taxBreakdown.length > 0 && (
                            <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-amber-50 to-amber-100 shadow-md">
                              <CardContent className="p-0">
                                <div className="space-y-2 p-5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg text-white shrink-0">
                                      <Shield className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                        Detalhamento Tributário
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-amber-200">
                                  <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                          Tipo de Operação
                                        </p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                                          {selectedEntry.operationType
                                            ? OPERATION_TYPE_LABELS[
                                                selectedEntry.operationType
                                              ] || selectedEntry.operationType
                                            : 'Não classificada'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                          Regime Tributário
                                        </p>
                                        <p className="mt-0.5 text-sm font-medium text-slate-900">
                                          {selectedEntry.taxRegimeSnapshot
                                            ? REGIME_LABELS[
                                                selectedEntry.taxRegimeSnapshot as TaxRegime
                                              ] ||
                                              selectedEntry.taxRegimeSnapshot
                                            : '-'}
                                        </p>
                                      </div>
                                    </div>

                                    {(selectedEntry.rentalAmount != null ||
                                      selectedEntry.serviceAmount != null) && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                            Valor de Locação
                                          </p>
                                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                                            {selectedEntry.rentalAmount != null
                                              ? formatCurrency(
                                                  selectedEntry.rentalAmount
                                                )
                                              : '-'}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                            Valor de Serviço
                                          </p>
                                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                                            {selectedEntry.serviceAmount !=
                                              null &&
                                            selectedEntry.serviceAmount > 0
                                              ? formatCurrency(
                                                  selectedEntry.serviceAmount
                                                )
                                              : '-'}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    <div className="border border-amber-200 rounded-lg overflow-hidden bg-white/60">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-amber-50/80 border-b border-amber-200">
                                            <th className="text-left p-2.5 font-medium text-slate-700 text-xs uppercase tracking-wider">
                                              Imposto
                                            </th>
                                            <th className="text-right p-2.5 font-medium text-slate-700 text-xs uppercase tracking-wider">
                                              Base
                                            </th>
                                            <th className="text-right p-2.5 font-medium text-slate-700 text-xs uppercase tracking-wider">
                                              Alíquota
                                            </th>
                                            <th className="text-right p-2.5 font-medium text-slate-700 text-xs uppercase tracking-wider">
                                              Valor
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {selectedEntry.taxBreakdown.map(
                                            (line, idx) => (
                                              <tr
                                                key={idx}
                                                className="border-b border-amber-100 last:border-b-0"
                                              >
                                                <td className="p-2.5 text-slate-700">
                                                  {line.label}
                                                  {line.exempt && (
                                                    <span className="ml-2 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                                                      Isento
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="p-2.5 text-right text-slate-600">
                                                  R$ {line.baseAmount}
                                                </td>
                                                <td className="p-2.5 text-right text-slate-600">
                                                  {line.exempt
                                                    ? '-'
                                                    : `${line.rate}%`}
                                                </td>
                                                <td
                                                  className={`p-2.5 text-right font-medium ${line.exempt ? 'text-slate-400' : 'text-slate-800'}`}
                                                >
                                                  R$ {line.amount}
                                                </td>
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                        {/* Reajuste — visível quando entry tem quoteId e não está pago */}
                        {selectedEntry.quoteId &&
                          selectedEntry.billingStatus !== 'PAID' &&
                          selectedEntry.billingStatus !== 'SETTLED' && (
                            <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-blue-50 to-blue-100 shadow-md">
                              <CardContent className="p-0">
                                <div className="space-y-2 p-5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shrink-0">
                                      <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                                        Reajuste
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-blue-200">
                                  <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
                                    {/* Histórico de Reajustes */}
                                    {adjustmentHistory.length > 0 && (
                                      <div className="space-y-4 border-t-2 border-blue-200 pt-4">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                          Histórico de Reajustes
                                        </p>
                                        <div className="mt-2 space-y-3">
                                          {adjustmentHistory.map((adj) => (
                                            <div
                                              key={adj.id}
                                              className="flex flex-col bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden"
                                            >
                                              {/* Header */}
                                              <div className="flex items-center gap-2.5 border-b border-slate-100 p-4">
                                                <Avatar className="h-10 w-10 shrink-0 rounded-full border-2 border-slate-200 bg-slate-100">
                                                  {adj.createdByUser?.image ? (
                                                    <AvatarImage
                                                      src={
                                                        adj.createdByUser.image
                                                      }
                                                      alt=""
                                                      className="object-cover"
                                                    />
                                                  ) : null}
                                                  <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-500 to-orange-500 text-xs font-semibold text-white shadow-sm">
                                                    {getInitials(
                                                      adj.createdByUser?.name ??
                                                        'Admin'
                                                    ) || (
                                                      <User className="h-4 w-4" />
                                                    )}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                  <p className="truncate text-sm font-semibold text-slate-900">
                                                    {adj.createdByUser?.name ??
                                                      'Administrador'}
                                                  </p>
                                                  <p className="mt-0.5 truncate text-xs text-slate-600">
                                                    {adj.createdByUser?.email ??
                                                      '—'}
                                                  </p>
                                                  {adj.createdAt && (
                                                    <p className="mt-1 text-xs text-slate-600">
                                                      Ajustado em:{' '}
                                                      {new Date(
                                                        adj.createdAt
                                                      ).toLocaleString('pt-BR')}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              {/* Content */}
                                              <div className="flex flex-col gap-3 p-4">
                                                <div className="flex flex-col gap-0.5 pb-3 border-b border-slate-100">
                                                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                                    {ADJUSTMENT_CATEGORY_LABELS[
                                                      adj.category
                                                    ] || adj.category}
                                                  </span>
                                                  <span className="text-sm text-slate-900">
                                                    {formatCurrency(adj.amount)}
                                                  </span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 pt-3">
                                                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-900">
                                                    Justificativa
                                                  </span>
                                                  <p className="mt-0.5 text-sm text-slate-700">
                                                    {adj.justification}
                                                  </p>
                                                </div>
                                              </div>
                                              {/* Action Buttons */}
                                              {selectedEntry?.quoteId && (
                                                <div className="flex w-full items-center gap-2 border-t border-slate-200 pt-3 mt-2 px-4 pb-4">
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                                                    onClick={() => {
                                                      setAdjustmentToDelete({
                                                        id: adj.id,
                                                        quoteId:
                                                          selectedEntry.quoteId!,
                                                      })
                                                      setShowAdjustmentDeleteConfirm(
                                                        true
                                                      )
                                                    }}
                                                    disabled={
                                                      deletingAdjustmentId ===
                                                      adj.id
                                                    }
                                                    aria-label="Remover reajuste"
                                                  >
                                                    {deletingAdjustmentId ===
                                                    adj.id ? (
                                                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                                    ) : (
                                                      <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                                    )}
                                                    Remover
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 flex-1 min-w-0 text-xs border-slate-200 text-slate-700"
                                                    onClick={() => {
                                                      const parsed =
                                                        adj.category ===
                                                          'OTHER' &&
                                                        adj.justification.includes(
                                                          ': '
                                                        )
                                                          ? (() => {
                                                              const idx =
                                                                adj.justification.indexOf(
                                                                  ': '
                                                                )
                                                              return {
                                                                categoryOther:
                                                                  adj.justification.slice(
                                                                    0,
                                                                    idx
                                                                  ),
                                                                reason:
                                                                  adj.justification.slice(
                                                                    idx + 2
                                                                  ),
                                                              }
                                                            })()
                                                          : {
                                                              categoryOther:
                                                                undefined,
                                                              reason:
                                                                adj.justification,
                                                            }
                                                      setEditingAdjustmentId(
                                                        adj.id
                                                      )
                                                      setPriceAdjustmentItems([
                                                        {
                                                          id: adj.id,
                                                          category:
                                                            adj.category as PriceAdjustmentItem['category'],
                                                          categoryOther:
                                                            parsed.categoryOther,
                                                          value: adj.amount,
                                                          reason: parsed.reason,
                                                        },
                                                      ])
                                                      setShowPriceAdjustmentDialog(
                                                        true
                                                      )
                                                    }}
                                                    aria-label="Editar reajuste"
                                                  >
                                                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                                                    Editar
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="default"
                                      className="w-full border-gray-200 bg-background shadow-md hover:text-orange-600 hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
                                      onClick={() => {
                                        setPriceAdjustmentItems([
                                          createDefaultAdjustmentItem(),
                                        ])
                                        setShowPriceAdjustmentDialog(true)
                                      }}
                                      disabled={isAdjustingPrice}
                                    >
                                      <TrendingUp className="h-4 w-4 mr-2" />
                                      Aplicar Reajuste
                                    </Button>

                                    <Dialog.Root
                                      open={showPriceAdjustmentDialog}
                                      onOpenChange={(open) => {
                                        setShowPriceAdjustmentDialog(open)
                                        if (!open) setEditingAdjustmentId(null)
                                      }}
                                    >
                                      <Dialog.Portal>
                                        <Dialog.Backdrop />
                                        <Dialog.Popup
                                          variant="default"
                                          className="max-w-xl max-h-[90vh] md:max-h-[85vh]"
                                        >
                                          <Dialog.Content>
                                            <Dialog.Header className="flex-col items-start gap-2">
                                              <Dialog.CloseButton aria-label="Fechar dialog" />
                                              <div className="flex min-w-0 flex-1 items-center gap-3 pr-10">
                                                <Dialog.HeaderIcon>
                                                  <DollarSign className="w-4 h-4" />
                                                </Dialog.HeaderIcon>
                                                <Dialog.Title className="min-w-0 break-words text-xl font-semibold text-gray-900">
                                                  Registrar Reajuste de
                                                  Orçamento
                                                </Dialog.Title>
                                              </div>
                                              <Dialog.Description className="text-sm text-gray-600">
                                                Adicione um custo complementar
                                                por categoria. O reajuste
                                                atualiza o total e é enviado
                                                automaticamente ao cliente por
                                                e-mail e WhatsApp (quando
                                                disponível).
                                              </Dialog.Description>
                                            </Dialog.Header>
                                            <Dialog.Body>
                                              <Dialog.BodyViewport
                                                className="max-h-[45vh] overflow-y-auto"
                                                style={{
                                                  scrollbarGutter: 'stable',
                                                }}
                                              >
                                                <Dialog.BodyContent className="space-y-4">
                                                  <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                                    <Label htmlFor="original-value">
                                                      Valor Original do
                                                      Orçamento
                                                    </Label>
                                                    <Input
                                                      id="original-value"
                                                      value={formatCurrency(
                                                        selectedEntry.grossAmount ??
                                                          0
                                                      )}
                                                      readOnly
                                                      className="mt-1 bg-white"
                                                    />
                                                  </div>
                                                  <div className="bg-white/50 border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                                                    {priceAdjustmentItems.map(
                                                      (item, index) => (
                                                        <div
                                                          key={item.id}
                                                          className={cn(
                                                            'space-y-4 rounded-md p-3',
                                                            index > 0 &&
                                                              'border-t border-gray-200 pt-4'
                                                          )}
                                                        >
                                                          {!editingAdjustmentId && (
                                                            <div className="flex items-center justify-between gap-2">
                                                              <span className="text-[16px] font-bold text-gray-900">
                                                                Item {index + 1}{' '}
                                                                de{' '}
                                                                {
                                                                  priceAdjustmentItems.length
                                                                }
                                                              </span>
                                                              {priceAdjustmentItems.length >
                                                                1 && (
                                                                <Button
                                                                  type="button"
                                                                  variant="ghost"
                                                                  size="icon"
                                                                  onClick={() =>
                                                                    removePriceAdjustmentItem(
                                                                      item.id
                                                                    )
                                                                  }
                                                                  className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                                                                  aria-label="Remover item de reajuste"
                                                                >
                                                                  <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                              )}
                                                            </div>
                                                          )}
                                                          <div>
                                                            <Label
                                                              htmlFor={`adjustment-category-${item.id}`}
                                                            >
                                                              Categoria do
                                                              Reajuste{' '}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <Select
                                                              value={
                                                                item.category ||
                                                                undefined
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                updatePriceAdjustmentItem(
                                                                  item.id,
                                                                  {
                                                                    category:
                                                                      value as
                                                                        | 'LABOR'
                                                                        | 'TRAVEL'
                                                                        | 'MAINTENANCE'
                                                                        | 'OTHER',
                                                                    categoryOther:
                                                                      value ===
                                                                      'OTHER'
                                                                        ? (item.categoryOther ??
                                                                          '')
                                                                        : undefined,
                                                                  }
                                                                )
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
                                                                  const used =
                                                                    priceAdjustmentItems
                                                                      .filter(
                                                                        (i) =>
                                                                          i.id !==
                                                                            item.id &&
                                                                          i.category !==
                                                                            ''
                                                                      )
                                                                      .map(
                                                                        (i) =>
                                                                          i.category
                                                                      )
                                                                  return (
                                                                    <>
                                                                      <SelectItem
                                                                        value="LABOR"
                                                                        disabled={used.includes(
                                                                          'LABOR'
                                                                        )}
                                                                      >
                                                                        Mão de
                                                                        obra
                                                                      </SelectItem>
                                                                      <SelectItem
                                                                        value="TRAVEL"
                                                                        disabled={used.includes(
                                                                          'TRAVEL'
                                                                        )}
                                                                      >
                                                                        Deslocamento
                                                                        (Frete)
                                                                      </SelectItem>
                                                                      <SelectItem
                                                                        value="MAINTENANCE"
                                                                        disabled={used.includes(
                                                                          'MAINTENANCE'
                                                                        )}
                                                                      >
                                                                        Manutenção
                                                                      </SelectItem>
                                                                      <SelectItem
                                                                        value="OTHER"
                                                                        disabled={used.includes(
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
                                                            {item.category ===
                                                              'OTHER' && (
                                                              <div className="mt-3">
                                                                <Label
                                                                  htmlFor={`adjustment-category-other-${item.id}`}
                                                                >
                                                                  Especifique a
                                                                  categoria{' '}
                                                                  <span className="text-red-500">
                                                                    *
                                                                  </span>
                                                                </Label>
                                                                <Input
                                                                  id={`adjustment-category-other-${item.id}`}
                                                                  value={
                                                                    item.categoryOther ??
                                                                    ''
                                                                  }
                                                                  onChange={(
                                                                    e
                                                                  ) =>
                                                                    updatePriceAdjustmentItem(
                                                                      item.id,
                                                                      {
                                                                        categoryOther:
                                                                          e
                                                                            .target
                                                                            .value,
                                                                      }
                                                                    )
                                                                  }
                                                                  placeholder="Ex: Taxa de portaria..."
                                                                  className="mt-1"
                                                                />
                                                              </div>
                                                            )}
                                                          </div>
                                                          <div>
                                                            <Label
                                                              htmlFor={`final-value-${item.id}`}
                                                            >
                                                              Valor adicional{' '}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <CurrencyInput
                                                              id={`final-value-${item.id}`}
                                                              value={item.value}
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                updatePriceAdjustmentItem(
                                                                  item.id,
                                                                  {
                                                                    value:
                                                                      value ||
                                                                      0,
                                                                  }
                                                                )
                                                              }
                                                              className="mt-1"
                                                            />
                                                          </div>
                                                          <div>
                                                            <Label
                                                              htmlFor={`adjustment-reason-${item.id}`}
                                                            >
                                                              Justificativa do
                                                              Ajuste{' '}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <Textarea
                                                              id={`adjustment-reason-${item.id}`}
                                                              value={
                                                                item.reason
                                                              }
                                                              onChange={(e) =>
                                                                updatePriceAdjustmentItem(
                                                                  item.id,
                                                                  {
                                                                    reason:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              placeholder="Ex: Taxa de quebra/avaria..."
                                                              rows={3}
                                                              className="mt-1"
                                                              required
                                                            />
                                                          </div>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                  {!editingAdjustmentId && (
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      onClick={
                                                        addPriceAdjustmentItem
                                                      }
                                                      className="w-fit px-4 bg-transparent border-gray-200 hover:bg-background hover:scale-105"
                                                    >
                                                      <Plus className="h-4 w-4 mr-2" />
                                                      Adicionar reajuste
                                                    </Button>
                                                  )}
                                                  {priceAdjustmentItems.length >
                                                    0 && (
                                                    <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md text-card-foreground">
                                                      <CardContent className="p-0">
                                                        <div className="space-y-6 px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
                                                          <div className="flex justify-between items-center text-sm">
                                                            <span className="font-medium text-gray-700">
                                                              Total dos
                                                              reajustes (
                                                              {
                                                                priceAdjustmentItems.length
                                                              }{' '}
                                                              {priceAdjustmentItems.length ===
                                                              1
                                                                ? 'item'
                                                                : 'itens'}
                                                              )
                                                            </span>
                                                            <span className="font-semibold text-gray-900">
                                                              {formatCurrency(
                                                                priceAdjustmentItems.reduce(
                                                                  (s, i) =>
                                                                    s +
                                                                    (Number.isFinite(
                                                                      i.value
                                                                    )
                                                                      ? i.value
                                                                      : 0),
                                                                  0
                                                                )
                                                              )}
                                                            </span>
                                                          </div>
                                                          <div className="flex justify-between items-center text-sm pt-1 border-t border-orange-200/80">
                                                            <span className="font-medium text-gray-700">
                                                              Novo valor final
                                                            </span>
                                                            <span className="font-semibold text-orange-600">
                                                              {formatCurrency(
                                                                (selectedEntry.grossAmount ??
                                                                  0) +
                                                                  priceAdjustmentItems.reduce(
                                                                    (s, i) =>
                                                                      s +
                                                                      (Number.isFinite(
                                                                        i.value
                                                                      )
                                                                        ? i.value
                                                                        : 0),
                                                                    0
                                                                  )
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
                                                disabled={isAdjustingPrice}
                                                onClick={() => {
                                                  setPriceAdjustmentItems(
                                                    () => [
                                                      createDefaultAdjustmentItem(),
                                                    ]
                                                  )
                                                  setShowPriceAdjustmentDialog(
                                                    false
                                                  )
                                                  setEditingAdjustmentId(null)
                                                }}
                                                className="w-full"
                                              >
                                                Cancelar
                                              </Button>
                                              <Button
                                                variant="default"
                                                onClick={() =>
                                                  selectedEntry?.quoteId &&
                                                  adjustQuotePriceForEntry(
                                                    selectedEntry.quoteId
                                                  )
                                                }
                                                disabled={
                                                  isAdjustingPrice ||
                                                  priceAdjustmentItems.length ===
                                                    0 ||
                                                  priceAdjustmentItems.some(
                                                    (it) =>
                                                      !it.category ||
                                                      !it.reason.trim() ||
                                                      isNaN(it.value) ||
                                                      it.value <= 0 ||
                                                      (it.category ===
                                                        'OTHER' &&
                                                        (!it.categoryOther ||
                                                          !it.categoryOther.trim()))
                                                  )
                                                }
                                                className="w-full"
                                              >
                                                {isAdjustingPrice
                                                  ? 'Registrando...'
                                                  : 'Registrar Reajuste'}
                                              </Button>
                                            </Dialog.Footer>
                                          </Dialog.Content>
                                        </Dialog.Popup>
                                      </Dialog.Portal>
                                    </Dialog.Root>
                                    {loadingAdjustments && (
                                      <p className="text-xs text-slate-400 text-center py-2">
                                        Carregando reajustes...
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                      </div>
                    </div>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            <Dialog.Footer>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={openOficio}
                >
                  <FileText className="w-4 h-4" />
                  Gerar Ofício
                </Button>
                <Button variant="outline" asChild>
                  <Dialog.Close>Fechar</Dialog.Close>
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
