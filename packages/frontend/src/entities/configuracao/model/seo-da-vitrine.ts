// SEO das páginas da vitrine por locadora (onda 135, A4; E12 do plano de aposentadoria da raiz). Cada página leva o
// título, a descrição, o canonical e o Open Graph da PRÓPRIA locadora: nome e cidade do cartão público dela, título e
// descrição SEO que ela gravou no painel (só na home) e a origem canônica do host dela (`https://{slug}.<raiz>`). Nunca
// um nome, domínio, imagem ou texto de outra locadora (T12; achado 143): sem o dado, o trecho fica de fora.

/** Páginas da vitrine com SEO próprio (o detalhe do equipamento tem o dele, em `entities/equipamento`). */
export type PaginaDaVitrine =
  | 'inicio'
  | 'equipamentos'
  | 'sobre'
  | 'contato'
  | 'orcamento'
  | 'termos'
  | 'privacidade'
  | 'cookies'
  | 'devolucao'

/** Cartão público da locadora e a origem canônica do site dela (`null` quando o ambiente não define a raiz). */
export interface LojaDoSeo {
  readonly name: string
  readonly city?: string | null
  readonly state?: string | null
  readonly logoUrl?: string | null
  readonly origin?: string | null
}

/** O que a leitura pública das configurações traz para o SEO (título e descrição do painel, texto "Sobre nós"). */
export interface ConfiguracoesDoSeo {
  readonly seoTitle?: string | null
  readonly seoDescription?: string | null
  readonly aboutUsText?: string | null
}

export interface SeoDaVitrine {
  readonly title: string
  readonly description: string
  /** Absoluto na origem da locadora; `null` sem a origem (a página fica sem canonical). */
  readonly canonicalUrl: string | null
  readonly siteName: string
  /** Logo da locadora, só quando é uma URL absoluta `http(s)` (o Open Graph exige URL absoluta). */
  readonly imageUrl: string | null
  readonly imageAlt: string
}

/** Caminho público de cada página no host da locadora. */
const CAMINHO_DA_PAGINA: Readonly<Record<PaginaDaVitrine, string>> = {
  inicio: '/',
  equipamentos: '/equipamentos',
  sobre: '/sobre',
  contato: '/contato',
  orcamento: '/orcamento',
  termos: '/termos',
  privacidade: '/privacidade',
  cookies: '/cookies',
  devolucao: '/politica-devolucao',
}

const texto = (value: string | null | undefined): string | undefined =>
  value?.replace(/\s+/g, ' ').trim() || undefined

/** " em Cidade/UF" (ou " em Cidade"), só com a cidade do cartão; vazio sem ela. */
function emLocal(loja: LojaDoSeo): string {
  const cidade = texto(loja.city)
  if (!cidade) return ''
  const uf = texto(loja.state)?.toUpperCase()
  return uf && /^[A-Z]{2}$/.test(uf) ? ` em ${cidade}/${uf}` : ` em ${cidade}`
}

/** Título e descrição de cada página, com o nome e a cidade da própria locadora. */
function textosDaPagina(
  pagina: PaginaDaVitrine,
  loja: LojaDoSeo,
  nome: string
): { title: string; description: string } {
  const local = emLocal(loja)
  switch (pagina) {
    case 'inicio':
      return {
        title: `${nome} | Locação de equipamentos`,
        description: `Locação de equipamentos${local} com ${nome}. Solicite seu orçamento.`,
      }
    case 'equipamentos':
      return {
        title: `Catálogo de equipamentos para locação | ${nome}`,
        description: `Confira os equipamentos disponíveis para locação${local} e solicite seu orçamento com ${nome}.`,
      }
    case 'sobre':
      return {
        title: `Sobre ${nome}`,
        description: `Conheça ${nome}: locação de equipamentos${local}.`,
      }
    case 'contato':
      return {
        title: `Contato | ${nome}`,
        description: `Entre em contato com ${nome}${local} e solicite seu orçamento de locação de equipamentos.`,
      }
    case 'orcamento':
      return {
        title: `Solicitar orçamento | ${nome}`,
        description: `Solicite seu orçamento de locação de equipamentos com ${nome}${local}.`,
      }
    case 'termos':
      return {
        title: `Termos de Uso e Condições | ${nome}`,
        description: `Termos de uso e condições de locação de equipamentos de ${nome}.`,
      }
    case 'privacidade':
      return {
        title: `Política de Privacidade | ${nome}`,
        description: `Como ${nome} coleta, usa e protege os seus dados pessoais, conforme a LGPD.`,
      }
    case 'cookies':
      return {
        title: `Política de Cookies | ${nome}`,
        description: `Como o site de ${nome} usa cookies para melhorar a sua experiência de navegação.`,
      }
    case 'devolucao':
      return {
        title: `Política de Devolução | ${nome}`,
        description: `Prazos, condições e procedimentos para devolver os equipamentos locados com ${nome}.`,
      }
  }
}

const absoluto = (url: string | null | undefined): string | null => {
  const valor = texto(url)
  return valor && /^https?:\/\/[^\s/]+/i.test(valor) ? valor : null
}

/**
 * SEO de uma página da vitrine. A home usa o título e a descrição SEO que a locadora gravou (a descrição cai no texto
 * "Sobre nós"); as demais páginas, o título da página com o nome dela. O canonical e o `og:url` ficam na origem
 * canônica do host da locadora; a imagem é o logo do cartão dela, quando houver.
 */
export function seoDaVitrine(
  pagina: PaginaDaVitrine,
  loja: LojaDoSeo,
  configuracoes?: ConfiguracoesDoSeo | null
): SeoDaVitrine {
  const nome = texto(loja.name) ?? ''
  const padrao = textosDaPagina(pagina, loja, nome)
  const proprio =
    pagina === 'inicio'
      ? {
          title: texto(configuracoes?.seoTitle),
          description:
            texto(configuracoes?.seoDescription) ??
            texto(configuracoes?.aboutUsText),
        }
      : {}
  const origem = texto(loja.origin)?.replace(/\/+$/, '')
  const caminho = CAMINHO_DA_PAGINA[pagina]
  return {
    title: proprio.title ?? padrao.title,
    description: proprio.description ?? padrao.description,
    canonicalUrl: origem ? `${origem}${caminho === '/' ? '' : caminho}` : null,
    siteName: nome,
    imageUrl: absoluto(loja.logoUrl),
    imageAlt: nome,
  }
}
