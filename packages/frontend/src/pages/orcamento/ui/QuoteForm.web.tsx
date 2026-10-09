'use client'

import { AnimatePresence, motion } from 'framer-motion'

import { Controller } from 'react-hook-form'

import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'

import {
  ArrowLeft,
  ArrowRight,
  Building,
  Calendar,
  Check,
  Mail,
  MessageSquare,
  Package,
  Phone,
} from 'lucide-react'
import { useQuoteForm, type QuoteFormProps } from '../model/use-quote-form'
import { useWhatsAppCarregado } from '../model/whatsapp-da-locadora'
export default function QuoteForm(props: QuoteFormProps) {
  const {
    currentStep,
    totalSteps,
    formatCPF,
    formatCNPJ,
    formatCEP,
    control,
    handleSubmit,
    errors,
    isValid,
    setValue,
    watchedData,
    nextStep,
    previousStep,
    onSubmit,
    handleWhatsAppSubmit,
    stepTitles,
    variant,
    onCancel,
  } = useQuoteForm(
    {
      ...props,
      clearQuery: () => {
        if (typeof window !== 'undefined' && window.history?.replaceState)
          window.history.replaceState({}, '', window.location.pathname)
      },
    },
    // Web: o WhatsApp já lido ao montar; o clique abre a janela sem esperar a rede (bloqueador de pop-ups).
    useWhatsAppCarregado()
  )
  const prefilledEquipment = props.prefilledEquipment
  const getStepIcon = (step: number) => {
    switch (step) {
      case 1:
        return <Phone className="w-5 h-5" />
      case 2:
        return <Package className="w-5 h-5" />
      case 3:
        return <MessageSquare className="w-5 h-5" />
      default:
        return null
    }
  }
  return (
    <Card
      className={
        variant === 'modal' ? 'w-full max-w-2xl' : 'w-full max-w-4xl mx-auto'
      }
    >
      <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            {getStepIcon(currentStep)}
            Solicitar Orçamento
          </CardTitle>
          {variant === 'modal' && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-white hover:bg-white/20"
            >
              ×
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            {stepTitles.map((title, index) => (
              <span
                key={index}
                className={`${
                  currentStep > index + 1
                    ? 'text-green-200'
                    : currentStep === index + 1
                      ? 'text-white font-semibold'
                      : 'text-orange-200'
                }`}
              >
                {currentStep > index + 1 && (
                  <Check className="w-4 h-4 inline mr-1" />
                )}
                {title}
              </span>
            ))}
          </div>
          <div className="w-full bg-orange-400/30 rounded-full h-2">
            <motion.div
              className="bg-white h-2 rounded-full"
              initial={{ width: '33%' }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} suppressHydrationWarning>
          <AnimatePresence mode="wait">
            {/* Etapa 1: Informações Pessoais */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="customerName"
                      className="flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Nome Completo *
                    </Label>
                    <Controller
                      name="customerName"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="customerName"
                          placeholder="Seu nome completo"
                          aria-invalid={errors.customerName ? true : undefined}
                        />
                      )}
                    />
                    {errors.customerName && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.customerName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="customerPhone"
                      className="flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Telefone/WhatsApp *
                    </Label>
                    <Controller
                      name="customerPhone"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="customerPhone"
                          type="tel"
                          placeholder="(51) 99999-9999"
                          aria-invalid={errors.customerPhone ? true : undefined}
                        />
                      )}
                    />
                    {errors.customerPhone && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.customerPhone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label
                      htmlFor="customerEmail"
                      className="flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      E-mail *
                    </Label>
                    <Controller
                      name="customerEmail"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="customerEmail"
                          type="email"
                          placeholder="seu@email.com"
                          aria-invalid={errors.customerEmail ? true : undefined}
                        />
                      )}
                    />
                    {errors.customerEmail && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.customerEmail.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Controller
                      name="cep"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="cep"
                          placeholder="00000-000"
                          maxLength={9}
                          onChange={(e) => {
                            const formatted = formatCEP(e.target.value)
                            field.onChange(formatted)
                          }}
                          aria-invalid={errors.cep ? true : undefined}
                        />
                      )}
                    />
                    {errors.cep && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.cep.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="customerCompany"
                    className="flex items-center gap-2"
                  >
                    <Building className="w-4 h-4" />
                    Empresa (opcional)
                  </Label>
                  <Controller
                    name="customerCompany"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="customerCompany"
                        placeholder="Nome da sua empresa"
                      />
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Etapa 2: Equipamento e Período */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {prefilledEquipment && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-700 mb-2">
                      Equipamento selecionado:
                    </p>
                    <Badge
                      variant="secondary"
                      className="bg-orange-100 text-orange-800"
                    >
                      {prefilledEquipment.name}
                    </Badge>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cpf">CPF</Label>
                    <Controller
                      name="cpf"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="cpf"
                          placeholder="000.000.000-00"
                          maxLength={14}
                          onChange={(e) => {
                            const formatted = formatCPF(e.target.value)
                            field.onChange(formatted)
                          }}
                          aria-invalid={errors.cpf ? true : undefined}
                        />
                      )}
                    />
                    {errors.cpf && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.cpf.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Controller
                      name="cnpj"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="cnpj"
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                          onChange={(e) => {
                            const formatted = formatCNPJ(e.target.value)
                            field.onChange(formatted)
                          }}
                          aria-invalid={errors.cnpj ? true : undefined}
                        />
                      )}
                    />
                    {errors.cnpj && (
                      <p className="text-red-500 text-sm mt-1">
                        {errors.cnpj.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="rentalDays"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Período de Locação (dias) *
                  </Label>
                  <Controller
                    name="rentalDays"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => (
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        max="365"
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        aria-invalid={errors.rentalDays ? true : undefined}
                      />
                    )}
                  />
                  {errors.rentalDays && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.rentalDays.message}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[7, 15, 30].map((days) => (
                      <Button
                        key={days}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setValue('rentalDays', days)}
                        className={
                          watchedData.rentalDays === days
                            ? 'bg-orange-100 border-orange-300'
                            : ''
                        }
                      >
                        {days} dias
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    Urgência do Projeto
                  </Label>
                  <Controller
                    name="urgency"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            value: 'baixa',
                            label: 'Baixa',
                            color: 'bg-green-100 text-green-800',
                          },
                          {
                            value: 'media',
                            label: 'Média',
                            color: 'bg-yellow-100 text-yellow-800',
                          },
                          {
                            value: 'alta',
                            label: 'Alta',
                            color: 'bg-red-100 text-red-800',
                          },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            onClick={() => onChange(option.value)}
                            className={
                              value === option.value ? option.color : ''
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Etapa 3: Detalhes Finais */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="message" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Informações Adicionais (opcional)
                  </Label>
                  <Controller
                    name="message"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        {...field}
                        id="message"
                        placeholder="Detalhes específicos do projeto, endereço de entrega, horário preferencial..."
                        rows={4}
                      />
                    )}
                  />
                </div>

                {/* Resumo do Orçamento */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold mb-3">Resumo do Orçamento</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Nome:</span>
                      <span className="font-medium">
                        {watchedData.customerName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equipamento:</span>
                      <span className="font-medium">
                        {watchedData.equipmentName ||
                          prefilledEquipment?.name ||
                          'A definir'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Período:</span>
                      <span className="font-medium">
                        {watchedData.rentalDays} dias
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Urgência:</span>
                      <span className="font-medium capitalize">
                        {watchedData.urgency}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </Button>

            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
              >
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleWhatsAppSubmit}
                disabled={!isValid}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 w-full hover:scale-105 transition-transform duration-200"
                size="lg"
              >
                <Check className="w-4 h-4" />
                Solicitar Orçamento
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
