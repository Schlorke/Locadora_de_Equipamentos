'use client'

import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminQuotesApi } from '../api/admin-quotes'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { useDebounce } from '../../../shared/lib'
import { toast } from '../../../shared/lib/toast'
import { type Quote } from '../../../entities/orcamento'
import {
  normalizeQuote,
  getQuoteReferenceDate,
  hasQuotesInMonth,
  findFirstMonthWithQuotes,
} from '../../../entities/orcamento'

// ─── Return type ────────────────────────────────────────────────

export interface UseQuotesDataReturn {
  // State
  quotes: Quote[]
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>
  loading: boolean
  totalCount: number
  totalPages: number
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  statusFilter: string
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>
  periodFilter: string
  setPeriodFilter: React.Dispatch<React.SetStateAction<string>>
  valueFilter: string
  setValueFilter: React.Dispatch<React.SetStateAction<string>>
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  pageSize: number
  viewMode: 'table' | 'kanban' | 'calendar'
  setViewMode: React.Dispatch<
    React.SetStateAction<'table' | 'kanban' | 'calendar'>
  >
  kanbanMonth: Date
  setKanbanMonth: React.Dispatch<React.SetStateAction<Date>>
  contentAnimReady: boolean

  // Computed
  kanbanFilteredQuotes: Quote[]
  paginatedTableQuotes: Quote[]
  itemCountsByMonth: Record<string, number>

  // Refs
  kanbanMonthHasMounted: React.MutableRefObject<boolean>
  quotesRef: React.MutableRefObject<Quote[]>
  boletoActionLocksRef: React.MutableRefObject<Set<string>>

  // Actions
  fetchQuotes: () => Promise<Quote[]>
  updateQuoteInState: (_quoteId: string) => Promise<Quote | null>
}

// ─── Hook ───────────────────────────────────────────────────────

