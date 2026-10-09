'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { Suspense, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Hash,
  Landmark,
  Percent,
  RefreshCw,
  Table as TableIcon,
  TrendingUp,
} from 'lucide-react'
import { AdminCard } from '../../../widgets/cartao-admin'
import { AdminPageHeader } from '../../../widgets/cabecalho-admin'
import { AdvancedCalendar } from '../../../widgets/calendario'
import { Button } from '@gb-locacoes/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@gb-locacoes/ui'
import { ViewToggle } from '@gb-locacoes/ui'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
import { formatCurrency } from '../../../shared/lib/formatting'
import { type BillingStatus, statusLabel } from '../model/tipos'
import { FinanceiroFilterCardWithDebouncedSearch } from './Filtro.web'
import { FinancialStatCards } from './Cartoes.web'
import { TaxSettingsSection } from './Aliquotas.web'
import { FinancialTableView } from './Tabela.web'
import { FinancialDashboardView } from './Painel.web'
import { DeleteEntryDialog } from './ExcluirLancamento.web'
import { DeleteAdjustmentDialog } from './ExcluirReajuste.web'
import { EntryDetailDialog } from './Detalhe.web'
import { useFinancialData } from '../model/carga.web'
import { useFinancialEntryDetails } from '../model/detalhe.web'

// ─── Component ────────────────────────────────────────────────

