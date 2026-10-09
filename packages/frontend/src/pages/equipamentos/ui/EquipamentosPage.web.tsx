"use client";
import { useEquipmentCatalog, getEquipmentReviewSummary } from '../model/use-equipment-catalog';
import type { EquipamentosPageProps } from '../model/types';
export type { EquipamentoImageProps } from '../model/types';


import { Badge, Button, Card, CardContent, CardFooter } from "../../../shared/ui";
import { useHrefResolver } from "../../../shared/lib/navigation";
import { withPublicTenant } from "../../../entities/organizacao";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Package, Search, Star } from "lucide-react";



// Removido iconMap limitado - agora usamos LucideIcons completo







export function EquipamentosPage({
  categoria,
  tenantSlug,
  image,
  link,
  filterCard,
  pagination,
  categoryBadge,
}: EquipamentosPageProps) {
  const { equipments, categories, filteredEquipments, currentEquipments, isLoading, error, searchTerm, setSearchTerm, categoryFilter, handleCategoryChange, filterKey, currentPage, totalPages, pageKey, fetchData, changePage } = useEquipmentCatalog({categoria,tenantSlug});
  // Links passam pelo resolvedor do host: legado acrescenta ?tenantSlug=, modo host mantém o caminho limpo.
  // Sem resolvedor na árvore, preserva a locadora recebida pela página.
  const resolveHref = useHrefResolver() ?? ((href: string) => withPublicTenant(href, tenantSlug ?? null));
  const detailHref = (id: string) => resolveHref(`/equipamentos/${id}`);
  const handlePageChange = (page: number) => { changePage(page); setTimeout(() => window.scrollTo({top:0,behavior:'smooth'}),100); };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">
            Carregando equipamentos...
          </p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="bg-red-100 rounded-full p-4 mb-4 w-fit mx-auto">
            <Package className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Erro ao carregar equipamentos
          </h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            onClick={fetchData}
            className="hover:scale-105 transition-transform duration-200"
          >
            Tentar Novamente
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50"
      suppressHydrationWarning
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header com gradiente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
            {/* Clean depth layers without decorative elements */}
            <div className="absolute inset-0"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>

            {/* Content */}
            <div className="relative z-10 text-center">
              <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                Catálogo de Equipamentos
              </h1>
              <p className="text-orange-50 mb-4 font-medium">
                Encontre o equipamento ideal para sua obra
              </p>
              <div className="flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit mx-auto">
                <Search className="w-5 h-5 text-orange-50" />
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

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          {filterCard({
            searchPlaceholder: "Buscar equipamentos...",
            searchValue: searchTerm,
            onSearchChange: setSearchTerm,
            filters: [
              {
                label: 'Categoria',
                value: categoryFilter,
                onValueChange: handleCategoryChange,
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
            ],
          })}
        </motion.div>

        {/* Grid de Equipamentos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {filteredEquipments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`grid-${filterKey}-${pageKey}-${searchTerm}-${categoryFilter}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0 }}
                  style={{ display: 'contents' }}
                >
                  {currentEquipments.map((equipment, index) => {
                    const {averageRating,reviewCount}=getEquipmentReviewSummary(equipment);

                    return (
                      <motion.div
                        key={`${equipment.id}-${filterKey}-${pageKey}`}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{
                          delay: index * 0.08,
                          duration: 0.3,
                          ease: 'easeOut',
                        }}
                        className="group"
                      >
                        <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm hover:shadow-2xl transition-all duration-300 h-full hover:scale-[1.02] flex flex-col">
                          {/* Clean depth layers for equipment card */}
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40"></div>

                          <div className="relative h-48 bg-gray-100 z-0 flex items-center justify-center">
                            {image({
                              src: equipment.images?.[0] || "/placeholder.svg?height=200&width=300",
                              alt: equipment.name,
                              width: 300,
                              height: 200,
                              priority: index < 3,
                              className:
                                "max-w-full max-h-full object-contain rounded-t-lg transition-transform duration-300 group-hover:scale-105",
                              style: { width: "auto", height: "auto" },
                            })}
                            {!equipment.isAvailable && (
                              <div className="absolute top-3 right-3">
                                <Badge
                                  variant="destructive"
                                  className="bg-red-500/90 backdrop-blur-sm"
                                >
                                  Indisponível
                                </Badge>
                              </div>
                            )}
                          </div>

                          <CardContent className="flex-1 p-4 relative z-0 flex flex-col">
                            <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-1">
                              {equipment.name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {equipment.description}
                            </p>

                            <div className="flex items-center gap-2 mb-4">
                              {reviewCount > 0 ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-medium">
                                      {averageRating.toFixed(1)}
                                    </span>
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    ({reviewCount}{' '}
                                    {reviewCount === 1
                                      ? 'avaliação'
                                      : 'avaliações'}
                                    )
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-500">
                                  Nenhuma avaliação
                                </span>
                              )}
                            </div>

                            <div className="mb-4">
                              <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold text-orange-600">
                                  R${' '}
                                  {equipment.pricePerDay?.toFixed(2) || '0.00'}
                                  <span className="text-sm font-normal text-gray-500">
                                    /dia
                                  </span>
                                </div>
                                {equipment.category ? (
                                  categoryBadge({
                                    name: equipment.category.name,
                                    icon: equipment.category.icon,
                                    iconColor: equipment.category.iconColor,
                                    bgColor: equipment.category.bgColor,
                                    fontColor: equipment.category.fontColor,
                                    customIcon: equipment.category.customIcon,
                                  })
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors backdrop-blur-sm max-w-[180px] shrink-0"
                                  >
                                    <span className="truncate min-w-0">
                                      Sem categoria
                                    </span>
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="mt-auto"></div>
                          </CardContent>

                          <CardFooter className="p-4 pt-0 relative z-0">
                            <div className="flex flex-col gap-2 w-full">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="w-full bg-transparent border-gray-200 hover:bg-background hover:text-foreground hover:scale-105 hover:shadow-sm transition-all duration-300 group"
                              >
                                {link({
                                  href: detailHref(equipment.id),
                                  children: (
                                    <span className="group-hover:text-orange-500 transition-colors duration-200">
                                      Ver Detalhes
                                    </span>
                                  ),
                                })}
                              </Button>
                              <Button
                                size="sm"
                                disabled={!equipment.isAvailable}
                                asChild={equipment.isAvailable}
                                className="w-full hover:scale-105 transition-all duration-300"
                              >
                                {equipment.isAvailable
                                  ? link({
                                      href: detailHref(equipment.id),
                                      children: "Solicitar Orçamento",
                                    })
                                  : (
                                      <span>Indisponível</span>
                                    )}
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30"></div>
              <CardContent className="relative z-0 flex flex-col items-center justify-center py-16">
                <div className="bg-orange-100 rounded-full p-4 mb-4">
                  <Package className="w-8 h-8 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Nenhum equipamento disponível
                </h3>
                <p className="text-[17px] text-gray-600 text-center max-w-md leading-relaxed">
                  {equipments.length === 0
                    ? 'Estamos atualizando nosso catálogo com novos equipamentos. Em breve teremos mais opções para você!'
                    : 'Que tal tentar uma categoria diferente ou ajustar os filtros de busca?'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Paginação */}
          {!isLoading && filteredEquipments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8"
            >
              {pagination({
                currentPage,
                totalPages,
                onPageChange: handlePageChange,
              })}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
