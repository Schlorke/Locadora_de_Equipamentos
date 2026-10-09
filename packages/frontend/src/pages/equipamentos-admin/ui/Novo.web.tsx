'use client'

import { useEquipmentScope } from '../model/escopo'

import { useNewEquipment } from '../model/use-new-equipment'
import { useEquipmentUpload } from '../model/use-equipment-upload'

import { EquipmentPricingSelector } from './SeletorPreco.web'
import { ImageZoomModal } from './ModalZoomImagem.web'
import { PricingPeriodCard } from './CartaoPeriodo.web'
import { SpecificationsSection } from './SecaoEspecificacoes.web'
import { type PricingPeriod } from '../model/tipos'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { CurrencyInput } from '@gb-locacoes/ui'
import { CustomSelect, CustomSelectItem } from '@gb-locacoes/ui'
import { HybridTooltip } from '@gb-locacoes/ui'
import { ImageUpload } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Switch } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import { ArrowLeft, Info, Package, Save } from 'lucide-react'
import { Link } from '@gb-locacoes/ui'
import { useRouter } from 'next/navigation'
import type * as React from 'react'

function NovoEquipamentoPageContent() {
  const router = useRouter()
  const {
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
  } = useNewEquipment((href) => router.push(href))
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
  const uploadBody = useEquipmentUpload(api, apiClient)
  const uploadFile = (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return uploadBody(body)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto space-y-6">
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
                    Novo Equipamento
                  </h1>
                  <p className="text-orange-50 font-medium">
                    Adicione um novo equipamento ao catálogo de locação
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
          {/* Formulário Completo do Equipamento */}
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
                  Preencha todas as informações necessárias para cadastrar o
                  equipamento
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
                          <Label
                            htmlFor="name"
                            className="text-sm font-medium text-gray-700"
                          >
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
                            onKeyDown={handleKeyDown}
                            placeholder="Ex: Betoneira 400L"
                            required
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label
                            htmlFor="category"
                            className="text-sm font-medium text-gray-700"
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
                            className="text-sm font-medium text-gray-700"
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
                            onKeyDown={handleKeyDown}
                            placeholder="Descreva as características e usos do equipamento..."
                            rows={4}
                            required
                            className="mt-2"
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
                            className="cursor-pointer text-sm text-gray-700"
                          >
                            Equipamento disponível para locação
                          </Label>
                        </div>

                        {/* Rental Period Configuration */}
                        <div className="space-y-6 border-t border-gray-100 pt-4">
                          <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-orange-600">
                                3
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
                                  onKeyDown={handleKeyDown}
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
                                onKeyDown={handleKeyDown}
                                required={hasAnyPercentageDiscount}
                                disabled={!hasAnyPercentageDiscount}
                                className="mt-2 border-gray-200 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
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
                          2
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900">
                        Imagens do Equipamento
                      </h3>
                    </div>

                    <ImageUpload
                      uploadFile={uploadFile}
                      images={formData.images}
                      onImagesChange={(images) =>
                        setFormData((prev) => ({ ...prev, images }))
                      }
                      maxImages={5}
                      currentImageIndex={currentImageIndex}
                      onImageIndexChange={setCurrentImageIndex}
                      onImageZoom={() => setIsImageZoomed(true)}
                      nextImage={nextImage}
                      prevImage={prevImage}
                      goToImage={goToImage}
                      tooltipContent={
                        <>
                          💡 <strong>Novo Equipamento:</strong> Adicione até 5
                          imagens. A primeira será a imagem principal exibida
                          nas listagens e buscas.
                        </>
                      }
                    />

                    {/* Seção: Especificações Técnicas */}
                    <SpecificationsSection
                      specifications={formData.specifications || {}}
                      onAdd={handleAddSpecification}
                      onRemove={handleRemoveSpecification}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>

                {/* Botões de Ação - Posicionados no canto inferior direito */}
                <div className="flex justify-end pt-6 mt-8 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      type="button"
                      asChild
                      className="w-full sm:w-auto hover:text-orange-500 border-gray-200 hover:bg-gray-50"
                    >
                      <Link href="/admin/equipamentos">Cancelar</Link>
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-slate-700 text-primary-foreground hover:bg-slate-600 hover:scale-105 hover:shadow-lg transition-all duration-300 w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isLoading ? 'Salvando...' : 'Salvar Equipamento'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </form>
      </div>

      {/* Modal de Zoom da Imagem */}
      <ImageZoomModal
        images={formData.images}
        currentIndex={currentImageIndex}
        isOpen={isImageZoomed}
        onClose={() => setIsImageZoomed(false)}
        onNext={nextImage}
        onPrev={prevImage}
      />
    </div>
  )
}

export function NovoEquipamentoPage() {
  const scope = useEquipmentScope(null)
  return <NovoEquipamentoPageContent key={scope} />
}
