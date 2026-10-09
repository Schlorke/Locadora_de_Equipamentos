// Termos de Uso no pedido de orçamento (onda 134; decisão do dono D-C, parte 1, de 2026-10-07). Com os Termos da
// própria locadora publicados, o aceite é obrigatório como antes (web e app). Sem Termos publicados, o pedido segue sem
// a caixa de aceite: pedido de orçamento não é contrato e não se afirma aceite de texto inexistente (o painel avisa a
// locadora). Na falha de leitura (ou com uma versão que o app não conhece), o envio fica bloqueado até recarregar, para
// nunca enviar sem o aceite de Termos que existem. O aceite continua só no cliente (guardar a versão aceita é a D-F).
import type { StorefrontLegalDocument } from '@gb-locacoes/contracts/storefront-legal'
import type { EstadoDoDocumentoLegal } from '../../../entities/documento-legal'

export interface TermosDoOrcamento {
  /** O pedido exige o aceite (Termos publicados). */
  readonly exigeAceite: boolean
  /** Os Termos publicados, para o diálogo de leitura. */
  readonly documento: StorefrontLegalDocument | null
  /** Motivo do bloqueio do envio; `null` quando o envio pode seguir. */
  readonly bloqueio: string | null
}

export function termosDoOrcamento(
  estado: EstadoDoDocumentoLegal
): TermosDoOrcamento {
  switch (estado.status) {
    case 'publicado':
      return { exigeAceite: true, documento: estado.documento, bloqueio: null }
    case 'ausente':
      return { exigeAceite: false, documento: null, bloqueio: null }
    case 'carregando':
      return {
        exigeAceite: false,
        documento: null,
        bloqueio:
          'Aguarde o carregamento dos Termos de Uso da locadora para enviar a solicitação.',
      }
    case 'versao-nao-suportada':
      return {
        exigeAceite: false,
        documento: null,
        bloqueio:
          'Atualize o aplicativo para ler os Termos de Uso da locadora e enviar a solicitação.',
      }
    case 'erro':
      return {
        exigeAceite: false,
        documento: null,
        bloqueio:
          'Não foi possível carregar os Termos de Uso da locadora. Recarregue a página para enviar a solicitação.',
      }
  }
}
