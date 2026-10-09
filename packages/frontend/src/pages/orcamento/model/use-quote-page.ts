'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDocumentoLegal } from '../../../entities/documento-legal'
import { termosDoOrcamento } from './termos-do-orcamento'
import { toast } from '../../../shared/lib/toast'
import { useSession } from '../../../entities/sessao'
import {
  usePublicTenantSlug,
  useTenantContext,
} from '../../../entities/organizacao'
import { useApiClientRevision } from '../../../shared/api'
import { useQuoteApi } from './quote-api'
import { useCartStore, type CartItem } from '../../../features/carrinho'
import type { AddressData } from '@gb-locacoes/ui'
import type { CustomerAddress as Address } from '../../../entities/cliente'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getAutoRentalDateRange } from '../../../entities/locacao'
import { sanitizeCartItemPricing } from '../../../entities/equipamento'
import {
  validateCPF,
  validateCNPJ,
  buildQuotePricing,
  calculateFreight,
  type FreightOption,
  QUOTE_ADDRESS_REQUIRED,
  QUOTE_CNPJ_INVALID,
  QUOTE_COMPANY_REQUIRED,
  QUOTE_CPF_INVALID,
  QUOTE_DELIVERY_TYPE_REQUIRED,
  QUOTE_DOCUMENT_REQUIRED,
  QUOTE_PERIOD_REQUIRED,
  QUOTE_UNAVAILABLE,
  assessQuoteSubmit,
  collectNewCustomerInfo,
  findItemNeedingWeekendConfirmation,
  isAddressComplete,
  isAddressDifferent,
  listMissingQuoteFields,
  missingAddressFieldsMessage,
  missingQuoteFieldsMessage,
  weekendConfirmationMessage,
} from '../../../entities/orcamento'
import type {
  Equipment,
  QuoteFormData,
  QuotePagePorts,
  QuoteSubmitEvent,
} from './quote-page-contract'
export function useQuotePageScope() {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return JSON.stringify([
    slug,
    tenant?.tenant.id,
    tenant?.role,
    session?.user?.id,
    status,
    revision,
  ])
}
export function useQuotePage(ports: QuotePagePorts) {
  const searchParams = ports.query
  const { data: session } = useSession()
  const tenantSlug = usePublicTenantSlug()
  const api = useQuoteApi(tenantSlug)
  const preferenceKey = useCallback(
    (name: string) =>
      `${name}:${JSON.stringify([tenantSlug, session?.user?.id])}`,
    [tenantSlug, session?.user?.id]
  )
  const {
    items: selectedEquipments,
    removeItem,
    updateItemQuantity,
    updateItemDays,
    updateItemIncludeWeekends,
    hydrateItems,
    clearCart,
  } = useCartStore()
  const [displayedItems, setDisplayedItems] = useState<CartItem[]>([])
  const removalTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = removalTimers.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])
  useEffect(() => {
    setDisplayedItems(selectedEquipments)
  }, [selectedEquipments])
  const [formData, setFormData] = useState<QuoteFormData>({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    cnpj: '',
    cep: '',
    company: '',
    message: '',
    deliveryType: undefined,
    deliveryAddress: undefined,
  })
  useEffect(() => {
    if (session?.user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || session.user?.name || '',
        email: prev.email || session.user?.email || '',
      }))
    }
  }, [session])
  const hasLoadedProfile = useRef(false)
  const [savedUserProfile, setSavedUserProfile] = useState<{
    phone?: string
    cpf?: string
    cnpj?: string
    company?: string
  }>({})
  const loadUserProfile = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      const data = await api.profile()
      if (data.user) {
        // Salvar dados do perfil para comparação posterior
        setSavedUserProfile({
          phone: data.user.phone || undefined,
          cpf: data.user.cpf || undefined,
          cnpj: data.user.cnpj || undefined,
          company: data.user.company || undefined,
        })

        setFormData((prev) => {
          // Só preencher se o campo estiver vazio (não sobrescrever dados já digitados)
          const newData = { ...prev }

          if (!prev.phone && data.user.phone) {
            newData.phone = formatPhoneNumber(data.user.phone)
          }

          if (!prev.cpf && data.user.cpf) {
            newData.cpf = formatCPF(data.user.cpf)
          }

          if (!prev.cnpj && data.user.cnpj) {
            newData.cnpj = formatCNPJ(data.user.cnpj)
          }

          if (!prev.company && data.user.company) {
            newData.company = data.user.company
          }

          return newData
        })
        hasLoadedProfile.current = true
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error)
      // Não mostrar erro ao usuário, apenas logar
    }
  }, [session?.user?.id, api])
  const getNewCustomerInfoToSave = useCallback(() => {
    return collectNewCustomerInfo(formData, savedUserProfile)
  }, [formData, savedUserProfile])
  useEffect(() => {
    if (!hasLoadedProfile.current) {
      void loadUserProfile()
    }
  }, [loadUserProfile])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedQuote, setSubmittedQuote] = useState<{
    id: string
    email: string
  } | null>(null)
  const [freightOptions, setFreightOptions] = useState<FreightOption[]>([])
  const [selectedFreight, setSelectedFreight] = useState<string | null>(null)
  const [isCalculatingFreight, setIsCalculatingFreight] = useState(false)
  const [availabilityErrors, setAvailabilityErrors] = useState<
    Record<string, string>
  >({})
  const hasSyncedCartPricing = useRef(false)
  const requestReferenceDate = useRef(new Date())
  const [pendingWeekendConfirmation, setPendingWeekendConfirmation] = useState<{
    equipmentId: string
    equipmentName: string
  } | null>(null)
  const [pendingSubmitEvent, setPendingSubmitEvent] =
    useState<QuoteSubmitEvent | null>(null)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  // Termos da própria locadora (onda 134; D-C, parte 1): aceite só com Termos publicados; falha de leitura bloqueia.
  const termos = termosDoOrcamento(useDocumentoLegal('terms'))
  const [userAddresses, setUserAddresses] = useState<Address[]>([])
  const [saveAddressDialogOpen, setSaveAddressDialogOpen] = useState(false)
  const [confirmAddressDialogOpen, setConfirmAddressDialogOpen] =
    useState(false)
  const [selectAddressDialogOpen, setSelectAddressDialogOpen] = useState(false)
  const [selectedSavedAddress, setSelectedSavedAddress] =
    useState<Address | null>(null)
  const [saveCustomerInfoDialogOpen, setSaveCustomerInfoDialogOpen] =
    useState(false)
  const formatDate = useCallback((date: Date | string | undefined): string => {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) return ''
    return format(dateObj, 'dd/MM/yyyy', { locale: ptBR })
  }, [])
  const resolveDateRange = (equipment: CartItem) => {
    if (equipment.startDate && equipment.endDate) {
      const startDate =
        equipment.startDate instanceof Date
          ? equipment.startDate
          : new Date(equipment.startDate)
      const endDate =
        equipment.endDate instanceof Date
          ? equipment.endDate
          : new Date(equipment.endDate)

      return { startDate, endDate, isAuto: false }
    }

    const days = Number(equipment.days) || 1
    const includeWeekends = equipment.includeWeekends ?? false
    const { startDate, endDate } = getAutoRentalDateRange({
      requestDate: requestReferenceDate.current,
      days,
      includeWeekends,
    })

    return { startDate, endDate, isAuto: true }
  }
  const formatPhoneNumber = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '')

    // Aplica a formatação baseada no tamanho
    if (numbers.length <= 2) {
      return numbers
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
    }
  }
  const formatCPF = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '')

    // Aplica a formatação baseada no tamanho
    if (numbers.length <= 3) {
      return numbers
    } else if (numbers.length <= 6) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    } else if (numbers.length <= 9) {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    } else {
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
    }
  }
  const formatCNPJ = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '')

    // Aplica a formatação baseada no tamanho
    if (numbers.length <= 2) {
      return numbers
    } else if (numbers.length <= 5) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    } else if (numbers.length <= 8) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    } else if (numbers.length <= 12) {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    } else {
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
    }
  }
  const handlePhoneChange = (e: { target: { value: string } }) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData((prev) => ({
      ...prev,
      phone: formatted,
    }))
  }
  const handleCPFChange = (e: { target: { value: string } }) => {
    const formatted = formatCPF(e.target.value)
    setFormData((prev) => ({
      ...prev,
      cpf: formatted,
    }))
  }
  const handleCNPJChange = (e: { target: { value: string } }) => {
    const formatted = formatCNPJ(e.target.value)
    setFormData((prev) => ({
      ...prev,
      cnpj: formatted,
    }))
  }
  useEffect(() => {
    ports.scrollTop?.()
  }, [ports])
  const fetchEquipmentAndAdd = useCallback(
    async (equipmentId: string) => {
      try {
        const data = await api.equipments<Equipment>()
        const equipments = Array.isArray(data) ? data : []
        const equipment = equipments.find(
          (eq: Equipment) => eq.id === equipmentId
        )

        if (equipment) {
          const price = Number(equipment.pricePerDay) || 0
          const equipmentToAdd = sanitizeCartItemPricing({
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            pricePerDay: price,
            quantity: 1,
            days: 1,
            description: equipment.description,
            category: equipment.category,
            images: equipment.images,
            maxStock: equipment.maxStock || 1,
            // Descontos percentuais
            dailyDiscount: equipment.dailyDiscount || 0,
            weeklyDiscount: equipment.weeklyDiscount || 0,
            biweeklyDiscount: equipment.biweeklyDiscount || 0,
            monthlyDiscount: equipment.monthlyDiscount || 0,
            // Valores diretos
            dailyDirectValue: equipment.dailyDirectValue || 0,
            weeklyDirectValue: equipment.weeklyDirectValue || 0,
            biweeklyDirectValue: equipment.biweeklyDirectValue || 0,
            monthlyDirectValue: equipment.monthlyDirectValue || 0,
            // Flags de uso de valor direto
            dailyUseDirectValue: equipment.dailyUseDirectValue || false,
            weeklyUseDirectValue: equipment.weeklyUseDirectValue || false,
            biweeklyUseDirectValue: equipment.biweeklyUseDirectValue || false,
            monthlyUseDirectValue: equipment.monthlyUseDirectValue || false,
          })

          // Usar o store para adicionar o item
          useCartStore.getState().addItem(equipmentToAdd)
        }
      } catch {
        // Error handled silently for user experience
      }
    },
    [api]
  )
  useEffect(() => {
    const equipmentId = searchParams.get('equipmentId')
    if (equipmentId) {
      fetchEquipmentAndAdd(equipmentId)
    }
  }, [searchParams, fetchEquipmentAndAdd])
  useEffect(() => {
    if (hasSyncedCartPricing.current || selectedEquipments.length === 0) {
      return
    }

    hasSyncedCartPricing.current = true

    const syncCartPricing = async () => {
      try {
        const equipments = await api.equipments<Equipment>()
        if (!Array.isArray(equipments) || equipments.length === 0) {
          return
        }

        const equipmentMap = new Map<string, Equipment>(
          equipments.map((equipment) => [equipment.id, equipment])
        )

        const updatedItems = useCartStore.getState().items.map((item) => {
          const equipment = equipmentMap.get(item.equipmentId)
          if (!equipment) return sanitizeCartItemPricing(item)

          // Preservar dados críticos que já estão corretos no item (como valor direto e flags)
          // para evitar flash de valores incorretos durante a sincronização
          const sanitizedItem = sanitizeCartItemPricing({
            ...item,
            pricePerDay: Number(equipment.pricePerDay) || item.pricePerDay,
            // Priorizar valores do item atual se já estiverem configurados corretamente
            dailyDiscount: equipment.dailyDiscount ?? item.dailyDiscount ?? 0,
            weeklyDiscount:
              equipment.weeklyDiscount ?? item.weeklyDiscount ?? 0,
            biweeklyDiscount:
              equipment.biweeklyDiscount ?? item.biweeklyDiscount ?? 0,
            monthlyDiscount:
              equipment.monthlyDiscount ?? item.monthlyDiscount ?? 0,
            // Valores diretos: usar do equipamento (fonte de verdade), mas preservar se já estiver no item
            dailyDirectValue:
              Number(
                equipment.dailyDirectValue ?? item.dailyDirectValue ?? 0
              ) || 0,
            weeklyDirectValue:
              Number(
                equipment.weeklyDirectValue ?? item.weeklyDirectValue ?? 0
              ) || 0,
            biweeklyDirectValue:
              Number(
                equipment.biweeklyDirectValue ?? item.biweeklyDirectValue ?? 0
              ) || 0,
            monthlyDirectValue:
              Number(
                equipment.monthlyDirectValue ?? item.monthlyDirectValue ?? 0
              ) || 0,
            // Flags de uso de valor direto: priorizar equipamento (fonte de verdade)
            dailyUseDirectValue:
              equipment.dailyUseDirectValue ??
              item.dailyUseDirectValue ??
              false,
            weeklyUseDirectValue:
              equipment.weeklyUseDirectValue ??
              item.weeklyUseDirectValue ??
              false,
            biweeklyUseDirectValue:
              equipment.biweeklyUseDirectValue ??
              item.biweeklyUseDirectValue ??
              false,
            monthlyUseDirectValue:
              equipment.monthlyUseDirectValue ??
              item.monthlyUseDirectValue ??
              false,
          })

          return sanitizedItem
        })

        // Atualizar apenas se houver mudanças significativas para evitar re-renders desnecessários
        hydrateItems(updatedItems)
      } catch (error) {
        console.error('Failed to sync cart pricing', error)
      }
    }

    void syncCartPricing()
  }, [selectedEquipments, hydrateItems, api])
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return
    const item = selectedEquipments.find((eq) => eq.equipmentId === id)
    if (item) {
      const maxStock = item.maxStock || 999
      const limitedQuantity = Math.min(quantity, maxStock)
      updateItemQuantity(id, limitedQuantity)
    }
  }
  const updateDays = (id: string, days: number) => {
    if (days < 1) return
    updateItemDays(id, days)
  }
  const removeEquipment = (id: string) => {
    // Marca o item como removendo na lista exibida (inicia animação)
    setDisplayedItems((prev) =>
      prev.map((item) =>
        item.equipmentId === id ? { ...item, isRemoving: true } : item
      )
    )

    // Remove do store e da lista exibida após a animação completar
    const timer = setTimeout(() => {
      removalTimers.current.delete(timer)
      removeItem(id)
      setDisplayedItems((prev) =>
        prev.filter((item) => item.equipmentId !== id)
      )
    }, 300) // Duração da animação de fade out (sincronizada com container)
    removalTimers.current.add(timer)
  }
  const calculateSubtotal = (equipment: CartItem) => {
    const quantity = Number(equipment.quantity) || 1
    const days = Number(equipment.days) || 1

    // Total do item pela mesma função que grava o orçamento (Decimal, centavos ROUND_HALF_UP):
    // o subtotal mostrado é o valor cobrado, sem o erro do float × quantidade.
    return buildQuotePricing(equipment, days, quantity).total
  }
  const calculateTotal = () => {
    const equipmentTotal = selectedEquipments.reduce(
      (total, eq) => total + calculateSubtotal(eq),
      0
    )
    const freightTotal =
      selectedFreight && freightOptions.length > 0
        ? freightOptions.find((opt) => opt.id === selectedFreight)?.price || 0
        : 0
    return equipmentTotal + freightTotal
  }
  useEffect(() => {
    const calculateFreightAsync = async () => {
      if (
        formData.deliveryType === 'DELIVERY' &&
        formData.deliveryAddress?.cep &&
        selectedEquipments.length > 0
      ) {
        setIsCalculatingFreight(true)
        try {
          // CEP de origem fixo do frete (pendente: deveria vir da configuração da locadora)
          const fromCEP = '90000-000' // CEP padrão da empresa
          const result = await calculateFreight({
            fromCEP,
            toCEP: formData.deliveryAddress.cep,
            equipmentIds: selectedEquipments.map((eq) => eq.equipmentId),
            quantities: selectedEquipments.map((eq) => eq.quantity),
          })
          setFreightOptions(result.shippingOptions)
          if (result.shippingOptions.length > 0 && !selectedFreight) {
            setSelectedFreight(result.shippingOptions[0]!.id)
          }
        } catch (error) {
          console.error('Erro ao calcular frete:', error)
          toast.error('Erro ao calcular frete')
        } finally {
          setIsCalculatingFreight(false)
        }
      } else {
        setFreightOptions([])
        setSelectedFreight(null)
      }
    }

    void calculateFreightAsync()
  }, [
    formData.deliveryType,
    formData.deliveryAddress?.cep,
    selectedEquipments,
    selectedFreight,
  ])
  useEffect(() => {
    const validateAvailability = async () => {
      if (selectedEquipments.length > 0) {
        const errors: Record<string, string> = {}

        for (const equipment of selectedEquipments) {
          // Só validar se o equipamento tiver datas definidas
          if (!equipment.startDate || !equipment.endDate) {
            continue
          }

          try {
            const data = await api.availability(
              equipment.equipmentId,
              new Date(equipment.startDate).toISOString(),
              new Date(equipment.endDate).toISOString()
            )
            const availability = data.availability

            if (!availability || typeof availability !== 'object') {
              // Se não houver dados de disponibilidade, não bloquear
              continue
            }

            // Verificar disponibilidade para cada dia do período
            const startDate =
              equipment.startDate instanceof Date
                ? equipment.startDate
                : new Date(equipment.startDate)
            const endDate =
              equipment.endDate instanceof Date
                ? equipment.endDate
                : new Date(equipment.endDate)
            const currentDate = new Date(startDate)
            let minAvailable = Infinity
            let hasUnavailableDay = false

            while (currentDate <= endDate) {
              const dateKey = currentDate.toISOString().split('T')[0]!
              const dayAvailability = availability[dateKey]

              if (!dayAvailability || !dayAvailability.available) {
                hasUnavailableDay = true
                const dateStr = currentDate.toLocaleDateString('pt-BR')
                errors[equipment.equipmentId] =
                  `Equipamento indisponível em ${dateStr}`
                break
              }

              if (dayAvailability.availableQuantity < equipment.quantity) {
                minAvailable = Math.min(
                  minAvailable,
                  dayAvailability.availableQuantity
                )
              }

              currentDate.setDate(currentDate.getDate() + 1)
            }

            if (
              !hasUnavailableDay &&
              minAvailable < equipment.quantity &&
              minAvailable !== Infinity
            ) {
              errors[equipment.equipmentId] =
                `Apenas ${minAvailable} unidade(s) disponível(is) em algumas datas do período. Solicitado: ${equipment.quantity}`
            }
          } catch (error) {
            console.error(
              `Erro ao verificar disponibilidade de ${equipment.equipmentId}:`,
              error
            )
          }
        }

        setAvailabilityErrors(errors)
      } else {
        setAvailabilityErrors({})
      }
    }

    void validateAvailability()
  }, [selectedEquipments, api])
  const isAddressConfirmationDismissed = useMemo(() => {
    if (!session?.user?.id) return false
    return (
      ports.preferences.getItem(
        preferenceKey('addressConfirmationDismissed')
      ) === 'true'
    )
  }, [session?.user?.id, ports.preferences, preferenceKey])
  const loadUserAddresses = useCallback(async (): Promise<Address[]> => {
    if (!session?.user?.id) return []
    try {
      const data = await api.addresses()
      const addresses = data.addresses || []
      setUserAddresses(addresses)
      return addresses
    } catch (error) {
      console.error('Erro ao carregar endereços:', error)
    }
    return []
  }, [session?.user?.id, api])
  const loadPrimaryAddress = useCallback(async () => {
    if (!session?.user?.id) return null

    try {
      const data = await api.addresses()
      const addresses = data.addresses || []

      if (addresses.length === 0) {
        return null
      }

      // Buscar endereço principal (prioridade)
      const primaryAddress = addresses.find((addr: Address) => addr.isPrimary)

      // Se não houver principal, usar o primeiro endereço
      const addressToUse = primaryAddress || addresses[0]

      if (addressToUse) {
        // Formatar CEP
        const formatCEP = (cep: string) => {
          const numbers = cep.replace(/\D/g, '')
          if (numbers.length <= 5) return numbers
          return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
        }

        // Converter endereço do banco para formato do formulário
        const formattedAddress: AddressData = {
          cep: formatCEP(addressToUse.zipCode),
          logradouro: addressToUse.street,
          numero: addressToUse.number,
          complemento: addressToUse.complement || '',
          bairro: addressToUse.neighborhood,
          cidade: addressToUse.city,
          estado: addressToUse.state,
        }

        return formattedAddress
      }
    } catch (error) {
      console.error('Erro ao buscar endereço principal:', error)
    }

    return null
  }, [session?.user?.id, api])
  const handleDeliveryTypeChange = useCallback(
    async (value: 'DELIVERY' | 'PICKUP') => {
      if (value === 'PICKUP') {
        // Se for PICKUP, limpar endereço
        setFormData((prev) => ({
          ...prev,
          deliveryType: value,
          deliveryAddress: undefined,
        }))
        return
      }

      // Se for DELIVERY, tentar carregar endereço principal
      if (value === 'DELIVERY') {
        const primaryAddress = await loadPrimaryAddress()

        setFormData((prev) => ({
          ...prev,
          deliveryType: value,
          // Se encontrou endereço principal, usar ele. Caso contrário, manter o que já existe
          deliveryAddress: primaryAddress || prev.deliveryAddress,
        }))
      }
    },
    [loadPrimaryAddress]
  )
  const submitQuote = useCallback(async () => {
    setIsSubmitting(true)

    try {
      const quoteData = await api.submit(formData, selectedEquipments)
      // Capturar dados para Google Customer Reviews antes de limpar form
      try {
        if (quoteData?.id) {
          setSubmittedQuote({ id: quoteData.id, email: formData.email })
        }
      } catch {
        // Não bloquear fluxo se falhar
      }

      ports.clearQuery?.()

      toast.success('Orçamento Enviado com Sucesso! 🎉', {
        description:
          'Entraremos em contato em até 2 horas úteis. Você receberá uma cópia no seu email.',
        duration: 8000,
      })
      clearCart()
      setFormData({
        name: '',
        email: '',
        phone: '',
        cpf: '',
        cnpj: '',
        cep: '',
        company: '',
        message: '',
        deliveryType: undefined,
        deliveryAddress: undefined,
      })
      setFreightOptions([])
      setSelectedFreight(null)
      setAvailabilityErrors({})
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Erro ao enviar orçamento:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Erro ao enviar orçamento. Tente novamente.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, selectedEquipments, clearCart, api, ports])
  const handleSubmit = async (e: QuoteSubmitEvent) => {
    e.preventDefault()

    // Validação de TODOS os campos obrigatórios (validação dupla para segurança)
    const { labels: missingFields, ids: fieldIds } =
      listMissingQuoteFields(formData)

    // Se há campos faltantes, mostrar toast informativa
    if (missingFields.length > 0) {
      toast.info('Campos Obrigatórios', {
        description: missingQuoteFieldsMessage(missingFields),
        duration: 6000,
      })

      // Focar no primeiro campo faltante
      if (fieldIds.length > 0) {
        ports.focusField?.(fieldIds[0]!)
      }
      return
    }

    if (termos.bloqueio) {
      toast.error('Termos de Uso indisponíveis', {
        description: termos.bloqueio,
        duration: 6000,
      })
      return
    }

    if (termos.exigeAceite && !hasAcceptedTerms) {
      toast.info('Aceite dos Termos', {
        description:
          'Para continuar, leia e aceite os Termos de Uso antes de enviar a solicitação.',
        duration: 6000,
      })

      ports.focusField?.('terms-accept')
      return
    }

    const submitIssue = assessQuoteSubmit(formData, selectedEquipments, {
      cpf: validateCPF,
      cnpj: validateCNPJ,
    })
    if (submitIssue) {
      switch (submitIssue.kind) {
        case 'document-missing':
          toast.error('Erro de Validação', {
            description: QUOTE_DOCUMENT_REQUIRED,
          })
          return
        case 'cpf-invalid':
          toast.error('Erro de Validação', { description: QUOTE_CPF_INVALID })
          return
        case 'cnpj-invalid':
          toast.error('Erro de Validação', { description: QUOTE_CNPJ_INVALID })
          return
        case 'company-required':
          toast.error('Erro de Validação', {
            description: QUOTE_COMPANY_REQUIRED,
          })
          return
        case 'period-missing':
          toast.error('Erro de Validação', {
            description: QUOTE_PERIOD_REQUIRED,
          })
          return
        case 'delivery-type': {
          toast.info('Tipo de Entrega Obrigatório', {
            description: QUOTE_DELIVERY_TYPE_REQUIRED,
            duration: 6000,
          })
          ports.focusField?.('delivery-type')
          return
        }
        case 'address-missing': {
          toast.info('Endereço Obrigatório', {
            description: QUOTE_ADDRESS_REQUIRED,
            duration: 6000,
          })
          ports.focusField?.('cep')
          return
        }
        case 'address-fields': {
          toast.info('Campos de Endereço Obrigatórios', {
            description: missingAddressFieldsMessage(submitIssue.labels),
            duration: 6000,
          })
          if (submitIssue.ids.length > 0) {
            ports.focusField?.(submitIssue.ids[0]!)
          }
          return
        }
        default: {
          const _exhaustive: never = submitIssue
          return _exhaustive
        }
      }
    }

    // Validação: Verificar disponibilidade se houver erros
    if (Object.keys(availabilityErrors).length > 0) {
      toast.error('Erro de Disponibilidade', {
        description: QUOTE_UNAVAILABLE,
      })
      return
    }

    // Validação: Verificar se há equipamentos sem datas selecionadas
    // Isso acontece quando o usuário não usou o calendário na página de detalhes
    // Se não há datas e a preferência de finais de semana não foi confirmada,
    // devemos confirmar antes de enviar
    const firstItem = findItemNeedingWeekendConfirmation(selectedEquipments)

    if (firstItem) {
      // Mostrar toast informativo e então abrir dialog de confirmação
      toast.info('Confirmação Necessária', {
        description: weekendConfirmationMessage(firstItem.equipmentName),
        duration: 4000,
      })

      // Guardar o evento de submit para continuar depois da confirmação
      setPendingSubmitEvent(e)
      setPendingWeekendConfirmation({
        equipmentId: firstItem.equipmentId,
        equipmentName: firstItem.equipmentName,
      })
      return
    }

    // NOVA LÓGICA: Verificar condições para dialogs de endereço
    if (session?.user?.id && formData.deliveryType === 'DELIVERY') {
      const loadedAddresses = await loadUserAddresses()

      // Verificar se o endereço está completo
      const hasCompleteAddress =
        formData.deliveryAddress && isAddressComplete(formData.deliveryAddress)

      // Verificar se o endereço é novo (não existe nos salvos)
      let isAddressNew = false
      if (hasCompleteAddress) {
        isAddressNew =
          loadedAddresses.length === 0 ||
          !loadedAddresses.some(
            (savedAddress) =>
              !isAddressDifferent(formData.deliveryAddress!, savedAddress)
          )
      }

      // Verificar se há informações de cliente que são novas
      const newCustomerInfo = getNewCustomerInfoToSave()
      const hasNewCustomerInfo = Object.keys(newCustomerInfo).length > 0

      // Só exibir dialog se houver endereço novo OU informações de cliente novas
      if (hasCompleteAddress && (isAddressNew || hasNewCustomerInfo)) {
        // Verificar se ainda não temos endereços salvos
        if (loadedAddresses.length === 0) {
          setSaveAddressDialogOpen(true)
          return // Não enviar ainda, aguardar decisão do usuário
        }

        // Se tem endereços salvos mas o atual é diferente, oferecer salvar o novo
        if (isAddressNew) {
          setSaveAddressDialogOpen(true)
          return // Não enviar ainda, aguardar decisão do usuário
        }
      }

      // Se endereço é igual a algum salvo e não há info nova, continuar sem dialog
      if (hasCompleteAddress && !isAddressNew && !hasNewCustomerInfo) {
        await submitQuote()
        return
      }

      // Se tem endereços e confirmação não foi dispensada: dialog de confirmação
      // Só exibir se o endereço do formulário for diferente do salvo
      if (loadedAddresses.length === 1 && !isAddressConfirmationDismissed) {
        const savedAddress = loadedAddresses[0]!

        // Se o endereço foi preenchido manualmente, verificar se é diferente do salvo
        if (formData.deliveryAddress) {
          // Se os dados são iguais, não exibir dialog
          if (!isAddressDifferent(formData.deliveryAddress, savedAddress)) {
            // Endereços são iguais, continuar com envio sem dialog
            await submitQuote()
            return
          }
          // Endereços são diferentes, não exibir dialog de confirmação
          // (usuário já preencheu manualmente um endereço diferente)
          await submitQuote()
          return
        }

        // Se não foi preenchido manualmente, exibir dialog de confirmação
        setSelectedSavedAddress(savedAddress)
        setConfirmAddressDialogOpen(true)
        return
      }

      // Se tem múltiplos endereços: dialog de seleção
      if (loadedAddresses.length >= 2 && !formData.deliveryAddress) {
        setSelectAddressDialogOpen(true)
        return
      }
    }

    // NOVA LÓGICA: Verificar condições para dialog de salvamento de informações do cliente
    // Só exibir se houver informações NOVAS que não estão salvas no banco
    if (session?.user?.id) {
      const newCustomerInfo = getNewCustomerInfoToSave()
      const hasNewCustomerInfo = Object.keys(newCustomerInfo).length > 0

      if (hasNewCustomerInfo) {
        // Verificar se já foi dispensado para este usuário
        const customerInfoDismissed = ports.preferences.getItem(
          preferenceKey('customerInfoDismissed')
        )

        if (!customerInfoDismissed) {
          setSaveCustomerInfoDialogOpen(true)
          return // Não enviar ainda, aguardar decisão do usuário
        }
      }
    }

    // Se chegou aqui, prosseguir com envio normal
    await submitQuote()
  }
  const latestSubmit = useRef<typeof handleSubmit | null>(null)
  // Sincroniza a continuação após cada commit, com os dados daquele render.
  useEffect(() => {
    latestSubmit.current = handleSubmit
    return () => {
      latestSubmit.current = null
    }
  })
  const handleWeekendConfirmation = async (includeWeekends: boolean) => {
    if (!pendingWeekendConfirmation) return

    const equipmentId = pendingWeekendConfirmation.equipmentId
    const submitEvent = pendingSubmitEvent

    // Atualizar o item no carrinho com a escolha do usuário
    updateItemIncludeWeekends(equipmentId, includeWeekends)

    // Limpar estado de confirmação pendente
    setPendingWeekendConfirmation(null)
    setPendingSubmitEvent(null)

    // Se havia um submit pendente, tentar novamente após um pequeno delay
    // para garantir que o estado do carrinho foi atualizado
    if (submitEvent) {
      // Aguardar um frame para garantir que o estado foi atualizado
      await new Promise<void>((resolve) => setTimeout(resolve, 150))
      // Criar um novo evento simulado para evitar problemas de recursão
      // Usa o carrinho do render atual e não continua se a tela/escopo saiu.
      void latestSubmit.current?.({ preventDefault: () => {} })
    }
  }
  const handleWeekendConfirmationCancel = () => {
    setPendingWeekendConfirmation(null)
    setPendingSubmitEvent(null)
    toast.info('Confirmação cancelada', {
      description:
        'Por favor, confirme se deseja incluir finais de semana antes de enviar a solicitação.',
    })
  }
  const handleSaveAddress = async () => {
    if (!formData.deliveryAddress || !session?.user?.id) {
      toast.error('Dados incompletos para salvar')
      return
    }

    try {
      const promises: Promise<unknown>[] = []
      const savedItems: string[] = []

      // Verificar se o endereço é novo e precisa ser salvo
      const isAddressNew =
        userAddresses.length === 0 ||
        !userAddresses.some(
          (savedAddress) =>
            !isAddressDifferent(formData.deliveryAddress!, savedAddress)
        )

      if (isAddressNew) {
        const addressData = {
          street: formData.deliveryAddress.logradouro,
          number: formData.deliveryAddress.numero,
          complement: formData.deliveryAddress.complemento || null,
          neighborhood: formData.deliveryAddress.bairro,
          city: formData.deliveryAddress.cidade,
          state: formData.deliveryAddress.estado,
          zipCode: formData.deliveryAddress.cep.replace(/\D/g, ''),
          isPrimary: userAddresses.length === 0, // Primeiro endereço é principal
        }

        promises.push(api.saveAddress(addressData))
        savedItems.push('endereço')
      }

      // Verificar se há informações de cliente novas para salvar
      const newCustomerInfo = getNewCustomerInfoToSave()
      if (Object.keys(newCustomerInfo).length > 0) {
        promises.push(api.saveProfile(newCustomerInfo))
        savedItems.push('informações do cliente')
      }

      // Se não há nada para salvar, continuar sem salvar
      if (promises.length === 0) {
        setSaveAddressDialogOpen(false)
        await submitQuote()
        return
      }

      // Manter os resultados parciais: falha de uma gravação não descarta a outra.
      const responses = await Promise.allSettled(promises)
      if (
        responses.some(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof Error &&
            result.reason.name === 'AbortError'
        )
      )
        return

      // Processar cada resposta
      const results: { success: boolean; item: string; error?: string }[] = []
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i]!
        const item = savedItems[i]!

        if (response.status === 'fulfilled') {
          results.push({ success: true, item })
        } else {
          results.push({
            success: false,
            item,
            error:
              response.reason instanceof Error
                ? response.reason.message
                : 'Erro desconhecido',
          })
        }
      }

      // Verificar resultados
      const allSuccessful = results.every((r) => r.success)
      const failedItems = results.filter((r) => !r.success)

      if (allSuccessful) {
        const message =
          savedItems.length > 1
            ? 'Informações salvas com sucesso!'
            : `${savedItems[0]?.charAt(0).toUpperCase()}${savedItems[0]?.slice(1)} salvo com sucesso!`
        toast.success(message)

        // Recarregar dados atualizados
        if (isAddressNew) {
          await loadUserAddresses()
        }
        if (Object.keys(newCustomerInfo).length > 0) {
          hasLoadedProfile.current = false
          await loadUserProfile()
        }

        setSaveAddressDialogOpen(false)
        // Continuar com envio do orçamento
        await submitQuote()
      } else {
        // Mostrar erros para os itens que falharam
        for (const failed of failedItems) {
          toast.error(`Erro ao salvar ${failed.item}`, {
            description: failed.error || 'Tente novamente.',
          })
        }

        // Se pelo menos algum item foi salvo com sucesso, ainda podemos continuar
        const successfulItems = results.filter((r) => r.success)
        if (successfulItems.length > 0) {
          // Recarregar dados que foram salvos
          if (
            isAddressNew &&
            results.find((r) => r.item === 'endereço' && r.success)
          ) {
            await loadUserAddresses()
          }
          if (
            results.find(
              (r) => r.item === 'informações do cliente' && r.success
            )
          ) {
            hasLoadedProfile.current = false
            await loadUserProfile()
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar informações', {
        description:
          error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }
  const handleSkipSaveAddress = () => {
    setSaveAddressDialogOpen(false)
    // Continuar com envio do orçamento sem salvar
    void submitQuote()
  }
  const handleSaveCustomerInfo = async () => {
    if (!session?.user?.id) return

    try {
      // Usar apenas as informações que são novas (não estão salvas no banco)
      const updateData = getNewCustomerInfoToSave()

      // Se não há nada novo para salvar, apenas fechar o dialog e continuar
      if (Object.keys(updateData).length === 0) {
        setSaveCustomerInfoDialogOpen(false)
        await submitQuote()
        return
      }

      await api.saveProfile(updateData)
      toast.success('Informações salvas com sucesso!')
      setSaveCustomerInfoDialogOpen(false)
      // Marcar como não dispensado para não mostrar novamente nesta sessão
      ports.preferences.setItem(preferenceKey('customerInfoDismissed'), 'false')
      // Recarregar dados do perfil para garantir que está sincronizado
      hasLoadedProfile.current = false
      await loadUserProfile()
      // Continuar com envio do orçamento
      await submitQuote()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      console.error('Erro ao salvar informações do cliente:', error)
      toast.error('Erro ao salvar informações')
    }
  }
  const handleSkipSaveCustomerInfo = () => {
    if (session?.user?.id) {
      // Marcar como dispensado para não mostrar novamente
      ports.preferences.setItem(preferenceKey('customerInfoDismissed'), 'true')
    }
    setSaveCustomerInfoDialogOpen(false)
    // Continuar com envio do orçamento sem salvar
    void submitQuote()
  }
  const handleConfirmAddress = () => {
    if (!selectedSavedAddress) return

    // Preencher formulário com endereço salvo
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: {
        cep: selectedSavedAddress.zipCode,
        logradouro: selectedSavedAddress.street,
        numero: selectedSavedAddress.number,
        complemento: selectedSavedAddress.complement || '',
        bairro: selectedSavedAddress.neighborhood,
        cidade: selectedSavedAddress.city,
        estado: selectedSavedAddress.state,
      },
    }))

    setConfirmAddressDialogOpen(false)
    // Continuar com envio
    void submitQuote()
  }
  const handleDismissConfirmation = (dismissed: boolean) => {
    if (session?.user?.id) {
      if (dismissed) {
        ports.preferences.setItem(
          preferenceKey('addressConfirmationDismissed'),
          'true'
        )
      } else {
        ports.preferences.removeItem(
          preferenceKey('addressConfirmationDismissed')
        )
      }
    }
  }
  const handleSelectAddress = (addressId: string) => {
    const address = userAddresses.find((a) => a.id === addressId)
    if (!address) return

    // Preencher formulário
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: {
        cep: address.zipCode,
        logradouro: address.street,
        numero: address.number,
        complemento: address.complement || '',
        bairro: address.neighborhood,
        cidade: address.city,
        estado: address.state,
      },
    }))

    setSelectAddressDialogOpen(false)
    // Continuar com envio
    void submitQuote()
  }
  const handleUseOtherAddress = () => {
    setSelectAddressDialogOpen(false)
    // Permitir preencher manualmente (não fazer nada, apenas fechar)
  }
  const handleCancelAddressDialog = () => {
    setConfirmAddressDialogOpen(false)
    setSelectAddressDialogOpen(false)
    // Permitir edição do endereço (não fazer nada, apenas fechar)
  }
  const getEquipmentImage = (equipment: CartItem) => {
    if (
      equipment.images &&
      equipment.images.length > 0 &&
      equipment.images[0] &&
      equipment.images[0].trim() !== ''
    ) {
      return equipment.images[0]
    }
    return `/placeholder.svg?height=60&width=60&text=${encodeURIComponent(equipment.equipmentName)}`
  }
  return {
    selectedEquipments,
    displayedItems,
    formData,
    setFormData,
    getNewCustomerInfoToSave,
    isSubmitting,
    submittedQuote,
    freightOptions,
    selectedFreight,
    setSelectedFreight,
    isCalculatingFreight,
    availabilityErrors,
    pendingWeekendConfirmation,
    hasAcceptedTerms,
    setHasAcceptedTerms,
    termos,
    userAddresses,
    saveAddressDialogOpen,
    setSaveAddressDialogOpen,
    confirmAddressDialogOpen,
    setConfirmAddressDialogOpen,
    selectAddressDialogOpen,
    setSelectAddressDialogOpen,
    selectedSavedAddress,
    saveCustomerInfoDialogOpen,
    setSaveCustomerInfoDialogOpen,
    formatDate,
    resolveDateRange,
    handlePhoneChange,
    handleCPFChange,
    handleCNPJChange,
    updateQuantity,
    updateDays,
    removeEquipment,
    calculateSubtotal,
    calculateTotal,
    handleDeliveryTypeChange,
    handleSubmit,
    handleWeekendConfirmation,
    handleWeekendConfirmationCancel,
    handleSaveAddress,
    handleSkipSaveAddress,
    handleSaveCustomerInfo,
    handleSkipSaveCustomerInfo,
    handleConfirmAddress,
    handleDismissConfirmation,
    handleSelectAddress,
    handleUseOtherAddress,
    handleCancelAddressDialog,
    getEquipmentImage,
  }
}
