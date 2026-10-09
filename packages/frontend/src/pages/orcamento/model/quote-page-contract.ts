import type { ReactNode } from 'react'
import type { AddressData } from '@gb-locacoes/ui'
export interface Equipment {
  id: string
  name: string
  description: string
  pricePerDay: number
  images?: string[]
  category: {
    name: string
  }
  isAvailable: boolean
  maxStock?: number
  // Campos de desconto
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
  popularPeriod?: string
}
export interface QuoteFormData {
  name: string
  email: string
  phone: string
  cpf: string
  cnpj: string
  cep: string
  company: string
  message: string
  deliveryType?: 'DELIVERY' | 'PICKUP'
  deliveryAddress?: AddressData
}
export interface QuotePreferences {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export interface QuotePagePorts {
  preferences: QuotePreferences
  query: { get(name: string): string | null }
  clearQuery?(): void
  scrollTop?(): void
  focusField?(id: string): void
  image?(props: { src: string; alt: string; height: number }): ReactNode
}
export interface QuoteSubmitEvent {
  preventDefault(): void
}

export interface QuotePreferenceStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}
export interface NativeQuotePageProps {
  storage: QuotePreferenceStorage
  equipmentId?: string
  clearQuery?(): void
  image?: QuotePagePorts['image']
}
