'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '@gb-locacoes/ui'
import { useSession } from '../../../entities/sessao'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import {
  createClientRentalApi,
  type ClientRental as Rental,
} from '../../../entities/locacao'
import {
  createClientQuoteApi,
  type ClientQuote as Quote,
  type ClientQuoteAddress as DeliveryAddress,
} from '../../../entities/orcamento'
import {
  useScopedApiClient,
  useApiClientRevision,
  isAbortError,
  HttpError,
} from '../../../shared/api'
import { useActiveRefresh } from '../../../shared/lib/activity'

function formatDeliveryAddress(address: DeliveryAddress): string {
  const street = address.street || address.logradouro
  const number = address.number || address.numero
  const complement = address.complement || address.complemento
  const neighborhood = address.neighborhood || address.bairro
  const city = address.city || address.cidade
  const state = address.state || address.estado
  const zipCode = address.zipCode || address.cep

  const parts: string[] = []

  if (street) {
    parts.push(number ? `${street}, ${number}` : street)
  }
  if (complement) parts.push(complement)
  if (neighborhood) parts.push(neighborhood)
  if (city && state) {
    parts.push(`${city}/${state}`)
  } else if (city) {
    parts.push(city)
  }
  if (zipCode) parts.push(zipCode)

  return parts.length > 0 ? parts.join(' - ') : 'Endereço informado'
}

type HistoryItem =
  { type: 'rental'; data: Rental } | { type: 'quote'; data: Quote }
