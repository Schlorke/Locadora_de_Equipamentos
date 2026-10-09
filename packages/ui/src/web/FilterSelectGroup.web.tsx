'use client'

import { CustomSelect, CustomSelectItem } from './CustomSelect.web'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import type { Filter } from '../contract/filter-select-group'
import React from 'react'

interface FilterSelectGroupProps {
  filters: Filter[]
  className?: string
  selectClassName?: string
  activeClassName?: string
  gap?: 'sm' | 'md' | 'lg'
  viewToggleButtons?: React.ReactNode
  resetButton?: React.ReactNode
}

export function FilterSelectGroup({
  filters,
  className,
  selectClassName,
  gap: _gap = 'md',
  viewToggleButtons,
  resetButton,
}: FilterSelectGroupProps) {
  return (
    <div className="flex flex-col gap-3 w-full md:w-full lg:w-auto">
      {/* Primeira linha: Filtros e Reset Button */}
      <div
        className={cn(
          'flex flex-col md:flex-col lg:flex-row gap-3 min-w-0 w-full md:w-full lg:w-auto lg:items-center',
          className
        )}
      >
        {filters.map((filter, index) => (
          <CustomSelect
            key={index}
            value={filter.value}
            onValueChange={filter.onValueChange}
            placeholder={filter.placeholder || filter.label}
            className={cn(
              'w-full md:w-full lg:w-auto lg:min-w-[180px] h-10 shrink-0',
              selectClassName
            )}
          >
            {filter.options.map((option) => (
              <CustomSelectItem key={option.value} value={option.value}>
                {option.label}
              </CustomSelectItem>
            ))}
          </CustomSelect>
        ))}
        {resetButton && (
          <div className="flex items-center justify-center shrink-0 w-full md:w-full lg:w-auto">
            {resetButton}
          </div>
        )}
        {/* ViewToggle em mobile/tablet - mesma linha */}
        {viewToggleButtons && (
          <div className="flex items-center justify-center shrink-0 w-full md:w-full lg:hidden">
            {viewToggleButtons}
          </div>
        )}
      </div>
      {/* Segunda linha: ViewToggle apenas em lg (desktop) */}
      {viewToggleButtons && (
        <div className="hidden lg:flex items-center justify-start shrink-0 w-full">
          {viewToggleButtons}
        </div>
      )}
    </div>
  )
}
