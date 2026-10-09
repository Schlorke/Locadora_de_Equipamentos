'use client'
import { useEffect, useMemo, useState } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminEquipmentsApi } from '../api/equipments'
import { toast } from '../../../shared/lib/toast'
import type { EquipmentDetails } from './tipos'
export interface EquipmentDetailsPorts {
  navigate: (href: string) => void
  requestConfirmation: (message: string) => boolean | Promise<boolean>
}
export function useEquipmentDetails(
  equipmentId: string | null,
  ports: EquipmentDetailsPorts
) {
  const apiClient = useScopedApiClient(equipmentId)
  const api = useMemo(() => createAdminEquipmentsApi(apiClient), [apiClient])
  const [equipment, setEquipment] = useState<EquipmentDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setEquipment(null)
    setIsLoading(true)
    if (!equipmentId) {
      setIsLoading(false)
      return
    }

    const fetchEquipment = async (id: string) => {
      try {
        const response = await api.get<EquipmentDetails>(id)
        if (!apiClient.isCurrent()) return
        if (response.ok) {
          const data = response.data
          setEquipment(data)
        } else {
          toast.error('Equipamento não encontrado.')
          ports.navigate('/admin/equipamentos')
        }
      } catch (error) {
        if (!apiClient.isCurrent() || isAbortError(error)) return

        console.error('Erro ao carregar equipamento:', error)
        toast.error('Falha ao carregar equipamento.')
      } finally {
        if (apiClient.isCurrent()) setIsLoading(false)
      }
    }

    fetchEquipment(equipmentId)
  }, [equipmentId, api, apiClient, ports])

  const handleDelete = async () => {
    if (!equipment) return

    if (
      !(await ports.requestConfirmation(
        'Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.'
      ))
    )
      return

    if (!apiClient.isCurrent()) return
    setIsDeleting(true)
    try {
      const response = await api.remove(equipmentId!)
      if (!apiClient.isCurrent()) return

      if (response.ok) {
        toast.success('Equipamento excluído com sucesso!')
        ports.navigate('/admin/equipamentos')
      } else {
        const errorData = response.data
        toast.error(
          `Erro ao excluir equipamento: ${errorData.error || 'Erro desconhecido'}`
        )
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao excluir equipamento:', error)
      toast.error('Erro de rede ao excluir equipamento')
    } finally {
      if (apiClient.isCurrent()) setIsDeleting(false)
    }
  }

  return { equipment, isLoading, isDeleting, handleDelete }
}
