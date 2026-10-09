// Links legais da moldura da pausa (onda 134; decisão do dono de 2026-10-06, item 4; S13): na pausa, as páginas legais
// continuam no ar. O rodapé da moldura liga os documentos que a própria locadora publicou e a Política de Cookies da
// plataforma, na ordem do rodapé da vitrine. Documento não publicado não tem link (a página dá 404).
import {
  STOREFRONT_LEGAL_PAGE_PATHS,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'

export interface LinkLegal {
  readonly href: string
  readonly rotulo: string
}

/** Quais documentos a locadora publicou (`legalDocuments` da leitura pública). */
export type DocumentosPublicados = Partial<Record<StorefrontLegalKind, boolean>>

const ORDEM: ReadonlyArray<readonly [StorefrontLegalKind | 'cookies', string]> =
  [
    ['privacy', 'Privacidade'],
    ['terms', 'Termos'],
    ['cookies', 'Cookies'],
    ['returnPolicy', 'Devolução'],
  ]

export function linksLegaisDaPausa(
  publicados: DocumentosPublicados | null | undefined
): LinkLegal[] {
  return ORDEM.filter(
    ([chave]) => chave === 'cookies' || publicados?.[chave] === true
  ).map(([chave, rotulo]) => ({
    href: chave === 'cookies' ? '/cookies' : STOREFRONT_LEGAL_PAGE_PATHS[chave],
    rotulo,
  }))
}
