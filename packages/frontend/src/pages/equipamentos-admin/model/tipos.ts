import type * as LucideIcons from 'lucide-react'
import type { ReactNode } from 'react'
import type { CustomIconConfig } from '../../../shared/lib/category-design'

export interface Category {
  id: string
  name: string
}

export interface EquipmentFormData {
  name: string
  description: string
  pricePerDay: number
  categoryId: string
  images: string[]
  isAvailable: boolean
  specifications?: Record<string, string>
  // Inventory management
  maxStock: number
  // Equipment control (edit page only)
  partsLossHistory?: Array<{
    date: string
    description: string
    quantity: number
    images?: string[]
  }>
  partsLossCount?: number
  // Rental period configurations
  dailyDiscount: number
  weeklyDiscount: number
  biweeklyDiscount: number
  monthlyDiscount: number
  popularPeriod: string
  // Direct value pricing configurations
  dailyDirectValue: number
  weeklyDirectValue: number
  biweeklyDirectValue: number
  monthlyDirectValue: number
  // Pricing method control (percentage or direct value)
  dailyUseDirectValue: boolean
  weeklyUseDirectValue: boolean
  biweeklyUseDirectValue: boolean
  monthlyUseDirectValue: boolean
  // Rental period toggles (enable/disable quote for each period)
  dailyRentalEnabled: boolean
  weeklyRentalEnabled: boolean
  biweeklyRentalEnabled: boolean
  monthlyRentalEnabled: boolean
}

export type PricingPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export const PRICING_PERIOD_CONFIG: Record<
  PricingPeriod,
  { label: string; disableLabel: string }
> = {
  daily: {
    label: 'Período Diário',
    disableLabel: 'Desativar locação por dia',
  },
  weekly: {
    label: 'Período Semanal',
    disableLabel: 'Desativar locação por semana',
  },
  biweekly: {
    label: 'Período Quinzenal',
    disableLabel: 'Desativar locação quinzenal',
  },
  monthly: {
    label: 'Período Mensal',
    disableLabel: 'Desativar locação mensal',
  },
}

export const DEFAULT_FORM_DATA: EquipmentFormData = {
  name: '',
  description: '',
  pricePerDay: 0,
  categoryId: '',
  images: [],
  isAvailable: true,
  specifications: {},
  maxStock: 1,
  dailyDiscount: 0,
  weeklyDiscount: 0,
  biweeklyDiscount: 0,
  monthlyDiscount: 0,
  popularPeriod: 'weekly',
  dailyDirectValue: 0,
  weeklyDirectValue: 0,
  biweeklyDirectValue: 0,
  monthlyDirectValue: 0,
  dailyUseDirectValue: false,
  weeklyUseDirectValue: false,
  biweeklyUseDirectValue: false,
  monthlyUseDirectValue: false,
  dailyRentalEnabled: true,
  weeklyRentalEnabled: true,
  biweeklyRentalEnabled: true,
  monthlyRentalEnabled: true,
}

export interface EquipmentDetails {
  id: string
  name: string
  description: string
  pricePerDay: number
  isAvailable: boolean
  images: string[]
  specifications?: Record<string, string>
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
    icon?: string
    iconColor?: string
    bgColor?: string
    fontColor?: string
  }
  _count?: {
    quoteItems: number
    reviews: number
  }
}

export interface EquipmentUnit {
  id: string
  uniqueCode: string
  status: string
  hourMeter: number | string | null
  odometer: number | string | null
  serialNumber: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Equipment {
  id: string
  name: string
  description?: string
  pricePerDay: number
  isAvailable: boolean
  category?: {
    id: string
    name: string
    bgColor?: string
    fontColor?: string
    icon?: keyof typeof LucideIcons
    iconColor?: string
    customIcon?: CustomIconConfig | null
  }
  images: string[]
  createdAt: string
  partsLossHistory?: Array<{
    date: string
    description: string
    quantity: number
    images?: string[]
  }>
  partsLossCount?: number
}

export interface ViewEquipmentDialogProps {
  equipment: Equipment | null
  isOpen: boolean
  onClose: () => void
  onEdit: (_equipment: Equipment) => void
}

export interface EquipmentImagePort {
  image?: (props: { src: string; alt: string; height: number }) => ReactNode
}
export interface EquipmentDetailsPageProps extends EquipmentImagePort {
  equipmentId?: string | null
}
export interface EquipmentUnitsManagerProps {
  equipmentId: string
}

export interface EquipmentFormPageProps extends EquipmentDetailsPageProps {
  pickImages?: () => Promise<FormData[]>
}
