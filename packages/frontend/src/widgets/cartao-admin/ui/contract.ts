import type { ReactNode } from 'react';
export interface AdminCardProps {
  children: ReactNode
  title?: string
  subtitle?: string
  icon?: ReactNode
  className?: string
  contentClassName?: string
  variant?: 'default' | 'elevated' | 'glass' | 'flat'
}
