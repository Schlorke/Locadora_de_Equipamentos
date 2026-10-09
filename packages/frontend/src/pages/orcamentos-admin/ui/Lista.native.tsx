import { ScrollView, View, ActivityIndicator } from 'react-native'
import { Button, Card, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import {
  type Quote,
  getCardStatusBadge,
  formatDate,
} from '../../../entities/orcamento'
import { formatCurrency } from '../../../shared/lib/formatting'
import { useApiClientRevision } from '../../../shared/api'
import { useQuotesModel } from '../model/dados'
import { useQuoteDetailsModel } from '../model/detalhe'
import type { QuoteDocumentPorts } from '../model/documents'
import { QuoteDetailPanel } from './Painel.native'
import {
  QuoteSection,
  QuoteText,
  QuoteField,
  QuoteChoices,
} from './parts.native'
import { QuotesCalendarView } from './Calendario.native'
export interface AdminQuotesPageProps extends QuoteDocumentPorts {
  navigate?: (path: string) => void
  initialSearch?: string
  requestedQuoteId?: string | null
}
export function AdminQuotesPageWrapper(props: AdminQuotesPageProps) {
  if (props.requestedQuoteId)
    return <QuoteDetailPage {...props} id={props.requestedQuoteId} />
  return <ScopedQuotesPage {...props} />
}
function ScopedQuotesPage(props: AdminQuotesPageProps) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session, status } = useSession(),
    revision = useApiClientRevision()
  return (
    <QuotesContent
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.role,
        slug,
        session?.user?.id,
        status,
        revision,
        props.requestedQuoteId,
      ])}
      {...props}
    />
  )
}
function QuotesContent(props: AdminQuotesPageProps) {
  const data = useQuotesModel(props.initialSearch),
    details = useQuoteDetailsModel({
      ...data,
      requestedQuoteId: props.requestedQuoteId,
    }),
    theme = useTheme()
  const row = (q: Quote) => (
    <Card key={q.id}>
      <View style={{ gap: space.sm }}>
        <QuoteText>
          {q.quoteCode || q.id} · {q.name}
        </QuoteText>
        <QuoteText>
          {q.email} · {getCardStatusBadge(q).label}
        </QuoteText>
        <QuoteText>
          {formatDate(q.startDate)} — {formatDate(q.endDate)} ·{' '}
          {formatCurrency(q.finalTotal ?? q.totalPrice)}
        </QuoteText>
        <Button
          variant="outline"
          aria-label={'Exibir ' + q.id}
          onClick={() => details.openQuoteDetails(q)}
        >
          Exibir orçamento
        </Button>
      </View>
    </Card>
  )
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
        <QuoteSection title="Gerenciar Orçamentos">
          <QuoteText>
            Visualize, aprove e gerencie os orçamentos dos clientes
          </QuoteText>
          <QuoteText>{data.totalCount} orçamentos encontrados</QuoteText>
        </QuoteSection>
        <QuoteField
          label="Buscar orçamentos"
          value={data.searchTerm}
          onChange={data.setSearchTerm}
        />
        <QuoteChoices
          value={data.viewMode}
          options={[
            ['kanban', 'Kanban'],
            ['table', 'Tabela'],
            ['calendar', 'Calendário'],
          ]}
          onChange={(value) => {
            data.setViewMode(value)
            if (value === 'kanban') data.setPeriodFilter('all')
          }}
        />
        <QuoteChoices
          value={data.statusFilter}
          options={[
            ['all', 'Todos os status'],
            ['pending', 'Pendentes'],
            ['approved', 'Aprovados'],
            ['rejected', 'Rejeitados'],
            ['completed', 'Concluídos'],
          ]}
          onChange={data.setStatusFilter}
        />
        {data.viewMode !== 'kanban' ? (
          <QuoteChoices
            value={data.periodFilter}
            options={[
              ['all', 'Todos os períodos'],
              ['today', 'Hoje'],
              ['week', 'Última semana'],
              ['month', 'Último mês'],
            ]}
            onChange={data.setPeriodFilter}
          />
        ) : null}
        <QuoteChoices
          value={data.valueFilter}
          options={[
            ['all', 'Todos os valores'],
            ['low', 'Até R$ 500'],
            ['medium', 'R$ 500 - R$ 2.000'],
            ['high', 'Acima de R$ 2.000'],
          ]}
          onChange={data.setValueFilter}
        />
        <Button
          variant="outline"
          onClick={() => {
            data.setSearchTerm('')
            data.setStatusFilter('all')
            data.setPeriodFilter('all')
            data.setValueFilter('all')
          }}
        >
          Resetar filtros
        </Button>
        <Button
          variant="outline"
          disabled={data.loading}
          onClick={() => data.fetchQuotes()}
        >
          Atualizar orçamentos
        </Button>
        {data.loading ? <ActivityIndicator /> : null}
        {data.viewMode === 'kanban' ? (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                variant="outline"
                aria-label="Mês anterior"
                onClick={() => data.setKanbanMonth((d) => addMonths(d, -1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                aria-label="Próximo mês"
                onClick={() => data.setKanbanMonth((d) => addMonths(d, 1))}
              >
                Próximo
              </Button>
            </View>
            <QuoteText>
              {format(data.kanbanMonth, 'MMMM yyyy', { locale: ptBR })}
            </QuoteText>
            {(['pending', 'approved', 'rejected', 'completed'] as const).map(
              (status) => (
                <QuoteSection
                  key={status}
                  title={
                    status === 'pending'
                      ? 'Pendentes'
                      : status === 'approved'
                        ? 'Aprovados'
                        : status === 'rejected'
                          ? 'Rejeitados'
                          : 'Concluídos'
                  }
                >
                  {data.kanbanFilteredQuotes
                    .filter((q) => q.status === status)
                    .map(row)}
                  {!data.kanbanFilteredQuotes.some(
                    (q) => q.status === status
                  ) ? (
                    <QuoteText>Nenhum orçamento</QuoteText>
                  ) : null}
                </QuoteSection>
              )
            )}
          </>
        ) : data.viewMode === 'calendar' ? (
          <QuotesCalendarView
            quotes={data.quotes}
            onSelect={details.openQuoteDetails}
          />
        ) : (
          <>
            <QuoteText>
              Página {data.currentPage} de {Math.max(data.totalPages, 1)}
            </QuoteText>
            {data.paginatedTableQuotes.map(row)}
            {!data.paginatedTableQuotes.length && !data.loading ? (
              <QuoteText>Nenhum orçamento encontrado</QuoteText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                variant="outline"
                aria-label="Página anterior"
                disabled={data.currentPage <= 1}
                onClick={() => data.setCurrentPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                aria-label="Próxima página"
                disabled={data.currentPage >= data.totalPages}
                onClick={() => data.setCurrentPage((p) => p + 1)}
              >
                Próximo
              </Button>
            </View>
          </>
        )}
      </ScrollView>
      <QuoteDetailPanel model={details} ports={props} />
    </>
  )
}
export function QuoteDetailPage({
  id,
  ...props
}: AdminQuotesPageProps & { id: string }) {
  return <ScopedQuotesPage {...props} requestedQuoteId={id} />
}
