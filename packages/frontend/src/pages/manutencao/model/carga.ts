'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createMaintenanceApi } from '../api/maintenance'
import { type Maintenance } from './contracts'

const TABLE_PAGE_SIZE = 10

export function useMaintenanceData() {
  const client = useScopedApiClient(null)
  const api = useMemo(() => createMaintenanceApi(client), [client])
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [filteredMaintenances, setFilteredMaintenances] = useState<
    Maintenance[]
  >([])
  const [loading, setLoading] = useState(true)
  const [selectedMaintenance, setSelectedMaintenance] =
    useState<Maintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [tablePage, setTablePage] = useState(1)

  const fetchMaintenances = useCallback(async () => {
    if (!client.isCurrent()) return
    try {
      setLoading(true)
      const [maintenancesResponse, scheduledResponse] = await Promise.all([
        api.list(),
        api.scheduled(),
      ])
      if (!client.isCurrent()) return

      if (!maintenancesResponse.ok)
        throw new Error('Erro ao carregar manutenções')
      if (!scheduledResponse.ok)
        throw new Error('Erro ao carregar manutenções agendadas')

      const maintenancesData = maintenancesResponse.data

      setMaintenances(maintenancesData!.maintenances || [])
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching maintenances:', error)
      toast.error('Erro', {
        description: 'Erro ao carregar manutenções. Tente novamente.',
      })
      setMaintenances([])
    } finally {
      if (client.isCurrent()) setLoading(false)
    }
  }, [api, client])

  useEffect(() => {
    setMaintenances([])
    setFilteredMaintenances([])
    setSelectedMaintenance(null)
    setSearchTerm('')
    setStatusFilter('all')
    setTypeFilter('all')
    setViewMode('list')
    setTablePage(1)
    void fetchMaintenances()
  }, [fetchMaintenances])

  useEffect(() => {
    const filtered = maintenances.filter((maintenance) => {
      const matchesSearch =
        maintenance.equipment.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        maintenance.technician
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        maintenance.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' || maintenance.status === statusFilter

      const matchesType =
        typeFilter === 'all' || maintenance.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })

    setFilteredMaintenances(filtered)
  }, [maintenances, searchTerm, statusFilter, typeFilter])

  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredMaintenances.length / TABLE_PAGE_SIZE)
  )
  const tableCurrentPage = Math.min(tablePage, tableTotalPages)
  const paginatedMaintenances = useMemo(
    () =>
      filteredMaintenances.slice(
        (tableCurrentPage - 1) * TABLE_PAGE_SIZE,
        tableCurrentPage * TABLE_PAGE_SIZE
      ),
    [filteredMaintenances, tableCurrentPage]
  )

  useEffect(() => {
    setTablePage(1)
  }, [searchTerm, statusFilter, typeFilter])

  return {
    // State
    maintenances,
    filteredMaintenances,
    loading,
    selectedMaintenance,
    setSelectedMaintenance,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    viewMode,
    setViewMode,
    tablePage,
    setTablePage,

    // Computed
    paginatedMaintenances,
    tableCurrentPage,
    tableTotalPages,
  }
}
