'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminEquipmentsApi } from '../api/equipments'
import { toast } from '../../../shared/lib/toast'
import type { EquipmentUnit } from './tipos'
export function useEquipmentUnits(
  equipmentId: string,
  confirmDelete: (message: string) => boolean | Promise<boolean>
) {
  const apiClient = useScopedApiClient(equipmentId)
  const api = useMemo(() => createAdminEquipmentsApi(apiClient), [apiClient])
  const [units, setUnits] = useState<EquipmentUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<EquipmentUnit | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const saveClient = useScopedApiClient(
    JSON.stringify([equipmentId, selectedUnit?.id, isDialogOpen])
  )
  const saveApi = useMemo(
    () => createAdminEquipmentsApi(saveClient),
    [saveClient]
  )

  // Form state
  const [uniqueCode, setUniqueCode] = useState('')
  const [status, setStatus] = useState('AVAILABLE')
  const [hourMeter, setHourMeter] = useState('')
  const [odometer, setOdometer] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.units<EquipmentUnit[]>(equipmentId)
      if (!apiClient.isCurrent()) return
      if (response.ok) {
        const data = response.data
        setUnits(data)
      } else {
        toast.error('Erro ao carregar unidades')
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao buscar unidades:', error)
      toast.error('Erro ao buscar unidades')
    } finally {
      if (apiClient.isCurrent()) setLoading(false)
    }
  }, [equipmentId, api, apiClient])

  useEffect(() => {
    setUnits([])
    setSelectedUnit(null)
    setIsDialogOpen(false)
    fetchUnits()
  }, [fetchUnits])

  const handleCreate = () => {
    setSelectedUnit(null)
    setIsEditing(false)
    setUniqueCode('')
    setStatus('AVAILABLE')
    setHourMeter('')
    setOdometer('')
    setSerialNumber('')
    setNotes('')
    setIsDialogOpen(true)
  }

  const handleEdit = (unit: EquipmentUnit) => {
    setSelectedUnit(unit)
    setIsEditing(true)
    setUniqueCode(unit.uniqueCode)
    setStatus(unit.status)
    setHourMeter(unit.hourMeter?.toString() || '')
    setOdometer(unit.odometer?.toString() || '')
    setSerialNumber(unit.serialNumber || '')
    setNotes(unit.notes || '')
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!uniqueCode.trim()) {
      toast.error('Código único é obrigatório')
      return
    }

    try {
      const data: {
        uniqueCode: string
        status: string
        hourMeter?: number
        odometer?: number
        serialNumber?: string
        notes?: string
      } = {
        uniqueCode: uniqueCode.trim(),
        status,
      }

      if (hourMeter) {
        const hm = parseFloat(hourMeter)
        if (!isNaN(hm) && hm >= 0) {
          data.hourMeter = hm
        }
      }

      if (odometer) {
        const od = parseFloat(odometer)
        if (!isNaN(od) && od >= 0) {
          data.odometer = od
        }
      }

      if (serialNumber.trim()) {
        data.serialNumber = serialNumber.trim()
      }

      if (notes.trim()) {
        data.notes = notes.trim()
      }

      let response: Awaited<ReturnType<typeof saveApi.createUnit>>

      if (isEditing && selectedUnit) {
        // Update
        response = await saveApi.updateUnit(
          selectedUnit.id,
          JSON.stringify(data)
        )
      } else {
        // Create
        response = await saveApi.createUnit(
          JSON.stringify({
            ...data,
            equipmentId,
          })
        )
      }

      if (!saveClient.isCurrent()) return
      if (response.ok) {
        toast.success(
          isEditing
            ? 'Unidade atualizada com sucesso!'
            : 'Unidade criada com sucesso!'
        )
        setIsDialogOpen(false)
        fetchUnits()
      } else {
        const errorData = response.data
        toast.error(errorData.error || 'Erro ao salvar unidade')
      }
    } catch (error) {
      if (!saveClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao salvar unidade:', error)
      toast.error('Erro ao salvar unidade')
    }
  }

  const handleDelete = async (unitId: string) => {
    if (
      !(await confirmDelete('Tem certeza que deseja deletar esta unidade?'))
    ) {
      return
    }

    if (!apiClient.isCurrent()) return
    try {
      const response = await api.removeUnit(unitId)
      if (!apiClient.isCurrent()) return

      if (response.ok) {
        toast.success('Unidade deletada com sucesso!')
        fetchUnits()
      } else {
        const errorData = response.data
        toast.error(errorData.error || 'Erro ao deletar unidade')
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao deletar unidade:', error)
      toast.error('Erro ao deletar unidade')
    }
  }

  return {
    units,
    loading,
    fetchUnits,
    isDialogOpen,
    setIsDialogOpen,
    selectedUnit,
    isEditing,
    uniqueCode,
    setUniqueCode,
    status,
    setStatus,
    hourMeter,
    setHourMeter,
    odometer,
    setOdometer,
    serialNumber,
    setSerialNumber,
    notes,
    setNotes,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
  }
}
