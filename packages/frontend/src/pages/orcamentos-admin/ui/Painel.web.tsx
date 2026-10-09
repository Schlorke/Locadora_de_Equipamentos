'use client'

import {
  quoteCustomerDraft,
  quoteDeliveryDraft,
  quoteItemDraft,
  quoteAdjustmentDraft,
} from '../model/editors'
import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import {
  XCircle,
  CheckCircle,
  User,
  Mail,
  Trash2,
  Download,
  Loader2,
  Receipt,
  AlertTriangle,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
import { useMemo } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminQuoteDocumentsApi } from '../api/admin-documents'
import { getInitials } from '../../../shared/lib/formatting'
import {
  formatCurrency,
  formatDateForInput,
} from '../../../shared/lib/formatting'
import {
  formatDate,
  normalizeStatus,
  getCardStatusBadge,
  getBoletoPayment,
  formatPaymentStatus,
  getBoletoStatusBadgeClassName,
} from '../../../entities/orcamento'
import {
  type Quote,
  type QuotePaymentTerms,
  type QuoteAdjustmentFromApi,
  type PriceAdjustmentItem,
  createDefaultAdjustmentItem,
} from '../../../entities/orcamento'

// Sub-components
import { QuoteCustomerCard } from './Cliente.web'
import { QuoteDeliveryCard } from './Entrega.web'
import { QuoteBoletoCard } from './Boleto.web'
import { QuoteRejectionCard } from './Rejeicao.web'
import { QuoteItemsCard } from '../../../widgets/itens-orcamento'

// Dialogs
import { DeleteDialog } from './Excluir.web'
import { RejectDialog } from './Rejeitar.web'
import { RemoveApprovalDialog } from './RemoverAprovacao.web'
import { RemoveItemConfirm } from './RemoverItem.web'
import { RemoveAdjustmentConfirm } from './RemoverReajuste.web'
import { LateFeeDialog, type CalculatedLateFee } from './Multa.web'
import { EditCustomerDialog, type EditCustomerDraft } from './EditarCliente.web'
import { EditDeliveryDialog, type EditDeliveryDraft } from './EditarEntrega.web'
import {
  EditItemDatesDialog,
  type QuoteItemType,
  type EditItemDatesDraft,
  type EditItemPreview,
  type CalendarRange,
  type RangeModifiers,
} from './EditarPeriodo.web'
import { PriceAdjustmentDialog } from './Reajuste.web'

// ─── Props ────────────────────────────────────────────────────────

export interface QuoteDetailPanelProps {
  // Core state
  selectedQuote: Quote | null
  setSelectedQuote: (_q: Quote | null) => void
  selectedQuoteAdjustments: QuoteAdjustmentFromApi[]
  nestedDialogOpen: boolean

  // Dialog visibility states
  showDeleteDialog: boolean
  setShowDeleteDialog: (_v: boolean) => void
  showRejectDialog: boolean
  setShowRejectDialog: (_v: boolean) => void
  showRemoveApprovalDialog: boolean
  setShowRemoveApprovalDialog: (_v: boolean) => void
  removeConfirmItemId: string | null
  setRemoveConfirmItemId: (_v: string | null) => void
  removeConfirmAdjustmentId: string | null
  setRemoveConfirmAdjustmentId: (_v: string | null) => void
  showLateFeeDialog: boolean
  setShowLateFeeDialog: (_v: boolean) => void
  showEditPeriodEmailPhoneDialog: boolean
  setShowEditPeriodEmailPhoneDialog: (_v: boolean) => void
  showEditItemDatesDialog: boolean
  setShowEditItemDatesDialog: (_v: boolean) => void
  showEditDeliveryDialog: boolean
  setShowEditDeliveryDialog: (_v: boolean) => void
  showPriceAdjustmentDialog: boolean
  setShowPriceAdjustmentDialog: (_v: boolean) => void

  // Reject dialog state
  rejectWithReason: boolean
  setRejectWithReason: (_v: boolean) => void
  rejectionReason: string
  setRejectionReason: (_v: string) => void

