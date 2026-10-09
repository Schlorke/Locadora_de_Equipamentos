import type { ReactNode } from 'react';
export interface AdminPageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  infoBadge?: {
    icon: ReactNode
    text: string
  }
  className?: string
}
