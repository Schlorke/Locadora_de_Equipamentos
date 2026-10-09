'use client'
import { useEffect, useRef, useState } from 'react'
import { useApiClient } from '../../../shared/api'
import { usePublicTenantSlug } from '../../../entities/organizacao'
import { toast } from '../../../shared/lib/toast'
export interface ContactFormData {
  name: string
  email: string
  phone: string
  company: string
  equipment: string
  cpf: string
  cnpj: string
  message: string
}
const emptyForm: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  equipment: '',
  cpf: '',
  cnpj: '',
  message: '',
}
export function formatPhone(raw: string): string {
  const value = raw.replace(/\D/g, '')
  let formatted = value
  if (value.length > 0) {
    formatted = `(${value.substring(0, 2)}`
    if (value.length > 2) {
      formatted += `) ${value.substring(2, 7)}`
    }
    if (value.length > 7) {
      formatted += `-${value.substring(7, 11)}`
    }
  }
  return formatted
}

export function formatCPF(raw: string): string {
  const value = raw.replace(/\D/g, '')
  let formatted = value
  if (value.length > 0) {
    formatted = value.substring(0, 3)
    if (value.length > 3) {
      formatted += `.${value.substring(3, 6)}`
    }
    if (value.length > 6) {
      formatted += `.${value.substring(6, 9)}`
    }
    if (value.length > 9) {
      formatted += `-${value.substring(9, 11)}`
    }
  }
  return formatted
}

export function formatCNPJ(raw: string): string {
  const value = raw.replace(/\D/g, '')
  let formatted = value
  if (value.length > 0) {
    formatted = value.substring(0, 2)
    if (value.length > 2) {
      formatted += `.${value.substring(2, 5)}`
    }
    if (value.length > 5) {
      formatted += `.${value.substring(5, 8)}`
    }
    if (value.length > 8) {
      formatted += `/${value.substring(8, 12)}`
    }
    if (value.length > 12) {
      formatted += `-${value.substring(12, 14)}`
    }
  }
  return formatted
}

export function useContactForm() {
  const api = useApiClient(),
    tenantSlug = usePublicTenantSlug()
  const [formData, setFormData] = useState<ContactFormData>(emptyForm),
    [isSubmitting, setIsSubmitting] = useState(false)
  const requestVersion = useRef(0),
    busy = useRef(false)
  useEffect(() => {
    requestVersion.current++
    busy.current = false
    setIsSubmitting(false)
    setFormData(emptyForm)
  }, [tenantSlug])
  const handleSubmit = async () => {
    if (busy.current) return
    if (!tenantSlug) {
      toast.error('Selecione uma locadora para enviar sua solicitação.')
      return
    }
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.message.trim()
    ) {
      toast.error('Preencha nome, e-mail, telefone e mensagem.')
      return
    }
    if (!formData.cpf.trim() && !formData.cnpj.trim()) {
      toast.error('Informe pelo menos o CPF ou CNPJ.')
      return
    }
    const version = ++requestVersion.current
    busy.current = true
    setIsSubmitting(true)
    try {
      const result = await api.request<{
        success: boolean
        data?: { messageId: string; deliveryStatus: string }
        message?: string
      }>('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, tenantSlug }),
      })
      if (version !== requestVersion.current) return
      if (!result.success || !result.data?.messageId)
        throw new Error(
          result.message || 'Não foi possível registrar sua solicitação.'
        )
      setFormData(emptyForm)
      toast.success('Solicitação recebida', {
        description:
          result.data.deliveryStatus === 'queued'
            ? 'A solicitação foi registrada; as notificações estão na fila de envio.'
            : 'Sua solicitação foi registrada.',
        duration: 8000,
      })
    } catch (error) {
      if (version === requestVersion.current)
        toast.error('Erro', {
          description:
            error instanceof Error
              ? error.message
              : 'Erro ao enviar mensagem. Tente novamente.',
        })
    } finally {
      if (version === requestVersion.current) {
        busy.current = false
        setIsSubmitting(false)
      }
    }
  }
  return { formData, setFormData, isSubmitting, handleSubmit }
}
