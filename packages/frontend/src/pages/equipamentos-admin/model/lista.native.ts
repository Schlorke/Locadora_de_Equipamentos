'use client'
import { useMemo } from 'react'
import { useNavigate } from '@gb-locacoes/ui'
import { useEquipmentList } from './use-equipment-list'
export { formatPrice, formatDate } from './use-equipment-list'
export type { EquipmentListCategory } from './use-equipment-list'
export function useEquipmentListData() {
  const navigate = useNavigate()
  const ports = useMemo(
    () => ({ navigate: (href: string) => navigate?.(href), isMobile: true }),
    [navigate]
  )
  return useEquipmentList(ports)
}
