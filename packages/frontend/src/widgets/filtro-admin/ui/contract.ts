import type { ReactNode } from 'react';
import type { FilterOption } from '../../../shared/types/filters';
export interface AdminFilterCardProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (_value: string) => void
  searchInputId?: string
  /**
   * Controla o layout do card de filtros.
   * - `responsive` (padrão): empilha em mobile/tablet e vira linha no `lg+`
   * - `stacked`: força **coluna única** em todos os breakpoints
   */
  layout?: 'responsive' | 'stacked'
  filters?: {
    label: string
    value: string
    options: FilterOption[]
    onValueChange: (_value: string) => void
    placeholder?: string
  }[]
  actionButtons?: ReactNode
  viewToggleButtons?: ReactNode
  extraFilters?: ReactNode
  onReset?: () => void
  className?: string
}
