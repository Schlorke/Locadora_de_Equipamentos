'use client'

import { Card, CardContent } from '@gb-locacoes/ui'
import { FILTER_CARD } from '@gb-locacoes/ui'
import { FilterResetButton } from '@gb-locacoes/ui'
import { CustomSelect, CustomSelectItem } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import { Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'

export type { AdminFilterCardProps } from './contract'
import type { AdminFilterCardProps } from './contract'

export function AdminFilterCard({
  searchPlaceholder = 'Buscar...',
  searchValue = '',
  onSearchChange,
  searchInputId,
  layout = 'responsive',
  filters = [],
  actionButtons,
  viewToggleButtons,
  extraFilters,
  onReset,
  className,
}: AdminFilterCardProps) {
  const [_isFiltered, _setIsFiltered] = useState(false)

  // Check if any filter is active (not "all" or empty)
  useEffect(() => {
    const hasActiveFilters =
      filters.some(
        (filter) =>
          filter.value && filter.value !== 'all' && filter.value !== ''
      ) || Boolean(searchValue && searchValue.trim() !== '')
    _setIsFiltered(hasActiveFilters)
  }, [filters, searchValue])

  const handleReset = () => {
    // Reset all filters
    filters.forEach((filter) => {
      filter.onValueChange('all')
    })

    // Reset search
    if (onSearchChange) {
      onSearchChange('')
    }

    onReset?.()
  }

  return (
    <Card
      className={cn(
        FILTER_CARD,
        'overflow-visible border-0 bg-white backdrop-blur-sm transition-all duration-300',
        className
      )}
      suppressHydrationWarning
    >
      {/* Clean depth layers for filter card */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

      <CardContent className="relative z-10 p-4 sm:p-6">
        <div className="flex flex-col gap-3 min-w-0">
          {/* Primeira linha: coluna única em md, linha a partir de lg */}
          <div
            className={cn(
              'flex flex-col gap-3 min-w-0 md:flex-col',
              layout === 'responsive' && 'lg:flex-row lg:items-center',
              layout === 'stacked' && 'items-stretch'
            )}
          >
            {/* Search Input - Ocupa mais espaço */}
            {onSearchChange && (
              <div
                className={cn(
                  'relative w-full md:w-full',
                  layout === 'responsive' && 'lg:flex-1 lg:min-w-0'
                )}
              >
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id={searchInputId}
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 transition-all duration-200 h-10"
                />
              </div>
            )}

            {/* Filters Row - coluna única em md, ao lado do search em lg */}
            <div
              className={cn(
                'w-full min-w-0 md:w-full',
                layout === 'responsive' && 'lg:w-auto lg:shrink-0'
              )}
            >
              {/* Filter Selects - coluna única em md, linha em lg */}
              <div
                className={cn(
                  'flex flex-col gap-3 min-w-0 w-full md:flex-col md:w-full lg:flex-row lg:w-auto lg:items-center'
                )}
              >
                {filters.map((filter, index) => (
                  <CustomSelect
                    key={index}
                    value={filter.value}
                    onValueChange={filter.onValueChange}
                    placeholder={filter.placeholder || filter.label}
                    className="w-full h-10 shrink-0 md:w-full lg:w-auto lg:min-w-[180px]"
                  >
                    {filter.options.map((option) => (
                      <CustomSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </CustomSelectItem>
                    ))}
                  </CustomSelect>
                ))}
                {extraFilters && (
                  <div className="w-full shrink-0 md:w-full lg:w-auto lg:min-w-[180px]">
                    {extraFilters}
                  </div>
                )}
                <div className="flex items-center justify-center shrink-0 w-full lg:w-auto">
                  <FilterResetButton
                    onClick={handleReset}
                    title="Resetar filtros"
                    size="md"
                  />
                </div>
                {/* ViewToggle em mobile/tablet - mesma linha */}
                {viewToggleButtons && (
                  <div className="flex items-center justify-center shrink-0 w-full md:w-full lg:hidden">
                    {viewToggleButtons}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Action Buttons (coluna em md, linha em lg) */}
            {actionButtons && (
              <div
                className={cn(
                  'flex flex-col gap-2 items-center w-full shrink-0 md:w-full',
                  layout === 'responsive' &&
                    'lg:flex-row lg:items-center lg:justify-center lg:w-auto lg:self-center',
                  layout === 'stacked' && 'justify-start'
                )}
              >
                {actionButtons}
              </div>
            )}
          </div>

          {/* Segunda linha: ViewToggle apenas em lg (desktop) */}
          {viewToggleButtons && (
            <div className="hidden lg:flex items-center justify-center shrink-0 w-full">
              {viewToggleButtons}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
