'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { Suspense, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AdminFilterCard } from '../../../widgets/filtro-admin'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { ViewToggle } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { FileText, LayoutGrid, Table, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { type Quote } from '../../../entities/orcamento'
import { useQuotesData } from '../model/dados.web'
import { useQuoteDetails } from '../model/detalhe.web'
import { QuotesKanbanView } from './Kanban.web'
import { QuotesTableView } from './Tabela.web'
import { QuotesCalendarView } from './Calendario.web'
import { QuoteDetailPanel } from './Painel.web'

// ─── Component ────────────────────────────────────────────────

function AdminQuotesPage() {
  const router = useRouter()

  // ── Data hook (list, filters, pagination, fetch) ──────────
  const quotesData = useQuotesData()
  const {
    quotes,
    loading,
    totalCount,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    periodFilter,
    setPeriodFilter,
    valueFilter,
    setValueFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    viewMode,
    setViewMode,
    kanbanMonth,
    setKanbanMonth,
    contentAnimReady,
    kanbanFilteredQuotes,
    paginatedTableQuotes,
    itemCountsByMonth,
    kanbanMonthHasMounted,
    quotesRef,
    boletoActionLocksRef,
    fetchQuotes,
    updateQuoteInState,
  } = quotesData

  // ── Details hook (detail panel, dialogs, handlers) ────────
  const details = useQuoteDetails({
    updateQuoteInState,
    fetchQuotes,
    quotesRef,
    boletoActionLocksRef,
    loading,
    quotes,
  })

  // ── Local UI state ────────────────────────────────────────
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  // ── Callbacks ─────────────────────────────────────────────
  const openFinancialFromQuote = useCallback(
    (quote: Quote) => {
      const lookup = (
        quote.quoteCode ||
        quote.legacyExternalCode ||
        quote.name ||
        ''
      ).trim()

      if (!lookup) {
        toast.error(
          'Não foi possível gerar busca no financeiro para este orçamento.'
        )
        return
      }

      const query = new URLSearchParams()
      query.set('search', lookup)
      if (quote.id) query.set('quoteId', quote.id)
      router.push(`/admin/financeiro?${query.toString()}`)
    },
    [router]
  )

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <AdminPageHeader
          title="Gerenciar Orçamentos"
          subtitle="Visualize, analise e gerencie todos os orçamentos solicitados"
          icon={<FileText className="w-8 h-8" />}
          infoBadge={{
            icon: <FileText className="w-5 h-5 text-orange-50" />,
            text: `${totalCount} orçamentos encontrados`,
          }}
          className="mb-8"
        />

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={
            contentAnimReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
          }
          transition={{
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.08,
          }}
          className="mb-6"
        >
          <AdminFilterCard
            searchPlaceholder="Buscar por cliente, código do orçamento, e-mail..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={[
              {
                label: 'Status',
                value: statusFilter,
                onValueChange: setStatusFilter,
                placeholder: 'Filtrar por status',
                options: [
                  { value: 'all', label: 'Todos os status' },
                  { value: 'pending', label: 'Pendentes' },
                  { value: 'approved', label: 'Aprovados' },
                  { value: 'rejected', label: 'Rejeitados' },
                  { value: 'completed', label: 'Concluidos' },
                ],
              },
              ...(viewMode !== 'kanban'
                ? [
                    {
                      label: 'Período',
                      value: periodFilter,
                      onValueChange: setPeriodFilter,
                      placeholder: 'Filtrar por período',
                      options: [
                        { value: 'all', label: 'Todos os períodos' },
                        { value: 'today', label: 'Hoje' },
                        { value: 'week', label: 'Última semana' },
                        { value: 'month', label: 'Último mês' },
                      ],
                    },
                  ]
                : []),
              {
                label: 'Valor',
                value: valueFilter,
                onValueChange: setValueFilter,
                placeholder: 'Filtrar por valor',
                options: [
                  { value: 'all', label: 'Todos os valores' },
                  { value: 'low', label: 'Até R$ 500' },
                  { value: 'medium', label: 'R$ 500 - R$ 2.000' },
                  { value: 'high', label: 'Acima de R$ 2.000' },
                ],
              },
            ]}
            viewToggleButtons={
              <ViewToggle
                options={[
                  { value: 'kanban', label: 'Kanban', icon: LayoutGrid },
                  { value: 'table', label: 'Tabela', icon: Table },
                  { value: 'calendar', label: 'Calendário', icon: Calendar },
                ]}
                value={viewMode}
                onValueChange={(value) => {
                  setViewMode(value as 'kanban' | 'table' | 'calendar')
                  if (value === 'kanban') setPeriodFilter('all')
                }}
              />
            }
          />
        </motion.div>

        {/* Pipeline Kanban */}
        {viewMode === 'kanban' && (
          <QuotesKanbanView
            kanbanFilteredQuotes={kanbanFilteredQuotes}
            kanbanMonth={kanbanMonth}
            setKanbanMonth={setKanbanMonth}
            itemCountsByMonth={itemCountsByMonth}
            contentAnimReady={contentAnimReady}
            kanbanMonthHasMounted={kanbanMonthHasMounted}
            openQuoteDetails={details.openQuoteDetails}
          />
        )}

        {/* Tabela */}
        {viewMode === 'table' && (
          <QuotesTableView
            paginatedTableQuotes={paginatedTableQuotes}
            tableQuotes={paginatedTableQuotes}
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            hoveredRowId={hoveredRowId}
            setHoveredRowId={setHoveredRowId}
            openQuoteDetails={details.openQuoteDetails}
            openFinancialFromQuote={openFinancialFromQuote}
          />
        )}

        {/* Calendário */}
        {viewMode === 'calendar' && (
          <QuotesCalendarView
            quotes={quotes}
            openQuoteDetails={details.openQuoteDetails}
          />
        )}

        {/* Painel de Detalhes */}
        <QuoteDetailPanel
          selectedQuote={details.selectedQuote}
          setSelectedQuote={details.setSelectedQuote}
          selectedQuoteAdjustments={details.selectedQuoteAdjustments}
          nestedDialogOpen={details.nestedDialogOpen}
          showDeleteDialog={details.showDeleteDialog}
          setShowDeleteDialog={details.setShowDeleteDialog}
          showRejectDialog={details.showRejectDialog}
          setShowRejectDialog={details.setShowRejectDialog}
          showRemoveApprovalDialog={details.showRemoveApprovalDialog}
          setShowRemoveApprovalDialog={details.setShowRemoveApprovalDialog}
          removeConfirmItemId={details.removeConfirmItemId}
          setRemoveConfirmItemId={details.setRemoveConfirmItemId}
          removeConfirmAdjustmentId={details.removeConfirmAdjustmentId}
          setRemoveConfirmAdjustmentId={details.setRemoveConfirmAdjustmentId}
          showLateFeeDialog={details.showLateFeeDialog}
          setShowLateFeeDialog={details.setShowLateFeeDialog}
          showEditPeriodEmailPhoneDialog={
            details.showEditPeriodEmailPhoneDialog
          }
          setShowEditPeriodEmailPhoneDialog={
            details.setShowEditPeriodEmailPhoneDialog
          }
          showEditItemDatesDialog={details.showEditItemDatesDialog}
          setShowEditItemDatesDialog={details.setShowEditItemDatesDialog}
          showEditDeliveryDialog={details.showEditDeliveryDialog}
          setShowEditDeliveryDialog={details.setShowEditDeliveryDialog}
          showPriceAdjustmentDialog={details.showPriceAdjustmentDialog}
          setShowPriceAdjustmentDialog={details.setShowPriceAdjustmentDialog}
          rejectWithReason={details.rejectWithReason}
          setRejectWithReason={details.setRejectWithReason}
          rejectionReason={details.rejectionReason}
          setRejectionReason={details.setRejectionReason}
          editPeriodEmailPhoneDraft={details.editPeriodEmailPhoneDraft}
          setEditPeriodEmailPhoneDraft={details.setEditPeriodEmailPhoneDraft}
          isSavingPeriodEmailPhone={details.isSavingPeriodEmailPhone}
          editDeliveryDraft={details.editDeliveryDraft}
          setEditDeliveryDraft={details.setEditDeliveryDraft}
          isSavingDelivery={details.isSavingDelivery}
          formatCEP={details.formatCEP}
          editingQuoteItem={details.editingQuoteItem}
          setEditingQuoteItem={details.setEditingQuoteItem}
          editItemDatesDraft={details.editItemDatesDraft}
          setEditItemDatesDraft={details.setEditItemDatesDraft}
          isSavingItemDates={details.isSavingItemDates}
          editItemDatesRangeModifiers={details.editItemDatesRangeModifiers}
          editItemPreview={details.editItemPreview}
          editPeriodCalendarRange={details.editPeriodCalendarRange}
          priceAdjustmentItems={details.priceAdjustmentItems}
          isAdjustingPrice={details.isAdjustingPrice}
          editingAdjustmentId={details.editingAdjustmentId}
          setEditingAdjustmentId={details.setEditingAdjustmentId}
          setPriceAdjustmentItems={details.setPriceAdjustmentItems}
          boletoDueDateDraft={details.boletoDueDateDraft}
          setBoletoDueDateDraft={details.setBoletoDueDateDraft}
          updatingBoletoDueDateId={details.updatingBoletoDueDateId}
          generatingBoletoId={details.generatingBoletoId}
          approvalPaymentTerms={details.approvalPaymentTerms}
          setApprovalPaymentTerms={details.setApprovalPaymentTerms}
          editOperationType={details.editOperationType}
          setEditOperationType={details.setEditOperationType}
          isSavingOperationType={details.isSavingOperationType}
          isUpdating={details.isUpdating}
          updatingAction={details.updatingAction}
          isDeleting={details.isDeleting}
          isSendingAdjustedQuote={details.isSendingAdjustedQuote}
          isCalculatingLateFee={details.isCalculatingLateFee}
          calculatedLateFee={details.calculatedLateFee}
          setCalculatedLateFee={details.setCalculatedLateFee}
          isRemovingApproval={details.isRemovingApproval}
          removingItemId={details.removingItemId}
          removingAdjustmentId={details.removingAdjustmentId}
          handleRejectClick={details.handleRejectClick}
          handleConfirmReject={details.handleConfirmReject}
          deleteQuote={details.deleteQuote}
          updateQuoteStatus={details.updateQuoteStatus}
          savePeriodEmailPhone={details.savePeriodEmailPhone}
          saveItemDates={details.saveItemDates}
          saveDelivery={details.saveDelivery}
          removeItemFromQuote={details.removeItemFromQuote}
          adjustQuotePrice={details.adjustQuotePrice}
          calculateLateFee={details.calculateLateFee}
          approveLateFee={details.approveLateFee}
          removeApproval={details.removeApproval}
          handleGenerateBoleto={details.handleGenerateBoleto}
          handleUpdateBoletoDueDate={details.handleUpdateBoletoDueDate}
          handleSendAdjustedQuote={details.handleSendAdjustedQuote}
          handleRemoveAdjustment={details.handleRemoveAdjustment}
          saveOperationType={details.saveOperationType}
          addPriceAdjustmentItem={details.addPriceAdjustmentItem}
          removePriceAdjustmentItem={details.removePriceAdjustmentItem}
          updatePriceAdjustmentItem={details.updatePriceAdjustmentItem}
          openFinancialFromQuote={openFinancialFromQuote}
          shouldShowAdjustedSendButton={details.shouldShowAdjustedSendButton}
        />
      </div>
    </div>
  )
}

export function AdminQuotesPageWrapper() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session, status } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    status,
    revision,
  ])
  return (
    <Suspense fallback={null}>
      <AdminQuotesPage key={scope} />
    </Suspense>
  )
}
