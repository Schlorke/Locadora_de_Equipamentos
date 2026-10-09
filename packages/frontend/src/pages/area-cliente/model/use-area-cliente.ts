'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from '@gb-locacoes/ui'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSession } from '../../../entities/sessao'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import {
  createCustomerApi,
  type CustomerActivity as Activity,
} from '../../../entities/cliente'
import {
  createClientRentalApi,
  getAutoRentalDateRange,
  type ClientRental as Rental,
} from '../../../entities/locacao'
import {
  createClientQuoteApi,
  buildQuotePricing,
  type ClientQuote,
  type ClientQuoteAddress as DeliveryAddress,
} from '../../../entities/orcamento'
import { useCartStore, type CartItem } from '../../../features/carrinho'
import {
  useScopedApiClient,
  useApiClientRevision,
  isAbortError,
  HttpError,
} from '../../../shared/api'
import { keyValueStorage } from '../../../shared/storage'

export function useAreaClienteScope() {
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

export function useAreaCliente() {
  const { data: session } = useSession()
  const client = useScopedApiClient(null)
  const rentalApi = useMemo(() => createClientRentalApi(client), [client])
  const quoteApi = useMemo(() => createClientQuoteApi(client), [client])
  const customerApi = useMemo(() => createCustomerApi(client), [client])
  const { getItemCount, getTotalPrice, items: cartItems } = useCartStore()
  const [rentals, setRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [quotesCount, setQuotesCount] = useState(0)
  const [quotes, setQuotes] = useState<ClientQuote[]>([])
  const [_quotesLoading, setQuotesLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [dismissedActivities, setDismissedActivities] = useState<Set<string>>(
    new Set()
  )
  const [itemCount, setItemCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const requestReferenceDate = useRef(new Date())

  const fetchQuotes = useCallback(async () => {
    try {
      setQuotesLoading(true)
      const data = await quoteApi.list()
      if (!client.isCurrent()) return
      const quotesArray = Array.isArray(data)
        ? data
        : Array.isArray(data.quotes)
          ? data.quotes
          : []
      setQuotes(quotesArray)
      setQuotesCount(quotesArray.length)
    } catch (error) {
      if (
        isAbortError(error) ||
        !client.isCurrent() ||
        error instanceof HttpError
      )
        return
      console.error('Error fetching quotes:', error)
      setQuotes([])
      setQuotesCount(0)
    } finally {
      if (client.isCurrent()) setQuotesLoading(false)
    }
  }, [quoteApi])

  useEffect(() => {
    setMounted(true)
    setItemCount(getItemCount())
  }, [getItemCount])

  useEffect(() => {
    if (session?.user) {
      fetchRentals()
      fetchQuotes()
      fetchActivities()
      void Promise.resolve(
        keyValueStorage.getItem('gb-locacoes-dismissed-activities')
      )
        .then((stored) => {
          if (!client.isCurrent() || !stored) return
          try {
            const dismissed: unknown = JSON.parse(stored)
            if (Array.isArray(dismissed))
              setDismissedActivities(
                (current) =>
                  new Set([
                    ...current,
                    ...dismissed.filter(
                      (id): id is string => typeof id === 'string'
                    ),
                  ])
              )
          } catch {
            /* Preserve the previous malformed-storage fallback. */
          }
        })
        .catch(() => {})
    }
  }, [session, fetchQuotes, rentalApi, customerApi])

  // Atualizar itemCount quando cartItems mudar
  useEffect(() => {
    if (mounted) {
      setItemCount(getItemCount())
    }
  }, [cartItems, mounted, getItemCount])

  const fetchRentals = async () => {
    try {
      setLoading(true)
      const data = await rentalApi.list()
      if (!client.isCurrent()) return
      setRentals(data.rentals || [])
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching rentals:', error)
      toast.error('Erro ao carregar locações')
      setRentals([])
    } finally {
      if (client.isCurrent()) setLoading(false)
    }
  }

  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true)
      const data = await customerApi.activities()
      if (!client.isCurrent()) return
      setActivities(data.activities || [])
    } catch (error) {
      if (isAbortError(error) || error instanceof HttpError) return
      console.error('Error fetching activities:', error)
      setActivities([])
    } finally {
      if (client.isCurrent()) setActivitiesLoading(false)
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

  const formatDateTime = (dateString: string | Date | null | undefined) => {
    if (!dateString) return ''
    try {
      const date =
        typeof dateString === 'string' ? new Date(dateString) : dateString
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const formatDeliveryAddress = (
    address: string | DeliveryAddress | null | undefined
  ): string => {
    if (typeof address === 'string') return address
    const street = address?.street || address?.logradouro
    const number = address?.number || address?.numero
    const complement = address?.complement || address?.complemento
    const neighborhood = address?.neighborhood || address?.bairro
    const city = address?.city || address?.cidade
    const state = address?.state || address?.estado
    const zipCode = address?.zipCode || address?.cep

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
    return parts.length > 0 ? parts.join(' - ') : ''
  }

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

      if (diffInSeconds < 60) {
        return 'há alguns segundos'
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400)
        return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
      } else {
        return formatDate(dateString)
      }
    } catch {
      return 'Data inválida'
    }
  }

  const dismissActivity = (activityId: string) => {
    if (!client.isCurrent()) return
    const newDismissed = new Set(dismissedActivities)
    newDismissed.add(activityId)
    setDismissedActivities(newDismissed)
    // Salvar no localStorage
    void Promise.resolve(
      keyValueStorage.setItem(
        'gb-locacoes-dismissed-activities',
        JSON.stringify(Array.from(newDismissed))
      )
    ).catch(() => {})
    toast.success('Atividade removida do histórico')
  }

  // Helper para formatar datas do carrinho (trata Date ou string do localStorage)
  const formatCartDate = useCallback(
    (date: Date | string | undefined): string => {
      if (!date) return ''
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) return ''
      return format(dateObj, 'dd/MM/yyyy', { locale: ptBR })
    },
    []
  )

  const resolveDateRange = (equipment: CartItem) => {
    if (equipment.startDate && equipment.endDate) {
      const startDate =
        equipment.startDate instanceof Date
          ? equipment.startDate
          : new Date(equipment.startDate)
      const endDate =
        equipment.endDate instanceof Date
          ? equipment.endDate
          : new Date(equipment.endDate)

      return { startDate, endDate, isAuto: false }
    }

    const days = Number(equipment.days) || 1
    const includeWeekends = equipment.includeWeekends ?? false
    const { startDate, endDate } = getAutoRentalDateRange({
      requestDate: requestReferenceDate.current,
      days,
      includeWeekends,
    })

    return { startDate, endDate, isAuto: true }
  }

  const calculateSubtotal = (equipment: CartItem) => {
    const quantity = Number(equipment.quantity) || 1
    const days = Number(equipment.days) || 1
    // Mesma função que grava o orçamento (Decimal, centavos): o subtotal mostrado é o cobrado.
    return buildQuotePricing(equipment, days, quantity).total
  }

  const getEquipmentImage = (equipment: CartItem) => {
    if (
      equipment.images &&
      equipment.images.length > 0 &&
      equipment.images[0] &&
      equipment.images[0].trim() !== ''
    ) {
      return equipment.images[0]
    }
    return `/placeholder.svg?height=60&width=60&text=${encodeURIComponent(equipment.equipmentName)}`
  }

  const activeRentals = rentals.filter(
    (r) => r.status === 'ACTIVE' || r.status === 'PENDING'
  )
  const _completedRentals = rentals.filter((r) => r.status === 'COMPLETED')

  return {
    session,
    rentals,
    loading,
    quotesCount,
    quotes,
    activities,
    activitiesLoading,
    dismissedActivities,
    itemCount,
    mounted,
    cartItems,
    getTotalPrice,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatDeliveryAddress,
    formatRelativeTime,
    dismissActivity,
    formatCartDate,
    resolveDateRange,
    calculateSubtotal,
    getEquipmentImage,
    activeRentals,
  }
}