export function useQuotesModel(requestedSearch = ''): UseQuotesDataReturn {
  const apiClient = useScopedApiClient(null)
  const quoteApi = useMemo(() => createAdminQuotesApi(apiClient), [apiClient])
  const quotesAbortRef = useRef<AbortController | null>(null)

  // ── Core state ──────────────────────────────────────────────
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 350)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [valueFilter, setValueFilter] = useState<string>('all')

  // ── Pagination ──────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // ── View / Kanban ───────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>(
    'kanban'
  )
  const [kanbanMonth, setKanbanMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  )

  // ── Animation ───────────────────────────────────────────────
  const contentAnimReady = true

  // ── Table animation state ───────────────────────────────────
  const [tableQuotes, setTableQuotes] = useState<Quote[]>([])

  // ── Refs ────────────────────────────────────────────────────
  const hasLoadedQuotesRef = useRef(false)
  const kanbanMonthHasMounted = useRef(false)
  const viewModeRef = useRef(viewMode)
  const kanbanMonthRef = useRef(kanbanMonth)
  viewModeRef.current = viewMode
  kanbanMonthRef.current = kanbanMonth

  const quotesRef = useRef(quotes)
  quotesRef.current = quotes

  const boletoActionLocksRef = useRef<Set<string>>(new Set())
  const didInitTableQuotesRef = useRef(false)
  const didApplyUrlSearchRef = useRef(false)

  // ── Effects ─────────────────────────────────────────────────

  // 1. Reset kanbanMonthHasMounted when leaving kanban view
  useEffect(() => {
    if (viewMode !== 'kanban') {
      kanbanMonthHasMounted.current = false
    }
  }, [viewMode])

  // 3. didApplyUrlSearchRef (URL search params init)
  useEffect(() => {
    if (didApplyUrlSearchRef.current) return
    didApplyUrlSearchRef.current = true

    const initialSearch = requestedSearch.trim()
    if (initialSearch) {
      setSearchTerm(initialSearch)
    }
  }, [requestedSearch])

  // 4. Reset currentPage when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, statusFilter, periodFilter, valueFilter])

  // ── fetchQuotes ─────────────────────────────────────────────

  const fetchQuotes = useCallback(async (): Promise<Quote[]> => {
    quotesAbortRef.current?.abort()
    const controller = new AbortController()
    quotesAbortRef.current = controller
    try {
      // Evita flicker/reload visual apos a primeira carga da pagina.
      if (!hasLoadedQuotesRef.current) {
        setLoading(true)
      }

      // Kanban precisa de todos os status (colunas) e limite alto para exibir
      // todos os orcamentos do mes selecionado; a filtragem por mes e client-side.
      // Usa ref para nao disparar refetch ao trocar de view.
      const isKanban = viewModeRef.current === 'kanban'

      // Construir query params com paginacao e filtros
      const params = new URLSearchParams({
        page: isKanban ? '1' : String(currentPage),
        limit: isKanban ? '500' : String(pageSize),
      })
      const normalizedSearchTerm = debouncedSearchTerm.trim()

      // Adicionar filtro de busca se houver
      if (normalizedSearchTerm !== '') {
        params.append('search', normalizedSearchTerm)
      }

      // Adicionar filtro de status se nao for 'all'
      // Em Kanban, nao filtrar por status — as colunas exibem todos os status
      if (!isKanban && statusFilter !== 'all') {
        params.append('status', statusFilter.toUpperCase())
      }

      // Em Kanban, periodo/valor ficam ocultos no UI e nao devem filtrar
      // silenciosamente os resultados de busca.
      if (!isKanban && periodFilter !== 'all') {
        params.append('period', periodFilter)
      }
      if (!isKanban && valueFilter !== 'all') {
        params.append('valueRange', valueFilter)
      }

      const response = await quoteApi.list(String(params), {
        signal: controller.signal,
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      const data = response.data

      // Verificacao defensiva para garantir que data e um objeto com quotes
      const quotesArray = Array.isArray(data?.quotes)
        ? data.quotes
        : Array.isArray(data)
          ? data
          : []

      const normalizedQuotes = quotesArray.map((quote: Quote) =>
        normalizeQuote(quote as Quote)
      )

      // Busca no Kanban: ajustar mes de destino no mesmo ciclo do setQuotes
      // para evitar render transitorio com colunas vazias.
      if (
        isKanban &&
        normalizedSearchTerm !== '' &&
        normalizedQuotes.length > 0
      ) {
        const currentMonth = kanbanMonthRef.current
        const currentMonthHasResults = hasQuotesInMonth(
          normalizedQuotes,
          currentMonth
        )

        if (!currentMonthHasResults) {
          const firstMonthWithResults =
            findFirstMonthWithQuotes(normalizedQuotes)
          if (
            firstMonthWithResults &&
            firstMonthWithResults.getTime() !==
              startOfMonth(currentMonth).getTime()
          ) {
            setKanbanMonth(firstMonthWithResults)
          }
        }
      }

      setQuotes(normalizedQuotes)

      // Atualizar metadados de paginacao
      if (data.pagination) {
        setTotalCount(data.pagination.totalItems || 0)
        setTotalPages(data.pagination.totalPages || 0)
      }

      return normalizedQuotes
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return []

      console.error('Error fetching quotes:', error)
      toast.error('Erro', {
        description: 'Erro ao carregar orçamentos. Tente novamente.',
      })
      setQuotes([])
      return []
    } finally {
      if (apiClient.isCurrent()) {
        hasLoadedQuotesRef.current = true
        setLoading(false)
      }
    }
  }, [
    currentPage,
    pageSize,
    debouncedSearchTerm,
    statusFilter,
    periodFilter,
    valueFilter,
    quoteApi,
    apiClient,
  ])

  // 5. fetchQuotes on fetchQuotes change
  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // ── updateQuoteInState ──────────────────────────────────────

  const updateQuoteInState = useCallback(
    async (quoteId: string): Promise<Quote | null> => {
      try {
        const response = await quoteApi.get(quoteId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!response.ok) return null

        const updatedQuote = normalizeQuote(response.data)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })

        // Atualizar no estado local preservando os outros quotes
        setQuotes((prevQuotes) => {
          const index = prevQuotes.findIndex((q) => q.id === quoteId)
          if (index === -1) return prevQuotes

          const newQuotes = [...prevQuotes]
          newQuotes[index] = updatedQuote
          return newQuotes
        })

        return updatedQuote
      } catch (error) {
        if (isAbortError(error) || !apiClient.isCurrent()) return null

        console.error('Error fetching updated quote:', error)
        return null
      }
    },
    [quoteApi, apiClient]
  )

  // ── Memos ───────────────────────────────────────────────────

  // Contagem de orcamentos por mes para badges do KanbanMonthNavigator
  const itemCountsByMonth = useMemo(() => {
    const counts: Record<string, number> = {}
    quotes.forEach((quote) => {
      const referenceDate = getQuoteReferenceDate(quote)
      if (!referenceDate) return
      const key = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [quotes])

  // Filtragem por mes para o Kanban (sincrona via useMemo para evitar flash visual)
  const kanbanFilteredQuotes = useMemo(() => {
    if (viewMode !== 'kanban') return quotes
    const monthStart = startOfMonth(kanbanMonth)
    const monthEnd = endOfMonth(kanbanMonth)
    return quotes.filter((quote) => {
      const referenceDate = getQuoteReferenceDate(quote)
      if (!referenceDate) return true
      return referenceDate >= monthStart && referenceDate <= monthEnd
    })
  }, [quotes, viewMode, kanbanMonth])

  // 6. Kanban search auto-navigate: mantem filtro por mes e auto-navega
  // para o primeiro mes com resultados quando o mes atual nao contem nenhum item.
  useEffect(() => {
    if (viewMode !== 'kanban') return
    if (debouncedSearchTerm.trim() === '') return
    if (quotes.length === 0) return

    if (hasQuotesInMonth(quotes, kanbanMonth)) return

    const firstMonthWithResults = findFirstMonthWithQuotes(quotes)
    if (!firstMonthWithResults) return
    if (
      firstMonthWithResults.getTime() === startOfMonth(kanbanMonth).getTime()
    ) {
      return
    }

    setKanbanMonth(firstMonthWithResults)
  }, [quotes, viewMode, kanbanMonth, debouncedSearchTerm])

  // 7. Sync tableQuotes with quotes (para animacoes da tabela)
  useEffect(() => {
    if (!didInitTableQuotesRef.current) {
      setTableQuotes(Array.isArray(quotes) ? quotes : [])
      didInitTableQuotesRef.current = true
      return
    }

    const next = Array.isArray(quotes) ? quotes : []
    setTableQuotes(next)
  }, [quotes])

  // Paginacao agora e server-side, entao tableQuotes ja vem paginado
  const paginatedTableQuotes = tableQuotes

  // ── Return ──────────────────────────────────────────────────

  return {
    // State
    quotes,
    setQuotes,
    loading,
    totalCount,
    totalPages,
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
    pageSize,
    viewMode,
    setViewMode,
    kanbanMonth,
    setKanbanMonth,
    contentAnimReady,

    // Computed
    kanbanFilteredQuotes,
    paginatedTableQuotes,
    itemCountsByMonth,

    // Refs
    kanbanMonthHasMounted,
    quotesRef,
    boletoActionLocksRef,

    // Actions
    fetchQuotes,
    updateQuoteInState,
  }
}
