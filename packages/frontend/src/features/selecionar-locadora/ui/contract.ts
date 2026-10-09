import type { TenantContext } from '../../../entities/organizacao'

/** Contrato do seletor de locadora do painel: barra compacta no web, bloco da tela no app. */
export interface TenantSelectorProps {
  memberships: TenantContext[]
  selection: TenantContext | null
  loading: boolean
  error: string | null
  onSelect: (_id: string) => void
  onRetry: () => void
  /** Sugestão do `?locadora=` (D8) que diverge da seleção atual; a pergunta só aparece com as duas respostas. */
  suggestion?: TenantContext | null
  onConfirmSuggestion?: () => void
  onDismissSuggestion?: () => void
}

/** Pergunta e resposta de confirmação do `?locadora=`, iguais no web e no app. */
export function suggestionPrompt(suggestion: TenantContext, current: TenantContext | null) {
  const name = suggestion.tenant.name
  return current
    ? {
        question: `Você veio do endereço de ${name}. Trocar a locadora do painel de ${current.tenant.name} para ${name}?`,
        confirm: `Trocar para ${name}`,
      }
    : { question: `Você veio do endereço de ${name}. Abrir o painel de ${name}?`, confirm: `Abrir ${name}` }
}
