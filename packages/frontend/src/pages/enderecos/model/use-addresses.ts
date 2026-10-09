'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from '../../../entities/sessao'
import {
  usePublicTenantSlug,
  useTenantContext,
} from '../../../entities/organizacao'
import {
  createCustomerApi,
  type CustomerAddress as Address,
} from '../../../entities/cliente'
import {
  useScopedApiClient,
  isAbortError,
  useApiClientRevision,
} from '../../../shared/api'

import { toast } from '../../../shared/lib/toast'
import { fetchAddressByCEP } from '../../../shared/lib/cep'

export function useAddressesScope() {
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
export function useAddresses() {
  const { data: session } = useSession()
  const client = useScopedApiClient(null)
  const api = useMemo(() => createCustomerApi(client), [client])
  const cepRevision = useRef(0)
  useEffect(
    () => () => {
      cepRevision.current++
    },
    []
  )
  const [addresses, setAddresses] = useState<Address[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
  })

  // Carregar endereços do usuário no cliente e escopo capturados.
  const loadAddresses = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const data = await api.addresses()
      setAddresses(data.addresses || [])
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Erro ao carregar endereços:', error)
      toast.error('Erro ao carregar endereços')
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, api])

  useEffect(() => {
    void loadAddresses()
  }, [loadAddresses])
  // Formatação de CEP
  const formatCEP = (val: string) => {
    if (!val) return ''
    const numbers = val.replace(/\D/g, '')
    if (numbers.length === 0) return ''
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }

  const handleInputChange = async (e: {
    target: { name: string; value: string }
  }) => {
    const { name, value } = e.target
    let formattedValue = value

    // Formatação especial para CEP
    if (name === 'zipCode') {
      formattedValue = formatCEP(value)
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }))

    // Buscar endereço quando CEP estiver completo
    if (name === 'zipCode') {
      const cleanCEP = formattedValue.replace(/\D/g, '')
      const revision = ++cepRevision.current
      if (cleanCEP.length === 8) {
        try {
          const addressData = await fetchAddressByCEP(formattedValue)
          if (
            addressData &&
            revision === cepRevision.current &&
            client.isCurrent()
          ) {
            setFormData((prev) => ({
              ...prev,
              zipCode: formattedValue,
              street: addressData.logradouro || prev.street,
              neighborhood: addressData.bairro || prev.neighborhood,
              city: addressData.localidade || prev.city,
              state: addressData.uf || prev.state,
              complement: addressData.complemento || prev.complement,
            }))
          }
        } catch (error) {
          console.error('Erro ao buscar CEP:', error)
        }
      }
    }
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!session?.user?.id) {
      toast.error('Você precisa estar logado para salvar endereços')
      return
    }
    setIsSubmitting(true)
    try {
      const input = {
        street: formData.street,
        number: formData.number,
        complement: formData.complement || null,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode.replace(/\D/g, ''),
      }
      if (editingId) {
        await api.updateAddress(editingId, input)
        toast.success('Endereço atualizado com sucesso!')
        setEditingId(null)
      } else {
        await api.createAddress({ ...input, isPrimary: addresses.length === 0 })
        toast.success('Endereço adicionado com sucesso!')
      }
      setIsAdding(false)
      cepRevision.current++
      await loadAddresses()
      setFormData({
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
      })
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Erro ao salvar endereço:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao salvar endereço'
      )
    } finally {
      setIsSubmitting(false)
    }
  }
  const handleEdit = (address: Address) => {
    cepRevision.current++
    setFormData({
      street: address.street,
      number: address.number,
      complement: address.complement || '',
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: formatCEP(address.zipCode), // Formata o CEP ao carregar para edição
    })
    setEditingId(address.id)
    setIsAdding(true)
  }

  const handleDelete = async (id: string) => {
    if (!session?.user?.id) {
      toast.error('Você precisa estar logado para remover endereços')
      return
    }
    setIsDeleting(id)
    try {
      await api.deleteAddress(id)
      toast.success('Endereço removido com sucesso!')
      await loadAddresses()
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Erro ao deletar endereço:', error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao remover endereço'
      )
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSetPrimary = async (id: string) => {
    if (!session?.user?.id) {
      toast.error('Você precisa estar logado para definir endereço principal')
      return
    }
    try {
      await api.updateAddress(id, { isPrimary: true })
      toast.success('Endereço definido como principal!')
      await loadAddresses()
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Erro ao definir endereço principal:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao definir endereço principal'
      )
    }
  }
  const handleCancel = () => {
    cepRevision.current++
    setFormData({
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
    })
    setIsAdding(false)
    setEditingId(null)
  }

  const canSubmit = [
    formData.street,
    formData.number,
    formData.neighborhood,
    formData.city,
    formData.state,
    formData.zipCode,
  ].every((value) => value.trim() !== '')

  return {
    session,
    addresses,
    isAdding,
    setIsAdding,
    editingId,
    isLoading,
    isSubmitting,
    isDeleting,
    formData,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleSetPrimary,
    handleCancel,
    loadAddresses,
    canSubmit,
    formatCEP,
  }
}
