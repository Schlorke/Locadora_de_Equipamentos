import { useMemo, useEffect, useState } from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { formatCurrency } from '../../../shared/lib/formatting'
import { useFinancialDataModel } from '../model/carga'
import { useFinancialEntryDetailsModel } from '../model/detalhe'
import { formatFinancialDate } from '../model/display'
import type { FinancialFile, FinancialFilePorts } from '../model/export'
import {
  statusLabel,
  type BillingStatus,
  type FinancialEntry,
} from '../model/tipos'
import {
  FinancialChoices,
  FinancialSection,
  FinancialText,
  FinancialField,
} from './parts.native'
import { FinancialCalendar } from './Calendario.native'
import { FinancialDashboard } from './Indicadores.native'
import { FinancialTaxSettings } from './Aliquotas.native'
import { FinancialDetail } from './Detalhe.native'
export interface AdminFinanceiroPageProps {
  initialSearch?: string
  initialStatus?: string
  requestedQuoteId?: string
  navigate(path: string): void
  requestRegeneration(message: string): boolean | Promise<boolean>
  shareDocument(file: FinancialFile): Promise<void>
}
function SearchField({
  value,
  change,
}: {
  value: string
  change(value: string): void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => change(draft), 350)
    return () => clearTimeout(timer)
  }, [draft, value, change])
  return (
    <FinancialField
      label="Buscar cliente ou orçamento"
      value={draft}
      onChange={setDraft}
    />
  )
}
export function AdminFinanceiroPageWrapper(props: AdminFinanceiroPageProps) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return (
    <FinancialContent
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        slug,
        session?.user?.id,
        status,
        revision,
        props.initialSearch,
        props.initialStatus,
        props.requestedQuoteId,
      ])}
      {...props}
    />
  )
}
function FinancialContent(props: AdminFinanceiroPageProps) {
  const theme = useTheme()
  const params = useMemo(() => {
    const query = new URLSearchParams()
    if (props.initialSearch) query.set('search', props.initialSearch)
    if (props.initialStatus) query.set('status', props.initialStatus)
    if (props.requestedQuoteId) query.set('quoteId', props.requestedQuoteId)
    return query
  }, [props.initialSearch, props.initialStatus, props.requestedQuoteId])
  const files = useMemo<FinancialFilePorts>(
    () => ({
      open: () => ({
        isOpen: () => true,
        close: () => {},
        deliver: props.shareDocument,
      }),
    }),
    [props.shareDocument]
  )
  const data = useFinancialDataModel(params, files)
  const details = useFinancialEntryDetailsModel({
    refreshAll: data.refreshAll,
    viewMode: data.viewMode,
    loadEntries: data.loadEntries,
    loadCalendar: data.loadCalendar,
    loadDashboardData: data.loadDashboardData,
    entries: data.entries,
    searchParams: params,
    navigate: props.navigate,
    requestRegeneration: props.requestRegeneration,
  })
  const totals = data.displayTotals
  const row = (entry: FinancialEntry) => (
    <Card key={entry.id}>
      <View style={{ gap: space.sm }}>
        <FinancialText>
          {entry.customerName} ·{' '}
          {entry.quoteCode ||
            entry.legacyExternalCode ||
            entry.quoteId ||
            'Sem orçamento'}
        </FinancialText>
        <FinancialText>
          {statusLabel[entry.billingStatus]} ·{' '}
          {formatFinancialDate(entry.dueDate)} · Bruto:{' '}
          {formatCurrency(entry.grossAmount)} · Líquido:{' '}
          {formatCurrency(entry.netAmount)}
        </FinancialText>
        <Button
          variant="outline"
          aria-label={'Exibir lançamento ' + entry.id}
          onClick={() => details.setSelectedEntry(entry)}
        >
          Exibir lançamento
        </Button>
        <Button
          variant="outline"
          aria-label={'Selecionar lançamento ' + entry.id}
          onClick={() => data.toggleEntrySelection(entry.id)}
        >
          {data.selectedEntryIds.has(entry.id) ? 'Desmarcar' : 'Selecionar'}
        </Button>
      </View>
    </Card>
  )
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: space.md, gap: space.md }}
      >
        <FinancialSection title="Financeiro">
          <FinancialText>
            {data.hasSelection
              ? data.selectedEntryIds.size + ' selecionado(s)'
              : data.entries.length + ' lançamento(s)'}
          </FinancialText>
          <FinancialText>
            Bruto: {formatCurrency(totals.gross)} · Líquido:{' '}
            {formatCurrency(totals.net)}
          </FinancialText>
          <FinancialText>
            Pago: {formatCurrency(totals.paid)} · Não pago:{' '}
            {formatCurrency(totals.unpaid)} · Aguardando:{' '}
            {formatCurrency(totals.awaiting)}
          </FinancialText>
          <FinancialText>
            Inadimplência: {data.delinquencyRate.toFixed(1)}%
          </FinancialText>
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
            Atualizar financeiro
          </Button>
        </FinancialSection>
        <SearchField value={data.searchTerm} change={data.setSearchTerm} />
        <FinancialChoices<'all' | BillingStatus>
          value={data.statusFilter}
          options={[
            ['all', 'Todos os status'],
            ...(Object.entries(statusLabel) as Array<[BillingStatus, string]>),
          ]}
          onChange={data.setStatusFilter}
        />
        <FinancialChoices
          value={data.periodFilter}
          options={data.periodOptions.map(
            (period) => [period.value, period.label] as const
          )}
          onChange={data.setPeriodFilter}
        />
        <FinancialChoices<'table' | 'calendar' | 'dashboard'>
          value={data.viewMode}
          options={[
            ['table', 'Tabela'],
            ['calendar', 'Calendário'],
            ['dashboard', 'Indicadores'],
          ]}
          onChange={data.setViewMode}
        />
        <FinancialSection title="Exportar Relatório">
          <FinancialChoices<'pdf' | 'xlsx' | 'csv'>
            value={data.exportFormat}
            options={[
              ['pdf', 'PDF'],
              ['xlsx', 'XLSX'],
              ['csv', 'CSV'],
            ]}
            onChange={data.setExportFormat}
          />
          <Button
            aria-label={
              data.hasSelection ? 'Exportar selecionados' : 'Exportar relatório'
            }
            onClick={() => data.handleExport(data.exportFormat)}
          >
            Exportar {data.hasSelection ? 'selecionados' : 'relatório'}
          </Button>
          {data.hasSelection ? (
            <Button
              variant="outline"
              onClick={() => data.setSelectedEntryIds(new Set())}
            >
              Limpar seleção
            </Button>
          ) : null}
        </FinancialSection>
        {data.initialLoad ? <ActivityIndicator /> : null}
        {data.viewMode === 'table' ? (
          <FinancialSection title="Lançamentos">
            <FinancialText>
              Página {data.tableCurrentPage} de {data.tableTotalPages}
            </FinancialText>
            <Button variant="outline" onClick={data.toggleSelectAllOnPage}>
              {data.allOnPageSelected
                ? 'Desmarcar página'
                : 'Selecionar página'}
            </Button>
            {data.paginatedEntries.map(row)}
            {!data.paginatedEntries.length && !data.initialLoad ? (
              <FinancialText>Nenhum lançamento encontrado</FinancialText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                variant="outline"
                aria-label="Página anterior"
                disabled={data.tableCurrentPage <= 1}
                onClick={() => data.setTablePage((page) => page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                aria-label="Próxima página"
                disabled={data.tableCurrentPage >= data.tableTotalPages}
                onClick={() => data.setTablePage((page) => page + 1)}
              >
                Próximo
              </Button>
            </View>
          </FinancialSection>
        ) : data.viewMode === 'calendar' ? (
          <FinancialCalendar
            events={data.calendarEvents}
            onSelect={(id) => {
              const entry = data.entries.find((item) => item.id === id)
              if (entry) details.setSelectedEntry(entry)
            }}
          />
        ) : (
          <FinancialDashboard model={data} />
        )}
        <FinancialTaxSettings model={data} />
      </ScrollView>
      <FinancialDetail model={details} files={files} />
    </>
  )
}
