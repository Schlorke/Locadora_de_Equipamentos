'use client'

import { AdminCard } from '../../../widgets/cartao-admin'
import { Button } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { CheckCircle, Edit, FileText, Package, Truck } from 'lucide-react'
import {
  type Rental,
  type ClientDocument,
  type ClientDocumentType,
  requiredClientDocumentTypes,
  clientDocumentTypeLabel,
} from '../model/contratos'
import { formatCurrency, formatDate, getStatusBadge } from './formatar.web'

interface RentalDetailDialogProps {
  rental: Rental | null
  clientDocuments: ClientDocument[]
  uploadingDocumentType: ClientDocumentType | null
  contractLoading: boolean
  onClose: () => void
  onGenerateContract: (_rentalId: string) => void
  onCheckIn: (_rentalId: string) => void
  onCheckOut: (_rentalId: string) => void
  onUploadDocument: (
    _rentalId: string,
    _type: ClientDocumentType,
    _file: File
  ) => void
}

export function RentalDetailDialog({
  rental,
  clientDocuments,
  uploadingDocumentType,
  contractLoading,
  onClose,
  onGenerateContract,
  onCheckIn,
  onCheckOut,
  onUploadDocument,
}: RentalDetailDialogProps) {
  return (
    <Dialog.Root open={!!rental} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup variant="default" className="max-w-3xl">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <Package className="w-5 h-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="flex items-center gap-2">
                Detalhes da Locação
              </Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {rental && (
                    <div className="space-y-6 mt-4">
                      <AdminCard title="Cliente">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Nome</p>
                            <p className="font-medium">
                              {rental.users.name || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{rental.users.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Telefone</p>
                            <p className="font-medium">
                              {rental.users.phone || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            {getStatusBadge(rental.status)}
                          </div>
                        </div>
                      </AdminCard>

                      <AdminCard title="Período de Locação">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Data de Início
                            </p>
                            <p className="font-medium">
                              {formatDate(rental.startdate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">
                              Data de Término
                            </p>
                            <p className="font-medium">
                              {formatDate(rental.enddate)}
                            </p>
                          </div>
                          {rental.extensionDays && (
                            <div>
                              <p className="text-sm text-gray-500">
                                Prorrogação
                              </p>
                              <p className="font-medium">
                                {rental.extensionDays} dias
                              </p>
                            </div>
                          )}
                          {rental.lateFee && (
                            <div>
                              <p className="text-sm text-gray-500">
                                Multa por Atraso
                              </p>
                              <p className="font-medium text-red-600">
                                {formatCurrency(rental.lateFee)}
                              </p>
                            </div>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard title="Equipamentos">
                        <div className="space-y-3">
                          {rental.rental_items.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {item.equipments.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Quantidade: {item.quantity} | Dias:{' '}
                                    {item.totaldays}
                                  </p>
                                </div>
                                <p className="font-semibold text-orange-600">
                                  {formatCurrency(item.totalprice)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AdminCard>

                      {rental.payments && rental.payments.length > 0 && (
                        <AdminCard title="Pagamentos">
                          <div className="space-y-2">
                            {rental.payments.map((payment) => (
                              <div
                                key={payment.id}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <div>
                                  <p className="font-medium">
                                    {formatCurrency(payment.amount)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {payment.method} - {payment.status}
                                  </p>
                                </div>
                                {payment.paidAt && (
                                  <p className="text-xs text-gray-500">
                                    {formatDate(payment.paidAt)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </AdminCard>
                      )}

                      <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold text-gray-700">
                            Total
                          </span>
                          <span className="text-2xl font-bold text-orange-600">
                            {formatCurrency(rental.total)}
                          </span>
                        </div>
                      </div>

                      {(rental.status === 'PENDING' ||
                        rental.status === 'ACTIVE') && (
                        <AdminCard title="Check-in/Check-out">
                          <div className="space-y-4">
                            {!rental.checkInAt && (
                              <Button
                                className="w-full"
                                onClick={() => onCheckIn(rental.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Realizar Check-in
                              </Button>
                            )}
                            {rental.checkInAt && !rental.checkOutAt && (
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => onCheckOut(rental.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Realizar Check-out
                              </Button>
                            )}
                            {rental.checkInAt && (
                              <p className="text-sm text-gray-600">
                                Check-in: {formatDate(rental.checkInAt)}
                              </p>
                            )}
                            {rental.checkOutAt && (
                              <p className="text-sm text-gray-600">
                                Check-out: {formatDate(rental.checkOutAt)}
                              </p>
                            )}
                          </div>
                        </AdminCard>
                      )}

                      <AdminCard title="Contrato">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-500">Status</p>
                              <p className="font-medium">
                                {rental.contract?.status || 'Não gerado'}
                              </p>
                              {rental.contract?.signedAt && (
                                <p className="text-xs text-gray-500">
                                  Assinado em:{' '}
                                  {formatDate(rental.contract.signedAt)}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => onGenerateContract(rental.id)}
                              disabled={contractLoading}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              {rental.contract
                                ? 'Atualizar contrato'
                                : 'Gerar contrato'}
                            </Button>
                          </div>
                          {rental.contract?.pdfUrl && (
                            <a
                              href={rental.contract.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-blue-600 underline"
                            >
                              Abrir PDF
                            </a>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard title="Documentos do Cliente (Antifraude)">
                        <div className="space-y-3">
                          {requiredClientDocumentTypes.map((documentType) => {
                            const documentFound = clientDocuments.find(
                              (document) => document.type === documentType
                            )
                            const inputId = `upload-${documentType}`

                            return (
                              <div
                                key={documentType}
                                className="rounded-lg border border-slate-200 p-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {clientDocumentTypeLabel[documentType]}
                                    </p>
                                    {documentFound ? (
                                      <p className="text-xs text-slate-500">
                                        Enviado em{' '}
                                        {formatDate(documentFound.createdAt)} •{' '}
                                        {documentFound.fileName}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-red-600">
                                        Documento obrigatório pendente
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {documentFound?.signedUrl && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={documentFound.signedUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Visualizar
                                        </a>
                                      </Button>
                                    )}
                                    <input
                                      id={inputId}
                                      type="file"
                                      className="hidden"
                                      accept="image/*,application/pdf"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0]
                                        if (!file || !rental) return
                                        onUploadDocument(
                                          rental.id,
                                          documentType,
                                          file
                                        )
                                        event.currentTarget.value = ''
                                      }}
                                    />
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() =>
                                        document
                                          .getElementById(inputId)
                                          ?.click()
                                      }
                                      disabled={
                                        uploadingDocumentType === documentType
                                      }
                                    >
                                      {uploadingDocumentType === documentType
                                        ? 'Enviando...'
                                        : documentFound
                                          ? 'Substituir'
                                          : 'Enviar'}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </AdminCard>

                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1">
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => onGenerateContract(rental.id)}
                          disabled={contractLoading}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Contrato
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Truck className="w-4 h-4 mr-2" />
                          Logística
                        </Button>
                      </div>
                    </div>
                  )}
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
