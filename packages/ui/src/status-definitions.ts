export type BusinessStatusKey =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'ACTIVE'
  | 'PENDING_RETURN'
  | 'PAID'
  | 'UNPAID'
  | 'AWAITING_PAYMENT'
  | 'SETTLED'

export interface StatusDefinition {
  label: string
  description: string
}

const statusDefinitions: Record<BusinessStatusKey, StatusDefinition> = {
  PENDING: {
    label: 'Pendente',
    description: 'Orçamento recebido, aguardando análise e aprovação.',
  },
  APPROVED: {
    label: 'Aprovado',
    description: 'Orçamento aprovado. Equipamento reservado para o cliente.',
  },
  REJECTED: {
    label: 'Rejeitado',
    description: 'Orçamento recusado pelo administrador ou pelo cliente.',
  },
  COMPLETED: {
    label: 'Concluído',
    description: 'Locação finalizada com sucesso. Equipamento devolvido.',
  },
  CANCELLED: {
    label: 'Cancelado',
    description: 'Locação cancelada antes da conclusão.',
  },
  OVERDUE: {
    label: 'Atrasado',
    description: 'Data de devolução ultrapassada. Contactar cliente.',
  },
  ACTIVE: {
    label: 'Ativo',
    description: 'Equipamento em uso pelo cliente.',
  },
  PENDING_RETURN: {
    label: 'Aguardando devolução',
    description:
      'Locação encerrada no prazo, aguardando retorno físico do equipamento.',
  },
  PAID: {
    label: 'Pago',
    description: 'Pagamento confirmado e registrado no sistema.',
  },
  UNPAID: {
    label: 'Não Pago',
    description: 'Pagamento ainda não realizado. O boleto pode estar vencido.',
  },
  AWAITING_PAYMENT: {
    label: 'Aguardando Pagamento',
    description: 'Boleto emitido, aguardando confirmação bancária.',
  },
  SETTLED: {
    label: 'Baixado',
    description: 'Pagamento conciliado manualmente pelo administrador.',
  },
}

export function getStatusDefinition(
  status: string | null | undefined
): StatusDefinition | null {
  if (!status) return null
  const normalized = status.toUpperCase() as BusinessStatusKey
  return statusDefinitions[normalized] ?? null
}
