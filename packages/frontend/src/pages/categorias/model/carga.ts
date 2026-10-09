'use client'

import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminCategoriesApi } from '../api/categories'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_DESIGN } from '../../../shared/lib/category-design-model'
import {
  CATEGORY_PAGE_SIZE,
  categoryToDialogCategoryData,
  dialogCategoryDataToApiPayload,
  type CategoryDialogDataInput,
} from '../../../entities/categoria'
import { toast } from '../../../shared/lib/toast'
import type { Category } from './tipos'

export type { Category }
export type DialogCategoryData = CategoryDialogDataInput
export { categoryToDialogCategoryData, dialogCategoryDataToApiPayload }

export function useCategoriesModel({
  requestConfirmation,
  onPageChange,
}: {
  requestConfirmation: (message: string) => boolean | Promise<boolean>
  onPageChange?: () => void
}) {
  const apiClient = useScopedApiClient(null)
  const api = useMemo(() => createAdminCategoriesApi(apiClient), [apiClient])
  const [categories, setCategories] = useState<Category[]>([])
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageKey, setPageKey] = useState(0)
  const [isModernModalOpen, setIsModernModalOpen] = useState(false)
  const [editingCategoryData, setEditingCategoryData] =
    useState<CategoryDialogDataInput | null>(null)
  const saveClient = useScopedApiClient(
    JSON.stringify([editingCategoryData?.id, isModernModalOpen])
  )
  const saveApi = useMemo(
    () => createAdminCategoriesApi(saveClient),
    [saveClient]
  )

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.list()
      if (!apiClient.isCurrent()) return
      const data = response.data
      const categoriesArray = Array.isArray(data)
        ? data
        : data?.categories || []
      setCategories(categoriesArray)
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Error fetching categories:', error)
      toast.error('Erro', {
        description: 'Erro ao carregar categorias. Tente novamente.',
      })
      setCategories([])
    } finally {
      if (apiClient.isCurrent()) setLoading(false)
    }
  }, [api, apiClient])

  const filterCategories = useCallback(() => {
    if (!Array.isArray(categories)) {
      setFilteredCategories([])
      return
    }

    const filtered = categories.filter((category: Category) => {
      const matchesSearch =
        category.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })

    const sorted = filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      return nameA.localeCompare(nameB, 'pt-BR')
    })

    setFilteredCategories(sorted)
  }, [categories, searchTerm])

  useEffect(() => {
    setCategories([])
    setFilteredCategories([])
    setSelectedCategory(null)
    setEditingCategoryData(null)
    setIsModernModalOpen(false)
    setIsSubmitting(false)
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    filterCategories()
  }, [categories, searchTerm, filterCategories])

  useEffect(() => {
    setCurrentPage(1)
    setPageKey((prev) => prev + 1)
  }, [searchTerm])

  const totalPages = Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE)
  const effectiveCurrentPage =
    totalPages > 0 ? Math.min(currentPage, totalPages) : 1
  const startIndex = (effectiveCurrentPage - 1) * CATEGORY_PAGE_SIZE
  const paginatedCategories = Array.isArray(filteredCategories)
    ? filteredCategories.slice(startIndex, startIndex + CATEGORY_PAGE_SIZE)
    : []

  useEffect(() => {
    if (currentPage !== effectiveCurrentPage) {
      setCurrentPage(effectiveCurrentPage)
    }
  }, [currentPage, effectiveCurrentPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageKey((prev) => prev + 1)
    onPageChange?.()
  }

  const openNewCategoryModal = () => {
    setEditingCategoryData(null)
    setIsModernModalOpen(true)
  }

  const openEditCategoryModal = (category: Category) => {
    setEditingCategoryData(
      categoryToDialogCategoryData(category, DEFAULT_DESIGN)
    )
    setIsModernModalOpen(true)
  }

  const handleCategorySave = async (categoryData: CategoryDialogDataInput) => {
    const isEditing = !!editingCategoryData?.id

    const categoryPayload = dialogCategoryDataToApiPayload(categoryData)
    const finalPayload = {
      ...categoryPayload,
      icon:
        categoryPayload.icon === undefined || categoryPayload.icon === null
          ? null
          : categoryPayload.icon,
    }

    try {
      const response = await saveApi.save(
        isEditing ? editingCategoryData!.id! : null,
        JSON.stringify(finalPayload)
      )
      if (!saveClient.isCurrent()) return

      if (!response.ok) {
        const errorData = response.data
        if (response.status === 409) {
          throw new Error('Categoria já existente')
        } else {
          throw new Error(errorData.error || 'Erro ao salvar categoria')
        }
      }

      await fetchCategories()
      if (!saveClient.isCurrent()) return

      toast.success('Sucesso!', {
        description: isEditing
          ? 'Categoria atualizada com sucesso.'
          : 'Categoria criada com sucesso.',
      })
    } catch (error) {
      if (!saveClient.isCurrent() || isAbortError(error)) return
      throw error
    }
  }

  const handleDialogStateChange = useCallback(
    (_key: string, _isOpen: boolean) => {},
    []
  )

  const deleteCategory = async (categoryId: string) => {
    if (!apiClient.isCurrent() || isSubmitting) return
    if (
      !(await requestConfirmation(
        'Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.'
      ))
    )
      return

    if (!apiClient.isCurrent()) return
    setIsSubmitting(true)
    try {
      const response = await api.remove(categoryId)
      if (!apiClient.isCurrent()) return
      if (response.ok) {
        toast.success('Categoria Excluída!', {
          description: 'Categoria excluída com sucesso.',
        })
        fetchCategories()
      } else {
        const errorData = response.data
        toast.error('Erro', {
          description: errorData.error || 'Erro ao excluir categoria.',
        })
      }
    } catch (error) {
      if (!apiClient.isCurrent() || isAbortError(error)) return

      console.error('Error deleting category:', error)
      toast.error('Erro', { description: 'Erro ao excluir categoria.' })
    } finally {
      if (apiClient.isCurrent()) setIsSubmitting(false)
    }
  }

  return {
    categories,
    filteredCategories,
    loading,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    isSubmitting,
    activeCardId,
    setActiveCardId,
    paginatedCategories,
    effectiveCurrentPage,
    totalPages,
    pageKey,
    handlePageChange,
    isModernModalOpen,
    setIsModernModalOpen,
    editingCategoryData,
    openNewCategoryModal,
    openEditCategoryModal,
    handleCategorySave,
    handleDialogStateChange,
    deleteCategory,
  }
}