  // Edit customer dialog state
  editPeriodEmailPhoneDraft: EditCustomerDraft
  setEditPeriodEmailPhoneDraft: (
    _updater: (_prev: EditCustomerDraft) => EditCustomerDraft
  ) => void
  isSavingPeriodEmailPhone: boolean

  // Edit delivery dialog state
  editDeliveryDraft: EditDeliveryDraft
  setEditDeliveryDraft: (
    _updater: (_prev: EditDeliveryDraft) => EditDeliveryDraft
  ) => void
  isSavingDelivery: boolean
  formatCEP: (_val: string) => string

  // Edit item dates dialog state
  editingQuoteItem: QuoteItemType | null
  setEditingQuoteItem: (_v: QuoteItemType | null) => void
  editItemDatesDraft: EditItemDatesDraft
  setEditItemDatesDraft: (
    _updater: (_prev: EditItemDatesDraft) => EditItemDatesDraft
  ) => void
  isSavingItemDates: boolean
  editItemDatesRangeModifiers: RangeModifiers | null
  editItemPreview: EditItemPreview | null
  editPeriodCalendarRange: CalendarRange

  // Price adjustment dialog state
  priceAdjustmentItems: PriceAdjustmentItem[]
  isAdjustingPrice: boolean
  editingAdjustmentId: string | null
  setEditingAdjustmentId: (_v: string | null) => void
  setPriceAdjustmentItems: (_items: PriceAdjustmentItem[]) => void

  // Boleto state
  boletoDueDateDraft: string
  setBoletoDueDateDraft: (_v: string) => void
  updatingBoletoDueDateId: string | null
  generatingBoletoId: string | null
  approvalPaymentTerms: QuotePaymentTerms
  setApprovalPaymentTerms: (_v: QuotePaymentTerms) => void

  // Operation type state
  editOperationType: 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
  setEditOperationType: (_v: 'PURE_RENTAL' | 'RENTAL_WITH_SERVICE') => void
  isSavingOperationType: boolean

  // Loading/action states
  isUpdating: boolean
  updatingAction: 'approved' | 'rejected' | null
  isDeleting: boolean
  isSendingAdjustedQuote: boolean
  isCalculatingLateFee: boolean
  calculatedLateFee: CalculatedLateFee | null
  setCalculatedLateFee: (_v: CalculatedLateFee | null) => void
  isRemovingApproval: boolean
  removingItemId: string | null
  removingAdjustmentId: string | null

  // Action handlers
  handleRejectClick: () => void
  handleConfirmReject: () => void
  deleteQuote: (_id: string) => void
  updateQuoteStatus: (
    _id: string,
    _status: 'approved' | 'rejected',
    _reason?: string,
    _terms?: QuotePaymentTerms
  ) => void
  savePeriodEmailPhone: () => void
  saveItemDates: () => void
  saveDelivery: () => void
  removeItemFromQuote: (_quoteId: string, _itemId: string) => void
  adjustQuotePrice: (_quoteId: string) => void
  calculateLateFee: (_quoteId: string) => void
  approveLateFee: (_quoteId: string) => void
  removeApproval: (_quoteId: string) => void
  handleGenerateBoleto: (_quoteId: string) => void
  handleUpdateBoletoDueDate: (
    _quoteId: string,
    _paymentId: string,
    _dueDate: string
  ) => void
  handleSendAdjustedQuote: (_quoteId: string) => void
  handleRemoveAdjustment: (_quoteId: string, _adjustmentId: string) => void
  saveOperationType: (_quoteId: string) => void
  addPriceAdjustmentItem: () => void
  removePriceAdjustmentItem: (_id: string) => void
  updatePriceAdjustmentItem: (
    _id: string,
    _patch: Partial<PriceAdjustmentItem>
  ) => void
  openFinancialFromQuote: (_quote: Quote) => void

  // Computed values (passed to avoid recalculating)
  shouldShowAdjustedSendButton: boolean
}

