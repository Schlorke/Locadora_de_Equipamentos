import type { SubscriptionStatus } from '@gb-locacoes/contracts/subscription'

/** Texto de apresentação; não deriva estado, acesso ou quitação no cliente. */
export const subscriptionPresentation: Readonly<
  Record<SubscriptionStatus, { label: string; message: string }>
> = {
  INCOMPLETE: {
    label: 'Incompleta',
    message: 'O cadastro da assinatura ainda não foi concluído.',
  },
  TRIALING: {
    label: 'Em teste',
    message: 'A assinatura está no período de teste.',
  },
  ACTIVE: { label: 'Ativa', message: 'A assinatura está ativa.' },
  PAST_DUE: {
    label: 'Em atraso',
    message:
      'Há mensalidades em atraso. Consulte as faturas para regularizar a assinatura.',
  },
  SUSPENDED: {
    label: 'Suspensa',
    message: 'A assinatura está suspensa. Consulte as faturas no painel web.',
  },
  CANCELED: {
    label: 'Cancelada',
    message:
      'A assinatura foi cancelada. O histórico de faturas está preservado.',
  },
}
export const ownerReadMessages = {
  owner: 'Esta consulta é exclusiva do dono atual da locadora.',
  session: 'Entre na sua conta para consultar a assinatura.',
  selection: 'Selecione uma locadora para consultar a assinatura.',
  unavailable: 'Não foi possível consultar a assinatura. Tente novamente.',
} as const
