import type { ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage, Link } from '@gb-locacoes/ui'
import { siglaDaLocadora } from '../../../entities/organizacao'
import {
  linksLegaisDaPausa,
  type DocumentosPublicados,
  type LinkLegal,
} from '../model/links-legais'

/** Cartão público da locadora na moldura neutra da pausa. */
interface CartaoDaMoldura {
  /** Nome público da locadora (cartão público). */
  readonly nome: string
  readonly cidade?: string | null
  readonly uf?: string | null
  /** Logo do cartão público; sem ele, a sigla do nome. */
  readonly logoUrl?: string | null
}

/** Dados que o host passa às páginas em pausa: o cartão e quais documentos legais a locadora publicou. */
export interface MolduraDaPausa extends CartaoDaMoldura {
  readonly documentos?: DocumentosPublicados | null
}

export interface MolduraSitePausadoProps extends CartaoDaMoldura {
  /** Documentos legais publicados e Cookies (`linksLegaisDaPausa`); sem eles, o rodapé fica sem links. */
  readonly links?: readonly LinkLegal[]
  readonly children: ReactNode
}

/**
 * Moldura neutra da vitrine em pausa (achado 142; B.5, linha "Site público"): só a marca da locadora no topo e um
 * rodapé mínimo com nome e cidade. Sem navegação para catálogo, orçamento, carrinho, busca ou categorias, que
 * respondem 503 na pausa. Onda 134 (decisão do dono de 2026-10-06, item 4): as páginas legais continuam no ar na
 * pausa, e o rodapé liga os documentos publicados e a Política de Cookies. O contato e a área do cliente ficam no
 * aviso. Só `@gb-locacoes/ui` e tokens.
 */
export function MolduraSitePausado({
  nome,
  cidade,
  uf,
  logoUrl,
  links = [],
  children,
}: MolduraSitePausadoProps) {
  const local = [cidade?.trim(), uf?.trim()].filter(Boolean).join('/')
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <Avatar>
            {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
            <AvatarFallback className="text-sm font-semibold text-foreground">
              {siglaDaLocadora(nome)}
            </AvatarFallback>
          </Avatar>
          <span className="text-lg font-semibold text-foreground">{nome}</span>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 sm:px-6">
          {/* Tamanho no parágrafo: a camada base dá o tamanho do <p>, não o herdado do contêiner. */}
          <p className="text-sm text-muted-foreground">
            {local ? `${nome} · ${local}` : nome}
          </p>
          <p className="text-sm text-muted-foreground">
            © {nome}. Todos os direitos reservados.
          </p>
          {links.length > 0 ? (
            <nav
              aria-label="Documentos legais"
              className="flex flex-wrap gap-x-6 gap-y-1"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.rotulo}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

/**
 * Embrulha uma página na moldura neutra da pausa quando a locadora está em pausa (`moldura`); sem ela, devolve a
 * página como está (a moldura da vitrine vem do host).
 */
export function ComMolduraDaPausa({
  moldura,
  children,
}: {
  moldura?: MolduraDaPausa | null
  children: ReactNode
}) {
  if (!moldura) return <>{children}</>
  const { documentos, ...cartao } = moldura
  return (
    <MolduraSitePausado {...cartao} links={linksLegaisDaPausa(documentos)}>
      {children}
    </MolduraSitePausado>
  )
}
