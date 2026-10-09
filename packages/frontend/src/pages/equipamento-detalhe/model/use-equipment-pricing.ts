import { useCallback, useState, useEffect, useMemo, useRef } from 'react'
import {
  format,
  differenceInDays,
  differenceInCalendarDays,
  addYears,
  isWeekend,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  SmartEquipmentPricingProps,
  PricingOption,
} from './pricing-contract'
import {
  calculateIntelligentPrice,
  getPricingConfig,
  sanitizeCartItemPricing,
} from '../../../entities/equipamento'

import { avisoFim, avisoSucesso } from './avisos'
export interface EquipmentDateRange {
  from: Date | undefined
  to?: Date | undefined
}

export function useEquipmentPricing(
  {
    pricePerDay,
    dailyDiscount = 0,
    weeklyDiscount = 0,
    biweeklyDiscount = 0,
    monthlyDiscount = 0,
    popularPeriod = 'weekly',
    description,
    dailyDirectValue = 0,
    weeklyDirectValue = 0,
    biweeklyDirectValue = 0,
    monthlyDirectValue = 0,
    dailyUseDirectValue = false,
    weeklyUseDirectValue = false,
    biweeklyUseDirectValue = false,
    monthlyUseDirectValue = false,
    dailyRentalEnabled = true,
    weeklyRentalEnabled = true,
    biweeklyRentalEnabled = true,
    monthlyRentalEnabled = true,
  }: SmartEquipmentPricingProps,
  toast: {
    info(
      message: string,
      options: { description: string; position: 'top-right'; duration: number }
    ): unknown
    success(
      message: string,
      options: { description: string; position: 'top-right'; duration: number }
    ): unknown
  }
) {
  const [selectedPeriod, setSelectedPeriod] = useState<PricingOption | null>(
    null
  )
  const [finalPrice, setFinalPrice] = useState<number>(pricePerDay)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [selectedDays, setSelectedDays] = useState<number>(0)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState<
    EquipmentDateRange | undefined
  >(startDate && endDate ? { from: startDate, to: endDate } : undefined)
  // Estado para incluir ou não finais de semana na locação
  // Por padrão, apenas dias úteis (seg-sex) são considerados
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [includeWeekendsTouched, setIncludeWeekendsTouched] = useState(false)

  const sanitizedEquipment = useMemo(
    () =>
      sanitizeCartItemPricing({
        pricePerDay,
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
      }),
    [
      pricePerDay,
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
    ]
  )

  const enabledPeriods = useMemo(
    () => ({
      daily: dailyRentalEnabled,
      weekly: weeklyRentalEnabled,
      biweekly: biweeklyRentalEnabled,
      monthly: monthlyRentalEnabled,
    }),
    [
      dailyRentalEnabled,
      weeklyRentalEnabled,
      biweeklyRentalEnabled,
      monthlyRentalEnabled,
    ]
  )

  const periodMap = useMemo<Record<string, PricingOption>>(
    () => ({
      daily: {
        id: 'daily',
        label: 'Diário',
        period: 'dia',
        multiplier: 1,
        discount: dailyDiscount,
        popular: popularPeriod === 'daily',
      },
      weekly: {
        id: 'weekly',
        label: 'Semanal',
        period: '7 dias',
        multiplier: 7,
        discount: weeklyDiscount,
        popular: popularPeriod === 'weekly',
      },
      biweekly: {
        id: 'biweekly',
        label: 'Quinzenal',
        period: '15 dias',
        multiplier: 15,
        discount: biweeklyDiscount,
        popular: popularPeriod === 'biweekly',
      },
      monthly: {
        id: 'monthly',
        label: 'Mensal',
        period: '30 dias',
        multiplier: 30,
        discount: monthlyDiscount,
        popular: popularPeriod === 'monthly',
      },
    }),
    [
      dailyDiscount,
      weeklyDiscount,
      biweeklyDiscount,
      monthlyDiscount,
      popularPeriod,
    ]
  )

  // Refs para controlar exibição das toasts - resetam a cada reload da página (incluindo Ctrl+F5)
  // Quando o usuário recarrega a página (F5, Ctrl+F5, ou fecha/abre a aba), as toasts podem aparecer novamente
  const hasShownFirstClickToast = useRef(false)
  const hasShownStartDateToast = useRef(false)
  const hasShownSuccessToast = useRef(false)
  const toastsCompleted = useRef(false) // Marca quando o ciclo completo de toasts foi exibido

  // Verifica se deve mostrar toasts (ciclo não foi completado ainda)
  const shouldShowToasts = useCallback(() => {
    return !toastsCompleted.current
  }, [])

  // Marca o ciclo de toasts como completado (não mostra mais nesta sessão de página)
  const markToastsAsShown = useCallback(() => {
    toastsCompleted.current = true
  }, [])

  /**
   * Conta o número de dias úteis (seg-sex) entre duas datas.
   * Se includeWeekends for true, conta todos os dias.
   */
  const countBusinessDays = useCallback(
    (start: Date, end: Date, includeWeekendDays: boolean): number => {
      const totalDays = differenceInCalendarDays(end, start) + 1

      if (totalDays <= 0) {
        return 0
      }

      if (includeWeekendDays) {
        // Conta todos os dias
        return totalDays
      }

      const fullWeeks = Math.floor(totalDays / 7)
      const remainingDays = totalDays % 7
      let businessDays = fullWeeks * 5
      const startDay = start.getDay()

      for (let i = 0; i < remainingDays; i += 1) {
        const day = (startDay + i) % 7
        if (day !== 0 && day !== 6) {
          businessDays += 1
        }
      }

      return businessDays
    },
    []
  )

  // Função para determinar o período correto baseado nos dias selecionados (só períodos habilitados)
  const getPeriodFromDays = useCallback(
    (days: number): PricingOption => {
      const pricingConfig = getPricingConfig(
        sanitizedEquipment,
        days,
        enabledPeriods
      )
      const selectedPeriod = periodMap[pricingConfig.period]
      return selectedPeriod ?? periodMap.daily!
    },
    [sanitizedEquipment, periodMap, enabledPeriods]
  )

  // Quando o usuário seleciona um período (botão), ajustar baseado nas datas do calendário
  const handlePeriodChange = useCallback(
    (option: PricingOption, totalPrice: number) => {
      // Se há datas selecionadas no calendário, usar os dias reais
      if (startDate && endDate && selectedDays > 0) {
        // Determinar o período correto baseado nos dias reais
        const correctPeriod = getPeriodFromDays(selectedDays)

        // Se o período selecionado não corresponde aos dias reais, ajustar
        if (correctPeriod.id !== option.id) {
          // Ajustar para o período correto baseado nos dias (só períodos habilitados)
          const adjustedPeriod = correctPeriod
          const adjustedPrice = calculateIntelligentPrice(
            sanitizedEquipment,
            selectedDays,
            enabledPeriods
          )

          setSelectedPeriod(adjustedPeriod)
          setFinalPrice(adjustedPrice)
          return
        }
      }

      // Se não há datas selecionadas, usar o período do botão normalmente
      setSelectedPeriod(option)
      setFinalPrice(totalPrice)
    },
    [
      startDate,
      endDate,
      selectedDays,
      getPeriodFromDays,
      sanitizedEquipment,
      enabledPeriods,
    ]
  )

  const handleEquipmentDateRangeChange = useCallback(
    (start: Date | null, end: Date | null, days: number) => {
      setStartDate(start)
      setEndDate(end)
      setSelectedDays(days)

      if (start && end && days > 0) {
        // Calcular preço baseado nos dias reais (só períodos habilitados)
        const totalPrice = calculateIntelligentPrice(
          sanitizedEquipment,
          days,
          enabledPeriods
        )
        setFinalPrice(totalPrice)

        // Determinar período correto baseado nos dias reais selecionados
        const correctPeriod = getPeriodFromDays(days)
        setSelectedPeriod(correctPeriod)
      } else {
        // Se não há datas, resetar para período padrão
        setSelectedPeriod(null)
        setFinalPrice(pricePerDay)
      }
    },
    [getPeriodFromDays, pricePerDay, sanitizedEquipment, enabledPeriods]
  )

  // Atualizar selectedRange quando startDate/endDate mudarem externamente
  // Mas NÃO interferir quando o calendário está aberto (usuário selecionando)
  useEffect(() => {
    // Se o calendário está aberto, não sobrescrever a seleção visual
    // para não interferir no processo de seleção do react-day-picker
    if (isCalendarOpen) {
      return
    }

    if (startDate && endDate) {
      setSelectedRange({ from: startDate, to: endDate })
    } else if (startDate) {
      setSelectedRange({ from: startDate, to: undefined })
    } else {
      setSelectedRange(undefined)
    }
  }, [startDate, endDate, isCalendarOpen])

  // Recalcular quando a opção de incluir finais de semana muda
  useEffect(() => {
    if (startDate && endDate) {
      // Recalcular número de dias com a nova configuração
      const newDays = countBusinessDays(startDate, endDate, includeWeekends)

      if (newDays > 0) {
        handleEquipmentDateRangeChange(startDate, endDate, newDays)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só a troca de "incluir fim de semana" recalcula; com as datas e handleEquipmentDateRangeChange nas dependências, cada seleção de data recalcularia de novo.
  }, [includeWeekends])

  // Toast 2 e 3: Mostrar conforme o usuário seleciona datas
  useEffect(() => {
    if (!shouldShowToasts()) return

    // Toast 2: Quando data de início é selecionada (mas ainda não tem data final)
    if (startDate && !endDate && !hasShownStartDateToast.current) {
      hasShownStartDateToast.current = true
      toast.info(avisoFim.message, {
        description: avisoFim.description,
        position: avisoFim.position,
        duration: avisoFim.duration,
      })
    }

    // Toast 3: Quando ambas as datas são selecionadas (sucesso)
    if (
      startDate &&
      endDate &&
      selectedDays > 0 &&
      !hasShownSuccessToast.current
    ) {
      hasShownSuccessToast.current = true
      const sucesso = avisoSucesso(selectedDays)
      toast.success(sucesso.message, {
        description: sucesso.description,
        position: sucesso.position,
        duration: sucesso.duration,
      })
      markToastsAsShown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markToastsAsShown é estável (useCallback sem dependências) e os avisos são constantes do módulo; os toasts dependem só das datas e dos dias.
  }, [startDate, endDate, selectedDays, shouldShowToasts])

  // Data mínima (hoje)
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const maxSelectableYears = 10

  // Data máxima (10 anos no futuro)
  const maxDate = useMemo(
    () => addYears(today, maxSelectableYears),
    [today, maxSelectableYears]
  )

  const maxSelectableDays = useMemo(() => {
    return differenceInDays(maxDate, today) + 1
  }, [maxDate, today])

  // Handler para seleção no calendário
  const handleCalendarSelect = useCallback(
    (range: EquipmentDateRange | undefined) => {
      // Sempre atualizar a seleção visual do calendário
      setSelectedRange(range)

      if (range?.from && range?.to) {
        // Verificar se é o mesmo dia (primeiro clique) - NÃO fechar o calendário
        const isSameDay =
          range.from.getFullYear() === range.to.getFullYear() &&
          range.from.getMonth() === range.to.getMonth() &&
          range.from.getDate() === range.to.getDate()

        if (isSameDay) {
          // Primeiro clique: apenas manter a seleção visual, não processar ainda
          // O calendário permanece aberto esperando o segundo clique
          // Definir startDate para mostrar no botão, mas sem fechar
          setStartDate(range.from)
          setEndDate(null)
          setSelectedDays(0)
          return
        }

        // Segundo clique: range completo selecionado (datas diferentes)
        // Contar dias considerando se finais de semana estão incluídos
        const days = countBusinessDays(range.from, range.to, includeWeekends)

        // Validar período mínimo
        if (days < 1) {
          return
        }

        // Validar período máximo (até 10 anos)
        if (days > maxSelectableDays) {
          return
        }

        handleEquipmentDateRangeChange(range.from, range.to, days)
        setIsCalendarOpen(false) // Fechar calendário apenas após seleção completa
      } else if (range?.from) {
        // Apenas início selecionado (clique inicial), aguardar fim
        setStartDate(range.from)
        setEndDate(null)
        setSelectedDays(0)
      } else {
        // Nenhuma seleção
        handleEquipmentDateRangeChange(null, null, 0)
      }
    },
    [
      handleEquipmentDateRangeChange,
      countBusinessDays,
      includeWeekends,
      maxSelectableDays,
    ]
  )

  // Handler para limpar seleção
  const handleClear = useCallback(
    (e: { stopPropagation(): void }) => {
      e.stopPropagation()
      setSelectedRange(undefined)
      handleEquipmentDateRangeChange(null, null, 0)
    },
    [handleEquipmentDateRangeChange]
  )

  const firstDayOfCurrentMonth = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }, [today])

  const maxMonth = useMemo(() => {
    return new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
  }, [maxDate])

  const isDateDisabled = useCallback(
    (date: Date) => {
      const dateToCheck = new Date(date)
      dateToCheck.setHours(0, 0, 0, 0)

      // Datas passadas (antes de hoje)
      if (dateToCheck < today) {
        return true
      }

      // Datas futuras além do máximo
      if (dateToCheck > maxDate) {
        return true
      }

      // Se finais de semana não estão incluídos, desabilitar sábado e domingo
      if (!includeWeekends && isWeekend(dateToCheck)) {
        return true
      }

      return false
    },
    [today, maxDate, includeWeekends]
  )

  // Texto do botão
  const displayText = useMemo(() => {
    if (startDate && endDate) {
      return `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
    }
    if (startDate) {
      return format(startDate, 'dd/MM/yyyy', { locale: ptBR })
    }
    return 'Selecione as datas de início e fim'
  }, [startDate, endDate])
  return {
    pricingProps: {
      pricePerDay,
      dailyDiscount,
      weeklyDiscount,
      biweeklyDiscount,
      monthlyDiscount,
      popularPeriod,
      dailyDirectValue,
      weeklyDirectValue,
      biweeklyDirectValue,
      monthlyDirectValue,
      dailyUseDirectValue,
      weeklyUseDirectValue,
      biweeklyUseDirectValue,
      monthlyUseDirectValue,
      dailyRentalEnabled,
      weeklyRentalEnabled,
      biweeklyRentalEnabled,
      monthlyRentalEnabled,
    },
    selectedPeriod,
    finalPrice,
    startDate,
    endDate,
    selectedDays,
    isCalendarOpen,
    setIsCalendarOpen,
    selectedRange,
    includeWeekends,
    setIncludeWeekends,
    includeWeekendsTouched,
    setIncludeWeekendsTouched,
    hasShownFirstClickToast,
    shouldShowToasts,
    handlePeriodChange,
    today,
    maxSelectableYears,
    maxDate,
    handleCalendarSelect,
    handleClear,
    firstDayOfCurrentMonth,
    maxMonth,
    isDateDisabled,
    displayText,
  }
}
