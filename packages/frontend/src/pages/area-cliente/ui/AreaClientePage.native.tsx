import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { Badge, Button, Card, Link, useTheme } from '@gb-locacoes/ui'
import { radius, space, typography } from '@gb-locacoes/design-tokens'
import { getPricingConfig } from '../../../entities/equipamento'
import { useAreaCliente, useAreaClienteScope } from '../model/use-area-cliente'

const rentalLabels: Record<string, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativa',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
}

interface NativePageActions {
  onBack?: () => void
  onSignOut?: () => void | Promise<void>
}
export function AreaClientePage(actions: NativePageActions = {}) {
  return <AreaClienteContent {...actions} key={useAreaClienteScope()} />
}
function AreaClienteContent({ onBack, onSignOut }: NativePageActions) {
  const m = useAreaCliente(),
    theme = useTheme()
  const pendingQuotes = m.quotes.filter((q) => q.status === 'pending')
  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.md,
        gap: space.lg,
        backgroundColor: theme.background,
      }}
    >
      <View style={{ gap: space.sm }}>
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
        ) : null}
        {onSignOut ? (
          <Button variant="outline" onClick={() => void onSignOut()}>
            Sair
          </Button>
        ) : null}
      </View>
      <View
        style={{
          padding: space.lg,
          gap: space.sm,
          borderRadius: radius.lg,
          backgroundColor: theme.primary,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.onPrimary,
            fontSize: typography.size.xl,
            fontWeight: typography.weight.bold,
          }}
        >
          Bem-vindo de volta, {m.session?.user?.name || 'Cliente'}!
        </Text>
        <Text style={{ color: theme.onPrimary }}>
          Gerencie seus orçamentos, acompanhe suas locações e tenha controle
          total sobre seus equipamentos
        </Text>
      </View>
      <Card>
        <View style={{ gap: space.sm }}>
          <Link href="/orcamento">
            Equipamentos no Carrinho: {String(m.itemCount)}
          </Link>
          <Link href="/area-cliente/historico">
            Locações Ativas: {String(m.activeRentals.length)}
          </Link>
          <Text style={{ color: theme.text }}>
            Total de Orçamentos: {m.quotesCount}
          </Text>
          <Text style={{ color: theme.text }}>
            Total Estimado: {m.formatCurrency(m.getTotalPrice())}
          </Text>
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.text,
              fontSize: typography.size.lg,
              fontWeight: typography.weight.semibold,
            }}
          >
            Meu Carrinho
          </Text>
          {m.mounted && m.itemCount > 0 ? (
            <>
              {m.cartItems.map((item, index) => {
                const range = m.resolveDateRange(item)
                const period = getPricingConfig(item, item.days).period
                const label =
                  period === 'weekly'
                    ? 'Semanal'
                    : period === 'biweekly'
                      ? 'Quinzenal'
                      : period === 'monthly'
                        ? 'Mensal'
                        : 'Diário'
                return (
                  <View
                    key={item.equipmentId + '-' + index}
                    style={{ gap: space.xs }}
                  >
                    <Text
                      style={{
                        color: theme.text,
                        fontWeight: typography.weight.semibold,
                      }}
                    >
                      {item.equipmentName}
                    </Text>
                    <Text style={{ color: theme.textMuted }}>
                      Qtd: {item.quantity}x · {label} · {item.days} dias
                    </Text>
                    <Text style={{ color: theme.textMuted }}>
                      {m.formatCartDate(range.startDate)} até{' '}
                      {m.formatCartDate(range.endDate)}
                      {range.isAuto ? ' (previsto)' : ''}
                    </Text>
                    {item.includeWeekends !== undefined ? (
                      <Text style={{ color: theme.textMuted }}>
                        {item.includeWeekends
                          ? 'Incluir finais de semana'
                          : 'Não inclui finais de semana'}
                      </Text>
                    ) : null}
                    <Text style={{ color: theme.text }}>
                      {m.formatCurrency(m.calculateSubtotal(item))}
                    </Text>
                  </View>
                )
              })}
              <Text style={{ color: theme.text }}>
                Total Estimado: {m.formatCurrency(m.getTotalPrice())}
              </Text>
              <Link href="/orcamento">Solicitar Orçamento</Link>
            </>
          ) : (
            <Text style={{ color: theme.textMuted }}>
              Seu carrinho está vazio
            </Text>
          )}
          <Link href="/equipamentos">Alugar Equipamentos</Link>
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.text,
              fontSize: typography.size.lg,
              fontWeight: typography.weight.semibold,
            }}
          >
            {m.activeRentals.length
              ? 'Minhas Locações'
              : pendingQuotes.length
                ? 'Orçamentos Pendentes'
                : 'Minhas Locações'}
          </Text>
          {m.loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : m.activeRentals.length ? (
            m.activeRentals.slice(0, 3).map((rental) => (
              <View key={rental.id} style={{ gap: space.xs }}>
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {rental.rental_items[0]?.equipments.name || 'Equipamento'}
                  {rental.rental_items.length > 1
                    ? ' +' + (rental.rental_items.length - 1)
                    : ''}
                </Text>
                <Badge variant="outline">
                  {rentalLabels[rental.status] ?? rental.status}
                </Badge>
                <Text style={{ color: theme.textMuted }}>
                  {m.formatDate(rental.startdate)} -{' '}
                  {m.formatDate(rental.enddate)}
                </Text>
                {rental.rental_items[0]?.includeWeekends !== undefined ? (
                  <Text style={{ color: theme.textMuted }}>
                    {rental.rental_items[0].includeWeekends
                      ? 'Incluir finais de semana'
                      : 'Não inclui finais de semana'}
                  </Text>
                ) : null}
                {rental.createdat ? (
                  <Text style={{ color: theme.textMuted }}>
                    Solicitado às {m.formatDateTime(rental.createdat)}
                  </Text>
                ) : null}
                <Text style={{ color: theme.text }}>
                  {m.formatCurrency(rental.total)}
                </Text>
                <Link
                  href={
                    '/area-cliente/historico/' + encodeURIComponent(rental.id)
                  }
                >
                  Ver locação
                </Link>
              </View>
            ))
          ) : pendingQuotes.length ? (
            pendingQuotes.slice(0, 3).map((quote) => (
              <View key={quote.id} style={{ gap: space.xs }}>
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.semibold,
                  }}
                >
                  {quote.items?.map((item) => item.equipment.name).join(', ') ||
                    'N/A'}
                </Text>
                <Badge variant="outline">Pendente</Badge>
                <Text style={{ color: theme.textMuted }}>
                  {quote.items?.reduce((sum, item) => sum + item.quantity, 0) ||
                    0}
                  x · {quote.items?.[0]?.days || 0} dias
                </Text>
                {quote.deliveryType ? (
                  <Text style={{ color: theme.textMuted }}>
                    {quote.deliveryType === 'DELIVERY'
                      ? m.formatDeliveryAddress(quote.deliveryAddress)
                      : 'Retirar em Loja'}
                  </Text>
                ) : null}
                <Text style={{ color: theme.text }}>
                  {m.formatCurrency(
                    quote.finalTotal ??
                      quote.originalTotal ??
                      quote.totalPrice ??
                      0
                  )}
                </Text>
                <Link
                  href={
                    '/area-cliente/historico/quote_' +
                    encodeURIComponent(quote.id)
                  }
                >
                  Ver orçamento
                </Link>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.textMuted }}>
              Nenhuma locação ativa
            </Text>
          )}
          <Link href="/area-cliente/historico">Ver Histórico</Link>
        </View>
      </Card>
      <Card>
        <View style={{ gap: space.md }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.text,
              fontSize: typography.size.lg,
              fontWeight: typography.weight.semibold,
            }}
          >
            Atividade Recente
          </Text>
          <Text style={{ color: theme.textMuted }}>
            Suas últimas ações na plataforma
          </Text>
          {m.activitiesLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : m.activities.length ? (
            m.activities
              .filter((activity) => !m.dismissedActivities.has(activity.id))
              .map((activity) => (
                <View key={activity.id} style={{ gap: space.xs }}>
                  <Text
                    style={{
                      color: theme.text,
                      fontWeight: typography.weight.semibold,
                    }}
                  >
                    {activity.title}
                  </Text>
                  <Text style={{ color: theme.textMuted }}>
                    {activity.description}
                  </Text>
                  {activity.metadata?.amount ? (
                    <Text style={{ color: theme.text }}>
                      {m.formatCurrency(activity.metadata.amount)}
                    </Text>
                  ) : null}
                  <Text style={{ color: theme.textMuted }}>
                    {m.formatRelativeTime(activity.timestamp)}
                  </Text>
                  {activity.link ? (
                    <Link href={activity.link}>Ver atividade</Link>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={() => m.dismissActivity(activity.id)}
                  >
                    Remover atividade
                  </Button>
                </View>
              ))
          ) : (
            <Text style={{ color: theme.textMuted }}>
              Nenhuma atividade recente
            </Text>
          )}
        </View>
      </Card>
    </ScrollView>
  )
}
