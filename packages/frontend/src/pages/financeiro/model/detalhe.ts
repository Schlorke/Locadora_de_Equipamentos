'use client'

import { createFinancialApi } from '../api/financial'
import {
  createAdminPaymentApi,
  getBoletoIssuanceFeedback,
} from '../../../entities/pagamento'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import {
  type BillingStatus,
  type FinancialEntry,
  type PriceAdjustmentItem,
  type AdjustmentHistoryItem,
  createDefaultAdjustmentItem,
} from './tipos'
import {
  formatDateForInput,
  dueDateInputToISOString,
} from '../../../shared/lib/formatting'

export interface UseFinancialEntryDetailsParams {
  refreshAll: () => Promise<void>
  viewMode: string
  loadEntries: () => Promise<void>
  loadCalendar: () => Promise<void>
  loadDashboardData: () => Promise<void>
  entries: FinancialEntry[]
  searchParams: Pick<URLSearchParams, 'get'>
  navigate: (path: string) => void
  requestRegeneration: (message: string) => boolean | Promise<boolean>
}

export function useFinancialEntryDetailsModel({
  refreshAll,
  viewMode,
  loadEntries,
  loadCalendar,
  loadDashboardData,
  entries,
  searchParams,
  navigate,
  requestRegeneration,
}: UseFinancialEntryDetailsParams) {
  const paymentClient = useScopedApiClient(null)
  const paymentApi = useMemo(
    () => createAdminPaymentApi(paymentClient),
    [paymentClient]
  )

  const regenerationLeasesRef = useRef(new Set<string>())

  // ── State ───────────────────────────────────────────────
  const [selectedEntry, setSelectedEntry] = useState<FinancialEntry | null>(
    null
  )
  const apiClient = useScopedApiClient(selectedEntry?.id ?? null)
  const financialApi = useMemo(() => createFinancialApi(apiClient), [apiClient])
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [entryIdToDelete, setEntryIdToDelete] = useState<string | null>(null)
  const [isDeletingEntry, setIsDeletingEntry] = useState(false)
  const [showAdjustmentDeleteConfirm, setShowAdjustmentDeleteConfirm] =
    useState(false)
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<{
    id: string
    quoteId: string
  } | null>(null)
  const [deletingAdjustmentId, setDeletingAdjustmentId] = useState<
    string | null
  >(null)

  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [savingDueDateId, setSavingDueDateId] = useState<string | null>(null)
  const [regeneratingBoletoId, setRegeneratingBoletoId] = useState<
    string | null
  >(null)

  // Adjustment state
  const [showPriceAdjustmentDialog, setShowPriceAdjustmentDialog] =
    useState(false)
  const [nestedDialogOpen, setNestedDialogOpen] = useState(false)
  const [priceAdjustmentItems, setPriceAdjustmentItems] = useState<
    PriceAdjustmentItem[]
  >(() => [createDefaultAdjustmentItem()])
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(
    null
  )
  const [isAdjustingPrice, setIsAdjustingPrice] = useState(false)
  const [adjustmentHistory, setAdjustmentHistory] = useState<
    AdjustmentHistoryItem[]
  >([])
  const [loadingAdjustments, setLoadingAdjustments] = useState(false)

  // ── Effects ─────────────────────────────────────────────
  useEffect(() => {
    regenerationLeasesRef.current = new Set()
    setSavingStatusId(null)
    setSavingDueDateId(null)
    setRegeneratingBoletoId(null)
    setIsDeletingEntry(false)
    setDeletingAdjustmentId(null)
    setIsAdjustingPrice(false)
  }, [apiClient])

  useEffect(() => {
    setNestedDialogOpen(
      showPriceAdjustmentDialog ||
        showDeleteConfirm ||
        showAdjustmentDeleteConfirm
    )
  }, [
    showPriceAdjustmentDialog,
    showDeleteConfirm,
    showAdjustmentDeleteConfirm,
  ])

  useEffect(() => {
    setDueDateDraft(formatDateForInput(selectedEntry?.dueDate))
    // Load adjustment history when modal opens
    if (selectedEntry?.quoteId) {
      setLoadingAdjustments(true)
      setAdjustmentHistory([])
      financialApi
        .adjustments(selectedEntry.quoteId)
        .then((res) => (res.ok ? res.data : { adjustments: [] }))
        .then((data) => {
          if (apiClient.isCurrent())
            setAdjustmentHistory(data.adjustments || [])
        })
        .catch((error) => {
          if (isAbortError(error) || !apiClient.isCurrent()) return
          setAdjustmentHistory([])
        })
        .finally(() => {
          if (apiClient.isCurrent()) setLoadingAdjustments(false)
        })
    } else {
      setAdjustmentHistory([])
    }
  }, [selectedEntry, financialApi, apiClient])

  // Auto-select entry from URL (?quoteId=xxx)
  const didSelectEntryFromUrlRef = useRef<string | null>(null)
  useEffect(() => {
    const quoteIdFromUrl = searchParams.get('quoteId')?.trim()
    if (!quoteIdFromUrl) {
      didSelectEntryFromUrlRef.current = null
      return
    }
    if (entries.length === 0) return
    if (didSelectEntryFromUrlRef.current === quoteIdFromUrl) return

    const match = entries.find((e) => e.quoteId === quoteIdFromUrl)
    if (match) {
      didSelectEntryFromUrlRef.current = quoteIdFromUrl
      setSelectedEntry(match)
    }
  }, [entries, searchParams])

  // ── Handlers ────────────────────────────────────────────
  const openQuoteFromEntry = useCallback(
    (entry: FinancialEntry) => {
      const lookup = (
        entry.quoteCode ||
        entry.legacyExternalCode ||
        entry.quoteId ||
        ''
      ).trim()

      if (!lookup) {
        toast.error('Orçamento não disponível para este lançamento')
        return
      }

      const query = new URLSearchParams()
      query.set('search', lookup)
      if (entry.quoteId) query.set('quoteId', entry.quoteId)
      navigate(`/admin/orcamentos?${query.toString()}`)
    },
    [navigate]
  )

  const updateBillingStatus = async (
    entryId: string,
    billingStatus: BillingStatus
  ) => {
    try {
      setSavingStatusId(entryId)
      const response = await financialApi.status(entryId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingStatus }),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const errorData = response.data

        throw new Error(errorData.error || 'Erro ao atualizar status')
      }
      const tasks: Promise<unknown>[] = [loadEntries(), loadCalendar()]
      if (viewMode === 'dashboard') tasks.push(loadDashboardData())
      await Promise.all(tasks)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      toast.success('Status financeiro atualizado')
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error updating billing status:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar status'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setSavingStatusId(null)
      }
    }
  }

  const updateEntryDueDate = async (entryId: string, dueDateValue: string) => {
    if (!dueDateValue) return

    try {
      setSavingDueDateId(entryId)
      const response = await paymentApi.updateDueDate(
        entryId,
        dueDateInputToISOString(dueDateValue)
      )
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const errorData = response.data ?? {}
        throw new Error(errorData.error || 'Erro ao atualizar vencimento')
      }

      const data = (response.data ?? {}) as {
        processing?: string
        message?: string
        entry?: { id: string; dueDate: string; billingStatus: BillingStatus }
      }
      const pending = response.status === 202 || data.processing === 'PENDING'
      if (!pending && data.entry) {
        const entry = data.entry
        setSelectedEntry((previous) =>
          previous?.id === entryId
            ? {
                ...previous,
                dueDate: entry.dueDate,
                billingStatus: entry.billingStatus,
              }
            : previous
        )
        setDueDateDraft(formatDateForInput(entry.dueDate))
      }
      const tasks: Promise<unknown>[] = [loadEntries(), loadCalendar()]
      if (viewMode === 'dashboard') tasks.push(loadDashboardData())
      await Promise.all(tasks)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!paymentClient.isCurrent()) return
      if (pending)
        toast.info(
          'Reemissão solicitada; o vencimento será atualizado após confirmação.'
        )
      else toast.success('Vencimento atualizado com sucesso')
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      if (isAbortError(error) || !paymentClient.isCurrent()) return
      console.error('Error updating due date:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar vencimento'
      )
    } finally {
      if (apiClient.isCurrent()) {
        if (paymentClient.isCurrent()) setSavingDueDateId(null)
      }
    }
  }

  const deleteEntry = useCallback(
    async (entryId: string) => {
      try {
        const response = await financialApi.remove(entryId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!response.ok) {
          const errorData = response.data

          throw new Error(errorData.error || 'Erro ao excluir lançamento')
        }
        const tasks: Promise<unknown>[] = [loadEntries(), loadCalendar()]
        if (viewMode === 'dashboard') tasks.push(loadDashboardData())
        await Promise.all(tasks)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        toast.success('Lançamento excluído com sucesso')
        setShowDeleteConfirm(false)
        setEntryIdToDelete(null)
        if (selectedEntry?.id === entryId) setSelectedEntry(null)
      } catch (error) {
        if (isAbortError(error) || !apiClient.isCurrent()) return

        console.error('Error deleting entry:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao excluir lançamento'
        )
      } finally {
        if (apiClient.isCurrent()) {
          setIsDeletingEntry(false)
        }
      }
    },
    [
      loadDashboardData,
      loadEntries,
      loadCalendar,
      selectedEntry,
      viewMode,
      financialApi,
      apiClient,
    ]
  )

  const handleConfirmDeleteEntry = useCallback(() => {
    if (!entryIdToDelete) return
    setIsDeletingEntry(true)
    void deleteEntry(entryIdToDelete)
  }, [entryIdToDelete, deleteEntry])

  const handleConfirmDeleteAdjustment = useCallback(async () => {
    if (!adjustmentToDelete || !selectedEntry?.quoteId) return
    setDeletingAdjustmentId(adjustmentToDelete.id)
    try {
      const res = await financialApi.removeAdjustment(
        adjustmentToDelete.quoteId,
        adjustmentToDelete.id
      )
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!res.ok) {
        const data = res.data

        throw new Error(data.error || 'Erro ao excluir reajuste')
      }
      toast.success('Reajuste excluído. Valor do orçamento recalculado.')
      setShowAdjustmentDeleteConfirm(false)
      setAdjustmentToDelete(null)
      refreshAll()
      const adjRes = await financialApi.adjustments(selectedEntry.quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (adjRes.ok) {
        const adjData = adjRes.data

        setAdjustmentHistory(adjData.adjustments || [])
      }
    } catch (err) {
      if (isAbortError(err) || !apiClient.isCurrent()) return

      toast.error(
        err instanceof Error ? err.message : 'Erro ao excluir reajuste'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setDeletingAdjustmentId(null)
      }
    }
  }, [
    adjustmentToDelete,
    selectedEntry?.quoteId,
    refreshAll,
    financialApi,
    apiClient,
  ])

  // ── Adjustment CRUD ─────────────────────────────────────
  const addPriceAdjustmentItem = () => {
    setPriceAdjustmentItems((prev) => [...prev, createDefaultAdjustmentItem()])
  }

  const removePriceAdjustmentItem = (id: string) => {
    setPriceAdjustmentItems((prev) => prev.filter((i) => i.id !== id))
  }

  const updatePriceAdjustmentItem = (
    id: string,
    patch: Partial<PriceAdjustmentItem>
  ) => {
    setPriceAdjustmentItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    )
  }

  const adjustQuotePriceForEntry = async (quoteId: string) => {
    const invalidItem = priceAdjustmentItems.find(
      (item) =>
        !item.category ||
        !item.reason.trim() ||
        isNaN(item.value) ||
        item.value <= 0 ||
        (item.category === 'OTHER' &&
          (!item.categoryOther || !item.categoryOther.trim()))
    )
    if (invalidItem) {
      toast.error('Erro de Validação', {
        description: !invalidItem.category
          ? 'Selecione a categoria do reajuste em todos os itens.'
          : invalidItem.category === 'OTHER' &&
              (!invalidItem.categoryOther || !invalidItem.categoryOther.trim())
            ? 'Ao selecionar "Outro", informe a categoria específica.'
            : 'Preencha categoria, valor adicional e justificativa em todos os itens.',
      })
      return
    }
    try {
      setIsAdjustingPrice(true)
      if (editingAdjustmentId) {
        const delRes = await financialApi.removeAdjustment(
          quoteId,
          editingAdjustmentId
        )
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!delRes.ok) {
          const err = delRes.data

          throw new Error(err.error || 'Erro ao remover reajuste anterior')
        }
        refreshAll()
        const adjResBefore = await financialApi
          .adjustments(quoteId)
          .catch(() => null)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (adjResBefore?.ok && selectedEntry?.quoteId === quoteId) {
          const adjData = adjResBefore.data

          setAdjustmentHistory(adjData.adjustments || [])
        }
        setEditingAdjustmentId(null)
      }
      for (const item of priceAdjustmentItems) {
        const justification =
          item.category === 'OTHER' && item.categoryOther?.trim()
            ? `${item.categoryOther.trim()}: ${item.reason.trim()}`
            : item.reason.trim()
        const response = await financialApi.addAdjustment(quoteId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: item.category,
            amount: item.value,
            justification,
            sendEmail: true,
            sendWhatsapp: true,
          }),
        })
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!response.ok) {
          const errorData = response.data

          throw new Error(errorData.error || 'Erro ao ajustar valor')
        }
      }
      setShowPriceAdjustmentDialog(false)
      setPriceAdjustmentItems(() => [createDefaultAdjustmentItem()])
      setEditingAdjustmentId(null)
      refreshAll()
      const adjRes = await financialApi.adjustments(quoteId).catch(() => null)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (adjRes?.ok && selectedEntry?.quoteId === quoteId) {
        const adjData = adjRes.data

        setAdjustmentHistory(adjData.adjustments || [])
      }
      toast.success('Sucesso!', {
        description:
          priceAdjustmentItems.length > 1
            ? `${priceAdjustmentItems.length} reajustes registrados. Envio de e-mail em processamento.`
            : 'Reajuste registrado. Envio de e-mail em processamento.',
      })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error adjusting quote price:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao registrar reajuste. Tente novamente.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsAdjustingPrice(false)
      }
    }
  }

  const regenerateBoleto = useCallback(
    async (entryId: string) => {
      if (!apiClient.isCurrent() || !paymentClient.isCurrent()) return
      const lease = regenerationLeasesRef.current
      if (lease.has(entryId)) return
      lease.add(entryId)
      setRegeneratingBoletoId(entryId)
      try {
        if (
          !(await requestRegeneration(
            'Solicitar reemissão do boleto? O pagamento precisa ser conciliado antes de uma nova cobrança.'
          ))
        )
          return
        if (!apiClient.isCurrent() || !paymentClient.isCurrent()) return
        const res = await paymentApi.regenerate(entryId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!res.ok) {
          const data = res.data ?? {}
          throw new Error(data.error || 'Erro ao regenerar boleto')
        }
        const feedback = getBoletoIssuanceFeedback(res.status, res.data ?? {})
        ;(feedback.pending ? toast.info : toast.success)(feedback.message)
        refreshAll()
      } catch (err) {
        if (isAbortError(err) || !apiClient.isCurrent()) return

        if (isAbortError(err) || !paymentClient.isCurrent()) return
        toast.error(
          err instanceof Error ? err.message : 'Erro ao regenerar boleto'
        )
      } finally {
        lease.delete(entryId)
        if (apiClient.isCurrent()) {
          if (paymentClient.isCurrent()) setRegeneratingBoletoId(null)
        }
      }
    },
    [refreshAll, paymentApi, paymentClient, apiClient, requestRegeneration]
  )

  return {
    // State
    selectedEntry,
    setSelectedEntry,
    dueDateDraft,
    setDueDateDraft,
    showDeleteConfirm,
    setShowDeleteConfirm,
    entryIdToDelete,
    setEntryIdToDelete,
    isDeletingEntry,
    showAdjustmentDeleteConfirm,
    setShowAdjustmentDeleteConfirm,
    adjustmentToDelete,
    setAdjustmentToDelete,
    deletingAdjustmentId,
    savingStatusId,
    savingDueDateId,
    regeneratingBoletoId,
    showPriceAdjustmentDialog,
    setShowPriceAdjustmentDialog,
    nestedDialogOpen,
    priceAdjustmentItems,
    setPriceAdjustmentItems,
    editingAdjustmentId,
    setEditingAdjustmentId,
    isAdjustingPrice,
    adjustmentHistory,
    loadingAdjustments,

    // Handlers
    openQuoteFromEntry,
    updateBillingStatus,
    updateEntryDueDate,
    deleteEntry,
    handleConfirmDeleteEntry,
    handleConfirmDeleteAdjustment,
    addPriceAdjustmentItem,
    removePriceAdjustmentItem,
    updatePriceAdjustmentItem,
    adjustQuotePriceForEntry,
    regenerateBoleto,
  }
}
