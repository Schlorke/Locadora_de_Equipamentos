import type { ReactNode } from 'react'
export interface EquipmentDetailProps {
  name: string
  description: string | null
  categoryName: string
  pricePerDay: number
  available: boolean
  structuredData: ReactNode
  categorySlug?: string | null
  images: string[]
  categoryIcon?: string | null
  categoryIconColor?: string | null
  categoryBgColor?: string | null
  categoryFontColor?: string | null
  categoryCustomIcon?: unknown
  equipmentId: string
  dailyDiscount?: number
  weeklyDiscount?: number
  biweeklyDiscount?: number
  monthlyDiscount?: number
  popularPeriod?: string
  maxStock?: number
  dailyDirectValue?: number
  weeklyDirectValue?: number
  biweeklyDirectValue?: number
  monthlyDirectValue?: number
  dailyUseDirectValue?: boolean
  weeklyUseDirectValue?: boolean
  biweeklyUseDirectValue?: boolean
  monthlyUseDirectValue?: boolean
  dailyRentalEnabled?: boolean
  weeklyRentalEnabled?: boolean
  biweeklyRentalEnabled?: boolean
  monthlyRentalEnabled?: boolean
}

/** Dados do compartilhamento: o título leva o nome da própria locadora, quando houver (achado 143). */
export function buildSharePayload(
  name: string,
  url: string,
  locadora?: string | null
) {
  return {
    title: locadora?.trim() ? `${name} - ${locadora.trim()}` : name,
    text: `Confira este equipamento para locação: ${name}`,
    url,
  }
}

export interface EquipmentDetailScreenProps {
  id: string
  tenantSlug: string | null
  image(props: { src: string; alt: string; height: number }): ReactNode
  onShare?(name: string): Promise<void>
}
