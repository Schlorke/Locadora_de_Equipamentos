'use client'

import { AdminCard } from '../../../widgets/cartao-admin'
import { Dialog } from '@gb-locacoes/ui'
import { Wrench } from 'lucide-react'
import { type Maintenance, typeConfig } from '../model/contracts'
import { formatCurrency, formatDate, getStatusBadge } from './formatar'

interface MaintenanceDetailDialogProps {
  maintenance: Maintenance | null
  onClose: () => void
}

export function MaintenanceDetailDialog({
  maintenance,
  onClose,
}: MaintenanceDetailDialogProps) {
  return (
    <Dialog.Root
      open={!!maintenance}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup variant="default" className="max-w-3xl">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <Wrench className="w-5 h-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="flex items-center gap-2">
                Detalhes da Manutenção
              </Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {maintenance && (
                    <div className="space-y-6 mt-4">
                      <AdminCard title="Equipamento">
                        <div>
                          <p className="font-medium text-lg">
                            {maintenance.equipment.name}
                          </p>
                          {maintenance.equipment.category && (
                            <p className="text-sm text-gray-500">
                              {maintenance.equipment.category.name}
                            </p>
                          )}
                        </div>
                      </AdminCard>

                      <AdminCard title="Informações da Manutenção">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Tipo</p>
                            <p className="font-medium">
                              {typeConfig[maintenance.type] || maintenance.type}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            {getStatusBadge(maintenance.status)}
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">
                              Agendada para
                            </p>
                            <p className="font-medium">
                              {formatDate(maintenance.scheduledAt)}
                            </p>
                          </div>
                          {maintenance.completedAt && (
                            <div>
                              <p className="text-sm text-gray-500">
                                Concluída em
                              </p>
                              <p className="font-medium">
                                {formatDate(maintenance.completedAt)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Técnico</p>
                            <p className="font-medium">
                              {maintenance.technician || 'Não definido'}
                            </p>
                          </div>
                        </div>
                      </AdminCard>

                      {maintenance.description && (
                        <AdminCard title="Descrição">
                          <p className="text-gray-700">
                            {maintenance.description}
                          </p>
                        </AdminCard>
                      )}

                      <AdminCard title="Custos">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Mão de Obra</p>
                            <p className="font-medium text-lg">
                              {formatCurrency(maintenance.laborCost)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Peças</p>
                            <p className="font-medium text-lg">
                              {formatCurrency(maintenance.partsCost)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Total</p>
                            <p className="font-medium text-lg text-green-600">
                              {formatCurrency(maintenance.cost)}
                            </p>
                          </div>
                        </div>
                      </AdminCard>

                      {maintenance.notes && (
                        <AdminCard title="Notas">
                          <p className="text-gray-700">{maintenance.notes}</p>
                        </AdminCard>
                      )}
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
