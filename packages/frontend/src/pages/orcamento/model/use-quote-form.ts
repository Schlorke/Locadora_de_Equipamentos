'use client'
import { z } from 'zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '../../../shared/lib/toast'
import {
  useIdentidadePublica,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useQuoteApi } from './quote-api'
import type { LeituraDoWhatsApp } from './whatsapp-da-locadora'
import {
  convertFormDataToWhatsApp,
  openWhatsAppQuote,
} from '../../../entities/orcamento'
export const QuoteFormSchema = z.object({
  // Etapa 1: Informações pessoais
  customerName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100),
  customerEmail: z.string().email('Digite um email válido'),
  customerPhone: z
    .string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(15),
  customerCompany: z.string().optional(),
  cep: z.string().optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),

  // Etapa 2: Equipamento e período
  equipmentName: z.string().optional(),
  equipmentId: z.string().optional(),
  rentalDays: z
    .number()
    .min(1, 'Período mínimo: 1 dia')
    .max(365, 'Período máximo: 365 dias'),

  // Etapa 3: Detalhes adicionais
  message: z.string().optional(),
  urgency: z.enum(['baixa', 'media', 'alta']),
})
export type QuoteFormData = z.infer<typeof QuoteFormSchema>
export interface QuoteFormProps {
  prefilledEquipment?: {
    id: string
    name: string
  }
  variant?: 'modal' | 'page' | 'inline'
  onSuccess?: (_data: QuoteFormData) => void
  onCancel?: () => void
  clearQuery?: () => void
}
export function useQuoteForm(
  {
    prefilledEquipment,
    variant = 'page',
    onSuccess,
    onCancel,
    clearQuery,
  }: QuoteFormProps,
  /** WhatsApp da própria locadora: lido ao montar (web) ou no clique (app nativo); ver whatsapp-da-locadora.ts. */
  lerWhatsApp: LeituraDoWhatsApp
) {
  const tenantSlug = usePublicTenantSlug()
  const api = useQuoteApi(tenantSlug)
  // WhatsApp e nome da própria locadora (achado 143): nunca o número ou a marca de outra. O nome vem da identidade
  // informada pelo host; o WhatsApp, de `lerWhatsApp` (web: já lido, e o clique abre sem esperar a rede).
  const nomeDaLocadora = useIdentidadePublica()?.nome ?? null
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 3
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }
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
  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 5) return numbers
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
  }
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
    trigger,
  } = useForm<QuoteFormData>({
    resolver: zodResolver(QuoteFormSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerCompany: '',
      cep: '',
      cpf: '',
      cnpj: '',
      equipmentName: prefilledEquipment?.name || '',
      equipmentId: prefilledEquipment?.id || '',
      rentalDays: 7,
      message: '',
      urgency: 'media',
    },
    mode: 'onChange',
  })
  const watchedData = watch()
  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep)
    const isStepValid = await trigger(fieldsToValidate)

    if (!isStepValid) {
      // Validação de TODOS os campos da etapa atual
      const currentData = watch()
      const missingFields: string[] = []

      if (currentStep === 1) {
        if (!currentData.customerName || !currentData.customerName.trim()) {
          missingFields.push('Nome Completo')
        }
        if (!currentData.customerEmail || !currentData.customerEmail.trim()) {
          missingFields.push('E-mail')
        }
        if (!currentData.customerPhone || !currentData.customerPhone.trim()) {
          missingFields.push('Telefone')
        }
      } else if (currentStep === 2) {
        if (!currentData.rentalDays || currentData.rentalDays < 1) {
          missingFields.push('Período de Locação')
        }
      }

      // Se há campos faltantes, mostrar toast informativa
      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(', ')
        toast.info('Campos Obrigatórios', {
          description: `Por favor, preencha os seguintes campos antes de continuar: ${fieldsList}.`,
          duration: 6000,
        })
      }
      return
    }

    if (isStepValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }
  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }
  const getFieldsForStep = (step: number): (keyof QuoteFormData)[] => {
    switch (step) {
      case 1:
        return ['customerName', 'customerEmail', 'customerPhone']
      case 2:
        return ['rentalDays']
      case 3:
        return []
      default:
        return []
    }
  }
  const onSubmit = async (data: QuoteFormData) => {
    // Validação de TODOS os campos obrigatórios
    const missingFields: string[] = []
    let targetStep = 1

    if (!data.customerName || !data.customerName.trim()) {
      missingFields.push('Nome Completo')
      targetStep = 1
    }

    if (!data.customerEmail || !data.customerEmail.trim()) {
      missingFields.push('E-mail')
      targetStep = 1
    }

    if (!data.customerPhone || !data.customerPhone.trim()) {
      missingFields.push('Telefone')
      targetStep = 1
    }

    if (!data.rentalDays || data.rentalDays < 1) {
      missingFields.push('Período de Locação')
      targetStep = 2
    }

    // Se há campos faltantes, mostrar toast informativa
    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(', ')
      toast.info('Campos Obrigatórios', {
        description: `Por favor, preencha os seguintes campos antes de enviar: ${fieldsList}.`,
        duration: 6000,
      })
      setCurrentStep(targetStep)
      return
    }

    try {
      const result = await api.submitLegacy({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerCompany: data.customerCompany || null,
        cpf: data.cpf || null,
        cnpj: data.cnpj || null,
        cep: data.cep || null,
        message: data.message || null,
        items: data.equipmentId
          ? [
              {
                equipmentId: data.equipmentId,
                quantity: 1,
                days: data.rentalDays,
              },
            ]
          : [],
        urgency: data.urgency,
      })

      if (result.success) {
        // Limpar query parameters da URL se houver
        clearQuery?.()

        toast.success('Orçamento Enviado com Sucesso! 🎉', {
          description:
            'Entraremos em contato em até 2 horas úteis. Você receberá uma cópia no seu email.',
          duration: 8000,
        })

        if (onSuccess) {
          onSuccess(data)
        }

        // Reset form
        setCurrentStep(1)
      } else {
        throw new Error(result.message || 'Erro ao enviar orçamento')
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Erro ao enviar orçamento:', error)
      toast.error('Erro ao Enviar', {
        description:
          error instanceof Error
            ? error.message
            : 'Tente novamente em alguns instantes.',
      })
    } finally {
      // fim envio (estado visual removido)
    }
  }
  const handleWhatsAppSubmit = async () => {
    const data = watchedData

    // Validação de TODOS os campos obrigatórios
    const missingFields: string[] = []
    let targetStep = 1

    if (!data.customerName || !data.customerName.trim()) {
      missingFields.push('Nome Completo')
      targetStep = 1
    }

    if (!data.customerEmail || !data.customerEmail.trim()) {
      missingFields.push('E-mail')
      targetStep = 1
    }

    if (!data.customerPhone || !data.customerPhone.trim()) {
      missingFields.push('Telefone')
      targetStep = 1
    }

    if (!data.rentalDays || data.rentalDays < 1) {
      missingFields.push('Período de Locação')
      targetStep = 2
    }

    // Se há campos faltantes, mostrar toast informativa
    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(', ')
      toast.info('Campos Obrigatórios', {
        description: `Por favor, preencha os seguintes campos antes de enviar: ${fieldsList}.`,
        duration: 6000,
      })
      setCurrentStep(targetStep)
      return
    }

    // Número já em mãos (web): nenhum `await` antes da abertura, que acontece ainda dentro do clique.
    const leitura = lerWhatsApp()
    if (leitura === null) {
      toast.info('Carregando o contato da locadora', {
        description: 'Tente de novo em instantes.',
      })
      return
    }
    const whatsapp = typeof leitura === 'string' ? leitura : await leitura
    if (!whatsapp) {
      toast.error('WhatsApp indisponível', {
        description:
          'Esta locadora ainda não informou o WhatsApp. Envie a solicitação pelo formulário.',
      })
      return
    }

    try {
      // Converter dados para formato WhatsApp
      const whatsappData = convertFormDataToWhatsApp(
        {
          name: data.customerName,
          phone: data.customerPhone,
          email: data.customerEmail,
          message: data.message || undefined,
        },
        data.equipmentId && data.equipmentName
          ? [
              {
                name: data.equipmentName,
                quantity: 1,
                days: data.rentalDays,
                pricePerDay: 0, // Será calculado pelo sistema
                finalPrice: 0, // Será calculado pelo sistema
                id: data.equipmentId,
              },
            ]
          : [],
        // Origem do site no navegador; no app nativo não há site (a mensagem vai sem link).
        (globalThis as { location?: { origin?: string } }).location?.origin ??
          '',
        nomeDaLocadora
      )

      // Abrir WhatsApp da locadora com mensagem formatada
      openWhatsAppQuote(whatsappData, whatsapp)

      toast.success('Orçamento Preparado! 📱', {
        description: 'WhatsApp aberto com sua solicitação formatada.',
      })
    } catch (error) {
      console.error('Erro ao preparar mensagem WhatsApp:', error)
      toast.error('Erro', {
        description: 'Erro ao preparar mensagem para WhatsApp.',
      })
    }
  }
  const stepTitles = ['Seus Dados', 'Equipamento & Período', 'Detalhes Finais']
  return {
    currentStep,
    totalSteps,
    formatCPF,
    formatCNPJ,
    formatCEP,
    control,
    handleSubmit,
    errors,
    isValid,
    setValue,
    watchedData,
    nextStep,
    previousStep,
    onSubmit,
    handleWhatsAppSubmit,
    stepTitles,
    variant,
    onCancel,
  }
}
