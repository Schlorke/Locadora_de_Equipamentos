'use client'

import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { useFinancialExport, type FinancialFilePorts } from './export'
import { createFinancialApi } from '../api/financial'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react'
import { toast } from '../../../shared/lib/toast'
import {
  type FinancialCalendarEvent,
  type BillingStatus,
  type FinancialEntry,
  type FinancialSettings,
  type FinancialTotals,
  type AgingData,
  type Debtor,
  type RevenueData,
  type CategoryRevenue,
  DEFAULT_FINANCIAL_TOTALS,
  DEFAULT_FINANCIAL_SETTINGS,
} from './tipos'
import { generatePeriodOptions, getPeriodDateRange } from './period'

const TABLE_PAGE_SIZE = 10

export function useFinancialDataModel(
  searchParams: Pick<URLSearchParams, 'get'>,
  ports: FinancialFilePorts
) {
  const apiClient = useScopedApiClient(null)
  const financialApi = useMemo(() => createFinancialApi(apiClient), [apiClient])
  const exportFile = useFinancialExport(apiClient, ports)
  const [initialLoad, setInitialLoad] = useState(true)
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [totals, setTotals] = useState<FinancialTotals>(
    DEFAULT_FINANCIAL_TOTALS
  )
  const [calendarEvents, setCalendarEvents] = useState<
    FinancialCalendarEvent[]
  >([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BillingStatus>('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const filtersRef = useRef({
    searchTerm: '',
    statusFilter: 'all' as 'all' | BillingStatus,
    periodFilter: 'all',
  })
  const entriesAbortRef = useRef<AbortController | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'dashboard'>(
    'table'
  )
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'xlsx' | 'csv'>(
    'pdf'
  )
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
    () => new Set()
  )
  const [settings, setSettings] = useState<FinancialSettings>(
    DEFAULT_FINANCIAL_SETTINGS
  )
  const savedSettingsRef = useRef<FinancialSettings | null>(null)
  const [showAdvancedTax, setShowAdvancedTax] = useState(false)
  const [savingRates, setSavingRates] = useState(false)

  // Dashboard data
  const [revenueHistory, setRevenueHistory] = useState<RevenueData[]>([])
  const [revenueByCategory, setRevenueByCategory] = useState<CategoryRevenue[]>(
    []
  )
  const [agingData, setAgingData] = useState<AgingData[]>([])
  const [topDebtors, setTopDebtors] = useState<Debtor[]>([])
  const [delinquencyRate, setDelinquencyRate] = useState(0)
  const didApplyUrlFiltersRef = useRef(false)

  const periodOptions = useMemo(() => generatePeriodOptions(), [])

  // ── Pagination & Selection ──────────────────────────────
  const tableTotalPages = Math.max(
    1,
    Math.ceil(entries.length / TABLE_PAGE_SIZE)
  )
  const tableCurrentPage = Math.min(tablePage, tableTotalPages)
  const paginatedEntries = useMemo(
    () =>
      entries.slice(
        (tableCurrentPage - 1) * TABLE_PAGE_SIZE,
        tableCurrentPage * TABLE_PAGE_SIZE
      ),
    [entries, tableCurrentPage]
  )

  const paginatedIds = useMemo(
    () => paginatedEntries.map((e) => e.id),
    [paginatedEntries]
  )
  const selectedOnPage = paginatedIds.filter((id) => selectedEntryIds.has(id))
  const allOnPageSelected =
    paginatedIds.length > 0 && selectedOnPage.length === paginatedIds.length
  const someOnPageSelected =
    selectedOnPage.length > 0 && selectedOnPage.length < paginatedIds.length

  const toggleEntrySelection = useCallback((id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedEntryIds((prev) => {
        const next = new Set(prev)
        paginatedIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedEntryIds((prev) => {
        const next = new Set(prev)
        paginatedIds.forEach((id) => next.add(id))
        return next
      })
    }
  }, [allOnPageSelected, paginatedIds])

  const isSelectionMode = selectedEntryIds.size > 0

  // ── Computed totals ─────────────────────────────────────
  const selectionTotals = useMemo<FinancialTotals | null>(() => {
    if (selectedEntryIds.size === 0) return null
    const selected = entries.filter((e) => selectedEntryIds.has(e.id))
    if (selected.length === 0) return null
    return {
      gross: selected.reduce((s, e) => s + e.grossAmount, 0),
      net: selected.reduce((s, e) => s + e.netAmount, 0),
      paid: selected
        .filter((e) => e.billingStatus === 'PAID')
        .reduce((s, e) => s + e.grossAmount, 0),
      paidNet: selected
        .filter((e) => e.billingStatus === 'PAID')
        .reduce((s, e) => s + e.netAmount, 0),
      paidCount: selected.filter((e) => e.billingStatus === 'PAID').length,
      unpaid: selected
        .filter((e) => e.billingStatus === 'UNPAID')
        .reduce((s, e) => s + e.grossAmount, 0),
      unpaidCount: selected.filter((e) => e.billingStatus === 'UNPAID').length,
      awaiting: selected
        .filter((e) => e.billingStatus === 'AWAITING_PAYMENT')
        .reduce((s, e) => s + e.grossAmount, 0),
      awaitingCount: selected.filter(
        (e) => e.billingStatus === 'AWAITING_PAYMENT'
      ).length,
      count: selected.length,
    }
  }, [entries, selectedEntryIds])

  const displayTotals = selectionTotals ?? totals
  const hasSelection = selectionTotals !== null

  const hasSettingsChanged = useMemo(() => {
    if (!savedSettingsRef.current) return false
    const saved = savedSettingsRef.current
    return (
      settings.cpfRate !== saved.cpfRate ||
      settings.cnpjRate !== saved.cnpjRate ||
      settings.cniRate !== saved.cniRate ||
      settings.taxRegime !== saved.taxRegime ||
      settings.issRate !== saved.issRate ||
      settings.issExemptRental !== saved.issExemptRental ||
      settings.irpjPresumidoRate !== saved.irpjPresumidoRate ||
      settings.csllPresumidoRate !== saved.csllPresumidoRate ||
      settings.pisCofinsRate !== saved.pisCofinsRate ||
      settings.simplesAliquota !== saved.simplesAliquota ||
      settings.ibsCbsRate !== saved.ibsCbsRate ||
      settings.ibsCbsActive !== saved.ibsCbsActive
    )
  }, [settings])

  // ── Effects ─────────────────────────────────────────────
  useEffect(() => {
    setTablePage(1)
    setSelectedEntryIds(new Set())
  }, [searchTerm, statusFilter, periodFilter])

  // Keep filters ref in sync
  useEffect(() => {
    filtersRef.current = { searchTerm, statusFilter, periodFilter }
  }, [searchTerm, statusFilter, periodFilter])

  useEffect(() => {
    if (didApplyUrlFiltersRef.current) return
    didApplyUrlFiltersRef.current = true

    const initialSearch = (searchParams.get('search') || '').trim()
    const initialStatus = (searchParams.get('status') || 'all').trim()

    if (initialSearch) {
      setSearchTerm(initialSearch)
    }

    if (
      initialStatus === 'all' ||
      ['PAID', 'UNPAID', 'AWAITING_PAYMENT', 'SETTLED'].includes(initialStatus)
    ) {
      setStatusFilter(initialStatus as 'all' | BillingStatus)
    }
  }, [searchParams])

  // ── Data loading ────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    entriesAbortRef.current?.abort()
    const controller = new AbortController()
    entriesAbortRef.current = controller
    const {
      searchTerm: search,
      statusFilter: status,
      periodFilter: period,
    } = filtersRef.current
    const query = new URLSearchParams()
    if (search.trim()) query.set('search', search.trim())
    if (status !== 'all') query.set('status', status)
    const { startDate, endDate } = getPeriodDateRange(period)
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    query.set('limit', '10000')
    try {
      const response = await financialApi.entries(query.toString(), {
        signal: controller.signal,
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok)
        throw new Error('Erro ao carregar lançamentos financeiros')
      const data = response.data

      const nextEntries = Array.isArray(data.entries) ? data.entries : []
      const nextTotals = data.totals
      startTransition(() => {
        setEntries(nextEntries)
        if (nextTotals) setTotals(nextTotals)
      })
    } catch (err) {
      if (isAbortError(err) || !apiClient.isCurrent()) return

      if ((err as Error).name === 'AbortError') return
      throw err
    }
  }, [financialApi, apiClient])

  const loadCalendar = useCallback(async () => {
    const { statusFilter: status, periodFilter: period } = filtersRef.current
    const query = new URLSearchParams()
    if (status !== 'all') query.set('status', status)
    const { startDate, endDate } = getPeriodDateRange(period)
    if (startDate) query.set('start', startDate)
    if (endDate) query.set('end', endDate)
    const response = await financialApi.calendar(query.toString())
    if (!apiClient.isCurrent())
      throw Object.assign(new Error('Escopo encerrado.'), {
        name: 'AbortError',
      })
    if (!response.ok) throw new Error('Erro ao carregar calendário financeiro')
    const data = response.data

    const eventsRaw = Array.isArray(data.events) ? data.events : []
    const mapped: FinancialCalendarEvent[] = eventsRaw.map(
      (event: Record<string, unknown>) => {
        const rawDate = new Date(String(event.start ?? ''))
        const start = new Date(
          rawDate.getFullYear(),
          rawDate.getMonth(),
          rawDate.getDate(),
          0,
          0,
          0
        )
        const end = new Date(
          rawDate.getFullYear(),
          rawDate.getMonth(),
          rawDate.getDate(),
          23,
          59,
          59
        )
        return {
          id: String(event.id ?? ''),
          title: String(event.title ?? ''),
          start,
          end,
          color: String(event.color ?? '#f59e0b'), // token-check-allow: âmbar padrão do evento financeiro
          type: 'rental' as const,
          status: String(event.status ?? 'AWAITING_PAYMENT'),
          resourceId: 'financeiro',
          equipmentName: String(event.title ?? ''),
          metadata: event,
        }
      }
    )
    setCalendarEvents(mapped)
  }, [financialApi, apiClient])

  const loadSettings = useCallback(async () => {
    const response = await financialApi.settings()
    if (!apiClient.isCurrent())
      throw Object.assign(new Error('Escopo encerrado.'), {
        name: 'AbortError',
      })
    if (!response.ok) throw new Error('Erro ao carregar alíquotas')
    const data = response.data

    if (data?.settings) {
      const s = data.settings
      const parsed: FinancialSettings = {
        cpfRate: Number(s.cpfRate),
        cnpjRate: Number(s.cnpjRate),
        cniRate: Number(s.cniRate),
        taxRegime: s.taxRegime || 'SIMPLES_NACIONAL',
        issRate: Number(s.issRate ?? 2.5),
        issExemptRental: s.issExemptRental ?? true,
        irpjPresumidoRate:
          s.irpjPresumidoRate != null ? Number(s.irpjPresumidoRate) : null,
        csllPresumidoRate:
          s.csllPresumidoRate != null ? Number(s.csllPresumidoRate) : null,
        pisCofinsRate: s.pisCofinsRate != null ? Number(s.pisCofinsRate) : null,
        simplesAliquota:
          s.simplesAliquota != null ? Number(s.simplesAliquota) : null,
        ibsCbsRate: s.ibsCbsRate != null ? Number(s.ibsCbsRate) : null,
        ibsCbsActive: s.ibsCbsActive ?? false,
      }
      setSettings(parsed)
      savedSettingsRef.current = parsed
    }
  }, [financialApi, apiClient])

  const loadDashboardData = useCallback(async () => {
    const {
      searchTerm: search,
      statusFilter: status,
      periodFilter: period,
    } = filtersRef.current
    const query = new URLSearchParams()
    if (search.trim()) query.set('search', search.trim())
    if (status !== 'all') query.set('status', status)
    const { startDate, endDate } = getPeriodDateRange(period)
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const queryString = query.toString()
    try {
      const [revenueRes, agingRes] = await Promise.all([
        financialApi.revenue(queryString),
        financialApi.aging(queryString),
      ])
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (revenueRes.ok) {
        const data = revenueRes.data

        setRevenueHistory(data.revenueHistory || [])
        setRevenueByCategory(data.revenueByCategory || [])
      }
      if (agingRes.ok) {
        const data = agingRes.data

        setAgingData(data.agingData || [])
        setTopDebtors(data.topDebtors || [])
        setDelinquencyRate(data.delinquencyRate ?? 0)
      }
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error loading dashboard data:', error)
    }
  }, [financialApi, apiClient])

  const refreshAll = useCallback(async () => {
    try {
      const tasks: Promise<unknown>[] = [
        loadEntries(),
        loadCalendar(),
        loadSettings(),
      ]

      if (viewMode === 'dashboard') {
        tasks.push(loadDashboardData())
      }

      await Promise.all(tasks)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error loading financial dashboard:', error)
      toast.error('Erro ao carregar painel financeiro')
    } finally {
      if (apiClient.isCurrent()) {
        setInitialLoad(false)
      }
    }
  }, [
    loadCalendar,
    loadDashboardData,
    loadEntries,
    loadSettings,
    viewMode,
    apiClient,
  ])

  // Initial load only
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      refreshAll()
    }
  }, [refreshAll])

  // Debounce search: 300ms after typing stops
  useEffect(() => {
    if (!didMountRef.current) return
    const timer = setTimeout(() => {
      loadEntries()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm]) // eslint-disable-line react-hooks/exhaustive-deps -- só a busca dispara o debounce; loadEntries lê os filtros atuais em filtersRef.

  // Reload immediately on filter change (not search)
  const prevFiltersRef = useRef({ statusFilter, periodFilter })
  useEffect(() => {
    if (!didMountRef.current) return
    if (
      prevFiltersRef.current.statusFilter === statusFilter &&
      prevFiltersRef.current.periodFilter === periodFilter
    )
      return
    prevFiltersRef.current = { statusFilter, periodFilter }
    loadEntries()
    loadCalendar()
  }, [statusFilter, periodFilter]) // eslint-disable-line react-hooks/exhaustive-deps -- só a troca de status ou período recarrega; loadEntries e loadCalendar leem os filtros atuais em filtersRef.

  // Keep dashboard charts synchronized with current filters
  useEffect(() => {
    if (!didMountRef.current) return
    if (viewMode !== 'dashboard') return
    loadDashboardData()
  }, [viewMode, searchTerm, statusFilter, periodFilter, loadDashboardData])

  // ── Settings handlers ───────────────────────────────────
  const saveRates = async () => {
    try {
      setSavingRates(true)
      const response = await financialApi.saveSettings({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const errorData = response.data

        throw new Error(errorData.error || 'Erro ao salvar alíquotas')
      }
      savedSettingsRef.current = { ...settings }
      toast.success('Alíquotas financeiras salvas')
      await loadEntries()
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error saving financial rates:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao salvar alíquotas'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setSavingRates(false)
      }
    }
  }

  const resetSettings = () => {
    if (savedSettingsRef.current) {
      setSettings({ ...savedSettingsRef.current })
    }
  }

  // ── Export handler ──────────────────────────────────────
  const handleExport = (format: 'pdf' | 'xlsx' | 'csv') => {
    const query = new URLSearchParams()
    query.set('format', format)
    if (searchTerm.trim()) query.set('search', searchTerm.trim())
    if (statusFilter !== 'all') query.set('status', statusFilter)
    const { startDate, endDate } = getPeriodDateRange(periodFilter)
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    // When items are selected, export only those
    if (selectedEntryIds.size > 0) {
      query.set('ids', Array.from(selectedEntryIds).join(','))
    }
    void exportFile(query.toString(), format)
  }

  return {
    // State
    initialLoad,
    entries,
    totals,
    calendarEvents,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    periodFilter,
    setPeriodFilter,
    viewMode,
    setViewMode,
    expandedCardId,
    setExpandedCardId,
    isRefreshing,
    setIsRefreshing,
    tablePage,
    setTablePage,
    exportFormat,
    setExportFormat,
    selectedEntryIds,
    setSelectedEntryIds,
    settings,
    setSettings,
    showAdvancedTax,
    setShowAdvancedTax,
    savingRates,

    // Dashboard data
    revenueHistory,
    revenueByCategory,
    agingData,
    topDebtors,
    delinquencyRate,

    // Computed
    periodOptions,
    tableTotalPages,
    tableCurrentPage,
    paginatedEntries,
    allOnPageSelected,
    someOnPageSelected,
    isSelectionMode,
    selectionTotals,
    displayTotals,
    hasSelection,
    hasSettingsChanged,

    // Handlers
    toggleEntrySelection,
    toggleSelectAllOnPage,
    loadEntries,
    loadCalendar,
    loadDashboardData,
    refreshAll,
    saveRates,
    resetSettings,
    handleExport,

    // Exposed for entry-details hook
    searchParams,
  }
}
