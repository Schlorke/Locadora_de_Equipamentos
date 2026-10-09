import type { ReactNode } from 'react'
import { View } from 'react-native'
import { space } from '@gb-locacoes/design-tokens'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select.native'
export function CustomSelect({
  children,
  placeholder = 'Selecionar...',
  value,
  onValueChange,
  disabled,
  'aria-label': label,
}: {
  children?: ReactNode
  placeholder?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger aria-label={label ?? placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}
export const CustomSelectItem = SelectItem
export function FilterSelectGroup({
  filters,
  resetButton,
  viewToggleButtons,
}: {
  filters: Array<{
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
    label?: string
    options: Array<{ value: string; label: string }>
  }>
  resetButton?: ReactNode
  viewToggleButtons?: ReactNode
  className?: string
}) {
  return (
    <View style={{ gap: space.sm }}>
      {filters.map((filter, index) => (
        <CustomSelect
          key={index}
          value={filter.value}
          onValueChange={filter.onValueChange}
          placeholder={filter.placeholder ?? filter.label}
        >
          {filter.options.map((option) => (
            <CustomSelectItem key={option.value} value={option.value}>
              {option.label}
            </CustomSelectItem>
          ))}
        </CustomSelect>
      ))}
      {resetButton}
      {viewToggleButtons}
    </View>
  )
}
