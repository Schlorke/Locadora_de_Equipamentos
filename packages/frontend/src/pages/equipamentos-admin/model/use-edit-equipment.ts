'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { createAdminEquipmentsApi } from '../api/equipments'
import { type Category, type EquipmentFormData } from './tipos'
export function useEditEquipment(
  equipmentId: string | null,
  navigate: (href: string) => void
) {
  const apiClient = useScopedApiClient(equipmentId)
  const api = useMemo(() => createAdminEquipmentsApi(apiClient), [apiClient])
  const lossBusy = useRef(false),
    lossDraft = useRef(0)
  const [isSavingLoss, setIsSavingLoss] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    pricePerDay: 0,
    categoryId: '',
    images: [],
    isAvailable: true,
    specifications: {},
    // Inventory management
    maxStock: 1,
    // Equipment control
    partsLossHistory: [],
    partsLossCount: 0,
    // Rental period configurations
    dailyDiscount: 0,
    weeklyDiscount: 0,
    biweeklyDiscount: 0,
    monthlyDiscount: 0,
    popularPeriod: 'weekly',
    // Direct value pricing configurations
    dailyDirectValue: 0,
    weeklyDirectValue: 0,
    biweeklyDirectValue: 0,
    monthlyDirectValue: 0,
    // Pricing method control (percentage or direct value)
    dailyUseDirectValue: false,
    weeklyUseDirectValue: false,
    biweeklyUseDirectValue: false,
    monthlyUseDirectValue: false,
    dailyRentalEnabled: true,
    weeklyRentalEnabled: true,
    biweeklyRentalEnabled: true,
    monthlyRentalEnabled: true,
  })
  const [newPartsLossDate, setNewPartsLossDate] = useState('')
  const [newPartsLossSelectedDate, setNewPartsLossSelectedDate] =
    useState<Date | null>(null)
  const [isPartsLossCalendarOpen, setIsPartsLossCalendarOpen] = useState(false)
  const [newPartsLossDescription, setNewPartsLossDescription] = useState('')
  const [newPartsLossQuantity, setNewPartsLossQuantity] = useState('')
  const [newPartsLossImages, setNewPartsLossImages] = useState<string[]>([])
  const [editingPartsLossIndex, setEditingPartsLossIndex] = useState<
    number | null
  >(null)

  // Estados do carrossel
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isImageZoomed, setIsImageZoomed] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.categories<Category[]>()
      if (!apiClient.isCurrent()) return
      if (response.ok) {
        const data = response.data
        setCategories(data)
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao carregar categorias:', error)
      toast.error('Erro', { description: 'Falha ao carregar categorias.' })
    }
  }, [api, apiClient])

  useEffect(() => {
    if (!equipmentId) {
      setIsLoading(false)
      return
    }

    const fetchEquipment = async (id: string) => {
      try {
        const response = await api.get<EquipmentFormData>(id)
        if (!apiClient.isCurrent()) return
        if (response.ok) {
          const equipment = response.data
          setFormData({
            name: equipment.name || '',
            description: equipment.description || '',
            pricePerDay: equipment.pricePerDay || 0,
            categoryId: equipment.categoryId || '',
            images: equipment.images || [],
            isAvailable: equipment.isAvailable ?? true,
            specifications: equipment.specifications || {},
            // Inventory management
            maxStock: equipment.maxStock || 1,
            // Equipment control
            partsLossHistory:
              equipment.partsLossHistory &&
              typeof equipment.partsLossHistory === 'object'
                ? (equipment.partsLossHistory as Array<{
                    date: string
                    description: string
                    quantity: number
                    images?: string[]
                  }>)
                : [],
            partsLossCount: equipment.partsLossCount || 0,
            // Rental period configurations
            dailyDiscount: equipment.dailyDiscount || 0,
            weeklyDiscount: equipment.weeklyDiscount || 0,
            biweeklyDiscount: equipment.biweeklyDiscount || 0,
            monthlyDiscount: equipment.monthlyDiscount || 0,
            popularPeriod: equipment.popularPeriod || 'weekly',
            // Direct value pricing configurations
            dailyDirectValue: equipment.dailyDirectValue || 0,
            weeklyDirectValue: equipment.weeklyDirectValue || 0,
            biweeklyDirectValue: equipment.biweeklyDirectValue || 0,
            monthlyDirectValue: equipment.monthlyDirectValue || 0,
            // Pricing method control (percentage or direct value)
            dailyUseDirectValue: equipment.dailyUseDirectValue || false,
            weeklyUseDirectValue: equipment.weeklyUseDirectValue || false,
            biweeklyUseDirectValue: equipment.biweeklyUseDirectValue || false,
            monthlyUseDirectValue: equipment.monthlyUseDirectValue || false,
            dailyRentalEnabled: equipment.dailyRentalEnabled ?? true,
            weeklyRentalEnabled: equipment.weeklyRentalEnabled ?? true,
            biweeklyRentalEnabled: equipment.biweeklyRentalEnabled ?? true,
            monthlyRentalEnabled: equipment.monthlyRentalEnabled ?? true,
          })
        }
      } catch (error) {
        if (!apiClient.isCurrent() || isAbortError(error)) return

        console.error('Erro ao buscar equipamento:', error)
      } finally {
        if (apiClient.isCurrent()) setIsLoading(false)
      }
    }

    fetchEquipment(equipmentId)
    fetchCategories()
  }, [equipmentId, api, apiClient, fetchCategories])

  const handleAddSpecification = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [key]: value,
      },
    }))
  }

  const handleRemoveSpecification = (keyToRemove: string) => {
    setFormData((prev) => {
      const newSpecifications = { ...prev.specifications }
      delete newSpecifications[keyToRemove]
      return { ...prev, specifications: newSpecifications }
    })
  }

  // Funções do carrossel
  const nextImage = useCallback(() => {
    if (formData.images.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === formData.images.length - 1 ? 0 : prev + 1
      )
    }
  }, [formData.images.length])

  const prevImage = useCallback(() => {
    if (formData.images.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? formData.images.length - 1 : prev - 1
      )
    }
  }, [formData.images.length])

  const goToImage = useCallback((index: number) => {
    setCurrentImageIndex(index)
  }, [])

  // Reset carrossel quando as imagens mudarem
  useEffect(() => {
    if (formData.images.length === 0) {
      setCurrentImageIndex(0)
      setIsImageZoomed(false)
    } else if (currentImageIndex >= formData.images.length) {
      setCurrentImageIndex(formData.images.length - 1)
    }
  }, [formData.images, currentImageIndex])

  // ===== Parts Loss Management =====
  // Data mínima para o calendário de perdas (hoje)
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  // Handler para seleção de data no calendário de perdas
  const handlePartsLossDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setNewPartsLossSelectedDate(date)
      // Converter para formato ISO (YYYY-MM-DD) para compatibilidade com o backend
      const isoDate = format(date, 'yyyy-MM-dd')
      setNewPartsLossDate(isoDate)
      setIsPartsLossCalendarOpen(false)
    }
  }, [])

  // Handler para limpar data selecionada
  const clearPartsLossDate = useCallback(() => {
    setNewPartsLossSelectedDate(null)
    setNewPartsLossDate('')
  }, [])

  // Texto do botão de data
  const partsLossDateDisplayText = useMemo(() => {
    if (newPartsLossSelectedDate) {
      return format(newPartsLossSelectedDate, 'dd/MM/yyyy', { locale: ptBR })
    }
    return 'Selecione a data da perda'
  }, [newPartsLossSelectedDate])

  // Sincronizar newPartsLossDate com newPartsLossSelectedDate quando carregar dados
  useEffect(() => {
    if (newPartsLossDate && !newPartsLossSelectedDate) {
      try {
        const date = new Date(newPartsLossDate)
        if (!isNaN(date.getTime())) {
          setNewPartsLossSelectedDate(date)
        }
      } catch (_error) {
        // Ignorar erro de parsing
      }
    }
  }, [newPartsLossDate, newPartsLossSelectedDate])

  // Função para desabilitar datas no calendário
  const isPartsLossDateDisabled = useCallback(
    (date: Date) => {
      const dateToCheck = new Date(date)
      dateToCheck.setHours(0, 0, 0, 0)
      // Desabilitar datas futuras (apenas permitir datas passadas e hoje)
      return dateToCheck > today
    },
    [today]
  )

  // Handler para iniciar edição de um registro de perda
  const handleEditPartsLoss = useCallback(
    (index: number) => {
      lossDraft.current++
      const loss = formData.partsLossHistory?.[index]
      if (!loss) return

      // Preencher formulário com dados do registro
      setNewPartsLossDate(loss.date)
      try {
        const date = new Date(loss.date)
        if (!isNaN(date.getTime())) {
          setNewPartsLossSelectedDate(date)
        }
      } catch (_error) {
        // Ignorar erro de parsing
      }
      setNewPartsLossDescription(loss.description)
      setNewPartsLossQuantity(loss.quantity.toString())
      setNewPartsLossImages(loss.images || [])
      setEditingPartsLossIndex(index)
      setIsPartsLossCalendarOpen(false)
    },
    [formData.partsLossHistory]
  )

  // Handler para cancelar edição
  const handleCancelEditPartsLoss = useCallback(() => {
    lossDraft.current++
    setNewPartsLossDate('')
    setNewPartsLossSelectedDate(null)
    setNewPartsLossDescription('')
    setNewPartsLossQuantity('')
    setNewPartsLossImages([])
    setEditingPartsLossIndex(null)
    setIsPartsLossCalendarOpen(false)
  }, [])

  // Handler para salvar/adicionar registro de perda
  const handleSavePartsLoss = useCallback(async () => {
    if (
      newPartsLossDate &&
      newPartsLossDescription.trim() &&
      newPartsLossQuantity
    ) {
      const quantity = parseInt(newPartsLossQuantity) || 0
      const newLoss = {
        date: newPartsLossDate,
        description: newPartsLossDescription.trim(),
        quantity,
        images: newPartsLossImages,
      }

      if (
        !equipmentId ||
        !apiClient.isCurrent() ||
        lossBusy.current ||
        isSaving
      )
        return
      lossBusy.current = true
      setIsSavingLoss(true)
      const draft = lossDraft.current
      const previousHistory = formData.partsLossHistory
      const previousCount = formData.partsLossCount || 0
      const updatedHistory = [...(previousHistory || [])]
      let updatedCount = previousCount + quantity
      if (editingPartsLossIndex !== null) {
        updatedCount =
          previousCount -
          (updatedHistory[editingPartsLossIndex]?.quantity || 0) +
          quantity
        updatedHistory[editingPartsLossIndex] = newLoss
      } else updatedHistory.push(newLoss)
      const currentFormData = {
        ...formData,
        partsLossHistory: updatedHistory,
        partsLossCount: updatedCount,
      }
      setFormData(currentFormData)
      try {
        const response = await api.update(
          equipmentId!,
          JSON.stringify(currentFormData)
        )
        if (!apiClient.isCurrent()) return

        if (!response.ok) {
          throw new Error('Erro ao salvar alteração')
        }

        if (editingPartsLossIndex !== null) {
          toast.success('Registro atualizado!', {
            description: 'Registro de perda atualizado com sucesso.',
          })
        } else {
          toast.success('Perda registrada!', {
            description: 'Registro de perda adicionado com sucesso.',
          })
        }

        if (lossDraft.current === draft) handleCancelEditPartsLoss()
      } catch (error) {
        if (!apiClient.isCurrent() || isAbortError(error)) return

        console.error('Erro ao salvar registro de perda:', error)
        // Reverter estado local em caso de erro
        setFormData((prev) => ({
          ...prev,
          partsLossHistory: previousHistory,
          partsLossCount: previousCount,
        }))
        toast.error('Erro ao salvar registro', {
          description: 'Não foi possível salvar o registro. Tente novamente.',
        })
      } finally {
        lossBusy.current = false
        if (apiClient.isCurrent()) setIsSavingLoss(false)
      }
    } else {
      toast.warning('Atenção', {
        description: 'Preencha todos os campos para registrar a perda.',
      })
    }
  }, [
    handleCancelEditPartsLoss,
    isSaving,
    newPartsLossDate,
    newPartsLossDescription,
    newPartsLossQuantity,
    newPartsLossImages,
    editingPartsLossIndex,
    equipmentId,
    formData,
    api,
    apiClient,
  ])

  const submit = async () => {
    if (!equipmentId || !apiClient.isCurrent() || lossBusy.current || isSaving)
      return

    const hasAnyPercentageDiscount =
      !formData.dailyUseDirectValue ||
      !formData.weeklyUseDirectValue ||
      !formData.biweeklyUseDirectValue ||
      !formData.monthlyUseDirectValue

    if (!formData.name?.trim()) {
      toast.error('Campo obrigatório', {
        description: 'Informe o nome do equipamento.',
      })
      return
    }
    if (!formData.description?.trim()) {
      toast.error('Campo obrigatório', {
        description: 'Informe a descrição do equipamento.',
      })
      return
    }
    if (!formData.categoryId) {
      toast.error('Campo obrigatório', {
        description: 'Selecione uma categoria para o equipamento.',
      })
      return
    }

    if (hasAnyPercentageDiscount) {
      if (formData.pricePerDay == null || formData.pricePerDay <= 0) {
        toast.error('Preço por Dia obrigatório', {
          description:
            'Você ativou "Usar desconto percentual" em pelo menos um período (diário, semanal, quinzenal ou mensal). Nesse caso, o campo Preço por Dia (R$) é obrigatório e deve ser preenchido com valor maior que zero.',
        })
        return
      }
    }

    if (formData.images.length === 0) {
      toast.error('Imagem obrigatória', {
        description: 'Adicione pelo menos uma imagem do equipamento.',
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await api.updateWithText(
        equipmentId!,
        JSON.stringify(formData)
      )
      if (!apiClient.isCurrent()) return

      if (response.ok) {
        toast.success('Equipamento Atualizado!', {
          description: 'Equipamento atualizado com sucesso.',
        })
        navigate('/admin/equipamentos')
      } else {
        const text = response.text
        let errorData: { error?: string; details?: string } = {}
        try {
          if (text) {
            errorData = JSON.parse(text) as { error?: string; details?: string }
          }
        } catch (_e) {
          console.error('Erro da API: body não é JSON:', text?.slice(0, 200))
        }
        console.error(
          'Erro da API:',
          response.status,
          response.statusText,
          text?.slice(0, 300),
          errorData
        )

        const errorMessage =
          errorData.details ??
          errorData.error ??
          (response.statusText ||
            `Erro ao atualizar equipamento (${response.status})`)
        throw new Error(errorMessage)
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao atualizar equipamento:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro ao atualizar o equipamento.',
      })
    } finally {
      if (apiClient.isCurrent()) setIsSaving(false)
    }
  }

  const hasAnyPercentageDiscount =
    !formData.dailyUseDirectValue ||
    !formData.weeklyUseDirectValue ||
    !formData.biweeklyUseDirectValue ||
    !formData.monthlyUseDirectValue

  const handleRemovePartsLoss = async (index: number) => {
    if (!equipmentId || !apiClient.isCurrent() || lossBusy.current || isSaving)
      return
    const loss = formData.partsLossHistory?.[index]
    if (!loss) return
    const previousHistory = formData.partsLossHistory,
      previousCount = formData.partsLossCount
    const next = {
      ...formData,
      partsLossHistory: previousHistory?.filter((_, i) => i !== index) || [],
      partsLossCount: Math.max(0, (previousCount || 0) - loss.quantity),
    }
    lossBusy.current = true
    setIsSavingLoss(true)
    setFormData(next)
    try {
      const response = await api.update(equipmentId, JSON.stringify(next))
      if (!apiClient.isCurrent()) return
      if (!response.ok) throw new Error('Erro ao salvar alteração')
      toast.success('Registro removido', {
        description: 'Registro de perda removido com sucesso.',
      })
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return
      setFormData((prev) => ({
        ...prev,
        partsLossHistory: previousHistory,
        partsLossCount: previousCount,
      }))
      toast.error('Erro ao remover registro', {
        description: 'Não foi possível remover o registro. Tente novamente.',
      })
    } finally {
      lossBusy.current = false
      if (apiClient.isCurrent()) setIsSavingLoss(false)
    }
  }

  return {
    api,
    apiClient,
    categories,
    isLoading,
    isSaving,
    isSavingLoss,
    formData,
    setFormData,
    newPartsLossDate,
    setNewPartsLossDate,
    newPartsLossSelectedDate,
    setNewPartsLossSelectedDate,
    isPartsLossCalendarOpen,
    setIsPartsLossCalendarOpen,
    newPartsLossDescription,
    setNewPartsLossDescription,
    newPartsLossQuantity,
    setNewPartsLossQuantity,
    newPartsLossImages,
    setNewPartsLossImages,
    editingPartsLossIndex,
    currentImageIndex,
    setCurrentImageIndex,
    isImageZoomed,
    setIsImageZoomed,
    handleAddSpecification,
    handleRemoveSpecification,
    nextImage,
    prevImage,
    goToImage,
    today,
    handlePartsLossDateSelect,
    clearPartsLossDate,
    partsLossDateDisplayText,
    isPartsLossDateDisabled,
    handleEditPartsLoss,
    handleCancelEditPartsLoss,
    handleSavePartsLoss,
    handleRemovePartsLoss,
    submit,
    hasAnyPercentageDiscount,
    lossDraft,
  }
}
