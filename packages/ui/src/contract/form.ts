import type { ReactNode } from 'react'

export interface LabelProps {
  htmlFor?: string
  children?: ReactNode
  className?: string
}

export interface TextareaProps {
  'aria-label'?: string
  value?: string
  placeholder?: string
  disabled?: boolean
  onChangeText?: (value: string) => void
}

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
}
