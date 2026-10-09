'use client'

import { getCategoryBadgePreview } from '../../../shared/lib/category-helpers'
import type { CategoryBadgeData } from '../../../shared/lib/category-helpers'

interface CategoryBadgeProps {
  category: CategoryBadgeData
  size?: 'xs' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function CategoryBadge({
  category,
  size = 'sm',
  hover = false,
}: CategoryBadgeProps) {
  return getCategoryBadgePreview(category, size, hover)
}
