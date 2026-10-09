import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { Button, Card, Dialog, Link, useTheme } from '@gb-locacoes/ui'
import { radius, space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { useDashboardData } from '../model/carga'
import { DashboardPlot } from './Grafico.native'
import { OwnerSubscriptionNotice } from '../../../widgets/aviso-assinatura'
import { ChecklistPrimeirosPassos } from '../../../widgets/checklist-primeiros-passos'

function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.text,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
      }}
    >
      {children}
    </Text>
  )
}
interface NativePageActions {
  onBack?: () => void
  onSignOut?: () => void | Promise<void>
  openSetupPanel?(slug: string): Promise<void>
}
export function AdminDashboard(actions: NativePageActions = {}) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  return (
    <DashboardContent
      {...actions}
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        slug,
        session?.user?.id,
        revision,
      ])}
    />
  )
}
function DashboardContent({
  onBack,
  onSignOut,
  openSetupPanel,
}: NativePageActions) {
  const m = useDashboardData(),
    theme = useTheme(),
    s = m.stats
  const money = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  const panels: Array<{ id: string; title: string; body: ReactNode }> = [
    {
      id: 'tendencia-orcamentos',
      title: 'Tendência de Orçamentos (7 dias)',
      body: (
        <DashboardPlot
          series="Orçamentos"
          points={(s?.quotesTrend ?? []).map((point) => ({
            label: point.date,
            value: point.count,
          }))}
        />
      ),
    },
    {
      id: 'distribuicao-status',
      title: 'Distribuição de Status',
      body: (
        <DashboardPlot
          series="Orçamentos"
          points={m.statusChartData.map((point) => ({
            label: point.name,
            value: point.value,
          }))}
        />
      ),
    },
    ...(m.revenueData
      ? [
          {
            id: 'evolucao-receita',
            title: 'Evolução da Receita (Últimos 12 meses)',
            body: (
              <DashboardPlot
                series="Receita"
                formatValue={money}
                points={m.revenueData.revenueHistory.map((point) => ({
                  label: point.month,
                  value: point.revenue,
                }))}
              />
            ),
          },
          {
            id: 'receita-categoria-dash',
            title: 'Receita por Categoria',
            body: (
              <DashboardPlot
                series="Receita"
                formatValue={money}
                points={m.revenueData.revenueByCategory.map((point) => ({
                  label: point.categoryName,
                  value: point.revenue,
                }))}
              />
            ),
          },
        ]
      : []),
    ...(m.agingData
      ? [
          {
            id: 'aging-contas-dash',
            title: 'Aging de Contas a Receber',
            body: (
              <View style={{ gap: space.sm }}>
                <DashboardPlot
                  series="Contas"
                  formatValue={money}
                  points={m.agingData.agingData.map((point) => ({
                    label: point.range,
                    value: point.amount,
                  }))}
                />
                {m.agingData.agingData.map((point) => (
                  <Text key={point.range} style={{ color: theme.textMuted }}>
                    {point.range}: {point.count} contas
                  </Text>
                ))}
              </View>
            ),
          },
          {
            id: 'maiores-devedores-dash',
            title: 'Maiores Devedores',
            body: (
              <View style={{ gap: space.sm }}>
                {m.agingData.topDebtors.map((debtor, index) => (
                  <View key={debtor.clientName + '-' + index}>
                    <Text style={{ color: theme.text }}>
                      {debtor.clientName}: {money(debtor.overdueAmount)}
                    </Text>
                    <Text style={{ color: theme.textMuted }}>
                      {debtor.daysOverdue} dias de atraso · {debtor.status}
                    </Text>
                  </View>
                ))}
                {!m.agingData.topDebtors.length ? (
                  <Text style={{ color: theme.textMuted }}>
                    Sem dados disponíveis
                  </Text>
                ) : null}
              </View>
            ),
          },
        ]
      : []),
    ...(s?.equipmentByCategory?.length
      ? [
          {
            id: 'distribuicao-categoria',
            title: 'Distribuição por Categoria',
            body: (
              <View style={{ gap: space.sm }}>
                <DashboardPlot
                  series="Equipamentos"
                  points={s.equipmentByCategory.map((point) => ({
                    label: point.categoryName,
                    value: point.count,
                  }))}
                />
                {s.equipmentByCategory.map((category) => (
                  <Text
                    key={category.categoryId}
                    style={{ color: theme.textMuted }}
                  >
                    {category.categoryName}: {category.available} disponíveis
                  </Text>
                ))}
              </View>
            ),
          },
        ]
      : []),
  ]
  const expanded = panels.find((panel) => panel.id === m.expandedCardId)
  if (m.statsError)
    return (
      <View
        style={{
          padding: space.lg,
          gap: space.md,
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
        <Heading>Erro ao carregar o dashboard</Heading>
        <ChecklistPrimeirosPassos openPanel={openSetupPanel} />
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {m.statsError}
        </Text>
        <Button onClick={() => void m.fetchDashboardData()}>
          Tentar novamente
        </Button>
      </View>
    )
  return (
    <>
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
            Dashboard Executivo
          </Text>
          <Text style={{ color: theme.onPrimary }}>
            Visão geral completa do sistema de locação de equipamentos
          </Text>
          <Text style={{ color: theme.onPrimary }}>Sistema em tempo real</Text>
        </View>
        <OwnerSubscriptionNotice />
        <ChecklistPrimeirosPassos openPanel={openSetupPanel} />
        {m.isLoading ? <ActivityIndicator color={theme.primary} /> : null}
        <Card>
          <View style={{ gap: space.sm }}>
            <Heading>Visão Geral</Heading>
            <Text style={{ color: theme.text }}>
              Total de Equipamentos: {s?.totalEquipments ?? 0} ·{' '}
              {s?.availableEquipments ?? 0} disponíveis
            </Text>
            <Text style={{ color: theme.text }}>
              Categorias: {s?.totalCategories ?? 0} · Organizadas
            </Text>
            <Text style={{ color: theme.text }}>
              Orçamentos: {s?.totalQuotes ?? 0} · {s?.pendingQuotes ?? 0}{' '}
              pendentes
            </Text>
            <Text style={{ color: theme.text }}>
              Receita Mensal: {money(s?.monthlyRevenue ?? 0)} · Este mês
            </Text>
            <Text style={{ color: theme.text }}>
              Pendentes: {s?.pendingQuotes ?? 0}
            </Text>
            <Text style={{ color: theme.text }}>
              Aprovados: {s?.approvedQuotes ?? 0}
            </Text>
            <Text style={{ color: theme.text }}>
              Rejeitados: {s?.rejectedQuotes ?? 0}
            </Text>
            <Text style={{ color: theme.text }}>
              Concluídos: {s?.completedQuotes ?? 0}
            </Text>
          </View>
        </Card>
        {s?.financialMetrics ? (
          <Card>
            <View style={{ gap: space.md }}>
              <Heading>KPIs Financeiros</Heading>
              {(
                [
                  ['mrr', 'Receita Mensal (MRR)'],
                  ['fleetUtilization', 'Utilização da Frota'],
                  ['overdueAmount', 'Valor em Atraso'],
                  ['averageTicket', 'Ticket Médio'],
                  ['netProfit', 'Lucro Líquido'],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={{ gap: space.xs }}>
                  <Text style={{ color: theme.text }}>
                    {label}:{' '}
                    {key === 'fleetUtilization'
                      ? s.financialMetrics!.metrics[key].toFixed(1) + '%'
                      : money(s.financialMetrics!.metrics[key])}
                  </Text>
                  <Text style={{ color: theme.textMuted }}>
                    Variação: {s.financialMetrics!.trends[key]}%
                  </Text>
                  <DashboardPlot
                    series={label}
                    points={s.financialMetrics!.sparklines[key].map(
                      (value, index) => ({ label: String(index + 1), value })
                    )}
                  />
                </View>
              ))}
            </View>
          </Card>
        ) : null}
        {panels.map((panel) => (
          <Card key={panel.id}>
            <View style={{ gap: space.md }}>
              <Heading>{panel.title}</Heading>
              {panel.body}
              <Button
                variant="outline"
                onClick={() => m.setExpandedCardId(panel.id)}
              >
                {'Expandir ' + panel.title}
              </Button>
            </View>
          </Card>
        ))}
        <Card>
          <View style={{ gap: space.sm }}>
            <Heading>Métricas do Negócio</Heading>
            <Text style={{ color: theme.text }}>
              Taxa de Utilização: {s?.utilizationRate?.toFixed(1) || 0}%
            </Text>
            <Text style={{ color: theme.text }}>
              Taxa de Conversão: {s?.conversionRate?.toFixed(1) || 0}%
            </Text>
            <Text style={{ color: theme.text }}>
              Ticket Médio: {money(s?.averageTicket ?? 0)}
            </Text>
          </View>
        </Card>
        {s?.topEquipments?.length ? (
          <Card>
            <View style={{ gap: space.md }}>
              <Heading>Equipamentos Mais Solicitados</Heading>
              {s.topEquipments.map((equipment) => (
                <View key={equipment.id}>
                  <Text style={{ color: theme.text }}>
                    {equipment.name}: {equipment.requestCount} solicitações
                  </Text>
                  <Text style={{ color: theme.textMuted }}>
                    {equipment.category}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
        {s?.equipmentROI?.length ? (
          <Card>
            <View style={{ gap: space.md }}>
              <Heading>ROI por Equipamento (Top 10)</Heading>
              {[...s.equipmentROI]
                .sort((a, b) => b.roi - a.roi)
                .slice(0, 10)
                .map((equipment) => (
                  <View key={equipment.equipmentId}>
                    <Text style={{ color: theme.text }}>
                      {equipment.equipmentName}: {equipment.roi.toFixed(1)}%
                    </Text>
                    <Text style={{ color: theme.textMuted }}>
                      Aquisição: {money(equipment.purchasePrice)} · Receita:{' '}
                      {money(equipment.totalRevenue)} · Manutenção:{' '}
                      {money(equipment.totalMaintenanceCost)}
                    </Text>
                  </View>
                ))}
            </View>
          </Card>
        ) : null}
        <Card>
          <View style={{ gap: space.md }}>
            <Heading>Ações Rápidas</Heading>
            <Link href="/admin/equipamentos/novo">Adicionar Equipamento</Link>
            <Link href="/admin/categorias">Gerenciar Categorias</Link>
            <Link href="/admin/orcamentos">Ver Orçamentos</Link>
            <Link href="/admin/financeiro">Ver Financeiro</Link>
            <Link href="/admin/logistics">Gerenciar Logística</Link>
            <Link href="/admin/maintenance">Gerenciar Manutenções</Link>
            <Link href="/admin/email">Gerenciar E-mail</Link>
            <Link href="/admin/whatsapp">Gerenciar WhatsApp</Link>
            <Link href="/admin/settings">Configurações</Link>
            <Link href="/admin/permissions">Gerenciar Permissões</Link>
          </View>
        </Card>
        <Card>
          <View style={{ gap: space.md }}>
            <Heading>Orçamentos Recentes</Heading>
            {m.recentQuotes.length ? (
              m.recentQuotes.map((quote) => (
                <View key={quote.id} style={{ gap: space.xs }}>
                  <Text style={{ color: theme.text }}>
                    {quote.customerName} · {quote.customerEmail}
                  </Text>
                  {quote.customerCompany ? (
                    <Text style={{ color: theme.textMuted }}>
                      {quote.customerCompany}
                    </Text>
                  ) : null}
                  <Text style={{ color: theme.text }}>
                    {quote.itemsCount} itens · {money(quote.totalAmount ?? 0)}
                  </Text>
                  <Text style={{ color: theme.textMuted }}>
                    {(
                      {
                        pending: 'Pendente',
                        approved: 'Aprovado',
                        rejected: 'Rejeitado',
                        completed: 'Concluído',
                      } as Record<string, string>
                    )[quote.status] ?? quote.status}{' '}
                    · {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: theme.textMuted }}>
                Nenhum orçamento recente
              </Text>
            )}
            <Link href="/admin/orcamentos">Ver Todos</Link>
          </View>
        </Card>
      </ScrollView>
      <Dialog.Root
        open={Boolean(expanded)}
        onOpenChange={(open) => {
          if (!open) m.setExpandedCardId(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>{expanded?.title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>{expanded?.body}</Dialog.Body>
            <Dialog.Footer>
              <Dialog.CloseButton>Fechar</Dialog.CloseButton>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
