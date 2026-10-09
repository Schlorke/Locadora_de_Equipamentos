import type { ReactNode } from 'react'
import { ScrollView, View, Text } from 'react-native'
import {
  Button,
  Input,
  Card,
  Dialog,
  ImageUpload,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { AdvancedCalendar } from '../../../widgets/calendario'
import { useLogisticsData } from '../model/carga'
import { useLogisticsPhotos } from '../model/photos'
import { toLogisticsCalendarEvent } from '../model/calendar'
import { statusLabels, typeConfig } from '../model/contracts'
import { formatDate, formatAddress } from '../model/display'
import { DeliveryChecklist } from './Checklist.native'
interface Props {
  pickImages(): Promise<FormData[]>
  image(props: { src: string; alt: string; height: number }): ReactNode
}
function Content({ pickImages, image }: Props) {
  const m = useLogisticsData(),
    theme = useTheme(),
    photos = useLogisticsPhotos(
      m.selectedDelivery?.id,
      m.isEditing,
      pickImages
    ),
    delivery = m.selectedDelivery,
    draft = m.editingDelivery
  const text = (value: ReactNode) => (
    <Text style={{ color: theme.text }}>{value}</Text>
  )
  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <View style={{ gap: space.xs }}>
      {text(label)}
      <Input aria-label={label} value={value} onChangeText={onChange} />
    </View>
  )
  const status = (value: string) =>
    statusLabels[value]?.label ?? statusLabels.SCHEDULED!.label
  return (
    <>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.text,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.bold,
          }}
        >
          Gerenciar Logística
        </Text>
        {text('Entregas e coletas de equipamentos')}
        {text(m.filteredDeliveries.length + ' entregas encontradas')}
        {field('Buscar por cliente...', m.searchTerm, m.setSearchTerm)}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[
            ['all', 'Todos os status'],
            ['SCHEDULED', 'Agendada'],
            ['IN_TRANSIT', 'Em Trânsito'],
            ['COMPLETED', 'Concluída'],
            ['CANCELLED', 'Cancelada'],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant={m.statusFilter === key ? 'default' : 'outline'}
              onClick={() => m.setStatusFilter(key!)}
            >
              {label}
            </Button>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[
            ['all', 'Todos os tipos'],
            ['DELIVERY', 'Entrega'],
            ['PICKUP', 'Coleta'],
          ].map(([key, label]) => (
            <Button
              key={key}
              variant={m.typeFilter === key ? 'default' : 'outline'}
              onClick={() => m.setTypeFilter(key!)}
            >
              {label}
            </Button>
          ))}
        </View>
        <Button
          variant="outline"
          onClick={() => {
            m.setSearchTerm('')
            m.setStatusFilter('all')
            m.setTypeFilter('all')
          }}
        >
          Resetar filtros
        </Button>
        <Button onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
          Nova Entrega
        </Button>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            variant={m.viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => m.setViewMode('table')}
          >
            Lista
          </Button>
          <Button
            variant={m.viewMode === 'calendar' ? 'default' : 'outline'}
            onClick={() => m.setViewMode('calendar')}
          >
            Calendário
          </Button>
        </View>
        {m.loading ? text('Carregando entregas...') : null}
        {m.viewMode === 'calendar' ? (
          <AdvancedCalendar
            events={m.filteredDeliveries.map(toLogisticsCalendarEvent)}
            resources={[
              ...m.vehicles.map((v) => ({
                id: v.id,
                name: v.plate + ' • ' + (v.model ?? v.brand ?? v.type),
              })),
              { id: 'type-DELIVERY', name: 'Sem veículo • Entregas' },
              { id: 'type-PICKUP', name: 'Sem veículo • Coletas' },
            ]}
            onEventClick={(event) => {
              const selected = m.filteredDeliveries.find(
                (d) => d.id === event.id
              )
              if (selected) m.handleEditDelivery(selected)
            }}
            defaultViewMode="weekly"
          />
        ) : (
          m.paginatedDeliveries.map((row) => (
            <Card key={row.id}>
              <View style={{ gap: space.sm }}>
                {text(row.rental.users.name || 'Sem nome')}
                {text(row.rental.users.email)}
                {text(typeConfig[row.type] + ' · ' + status(row.status))}
                {text(formatDate(row.scheduledAt))}
                {text(formatAddress(row.address))}
                {row.driverName ? text('Motorista: ' + row.driverName) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: space.sm,
                  }}
                >
                  <Button
                    variant="outline"
                    aria-label={'Exibir entrega ' + row.id}
                    onClick={() => {
                      m.setSelectedDelivery(row)
                      m.setIsEditing(false)
                    }}
                  >
                    Exibir
                  </Button>
                  <Button
                    aria-label={'Editar entrega ' + row.id}
                    onClick={() => m.handleEditDelivery(row)}
                  >
                    Editar
                  </Button>
                  {row.status === 'SCHEDULED' ? (
                    <Button
                      variant="outline"
                      aria-label={'Iniciar entrega ' + row.id}
                      onClick={() =>
                        void m.handleUpdateStatus(row.id, 'IN_TRANSIT')
                      }
                    >
                      Iniciar
                    </Button>
                  ) : null}
                  {row.status === 'IN_TRANSIT' ? (
                    <Button
                      variant="outline"
                      aria-label={'Concluir entrega ' + row.id}
                      onClick={() =>
                        void m.handleUpdateStatus(row.id, 'COMPLETED')
                      }
                    >
                      Concluir
                    </Button>
                  ) : null}
                </View>
              </View>
            </Card>
          ))
        )}
        {!m.loading && !m.filteredDeliveries.length
          ? text('Nenhuma entrega encontrada')
          : null}
        {m.viewMode === 'table' && m.tableTotalPages > 1 ? (
          <View style={{ gap: space.sm }}>
            {text('Página ' + m.tableCurrentPage + ' de ' + m.tableTotalPages)}
            <Button
              variant="outline"
              disabled={m.tableCurrentPage === 1}
              onClick={() => m.setTablePage(m.tableCurrentPage - 1)}
            >
              Página anterior
            </Button>
            <Button
              variant="outline"
              disabled={m.tableCurrentPage === m.tableTotalPages}
              onClick={() => m.setTablePage(m.tableCurrentPage + 1)}
            >
              Próxima página
            </Button>
          </View>
        ) : null}
      </ScrollView>
      <Dialog.Root
        open={!!delivery}
        onOpenChange={(open) => {
          if (!open) m.handleCloseDialog()
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {m.isEditing
                    ? 'Editar Entrega/Coleta'
                    : 'Detalhes da ' +
                      (typeConfig[delivery?.type || ''] || 'Entrega/Coleta')}
                </Dialog.Title>
                <Dialog.CloseButton />
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.BodyViewport>
                  <Dialog.BodyContent>
                    {delivery ? (
                      <View style={{ gap: space.md }}>
                        {m.isEditing ? (
                          <>
                            {text('Veículo')}
                            <View style={{ gap: space.sm }}>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  m.setEditingDelivery((d) => ({
                                    ...d,
                                    vehicleId: '',
                                  }))
                                }
                              >
                                Nenhum veículo
                              </Button>
                              {m.vehicles.map((v) => (
                                <Button
                                  key={v.id}
                                  variant={
                                    draft.vehicleId === v.id
                                      ? 'default'
                                      : 'outline'
                                  }
                                  onClick={() =>
                                    m.setEditingDelivery((d) => ({
                                      ...d,
                                      vehicleId: v.id,
                                    }))
                                  }
                                >
                                  {v.plate +
                                    ' - ' +
                                    (v.brand || '') +
                                    ' ' +
                                    (v.model || '')}
                                </Button>
                              ))}
                            </View>
                            {text('Motorista')}
                            <View style={{ gap: space.sm }}>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  m.setEditingDelivery((d) => ({
                                    ...d,
                                    driverId: '',
                                    driverName: undefined,
                                  }))
                                }
                              >
                                Nenhum motorista
                              </Button>
                              {m.drivers.map((d) => (
                                <Button
                                  key={d.id}
                                  variant={
                                    draft.driverId === d.id
                                      ? 'default'
                                      : 'outline'
                                  }
                                  onClick={() =>
                                    m.setEditingDelivery((previous) => ({
                                      ...previous,
                                      driverId: d.id,
                                      driverName: d.name,
                                    }))
                                  }
                                >
                                  {d.name + ' - ' + d.phone}
                                </Button>
                              ))}
                            </View>
                            {field(
                              'Distância (km)',
                              draft.distance ? String(draft.distance) : '',
                              (value) =>
                                m.setEditingDelivery((d) => ({
                                  ...d,
                                  distance: value ? Number(value) : undefined,
                                }))
                            )}
                            <DeliveryChecklist
                              type={delivery.type}
                              checklist={draft.checklist}
                              onChecklistChange={(checklist) =>
                                m.setEditingDelivery((d) => ({
                                  ...d,
                                  checklist,
                                }))
                              }
                            />
                            <ImageUpload
                              images={draft.photos}
                              onImagesChange={(photos) =>
                                m.setEditingDelivery((d) => ({ ...d, photos }))
                              }
                              maxImages={10}
                              sectionTitle="Fotos"
                              chooseImages={photos.choose}
                              renderImage={(src, alt) =>
                                image({ src, alt, height: space.xxl * 4 })
                              }
                            />
                            {field('Observações', draft.notes || '', (notes) =>
                              m.setEditingDelivery((d) => ({ ...d, notes }))
                            )}
                            <Button onClick={() => void m.handleSaveDelivery()}>
                              Salvar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={m.handleCancelEditing}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            {text('Cliente')}
                            {text(delivery.rental.users.name || 'Sem nome')}
                            {text(delivery.rental.users.email)}
                            {delivery.rental.users.phone
                              ? text(delivery.rental.users.phone)
                              : null}
                            {text(
                              typeConfig[delivery.type] +
                                ' · ' +
                                status(delivery.status)
                            )}
                            {text(
                              'Agendada para: ' +
                                formatDate(delivery.scheduledAt)
                            )}
                            {delivery.completedAt
                              ? text(
                                  'Concluída em: ' +
                                    formatDate(delivery.completedAt)
                                )
                              : null}
                            {delivery.driverName
                              ? text('Motorista: ' + delivery.driverName)
                              : null}
                            {delivery.distance
                              ? text(delivery.distance + ' km')
                              : null}
                            {text(
                              'Endereço: ' + formatAddress(delivery.address)
                            )}
                            {delivery.checklist
                              ? Object.entries(delivery.checklist).map(
                                  ([key, value]) => (
                                    <Text
                                      key={key}
                                      style={{ color: theme.text }}
                                    >
                                      {key}: {String(value)}
                                    </Text>
                                  )
                                )
                              : null}
                            {delivery.photos.map((src, i) => (
                              <View key={src + '-' + i}>
                                {image({
                                  src,
                                  alt: 'Foto ' + (i + 1),
                                  height: space.xxl * 4,
                                })}
                              </View>
                            ))}
                            {delivery.notes ? text(delivery.notes) : null}
                            <Button
                              onClick={() => m.handleEditDelivery(delivery)}
                            >
                              Editar
                            </Button>
                            {delivery.status === 'SCHEDULED' ? (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  void m.handleUpdateStatus(
                                    delivery.id,
                                    'IN_TRANSIT'
                                  )
                                }
                              >
                                Iniciar Entrega
                              </Button>
                            ) : null}
                            {delivery.status === 'IN_TRANSIT' ? (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  void m.handleUpdateStatus(
                                    delivery.id,
                                    'COMPLETED'
                                  )
                                }
                              >
                                Concluir
                              </Button>
                            ) : null}
                          </>
                        )}
                      </View>
                    ) : null}
                  </Dialog.BodyContent>
                </Dialog.BodyViewport>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
export function AdminLogisticsPage(props: Props) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  return (
    <Content
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        tenant?.tenant.status,
        slug,
        session?.user?.id,
        revision,
      ])}
      {...props}
    />
  )
}