// ─── Component ────────────────────────────────────────────────────

export function QuoteDetailPanel(props: QuoteDetailPanelProps) {
  const {
    selectedQuote,
    setSelectedQuote,
    selectedQuoteAdjustments,
    nestedDialogOpen,

    showDeleteDialog,
    setShowDeleteDialog,
    showRejectDialog,
    setShowRejectDialog,
    showRemoveApprovalDialog,
    setShowRemoveApprovalDialog,
    removeConfirmItemId,
    setRemoveConfirmItemId,
    removeConfirmAdjustmentId,
    setRemoveConfirmAdjustmentId,
    showLateFeeDialog,
    setShowLateFeeDialog,
    showEditPeriodEmailPhoneDialog,
    setShowEditPeriodEmailPhoneDialog,
    showEditItemDatesDialog,
    setShowEditItemDatesDialog,
    showEditDeliveryDialog,
    setShowEditDeliveryDialog,
    showPriceAdjustmentDialog,
    setShowPriceAdjustmentDialog,

    rejectWithReason,
    setRejectWithReason,
    rejectionReason,
    setRejectionReason,

    editPeriodEmailPhoneDraft,
    setEditPeriodEmailPhoneDraft,
    isSavingPeriodEmailPhone,

    editDeliveryDraft,
    setEditDeliveryDraft,
    isSavingDelivery,
    formatCEP,

    editingQuoteItem,
    setEditingQuoteItem,
    editItemDatesDraft,
    setEditItemDatesDraft,
    isSavingItemDates,
    editItemDatesRangeModifiers,
    editItemPreview,
    editPeriodCalendarRange,

    priceAdjustmentItems,
    isAdjustingPrice,
    editingAdjustmentId,
    setEditingAdjustmentId,
    setPriceAdjustmentItems,

    boletoDueDateDraft,
    setBoletoDueDateDraft,
    updatingBoletoDueDateId,
    generatingBoletoId,
    approvalPaymentTerms,
    setApprovalPaymentTerms,

    editOperationType,
    setEditOperationType,
    isSavingOperationType,

    isUpdating,
    updatingAction,
    isDeleting,
    isSendingAdjustedQuote,
    isCalculatingLateFee,
    calculatedLateFee,
    setCalculatedLateFee,
    isRemovingApproval,
    removingItemId,
    removingAdjustmentId,

    handleRejectClick,
    handleConfirmReject,
    deleteQuote,
    updateQuoteStatus,
    savePeriodEmailPhone,
    saveItemDates,
    saveDelivery,
    removeItemFromQuote,
    adjustQuotePrice,
    calculateLateFee,
    approveLateFee,
    removeApproval,
    handleGenerateBoleto,
    handleUpdateBoletoDueDate,
    handleSendAdjustedQuote,
    handleRemoveAdjustment,
    saveOperationType,
    addPriceAdjustmentItem,
    removePriceAdjustmentItem,
    updatePriceAdjustmentItem,
    openFinancialFromQuote,

    shouldShowAdjustedSendButton,
  } = props

  // ─── Computed values ──────────────────────────────────────────
  const selectedQuoteStatus = normalizeStatus(selectedQuote?.status)

  const approvedAtValue = selectedQuote?.approvedAt
  const hasSelectedQuoteApproval =
    approvedAtValue != null &&
    (typeof approvedAtValue !== 'string' ||
      (approvedAtValue.trim() !== '' &&
        approvedAtValue.trim() !== 'null' &&
        approvedAtValue.trim() !== 'undefined'))

  const isAdminApproved =
    selectedQuoteStatus === 'pending' && hasSelectedQuoteApproval

  const boletoPayment = getBoletoPayment(selectedQuote)

  const removeItemName =
    selectedQuote?.items?.find((i) => i.id === removeConfirmItemId)?.equipment
      ?.name ?? 'este equipamento'

  // ─── Handlers for sub-components ──────────────────────────────

  const handleEditCustomerClick = () => {
    if (!selectedQuote) return
    setEditPeriodEmailPhoneDraft(() => quoteCustomerDraft(selectedQuote))
    setShowEditPeriodEmailPhoneDialog(true)
  }
  const handleEditDeliveryClick = () => {
    if (!selectedQuote) return
    setEditDeliveryDraft(() =>
      quoteDeliveryDraft(selectedQuote, selectedQuoteAdjustments, formatCEP)
    )
    setShowEditDeliveryDialog(true)
  }
  const handleEditItem = (item: NonNullable<Quote['items']>[number]) => {
    setEditingQuoteItem(item)
    setEditItemDatesDraft(() => quoteItemDraft(item))
    setShowEditItemDatesDialog(true)
  }
  const handleEditAdjustment = (adj: QuoteAdjustmentFromApi) => {
    setEditingAdjustmentId(adj.id)
    setPriceAdjustmentItems([quoteAdjustmentDraft(adj)])
    setShowPriceAdjustmentDialog(true)
  }
  const handleOpenPriceAdjustment = (initialItems: PriceAdjustmentItem[]) => {
    setEditingAdjustmentId(null)
    setPriceAdjustmentItems(initialItems)
    setShowPriceAdjustmentDialog(true)
  }

  const handleRemoveItemConfirm = () => {
    if (selectedQuote?.id && removeConfirmItemId) {
      removeItemFromQuote(selectedQuote.id, removeConfirmItemId)
      setRemoveConfirmItemId(null)
    }
  }

  const handleRemoveAdjustmentConfirm = () => {
    if (selectedQuote?.id && removeConfirmAdjustmentId) {
      handleRemoveAdjustment(selectedQuote.id, removeConfirmAdjustmentId)
    }
  }

  const handleDeliveryFeeChangeFromDialog = (value: number) => {
    setPriceAdjustmentItems(
      priceAdjustmentItems.map((i) =>
        i.category === 'TRAVEL' ? { ...i, value } : i
      )
    )
  }

  const documentClient = useScopedApiClient(selectedQuote?.id ?? null)
  const documentApi = useMemo(
    () => createAdminQuoteDocumentsApi(documentClient),
    [documentClient]
  )

  const handleDownloadAdjustmentPdf = async () => {
    if (!selectedQuote) return
    try {
      const res = await documentApi.adjustments(selectedQuote.id)
      if (!res.ok) {
        toast.error('Erro ao gerar PDF', {
          description: 'Não foi possível gerar o documento de reajuste.',
        })
        return
      }
      const blob = res.blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reajuste-${selectedQuote.quoteCode || selectedQuote.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF gerado com sucesso')
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Error downloading PDF:', error)
      toast.error('Erro ao baixar PDF')
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <Dialog.Root
      open={!!selectedQuote}
      onOpenChange={(open) => !open && setSelectedQuote(null)}
    >
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup
          variant="default"
          data-nested-parent={nestedDialogOpen ? '' : undefined}
          className="max-w-4xl ring-0"
        >
          <Dialog.Content className="relative">
            {nestedDialogOpen && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/45"
              />
            )}

            {/* ─── Header ─────────────────────────────────────── */}
            <Dialog.Header className="flex-wrap items-start gap-2 pr-12 sm:items-center sm:gap-3">
              <Dialog.HeaderIcon className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-orange-500 sm:h-8 sm:w-8">
                {selectedQuote?.customerImage ? (
                  <img
                    src={selectedQuote.customerImage}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  (() => {
                    const i = getInitials(selectedQuote?.name ?? '')
                    return i ? (
                      <span className="text-[10px] font-semibold text-white select-none sm:text-xs">
                        {i}
                      </span>
                    ) : (
                      <User className="h-4 w-4 text-white" />
                    )
                  })()
                )}
              </Dialog.HeaderIcon>
              <Dialog.Title className="min-w-0 flex-1 text-base font-semibold text-gray-800 line-clamp-2 sm:text-xl">
                Detalhes do Orçamento - {selectedQuote?.name}
              </Dialog.Title>
              <div className="flex flex-basis-full flex-col items-start justify-center gap-1.5 self-center sm:basis-auto sm:ml-auto sm:mr-10 sm:items-center">
                {selectedQuote &&
                  (() => {
                    const badge = getCardStatusBadge(selectedQuote)
                    return (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:px-2.5 sm:text-[10px] ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    )
                  })()}
                {selectedQuote?.createdAt && (
                  <div className="flex min-h-[1.25rem] items-center gap-1.5 text-xs text-slate-500 sm:gap-2 sm:text-sm">
                    <span>
                      {formatDate(selectedQuote.createdAt)} às{' '}
                      {new Date(selectedQuote.createdAt).toLocaleTimeString(
                        'pt-BR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </span>
                  </div>
                )}
              </div>
              <Dialog.CloseButton />
            </Dialog.Header>

            {/* ─── Body ───────────────────────────────────────── */}
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {selectedQuote ? (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6 items-start">
                      {/* Coluna esquerda: resumo do cliente + entrega + boleto */}
                      <div className="min-w-0 space-y-4">
                        <QuoteCustomerCard
                          selectedQuote={selectedQuote}
                          onEditClick={handleEditCustomerClick}
                        />

                        <QuoteDeliveryCard
                          selectedQuote={selectedQuote}
                          selectedQuoteAdjustments={selectedQuoteAdjustments}
                          onEditClick={handleEditDeliveryClick}
                        />

                        {(selectedQuoteStatus === 'pending' ||
                          selectedQuoteStatus === 'approved' ||
                          selectedQuoteStatus === 'completed' ||
                          isAdminApproved) && (
                          <QuoteBoletoCard
                            selectedQuote={selectedQuote}
                            selectedQuoteStatus={selectedQuoteStatus}
                            isAdminApproved={isAdminApproved}
                            boletoPayment={boletoPayment}
                            boletoDueDateDraft={boletoDueDateDraft}
                            setBoletoDueDateDraft={setBoletoDueDateDraft}
                            updatingBoletoDueDateId={updatingBoletoDueDateId}
                            generatingBoletoId={generatingBoletoId}
                            approvalPaymentTerms={approvalPaymentTerms}
                            setApprovalPaymentTerms={setApprovalPaymentTerms}
                            isUpdating={isUpdating}
                            isSendingAdjustedQuote={isSendingAdjustedQuote}
                            editPeriodCalendarRange={editPeriodCalendarRange}
                            formatDateForInput={formatDateForInput}
                            formatPaymentStatus={formatPaymentStatus}
                            getBoletoStatusBadgeClassName={
                              getBoletoStatusBadgeClassName
                            }
                            handleUpdateBoletoDueDate={
                              handleUpdateBoletoDueDate
                            }
                            handleGenerateBoleto={handleGenerateBoleto}
                            openFinancialFromQuote={openFinancialFromQuote}
                          />
                        )}
                      </div>

                      {/* Coluna direita: rejeição + equipamentos + tipo operação + dialogs */}
                      <div className="space-y-4 min-w-0">
                        {selectedQuoteStatus === 'rejected' && (
                          <QuoteRejectionCard selectedQuote={selectedQuote} />
                        )}

                        <QuoteItemsCard
                          selectedQuote={selectedQuote}
                          selectedQuoteStatus={selectedQuoteStatus}
                          selectedQuoteAdjustments={selectedQuoteAdjustments}
                          boletoPayment={boletoPayment}
                          isAdjustingPrice={isAdjustingPrice}
                          removingItemId={removingItemId}
                          removingAdjustmentId={removingAdjustmentId}
                          onRemoveItem={(itemId) =>
                            setRemoveConfirmItemId(itemId)
                          }
                          onEditItem={handleEditItem}
                          onRemoveAdjustment={(adjustmentId) =>
                            setRemoveConfirmAdjustmentId(adjustmentId)
                          }
                          onEditAdjustment={handleEditAdjustment}
                          onOpenPriceAdjustment={handleOpenPriceAdjustment}
                        />

                        {/* Tipo de Operação (classificação tributária) */}
                        <Card className="overflow-visible rounded-xl border-0 bg-gradient-to-br from-orange-50 to-orange-100 shadow-md text-card-foreground">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-3 text-base font-semibold text-slate-900 sm:text-lg">
                              <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                                <Briefcase className="h-4 w-4" />
                              </div>
                              Tipo de Operação
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="flex flex-col gap-1 flex-1">
                                <Label className="text-xs text-muted-foreground">
                                  Classificação
                                </Label>
                                <Select
                                  value={editOperationType}
                                  onValueChange={(value) =>
                                    setEditOperationType(
                                      value as
                                        'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
                                    )
                                  }
                                  disabled={isSavingOperationType}
                                  modal={false}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PURE_RENTAL">
                                      Locação Pura
                                    </SelectItem>
                                    <SelectItem value="RENTAL_WITH_SERVICE">
                                      Locação + Serviço
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">
                                  {editOperationType === 'PURE_RENTAL'
                                    ? 'ISS e ICMS isentos (SV 31 STF)'
                                    : 'ISS incide sobre a parcela de serviço'}
                                </p>
                              </div>
                              <div className="flex sm:items-center shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-10 shrink-0"
                                  onClick={() =>
                                    saveOperationType(selectedQuote.id)
                                  }
                                  disabled={isSavingOperationType}
                                >
                                  {isSavingOperationType
                                    ? 'Salvando...'
                                    : 'Salvar'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* ─── Nested dialogs ─────────────────── */}
                        <DeleteDialog
                          open={showDeleteDialog}
                          onOpenChange={setShowDeleteDialog}
                          onConfirm={() =>
                            selectedQuote && deleteQuote(selectedQuote.id)
                          }
                          isDeleting={isDeleting}
                          quoteName={selectedQuote.name}
                        />

                        <RejectDialog
                          open={showRejectDialog}
                          onOpenChange={setShowRejectDialog}
                          onConfirm={handleConfirmReject}
                          isUpdating={isUpdating}
                          updatingAction={updatingAction}
                          quoteName={selectedQuote?.name ?? ''}
                          rejectWithReason={rejectWithReason}
                          onRejectWithReasonChange={setRejectWithReason}
                          rejectionReason={rejectionReason}
                          onRejectionReasonChange={setRejectionReason}
                        />

                        <RemoveItemConfirm
                          open={!!removeConfirmItemId}
                          onOpenChange={(open) => {
                            if (!open) setRemoveConfirmItemId(null)
                          }}
                          onConfirm={handleRemoveItemConfirm}
                          isRemoving={removingItemId === removeConfirmItemId}
                          itemName={removeItemName}
                        />

                        <RemoveAdjustmentConfirm
                          open={!!removeConfirmAdjustmentId}
                          onOpenChange={(open) => {
                            if (!open) setRemoveConfirmAdjustmentId(null)
                          }}
                          onConfirm={handleRemoveAdjustmentConfirm}
                          isRemoving={
                            removingAdjustmentId === removeConfirmAdjustmentId
                          }
                        />

                        <RemoveApprovalDialog
                          open={showRemoveApprovalDialog}
                          onOpenChange={setShowRemoveApprovalDialog}
                          onConfirm={() => {
                            if (selectedQuote) {
                              removeApproval(selectedQuote.id)
                            }
                          }}
                          isRemovingApproval={isRemovingApproval}
                        />

                        <EditCustomerDialog
                          open={showEditPeriodEmailPhoneDialog}
                          onOpenChange={setShowEditPeriodEmailPhoneDialog}
                          draft={editPeriodEmailPhoneDraft}
                          onDraftChange={setEditPeriodEmailPhoneDraft}
                          onSave={savePeriodEmailPhone}
                          isSaving={isSavingPeriodEmailPhone}
                          customerName={selectedQuote?.name}
                          customerImage={selectedQuote?.customerImage}
                        />

                        <EditDeliveryDialog
                          open={showEditDeliveryDialog}
                          onOpenChange={setShowEditDeliveryDialog}
                          draft={editDeliveryDraft}
                          onDraftChange={setEditDeliveryDraft}
                          onSave={saveDelivery}
                          isSaving={isSavingDelivery}
                          formatCEP={formatCEP}
                          hasTravelAdjustment={selectedQuoteAdjustments.some(
                            (a) => a.category === 'TRAVEL'
                          )}
                          onDeliveryFeeChange={
                            handleDeliveryFeeChangeFromDialog
                          }
                        />

                        <EditItemDatesDialog
                          open={showEditItemDatesDialog}
                          onOpenChange={(open) => {
                            if (!open) {
                              setShowEditItemDatesDialog(false)
                              setEditingQuoteItem(null)
                            }
                          }}
                          editingItem={editingQuoteItem}
                          draft={editItemDatesDraft}
                          onDraftChange={setEditItemDatesDraft}
                          onSave={saveItemDates}
                          isSaving={isSavingItemDates}
                          rangeModifiers={editItemDatesRangeModifiers}
                          preview={editItemPreview}
                          calendarRange={editPeriodCalendarRange}
                          formatCurrency={formatCurrency}
                        />

                        <PriceAdjustmentDialog
                          open={showPriceAdjustmentDialog}
                          onOpenChange={(open) => {
                            setShowPriceAdjustmentDialog(open)
                            if (!open) setEditingAdjustmentId(null)
                          }}
                          items={priceAdjustmentItems}
                          onAddItem={addPriceAdjustmentItem}
                          onRemoveItem={removePriceAdjustmentItem}
                          onUpdateItem={updatePriceAdjustmentItem}
                          originalAmount={Number(
                            selectedQuote.originalTotal ??
                              selectedQuote.totalPrice ??
                              0
                          )}
                          isSubmitting={isAdjustingPrice}
                          onSubmit={() =>
                            selectedQuote && adjustQuotePrice(selectedQuote.id)
                          }
                          onCancel={() => {
                            setPriceAdjustmentItems([
                              createDefaultAdjustmentItem(),
                            ])
                            setShowPriceAdjustmentDialog(false)
                          }}
                          isEditing={!!editingAdjustmentId}
                          formatCurrency={formatCurrency}
                        />

                        <LateFeeDialog
                          open={showLateFeeDialog}
                          onOpenChange={setShowLateFeeDialog}
                          onConfirm={() =>
                            selectedQuote && approveLateFee(selectedQuote.id)
                          }
                          onCancel={() => {
                            setCalculatedLateFee(null)
                            setShowLateFeeDialog(false)
                          }}
                          isUpdating={isUpdating}
                          calculatedLateFee={calculatedLateFee}
                          formatCurrency={formatCurrency}
                        />
                      </div>
                    </div>
                  ) : null}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            {/* ─── Footer: pending / approved ─────────────────── */}
            {selectedQuote &&
              (selectedQuoteStatus === 'pending' ||
                selectedQuoteStatus === 'approved') && (
                <Dialog.Footer>
                  <div className="flex flex-col gap-2 md:gap-3 w-full">
                    {/* Botões principais para status pendente */}
                    {selectedQuoteStatus === 'pending' && (
                      <div className="flex flex-col gap-2 md:gap-3">
                        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                          <Button
                            onClick={handleRejectClick}
                            disabled={isUpdating || isSendingAdjustedQuote}
                            variant="outline"
                            size="default"
                            className="order-2 md:order-1 shrink-0 w-full md:w-auto md:flex-1 bg-white"
                          >
                            <XCircle className="w-4 h-4" />
                            {updatingAction === 'rejected'
                              ? 'Rejeitando...'
                              : 'Rejeitar Orçamento'}
                          </Button>
                          {shouldShowAdjustedSendButton ? (
                            <Button
                              onClick={() =>
                                handleSendAdjustedQuote(selectedQuote.id)
                              }
                              disabled={isUpdating || isSendingAdjustedQuote}
                              variant="default"
                              size="default"
                              className="order-1 md:order-2 shrink-0 w-full md:w-auto md:flex-1"
                            >
                              <Mail className="w-4 h-4" />
                              {isSendingAdjustedQuote
                                ? 'Enviando...'
                                : 'Enviar Orçamento Ajustado'}
                            </Button>
                          ) : (
                            <Button
                              onClick={() =>
                                updateQuoteStatus(
                                  selectedQuote.id,
                                  'approved',
                                  undefined,
                                  approvalPaymentTerms
                                )
                              }
                              disabled={
                                isUpdating ||
                                (isAdminApproved &&
                                  approvalPaymentTerms !== 'AT_END')
                              }
                              variant="default"
                              size="default"
                              className="order-1 md:order-2 shrink-0 w-full md:w-auto md:flex-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {updatingAction === 'approved'
                                ? approvalPaymentTerms === 'AT_END'
                                  ? 'Convertendo...'
                                  : 'Aprovando...'
                                : approvalPaymentTerms === 'AT_END'
                                  ? 'Aprovar e Converter'
                                  : 'Aprovar Orçamento'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Botão para reenviar orçamento ajustado quando já aprovado */}
                    {selectedQuoteStatus === 'approved' &&
                      shouldShowAdjustedSendButton && (
                        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                          <Button
                            onClick={() =>
                              handleSendAdjustedQuote(selectedQuote.id)
                            }
                            disabled={isUpdating || isSendingAdjustedQuote}
                            variant="default"
                            size="default"
                            className="shrink-0 w-full md:w-auto md:flex-1"
                          >
                            <Mail className="w-4 h-4" />
                            {isSendingAdjustedQuote
                              ? 'Enviando...'
                              : 'Enviar Orçamento Ajustado'}
                          </Button>
                          <Button
                            onClick={handleDownloadAdjustmentPdf}
                            variant="outline"
                            size="default"
                            className="shrink-0 w-full md:w-auto md:flex-1"
                          >
                            <Download className="w-4 h-4" />
                            Baixar Ofício de Reajuste
                          </Button>
                        </div>
                      )}

                    {/* Botões de ações administrativas */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                      {selectedQuoteStatus === 'approved' &&
                        selectedQuote.endDate &&
                        new Date(selectedQuote.endDate) < new Date() && (
                          <Button
                            onClick={() => calculateLateFee(selectedQuote.id)}
                            disabled={isCalculatingLateFee}
                            variant="outline"
                            size="default"
                            className="shrink-0 w-full md:w-auto md:flex-1"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            {isCalculatingLateFee
                              ? 'Calculando...'
                              : 'Calcular Multa'}
                          </Button>
                        )}
                      {!boletoPayment?.metadata?.pdfUrl &&
                        selectedQuoteStatus === 'approved' && (
                          <Button
                            variant="outline"
                            size="default"
                            onClick={() =>
                              handleGenerateBoleto(selectedQuote.id)
                            }
                            disabled={generatingBoletoId === selectedQuote.id}
                            className="shrink-0 w-full md:w-auto md:flex-1"
                          >
                            {generatingBoletoId === selectedQuote.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Receipt className="w-4 h-4 mr-2" />
                            )}
                            {generatingBoletoId === selectedQuote.id
                              ? 'Gerando...'
                              : 'Gerar Boleto'}
                          </Button>
                        )}
                    </div>
                  </div>
                </Dialog.Footer>
              )}

            {/* ─── Footer: rejected ───────────────────────────── */}
            {selectedQuoteStatus === 'rejected' && selectedQuote && (
              <Dialog.Footer>
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedQuote(null)}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                    variant="destructive"
                    size="default"
                    className="flex-1 hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir Permanentemente
                  </Button>
                </div>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
