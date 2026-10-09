'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import {
  MapPin,
  Building2,
  Navigation,
  Map,
  Phone,
  FileText,
  Building,
  User,
  Loader2,
} from 'lucide-react'
import type { AddressData } from '@gb-locacoes/ui'
import { useState } from 'react'

interface CustomerInfo {
  phone?: string
  cpf?: string
  cnpj?: string
  company?: string
}

interface SaveAddressDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  address: AddressData
  isAddressNew?: boolean // Se o endereço é novo e deve ser exibido
  customerInfo?: CustomerInfo
  onSave: () => Promise<void>
  onSkip: () => void
}

export function SaveAddressDialog({
  open,
  onOpenChange,
  address,
  isAddressNew = true, // Por padrão, mostrar o endereço
  customerInfo,
  onSave,
  onSkip,
}: SaveAddressDialogProps) {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (isSaving) return
    try {
      setIsSaving(true)
      await onSave()
    } catch (error) {
      console.error('Erro ao salvar endereço:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Funções de formatação
  const formatPhone = (value?: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const formatCPF = (value?: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`
  }

  const formatCNPJ = (value?: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
  }

  // Preparar dados do endereço para exibição
  const streetLine = `${address.logradouro}, ${address.numero}`
  const neighborhoodLine = address.bairro
  const cityStateLine = `${address.cidade}/${address.estado}`
  const zipCodeLine = address.cep

  // Verificar se há informações do cliente para exibir (apenas as novas)
  const hasCustomerInfo =
    customerInfo &&
    (customerInfo.phone ||
      customerInfo.cpf ||
      customerInfo.cnpj ||
      customerInfo.company)

  // Verificar se há algo para mostrar no dialog
  const hasAnythingToShow = isAddressNew || hasCustomerInfo

  // Determinar o título do dialog com base no que será salvo
  const dialogTitle =
    isAddressNew && hasCustomerInfo
      ? 'Salvar informações'
      : isAddressNew
        ? 'Salvar endereço'
        : 'Salvar informações do cliente'

  // Determinar a descrição com base no que será salvo
  const dialogDescription =
    isAddressNew && hasCustomerInfo
      ? 'Deseja salvar estas informações para futuras solicitações de orçamento?'
      : isAddressNew
        ? 'Deseja salvar este endereço para futuras solicitações de orçamento?'
        : 'Deseja salvar estas informações para futuras solicitações de orçamento?'

  // Se não há nada novo para mostrar, não renderizar o dialog
  if (!hasAnythingToShow) {
    return null
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup variant="default" className="max-w-lg h-auto md:h-auto">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <MapPin className="h-5 w-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-xl font-semibold text-gray-800">
                {dialogTitle}
              </Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  <p className="text-sm text-muted-foreground">
                    {dialogDescription}
                    <br />
                    <br />
                    Informações salvas facilitam o preenchimento automático em
                    próximas solicitações, agilizando o processo.
                  </p>
                  <div className="mt-4">
                    {/* Informações do Endereço e Cliente - Bloco Unificado */}
                    <div className="p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 space-y-3">
                      {/* Endereço - Só mostrar se for novo */}
                      {isAddressNew && (
                        <>
                          <div className="flex items-start gap-3">
                            <Building2 className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-sm font-medium text-gray-900">
                              {streetLine}
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <Navigation className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-sm font-medium text-gray-900">
                              {neighborhoodLine}
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <Map className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-sm font-medium text-gray-900">
                              {cityStateLine}
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                            <p className="text-sm font-medium text-gray-900">
                              {zipCodeLine}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Informações do Cliente - Só mostrar as que são novas */}
                      {hasCustomerInfo && customerInfo && (
                        <>
                          {customerInfo.phone && (
                            <div className="flex items-start gap-3">
                              <Phone className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                              <p className="text-sm font-medium text-gray-900">
                                {formatPhone(customerInfo.phone)}
                              </p>
                            </div>
                          )}
                          {customerInfo.cpf && (
                            <div className="flex items-start gap-3">
                              <User className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                              <p className="text-sm font-medium text-gray-900">
                                CPF: {formatCPF(customerInfo.cpf)}
                              </p>
                            </div>
                          )}
                          {customerInfo.cnpj && (
                            <div className="flex items-start gap-3">
                              <FileText className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                              <p className="text-sm font-medium text-gray-900">
                                CNPJ: {formatCNPJ(customerInfo.cnpj)}
                              </p>
                            </div>
                          )}
                          {customerInfo.company && (
                            <div className="flex items-start gap-3">
                              <Building className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                              <p className="text-sm font-medium text-gray-900">
                                {customerInfo.company}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            <Dialog.Footer>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={onSkip}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Não salvar
                </Button>
                <Button
                  variant="default"
                  onClick={handleSave}
                  className="flex-1"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
