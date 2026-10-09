import {
  AvisoSitePausado,
  MolduraSitePausado,
  linksLegaisDaPausa,
  type AvisoSitePausadoProps,
  type DocumentosPublicados,
} from '../../../widgets/site-pausado'

export interface SitePausadoPageProps extends AvisoSitePausadoProps {
  readonly cidade?: string | null
  readonly uf?: string | null
  readonly logoUrl?: string | null
  /** Quais textos legais a locadora publicou: o rodapé liga esses e a Política de Cookies (onda 134). */
  readonly documentos?: DocumentosPublicados | null
}

/**
 * Página da vitrine em pausa (S13; ADR docs/architecture/adr-saas-subscription.md, B.5, linha "Site público"). O host
 * entrega esta página com HTTP 503, Retry-After e noindex e sem a moldura da vitrine; aqui só a composição (moldura
 * neutra da locadora e o aviso), sem regra de assinatura.
 */
export function SitePausadoPage({
  cidade,
  uf,
  logoUrl,
  documentos,
  ...aviso
}: SitePausadoPageProps) {
  return (
    <MolduraSitePausado
      nome={aviso.nome}
      cidade={cidade}
      uf={uf}
      logoUrl={logoUrl}
      links={linksLegaisDaPausa(documentos)}
    >
      <main className="flex flex-1 flex-col items-center px-4 py-16">
        <AvisoSitePausado {...aviso} />
      </main>
    </MolduraSitePausado>
  )
}