function AdminFinanceiroPage() {
  // ── Data hook (list, filters, settings, dashboard) ──────
  const data = useFinancialData()

  // ── Details hook (modal, handlers) ──────────────────────
  const details = useFinancialEntryDetails({
    refreshAll: data.refreshAll,
    viewMode: data.viewMode,
    loadEntries: data.loadEntries,
    loadCalendar: data.loadCalendar,
    loadDashboardData: data.loadDashboardData,
    entries: data.entries,
    searchParams: data.searchParams,
  })

  // ── Stat cards memo ─────────────────────────────────────
  const statCards = useMemo(
    () => [
      {
        title: 'Total Bruto',
        value: formatCurrency(data.displayTotals.gross),
        subtitle: data.hasSelection
          ? `${data.displayTotals.count} selecionado(s)`
          : `${data.displayTotals.count} lançamento(s)`,
        icon: DollarSign,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
      },
      {
        title: 'Total Líquido',
        value: formatCurrency(data.displayTotals.net),
        subtitle: data.hasSelection
          ? 'Seleção após retenções'
          : 'Após retenções',
        icon: TrendingUp,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
      },
      {
        title: 'Total Pago',
        value: formatCurrency(data.displayTotals.paid),
        subtitle: `${data.displayTotals.paidCount} pago(s)`,
        icon: CheckCircle2,
        iconBg: 'bg-green-50',
        iconColor: 'text-green-600',
      },
      {
        title: 'Pendente',
        value: formatCurrency(
          data.displayTotals.unpaid + data.displayTotals.awaiting
        ),
        subtitle: `${data.displayTotals.unpaidCount + data.displayTotals.awaitingCount} pendente(s)`,
        icon: AlertTriangle,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
      },
      {
        title: 'Inadimplência',
        value: `${data.delinquencyRate}%`,
        subtitle:
          data.delinquencyRate > 15
            ? 'Acima do ideal'
            : data.delinquencyRate > 0
              ? 'Taxa de atraso'
              : 'Nenhum atraso',
        icon: Percent,
        iconBg: data.delinquencyRate > 15 ? 'bg-red-50' : 'bg-orange-50',
        iconColor:
          data.delinquencyRate > 15 ? 'text-red-600' : 'text-orange-600',
      },
      {
        title: 'Registros',
        value: String(data.displayTotals.count),
        subtitle: data.hasSelection
          ? `${data.displayTotals.count} de ${data.totals.count} selecionado(s)`
          : data.statusFilter !== 'all'
            ? `Filtrado: ${statusLabel[data.statusFilter]}`
            : data.periodFilter !== 'all'
              ? data.periodOptions.find((p) => p.value === data.periodFilter)
                  ?.label || ''
              : 'Total de lançamentos',
        icon: Hash,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
      },
    ],
    [
      data.delinquencyRate,
      data.displayTotals,
      data.hasSelection,
      data.totals.count,
      data.statusFilter,
      data.periodFilter,
      data.periodOptions,
    ]
  )

  // ── Loading ─────────────────────────────────────────────
  if (data.initialLoad) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
          className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-6">
        <AdminPageHeader
          title="Painel Financeiro"
          subtitle="Boletos, pagamentos, notas fiscais e lançamentos"
          infoBadge={{
            icon: <Landmark className="w-5 h-5 text-orange-50" />,
            text: data.hasSelection
              ? `${data.displayTotals.count} de ${data.totals.count} selecionado(s)`
              : `${data.totals.count} lançamento(s)`,
          }}
        />

        {/* KPI Stat Cards */}
        <FinancialStatCards
          statCards={statCards}
          hasSelection={data.hasSelection}
        />

        {/* Configuração Tributária */}
        <TaxSettingsSection
          settings={data.settings}
          setSettings={data.setSettings}
          showAdvancedTax={data.showAdvancedTax}
          setShowAdvancedTax={data.setShowAdvancedTax}
          hasSettingsChanged={data.hasSettingsChanged}
          savingRates={data.savingRates}
          saveRates={data.saveRates}
          resetSettings={data.resetSettings}
        />

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <FinanceiroFilterCardWithDebouncedSearch
            searchPlaceholder="Buscar por cliente ou código do orçamento..."
            searchTerm={data.searchTerm}
            onSearchChange={data.setSearchTerm}
            filters={[
              {
                label: 'Período',
                value: data.periodFilter,
                onValueChange: (value) => data.setPeriodFilter(value),
                placeholder: 'Selecionar período',
                options: data.periodOptions,
              },
              {
                label: 'Status',
                value: data.statusFilter,
                onValueChange: (value) =>
                  data.setStatusFilter(value as 'all' | BillingStatus),
                placeholder: 'Filtrar por status',
                options: [
                  { value: 'all', label: 'Todos' },
                  { value: 'PAID', label: 'Pago' },
                  { value: 'UNPAID', label: 'Não Pago' },
                  { value: 'AWAITING_PAYMENT', label: 'Aguardando Pagamento' },
                  { value: 'SETTLED', label: 'Baixado' },
                ],
              },
            ]}
            actionButtons={
              <div className="flex flex-col gap-2 w-full lg:w-auto lg:flex-row lg:items-center">
                <Button
                  variant="outline"
                  disabled={data.isRefreshing}
                  onClick={async () => {
                    data.setIsRefreshing(true)
                    try {
                      await data.refreshAll()
                    } finally {
                      data.setIsRefreshing(false)
                    }
                  }}
                >
                  <RefreshCw
                    className={cn(
                      'w-4 h-4 mr-2',
                      data.isRefreshing && 'animate-[spin_1.5s_linear_infinite]'
                    )}
                  />
                  {data.isRefreshing ? 'Atualizando...' : 'Atualizar'}
                </Button>
                <div className="flex w-full min-w-0 rounded-md shadow-md">
                  <Button
                    variant="default"
                    className="flex-1 min-w-0 justify-center rounded-r-none border-r border-slate-600"
                    onClick={() => data.handleExport(data.exportFormat)}
                  >
                    <Check className="w-4 h-4 mr-2 text-white" />
                    {data.exportFormat === 'pdf' && 'PDF (Ofício)'}
                    {data.exportFormat === 'xlsx' && 'Excel (.xlsx)'}
                    {data.exportFormat === 'csv' && 'CSV'}
                    {data.hasSelection && (
                      <span
                        className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold tabular-nums shadow-sm ring-1 ring-white/20"
                        aria-label={`${data.selectedEntryIds.size} itens selecionados`}
                      >
                        {data.selectedEntryIds.size}
                      </span>
                    )}
                  </Button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="default"
                        className="rounded-l-none px-2 min-w-0"
                        aria-label="Selecionar formato de exportação"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItem
                        onClick={() => data.setExportFormat('pdf')}
                        className="flex flex-col items-start gap-0.5 py-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">PDF (Ofício)</span>
                          {data.exportFormat === 'pdf' && (
                            <Check className="h-4 w-4 shrink-0 text-orange-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Relatório formatado para impressão em tamanho ofício.
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => data.setExportFormat('xlsx')}
                        className="flex flex-col items-start gap-0.5 py-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">Excel (.xlsx)</span>
                          {data.exportFormat === 'xlsx' && (
                            <Check className="h-4 w-4 shrink-0 text-orange-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Planilha editável com todos os dados filtrados.
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => data.setExportFormat('csv')}
                        className="flex flex-col items-start gap-0.5 py-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">CSV</span>
                          {data.exportFormat === 'csv' && (
                            <Check className="h-4 w-4 shrink-0 text-orange-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Arquivo texto para importação em outros sistemas.
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            }
            viewToggleButtons={
              <ViewToggle
                options={[
                  { value: 'table', label: 'Tabela', icon: TableIcon },
                  { value: 'calendar', label: 'Calendário', icon: Calendar },
                  { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                ]}
                value={data.viewMode}
                onValueChange={(value) =>
                  data.setViewMode(value as 'table' | 'calendar' | 'dashboard')
                }
              />
            }
          />
        </motion.div>

        {/* Table View */}
        {data.viewMode === 'table' && (
          <FinancialTableView
            entries={data.entries}
            paginatedEntries={data.paginatedEntries}
            searchTerm={data.searchTerm}
            statusFilter={data.statusFilter}
            periodFilter={data.periodFilter}
            tableTotalPages={data.tableTotalPages}
            tableCurrentPage={data.tableCurrentPage}
            setTablePage={data.setTablePage}
            selectedEntryIds={data.selectedEntryIds}
            setSelectedEntryIds={data.setSelectedEntryIds}
            allOnPageSelected={data.allOnPageSelected}
            someOnPageSelected={data.someOnPageSelected}
            toggleSelectAllOnPage={data.toggleSelectAllOnPage}
            toggleEntrySelection={data.toggleEntrySelection}
            isSelectionMode={data.isSelectionMode}
            setSelectedEntry={details.setSelectedEntry}
            openQuoteFromEntry={details.openQuoteFromEntry}
            setEntryIdToDelete={details.setEntryIdToDelete}
            setShowDeleteConfirm={details.setShowDeleteConfirm}
          />
        )}

        {/* Calendar View */}
        {data.viewMode === 'calendar' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <AdminCard title="Calendário Financeiro" variant="flat">
              <AdvancedCalendar
                events={data.calendarEvents}
                resources={[{ id: 'financeiro', name: 'Eventos' }]}
                defaultViewMode="monthly"
                onEventClick={(event) => {
                  const entry = data.entries.find((e) => e.id === event.id)
                  if (entry) details.setSelectedEntry(entry)
                }}
              />
            </AdminCard>
          </motion.div>
        )}

        {/* Dashboard View */}
        {data.viewMode === 'dashboard' && (
          <FinancialDashboardView
            agingData={data.agingData}
            topDebtors={data.topDebtors}
            revenueHistory={data.revenueHistory}
            revenueByCategory={data.revenueByCategory}
            expandedCardId={data.expandedCardId}
            setExpandedCardId={data.setExpandedCardId}
          />
        )}

        {/* Delete Dialogs */}
        <DeleteEntryDialog
          open={details.showDeleteConfirm}
          onOpenChange={(open) => {
            if (!open) {
              details.setShowDeleteConfirm(false)
              details.setEntryIdToDelete(null)
            }
          }}
          onConfirm={details.handleConfirmDeleteEntry}
          isDeleting={details.isDeletingEntry}
        />

        <DeleteAdjustmentDialog
          open={details.showAdjustmentDeleteConfirm}
          onOpenChange={(open) => {
            if (!open) {
              details.setShowAdjustmentDeleteConfirm(false)
              details.setAdjustmentToDelete(null)
            }
          }}
          onConfirm={() => void details.handleConfirmDeleteAdjustment()}
          isDeleting={!!details.deletingAdjustmentId}
        />

        {/* Entry Detail Dialog */}
        <EntryDetailDialog
          selectedEntry={details.selectedEntry}
          setSelectedEntry={details.setSelectedEntry}
          nestedDialogOpen={details.nestedDialogOpen}
          dueDateDraft={details.dueDateDraft}
          setDueDateDraft={details.setDueDateDraft}
          savingStatusId={details.savingStatusId}
          savingDueDateId={details.savingDueDateId}
          regeneratingBoletoId={details.regeneratingBoletoId}
          adjustmentHistory={details.adjustmentHistory}
          loadingAdjustments={details.loadingAdjustments}
          showPriceAdjustmentDialog={details.showPriceAdjustmentDialog}
          setShowPriceAdjustmentDialog={details.setShowPriceAdjustmentDialog}
          priceAdjustmentItems={details.priceAdjustmentItems}
          setPriceAdjustmentItems={details.setPriceAdjustmentItems}
          editingAdjustmentId={details.editingAdjustmentId}
          setEditingAdjustmentId={details.setEditingAdjustmentId}
          isAdjustingPrice={details.isAdjustingPrice}
          deletingAdjustmentId={details.deletingAdjustmentId}
          updateBillingStatus={details.updateBillingStatus}
          updateEntryDueDate={details.updateEntryDueDate}
          regenerateBoleto={details.regenerateBoleto}
          openQuoteFromEntry={details.openQuoteFromEntry}
          addPriceAdjustmentItem={details.addPriceAdjustmentItem}
          removePriceAdjustmentItem={details.removePriceAdjustmentItem}
          updatePriceAdjustmentItem={details.updatePriceAdjustmentItem}
          adjustQuotePriceForEntry={details.adjustQuotePriceForEntry}
          setAdjustmentToDelete={details.setAdjustmentToDelete}
          setShowAdjustmentDeleteConfirm={
            details.setShowAdjustmentDeleteConfirm
          }
        />
      </div>
    </div>
  )
}

export function AdminFinanceiroPageWrapper() {
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
      <AdminFinanceiroPage key={scope} />
    </Suspense>
  )
}