export function useHistoryScope() {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  return JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    revision,
  ])
}
export function useHistory() {
  const { data: session } = useSession()
  const client = useScopedApiClient(null)
  const rentalApi = useMemo(() => createClientRentalApi(client), [client])
  const quoteApi = useMemo(() => createClientQuoteApi(client), [client])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [rentalToDelete, setRentalToDelete] = useState<string | null>(null)
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingQuote, setIsDeletingQuote] = useState(false)

  const fetchData = useCallback(
    async (options?: { showLoading?: boolean; showErrorToast?: boolean }) => {
      const showLoading = options?.showLoading ?? true
      const showErrorToast = options?.showErrorToast ?? true

      if (!session?.user?.id) {
        if (client.isCurrent() && showLoading) {
          setLoading(false)
        }
        return
      }

      try {
        if (showLoading) {
          setLoading(true)
        }

        // HTTP mantém a falha por recurso; falha de rede interrompe o lote.
        const responseOrHttpError = <T>(request: Promise<T>) =>
          request.catch((error: unknown) => {
            if (error instanceof HttpError) return error
            throw error
          })
        const [rentalsData, quotesData] = await Promise.all([
          responseOrHttpError(rentalApi.list()),
          responseOrHttpError(quoteApi.list()),
        ])

        if (!client.isCurrent()) return
        if (rentalsData instanceof HttpError) {
          console.error('Erro ao carregar locações:', rentalsData.status)
        } else {
          setRentals(rentalsData.rentals || [])
        }
        if (quotesData instanceof HttpError) {
          console.error('Erro ao carregar orçamentos:', quotesData.status)
          setQuotes([])
        } else {
          const quotesArray = Array.isArray(quotesData)
            ? quotesData
            : quotesData.quotes || []
          setQuotes(quotesArray)
        }
      } catch (error) {
        if (isAbortError(error) || !client.isCurrent()) return
        console.error('Error fetching data:', error)
        if (showErrorToast) {
          toast.error('Erro ao carregar histórico')
        }
      } finally {
        if (showLoading) {
          setLoading(false)
        }
      }
    },
    [session?.user?.id, rentalApi, quoteApi]
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useActiveRefresh(
    useCallback(() => {
      void fetchData({ showLoading: false, showErrorToast: false })
    }, [fetchData]),
    Boolean(session?.user?.id)
  )

  const handleDeleteRental = async () => {
    if (!rentalToDelete) return

    try {
      setIsDeleting(true)
      await rentalApi.hide(rentalToDelete)

      toast.success('Locação removida do histórico com sucesso')
      setRentalToDelete(null)
      // Recarregar a lista de dados
      await fetchData()
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error deleting rental:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao remover locação do histórico'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return

    try {
      setIsDeletingQuote(true)
      await quoteApi.hide(quoteToDelete)

      toast.success('Orçamento removido do histórico com sucesso')
      setQuoteToDelete(null)
      // Recarregar a lista de dados
      await fetchData()
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error deleting quote:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao excluir orçamento'
      )
    } finally {
      setIsDeletingQuote(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return 'Data inválida'
    }
  }

  // rerender-derived-state-no-effect: memoizar para evitar recálculo em todo render
  const convertedQuoteIds = useMemo(
    () =>
      new Set(
        rentals
          .map((rental) => rental.quoteId || rental.quote?.id)
          .filter((id): id is string => !!id)
      ),
    [rentals]
  )

  const quoteToRentalMap = useMemo(() => {
    const map = new Map<string, string>()
    rentals.forEach((rental) => {
      const quoteId = rental.quoteId || rental.quote?.id
      if (quoteId) map.set(quoteId, rental.id)
    })
    return map
  }, [rentals])

  const historyItems = useMemo(() => {
    const items: HistoryItem[] = [
      ...rentals.map((rental) => ({ type: 'rental' as const, data: rental })),
      ...quotes
        .filter((quote) => !convertedQuoteIds.has(quote.id))
        .map((quote) => ({ type: 'quote' as const, data: quote })),
    ]
    items.sort((a, b) => {
      const dateA =
        a.type === 'rental'
          ? new Date(a.data.startdate).getTime()
          : new Date(a.data.createdAt).getTime()
      const dateB =
        b.type === 'rental'
          ? new Date(b.data.startdate).getTime()
          : new Date(b.data.createdAt).getTime()
      return dateB - dateA
    })
    return items
  }, [rentals, quotes, convertedQuoteIds])

  const filteredItems = useMemo(
    () =>
      historyItems.filter((item) => {
        // Search filter
        const matchesSearch =
          searchTerm === '' ||
          (item.type === 'rental'
            ? item.data.rental_items.some((item) =>
                item.equipments.name
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              )
            : item.data.items?.some((item) =>
                item.equipment.name
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              ) ||
              item.data.id.toLowerCase().includes(searchTerm.toLowerCase()))

        // Status filter
        let matchesStatus: boolean
        if (statusFilter === 'all') {
          matchesStatus = true
        } else if (item.type === 'rental') {
          matchesStatus =
            (statusFilter === 'pending' && item.data.status === 'PENDING') ||
            (statusFilter === 'in_progress' &&
              (item.data.status === 'ACTIVE' ||
                item.data.status === 'OVERDUE')) ||
            (statusFilter === 'completed' &&
              item.data.status === 'COMPLETED') ||
            (statusFilter === 'cancelled' && item.data.status === 'CANCELLED')
        } else {
          // Para orçamentos
          matchesStatus =
            (statusFilter === 'pending' && item.data.status === 'pending') ||
            (statusFilter === 'approved' && item.data.status === 'approved') ||
            (statusFilter === 'completed' &&
              item.data.status === 'completed') ||
            (statusFilter === 'cancelled' && item.data.status === 'rejected')
        }

        return matchesSearch && matchesStatus
      }),
    [historyItems, searchTerm, statusFilter]
  )

  return {
    session,
    rentals,
    quotes,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    rentalToDelete,
    setRentalToDelete,
    quoteToDelete,
    setQuoteToDelete,
    isDeleting,
    isDeletingQuote,
    handleDeleteRental,
    handleDeleteQuote,
    historyItems,
    filteredItems,
    quoteToRentalMap,
    formatCurrency,
    formatDate,
    formatDeliveryAddress,
  }
}
