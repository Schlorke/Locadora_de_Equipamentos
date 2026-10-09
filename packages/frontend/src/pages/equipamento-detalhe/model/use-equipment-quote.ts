import { useCallback, useEffect, useState } from 'react'
import { useCartStore, type CartItem } from '../../../features/carrinho'
import { signInHref } from '../../../features/entrar'
import { useSession } from '../../../entities/sessao'
import type { SmartQuoteButtonProps } from './pricing-contract'

export function useEquipmentQuote(
  {
    equipmentId,
    equipmentName,
    pricePerDay,
    isAvailable,
    selectedPeriod,
    finalPrice,
    maxStock,
    description,
    category,
    images,
    dailyDiscount,
    weeklyDiscount,
    biweeklyDiscount,
    monthlyDiscount,
    dailyDirectValue,
    weeklyDirectValue,
    biweeklyDirectValue,
    monthlyDirectValue,
    dailyUseDirectValue,
    weeklyUseDirectValue,
    biweeklyUseDirectValue,
    monthlyUseDirectValue,
    startDate,
    endDate,
    selectedDays,
    includeWeekends = false,
    weekendSelectionConfirmed = false,
    onWeekendSelectionConfirm,
  }: SmartQuoteButtonProps,
  ports: {
    router: { push(href: string): void | Promise<void> }
    pathname: string
    query: string
    notifyLogin(): void
  }
) {
  const { addItem } = useCartStore()
  const { router, pathname, query, notifyLogin } = ports

  const { data: session, status } = useSession()
  const [isWeekendDialogOpen, setIsWeekendDialogOpen] = useState(false)
  // Clique feito enquanto a sessão ainda carrega: a decisão (login ou orçamento) espera o status resolver.
  const [pendingQuoteRequest, setPendingQuoteRequest] = useState(false)

  // Verificar se o usuário está autenticado
  const isAuthenticated = status === 'authenticated' && session?.user

  const finalizeAdd = useCallback(
    (includeWeekendSelection: boolean) => {
      // Calcular dias: usar selectedDays se disponível, senão usar multiplier do período
      const days = selectedDays || selectedPeriod.multiplier

      // Preparar dados do equipamento selecionado
      const equipmentForQuote: CartItem = {
        equipmentId,
        equipmentName,
        pricePerDay,
        quantity: 1,
        days,
        selectedPeriod,
        finalPrice,
        maxStock,
        description,
        category,
        images,
        dailyDiscount,
        weeklyDiscount,
        biweeklyDiscount,
        monthlyDiscount,
        // Campos de valor direto
        dailyDirectValue,
        weeklyDirectValue,
        biweeklyDirectValue,
        monthlyDirectValue,
        // Campos de controle de método de preço
        dailyUseDirectValue,
        weeklyUseDirectValue,
        biweeklyUseDirectValue,
        monthlyUseDirectValue,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        includeWeekends: includeWeekendSelection,
        includeWeekendsConfirmed: true,
      }

      // Adicionar ao carrinho
      addItem(equipmentForQuote)

      // Navegar para página de orçamento
      router.push('/orcamento')
    },
    [
      equipmentId,
      equipmentName,
      pricePerDay,
      selectedPeriod,
      finalPrice,
      maxStock,
      description,
      category,
      images,
      dailyDiscount,
      weeklyDiscount,
      biweeklyDiscount,
      monthlyDiscount,
      dailyDirectValue,
      weeklyDirectValue,
      biweeklyDirectValue,
      monthlyDirectValue,
      dailyUseDirectValue,
      weeklyUseDirectValue,
      biweeklyUseDirectValue,
      monthlyUseDirectValue,
      startDate,
      endDate,
      selectedDays,
      addItem,
      router,
    ]
  )

  const resolveQuoteRequest = useCallback(() => {
    if (!isAvailable) return

    // Verificar autenticação PRIMEIRO
    // Se o usuário não estiver logado, redirecionar para login
    if (!isAuthenticated) {
      // Mostrar toast informativo
      notifyLogin()

      // Login com retorno para a página atual (caminho visível + query da URL), pela regra do "Entrar" da área
      // privada: só vai um retorno que o login aceita sem mudar.

      router.push(signInHref(pathname, query))
      return
    }

    // Usuário está logado - verificar se precisa mostrar dialog de finais de semana
    const hasExplicitDates = Boolean(startDate && endDate)
    if (!hasExplicitDates && !weekendSelectionConfirmed) {
      setIsWeekendDialogOpen(true)
      return
    }

    finalizeAdd(includeWeekends)
  }, [
    isAvailable,
    isAuthenticated,
    pathname,
    router,
    startDate,
    endDate,
    includeWeekends,
    weekendSelectionConfirmed,
    finalizeAdd,
    notifyLogin,
    query,
  ])

  const handleQuoteRequest = useCallback(() => {
    if (!isAvailable) return
    // A página pública renderiza antes de a sessão resolver: 'loading' não é "deslogado".
    if (status === 'loading') {
      setPendingQuoteRequest(true)
      return
    }
    resolveQuoteRequest()
  }, [isAvailable, status, resolveQuoteRequest])

  useEffect(() => {
    if (!pendingQuoteRequest || status === 'loading') return
    setPendingQuoteRequest(false)
    resolveQuoteRequest()
  }, [pendingQuoteRequest, status, resolveQuoteRequest])

  const handleWeekendConfirmation = (includeWeekendSelection: boolean) => {
    onWeekendSelectionConfirm?.(includeWeekendSelection)
    setIsWeekendDialogOpen(false)
    finalizeAdd(includeWeekendSelection)
  }

  const handleWeekendCancel = () => {
    setIsWeekendDialogOpen(false)
  }
  return {
    isWeekendDialogOpen,
    pendingQuoteRequest,
    handleQuoteRequest,
    handleWeekendConfirmation,
    handleWeekendCancel,
  }
}
