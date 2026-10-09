'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from '../../../entities/sessao'
import {
  usePublicTenantSlug,
  useTenantContext,
} from '../../../entities/organizacao'
import {
  createCustomerApi,
  type CustomerProfile,
} from '../../../entities/cliente'
import {
  useScopedApiClient,
  isAbortError,
  HttpError,
  useApiClientRevision,
} from '../../../shared/api'

import { toast } from '../../../shared/lib/toast'

export function useProfileScope() {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    status,
    revision,
  ])
}
export function useProfile() {
  const { data: session } = useSession()
  const client = useScopedApiClient(null)
  const api = useMemo(() => createCustomerApi(client), [client])
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    phone: '',
    cpf: '',
    cnpj: '',
    company: '',
  })

  // Estados de verificação (mockados por enquanto; integrar com backend quando disponível)
  const [emailStatus] = useState<'pending' | 'verified' | 'error'>('pending')
  const [phoneStatus] = useState<'pending' | 'verified' | 'error'>('pending')
  const [documentsStatus] = useState<'pending' | 'verified' | 'error'>(
    'pending'
  )
  const documentsErrorMessage =
    'Documento ilegível. Por favor, tente novamente.'

  // Função para formatar CNPJ
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }

  // Função para formatar CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handleInputChange = (e: {
    target: { name: string; value: string }
  }) => {
    const { name, value } = e.target
    let formattedValue = value

    // Formatação automática baseada no campo
    if (name === 'cpf') {
      formattedValue = formatCPF(value)
    } else if (name === 'cnpj') {
      formattedValue = formatCNPJ(value)
    } else if (name === 'phone') {
      formattedValue = formatPhone(value)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }))
  }

  const mergeProfile = (profile: CustomerProfile) => {
    setFormData((prev) => ({
      ...prev,
      phone: profile.phone ? formatPhone(profile.phone) : prev.phone,
      cnpj: profile.cnpj ? formatCNPJ(profile.cnpj) : prev.cnpj,
      cpf: profile.cpf ? formatCPF(profile.cpf) : prev.cpf,
      company: profile.company || prev.company,
    }))
  }

  // Carregar o perfil do escopo atual; respostas antigas são descartadas pelo cliente.
  useEffect(() => {
    if (!session?.user?.id) return
    void api
      .profile()
      .then((data) => {
        if (data.user) mergeProfile(data.user)
      })
      .catch((error) => {
        if (!isAbortError(error) && !(error instanceof HttpError))
          console.error('Erro ao carregar perfil:', error)
      })
  }, [session?.user?.id, api])

  const handleSave = async () => {
    try {
      const updateData: {
        phone?: string
        cpf?: string
        cnpj?: string
        company?: string
      } = {}
      if (formData.phone?.trim()) updateData.phone = formData.phone
      if (formData.cpf?.trim()) updateData.cpf = formData.cpf
      if (formData.cnpj?.trim()) updateData.cnpj = formData.cnpj
      if (formData.company?.trim()) updateData.company = formData.company.trim()

      await api.updateProfile(updateData)
      toast.success('Perfil atualizado com sucesso!')
      setIsEditing(false)
      // A recusa HTTP desta releitura não desfaz o PUT já confirmado.
      try {
        const data = await api.profile()
        if (data.user) mergeProfile(data.user)
      } catch (error) {
        if (isAbortError(error)) return
        if (!(error instanceof HttpError)) throw error
      }
    } catch (error) {
      if (!isAbortError(error)) toast.error('Erro ao atualizar perfil')
    }
  }

  const handleCancel = async () => {
    const empty = {
      name: session?.user?.name || '',
      email: session?.user?.email || '',
      phone: '',
      cpf: '',
      cnpj: '',
      company: '',
    }
    if (session?.user?.id) {
      try {
        const { user } = await api.profile()
        setFormData(
          user
            ? {
                ...empty,
                phone: user.phone ? formatPhone(user.phone) : '',
                cpf: user.cpf ? formatCPF(user.cpf) : '',
                cnpj: user.cnpj ? formatCNPJ(user.cnpj) : '',
                company: user.company || '',
              }
            : empty
        )
      } catch (error) {
        if (isAbortError(error)) return
        setFormData(empty)
      }
    } else setFormData(empty)
    setIsEditing(false)
  }
  return {
    session,
    isEditing,
    setIsEditing,
    formData,
    emailStatus,
    phoneStatus,
    documentsStatus,
    documentsErrorMessage,
    handleInputChange,
    handleSave,
    handleCancel,
  }
}
