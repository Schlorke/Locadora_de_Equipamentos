import { createAdminQuotesApi } from '../api/admin-quotes'
import {
  createAdminPaymentApi,
  getBoletoIssuanceFeedback,
} from '../../../entities/pagamento'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { startOfYear, endOfYear, subYears, addYears, isSameDay } from 'date-fns'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import {
  formatDateForInput,
  dueDateInputToISOString,
} from '../../../shared/lib/formatting'
import {
  type Quote,
  type QuotePaymentTerms,
  type PriceAdjustmentItem,
  type QuoteAdjustmentFromApi,
  createDefaultAdjustmentItem,
} from '../../../entities/orcamento'
import {
  normalizeQuote,
  normalizeStatus,
  parseLocalDate,
  countDaysBetween,
  getBoletoPayment,
} from '../../../entities/orcamento'

// ─── Types ──────────────────────────────────────────────────────

type QuoteItemType = NonNullable<Quote['items']>[number]

export interface UseQuoteDetailsParams {
  updateQuoteInState: (_quoteId: string) => Promise<Quote | null>
  fetchQuotes: () => Promise<Quote[]>
  quotesRef: React.RefObject<Quote[]>
  boletoActionLocksRef: React.RefObject<Set<string>>
  loading: boolean
  quotes: Quote[]
  requestedQuoteId?: string | null
  invalidateBadges?: () => void
}

// ─── Hook ───────────────────────────────────────────────────────

