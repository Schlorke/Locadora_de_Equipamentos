'use client'

import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminEquipmentsApi } from '../api/equipments'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  EQUIPMENT_LIST_PAGE_SIZE,
  filterEquipmentList,
  formatEquipmentListDate,
  formatEquipmentListPrice,
  sortEquipmentByName,
} from '../../../entities/equipamento'
import { toast } from '../../../shared/lib/toast'
import type { Equipment } from './tipos'
import type { CustomIconConfig } from '../../../shared/lib/category-design'
import type * as LucideIcons from 'lucide-react'

export interface EquipmentListCategory {
  id: string
  name: string
  bgColor?: string
  fontColor?: string
  icon?: keyof typeof LucideIcons
  iconColor?: string
  customIcon?: CustomIconConfig | null
}

export function formatPrice(price: number) {
  return formatEquipmentListPrice(price)
}

export function formatDate(dateString: string) {
  return formatEquipmentListDate(dateString)
}

export interface EquipmentListPorts {
  navigate: (href: string) => void
  onPageChange?: () => void
  isMobile?: boolean
}

export function useEquipmentList(ports: EquipmentListPorts) {
  const apiClient = useScopedApiClient(null)
  const api = useMemo(() => createAdminEquipmentsApi(apiClient), [apiClient])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [filteredEquipments, setFilteredEquipments] = useState<Equipment[]>([])
  const [categories, setCategories] = useState<EquipmentListCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null
  )
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(
    null
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [pageKey, setPageKey] = useState(0)

  const isMobile = ports.isMobile ?? false

  const fetchEquipments = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.list<
        Equipment[] | { equipments?: Equipment[] }
      >()
      if (!apiClient.isCurrent()) return
      if (response.ok) {
        const data = response.data
        const raw = Array.isArray(data) ? data : data.equipments
        const equipmentsData = sortEquipmentByName([...(raw ?? [])])
        setEquipments(equipmentsData)
      } else {
        toast.error('Erro', { description: 'Erro ao carregar equipamentos.' })
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Error fetching equipments:', error)
      toast.error('Erro', { description: 'Erro ao carregar equipamentos.' })
    } finally {
      if (apiClient.isCurrent()) setLoading(false)
    }
  }, [api, apiClient])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.categories<EquipmentListCategory[]>()
      if (!apiClient.isCurrent()) return
      if (response.ok) {
        const data = response.data
        setCategories(data)
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Error fetching categories:', error)
    }
  }, [api, apiClient])

  const filterEquipments = useCallback(() => {
    const sorted = filterEquipmentList(equipments, {
      searchTerm,
      selectedCategory,
      availabilityFilter,
    })
    setFilteredEquipments(sorted)
    setCurrentPage(1)
  }, [equipments, searchTerm, selectedCategory, availabilityFilter])

  // Pagination
  const totalPages = Math.ceil(
    filteredEquipments.length / EQUIPMENT_LIST_PAGE_SIZE
  )
  const startIndex = (currentPage - 1) * EQUIPMENT_LIST_PAGE_SIZE
  const currentEquipments = filteredEquipments.slice(
    startIndex,
    startIndex + EQUIPMENT_LIST_PAGE_SIZE
  )

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageKey((prev) => prev + 1)
    ports.onPageChange?.()
  }

  useEffect(() => {
    setEquipments([])
    setFilteredEquipments([])
    setCategories([])
    setSelectedEquipment(null)
    setEquipmentToDelete(null)
    setIsDeleting(false)
    fetchEquipments()
    fetchCategories()
  }, [fetchEquipments, fetchCategories])

  useEffect(() => {
    filterEquipments()
  }, [filterEquipments])

  const deleteEquipment = async (equipmentId: string): Promise<boolean> => {
    setIsDeleting(true)
    try {
      const response = await api.remove(equipmentId)
      if (!apiClient.isCurrent()) return false
      if (response.ok) {
        toast.success('Equipamento Excluído!', {
          description: 'Equipamento excluído com sucesso.',
        })
        fetchEquipments()
        return true
      }
      const errorData = response.data
      toast.error('Erro', {
        description: errorData.error || 'Erro ao excluir equipamento.',
      })
      return false
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return false

      console.error('Error deleting equipment:', error)
      toast.error('Erro', { description: 'Erro ao excluir equipamento.' })
      return false
    } finally {
      if (apiClient.isCurrent()) setIsDeleting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return
    const success = await deleteEquipment(equipmentToDelete.id)
    if (apiClient.isCurrent() && success) setEquipmentToDelete(null)
  }

  const handleEditEquipment = (equipment: Equipment) => {
    ports.navigate(`/admin/equipamentos/${equipment.id}/editar`)
  }

  return {
    fetchEquipments,
    fetchCategories,
    equipments,
    filteredEquipments,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    availabilityFilter,
    setAvailabilityFilter,
    isDeleting,
    activeCardId,
    setActiveCardId,
    selectedEquipment,
    setSelectedEquipment,
    equipmentToDelete,
    setEquipmentToDelete,
    currentEquipments,
    currentPage,
    totalPages,
    pageKey,
    handlePageChange,
    handleConfirmDelete,
    handleEditEquipment,
    isMobile,
  }
}
