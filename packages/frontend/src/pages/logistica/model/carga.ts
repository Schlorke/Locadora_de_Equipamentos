'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createLogisticsApi } from '../api/logistics'
import type { Delivery, Vehicle, Driver } from './contracts'

export interface EditingDeliveryState {
  vehicleId?: string
  driverId?: string
  driverName?: string
  distance?: number
  photos: string[]
  checklist: Record<string, boolean | string | number>
  notes?: string
}

const TABLE_PAGE_SIZE = 10

const EMPTY_EDITING: EditingDeliveryState = {
  photos: [],
  checklist: {},
}

export function useLogisticsData() {
  const client = useScopedApiClient(null)
  const api = useMemo(() => createLogisticsApi(client), [client])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(
    null
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [tablePage, setTablePage] = useState(1)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingDelivery, setEditingDelivery] =
    useState<EditingDeliveryState>(EMPTY_EDITING)
  const [editingCycle, setEditingCycle] = useState(0)
  const saveClient = useScopedApiClient(
    JSON.stringify([selectedDelivery?.id, isEditing, editingCycle])
  )
  const saveApi = useMemo(() => createLogisticsApi(saveClient), [saveClient])

  const fetchDeliveries = useCallback(async () => {
    if (!client.isCurrent()) return
    try {
      setLoading(true)
      const response = await api.deliveries()
      if (!client.isCurrent()) return
      if (!response.ok) throw new Error('Erro ao carregar entregas')
      const data = response.data
      setDeliveries(data!.deliveries || [])
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching deliveries:', error)
      toast.error('Erro', {
        description: 'Erro ao carregar entregas. Tente novamente.',
      })
      setDeliveries([])
    } finally {
      if (client.isCurrent()) setLoading(false)
    }
  }, [api, client])

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await api.vehicles()
      if (!client.isCurrent()) return
      if (response.ok) {
        const data = response.data
        setVehicles(data!.vehicles || [])
      }
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching vehicles:', error)
    }
  }, [api, client])

  const fetchDrivers = useCallback(async () => {
    try {
      const response = await api.drivers()
      if (!client.isCurrent()) return
      if (response.ok) {
        const data = response.data
        setDrivers(data!.drivers || [])
      }
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching drivers:', error)
    }
  }, [api, client])

  useEffect(() => {
    setDeliveries([])
    setFilteredDeliveries([])
    setVehicles([])
    setDrivers([])
    setSelectedDelivery(null)
    setIsEditing(false)
    setEditingDelivery(EMPTY_EDITING)
    setSearchTerm('')
    setStatusFilter('all')
    setTypeFilter('all')
    setViewMode('table')
    setTablePage(1)
    void fetchDeliveries()
    void fetchVehicles()
    void fetchDrivers()
  }, [fetchDeliveries, fetchVehicles, fetchDrivers])

  useEffect(() => {
    const filtered = deliveries.filter((delivery) => {
      const matchesSearch =
        delivery.rental.users.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        delivery.rental.users.email
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        delivery.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' || delivery.status === statusFilter

      const matchesType = typeFilter === 'all' || delivery.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })

    setFilteredDeliveries(filtered)
  }, [deliveries, searchTerm, statusFilter, typeFilter])

  // Pagination
  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredDeliveries.length / TABLE_PAGE_SIZE)
  )
  const tableCurrentPage = Math.min(tablePage, tableTotalPages)
  const paginatedDeliveries = useMemo(
    () =>
      filteredDeliveries.slice(
        (tableCurrentPage - 1) * TABLE_PAGE_SIZE,
        tableCurrentPage * TABLE_PAGE_SIZE
      ),
    [filteredDeliveries, tableCurrentPage]
  )

  useEffect(() => {
    setTablePage(1)
  }, [searchTerm, statusFilter, typeFilter])

  const handleEditDelivery = (delivery: Delivery) => {
    setEditingCycle((cycle) => cycle + 1)
    setSelectedDelivery(delivery)
    setIsEditing(true)
    setEditingDelivery({
      vehicleId: delivery.vehicleId || undefined,
      driverId: delivery.driverId || undefined,
      driverName: delivery.driverName || undefined,
      distance: delivery.distance ? Number(delivery.distance) : undefined,
      photos: delivery.photos || [],
      checklist:
        (delivery.checklist as Record<string, boolean | string | number>) || {},
      notes: delivery.notes || undefined,
    })
  }

  const handleSaveDelivery = async () => {
    if (!selectedDelivery) return

    try {
      const response = await saveApi.update(
        selectedDelivery.id,
        JSON.stringify({
          vehicleId: editingDelivery.vehicleId,
          driverId: editingDelivery.driverId,
          driverName: editingDelivery.driverName,
          distance: editingDelivery.distance,
          photos: editingDelivery.photos,
          checklist: editingDelivery.checklist,
          notes: editingDelivery.notes,
        })
      )
      if (!saveClient.isCurrent()) return

      if (response.ok) {
        toast.success('Entrega/coleta atualizada com sucesso')
        fetchDeliveries()
        setIsEditing(false)
        setSelectedDelivery(null)
      } else {
        throw new Error('Erro ao atualizar')
      }
    } catch (error) {
      if (isAbortError(error) || !saveClient.isCurrent()) return
      console.error('Error updating delivery:', error)
      toast.error('Erro ao atualizar entrega/coleta')
    }
  }

  const handleUpdateStatus = async (deliveryId: string, status: string) => {
    try {
      const response = await api.update(deliveryId, JSON.stringify({ status }))
      if (!client.isCurrent()) return

      if (response.ok) {
        toast.success('Status atualizado com sucesso')
        fetchDeliveries()
      } else {
        throw new Error('Erro ao atualizar status')
      }
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error updating status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleCloseDialog = () => {
    setEditingCycle((cycle) => cycle + 1)
    setSelectedDelivery(null)
    setIsEditing(false)
    setEditingDelivery(EMPTY_EDITING)
  }

  const handleCancelEditing = () => {
    setEditingCycle((cycle) => cycle + 1)
    setIsEditing(false)
    setEditingDelivery(EMPTY_EDITING)
  }

  return {
    deliveries,
    filteredDeliveries,
    loading,
    selectedDelivery,
    setSelectedDelivery,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    viewMode,
    setViewMode,
    vehicles,
    drivers,
    isEditing,
    setIsEditing,
    editingDelivery,
    setEditingDelivery,
    paginatedDeliveries,
    tableCurrentPage,
    tableTotalPages,
    setTablePage,
    handleEditDelivery,
    handleSaveDelivery,
    handleUpdateStatus,
    handleCloseDialog,
    handleCancelEditing,
  }
}
