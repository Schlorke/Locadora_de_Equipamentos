import type { ReactNode } from 'react'

export interface PricingOption {
  id: string
  label: string
  period: string
  multiplier: number
  discount: number
  directValue?: number
  useDirectValue?: boolean
  popular?: boolean
  enabled?: boolean
}

export interface EquipmentPricingSelectorProps {
  pricePerDay: number
  onPeriodChange?: (_option: PricingOption, _totalPrice: number) => void
  className?: string
  // Admin-configured rental periods
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  popularPeriod?: string
  // Direct value pricing configurations
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  // Pricing method control (percentage or direct value)
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
  // Períodos de locação oferecidos (quando false, período visível mas inativo)
  dailyRentalEnabled?: boolean
  weeklyRentalEnabled?: boolean
  biweeklyRentalEnabled?: boolean
  monthlyRentalEnabled?: boolean
  // Datas selecionadas no calendário (para sincronização)
  selectedDays?: number
  startDate?: Date | null
  endDate?: Date | null
  selectedPeriod?: PricingOption | null
}

export interface SmartQuoteButtonProps {
  equipmentId: string
  equipmentName: string
  pricePerDay: number
  isAvailable: boolean
  selectedPeriod: PricingOption
  finalPrice: number
  maxStock?: number
  description?: string
  category?: {
    name: string
  }
  images?: string[]
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  // Campos de valor direto
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  // Campos de controle de método de preço
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
  startDate?: Date | null
  endDate?: Date | null
  selectedDays?: number
  /** Indica se finais de semana estão incluídos na contagem de dias */
  includeWeekends?: boolean
  /** Marca se a preferência de finais de semana já foi confirmada */
  weekendSelectionConfirmed?: boolean
  onWeekendSelectionConfirm?: (_includeWeekends: boolean) => void
  className?: string
  size?: 'sm' | 'lg' | 'default'
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'reset'
    | 'gradient'
    | 'link'
  children?: ReactNode
}

export interface SmartEquipmentPricingProps {
  equipmentId: string
  equipmentName: string
  pricePerDay: number
  isAvailable: boolean
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  popularPeriod?: string
  maxStock?: number
  description?: string
  category?: {
    name: string
  }
  images?: string[]
  className?: string
  // Campos de valor direto
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  // Campos de controle de método de preço
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
  // Períodos oferecidos (false = botão visível como indisponível)
  dailyRentalEnabled?: boolean
  weeklyRentalEnabled?: boolean
  biweeklyRentalEnabled?: boolean
  monthlyRentalEnabled?: boolean
}
