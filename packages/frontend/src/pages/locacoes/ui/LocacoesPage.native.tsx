import { ScrollView, View, Text, ActivityIndicator } from 'react-native'
import { Button, Card, Input, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { useRentalsData } from '../model/carga'
import { rentalStatusLabels } from '../model/contracts'
import { formatCurrency, formatDate } from '../model/formatters'
import { RentalDetailDialog, type RentalDocumentPorts } from './Dialogo.native'
import { RentalCalendar } from './Calendario.native'
export function AdminRentalsPage(ports: RentalDocumentPorts) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return (
    <RentalContent
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        slug,
        session?.user?.id,
        status,
        revision,
      ])}
      ports={ports}
    />
  )
}
function RentalContent({ ports }: { ports: RentalDocumentPorts }) {
  const m = useRentalsData(),
    theme = useTheme(),
    text = { color: theme.text }
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: space.md,
          gap: space.md,
          backgroundColor: theme.background,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            ...text,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.bold,
          }}
        >
          Gerenciar Locações
        </Text>
        <Text style={{ color: theme.textMuted }}>
          Visualize e gerencie todas as locações de equipamentos
        </Text>
        <Text style={text}>
          {m.filteredRentals.length} locações encontradas
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {Object.entries(rentalStatusLabels).map(([status, label]) => (
            <Button
              key={status}
              variant={m.statusFilter === status ? 'default' : 'outline'}
              onClick={() => m.setStatusFilter(status)}
            >
              {label}
            </Button>
          ))}
        </View>
        <Input
          aria-label="Buscar locações"
          placeholder="Buscar por cliente, email, telefone, empresa..."
          value={m.searchTerm}
          onChangeText={m.setSearchTerm}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {(
            [
              ['all', 'Todos os períodos'],
              ['today', 'Hoje'],
              ['week', 'Última semana'],
              ['month', 'Último mês'],
            ] as const
          ).map(([period, label]) => (
            <Button
              key={period}
              variant={m.periodFilter === period ? 'default' : 'outline'}
              onClick={() => m.setPeriodFilter(period)}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="outline"
            onClick={() => {
              m.setPeriodFilter('all')
              m.setSearchTerm('')
            }}
          >
            Resetar filtros
          </Button>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            variant={m.viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => m.setViewMode('table')}
          >
            Tabela
          </Button>
          <Button
            variant={m.viewMode === 'calendar' ? 'default' : 'outline'}
            onClick={() => m.setViewMode('calendar')}
          >
            Calendário
          </Button>
        </View>
        {m.loading ? (
          <ActivityIndicator />
        ) : m.viewMode === 'calendar' ? (
          <RentalCalendar
            rentals={m.filteredRentals}
            onSelect={m.setSelectedRental}
          />
        ) : m.paginatedRentals.length === 0 ? (
          <Text style={text}>Nenhuma locação encontrada</Text>
        ) : (
          <>
            {m.paginatedRentals.map((r) => (
              <Card key={r.id}>
                <Text accessibilityRole="header" style={text}>
                  {r.users.name || 'Sem nome'}
                </Text>
                <Text style={text}>{r.users.email}</Text>
                {r.users.phone && <Text style={text}>{r.users.phone}</Text>}
                {r.quote?.company && (
                  <Text style={text}>{r.quote.company}</Text>
                )}
                <Text style={text}>{r.rental_items.length} equipamento(s)</Text>
                <Text style={text}>
                  {formatDate(r.startdate)} até {formatDate(r.enddate)}
                </Text>
                <Text style={text}>
                  {formatCurrency(r.total)} —{' '}
                  {rentalStatusLabels[r.status] || r.status}
                </Text>
                <Button
                  variant="outline"
                  aria-label={'Exibir ' + r.id}
                  onClick={() => m.setSelectedRental(r)}
                >
                  Exibir
                </Button>
              </Card>
            ))}
            {m.tableTotalPages > 1 && (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  variant="outline"
                  disabled={m.tableCurrentPage === 1}
                  onClick={() => m.setTablePage(m.tableCurrentPage - 1)}
                >
                  Anterior
                </Button>
                <Text style={text}>
                  Página {m.tableCurrentPage} de {m.tableTotalPages}
                </Text>
                <Button
                  variant="outline"
                  disabled={m.tableCurrentPage === m.tableTotalPages}
                  onClick={() => m.setTablePage(m.tableCurrentPage + 1)}
                >
                  Próximo
                </Button>
              </View>
            )}
          </>
        )}
      </ScrollView>
      <RentalDetailDialog model={m} ports={ports} />
    </>
  )
}
