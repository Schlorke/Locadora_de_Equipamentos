'use client'
import { useAddresses, useAddressesScope } from '../model/use-addresses'

import { Button } from '@gb-locacoes/ui'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { ClientAreaBadge } from '../../../features/selo-area-cliente'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { motion } from 'framer-motion'
import {
  Edit,
  Home,
  MapPin,
  Plus,
  Save,
  Star,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'

function EnderecosPageContent() {
  const {
    addresses,
    isAdding,
    setIsAdding,
    editingId,
    isLoading,
    isSubmitting,
    isDeleting,
    formData,
    handleInputChange,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleSetPrimary,
    handleCancel,
    formatCEP,
  } = useAddresses()

  return (
    <div className="min-h-screen bg-gray-50 pt-[84px] sm:pt-0">
      {/* Hero Section com Identidade Visual Completa */}
      <section
        id="dashboard-banner"
        className="relative bg-gradient-to-br from-orange-600 via-orange-700 to-orange-800 text-white overflow-hidden w-screen -ml-4 sm:w-full sm:ml-0"
      >
        {/* Elementos animados de background removidos nesta seção da área do cliente */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 lg:py-14 relative z-10">
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold leading-tight">Endereços</h1>
            <p className="text-base md:text-lg text-white leading-relaxed max-w-2xl mx-auto">
              Gerencie seus endereços de entrega e retirada
            </p>
          </motion.div>
        </div>

        {/* Onda SVG no final */}
        <div className="relative w-full overflow-hidden">
          <svg
            className="relative block w-full h-6"
            data-name="Layer 1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"
              fill={
                '#f9fafb' /* token-check-allow: onda SVG da página de endereços; gray-50 ainda não está na paleta */
              }
            />
          </svg>
        </div>
      </section>

      {/* Dashboard Principal - LAYOUT OTIMIZADO */}
      <section className="py-12 md:py-16 lg:py-10 relative -mt-20 md:-mt-24 overflow-visible">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-visible">
          {/* Seções Principais - Layout Proporcional à linha superior */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Adicionar Endereço */}
            <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full border-0">
              <CardHeader className="relative z-10 pb-4 md:pb-6 lg:pb-8">
                <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white">
                    <Plus className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  Adicionar Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 pt-0 flex flex-col flex-1 justify-between">
                <div className="text-center flex flex-col flex-1 justify-center">
                  <Plus className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-8">
                    Adicione novos endereços de entrega
                  </p>
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-2 w-full">
                  <Button
                    onClick={() => setIsAdding(true)}
                    size="default"
                    className="flex-1 min-w-0 rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Endereço
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Endereço Principal */}
            <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full border-0">
              <CardHeader className="relative z-10 pb-4 md:pb-6 lg:pb-8">
                <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white">
                    <Home className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  Endereço Principal
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 pt-0 flex flex-col flex-1 justify-between">
                {addresses.find((a) => a.isPrimary) ? (
                  <div className="flex flex-col flex-1 justify-between">
                    {(() => {
                      const primaryAddress = addresses.find((a) => a.isPrimary)!
                      return (
                        <div className="flex flex-col flex-1 justify-between">
                          <div className="group p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all duration-300 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="h-5 w-5 text-gray-600" />
                              <span className="font-bold text-gray-900">
                                {primaryAddress.street}, {primaryAddress.number}
                              </span>
                            </div>
                            {primaryAddress.complement && (
                              <p className="text-sm text-gray-700 mb-1">
                                {primaryAddress.complement}
                              </p>
                            )}
                            <p className="text-sm text-gray-700">
                              {primaryAddress.neighborhood} -{' '}
                              {primaryAddress.city}/{primaryAddress.state}
                            </p>
                          </div>
                          <div className="flex flex-wrap md:flex-nowrap gap-2 w-full">
                            <Button
                              onClick={() => handleEdit(primaryAddress)}
                              variant="outline"
                              className="flex-1 min-w-0 bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 justify-between">
                    <div className="text-center flex flex-col flex-1 justify-center">
                      <Home className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-8">
                        Nenhum endereço principal definido
                      </p>
                    </div>
                    <div className="flex flex-wrap md:flex-nowrap gap-2 w-full">
                      <Button
                        onClick={() => setIsAdding(true)}
                        size="default"
                        className="flex-1 min-w-0 rounded-lg"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Definir Endereço Principal
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Formulário de Adicionar/Editar */}
          {isAdding && (
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl border-0">
                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-gray-900">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg text-white">
                      {editingId ? (
                        <Edit className="h-4 w-4 md:h-5 md:w-5" />
                      ) : (
                        <Plus className="h-4 w-4 md:h-5 md:w-5" />
                      )}
                    </div>
                    {editingId ? 'Editar Endereço' : 'Adicionar Novo Endereço'}
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base">
                    Preencha os dados do endereço de entrega
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="street"
                          className="text-sm font-medium text-gray-700"
                        >
                          Rua
                        </Label>
                        <Input
                          id="street"
                          name="street"
                          value={formData.street}
                          onChange={handleInputChange}
                          required
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="number"
                          className="text-sm font-medium text-gray-700"
                        >
                          Número
                        </Label>
                        <Input
                          id="number"
                          name="number"
                          value={formData.number}
                          onChange={handleInputChange}
                          required
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="complement"
                          className="text-sm font-medium text-gray-700"
                        >
                          Complemento
                        </Label>
                        <Input
                          id="complement"
                          name="complement"
                          value={formData.complement}
                          onChange={handleInputChange}
                          placeholder="Apto, sala, etc."
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="neighborhood"
                          className="text-sm font-medium text-gray-700"
                        >
                          Bairro
                        </Label>
                        <Input
                          id="neighborhood"
                          name="neighborhood"
                          value={formData.neighborhood}
                          onChange={handleInputChange}
                          required
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="city"
                          className="text-sm font-medium text-gray-700"
                        >
                          Cidade
                        </Label>
                        <Input
                          id="city"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          required
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="state"
                          className="text-sm font-medium text-gray-700"
                        >
                          Estado
                        </Label>
                        <Input
                          id="state"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          required
                          maxLength={2}
                          placeholder="RS"
                          className="rounded-md"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label
                          htmlFor="zipCode"
                          className="text-sm font-medium text-gray-700"
                        >
                          CEP
                        </Label>
                        <Input
                          id="zipCode"
                          name="zipCode"
                          value={formData.zipCode}
                          onChange={handleInputChange}
                          required
                          placeholder="00000-000"
                          maxLength={9}
                          className="rounded-md"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button
                        type="submit"
                        variant="outline"
                        size="default"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto sm:flex-1 min-w-0 bg-slate-700 border disabled:opacity-50 disabled:pointer-events-none duration-200 focus:outline-hidden font-medium gap-2 h-10 hover:bg-slate-600 hover:text-white hover:scale-105 hover:shadow-lg inline-flex items-center justify-center px-4 py-2 rounded-md shadow-md text-sm text-white transition-all whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {isSubmitting
                          ? 'Salvando...'
                          : editingId
                            ? 'Atualizar'
                            : 'Adicionar'}{' '}
                        Endereço
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        className="w-full sm:w-auto sm:flex-1 min-w-0 bg-white hover:bg-white text-gray-900 hover:text-orange-600 font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl border border-gray-200"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Lista de Endereços */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Card className="relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-transparent opacity-50"></div>
              <CardHeader className="relative z-10 pb-4 md:pb-6 lg:pb-8">
                <CardTitle className="flex items-center gap-3 text-lg md:text-xl font-bold text-gray-900">
                  <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg text-white">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  Todos os Endereços
                </CardTitle>
                <CardDescription className="text-sm md:text-base">
                  {addresses.length} endereço(s) cadastrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 pt-0">
                {isLoading ? (
                  <div className="text-center py-16">
                    <Loader2 className="h-16 w-16 text-gray-300 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-500 text-lg mb-4">
                      Carregando endereços...
                    </p>
                  </div>
                ) : addresses.length > 0 ? (
                  <div className="space-y-6">
                    {addresses.map((address) => (
                      <div
                        key={address.id}
                        className="p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group relative z-0"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Header com ícone, endereço e badge */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                              <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 md:h-5 md:w-5 text-gray-500 shrink-0" />
                                <span className="font-medium text-gray-900 text-sm md:text-base">
                                  {address.street}, {address.number}
                                </span>
                              </div>
                              {address.isPrimary && (
                                <ClientAreaBadge className="bg-orange-100 text-orange-800 self-start sm:self-center shrink-0">
                                  <Star className="h-3 w-3 mr-1" />
                                  Principal
                                </ClientAreaBadge>
                              )}
                            </div>
                            {/* Detalhes do endereço */}
                            <div className="space-y-1 ml-7 md:ml-8">
                              {address.complement && (
                                <p className="text-xs md:text-sm text-gray-600">
                                  {address.complement}
                                </p>
                              )}
                              <p className="text-xs md:text-sm text-gray-600">
                                {address.neighborhood} - {address.city}/
                                {address.state}
                              </p>
                              <p className="text-xs md:text-sm text-gray-600">
                                CEP: {formatCEP(address.zipCode)}
                              </p>
                            </div>
                          </div>

                          {/* Botões de ação responsivos */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 mt-4 lg:mt-0 lg:ml-4">
                            {!address.isPrimary && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetPrimary(address.id)}
                                className="w-full sm:w-auto sm:flex-none border-0 bg-white hover:scale-100 hover:bg-white text-gray-900 hover:text-orange-600 font-semibold text-sm rounded-lg transition-all duration-300 shadow-md hover:shadow-lg"
                              >
                                <Star className="h-4 w-4 mr-1" />
                                Principal
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(address)}
                              className="w-full sm:w-auto sm:flex-none border-0 bg-white hover:scale-100 hover:bg-white text-gray-900 hover:text-orange-600 font-semibold text-sm rounded-lg transition-all duration-300 shadow-md hover:shadow-lg"
                            >
                              <Edit className="h-4 w-4 mr-1 sm:mr-0" />
                              <span className="sm:hidden">Editar</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(address.id)}
                              disabled={isDeleting === address.id}
                              className="w-full sm:w-auto sm:flex-none border-0 bg-white hover:scale-100 hover:bg-red-50 text-red-600 hover:text-red-700 font-semibold text-sm rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50"
                            >
                              {isDeleting === address.id ? (
                                <Loader2 className="h-4 w-4 mr-1 sm:mr-0 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-1 sm:mr-0" />
                              )}
                              <span className="sm:hidden">
                                {isDeleting === address.id
                                  ? 'Excluindo...'
                                  : 'Excluir'}
                              </span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-4">
                      Nenhum endereço cadastrado
                    </p>
                    <Button
                      onClick={() => setIsAdding(true)}
                      size="default"
                      className="rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Primeiro Endereço
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export function EnderecosPage() {
  return <EnderecosPageContent key={useAddressesScope()} />
}
