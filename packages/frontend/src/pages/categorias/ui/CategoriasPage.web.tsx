'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useApiClientRevision } from '../../../shared/api'
import { useSession } from '../../../entities/sessao'

import { CategoryDialogModal } from './CategoriaDialog.web'
import { ViewCategoryDialog } from './VerCategoria.web'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import {
  DEFAULT_DESIGN,
  renderCategoryIcon,
  type CategoryDesign,
} from '../../../shared/lib/category-design'
import { getCategoryBadgePreview } from '../../../shared/lib/category-helpers'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit, Eye, Package, Plus, Search, Tag, Trash2 } from 'lucide-react'
import React from 'react'
import { useCategoriesData, type Category } from '../model/carga.web'
import type { CategoryData } from './CategoriaDialog.web'

function renderCategoryCardPreview(category: Category): React.ReactElement {
  let customIcon: CategoryDesign['customIcon'] = {
    ...DEFAULT_DESIGN.customIcon,
  }
  if (category.customIcon) {
    try {
      const parsed =
        typeof category.customIcon === 'string'
          ? JSON.parse(category.customIcon)
          : category.customIcon
      customIcon = parsed as CategoryDesign['customIcon']
    } catch {
      customIcon = { ...DEFAULT_DESIGN.customIcon }
    }
  }

  const design: CategoryDesign = {
    backgroundColor:
      category.backgroundColor ||
      category.bgColor ||
      DEFAULT_DESIGN.backgroundColor,
    fontColor: category.fontColor || DEFAULT_DESIGN.fontColor,
    iconColor: category.iconColor || DEFAULT_DESIGN.iconColor,
    icon: (category.icon as CategoryDesign['icon']) || DEFAULT_DESIGN.icon,
    customIcon,
    placement: category.placement || DEFAULT_DESIGN.placement,
  }

  return (
    <button
      type="button"
      className="group relative flex h-full w-full min-h-[120px] max-h-[120px] flex-col items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 shadow-lg transition-all duration-300 hover:shadow-2xl"
    >
      <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 p-2.5 shadow-lg transition-transform duration-300 transform-gpu group-hover:scale-[1.04] group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]">
        {renderCategoryIcon(design, {
          size: 28,
          className: 'h-7 w-7 shrink-0 text-white',
          color: 'white', // token-check-allow: ícone branco do preview da categoria
        })}
      </div>
      <span className="relative z-10 text-center text-xs font-semibold leading-tight text-white transition-colors duration-300 group-hover:text-orange-400 whitespace-normal break-words">
        {category.name}
      </span>
    </button>
  )
}

