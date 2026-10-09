import { useEffect, useMemo, useState } from 'react'
import type {
  EquipmentPricingSelectorProps,
  PricingOption,
} from './pricing-contract'
import {
  calculateIntelligentPrice,
  getPricingConfig,
  sanitizeCartItemPricing,
} from '../../../entities/equipamento'

const generatePricingOptions = (
  dailyDiscount = 0,
  weeklyDiscount = 0,
  biweeklyDiscount = 0,
  monthlyDiscount = 0,
  popularPeriod = 'weekly',
  // Direct value pricing configurations
  dailyDirectValue = 0,
  weeklyDirectValue = 0,
  biweeklyDirectValue = 0,
  monthlyDirectValue = 0,
  // Pricing method control (percentage or direct value)
  dailyUseDirectValue = false,
  weeklyUseDirectValue = false,
  biweeklyUseDirectValue = false,
  monthlyUseDirectValue = false,
  // Períodos oferecidos (quando false, botão fica visível mas inativo)
  dailyRentalEnabled = true,
  weeklyRentalEnabled = true,
  biweeklyRentalEnabled = true,
  monthlyRentalEnabled = true
): PricingOption[] => [
  {
    id: 'daily',
    label: 'Diário',
    period: 'dia',
    multiplier: 1,
    discount: dailyDiscount,
    directValue: dailyDirectValue,
    useDirectValue: dailyUseDirectValue,
    popular: popularPeriod === 'daily',
    enabled: dailyRentalEnabled,
  },
  {
    id: 'weekly',
    label: 'Semanal',
    period: '7 dias',
    multiplier: 7,
    discount: weeklyDiscount,
    directValue: weeklyDirectValue,
    useDirectValue: weeklyUseDirectValue,
    popular: popularPeriod === 'weekly',
    enabled: weeklyRentalEnabled,
  },
  {
    id: 'biweekly',
    label: 'Quinzenal',
    period: '15 dias',
    multiplier: 15,
    discount: biweeklyDiscount,
    directValue: biweeklyDirectValue,
    useDirectValue: biweeklyUseDirectValue,
    popular: popularPeriod === 'biweekly',
    enabled: biweeklyRentalEnabled,
  },
  {
    id: 'monthly',
    label: 'Mensal',
    period: '30 dias',
    multiplier: 30,
    discount: monthlyDiscount,
    directValue: monthlyDirectValue,
    useDirectValue: monthlyUseDirectValue,
    popular: popularPeriod === 'monthly',
    enabled: monthlyRentalEnabled,
  },
]
export function useEquipmentPeriod({
  pricePerDay,
  onPeriodChange,
  dailyDiscount = 0,
  weeklyDiscount = 10,
  biweeklyDiscount = 15,
  monthlyDiscount = 20,
  popularPeriod = 'weekly',
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
  selectedDays = 0,
  startDate,
  endDate: _endDate,
  selectedPeriod: externalSelectedPeriod,
}: EquipmentPricingSelectorProps) {
  // Variável endDate ignorada pois só usamos startDate para determinar se há seleção
  void _endDate

  // Se alguma data está selecionada no calendário (mesmo que seja só startDate),
  // os botões de período não podem ser clicados - o período é determinado pelas datas
  const hasAnyDateSelected = startDate !== null && startDate !== undefined
  // Usar useMemo para evitar recriações desnecessárias
  const pricingOptions = useMemo(
    () =>
      generatePricingOptions(
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
        monthlyRentalEnabled
      ),
    [
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
    ]
  )

  // Se há datas selecionadas, usar o período externo (sincronizado com calendário)
  // Caso contrário, usar estado interno
  const [internalSelectedPeriod, setInternalSelectedPeriod] =
    useState<PricingOption>(() => {
      const firstEnabled =
        pricingOptions.find((opt) => opt.enabled !== false) ?? pricingOptions[0]
      return firstEnabled!
    })

  // Período "Diário" para usar quando há apenas startDate selecionado (ou primeiro habilitado)
  const dailyPeriod =
    pricingOptions.find((opt) => opt.id === 'daily' && opt.enabled !== false) ??
    pricingOptions.find((opt) => opt.enabled !== false) ??
    pricingOptions[0]!

  // Determinar qual período usar:
  // - Se há qualquer data selecionada no calendário (startDate existe) mas ainda não temos
  //   o range completo (selectedDays === 0), mostrar "Diário" como padrão (1 dia selecionado)
  // - Se há range completo (selectedDays > 0), usar período externo calculado
  // - Se não há nenhuma data selecionada, usar período interno (selecionado pelo usuário)
  const selectedPeriod =
    hasAnyDateSelected && selectedDays === 0
      ? dailyPeriod // Mostrar "Diário" quando apenas startDate está selecionado
      : selectedDays > 0 && externalSelectedPeriod
        ? externalSelectedPeriod
        : internalSelectedPeriod

  // Sincronizar período interno quando período externo mudar (se não há datas selecionadas)
  useEffect(() => {
    if (selectedDays === 0 && externalSelectedPeriod) {
      const matchingOption = pricingOptions.find(
        (opt) => opt.id === externalSelectedPeriod.id
      )
      if (matchingOption) {
        setInternalSelectedPeriod(matchingOption)
      }
    }
  }, [externalSelectedPeriod, selectedDays, pricingOptions])

  // Atualizar período interno quando pricingOptions mudar
  useEffect(() => {
    if (selectedDays === 0) {
      const currentOption = pricingOptions.find(
        (opt) => opt.id === internalSelectedPeriod.id
      )
      if (currentOption) {
        setInternalSelectedPeriod(currentOption)
      }
    }
  }, [pricingOptions, selectedDays, internalSelectedPeriod.id])

  // Notificar mudanças de preço quando pricePerDay, descontos ou dias selecionados mudarem
  useEffect(() => {
    if (onPeriodChange) {
      const totalPrice = calculatePrice(selectedPeriod)
      onPeriodChange(selectedPeriod, totalPrice)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPeriodChange vem do pai e calculatePrice é recriada a cada render: com elas nas dependências o efeito avisaria o pai a cada render, não só quando preço, período ou dias mudam.
  }, [pricePerDay, selectedPeriod, selectedDays])

  const enabledPeriodsForPricing = useMemo(
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

  const calculatePrice = (option: PricingOption) => {
    // Se há dias selecionados no calendário, calcular baseado nos dias REAIS (só períodos habilitados)
    if (selectedDays > 0) {
      const equipment = sanitizeCartItemPricing({
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
      })

      return calculateIntelligentPrice(
        equipment,
        selectedDays,
        enabledPeriodsForPricing
      )
    }

    // Se não há datas selecionadas, usar cálculo padrão do período
    // Se usar valor direto, retornar o valor direto (mesmo que seja 0)
    if (
      option.useDirectValue &&
      option.directValue !== undefined &&
      option.directValue !== null
    ) {
      return option.directValue
    }

    // Caso contrário, calcular com desconto percentual
    const basePrice = pricePerDay * option.multiplier
    const discountAmount = basePrice * (option.discount / 100)
    return basePrice - discountAmount
  }

  const handlePeriodChange = (
    option: PricingOption,
    event?: { preventDefault(): void; stopPropagation(): void }
  ) => {
    // Prevenir propagação do evento para evitar submit do formulário
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    // Período desativado pelo admin: visível mas não clicável
    if (option.enabled === false) {
      return
    }

    // Se há qualquer data selecionada no calendário, não permitir mudança de período
    // O período é determinado automaticamente pelas datas selecionadas
    if (hasAnyDateSelected) {
      return
    }

    // Se não há datas, permitir seleção normal
    setInternalSelectedPeriod(option)
    const totalPrice = calculatePrice(option)
    onPeriodChange?.(option, totalPrice)
  }

  const selectedPrice = calculatePrice(selectedPeriod)

  // Calcular preço original baseado nos dias reais ou no período
  const originalPrice =
    selectedDays > 0
      ? pricePerDay * selectedDays // Preço sem desconto baseado nos dias reais
      : pricePerDay * selectedPeriod.multiplier // Preço do período padrão

  // Determinar se está usando valor direto
  const equipment = sanitizeCartItemPricing({
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
  })

  const pricingConfig =
    selectedDays > 0
      ? getPricingConfig(equipment, selectedDays, enabledPeriodsForPricing)
      : null

  const isUsingDirectValue =
    selectedDays > 0
      ? (pricingConfig?.useDirectValue ?? false)
      : selectedPeriod.useDirectValue &&
        selectedPeriod.directValue !== undefined &&
        selectedPeriod.directValue !== null
  return {
    pricingOptions,
    selectedPeriod,
    handlePeriodChange,
    selectedPrice,
    originalPrice,
    pricingConfig,
    isUsingDirectValue,
  }
}
