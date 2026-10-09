import type { OnboardingChecklistItem } from '@gb-locacoes/contracts/onboarding'

export const checklistLabels: Record<OnboardingChecklistItem, string> = {
  ACCOUNT_CREATED: 'Conta criada',
  FIRST_EQUIPMENT: 'Primeiro equipamento',
  CUSTOMIZE_SITE: 'Personalizar o site',
  PUBLISH_SITE: 'Publicar o site',
  ACTIVATE_ONLINE_PAYMENTS: 'Ativar pagamentos online',
  SUBSCRIBE: 'Assinar a plataforma',
  CONFIRM_COMMERCIAL_INFO: 'Confirmar os dados de recebimento',
}
export const checklistLinks: Partial<
  Record<OnboardingChecklistItem, { href: string; label: string }>
> = {
  FIRST_EQUIPMENT: {
    href: '/admin/equipamentos/novo',
    label: 'Cadastrar primeiro equipamento',
  },
  CUSTOMIZE_SITE: { href: '/admin/configuracoes', label: 'Personalizar site' },
  SUBSCRIBE: { href: '/admin/assinatura', label: 'Consultar assinatura' },
  ACTIVATE_ONLINE_PAYMENTS: {
    href: '/admin/recebimentos',
    label: 'Consultar recebimentos',
  },
  CONFIRM_COMMERCIAL_INFO: {
    href: '/admin/recebimentos',
    label: 'Consultar pendência de recebimentos',
  },
}
export const checklistProblems = {
  session: 'Entre novamente para consultar os primeiros passos.',
  selection: 'Selecione a locadora para consultar os primeiros passos.',
  unavailable:
    'Não foi possível consultar os primeiros passos. Tente novamente.',
  owner: 'Os primeiros passos são exclusivos do dono da locadora.',
}
