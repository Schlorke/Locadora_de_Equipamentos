import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Link,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { useHistory, useHistoryScope } from '../model/use-history'

const filters = [
  ['all', 'Todos os status'],
  ['pending', 'Pendente'],
  ['in_progress', 'Em Andamento'],
  ['approved', 'Aprovado'],
  ['completed', 'Concluído'],
  ['cancelled', 'Cancelado'],
] as const
const labels: Record<string, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Em Andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  OVERDUE: 'Atrasado',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  completed: 'Concluído',
}
export function HistoricoPage() {
  return <HistoryContent key={useHistoryScope()} />
}
function HistoryContent() {
  const m = useHistory(),
    theme = useTheme()
  const deletingQuote = m.quotes.find((q) => q.id === m.quoteToDelete)
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.md,
        backgroundColor: theme.background,
      }}
    >
      <Link href="/area-cliente">Voltar para Área do Cliente</Link>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Meus Orçamentos
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Acompanhe seus orçamentos e locações
      </Text>
      <Input
        value={m.searchTerm}
        onChangeText={m.setSearchTerm}
        placeholder="Buscar por equipamento..."
        aria-label="Buscar por equipamento"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {filters.map(([value, label]) => (
          <Button
            key={value}
            variant={m.statusFilter === value ? 'default' : 'outline'}
            onClick={() => m.setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </View>
      {m.loading ? (
        <ActivityIndicator />
      ) : (
        m.filteredItems.map((item) => {
          const rental = item.type === 'rental' ? item.data : null
          const quote = item.type === 'quote' ? item.data : null
          const names = rental
            ? rental.rental_items.map((i) => i.equipments.name).join(', ')
            : quote?.items?.map((i) => i.equipment.name).join(', ') ||
              'Equipamentos não especificados'
          const quantity = rental
            ? rental.rental_items.reduce((n, i) => n + i.quantity, 0)
            : quote?.items?.reduce((n, i) => n + i.quantity, 0) || 0
          const days = rental
            ? rental.rental_items[0]?.totaldays || 0
            : quote?.items?.[0]?.days || 0
          const start =
            rental?.startdate ||
            quote?.items?.[0]?.startDate ||
            quote?.createdAt ||
            ''
          let end = rental?.enddate || quote?.items?.[0]?.endDate
          if (!end && days > 0 && start) {
            const date = new Date(start)
            date.setDate(date.getDate() + days - 1)
            end = date.toISOString()
          } else if (!end) {
            end = start
          }
          const id = rental?.id || quote?.id || ''
          const href = rental ? id : m.quoteToRentalMap.get(id) || 'quote_' + id
          return (
            <Card key={item.type + '-' + id}>
              <View style={{ gap: space.sm }}>
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {names}
                </Text>
                <Badge>{labels[item.data.status] || 'Desconhecido'}</Badge>
                <Text style={{ color: theme.textMuted }}>
                  {quantity} equipamentos · {days} dias
                </Text>
                <Text style={{ color: theme.text }}>
                  {m.formatCurrency(
                    rental?.total ??
                      quote?.finalTotal ??
                      quote?.originalTotal ??
                      quote?.totalPrice ??
                      0
                  )}
                </Text>
                <Text style={{ color: theme.textMuted }}>
                  {m.formatDate(start)} até {m.formatDate(end)}
                </Text>
                {rental?.notes ? (
                  <Text style={{ color: theme.textMuted }}>{rental.notes}</Text>
                ) : null}
                {quote?.company ? (
                  <Text style={{ color: theme.textMuted }}>
                    {quote.company}
                  </Text>
                ) : null}
                {quote?.deliveryType ? (
                  <Text style={{ color: theme.textMuted }}>
                    {quote.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                  </Text>
                ) : null}
                {quote?.deliveryAddress ? (
                  <Text style={{ color: theme.textMuted }}>
                    {typeof quote.deliveryAddress === 'string'
                      ? quote.deliveryAddress
                      : m.formatDeliveryAddress(quote.deliveryAddress)}
                  </Text>
                ) : null}
                <Link
                  href={'/area-cliente/historico/' + encodeURIComponent(href)}
                >
                  Ver Detalhes
                </Link>
                <Button
                  variant="outline"
                  onClick={() =>
                    rental ? m.setRentalToDelete(id) : m.setQuoteToDelete(id)
                  }
                >
                  {quote?.status === 'pending'
                    ? 'Cancelar Orçamento'
                    : 'Excluir do Histórico'}
                </Button>
              </View>
            </Card>
          )
        })
      )}
      {!m.loading && m.filteredItems.length === 0 ? (
        <Card>
          <View style={{ gap: space.sm }}>
            <Text style={{ color: theme.text }}>
              Nenhum orçamento encontrado
            </Text>
            {m.searchTerm || m.statusFilter !== 'all' ? (
              <Button
                variant="outline"
                onClick={() => {
                  m.setSearchTerm('')
                  m.setStatusFilter('all')
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Link href="/orcamento">Solicitar Primeiro Orçamento</Link>
            )}
          </View>
        </Card>
      ) : null}
      <Dialog.Root
        open={m.rentalToDelete !== null}
        onOpenChange={(open) => {
          if (!open) m.setRentalToDelete(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>Excluir locação do histórico?</Dialog.Title>
            <Dialog.Description>
              Esta ação não pode ser desfeita. A locação será permanentemente
              removida do seu histórico. Você tem certeza que deseja continuar?
            </Dialog.Description>
            <Button
              variant="outline"
              disabled={m.isDeleting}
              onClick={() => m.setRentalToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={m.isDeleting}
              onClick={() => void m.handleDeleteRental()}
            >
              {m.isDeleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={m.quoteToDelete !== null}
        onOpenChange={(open) => {
          if (!open) m.setQuoteToDelete(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Title>
              {deletingQuote?.status === 'pending'
                ? 'Cancelar orçamento?'
                : 'Excluir orçamento?'}
            </Dialog.Title>
            <Dialog.Description>
              {deletingQuote?.status === 'pending'
                ? 'O orçamento será cancelado e removido permanentemente. Esta ação não pode ser desfeita.'
                : 'Esta ação não pode ser desfeita. O orçamento será permanentemente excluído.'}
            </Dialog.Description>
            <Button
              variant="outline"
              disabled={m.isDeletingQuote}
              onClick={() => m.setQuoteToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={m.isDeletingQuote}
              onClick={() => void m.handleDeleteQuote()}
            >
              {m.isDeletingQuote
                ? 'Excluindo...'
                : deletingQuote?.status === 'pending'
                  ? 'Sim, cancelar'
                  : 'Sim, excluir'}
            </Button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ScrollView>
  )
}
