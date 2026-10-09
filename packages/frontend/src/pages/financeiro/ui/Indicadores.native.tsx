import {
  ChartContainer,
  ChartPlot,
  ChartTooltip,
  ChartTooltipContent,
  Card,
  useTheme,
} from '@gb-locacoes/ui'
import { FinancialSection, FinancialText } from './parts.native'
import type { useFinancialDataModel } from '../model/carga'
import { formatCurrency } from '../../../shared/lib/formatting'
type Model = ReturnType<typeof useFinancialDataModel>
function FinancialSeries({
  title,
  data,
}: {
  title: string
  data: Array<{ label: string; value: number }>
}) {
  const theme = useTheme()
  return (
    <FinancialSection title={title}>
      {data.length ? (
        <>
          <ChartContainer
            config={{ amount: { label: title, color: theme.primary } }}
          >
            <ChartPlot data={data} series="amount">
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                  />
                }
              />
            </ChartPlot>
          </ChartContainer>
          {data.map((point, index) => (
            <FinancialText key={point.label + index}>
              {point.label}: {formatCurrency(point.value)}
            </FinancialText>
          ))}
        </>
      ) : (
        <FinancialText>Sem dados neste período</FinancialText>
      )}
    </FinancialSection>
  )
}
export function FinancialDashboard({ model }: { model: Model }) {
  return (
    <>
      <FinancialSeries
        title="Histórico de Receita"
        data={model.revenueHistory.map((item) => ({
          label: item.month,
          value: item.revenue,
        }))}
      />
      <FinancialSeries
        title="Receita por Categoria"
        data={model.revenueByCategory.map((item) => ({
          label: item.categoryName,
          value: item.revenue,
        }))}
      />
      <FinancialSeries
        title="Aging de Recebíveis"
        data={model.agingData.map((item) => ({
          label: item.range,
          value: item.amount,
        }))}
      />
      {model.agingData.map((item) => (
        <FinancialText key={item.range}>
          {item.range}: {item.count} lançamento(s)
        </FinancialText>
      ))}
      <FinancialSection title="Maiores Devedores">
        {model.topDebtors.map((debtor, index) => (
          <Card key={debtor.clientName + index}>
            <FinancialText>
              {debtor.clientName} · {formatCurrency(debtor.overdueAmount)} ·{' '}
              {debtor.daysOverdue} dias em atraso · {debtor.status}
            </FinancialText>
          </Card>
        ))}
        {!model.topDebtors.length ? (
          <FinancialText>Nenhum devedor neste período</FinancialText>
        ) : null}
      </FinancialSection>
    </>
  )
}
