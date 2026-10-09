'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { createAdminEquipmentsApi } from '../api/equipments'
import {
  DEFAULT_FORM_DATA,
  type Category,
  type EquipmentFormData,
} from './tipos'
export function useNewEquipment(navigate: (href: string) => void) {
  const apiClient = useScopedApiClient(null)
  const api = useMemo(() => createAdminEquipmentsApi(apiClient), [apiClient])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const [formData, setFormData] = useState<EquipmentFormData>(DEFAULT_FORM_DATA)

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
    fetchCategories()
  }, [fetchCategories])

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

  const submit = async () => {
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

    setIsLoading(true)
    try {
      const response = await api.create(JSON.stringify(formData))
      if (!apiClient.isCurrent()) return

      if (response.ok) {
        toast.success('Equipamento Criado!', {
          description: 'Equipamento criado com sucesso.',
        })
        navigate('/admin/equipamentos')
      } else {
        const errorData = response.data
        throw new Error(errorData.error || 'Erro ao criar equipamento')
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Erro ao criar equipamento:', error)
      toast.error('Erro', {
        description:
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro ao criar o equipamento.',
      })
    } finally {
      if (apiClient.isCurrent()) setIsLoading(false)
    }
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

  const hasAnyPercentageDiscount =
    !formData.dailyUseDirectValue ||
    !formData.weeklyUseDirectValue ||
    !formData.biweeklyUseDirectValue ||
    !formData.monthlyUseDirectValue

  return {
    apiClient,
    api,
    categories,
    isLoading,
    currentImageIndex,
    setCurrentImageIndex,
    isImageZoomed,
    setIsImageZoomed,
    formData,
    setFormData,
    handleAddSpecification,
    handleRemoveSpecification,
    submit,
    nextImage,
    prevImage,
    goToImage,
    hasAnyPercentageDiscount,
  }
}
