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
  type ClientRentalDetail as Rental,
} from '../../../entities/locacao'
import {
  createClientQuoteApi,
  type ClientQuoteDetail as Quote,
} from '../../../entities/orcamento'
import {
  useScopedApiClient,
  useApiClientRevision,
  isAbortError,
  HttpError,
} from '../../../shared/api'
import { useActiveRefresh } from '../../../shared/lib/activity'

export function useRentalDetailScope(id: string | null) {
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
    id,
  ])
}
export function useRentalDetail(
  paramId: string | null,
  navigate: (href: string) => void
) {
  const router = useMemo(() => ({ push: navigate }), [navigate])
  const client = useScopedApiClient(null)
  const rentalApi = useMemo(() => createClientRentalApi(client), [client])
  const quoteApi = useMemo(() => createClientQuoteApi(client), [client])
  const [rental, setRental] = useState<Rental | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDeletingQuote, setIsDeletingQuote] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false)
  const [showCancelFromAdjustment, setShowCancelFromAdjustment] =
    useState(false)

  // Detectar se é um orçamento pelo prefixo "quote_"
  const isQuote = paramId?.startsWith('quote_') ?? false
  const actualId = isQuote ? paramId?.replace('quote_', '') : paramId

  const fetchRental = useCallback(
    async (options?: {
      showLoading?: boolean
      showErrorToast?: boolean
      allowRedirect?: boolean
    }) => {
      const showLoading = options?.showLoading ?? true
      const showErrorToast = options?.showErrorToast ?? true
      const allowRedirect = options?.allowRedirect ?? true

      if (!actualId) return

      try {
        if (showLoading) {
          setLoading(true)
        }

        if (isQuote) {
          setQuote(await quoteApi.read(actualId))
        } else {
          const data = await rentalApi.read(actualId)
          setRental(data.rental)
        }
      } catch (error) {
        if (isAbortError(error) || !client.isCurrent()) return
        if (error instanceof HttpError && error.status === 404) {
          if (showErrorToast)
            toast.error(
              isQuote ? 'Orçamento não encontrado' : 'Locação não encontrada'
            )
          if (allowRedirect) router.push('/area-cliente/historico')
          return
        }
        console.error('Error fetching data:', error)
        if (showErrorToast) {
          toast.error(
            isQuote ? 'Erro ao carregar orçamento' : 'Erro ao carregar locação'
          )
        }
        if (allowRedirect) {
          router.push('/area-cliente/historico')
        }
      } finally {
        if (client.isCurrent() && showLoading) {
          setLoading(false)
        }
      }
    },
    [actualId, isQuote, router, quoteApi, rentalApi]
  )

  useEffect(() => {
    if (actualId) {
      fetchRental()
    }
  }, [actualId, fetchRental])

  useActiveRefresh(
    useCallback(() => {
      void fetchRental({
        showLoading: false,
        showErrorToast: false,
        allowRedirect: false,
      })
    }, [fetchRental]),
    Boolean(actualId)
  )

  const handleDeleteQuote = async () => {
    if (!quote || !actualId) return

    try {
      setIsDeletingQuote(true)
      await quoteApi.hide(actualId)

      toast.success('Orçamento cancelado com sucesso')
      router.push('/area-cliente/historico')
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error deleting quote:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao cancelar orçamento'
      )
    } finally {
      setIsDeletingQuote(false)
      setShowDeleteDialog(false)
    }
  }

  return {
    rental,
    quote,
    loading,
    isDeletingQuote,
    setIsDeletingQuote,
    showDeleteDialog,
    setShowDeleteDialog,
    showAdjustmentDialog,
    setShowAdjustmentDialog,
    showCancelFromAdjustment,
    setShowCancelFromAdjustment,
    isQuote,
    actualId,
    fetchRental,
    handleDeleteQuote,
    rentalApi,
    client,
  }
}
