import type * as LucideIcons from 'lucide-react'
import type { CategoryDesign } from '../../../shared/lib/category-design'

export interface Category {
  id: string
  name: string
  description?: string
  icon?: keyof typeof LucideIcons
  iconColor?: string
  backgroundColor?: string
  fontColor?: string
  placement?: 'phases' | 'types' | null
  customIcon?: CategoryDesign['customIcon'] | string | null
  createdAt: string
  _count?: {
    equipments: number
  }
  bgColor?: string
}
