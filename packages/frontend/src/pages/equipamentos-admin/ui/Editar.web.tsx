'use client'

import { useEquipmentScope } from '../model/escopo'

import { useEditEquipment } from '../model/use-edit-equipment'
import { useEquipmentUpload } from '../model/use-equipment-upload'

import React from 'react'

import { EquipmentPricingSelector } from './SeletorPreco.web'
import { PricingPeriodCard } from './CartaoPeriodo.web'
import { SpecificationsSection } from './SecaoEspecificacoes.web'
import { type PricingPeriod } from '../model/tipos'
import { Button, FOCUS_RING } from '@gb-locacoes/ui'
import { Calendar } from '../../../widgets/seletor-data'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { CurrencyInput } from '@gb-locacoes/ui'
import { CustomSelect, CustomSelectItem } from '@gb-locacoes/ui'
import { HybridTooltip } from '@gb-locacoes/ui'
import { ImageUpload } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Switch } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { cn } from '../../../shared/lib/cn.web'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  Package,
  Pencil,
  PlusCircle,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { ptBR } from 'date-fns/locale'
import Image from 'next/image'
import { Link } from '@gb-locacoes/ui'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

function EditarEquipamentoPageContent() {
  const params = useParams()
  // Extrair valores imediatamente para evitar enumeração do objeto params
  const equipmentId = typeof params.id === 'string' ? params.id : null
  const router = useRouter()
  const {
    api,
    apiClient,
    categories,
    isLoading,
    isSaving,
    formData,
    setFormData,
    newPartsLossSelectedDate,
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
  } = useEditEquipment(equipmentId, (href) => router.push(href))
  // Função para prevenir submit ao pressionar Enter (exceto em textarea, onde Enter deve quebrar linha)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submit()
  }
  const handleClearPartsLossDate = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearPartsLossDate()
  }
  const uploadBody = useEquipmentUpload(api, apiClient)
  const uploadFile = (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return uploadBody(body)
  }
  const uploadLossBody = useEquipmentUpload(
    api,
    apiClient,
    () => lossDraft.current
  )
  const uploadLossFile = (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return uploadLossBody(body)
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12">
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
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white"
                >
                  <Link href="/admin/equipamentos">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Voltar</span>
                  </Link>
                </Button>
                <div>
                  <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                    Editar Equipamento
                  </h1>
                  <p className="text-orange-50 font-medium">
                    Atualize as informações do equipamento
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
                <Package className="w-5 h-5 text-orange-50" />
                <span className="font-semibold text-white">
                  Preencha os dados do equipamento
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm">
              <CardHeader className="relative z-10">
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Dados do Equipamento
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Atualize as informações necessárias do equipamento
                </p>
              </CardHeader>
              <CardContent className="relative z-10 space-y-8">
                {/* Layout Principal: Informações Básicas + Especificações (Esquerda) + Imagens (Direita) */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Coluna Esquerda: Informações Básicas + Especificações Técnicas */}
                  <div className="space-y-8">
                    {/* Seção: Informações Básicas */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            1
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Informações Básicas
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium">
                            Nome do Equipamento *
                          </Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Ex: Betoneira 400L"
                            required
                            className="mt-1"
                            onKeyDown={handleKeyDown}
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor="category"
                            className="text-sm font-medium"
                          >
                            Categoria *
                          </Label>
                          <CustomSelect
                            value={formData.categoryId}
                            onValueChange={(value: string) =>
                              setFormData((prev) => ({
                                ...prev,
                                categoryId: value,
                              }))
                            }
                            placeholder="Escolha uma categoria"
                          >
                            {categories
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((category) => (
                                <CustomSelectItem
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </CustomSelectItem>
                              ))}
                          </CustomSelect>
                        </div>

                        <div>
                          <Label
                            htmlFor="description"
                            className="text-sm font-medium"
                          >
                            Descrição *
                          </Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Descreva as características e usos do equipamento..."
                            rows={4}
                            required
                            className="mt-1"
                            onKeyDown={handleKeyDown}
                          />
                        </div>

                        <div className="flex items-center space-x-3 pt-2">
                          <Switch
                            id="isAvailable"
                            checked={formData.isAvailable}
                            onCheckedChange={(checked) =>
                              setFormData((prev) => ({
                                ...prev,
                                isAvailable: checked,
                              }))
                            }
                            className="data-[state=checked]:bg-slate-700 data-[state=unchecked]:bg-input hover:data-[state=checked]:bg-slate-600 transition-colors duration-200"
                          />
                          <Label
                            htmlFor="isAvailable"
                            className="cursor-pointer text-sm"
                          >
                            Equipamento disponível para locação
                          </Label>
                        </div>

                        {/* Rental Period Configuration */}
                        <div className="space-y-6 border-t border-gray-100 pt-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-orange-600">
                                2
                              </span>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">
                              Configuração de Períodos de Locação
                            </h3>
                          </div>

                          {/* Prévia em Tempo Real - Usando o Componente Original */}
                          <div
                            className="space-y-4 rounded-xl p-6 border shadow-xl backdrop-blur-sm min-h-[200px] transition-all duration-300 hover:shadow-2xl"
                            style={{
                              backgroundColor: 'rgb(248, 250, 252)', // token-check-allow: fundo da prévia pública no form admin
                              borderColor: 'rgb(224, 230, 235)', // token-check-allow: borda da prévia pública no form admin
                              borderWidth: '1.5px', // token-check-allow: espessura da borda da prévia admin
                              boxShadow:
                                'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px', // token-check-allow: sombra da prévia pública no form admin
                            }}
                          >
                            <div className="mb-4">
                              <h3 className="text-sm font-semibold text-slate-700">
                                Prévia da Interface Pública
                              </h3>
                            </div>

                            {/* Componente Exato da Interface Pública */}
                            <div className="flex justify-center">
                              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm max-w-sm w-full">
                                <EquipmentPricingSelector
                                  pricePerDay={formData.pricePerDay}
                                  dailyDiscount={formData.dailyDiscount}
                                  weeklyDiscount={formData.weeklyDiscount}
                                  biweeklyDiscount={formData.biweeklyDiscount}
                                  monthlyDiscount={formData.monthlyDiscount}
                                  popularPeriod={formData.popularPeriod}
                                  dailyDirectValue={formData.dailyDirectValue}
                                  weeklyDirectValue={formData.weeklyDirectValue}
                                  biweeklyDirectValue={
                                    formData.biweeklyDirectValue
                                  }
                                  monthlyDirectValue={
                                    formData.monthlyDirectValue
                                  }
                                  dailyUseDirectValue={
                                    formData.dailyUseDirectValue
                                  }
                                  weeklyUseDirectValue={
                                    formData.weeklyUseDirectValue
                                  }
                                  biweeklyUseDirectValue={
                                    formData.biweeklyUseDirectValue
                                  }
                                  monthlyUseDirectValue={
                                    formData.monthlyUseDirectValue
                                  }
                                  dailyRentalEnabled={
                                    formData.dailyRentalEnabled
                                  }
                                  weeklyRentalEnabled={
                                    formData.weeklyRentalEnabled
                                  }
                                  biweeklyRentalEnabled={
                                    formData.biweeklyRentalEnabled
                                  }
                                  monthlyRentalEnabled={
                                    formData.monthlyRentalEnabled
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Campos de Configuração organizados em linhas */}
                          <div className="space-y-4">
                            {/* PRIMEIRA LINHA: Quantidade Máxima e Período Popular */}
                            <div className="grid grid-cols-2 gap-4 items-start">
                              {/* Quantidade Máxima Disponível */}
                              <div>
                                <Label
                                  htmlFor="maxStock"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Quantidade Máxima Disponível *
                                </Label>
                                <Input
                                  id="maxStock"
                                  type="number"
                                  min="1"
                                  value={formData.maxStock}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      maxStock: parseInt(e.target.value) || 1,
                                    }))
                                  }
                                  placeholder="Ex: 5"
                                  required
                                  className="mt-2"
                                />
                                <p className="text-xs text-gray-500 mt-1 min-h-[16px]">
                                  Máximo disponível para locação simultânea
                                </p>
                              </div>

                              {/* Período Popular */}
                              <div>
                                <Label
                                  htmlFor="popularPeriod"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Período Popular
                                </Label>
                                <div className="mt-2">
                                  <CustomSelect
                                    value={formData.popularPeriod}
                                    onValueChange={(value: string) =>
                                      setFormData((prev) => ({
                                        ...prev,
                                        popularPeriod: value,
                                      }))
                                    }
                                    placeholder="Escolha o período popular"
                                  >
                                    <CustomSelectItem value="daily">
                                      Diário
                                    </CustomSelectItem>
                                    <CustomSelectItem value="weekly">
                                      Semanal
                                    </CustomSelectItem>
                                    <CustomSelectItem value="biweekly">
                                      Quinzenal
                                    </CustomSelectItem>
                                    <CustomSelectItem value="monthly">
                                      Mensal
                                    </CustomSelectItem>
                                  </CustomSelect>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 min-h-[16px]">
                                  Destacado com etiqueta &quot;Popular&quot;
                                </p>
                              </div>
                            </div>

                            {/* Preço por Dia - só habilitado quando ao menos um período usa desconto percentual */}
                            <div
                              className={
                                !hasAnyPercentageDiscount
                                  ? 'opacity-70'
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-1.5">
                                <Label
                                  htmlFor="pricePerDay"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Preço por Dia (R$){' '}
                                  {hasAnyPercentageDiscount ? '*' : ''}
                                </Label>
                                {(() => {
                                  const hasAnyPercentage =
                                    !formData.dailyUseDirectValue ||
                                    !formData.weeklyUseDirectValue ||
                                    !formData.biweeklyUseDirectValue ||
                                    !formData.monthlyUseDirectValue
                                  return hasAnyPercentage ? (
                                    <HybridTooltip content="💡 Para configurar percentual de desconto por período (diário, semanal, quinzenal ou mensal), defina o Preço por Dia aqui. O percentual de desconto é calculado em cima do preço por dia.">
                                      <Info
                                        className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600 shrink-0"
                                        aria-hidden
                                      />
                                    </HybridTooltip>
                                  ) : (
                                    <HybridTooltip content='💡 Ative a opção "Usar desconto percentual" em ao menos um período (diário, semanal, quinzenal ou mensal) para habilitar o Preço por Dia.'>
                                      <Info
                                        className="size-4 text-gray-400 cursor-not-allowed opacity-60 shrink-0"
                                        aria-hidden
                                      />
                                    </HybridTooltip>
                                  )
                                })()}
                              </div>
                              <CurrencyInput
                                id="pricePerDay"
                                value={formData.pricePerDay}
                                onValueChange={(value) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    pricePerDay: value || 0,
                                  }))
                                }
                                required={hasAnyPercentageDiscount}
                                disabled={!hasAnyPercentageDiscount}
                                className="mt-2 border-gray-200 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                                onKeyDown={handleKeyDown}
                              />
                            </div>

                            {/* Configuração de Preços por Período */}
                            <div className="space-y-6">
                              {(
                                [
                                  'daily',
                                  'weekly',
                                  'biweekly',
                                  'monthly',
                                ] as PricingPeriod[]
                              ).map((period) => (
                                <PricingPeriodCard
                                  key={period}
                                  period={period}
                                  rentalEnabled={
                                    formData[`${period}RentalEnabled`]
                                  }
                                  onRentalEnabledChange={(v) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      [`${period}RentalEnabled`]: v,
                                    }))
                                  }
                                  useDirectValue={
                                    formData[`${period}UseDirectValue`]
                                  }
                                  onUseDirectValueChange={(v) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      [`${period}UseDirectValue`]: v,
                                    }))
                                  }
                                  discount={formData[`${period}Discount`]}
                                  onDiscountChange={(v) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      [`${period}Discount`]: v,
                                    }))
                                  }
                                  directValue={formData[`${period}DirectValue`]}
                                  onDirectValueChange={(v) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      [`${period}DirectValue`]: v,
                                    }))
                                  }
                                  onKeyDown={handleKeyDown}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Imagens do Equipamento (Ocupando toda a altura) */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-green-600">
                          3
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Imagens do Equipamento
                      </h3>
                    </div>

                    <div className="min-h-[500px]">
                      <ImageUpload
                        uploadFile={uploadFile}
                        key="equipment-images"
                        images={formData.images}
                        onImagesChange={(imgs) => {
                          // Garantir que atualiza APENAS formData.images
                          setFormData((prev) => ({ ...prev, images: imgs }))
                        }}
                        maxImages={5}
                        currentImageIndex={currentImageIndex}
                        onImageIndexChange={setCurrentImageIndex}
                        onImageZoom={() => setIsImageZoomed(true)}
                        nextImage={nextImage}
                        prevImage={prevImage}
                        goToImage={goToImage}
                        tooltipContent={
                          <>
                            💡 <strong>Editando Imagens:</strong> A primeira
                            imagem será exibida como destaque na listagem de
                            equipamentos. Arraste para reordenar.
                          </>
                        }
                      />
                    </div>

                    {/* Seção: Especificações Técnicas */}
                    <SpecificationsSection
                      specifications={formData.specifications || {}}
                      onAdd={handleAddSpecification}
                      onRemove={handleRemoveSpecification}
                      onKeyDown={handleKeyDown}
                    />

                    {/* Registro de Perdas de Peças e Avarias */}
                    <div className="space-y-6 border-t border-gray-100 pt-6">
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-red-600">
                            5
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">
                          Registro de Perdas de Peças e Avarias
                        </h3>
                        <HybridTooltip
                          content="💡 Esta área permite registrar perdas de peças e avarias nos equipamentos. Essas informações são essenciais para controle de estoque, cobrança de taxas de avaria nos orçamentos e tomada de decisões sobre manutenção dos equipamentos."
                          side="top"
                          align="center"
                        >
                          <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
                        </HybridTooltip>
                      </div>

                      {/* Contador de perdas */}
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-red-700">
                              Total de Perdas Registradas
                            </div>
                            <div className="text-2xl font-bold text-red-900 mt-1">
                              {formData.partsLossCount || 0}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Histórico de perdas */}
                      {formData.partsLossHistory &&
                        formData.partsLossHistory.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Histórico de Perdas
                            </Label>
                            <div className="space-y-2 overflow-visible">
                              {formData.partsLossHistory.map((loss, index) => (
                                <div
                                  key={index}
                                  className="flex items-start justify-between p-3 bg-gray-50/50 rounded-lg border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Thumbnail da primeira imagem */}
                                    {loss.images && loss.images.length > 0 && (
                                      <div className="shrink-0">
                                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                                          <Image
                                            src={loss.images[0]!}
                                            alt={`Imagem da perda: ${loss.description}`}
                                            fill
                                            className="object-cover"
                                            sizes="64px"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 text-left">
                                        {loss.description}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 text-left">
                                        Data:{' '}
                                        {new Date(loss.date).toLocaleDateString(
                                          'pt-BR'
                                        )}{' '}
                                        - Quantidade: {loss.quantity}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditPartsLoss(index)}
                                      className="h-8 w-8 hover:bg-white"
                                      title="Editar registro"
                                    >
                                      <Pencil className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const handleConfirm = () =>
                                          handleRemovePartsLoss(index)

                                        toast.warning(
                                          <span
                                            className="font-bold cursor-pointer hover:text-orange-700 transition-colors"
                                            onClick={handleConfirm}
                                          >
                                            Confirmar remoção?
                                          </span>,
                                          {
                                            description: (
                                              <span>
                                                Deseja realmente remover o
                                                registro{' '}
                                                <strong className="font-bold">
                                                  &quot;{loss.description}&quot;
                                                </strong>
                                                ? Esta ação não pode ser
                                                desfeita.
                                              </span>
                                            ),
                                            action: {
                                              label: 'Confirmar',
                                              onClick: handleConfirm,
                                            },
                                            cancel: {
                                              label: 'Cancelar',
                                              onClick: () => {},
                                            },
                                          }
                                        )
                                      }}
                                      className="h-8 w-8 hover:bg-white"
                                      title="Remover registro"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Formulário para adicionar/editar perda */}
                      <div className="bg-white/50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {editingPartsLossIndex !== null
                              ? 'Editar Registro de Perda'
                              : 'Adicionar Novo Registro de Perda'}
                          </h4>
                          {editingPartsLossIndex !== null && (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEditPartsLoss}
                                className="bg-white text-gray-700 hover:text-orange-600"
                              >
                                Cancelar Edição
                              </Button>
                              <Button
                                type="button"
                                onClick={handleSavePartsLoss}
                                className="bg-slate-700 text-white border border-slate-700 shadow-md hover:bg-slate-600 hover:border-slate-600 hover:scale-105 hover:shadow-lg transition-all duration-200"
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Aplicar Alterações
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <Label
                                htmlFor="partsLossDate"
                                className="text-sm font-medium"
                              >
                                Data da Perda
                              </Label>
                              <div className="mt-1 space-y-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPartsLossCalendarOpen(
                                      !isPartsLossCalendarOpen
                                    )
                                  }}
                                  className={cn(
                                    'flex h-10 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors overflow-hidden',
                                    'hover:bg-gray-50',
                                    'disabled:cursor-not-allowed disabled:opacity-50',
                                    !newPartsLossSelectedDate
                                      ? 'justify-center text-gray-500'
                                      : 'justify-center relative'
                                  )}
                                >
                                  {!newPartsLossSelectedDate ? (
                                    <div className="flex items-center gap-2">
                                      <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
                                      <span className="whitespace-nowrap">
                                        {partsLossDateDisplayText}
                                      </span>
                                      <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
                                    </div>
                                  ) : (
                                    <>
                                      <span className="flex-1 text-center whitespace-nowrap">
                                        {partsLossDateDisplayText}
                                      </span>
                                      <X
                                        className="h-4 w-4 text-gray-400 hover:text-gray-600 absolute right-3"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleClearPartsLossDate(e)
                                        }}
                                      />
                                    </>
                                  )}
                                </button>

                                {/* Calendário inline - aparece quando isPartsLossCalendarOpen é true */}
                                {isPartsLossCalendarOpen && (
                                  <div className="border border-gray-200 rounded-md bg-white p-0 shadow-md overflow-hidden max-w-full">
                                    <Calendar
                                      mode="single"
                                      defaultMonth={
                                        newPartsLossSelectedDate || today
                                      }
                                      month={newPartsLossSelectedDate || today}
                                      selected={
                                        newPartsLossSelectedDate || undefined
                                      }
                                      onSelect={handlePartsLossDateSelect}
                                      numberOfMonths={1}
                                      disabled={isPartsLossDateDisabled}
                                      locale={ptBR}
                                      toDate={today}
                                      showOutsideDays={false}
                                      includeWeekends={true}
                                    />
                                    <div className="border-t border-gray-200 px-3 py-2">
                                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                        <div>
                                          Selecione a data em que ocorreu a
                                          perda
                                        </div>
                                        {newPartsLossSelectedDate && (
                                          <div className="text-green-600 font-medium">
                                            ✓ Data selecionada:{' '}
                                            {partsLossDateDisplayText}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <Label
                                htmlFor="partsLossDescription"
                                className="text-sm font-medium"
                              >
                                Descrição da Perda
                              </Label>
                              <Input
                                id="partsLossDescription"
                                value={newPartsLossDescription}
                                onChange={(e) =>
                                  setNewPartsLossDescription(e.target.value)
                                }
                                placeholder="Ex: Perda de parafusos, peças quebradas, etc."
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label
                                htmlFor="partsLossQuantity"
                                className="text-sm font-medium"
                              >
                                Quantidade
                              </Label>
                              <Input
                                id="partsLossQuantity"
                                type="text"
                                min="1"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={newPartsLossQuantity}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === 'e' ||
                                    e.key === 'E' ||
                                    e.key === '+' ||
                                    e.key === '-' ||
                                    e.key === '.' ||
                                    e.key === ','
                                  ) {
                                    e.preventDefault()
                                  }
                                }}
                                onChange={(e) => {
                                  const onlyDigits = e.target.value.replace(
                                    /\D/g,
                                    ''
                                  )
                                  setNewPartsLossQuantity(onlyDigits)
                                }}
                                placeholder="Ex: 5"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Label className="text-sm font-medium">
                                  Fotos da Avaria/Perda (Opcional)
                                </Label>
                                <HybridTooltip
                                  content={
                                    <>
                                      💡 Adicione até 5 fotos para documentar a
                                      avaria ou peça perdida
                                    </>
                                  }
                                  side="top"
                                  align="center"
                                >
                                  <Info className="size-4 text-gray-700 cursor-help transition-colors hover:text-orange-600" />
                                </HybridTooltip>
                              </div>
                              <ImageUpload
                                uploadFile={uploadLossFile}
                                key="parts-loss-images"
                                images={newPartsLossImages}
                                onImagesChange={(imgs) => {
                                  // Garantir que atualiza APENAS newPartsLossImages
                                  setNewPartsLossImages(imgs)
                                }}
                                maxImages={5}
                                sectionTitle="Fotos da Avaria/Perda"
                              />
                            </div>
                          </div>
                          {editingPartsLossIndex === null && (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleSavePartsLoss}
                                className="w-fit px-4 bg-transparent border-gray-200 hover:bg-background hover:text-foreground hover:scale-105 hover:shadow-sm transition-all duration-300 group"
                              >
                                <PlusCircle className="h-4 w-4 mr-2 group-hover:text-red-500 transition-colors duration-200" />
                                <span className="group-hover:text-red-500 transition-colors duration-200">
                                  Adicionar Registro de Perda
                                </span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação - Posicionados no canto inferior direito */}
                <div className="flex justify-end pt-6 mt-8 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      type="button"
                      asChild
                      className="w-full sm:w-auto hover:text-orange-500 bg-transparent"
                    >
                      <Link href="/admin/equipamentos">Cancelar</Link>
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </form>
      </div>

      {/* Modal de Zoom da Imagem */}
      {isImageZoomed && formData.images.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setIsImageZoomed(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <Image
              src={formData.images[currentImageIndex] || ''}
              alt={`Equipamento - Imagem ${currentImageIndex + 1}`}
              fill
              className="object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Navegação no modal */}
            {formData.images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    prevImage()
                  }}
                  title="Imagem anterior"
                  aria-label="Navegar para imagem anterior"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    nextImage()
                  }}
                  title="Próxima imagem"
                  aria-label="Navegar para próxima imagem"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full p-3 shadow-lg hover:scale-110 transition-all duration-200"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Indicador de imagem atual */}
            <div className="absolute top-[100px] left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentImageIndex + 1} de {formData.images.length}
            </div>

            {/* Botão de fechar */}
            <button
              onClick={() => setIsImageZoomed(false)}
              title="Fechar"
              aria-label="Fechar visualização"
              className={cn(
                'absolute top-[90px] right-4 flex items-end justify-start bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-lg hover:scale-110 transition-all duration-200 text-right focus:shadow-none',
                FOCUS_RING
              )}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function EditarEquipamentoPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : null
  const scope = useEquipmentScope(id)
  return <EditarEquipamentoPageContent key={scope} />
}
