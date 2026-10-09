import type {
  PaymentAccountStatus,
  PaymentAccountHealthIssue,
  PaymentAccountKind,
} from '@gb-locacoes/contracts/payment-account'

export const receivingStatus: Record<
  PaymentAccountStatus,
  { label: string; message: string }
> = {
  DRAFT: {
    label: 'Configuração pendente',
    message: 'A conta ainda precisa ser configurada.',
  },
  PROVISIONING: {
    label: 'Criação em andamento',
    message:
      'O pedido de criação está em processamento. Consulte novamente mais tarde.',
  },
  UNKNOWN: {
    label: 'Confirmação pendente',
    message:
      'O resultado do pedido ainda precisa ser confirmado. Não solicite outra conta.',
  },
  KEY_RECOVERY_REQUIRED: {
    label: 'Revisão de acesso necessária',
    message: 'O acesso à conta precisa ser recuperado pelo suporte.',
  },
  AWAITING_OWNER: {
    label: 'Dados pendentes',
    message:
      'A instituição de pagamentos aguarda a confirmação dos dados da empresa.',
  },
  UNDER_REVIEW: {
    label: 'Dados em análise',
    message:
      'Os dados da empresa estão em análise pela instituição de pagamentos.',
  },
  APPROVED: {
    label: 'Conta aprovada',
    message: 'A conta de recebimentos está aprovada.',
  },
  REJECTED: {
    label: 'Correção necessária',
    message: 'A instituição de pagamentos solicitou a correção dos dados.',
  },
  RESTRICTED: {
    label: 'Recebimentos restritos',
    message:
      'Existe uma pendência que precisa ser resolvida para usar os pagamentos online.',
  },
  BLOCKED: {
    label: 'Conta bloqueada',
    message: 'O suporte precisa revisar o impedimento desta conta.',
  },
  DISCONNECTED: {
    label: 'Conta desconectada',
    message: 'Esta conta não está conectada à locadora.',
  },
}
export const receivingHealth: Record<PaymentAccountHealthIssue, string> = {
  KEY_DISABLED: 'O acesso à instituição de pagamentos precisa de revisão.',
  KEY_EXPIRED:
    'O acesso à instituição de pagamentos expirou e precisa de revisão.',
  KEY_DELETED:
    'O acesso à instituição de pagamentos foi removido e precisa de revisão.',
  WEBHOOK_MISSING:
    'A confirmação automática dos pagamentos precisa de revisão.',
  WEBHOOK_INTERRUPTED:
    'A confirmação automática dos pagamentos está interrompida.',
  COMMERCIAL_INFO_EXPIRED:
    'A confirmação anual dos dados da empresa está vencida.',
}
export const receivingKind: Record<PaymentAccountKind, string> = {
  BAAS: 'Conta gerenciada pela plataforma',
  STANDARD: 'Conta do programa de avaliação',
  CONNECTED: 'Conta própria conectada',
}
export const receivingProblems = {
  session: 'Entre novamente para consultar os recebimentos.',
  selection: 'Selecione uma locadora para consultar os recebimentos.',
  owner: 'Esta consulta é exclusiva do dono da locadora.',
  archived:
    'Esta locadora está arquivada. Consulte a assinatura para reativá-la.',
  unavailable: 'Não foi possível consultar os recebimentos. Tente novamente.',
}
