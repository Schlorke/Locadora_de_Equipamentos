'use client'
import { useState, useMemo } from 'react'
import { toast } from '@gb-locacoes/ui'
import { createClientRentalApi } from '../../../entities/locacao'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
export function useRentalActions(rentalId: string, refresh: () => void) {
  const client = useScopedApiClient(null)
  const rentalApi = useMemo(() => createClientRentalApi(client), [client])
  const [loading, setLoading] = useState(false)
  const [extensionDays, setExtensionDays] = useState(1)
  const [showExtensionDialog, setShowExtensionDialog] = useState(false)
  const [showPickupDialog, setShowPickupDialog] = useState(false)

  const handleRequestExtension = async () => {
    try {
      setLoading(true)
      await rentalApi.requestExtension(rentalId, extensionDays)
      toast.success('Solicitação de prorrogação enviada!')
      setShowExtensionDialog(false)
      refresh()
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      toast.error(
        error instanceof Error ? error.message : 'Erro ao solicitar prorrogação'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRequestPickup = async () => {
    try {
      setLoading(true)
      await rentalApi.requestPickup(rentalId)
      toast.success('Solicitação de coleta enviada!')
      setShowPickupDialog(false)
      refresh()
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      toast.error(
        error instanceof Error ? error.message : 'Erro ao solicitar coleta'
      )
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    extensionDays,
    setExtensionDays,
    showExtensionDialog,
    setShowExtensionDialog,
    showPickupDialog,
    setShowPickupDialog,
    handleRequestExtension,
    handleRequestPickup,
  }
}
