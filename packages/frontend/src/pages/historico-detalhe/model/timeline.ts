import type {
  ClientRentalDetail as Rental,
  ClientQuoteDetail as Quote,
  TimelineStep,
} from './types'
import { formatCurrency } from './presentation'
export function quoteTimeline(quote: Quote): TimelineStep[] {
  return quote.status === 'rejected' || quote.rejectedAt
    ? [
        {
          id: '1',
          label: 'Orçamento Criado',
          status: 'completed' as const,
          description: 'Orçamento foi criado',
          date: new Date(quote.createdAt),
        },
        {
          id: '2',
          label: 'Orçamento Rejeitado',
          status: 'completed' as const,
          description: 'Orçamento foi rejeitado',
          date: quote.rejectedAt
            ? new Date(quote.rejectedAt)
            : new Date(quote.updatedAt),
        },
      ]
    : // Fluxo normal: Criado -> Aprovado -> Ativo -> Concluído
      (() => {
        const paymentsCount = quote.payments?.length ?? 0
        // IDs dinâmicos: base 3 (1=Orçamento Criado, 2=Orçamento Aprovado)
        // + pagamentos = próximo ID disponível
        const activeRentalId = String(3 + paymentsCount)
        const completedRentalId = String(4 + paymentsCount)

        return [
          // 1. Orçamento Criado (sempre completo)
          {
            id: '1',
            label: 'Orçamento Criado',
            status: 'completed' as const,
            description: 'Orçamento foi criado e está aguardando aprovação',
            date: new Date(quote.createdAt),
          },
          // 2. Orçamento Aprovado
          {
            id: '2',
            label:
              quote.status === 'approved' ||
              quote.status === 'completed' ||
              quote.approvedAt
                ? 'Orçamento Aprovado'
                : 'Aguardando Aprovação',
            status:
              quote.status === 'approved' ||
              quote.status === 'completed' ||
              quote.approvedAt
                ? ('completed' as const)
                : ('current' as const),
            description:
              quote.status === 'approved' ||
              quote.status === 'completed' ||
              quote.approvedAt
                ? 'Orçamento foi aprovado'
                : 'Orçamento está aguardando análise pela equipe',
            date: quote.approvedAt
              ? new Date(quote.approvedAt)
              : new Date(quote.updatedAt),
          },
          // 3. Status do Pagamento
          ...(quote.payments && quote.payments.length > 0
            ? quote.payments.map((payment, idx) => {
                const paymentStatus =
                  payment.status === 'PAID'
                    ? 'completed'
                    : payment.status === 'OVERDUE'
                      ? 'pending'
                      : payment.status === 'CANCELLED'
                        ? 'pending'
                        : payment.status === 'REFUNDED'
                          ? 'completed'
                          : 'current'

                const paymentLabel =
                  payment.status === 'PAID'
                    ? 'Pagamento Pago'
                    : payment.status === 'OVERDUE'
                      ? 'Pagamento Expirado'
                      : payment.status === 'CANCELLED'
                        ? 'Pagamento Rejeitado'
                        : payment.status === 'REFUNDED'
                          ? 'Pagamento Reembolsado'
                          : 'Pagamento Pendente'

                const paymentDescription =
                  payment.status === 'PAID'
                    ? `Pagamento de ${formatCurrency(payment.amount)} foi confirmado`
                    : payment.status === 'OVERDUE'
                      ? `Pagamento de ${formatCurrency(payment.amount)} está expirado`
                      : payment.status === 'CANCELLED'
                        ? `Pagamento de ${formatCurrency(payment.amount)} foi rejeitado`
                        : payment.status === 'REFUNDED'
                          ? `Pagamento de ${formatCurrency(payment.amount)} foi reembolsado`
                          : `Aguardando pagamento de ${formatCurrency(payment.amount)}`

                return {
                  id: `payment-${idx}`,
                  label: paymentLabel,
                  status: paymentStatus as 'completed' | 'current' | 'pending',
                  description: paymentDescription,
                  date: payment.paidAt
                    ? new Date(payment.paidAt)
                    : new Date(payment.dueDate),
                }
              })
            : []),
          // Locação Ativa (ID dinâmico)
          {
            id: activeRentalId,
            label: 'Locação Ativa',
            status:
              quote.status === 'completed'
                ? ('completed' as const)
                : ('pending' as const),
            description:
              quote.status === 'completed'
                ? 'Orçamento foi convertido em locação'
                : 'Aguardando conversão em locação',
            date: quote.approvedAt ? new Date(quote.approvedAt) : undefined,
          },
          // Locação Concluída (ID dinâmico)
          {
            id: completedRentalId,
            label: 'Locação Concluída',
            status: 'pending' as const,
            description: 'Aguardando conclusão da locação',
            date: undefined,
          },
        ]
      })()
}
export function rentalTimeline(rental: Rental): TimelineStep[] {
  return (() => {
    const paymentsCount = rental.payments?.length ?? 0
    const deliveriesCount = rental.deliveries?.length ?? 0
    // IDs dinâmicos: base 3 (1=Orçamento Criado, 2=Orçamento Aprovado)
    // + pagamentos + entregas = próximo ID disponível
    const activeRentalId = String(3 + paymentsCount + deliveriesCount)
    const completedRentalId = String(4 + paymentsCount + deliveriesCount)

    return [
      {
        id: '1',
        label: 'Orçamento Criado',
        status: 'completed',
        description: 'Orçamento foi criado e está aguardando aprovação',
        date: new Date(rental.startdate),
      },
      {
        id: '2',
        label: 'Orçamento Aprovado',
        status: rental.status !== 'PENDING' ? 'completed' : 'pending',
        description: 'Orçamento foi aprovado e convertido em locação',
        date: new Date(rental.startdate),
      },
      // Pagamentos devem ocorrer antes da locação se tornar ativa
      ...(rental.payments?.map((payment, idx) => {
        const paymentStatus =
          payment.status === 'PAID'
            ? 'completed'
            : payment.status === 'OVERDUE'
              ? 'pending'
              : payment.status === 'CANCELLED'
                ? 'pending'
                : payment.status === 'REFUNDED'
                  ? 'completed'
                  : 'current'

        const paymentLabel =
          payment.status === 'PAID'
            ? 'Pagamento Pago'
            : payment.status === 'OVERDUE'
              ? 'Pagamento Expirado'
              : payment.status === 'CANCELLED'
                ? 'Pagamento Rejeitado'
                : payment.status === 'REFUNDED'
                  ? 'Pagamento Reembolsado'
                  : 'Pagamento Pendente'

        const paymentDescription =
          payment.status === 'PAID'
            ? `Pagamento de ${formatCurrency(payment.amount)} foi confirmado`
            : payment.status === 'OVERDUE'
              ? `Pagamento de ${formatCurrency(payment.amount)} está expirado`
              : payment.status === 'CANCELLED'
                ? `Pagamento de ${formatCurrency(payment.amount)} foi rejeitado`
                : payment.status === 'REFUNDED'
                  ? `Pagamento de ${formatCurrency(payment.amount)} foi reembolsado`
                  : `Aguardando pagamento de ${formatCurrency(payment.amount)}`

        return {
          id: `payment-${idx}`,
          label: paymentLabel,
          status: paymentStatus as 'completed' | 'current' | 'pending',
          description: paymentDescription,
          date: payment.paidAt
            ? new Date(payment.paidAt)
            : new Date(payment.dueDate),
        }
      }) || []),
      ...(rental.deliveries?.map((delivery, idx) => ({
        id: `delivery-${idx}`,
        label:
          delivery.type === 'DELIVERY' ? 'Entrega Agendada' : 'Coleta Agendada',
        status: (delivery.status === 'COMPLETED'
          ? 'completed'
          : delivery.status === 'IN_TRANSIT'
            ? 'current'
            : 'pending') as 'completed' | 'current' | 'pending',
        description:
          delivery.type === 'DELIVERY'
            ? 'Equipamentos serão entregues no endereço informado'
            : 'Equipamentos serão coletados no endereço informado',
        date: new Date(delivery.scheduledAt),
      })) || []),
      {
        id: activeRentalId,
        label: 'Locação Ativa',
        status: (rental.status === 'ACTIVE'
          ? 'current'
          : rental.status === 'COMPLETED'
            ? 'completed'
            : 'pending') as 'completed' | 'current' | 'pending',
        description: 'Locação está em andamento',
        date: new Date(rental.startdate),
      },
      {
        id: completedRentalId,
        label: 'Locação Concluída',
        status: rental.status === 'COMPLETED' ? 'completed' : 'pending',
        description: 'Locação foi finalizada com sucesso',
        date: new Date(rental.enddate),
      },
    ]
  })()
}
