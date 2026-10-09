'use client'

import { useEquipmentScope } from '../model/escopo'

import { AdminFilterCard } from '../../../widgets/filtro-admin'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader } from '@gb-locacoes/ui'
import { SmartPagination } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { getCategoryBadgePreview } from '../../../shared/lib/category-helpers'
import type { CustomIconConfig } from '../../../shared/lib/category-design'
import { AnimatePresence, motion } from 'framer-motion'
import type * as LucideIcons from 'lucide-react'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  DollarSign,
  Edit,
  Eye,
  Loader2,
  Package,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import Image from 'next/image'
import { Link } from '@gb-locacoes/ui'
import {
  useEquipmentListData,
  formatPrice,
  formatDate,
} from '../model/lista.web'
import { ViewEquipmentDialog, type Equipment } from './VerEquipamento.web'

function EquipmentCard({
  equipment,
  index,
  pageKey,
  isMobile,
  activeCardId,
  setActiveCardId,
  setSelectedEquipment,
  setEquipmentToDelete,
  isDeleting,
}: {
  equipment: Equipment
  index: number
  pageKey: number
  isMobile: boolean
  activeCardId: string | null
  setActiveCardId: (_id: string | null) => void
  setSelectedEquipment: (_equipment: Equipment) => void
  setEquipmentToDelete: (_equipment: Equipment) => void
  isDeleting: boolean
}) {
  return (
    <motion.div
      key={`${equipment.id}-${pageKey}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{
        delay: index * 0.08,
        duration: 0.3,
        ease: 'easeOut',
      }}
      className="group"
      onClick={() => {
        if (isMobile) {
          setActiveCardId(activeCardId === equipment.id ? null : equipment.id)
        }
      }}
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full hover:scale-[1.02]">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

        <CardHeader className="relative z-10 pb-3">
          <div className="flex flex-col">
            <div className="w-full h-48 mb-6 md:mb-4 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              {equipment.images &&
              equipment.images.length > 0 &&
              equipment.images[0] ? (
                <Image
                  src={equipment.images[0]}
                  alt={equipment.name}
                  width={300}
                  height={200}
                  className="max-w-full max-h-full object-contain"
                  style={{ width: 'auto', height: 'auto' }}
                  priority={index === 0}
                  loading={index === 0 ? 'eager' : undefined}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>

            <div className="text-left w-full">
              <h3 className="font-semibold text-lg text-gray-900 truncate">
                {equipment.name}
              </h3>
              <p className="text-sm text-gray-500 mt-2 md:mt-1 line-clamp-2">
                {equipment.description || 'Sem descrição'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pt-0 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-2 grid-rows-2 gap-y-4 md:gap-y-2 justify-between">
            <div className="flex items-center justify-start">
              {equipment.category ? (
                getCategoryBadgePreview(
                  {
                    name: equipment.category.name,
                    icon: equipment.category.icon as
                      keyof typeof LucideIcons | null,
                    iconColor: equipment.category.iconColor,
                    bgColor: equipment.category.bgColor,
                    fontColor: equipment.category.fontColor,
                    customIcon: equipment.category
                      .customIcon as CustomIconConfig | null,
                  },
                  'sm',
                  false
                )
              ) : (
                <Badge className="text-sm inline-flex items-center gap-1.5 font-medium px-2.5 py-0.5 rounded-full border-0 bg-gray-200 text-gray-600 max-w-[150px] shrink-0">
                  <span className="truncate min-w-0">Sem categoria</span>
                </Badge>
              )}
            </div>

            <div className="flex gap-2 text-sm items-center justify-center">
              <DollarSign className="w-4 h-4 items-center justify-center text-green-500 shrink-0" />
              <span className="font-bold text-green-600">
                {formatPrice(equipment.pricePerDay)}/dia
              </span>
            </div>

            <div className="flex gap-2 text-sm items-center justify-start">
              {equipment.isAvailable ? (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span
                className={`font-medium ${
                  equipment.isAvailable ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {equipment.isAvailable ? 'Disponível' : 'Indisponível'}
              </span>
            </div>

            <div className="flex gap-2 text-sm items-center justify-center pr-2.5">
              <Calendar className="w-4 h-4 items-start justify-start text-gray-400 shrink-0" />
              <span className="text-gray-600">
                {formatDate(equipment.createdAt)}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center justify-end gap-1 mt-6 md:mt-4 transition-all duration-300 ${
              isMobile
                ? activeCardId === equipment.id
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
                setSelectedEquipment(equipment)
              }}
              className="shrink-0 text-[var(--action-icon)] hover:bg-[var(--action-hover-surface)] hover:text-[var(--action-icon)] transition-all duration-200 [transition-timing-function:ease-in-out]"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="edit-button shrink-0 text-[var(--action-icon)] hover:bg-[var(--action-hover-surface)] hover:text-[var(--action-icon)] transition-all duration-200 [transition-timing-function:ease-in-out]"
            >
              <Link href={`/admin/equipamentos/${equipment.id}/editar`}>
                <Edit className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setEquipmentToDelete(equipment)
              }}
              className="delete-button shrink-0 text-[var(--action-danger)] hover:bg-[var(--action-danger-surface)] hover:text-[var(--action-danger-hover)] transition-all duration-200 [transition-timing-function:ease-in-out]"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AdminEquipmentsPageContent() {
  const {
    equipments,
    filteredEquipments,
    categories,
    loading,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    availabilityFilter,
    setAvailabilityFilter,
    isDeleting,
    activeCardId,
    setActiveCardId,
    selectedEquipment,
    setSelectedEquipment,
    equipmentToDelete,
    setEquipmentToDelete,
    currentEquipments,
    currentPage,
    totalPages,
    pageKey,
    handlePageChange,
    handleConfirmDelete,
    handleEditEquipment,
    isMobile,
  } = useEquipmentListData()

  if (loading && equipments.length === 0) {
    return (
      <div className="h-screen w-full overflow-hidden bg-gray-50 flex items-center justify-center">
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
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 lg:mb-8"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                Gerenciar Equipamentos
              </h1>
              <p className="text-orange-50 mb-4 font-medium">
                Controle todo o catálogo de equipamentos para locação
              </p>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
                <Package className="w-5 h-5 text-orange-50" />
                <span className="font-semibold text-white">
                  {Array.isArray(filteredEquipments)
                    ? filteredEquipments.length
                    : 0}{' '}
                  equipamentos encontrados
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
          <AdminFilterCard
            searchPlaceholder="Buscar equipamentos..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            filters={[
              {
                label: 'Categoria',
                value: selectedCategory,
                onValueChange: setSelectedCategory,
                placeholder: 'Categoria',
                options: [
                  { value: 'all', label: 'Todas as categorias' },
                  ...categories
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                ],
              },
              {
                label: 'Status',
                value: availabilityFilter,
                onValueChange: setAvailabilityFilter,
                placeholder: 'Status',
                options: [
                  { value: 'all', label: 'Todos os status' },
                  { value: 'available', label: 'Disponível' },
                  { value: 'unavailable', label: 'Indisponível' },
                ],
              },
            ]}
            actionButtons={
              <Button asChild variant="default" className="h-10">
                <Link href="/admin/equipamentos/novo">
                  <Plus className="w-4 h-4 mr-2 group-hover:text-orange-500 transition-colors duration-200" />
                  <span className="group-hover:text-orange-500 transition-colors duration-200">
                    Novo Equipamento
                  </span>
                </Link>
              </Button>
            }
          />
        </motion.div>

        {/* Grid de Equipamentos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {loading && equipments.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Atualizando equipamentos...</span>
            </div>
          )}

          {!loading &&
          filteredEquipments.length === 0 &&
          equipments.length === 0 ? (
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <CardContent className="relative z-10 flex flex-col items-center justify-center py-16">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhum equipamento cadastrado
                </h3>
                <p className="text-gray-500 mb-6 text-center">
                  Comece adicionando o primeiro equipamento ao catálogo
                </p>
                <Button asChild variant="default">
                  <Link href="/admin/equipamentos/novo">
                    <Plus className="w-4 h-4 mr-2 group-hover:text-orange-500 transition-colors duration-200" />
                    <span className="group-hover:text-orange-500 transition-colors duration-200">
                      Adicionar Equipamento
                    </span>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : !loading && filteredEquipments.length === 0 ? (
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <CardContent className="relative z-10 flex flex-col items-center justify-center py-16">
                <div className="bg-orange-100 rounded-full p-4 mb-4">
                  <AlertCircle className="w-8 h-8 text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhum equipamento encontrado
                </h3>
                <p className="text-gray-500 text-center">
                  Tente ajustar os filtros para encontrar os equipamentos
                  desejados
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-6 xl:gap-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`grid-${pageKey}-${searchTerm}-${selectedCategory ?? ''}-${availabilityFilter}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0 }}
                  style={{ display: 'contents' }}
                >
                  {currentEquipments.map((equipment, index) => (
                    <EquipmentCard
                      key={`${equipment.id}-${pageKey}`}
                      equipment={equipment}
                      index={index}
                      pageKey={pageKey}
                      isMobile={isMobile}
                      activeCardId={activeCardId}
                      setActiveCardId={setActiveCardId}
                      setSelectedEquipment={setSelectedEquipment}
                      setEquipmentToDelete={setEquipmentToDelete}
                      isDeleting={isDeleting}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Paginação */}
        {!loading && filteredEquipments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8"
          >
            <SmartPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </motion.div>
        )}

        {/* Dialog de Preview */}
        <ViewEquipmentDialog
          equipment={selectedEquipment}
          isOpen={!!selectedEquipment}
          onClose={() => setSelectedEquipment(null)}
          onEdit={handleEditEquipment}
        />

        {/* Dialog de confirmação de exclusão */}
        <Dialog.Root
          open={!!equipmentToDelete}
          onOpenChange={(open) => !open && setEquipmentToDelete(null)}
        >
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup
              variant="default"
              className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
            >
              <Dialog.Content>
                <Dialog.Header className="pb-3">
                  <Dialog.HeaderIcon>
                    <Trash2 className="h-4 w-4" />
                  </Dialog.HeaderIcon>
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Excluir equipamento?
                  </Dialog.Title>
                  <Dialog.CloseButton aria-label="Fechar dialog" />
                </Dialog.Header>
                <Dialog.Body className="flex-none">
                  <Dialog.BodyViewport className="max-h-[50vh] overflow-y-auto">
                    <Dialog.BodyContent className="space-y-2 py-2">
                      <p className="text-sm text-gray-600">
                        Tem certeza que deseja excluir o equipamento
                        {equipmentToDelete?.name ? (
                          <strong className="text-gray-800">
                            {' '}
                            &quot;{equipmentToDelete.name}&quot;
                          </strong>
                        ) : (
                          ''
                        )}
                        ? Esta ação não pode ser desfeita.
                      </p>
                    </Dialog.BodyContent>
                  </Dialog.BodyViewport>
                </Dialog.Body>
                <Dialog.Footer className="flex flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setEquipmentToDelete(null)}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </>
                    )}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  )
}

export function AdminEquipmentsPage(
  _props: import('../model/tipos').EquipmentImagePort = {}
) {
  const scope = useEquipmentScope(null)
  return <AdminEquipmentsPageContent key={scope} />
}