export function useQuoteDetailsModel({
  updateQuoteInState,
  fetchQuotes,
  quotesRef,
  boletoActionLocksRef,
  loading,
  quotes,
  requestedQuoteId,
  invalidateBadges,
}: UseQuoteDetailsParams) {
  const paymentClient = useScopedApiClient(null)
  const paymentApi = useMemo(
    () => createAdminPaymentApi(paymentClient),
    [paymentClient]
  )

  // ── Core state ──────────────────────────────────────────────
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const apiClient = useScopedApiClient(selectedQuote?.id ?? null)
  const quoteApi = useMemo(() => createAdminQuotesApi(apiClient), [apiClient])
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<
    'approved' | 'rejected' | null
  >(null)
  const [nestedDialogOpen, setNestedDialogOpen] = useState(false)

  // ── Delete dialog ───────────────────────────────────────────
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Boleto ──────────────────────────────────────────────────
  const [generatingBoletoId, setGeneratingBoletoId] = useState<string | null>(
    null
  )

  const [updatingBoletoDueDateId, setUpdatingBoletoDueDateId] = useState<
    string | null
  >(null)
  const [boletoDueDateDraft, setBoletoDueDateDraft] = useState('')

  // ── Adjusted quote ──────────────────────────────────────────
  const [isSendingAdjustedQuote, setIsSendingAdjustedQuote] = useState(false)

  // ── Price adjustment dialog ─────────────────────────────────
  const [showPriceAdjustmentDialog, setShowPriceAdjustmentDialog] =
    useState(false)
  const [priceAdjustmentItems, setPriceAdjustmentItems] = useState<
    PriceAdjustmentItem[]
  >(() => [createDefaultAdjustmentItem()])
  const [isAdjustingPrice, setIsAdjustingPrice] = useState(false)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(
    null
  )

  // ── Late fee dialog ─────────────────────────────────────────
  const [showLateFeeDialog, setShowLateFeeDialog] = useState(false)
  const [isCalculatingLateFee, setIsCalculatingLateFee] = useState(false)
  const [calculatedLateFee, setCalculatedLateFee] = useState<{
    lateFee: number
    daysLate: number
  } | null>(null)

  // ── Reject dialog ───────────────────────────────────────────
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectWithReason, setRejectWithReason] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // ── Remove approval dialog ──────────────────────────────────
  const [showRemoveApprovalDialog, setShowRemoveApprovalDialog] =
    useState(false)
  const [isRemovingApproval, setIsRemovingApproval] = useState(false)
  const [approvalPaymentTerms, setApprovalPaymentTerms] =
    useState<QuotePaymentTerms>('UPFRONT')

  // ── Edit customer dialog ────────────────────────────────────
  const [showEditPeriodEmailPhoneDialog, setShowEditPeriodEmailPhoneDialog] =
    useState(false)
  const [editPeriodEmailPhoneDraft, setEditPeriodEmailPhoneDraft] = useState<{
    startDate: string
    endDate: string
    email: string
    phone: string
    includeWeekends: boolean
    cpf: string
    cnpj: string
    company: string
  }>({
    startDate: '',
    endDate: '',
    email: '',
    phone: '',
    includeWeekends: false,
    cpf: '',
    cnpj: '',
    company: '',
  })
  const [isSavingPeriodEmailPhone, setIsSavingPeriodEmailPhone] =
    useState(false)

  // ── Operation type ──────────────────────────────────────────
  const [editOperationType, setEditOperationType] = useState<
    'PURE_RENTAL' | 'RENTAL_WITH_SERVICE'
  >('PURE_RENTAL')
  const [editServiceAmount, setEditServiceAmount] = useState('')
  const [isSavingOperationType, setIsSavingOperationType] = useState(false)

  // ── Remove item confirm ─────────────────────────────────────
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [removeConfirmItemId, setRemoveConfirmItemId] = useState<string | null>(
    null
  )

  // ── Edit item dates dialog ──────────────────────────────────
  const [showEditItemDatesDialog, setShowEditItemDatesDialog] = useState(false)
  const [editingQuoteItem, setEditingQuoteItem] =
    useState<QuoteItemType | null>(null)
  const [editItemDatesDraft, setEditItemDatesDraft] = useState<{
    startDate: string
    endDate: string
    includeWeekends: boolean
  }>({ startDate: '', endDate: '', includeWeekends: false })
  const [isSavingItemDates, setIsSavingItemDates] = useState(false)

  // ── Edit delivery dialog ────────────────────────────────────
  const [showEditDeliveryDialog, setShowEditDeliveryDialog] = useState(false)
  const [editDeliveryDraft, setEditDeliveryDraft] = useState<{
    deliveryType: 'DELIVERY' | 'PICKUP' | null
    deliveryFee: string
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }>({
    deliveryType: null,
    deliveryFee: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  })
  const [isSavingDelivery, setIsSavingDelivery] = useState(false)

  // ── Adjustments ─────────────────────────────────────────────
  const [selectedQuoteAdjustments, setSelectedQuoteAdjustments] = useState<
    QuoteAdjustmentFromApi[]
  >([])
  const [removeConfirmAdjustmentId, setRemoveConfirmAdjustmentId] = useState<
    string | null
  >(null)
  const [removingAdjustmentId, setRemovingAdjustmentId] = useState<
    string | null
  >(null)

  // ── Refs ────────────────────────────────────────────────────
  const didOpenQuoteFromUrlRef = useRef<string | null>(null)

  // ── Memos ───────────────────────────────────────────────────

  const formatCEP = useCallback((val: string) => {
    const numbers = val.replace(/\D/g, '')
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }, [])

  const editPeriodCalendarRange = useMemo(() => {
    const now = new Date()
    return {
      fromDate: startOfYear(subYears(now, 1)),
      toDate: endOfYear(addYears(now, 2)),
      startMonth: startOfYear(subYears(now, 1)),
      endMonth: endOfYear(addYears(now, 2)),
    }
  }, [])

  const editItemDatesRangeModifiers = useMemo(() => {
    const startStr = editItemDatesDraft.startDate
    const endStr = editItemDatesDraft.endDate
    if (!startStr || !endStr) return null
    const start = parseLocalDate(startStr)
    const end = parseLocalDate(endStr)
    if (start >= end) return null
    return {
      modifiers: {
        range_start: (date: Date) => isSameDay(date, start),
        range_middle: (date: Date) => date > start && date < end,
        range_end: (date: Date) => isSameDay(date, end),
      },
      modifiersClassNames: {
        range_start: 'rdp-range_start',
        range_middle: 'rdp-range_middle',
        range_end: 'rdp-range_end',
      },
    }
  }, [editItemDatesDraft.startDate, editItemDatesDraft.endDate])

  const editItemPreview = useMemo(() => {
    if (!editingQuoteItem) return null
    const startStr = editItemDatesDraft.startDate
    const endStr = editItemDatesDraft.endDate
    const includeWeekends = editItemDatesDraft.includeWeekends
    if (!startStr?.trim() || !endStr?.trim()) return null
    const start = parseLocalDate(startStr)
    const end = parseLocalDate(endStr)
    if (end < start) return null
    const days = countDaysBetween(start, end, includeWeekends)
    const pricePerDay = Number(editingQuoteItem.pricePerDay ?? 0)
    const quantity = editingQuoteItem.quantity ?? 1
    const total = pricePerDay * quantity * days
    const normalizedPeriod = (editingQuoteItem.appliedPeriod ?? '')
      .toString()
      .toLowerCase()
    const periodLabel =
      normalizedPeriod === 'weekly' || normalizedPeriod === 'semanal'
        ? 'Semanal'
        : normalizedPeriod === 'biweekly' || normalizedPeriod === 'quinzenal'
          ? 'Quinzenal'
          : normalizedPeriod === 'monthly' || normalizedPeriod === 'mensal'
            ? 'Mensal'
            : 'Diário'
    return {
      days,
      total,
      pricePerDay,
      quantity,
      periodLabel,
      startStr,
      endStr,
      includeWeekends,
    }
  }, [editingQuoteItem, editItemDatesDraft])

  // ── Computed values ─────────────────────────────────────────

  const boletoPayment = selectedQuote ? getBoletoPayment(selectedQuote) : null

  const hasApproval = (quote: Quote | null) => {
    if (!quote) return false
    const approvedAtValue = quote.approvedAt
    const approvedAtString =
      approvedAtValue === null || approvedAtValue === undefined
        ? ''
        : String(approvedAtValue).trim()
    const hasApprovedAt =
      approvedAtString !== '' &&
      approvedAtString !== 'null' &&
      approvedAtString !== 'undefined'
    const status = normalizeStatus(quote.status)
    return hasApprovedAt || (status === 'approved' && !quote.rejectedAt)
  }

  const selectedQuoteStatus = normalizeStatus(selectedQuote?.status)
  const hasSelectedQuoteApproval = hasApproval(selectedQuote)
  const isAdminApproved =
    selectedQuoteStatus === 'pending' && hasSelectedQuoteApproval
  const selectedQuoteOriginalTotal =
    selectedQuote?.originalTotal ?? selectedQuote?.totalPrice ?? 0
  const hasAdjustedTotal =
    !!selectedQuote &&
    selectedQuote.finalTotal !== null &&
    selectedQuote.finalTotal !== undefined &&
    selectedQuote.finalTotal !== selectedQuoteOriginalTotal
  const hasPriceAdjustmentReason =
    !!selectedQuote?.priceAdjustmentReason?.trim()
  const hasPriceAdjustment = hasAdjustedTotal || hasPriceAdjustmentReason
  const shouldShowAdjustedSendButton =
    (selectedQuoteStatus === 'pending' || selectedQuoteStatus === 'approved') &&
    hasPriceAdjustment

  // ── Effects ─────────────────────────────────────────────────

  // nestedDialogOpen tracking
  useEffect(() => {
    setNestedDialogOpen(
      showDeleteDialog ||
        showPriceAdjustmentDialog ||
        showLateFeeDialog ||
        showRejectDialog ||
        showRemoveApprovalDialog ||
        showEditPeriodEmailPhoneDialog ||
        showEditItemDatesDialog ||
        showEditDeliveryDialog ||
        !!removeConfirmItemId ||
        !!removeConfirmAdjustmentId
    )
  }, [
    showDeleteDialog,
    showPriceAdjustmentDialog,
    showLateFeeDialog,
    showRejectDialog,
    showRemoveApprovalDialog,
    showEditPeriodEmailPhoneDialog,
    showEditItemDatesDialog,
    showEditDeliveryDialog,
    removeConfirmItemId,
    removeConfirmAdjustmentId,
  ])

  // selectedQuote cleanup effect
  useEffect(() => {
    if (!selectedQuote) {
      setShowDeleteDialog(false)
      setShowPriceAdjustmentDialog(false)
      setShowLateFeeDialog(false)
      setCalculatedLateFee(null)
      setPriceAdjustmentItems(() => [createDefaultAdjustmentItem()])
      setShowRejectDialog(false)
      setRejectWithReason(false)
      setRejectionReason('')
      setShowRemoveApprovalDialog(false)
      setApprovalPaymentTerms('UPFRONT')
      setShowEditPeriodEmailPhoneDialog(false)
      setEditPeriodEmailPhoneDraft({
        startDate: '',
        endDate: '',
        email: '',
        phone: '',
        includeWeekends: false,
        cpf: '',
        cnpj: '',
        company: '',
      })
      setShowEditDeliveryDialog(false)
      setEditDeliveryDraft({
        deliveryType: null,
        deliveryFee: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
      })
      setUpdatingBoletoDueDateId(null)
      setBoletoDueDateDraft('')
      return
    }

    setApprovalPaymentTerms(selectedQuote.paymentTerms || 'UPFRONT')
    const latestBoleto =
      selectedQuote.payments
        ?.filter((payment) => payment.method === 'BOLETO')
        ?.slice(-1)?.[0] || null
    setBoletoDueDateDraft(formatDateForInput(latestBoleto?.dueDate))
  }, [selectedQuote])

  // Adjustments loading effect
  useEffect(() => {
    setIsUpdating(false)
    setUpdatingAction(null)
    setIsDeleting(false)
    setIsSendingAdjustedQuote(false)
    setIsAdjustingPrice(false)
    setIsCalculatingLateFee(false)
    setIsRemovingApproval(false)
    setIsSavingPeriodEmailPhone(false)
    setIsSavingOperationType(false)
    setRemovingItemId(null)
    setIsSavingItemDates(false)
    setIsSavingDelivery(false)
    setRemovingAdjustmentId(null)
    setGeneratingBoletoId(null)
    setUpdatingBoletoDueDateId(null)
  }, [apiClient])

  // Adjustments loading effect
  useEffect(() => {
    if (!selectedQuote?.id) {
      setSelectedQuoteAdjustments([])
      return
    }
    setSelectedQuoteAdjustments([])
    let cancelled = false
    quoteApi
      .adjustments(selectedQuote.id)
      .then((res) => (res.ok ? res.data : { adjustments: [] }))
      .then((data: { adjustments?: QuoteAdjustmentFromApi[] }) => {
        if (
          !cancelled &&
          apiClient.isCurrent() &&
          Array.isArray(data.adjustments)
        ) {
          setSelectedQuoteAdjustments(data.adjustments)
        }
      })
      .catch(() => {
        if (!cancelled && apiClient.isCurrent()) setSelectedQuoteAdjustments([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedQuote?.id, quoteApi, apiClient])

  // Open quote from URL
  useEffect(() => {
    const quoteIdFromUrl = requestedQuoteId?.trim()
    if (!quoteIdFromUrl) {
      didOpenQuoteFromUrlRef.current = null
      return
    }
    if (loading) return
    if (didOpenQuoteFromUrlRef.current === quoteIdFromUrl) return

    const found = quotes.find((q) => q.id === quoteIdFromUrl)
    if (found) {
      didOpenQuoteFromUrlRef.current = quoteIdFromUrl
      setSelectedQuote(found)
      setEditOperationType(found.operationType || 'PURE_RENTAL')
      setEditServiceAmount(
        found.serviceAmount != null ? String(found.serviceAmount) : ''
      )
      return
    }

    // Quote não está na lista (ex.: paginação) — buscar por ID
    let cancelled = false
    quoteApi
      .get(quoteIdFromUrl)
      .then((r) => (r.ok ? r.data : null))
      .then((raw) => {
        if (raw && !cancelled && apiClient.isCurrent()) {
          const q = normalizeQuote(raw)
          didOpenQuoteFromUrlRef.current = quoteIdFromUrl
          setSelectedQuote(q)
          setEditOperationType(q.operationType || 'PURE_RENTAL')
          setEditServiceAmount(
            q.serviceAmount != null ? String(q.serviceAmount) : ''
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loading, quotes, requestedQuoteId, quoteApi, apiClient])

  // ── Handler functions ───────────────────────────────────────

  const openQuoteDetails = useCallback(
    (quote: Quote | { id: string }) => {
      const freshQuote =
        quotesRef.current.find((q) => q.id === quote.id) || null
      setSelectedQuote(freshQuote)
      if (freshQuote) {
        setEditOperationType(freshQuote.operationType || 'PURE_RENTAL')
        setEditServiceAmount(
          freshQuote.serviceAmount != null
            ? String(freshQuote.serviceAmount)
            : ''
        )
      }
    },
    [quotesRef]
  )

  const saveOperationType = useCallback(
    async (quoteId: string) => {
      try {
        setIsSavingOperationType(true)
        const response = await quoteApi.update(quoteId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operationType: editOperationType,
            serviceAmount:
              editOperationType === 'RENTAL_WITH_SERVICE' && editServiceAmount
                ? Number(editServiceAmount)
                : null,
          }),
        })
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!response.ok) {
          const errorData = response.data as {
            error?: string
          } | null
          if (!apiClient.isCurrent())
            throw Object.assign(new Error('Escopo encerrado.'), {
              name: 'AbortError',
            })
          throw new Error(errorData?.error || 'Erro ao salvar tipo de operação')
        }
        const updatedQuote = await updateQuoteInState(quoteId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        setSelectedQuote(updatedQuote)
        toast.success('Tipo de operação salvo')
      } catch (error) {
        if (isAbortError(error) || !apiClient.isCurrent()) return

        console.error('Error saving operation type:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Erro ao salvar tipo de operação'
        )
      } finally {
        if (apiClient.isCurrent()) {
          setIsSavingOperationType(false)
        }
      }
    },
    [
      editOperationType,
      editServiceAmount,
      updateQuoteInState,
      quoteApi,
      apiClient,
    ]
  )

  const savePeriodEmailPhone = useCallback(async () => {
    if (!selectedQuote?.id) return
    const { email, phone, cpf, cnpj, company } = editPeriodEmailPhoneDraft
    if (!email.trim()) {
      toast.error('Email é obrigatório')
      return
    }
    if (!phone.trim()) {
      toast.error('Telefone é obrigatório')
      return
    }
    try {
      setIsSavingPeriodEmailPhone(true)
      const body: Record<string, string | null> = {
        email: email.trim(),
        phone: phone.trim(),
        cpf: cpf.trim() || null,
        cnpj: cnpj.trim() || null,
        company: company.trim() || null,
      }
      const response = await quoteApi.update(selectedQuote.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const data = response.data as {
          error?: string
        } | null
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        throw new Error(data?.error || 'Erro ao salvar')
      }
      const updatedQuote = await updateQuoteInState(selectedQuote.id)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (updatedQuote) setSelectedQuote(updatedQuote)
      setShowEditPeriodEmailPhoneDialog(false)
      toast.success('Dados do cliente atualizados')
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error saving period/email/phone:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar dados'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setIsSavingPeriodEmailPhone(false)
      }
    }
  }, [
    selectedQuote?.id,
    editPeriodEmailPhoneDraft,
    updateQuoteInState,
    quoteApi,
    apiClient,
  ])

  const saveItemDates = useCallback(async () => {
    if (!selectedQuote?.id || !editingQuoteItem?.id) return
    const { startDate, endDate, includeWeekends } = editItemDatesDraft
    if (!startDate?.trim() || !endDate?.trim()) {
      toast.error('Data início e data fim são obrigatórias')
      return
    }
    try {
      setIsSavingItemDates(true)
      const response = await quoteApi.update(selectedQuote.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateItemDates: {
            itemId: editingQuoteItem.id,
            startDate: startDate.trim(),
            endDate: endDate.trim(),
            includeWeekends,
          },
        }),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const data = response.data as {
          error?: string
        } | null
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        throw new Error(data?.error || 'Erro ao salvar datas do item')
      }
      const updatedQuote = await updateQuoteInState(selectedQuote.id)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (updatedQuote) setSelectedQuote(updatedQuote)
      setShowEditItemDatesDialog(false)
      setEditingQuoteItem(null)
      toast.success('Período do item atualizado')
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error saving item dates:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao atualizar período do item'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setIsSavingItemDates(false)
      }
    }
  }, [
    selectedQuote?.id,
    editingQuoteItem?.id,
    editItemDatesDraft,
    updateQuoteInState,
    quoteApi,
    apiClient,
  ])

  const saveDelivery = useCallback(async () => {
    if (!selectedQuote?.id) return
    const {
      deliveryType,
      deliveryFee,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zipCode,
    } = editDeliveryDraft
    if (!deliveryType) {
      toast.error(
        'Selecione o tipo de entrega (Entrega no Endereço ou Retirada em Loja)'
      )
      return
    }
    try {
      setIsSavingDelivery(true)
      const deliveryAddress =
        deliveryType === 'DELIVERY'
          ? {
              street: street.trim() || undefined,
              number: number.trim() || undefined,
              complement: complement.trim() || undefined,
              neighborhood: neighborhood.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              zipCode: zipCode.trim() || undefined,
            }
          : (selectedQuote.deliveryAddress ?? null)
      const feeStr =
        deliveryType === 'DELIVERY' ? deliveryFee.trim().replace(',', '.') : ''
      const feeNum = feeStr ? parseFloat(feeStr) : null
      const body: Record<string, unknown> = {
        deliveryType,
        deliveryAddress:
          deliveryType === 'DELIVERY'
            ? deliveryAddress && Object.values(deliveryAddress).some(Boolean)
              ? deliveryAddress
              : null
            : deliveryAddress,
        deliveryFee:
          deliveryType === 'PICKUP'
            ? null
            : feeNum != null && !Number.isNaN(feeNum)
              ? feeNum
              : null,
      }
      const response = await quoteApi.update(selectedQuote.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const data = response.data as {
          error?: string
        } | null
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        throw new Error(data?.error || 'Erro ao salvar')
      }
      const updatedQuote = await updateQuoteInState(selectedQuote.id)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (updatedQuote) setSelectedQuote(updatedQuote)
      setShowEditDeliveryDialog(false)
      toast.success('Entrega e endereço atualizados')
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error saving delivery:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar entrega'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setIsSavingDelivery(false)
      }
    }
  }, [
    selectedQuote,
    editDeliveryDraft,
    updateQuoteInState,
    quoteApi,
    apiClient,
  ])

  const removeItemFromQuote = useCallback(
    async (quoteId: string, itemId: string) => {
      try {
        setRemovingItemId(itemId)
        const response = await quoteApi.update(quoteId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ removeItemId: itemId }),
        })
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (!response.ok) {
          const data = response.data as {
            error?: string
          } | null
          if (!apiClient.isCurrent())
            throw Object.assign(new Error('Escopo encerrado.'), {
              name: 'AbortError',
            })
          throw new Error(data?.error || 'Erro ao remover item')
        }
        const updatedQuote = await updateQuoteInState(quoteId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (updatedQuote) setSelectedQuote(updatedQuote)
        toast.success('Item removido do orçamento')
      } catch (error) {
        if (isAbortError(error) || !apiClient.isCurrent()) return

        console.error('Error removing quote item:', error)
        toast.error(
          error instanceof Error ? error.message : 'Erro ao remover item'
        )
      } finally {
        if (apiClient.isCurrent()) {
          setRemovingItemId(null)
        }
      }
    },
    [updateQuoteInState, quoteApi, apiClient]
  )

  const updateQuoteStatus = async (
    quoteId: string,
    newStatus: 'approved' | 'rejected',
    rejectionReasonArg?: string,
    paymentTerms?: QuotePaymentTerms
  ) => {
    try {
      setIsUpdating(true)
      setUpdatingAction(newStatus)
      const statusUpperCase = newStatus.toUpperCase() as 'APPROVED' | 'REJECTED'
      const body: {
        status: string
        rejectionReason?: string
        paymentTerms?: QuotePaymentTerms
      } = {
        status: statusUpperCase,
      }

      if (newStatus === 'rejected' && rejectionReasonArg) {
        body.rejectionReason = rejectionReasonArg
      }

      if (newStatus === 'approved' && paymentTerms) {
        body.paymentTerms = paymentTerms
      }

      const response = await quoteApi.update(quoteId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        const errorData = response.data as {
          error?: string
        } | null
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        throw new Error(errorData?.error || 'Erro ao atualizar status')
      }

      const freshQuotes = await fetchQuotes()
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      const updatedQuote =
        freshQuotes?.find((q: Quote) => q.id === quoteId) ?? null

      setShowRejectDialog(false)
      setRejectWithReason(false)
      setRejectionReason('')

      if (newStatus === 'rejected') {
        setSelectedQuote(null)
      } else {
        setSelectedQuote(updatedQuote)
      }

      toast.success('Sucesso!', {
        description: `Orçamento ${newStatus === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`,
      })
      invalidateBadges?.()
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error updating quote:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao atualizar status do orçamento.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsUpdating(false)
        setUpdatingAction(null)
      }
    }
  }

  const handleRejectClick = () => {
    setShowRejectDialog(true)
    setRejectWithReason(false)
    setRejectionReason('')
  }

  const handleConfirmReject = () => {
    if (selectedQuote) {
      const reason = rejectWithReason ? rejectionReason : undefined
      updateQuoteStatus(selectedQuote.id, 'rejected', reason)
    }
  }

  const deleteQuote = async (quoteId: string) => {
    try {
      setIsDeleting(true)
      const response = await quoteApi.remove(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        throw new Error('Erro ao excluir orçamento')
      }

      await fetchQuotes()
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      setSelectedQuote(null)
      setShowDeleteDialog(false)

      toast.success('Sucesso!', {
        description: 'Orçamento excluído permanentemente.',
      })
      invalidateBadges?.()
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error deleting quote:', error)
      toast.error('Erro', {
        description: 'Erro ao excluir orçamento. Tente novamente.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsDeleting(false)
      }
    }
  }

  const addPriceAdjustmentItem = () => {
    setPriceAdjustmentItems((prev) => [...prev, createDefaultAdjustmentItem()])
  }

  const removePriceAdjustmentItem = (id: string) => {
    setPriceAdjustmentItems((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev
    )
  }

  const updatePriceAdjustmentItem = (
    id: string,
    patch: Partial<PriceAdjustmentItem>
  ) => {
    setPriceAdjustmentItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
      const updated = next.find((i) => i.id === id)
      if (
        updated?.category === 'TRAVEL' &&
        (patch.value !== undefined || patch.category === 'TRAVEL')
      ) {
        setEditDeliveryDraft((d) => ({
          ...d,
          deliveryFee: String(updated.value),
        }))
      }
      return next
    })
  }

  const adjustQuotePrice = async (quoteId: string) => {
    const invalidItem = priceAdjustmentItems.find(
      (item) =>
        !item.category ||
        !item.reason.trim() ||
        item.reason.trim().length < 3 ||
        isNaN(item.value) ||
        item.value <= 0 ||
        (item.category === 'OTHER' &&
          (!item.categoryOther || !item.categoryOther.trim()))
    )
    if (invalidItem) {
      const desc = !invalidItem.category
        ? 'Selecione a categoria do reajuste em todos os itens.'
        : invalidItem.category === 'OTHER' &&
            (!invalidItem.categoryOther || !invalidItem.categoryOther.trim())
          ? 'Ao selecionar "Outro", informe a categoria específica, além do valor e da justificativa.'
          : !invalidItem.reason.trim()
            ? 'Preencha categoria, valor adicional e justificativa em todos os itens.'
            : invalidItem.reason.trim().length < 3
              ? 'A justificativa deve ter no mínimo 3 caracteres.'
              : 'Preencha categoria, valor adicional (maior que zero) e justificativa em todos os itens.'
      toast.error('Erro de Validação', { description: desc })
      return
    }

    try {
      setIsAdjustingPrice(true)
      let lastQuote: Quote | null = selectedQuote
      // Em modo edição: remover o reajuste antigo antes de criar o novo
      if (editingAdjustmentId) {
        const delRes = await quoteApi.removeAdjustment(
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
        lastQuote = await updateQuoteInState(quoteId)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (lastQuote) setSelectedQuote(lastQuote)
        setEditingAdjustmentId(null)
      }
      for (const item of priceAdjustmentItems) {
        const justification =
          item.category === 'OTHER' && item.categoryOther?.trim()
            ? `${item.categoryOther.trim()}: ${item.reason.trim()}`
            : item.reason.trim()
        const response = await quoteApi.addAdjustment(quoteId, {
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
          const errorData = response.data as {
            error?: string
            details?: unknown[]
          }
          if (!apiClient.isCurrent())
            throw Object.assign(new Error('Escopo encerrado.'), {
              name: 'AbortError',
            })
          throw new Error(errorData.error || 'Erro ao ajustar valor')
        }
        const data = response.data

        if (data.quote) {
          lastQuote = await updateQuoteInState(quoteId)
          if (!apiClient.isCurrent())
            throw Object.assign(new Error('Escopo encerrado.'), {
              name: 'AbortError',
            })
          setSelectedQuote(lastQuote)
        }
      }
      // Atualizar lista de reajustes exibida no painel
      const adjRes = await quoteApi.adjustments(quoteId).catch(() => null)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (adjRes?.ok) {
        const adjData = adjRes.data as {
          adjustments?: QuoteAdjustmentFromApi[]
        }
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (Array.isArray(adjData.adjustments)) {
          setSelectedQuoteAdjustments(adjData.adjustments)
        }
      }
      setShowPriceAdjustmentDialog(false)
      setPriceAdjustmentItems(() => [createDefaultAdjustmentItem()])
      setEditingAdjustmentId(null)
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

  const calculateLateFee = async (quoteId: string) => {
    try {
      setIsCalculatingLateFee(true)
      const response = await quoteApi.calculateLateFee(quoteId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        throw new Error('Erro ao calcular multa')
      }

      const data = response.data

      setCalculatedLateFee({
        lateFee: data.lateFee,
        daysLate: data.daysLate,
      })
      setShowLateFeeDialog(true)
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error calculating late fee:', error)
      toast.error('Erro', {
        description: 'Erro ao calcular multa por atraso. Tente novamente.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsCalculatingLateFee(false)
      }
    }
  }

  const approveLateFee = async (quoteId: string) => {
    if (!calculatedLateFee) return

    try {
      setIsUpdating(true)
      const response = await quoteApi.update(quoteId, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lateFee: calculatedLateFee.lateFee,
          lateFeeApproved: true,
        }),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        // A recusa do servidor (ex.: cobrança já emitida exige conciliação) chega ao admin como veio.
        const data = response.data as {
          error?: string
        } | null
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        throw new Error(
          data?.error || 'Erro ao aprovar multa. Tente novamente.'
        )
      }

      const updatedQuote = await updateQuoteInState(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      setSelectedQuote(updatedQuote)
      setShowLateFeeDialog(false)
      setCalculatedLateFee(null)

      toast.success('Sucesso!', {
        description: 'Multa por atraso aprovada e aplicada ao orçamento!',
      })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error approving late fee:', error)
      toast.error('Erro', {
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Erro ao aprovar multa. Tente novamente.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsUpdating(false)
      }
    }
  }

  const removeApproval = async (quoteId: string) => {
    try {
      setIsRemovingApproval(true)
      const response = await quoteApi.update(quoteId, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          removeApproval: true,
        }),
      })
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        const errorData = response.data

        throw new Error(errorData.error || 'Erro ao remover aprovação')
      }

      // Buscar o quote atualizado diretamente para garantir que temos os dados mais recentes
      const updatedQuoteResponse = await quoteApi.get(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (updatedQuoteResponse.ok) {
        const updatedQuoteData = updatedQuoteResponse.data

        setSelectedQuote(normalizeQuote(updatedQuoteData as Quote))
      }

      // Atualizar apenas o quote específico no estado
      const updatedQuoteFromList = await updateQuoteInState(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      // Garantir que o quote selecionado está atualizado
      if (updatedQuoteFromList && !updatedQuoteFromList.approvedAt) {
        setSelectedQuote(updatedQuoteFromList)
      }

      setShowRemoveApprovalDialog(false)

      toast.success('Sucesso!', {
        description: 'Aprovação removida com sucesso!',
      })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error removing approval:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao remover aprovação. Tente novamente.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsRemovingApproval(false)
      }
    }
  }

  const handleGenerateBoleto = async (quoteId: string) => {
    if (boletoActionLocksRef.current.has(quoteId)) {
      return
    }

    boletoActionLocksRef.current.add(quoteId)
    try {
      setGeneratingBoletoId(quoteId)
      const response = await paymentApi.generateForQuote(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        const data = response.data ?? {}
        throw new Error(data.error || 'Erro ao gerar boleto')
      }

      const result = response.data ?? {}
      const updatedQuote = await updateQuoteInState(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!paymentClient.isCurrent()) return
      setSelectedQuote(updatedQuote)

      const feedback = getBoletoIssuanceFeedback(response.status, result)
      const notify = feedback.pending ? toast.info : toast.success
      notify(feedback.pending ? 'Boleto em processamento' : 'Sucesso!', {
        description: feedback.message,
      })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      if (isAbortError(error) || !paymentClient.isCurrent()) return
      console.error('Error generating boleto:', error)
      toast.error('Erro', {
        description:
          error instanceof Error ? error.message : 'Erro ao gerar boleto.',
      })
    } finally {
      if (paymentClient.isCurrent()) setGeneratingBoletoId(null)
      boletoActionLocksRef.current.delete(quoteId)
    }
  }

  const handleUpdateBoletoDueDate = async (
    quoteId: string,
    paymentId: string,
    dueDateValue: string
  ) => {
    if (!dueDateValue) return

    const lockKey = `due-date-${paymentId}`
    if (boletoActionLocksRef.current.has(lockKey)) {
      return
    }

    boletoActionLocksRef.current.add(lockKey)
    try {
      setUpdatingBoletoDueDateId(paymentId)
      const response = await paymentApi.updateDueDate(
        paymentId,
        dueDateInputToISOString(dueDateValue)
      )
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!response.ok) {
        const data = response.data ?? {}
        throw new Error(data.error || 'Erro ao atualizar vencimento do boleto')
      }

      const result = (response.data ?? {}) as { processing?: string }
      const pending = response.status === 202 || result.processing === 'PENDING'
      const updatedQuote = await updateQuoteInState(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!paymentClient.isCurrent()) return
      setSelectedQuote(updatedQuote)

      if (pending)
        toast.info('Reemissão solicitada', {
          description: 'O vencimento será atualizado após confirmação.',
        })
      else
        toast.success('Sucesso!', {
          description: 'Vencimento do boleto atualizado com sucesso.',
        })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      if (isAbortError(error) || !paymentClient.isCurrent()) return
      console.error('Error updating boleto due date:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao atualizar vencimento do boleto.',
      })
    } finally {
      if (paymentClient.isCurrent()) setUpdatingBoletoDueDateId(null)
      boletoActionLocksRef.current.delete(lockKey)
    }
  }

  const handleSendAdjustedQuote = async (quoteId: string) => {
    try {
      setIsSendingAdjustedQuote(true)
      const response = await quoteApi.sendAdjusted(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })

      if (!response.ok) {
        const data = response.data

        throw new Error(data.error || 'Erro ao enviar orçamento ajustado')
      }

      toast.success('Sucesso!', {
        description: 'Envio do orçamento ajustado colocado na fila de e-mail.',
      })
    } catch (error) {
      if (isAbortError(error) || !apiClient.isCurrent()) return

      console.error('Error sending adjusted quote:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao enviar orçamento ajustado.',
      })
    } finally {
      if (apiClient.isCurrent()) {
        setIsSendingAdjustedQuote(false)
      }
    }
  }

  const handleRemoveAdjustment = async (
    quoteId: string,
    adjustmentId: string
  ) => {
    setRemovingAdjustmentId(adjustmentId)
    try {
      const res = await quoteApi.removeAdjustment(quoteId, adjustmentId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (!res.ok) {
        const data = res.data

        throw new Error(data.error || 'Erro ao remover')
      }
      const updated = await updateQuoteInState(quoteId)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (updated) setSelectedQuote(updated)
      const adjRes = await quoteApi.adjustments(quoteId).catch(() => null)
      if (!apiClient.isCurrent())
        throw Object.assign(new Error('Escopo encerrado.'), {
          name: 'AbortError',
        })
      if (adjRes?.ok) {
        const adjData = adjRes.data as {
          adjustments?: QuoteAdjustmentFromApi[]
        }
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })
        if (Array.isArray(adjData.adjustments)) {
          setSelectedQuoteAdjustments(adjData.adjustments)
        }
      }
      toast.success('Reajuste removido.')
    } catch (err) {
      if (isAbortError(err) || !apiClient.isCurrent()) return

      toast.error(
        err instanceof Error ? err.message : 'Erro ao remover reajuste'
      )
    } finally {
      if (apiClient.isCurrent()) {
        setRemovingAdjustmentId(null)
        setRemoveConfirmAdjustmentId(null)
      }
    }
  }

  // ── Return ──────────────────────────────────────────────────

  return {
    // Core state
    selectedQuote,
    setSelectedQuote,
    isUpdating,
    updatingAction,
    nestedDialogOpen,

    // Detail panel computed
    selectedQuoteStatus,
    selectedQuoteAdjustments,
    boletoPayment,
    hasSelectedQuoteApproval,
    isAdminApproved,
    selectedQuoteOriginalTotal,
    hasPriceAdjustment,
    shouldShowAdjustedSendButton,

    // Operation type
    editOperationType,
    setEditOperationType,
    editServiceAmount,
    setEditServiceAmount,
    isSavingOperationType,
    saveOperationType,

    // Delete dialog
    showDeleteDialog,
    setShowDeleteDialog,
    isDeleting,
    deleteQuote,

    // Reject dialog
    showRejectDialog,
    setShowRejectDialog,
    rejectWithReason,
    setRejectWithReason,
    rejectionReason,
    setRejectionReason,
    handleRejectClick,
    handleConfirmReject,

    // Remove approval dialog
    showRemoveApprovalDialog,
    setShowRemoveApprovalDialog,
    isRemovingApproval,
    approvalPaymentTerms,
    setApprovalPaymentTerms,
    removeApproval,

    // Edit customer dialog
    showEditPeriodEmailPhoneDialog,
    setShowEditPeriodEmailPhoneDialog,
    editPeriodEmailPhoneDraft,
    setEditPeriodEmailPhoneDraft,
    isSavingPeriodEmailPhone,
    savePeriodEmailPhone,

    // Edit item dates dialog
    showEditItemDatesDialog,
    setShowEditItemDatesDialog,
    editingQuoteItem,
    setEditingQuoteItem,
    editItemDatesDraft,
    setEditItemDatesDraft,
    isSavingItemDates,
    saveItemDates,
    editPeriodCalendarRange,
    editItemDatesRangeModifiers,
    editItemPreview,

    // Edit delivery dialog
    showEditDeliveryDialog,
    setShowEditDeliveryDialog,
    editDeliveryDraft,
    setEditDeliveryDraft,
    isSavingDelivery,
    saveDelivery,
    formatCEP,

    // Remove item confirm
    removeConfirmItemId,
    setRemoveConfirmItemId,
    removingItemId,
    removeItemFromQuote,

    // Price adjustment
    showPriceAdjustmentDialog,
    setShowPriceAdjustmentDialog,
    priceAdjustmentItems,
    setPriceAdjustmentItems,
    isAdjustingPrice,
    addPriceAdjustmentItem,
    removePriceAdjustmentItem,
    updatePriceAdjustmentItem,
    adjustQuotePrice,
    editingAdjustmentId,
    setEditingAdjustmentId,

    // Remove adjustment confirm
    removeConfirmAdjustmentId,
    setRemoveConfirmAdjustmentId,
    removingAdjustmentId,
    setRemovingAdjustmentId,
    handleRemoveAdjustment,

    // Late fee
    showLateFeeDialog,
    setShowLateFeeDialog,
    isCalculatingLateFee,
    calculatedLateFee,
    setCalculatedLateFee,
    calculateLateFee,
    approveLateFee,

    // Boleto
    generatingBoletoId,
    updatingBoletoDueDateId,
    boletoDueDateDraft,
    setBoletoDueDateDraft,
    handleGenerateBoleto,
    handleUpdateBoletoDueDate,

    // Adjusted quote
    isSendingAdjustedQuote,
    handleSendAdjustedQuote,

    // Actions
    openQuoteDetails,
    updateQuoteStatus,
  }
}
