'use client'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '../../../shared/lib'
import { useEquipmentList } from './use-equipment-list'
export { formatPrice, formatDate } from './use-equipment-list'
export type { EquipmentListCategory } from './use-equipment-list'
export function useEquipmentListData() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const ports = useMemo(
    () => ({
      navigate: (href: string) => router.push(href),
      isMobile,
      onPageChange: () => {
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      },
    }),
    [router, isMobile]
  )
  const model = useEquipmentList(ports)
  const { activeCardId, setActiveCardId } = model
  useEffect(() => {
    const close = () => {
      if (isMobile && activeCardId) setActiveCardId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [isMobile, activeCardId, setActiveCardId])
  return model
}
