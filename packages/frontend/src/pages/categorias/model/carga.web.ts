'use client'
import { useEffect } from 'react'
import { useIsMobile } from '../../../shared/lib'
import { useCategoriesModel } from './carga'
export function useCategoriesData() {
  const m = useCategoriesModel({
    requestConfirmation: (message) => confirm(message),
    onPageChange: () =>
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100),
  })
  const isMobile = useIsMobile()
  useEffect(() => {
    const close = () => {
      if (isMobile && m.activeCardId) m.setActiveCardId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [isMobile, m.activeCardId, m.setActiveCardId])
  return { ...m, isMobile }
}

export type { Category } from './tipos'
