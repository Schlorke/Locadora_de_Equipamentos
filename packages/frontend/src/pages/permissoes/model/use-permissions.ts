'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { createPermissionsApi, type Permission } from '../api/permissions'

export const modules = [
  { id: 'EQUIPMENTS', label: 'Equipamentos', icon: 'Package' as const },
  { id: 'RENTALS', label: 'Locações', icon: 'FileText' as const },
  { id: 'QUOTES', label: 'Orçamentos', icon: 'DollarSign' as const },
  { id: 'MAINTENANCE', label: 'Manutenção', icon: 'Wrench' as const },
  { id: 'LOGISTICS', label: 'Logística', icon: 'Truck' as const },
  { id: 'FINANCIAL', label: 'Financeiro', icon: 'DollarSign' as const },
  { id: 'CONTRACTS', label: 'Contratos', icon: 'FileText' as const },
  { id: 'USERS', label: 'Usuários', icon: 'User' as const },
  { id: 'SETTINGS', label: 'Configurações', icon: 'Settings' as const },
]

export const actions = [
  { id: 'READ', label: 'Visualizar' },
  { id: 'WRITE', label: 'Criar/Editar' },
  { id: 'DELETE', label: 'Excluir' },
  { id: 'APPROVE', label: 'Aprovar' },
  { id: 'MANAGE', label: 'Gerenciar' },
]

export const roles = [
  {
    id: 'ADMIN',
    label: 'Administrador',
    description: 'Acesso total ao sistema',
  },
  { id: 'OPERATOR', label: 'Operador', description: 'Operações básicas' },
  {
    id: 'FINANCIAL',
    label: 'Financeiro',
    description: 'Acesso ao módulo financeiro',
  },
  { id: 'CLIENT', label: 'Cliente', description: 'Acesso à área do cliente' },
]

export function usePermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN')
  const client = useScopedApiClient(null)
  const saveClient = useScopedApiClient(selectedRole)
  const api = useMemo(() => createPermissionsApi(client), [client])
  const saveApi = useMemo(() => createPermissionsApi(saveClient), [saveClient])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSaving(false)
  }, [saveClient])

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.list()
      setPermissions(data.permissions || [])
    } catch (error) {
      if (isAbortError(error) || !client.isCurrent()) return
      console.error('Error fetching permissions:', error)
      toast.error('Erro ao carregar permissões')
      setPermissions([])
    } finally {
      if (client.isCurrent()) setLoading(false)
    }
  }, [api, client])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  const hasPermission = (role: string, module: string, action: string) => {
    return permissions.some(
      (p) => p.role === role && p.module === module && p.action === action
    )
  }

  const togglePermission = (role: string, module: string, action: string) => {
    const exists = hasPermission(role, module, action)
    if (exists) {
      setPermissions(
        permissions.filter(
          (p) =>
            !(p.role === role && p.module === module && p.action === action)
        )
      )
    } else {
      setPermissions([
        ...permissions,
        {
          id: `temp_${Date.now()}`,
          role,
          module,
          action,
        },
      ])
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveApi.save(permissions, selectedRole)

      toast.success('Permissões salvas com sucesso')
      fetchPermissions()
    } catch (error) {
      if (isAbortError(error) || !saveClient.isCurrent()) return
      console.error('Error saving permissions:', error)
      toast.error('Erro ao salvar permissões')
    } finally {
      if (saveClient.isCurrent()) setSaving(false)
    }
  }

  return {
    selectedRole,
    setSelectedRole,
    loading,
    saving,
    hasPermission,
    togglePermission,
    handleSave,
  }
}
