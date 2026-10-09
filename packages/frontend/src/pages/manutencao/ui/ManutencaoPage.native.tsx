import type { ReactNode } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { Button, Card, Input, Dialog, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { toast } from '../../../shared/lib/toast'
import { AdvancedCalendar } from '../../../widgets/calendario'
import { useMaintenanceData } from '../model/carga'
import { typeConfig, statusLabels } from '../model/contracts'
import { toMaintenanceCalendarEvent } from '../model/calendar'
import { formatCurrency, formatDate } from '../model/display'
function Content() {
  const m = useMaintenanceData(),
    theme = useTheme(),
    selected = m.selectedMaintenance
  const text = (label: ReactNode) => (
    <Text style={{ color: theme.text }}>{label}</Text>
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
          Gerenciar Manutenções
        </Text>
        {text('Agenda e histórico de manutenções de equipamentos')}
        {text(m.filteredMaintenances.length + ' manutenções encontradas')}
        <Input
          aria-label="Buscar por equipamento ou técnico..."
          value={m.searchTerm}
          onChangeText={m.setSearchTerm}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[
            ['all', 'Todos os status'],
            ['SCHEDULED', 'Agendada'],
            ['IN_PROGRESS', 'Em Andamento'],
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
          {[['all', 'Todos os tipos'], ...Object.entries(typeConfig)].map(
            ([key, label]) => (
              <Button
                key={key}
                variant={m.typeFilter === key ? 'default' : 'outline'}
                onClick={() => m.setTypeFilter(key!)}
              >
                {label}
              </Button>
            )
          )}
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
          Agendar Manutenção
        </Button>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            variant={m.viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => m.setViewMode('list')}
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
        {m.loading ? text('Carregando manutenções...') : null}
        {m.viewMode === 'calendar' ? (
          <AdvancedCalendar
            events={m.filteredMaintenances.map(toMaintenanceCalendarEvent)}
            resources={Array.from(
              new Map(
                m.filteredMaintenances.map((item) => [
                  item.equipment.id,
                  { id: item.equipment.id, name: item.equipment.name },
                ])
              ).values()
            )}
            onEventClick={(event) => {
              const item = m.filteredMaintenances.find(
                (item) => item.id === event.id
              )
              if (item) m.setSelectedMaintenance(item)
            }}
            defaultViewMode="weekly"
            fixedColumnWidth
          />
        ) : (
          m.paginatedMaintenances.map((item) => (
            <Card key={item.id}>
              <View style={{ gap: space.sm }}>
                {text(item.equipment.name)}
                {item.equipment.category
                  ? text(item.equipment.category.name)
                  : null}
                {text(
                  (typeConfig[item.type] || item.type) +
                    ' · ' +
                    status(item.status)
                )}
                {text(formatDate(item.scheduledAt))}
                {text('Técnico: ' + (item.technician || 'Não definido'))}
                {text('Total: ' + formatCurrency(item.cost))}
                <Button
                  variant="outline"
                  aria-label={'Exibir manutenção ' + item.id}
                  onClick={() => m.setSelectedMaintenance(item)}
                >
                  Exibir
                </Button>
              </View>
            </Card>
          ))
        )}
        {!m.loading && m.viewMode === 'list' && !m.filteredMaintenances.length
          ? text('Nenhuma manutenção encontrada')
          : null}
        {m.viewMode === 'list' && m.tableTotalPages > 1 ? (
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
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) m.setSelectedMaintenance(null)
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Detalhes da Manutenção</Dialog.Title>
                <Dialog.CloseButton />
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.BodyViewport>
                  <Dialog.BodyContent>
                    {selected ? (
                      <View style={{ gap: space.md }}>
                        {text('Equipamento: ' + selected.equipment.name)}
                        {selected.equipment.category
                          ? text(selected.equipment.category.name)
                          : null}
                        {text(
                          'Tipo: ' +
                            (typeConfig[selected.type] || selected.type)
                        )}
                        {text('Status: ' + status(selected.status))}
                        {text(
                          'Agendada para: ' + formatDate(selected.scheduledAt)
                        )}
                        {selected.completedAt
                          ? text(
                              'Concluída em: ' +
                                formatDate(selected.completedAt)
                            )
                          : null}
                        {text(
                          'Técnico: ' + (selected.technician || 'Não definido')
                        )}
                        {selected.description
                          ? text(selected.description)
                          : null}
                        {text(
                          'Mão de Obra: ' + formatCurrency(selected.laborCost)
                        )}
                        {text('Peças: ' + formatCurrency(selected.partsCost))}
                        {text('Total: ' + formatCurrency(selected.cost))}
                        {selected.notes ? text(selected.notes) : null}
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
export function AdminMaintenancePage() {
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
    />
  )
}