function AdminCategoriesPageContent() {
  const {
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
    isMobile,
  } = useCategoriesData()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                Gerenciar Categorias
              </h1>
              <p className="text-orange-50 mb-4 font-medium">
                Organize e gerencie as categorias de equipamentos
              </p>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
                <Tag className="w-5 h-5 text-orange-50" />
                <span className="font-semibold text-white">
                  {Array.isArray(filteredCategories)
                    ? filteredCategories.length
                    : 0}{' '}
                  categorias encontradas
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filtros e Ações */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>
            <CardContent className="relative z-10 p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar categorias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={openNewCategoryModal}
                  className="bg-slate-700 text-primary-foreground hover:bg-slate-600 hover:scale-105 hover:shadow-lg transition-all duration-300 h-10 px-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Categoria
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Grid de Categorias */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {!Array.isArray(filteredCategories) ||
          filteredCategories.length === 0 ? (
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>
              <CardContent className="relative z-10 text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Tag className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg font-medium">
                    Nenhuma categoria encontrada
                  </p>
                  <p className="text-sm">
                    {searchTerm
                      ? 'Tente ajustar os filtros de busca'
                      : 'Crie sua primeira categoria para organizar os equipamentos'}
                  </p>
                </div>
                {!searchTerm && (
                  <Button
                    onClick={openNewCategoryModal}
                    className="mt-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeira Categoria
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`grid-${pageKey}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0 }}
                    style={{ display: 'contents' }}
                  >
                    {paginatedCategories.map((category, index) => (
                      <motion.div
                        key={`${category.id}-${pageKey}`}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{
                          delay: index * 0.08,
                          duration: 0.3,
                          ease: 'easeOut',
                        }}
                        className="group h-full"
                        onClick={() => {
                          if (isMobile) {
                            setActiveCardId(
                              activeCardId === category.id ? null : category.id
                            )
                          }
                        }}
                      >
                        <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] flex flex-col h-full">
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>
                          <CardHeader className="relative z-10 pb-3 shrink-0">
                            <div className="flex flex-col">
                              <div className="w-full flex justify-center pb-4 pt-0">
                                <div className="w-full max-w-[136px] h-[120px] shrink-0">
                                  {renderCategoryCardPreview(category)}
                                </div>
                              </div>
                              <div className="w-full flex justify-center pb-4">
                                {getCategoryBadgePreview(
                                  {
                                    id: category.id,
                                    name: category.name,
                                    description: category.description,
                                    icon: category.icon || null,
                                    iconColor: category.iconColor,
                                    backgroundColor: category.backgroundColor,
                                    bgColor: category.bgColor,
                                    fontColor: category.fontColor,
                                    customIcon: category.customIcon
                                      ? typeof category.customIcon === 'string'
                                        ? JSON.parse(category.customIcon)
                                        : category.customIcon
                                      : null,
                                  },
                                  'md',
                                  true
                                )}
                              </div>
                              <div className="w-full text-center">
                                <p
                                  className="text-sm text-gray-500 mt-1 line-clamp-4 cursor-default"
                                  title={
                                    category.description || 'Sem descrição'
                                  }
                                >
                                  {category.description || 'Sem descrição'}
                                </p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="relative z-10 pt-8 flex-1 flex flex-col justify-end">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Package className="w-4 h-4 shrink-0" />
                                <span className="truncate">
                                  {category._count?.equipments || 0}{' '}
                                  equipamentos
                                </span>
                              </div>
                              <div
                                className={`flex items-center justify-end gap-1 transition-all duration-300 ${
                                  isMobile
                                    ? activeCardId === category.id
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                    : 'opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedCategory(category)
                                  }}
                                  className="shrink-0 text-[var(--action-icon)] hover:bg-[var(--action-hover-surface)] hover:text-[var(--action-icon)] transition-all duration-200 [transition-timing-function:ease-in-out]"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditCategoryModal(category)
                                  }}
                                  className="shrink-0 text-[var(--action-icon)] hover:bg-[var(--action-hover-surface)] hover:text-[var(--action-icon)] transition-all duration-200 [transition-timing-function:ease-in-out]"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteCategory(category.id)
                                  }}
                                  disabled={
                                    (category._count?.equipments || 0) > 0 ||
                                    isSubmitting
                                  }
                                  className="shrink-0 disabled:opacity-50 text-[var(--action-danger)] hover:bg-[var(--action-danger-surface)] hover:text-[var(--action-danger-hover)] transition-all duration-200 [transition-timing-function:ease-in-out]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              <SmartPagination
                currentPage={effectiveCurrentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </motion.div>

        <ViewCategoryDialog
          category={selectedCategory}
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          onEdit={(category) => openEditCategoryModal(category as Category)}
        />

        <CategoryDialogModal
          isOpen={isModernModalOpen}
          mode={editingCategoryData ? 'edit' : 'create'}
          onClose={() => setIsModernModalOpen(false)}
          onSave={handleCategorySave as (data: CategoryData) => Promise<void>}
          initialData={
            (editingCategoryData as CategoryData | null) || undefined
          }
          onStateChange={handleDialogStateChange}
        />
      </div>
    </div>
  )
}

export function AdminCategoriesPage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session, status } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    status,
    revision,
  ])
  return <AdminCategoriesPageContent key={scope} />
}
