import type { ReactNode } from 'react'
export interface LegalDocumentProps {
  title: string
  subtitle?: string
  updatedAt?: string
  introduction?: ReactNode
  sections: Array<{ id: string; title: string; content: ReactNode }>
}
