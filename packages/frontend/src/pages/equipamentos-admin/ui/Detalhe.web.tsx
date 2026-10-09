'use client'

import { useEquipmentScope } from '../model/escopo'

import { useEquipmentDetails } from '../model/use-equipment-details'

import { ImageCarouselZoom } from './ImageCarouselZoom.web'
import { EquipmentUnitsManager } from './GerenciadorUnidades'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import * as LucideIcons from 'lucide-react'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  Info,
  Package,
  Trash2,
} from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import { useParams, useRouter } from 'next/navigation'
import React, { useMemo } from 'react'
import { motion } from 'framer-motion'

import type { EquipmentDetailsPageProps } from '../model/tipos'

function EquipmentDetailsPageContent() {
  const params = useParams()
  // Extrair valores imediatamente para evitar enumeração do objeto params
  const equipmentId = typeof params.id === 'string' ? params.id : null
  const router = useRouter()
  const ports = useMemo(
    () => ({
      navigate: (href: string) => router.push(href),
      requestConfirmation: (message: string) => confirm(message),
    }),
    [router]
  )
  const { equipment, isLoading, isDeleting, handleDelete } =
    useEquipmentDetails(equipmentId, ports)

  if (isLoading) {
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

  if (!equipment) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">
            Equipamento não encontrado
          </h2>
          <p className="text-muted-foreground mb-4">
            O equipamento solicitado não existe ou foi removido.
          </p>
          <Button asChild>
            <Link href="/admin/equipamentos">Voltar para Equipamentos</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="shrink-0 bg-transparent"
          >
            <Link href="/admin/equipamentos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Voltar</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
              {equipment.name}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Detalhes do equipamento
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:w-auto bg-transparent"
          >
            <Link href={`/admin/equipamentos/${equipment.id}/editar`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Galeria de Imagens */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <ImageCarouselZoom
              images={
                equipment.images.length > 0
                  ? equipment.images
                  : ['/placeholder.svg?height=400&width=400']
              }
              altText={equipment.name}
            />
          </CardContent>
        </Card>

        {/* Informações Principais */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Info className="h-4 w-4 sm:h-5 sm:w-5" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Categoria
                </label>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className="text-sm inline-flex items-center gap-1.5 max-w-[250px] shrink-0"
                    style={{
                      backgroundColor: equipment.category.bgColor || undefined,
                      color: equipment.category.fontColor || undefined,
                      borderColor: equipment.category.bgColor
                        ? 'transparent'
                        : undefined,
                    }}
                  >
                    {equipment.category.icon &&
                      (() => {
                        const IconComponent =
                          LucideIcons[
                            equipment.category.icon as keyof typeof LucideIcons
                          ]
                        if (
                          IconComponent &&
                          typeof IconComponent === 'function'
                        ) {
                          const Icon = IconComponent as React.ComponentType<{
                            size?: number
                            color?: string
                            className?: string
                          }>
                          return (
                            <Icon
                              size={14}
                              color={
                                equipment.category.iconColor ||
                                equipment.category.fontColor ||
                                'currentColor'
                              }
                              className="shrink-0"
                            />
                          )
                        }
                        return null
                      })()}
                    <span className="truncate min-w-0">
                      {equipment.category.name}
                    </span>
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Preço por Dia
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xl sm:text-2xl font-bold text-green-600">
                    R$ {equipment.pricePerDay.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="mt-1">
                  <Badge
                    variant={equipment.isAvailable ? 'default' : 'destructive'}
                    className="text-sm"
                  >
                    {equipment.isAvailable ? 'Disponível' : 'Indisponível'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Orçamentos
                  </label>
                  <p className="text-lg font-semibold">
                    {equipment._count?.quoteItems || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Avaliações
                  </label>
                  <p className="text-lg font-semibold">
                    {equipment._count?.reviews || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Criado em
                </label>
                <p className="text-sm">
                  {new Date(equipment.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Última atualização
                </label>
                <p className="text-sm">
                  {new Date(equipment.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Descrição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Descrição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {equipment.description}
          </p>
        </CardContent>
      </Card>

      {/* Especificações Técnicas */}
      {equipment.specifications &&
        Object.keys(equipment.specifications).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Especificações Técnicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(equipment.specifications).map(
                  ([key, value]) => (
                    <div key={key} className="p-3 border rounded-lg">
                      <label className="text-sm font-medium text-muted-foreground">
                        {key}
                      </label>
                      <p className="text-sm font-semibold mt-1">
                        {String(value)}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Unidades Físicas */}
      <EquipmentUnitsManager equipmentId={equipment.id} />
    </div>
  )
}

export function EquipmentDetailsPage(_props: EquipmentDetailsPageProps = {}) {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : null
  const scope = useEquipmentScope(id)
  return <EquipmentDetailsPageContent key={scope} />
}
