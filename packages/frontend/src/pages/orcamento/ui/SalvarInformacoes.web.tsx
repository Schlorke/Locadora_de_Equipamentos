'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Phone, Building2, FileText, User } from 'lucide-react'

interface CustomerInfo {
  phone?: string
  cnpj?: string
  cpf?: string
  company?: string
}

interface SaveCustomerInfoDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  customerInfo: CustomerInfo
  onSave: () => Promise<void>
  onSkip: () => void
}

export function SaveCustomerInfoDialog({
  open,
  onOpenChange,
  customerInfo,
  onSave,
  onSkip,
}: SaveCustomerInfoDialogProps) {
  const handleSave = async () => {
    await onSave()
  }

  // Verificar se há alguma informação para exibir
  const hasAnyInfo =
    customerInfo.phone ||
    customerInfo.cpf ||
    customerInfo.cnpj ||
    customerInfo.company

  // Se não há informações para mostrar, não renderizar o dialog
  if (!hasAnyInfo) {
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
                <FileText className="h-5 w-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-xl font-semibold text-gray-800">
                Salvar informações
              </Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>

            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  <p className="text-sm text-muted-foreground">
                    Deseja salvar <strong>estas informações</strong> para
                    futuras solicitações de orçamento?
                    <br />
                    <br />
                    Informações salvas facilitam o preenchimento automático em
                    próximas solicitações, agilizando o processo.
                  </p>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 space-y-3">
                    {customerInfo.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">
                            Telefone
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {customerInfo.phone}
                          </p>
                        </div>
                      </div>
                    )}
                    {customerInfo.cpf && (
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">CPF</p>
                          <p className="text-sm font-medium text-gray-900">
                            {customerInfo.cpf}
                          </p>
                        </div>
                      </div>
                    )}
                    {customerInfo.cnpj && (
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">CNPJ</p>
                          <p className="text-sm font-medium text-gray-900">
                            {customerInfo.cnpj}
                          </p>
                        </div>
                      </div>
                    )}
                    {customerInfo.company && (
                      <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-0.5">
                            Empresa
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {customerInfo.company}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>

            <Dialog.Footer>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={onSkip} className="flex-1">
                  Não salvar
                </Button>
                <Button
                  variant="default"
                  onClick={handleSave}
                  className="flex-1"
                >
                  Salvar
                </Button>
              </div>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
