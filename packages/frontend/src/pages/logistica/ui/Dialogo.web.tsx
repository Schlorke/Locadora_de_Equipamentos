'use client'

import { useLogisticsPhotos } from '../model/photos'
import { AdminCard } from '../../../widgets/cartao-admin'
import { DeliveryChecklist } from './Checklist.web'
import { Badge } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Dialog } from '@gb-locacoes/ui'
import { ImageUpload } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import { Truck, MapPin, Edit, CheckCircle, XCircle, Save } from 'lucide-react'
import type { Delivery, Vehicle, Driver } from '../model/contracts'
import { typeConfig } from '../model/contracts'
import { formatDate, formatAddress, getStatusBadge } from './Utilidades'
import type { EditingDeliveryState } from '../model/carga'

interface DeliveryDetailDialogProps {
  delivery: Delivery | null
  isEditing: boolean
  editingDelivery: EditingDeliveryState
  setEditingDelivery: (_state: EditingDeliveryState) => void
  vehicles: Vehicle[]
  drivers: Driver[]
  onClose: () => void
  onEdit: (_delivery: Delivery) => void
  onSave: () => void
  onCancelEditing: () => void
  onUpdateStatus: (_deliveryId: string, _status: string) => void
}

export function DeliveryDetailDialog({
  delivery,
  isEditing,
  editingDelivery,
  setEditingDelivery,
  vehicles,
  drivers,
  onClose,
  onEdit,
  onSave,
  onCancelEditing,
  onUpdateStatus,
}: DeliveryDetailDialogProps) {
  const photos = useLogisticsPhotos(delivery?.id, isEditing)
  return (
    <Dialog.Root
      open={!!delivery}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Portal>
        <Dialog.Popup variant="default" className="max-w-3xl">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.HeaderIcon>
                <Truck className="w-5 h-5" />
              </Dialog.HeaderIcon>
              <Dialog.Title className="flex items-center gap-2">
                Detalhes da{' '}
                {typeConfig[delivery?.type || ''] || 'Entrega/Coleta'}
              </Dialog.Title>
              <Dialog.CloseButton />
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.BodyViewport>
                <Dialog.BodyContent>
                  {delivery && (
                    <div className="space-y-6 mt-4">
                      {isEditing ? (
                        <AdminCard title="Editar Entrega/Coleta">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Veículo</Label>
                              <Select
                                value={editingDelivery.vehicleId || ''}
                                onValueChange={(value) =>
                                  setEditingDelivery({
                                    ...editingDelivery,
                                    vehicleId: value,
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um veículo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Nenhum</SelectItem>
                                  {vehicles.map((vehicle) => (
                                    <SelectItem
                                      key={vehicle.id}
                                      value={vehicle.id}
                                    >
                                      {vehicle.plate} - {vehicle.brand || ''}{' '}
                                      {vehicle.model || ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Motorista</Label>
                              <Select
                                value={editingDelivery.driverId || ''}
                                onValueChange={(value) => {
                                  const driver = drivers.find(
                                    (d) => d.id === value
                                  )
                                  setEditingDelivery({
                                    ...editingDelivery,
                                    driverId: value,
                                    driverName: driver?.name,
                                  })
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um motorista" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Nenhum</SelectItem>
                                  {drivers.map((driver) => (
                                    <SelectItem
                                      key={driver.id}
                                      value={driver.id}
                                    >
                                      {driver.name} - {driver.phone}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Distância (km)</Label>
                              <Input
                                type="number"
                                value={editingDelivery.distance || ''}
                                onChange={(e) =>
                                  setEditingDelivery({
                                    ...editingDelivery,
                                    distance: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  })
                                }
                                placeholder="Digite a distância em km"
                              />
                            </div>

                            <DeliveryChecklist
                              checklist={editingDelivery.checklist || {}}
                              onChecklistChange={(checklist) =>
                                setEditingDelivery({
                                  ...editingDelivery,
                                  checklist: checklist as Record<
                                    string,
                                    string | boolean
                                  >,
                                })
                              }
                              type={delivery.type as 'DELIVERY' | 'PICKUP'}
                            />

                            <div className="space-y-2">
                              <Label>Fotos</Label>
                              <ImageUpload
                                images={editingDelivery.photos}
                                onImagesChange={(photos) =>
                                  setEditingDelivery({
                                    ...editingDelivery,
                                    photos,
                                  })
                                }
                                uploadFile={async (file) => {
                                  const body = new FormData()
                                  body.append('file', file)
                                  return photos.upload(body)
                                }}
                                maxImages={10}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Observações</Label>
                              <Textarea
                                value={editingDelivery.notes || ''}
                                onChange={(e) =>
                                  setEditingDelivery({
                                    ...editingDelivery,
                                    notes: e.target.value,
                                  })
                                }
                                placeholder="Digite observações sobre a entrega/coleta..."
                                rows={4}
                              />
                            </div>

                            <div className="flex gap-2 pt-4">
                              <Button onClick={onSave} className="flex-1">
                                <Save className="w-4 h-4 mr-2" />
                                Salvar
                              </Button>
                              <Button
                                variant="outline"
                                onClick={onCancelEditing}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </AdminCard>
                      ) : (
                        <>
                          <AdminCard title="Cliente">
                            <div>
                              <p className="font-medium text-lg">
                                {delivery.rental.users.name || 'Sem nome'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {delivery.rental.users.email}
                              </p>
                              {delivery.rental.users.phone && (
                                <p className="text-sm text-gray-500">
                                  {delivery.rental.users.phone}
                                </p>
                              )}
                            </div>
                          </AdminCard>

                          <AdminCard title="Informações da Entrega/Coleta">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-500">Tipo</p>
                                <Badge variant="outline">
                                  {typeConfig[delivery.type] || delivery.type}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Status</p>
                                {getStatusBadge(delivery.status)}
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">
                                  Agendada para
                                </p>
                                <p className="font-medium">
                                  {formatDate(delivery.scheduledAt)}
                                </p>
                              </div>
                              {delivery.completedAt && (
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Concluída em
                                  </p>
                                  <p className="font-medium">
                                    {formatDate(delivery.completedAt)}
                                  </p>
                                </div>
                              )}
                              {delivery.driverName && (
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Motorista
                                  </p>
                                  <p className="font-medium">
                                    {delivery.driverName}
                                  </p>
                                </div>
                              )}
                              {delivery.distance && (
                                <div>
                                  <p className="text-sm text-gray-500">
                                    Distância
                                  </p>
                                  <p className="font-medium">
                                    {delivery.distance} km
                                  </p>
                                </div>
                              )}
                            </div>
                          </AdminCard>

                          <AdminCard title="Endereço">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                              <p className="text-gray-700">
                                {formatAddress(delivery.address)}
                              </p>
                            </div>
                          </AdminCard>

                          {delivery.checklist && (
                            <AdminCard title="Checklist">
                              <div className="space-y-2">
                                {Object.entries(delivery.checklist).map(
                                  ([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex items-center gap-2"
                                    >
                                      {typeof value === 'boolean' ? (
                                        <>
                                          {value ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                          <span className="text-sm text-gray-700">
                                            {key}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-sm text-gray-700">
                                          <strong>{key}:</strong> {value}
                                        </span>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            </AdminCard>
                          )}

                          {delivery.photos && delivery.photos.length > 0 && (
                            <AdminCard title="Fotos">
                              <div className="grid grid-cols-2 gap-4">
                                {delivery.photos.map((photo, index) => (
                                  <img
                                    key={index}
                                    src={photo}
                                    alt={`Foto ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-lg"
                                  />
                                ))}
                              </div>
                            </AdminCard>
                          )}

                          {delivery.notes && (
                            <AdminCard title="Observações">
                              <p className="text-gray-700">{delivery.notes}</p>
                            </AdminCard>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={() => onEdit(delivery)}
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            {delivery.status === 'SCHEDULED' && (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  onUpdateStatus(delivery.id, 'IN_TRANSIT')
                                }
                              >
                                <Truck className="w-4 h-4 mr-2" />
                                Iniciar Entrega
                              </Button>
                            )}
                            {delivery.status === 'IN_TRANSIT' && (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  onUpdateStatus(delivery.id, 'COMPLETED')
                                }
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Concluir
                              </Button>
                            )}
                          </div>
                        </>
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
