// SEO da vitrine por locadora (onda 135, A4; E12): cada página leva título, descrição, canonical e Open Graph da
// própria locadora, na origem canônica do host dela. Nunca um nome, domínio ou imagem fixos (T12).
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'

const api = vi.hoisted(() => ({ getPublicSettings: vi.fn() }))
vi.mock('../../../../host/server/public-api', () => api)
const loja = vi.hoisted(() => ({ getLojaDaVitrine: vi.fn() }))
vi.mock('./loja', () => loja)

// Só a apresentação é substituída: os módulos de rota e toda a composição de SEO são reais. Não renderizamos os
// Server Components async neste teste; chamamos o contrato que o Next resolve antes de montar as tags da página.
vi.mock('@gb-locacoes/frontend/pages/home', () => ({
  HomePage: () => null,
  buildHeroInitialSettings: vi.fn(),
  getLocalBusinessData: vi.fn(),
}))
vi.mock('./equipamentos/CatalogoDaVitrine', () => ({
  CatalogoDaVitrine: () => null,
}))
vi.mock('./sobre/SobreDaVitrine', () => ({ SobreDaVitrine: () => null }))
vi.mock('@gb-locacoes/frontend/pages/contato', () => ({
  ContatoPage: () => null,
}))
vi.mock('@gb-locacoes/frontend/pages/orcamento', () => ({
  QuotePageWrapper: () => null,
}))
vi.mock('@gb-locacoes/frontend/pages/termos', () => ({
  TermosPage: () => null,
}))
vi.mock('@gb-locacoes/frontend/pages/privacidade', () => ({
  PrivacidadePage: () => null,
}))
vi.mock('@gb-locacoes/frontend/pages/cookies', () => ({
  CookiesPage: () => null,
}))
vi.mock('@gb-locacoes/frontend/pages/politica-devolucao', () => ({
  PoliticaDevolucaoPage: () => null,
}))

import { metadataDaVitrine } from './seo'
import * as inicio from './page'
import * as equipamentos from './equipamentos/page'
import * as sobre from './sobre/page'
import * as contato from './contato/page'
import * as orcamento from './orcamento/page'
import * as termos from './termos/page'
import * as privacidade from './privacidade/page'
import * as cookies from './cookies/page'
import * as devolucao from './politica-devolucao/page'

const LOJA = {
  name: 'Locadora A',
  city: 'Curitiba',
  state: 'PR',
  logoUrl: 'https://cdn.example.test/a/logo.png',
  origin: 'https://locadora-a.plataforma.example',
}

afterEach(() => vi.resetAllMocks())

describe('metadataDaVitrine', () => {
  it('home: título e descrição do painel, canonical e Open Graph na origem da locadora', async () => {
    loja.getLojaDaVitrine.mockResolvedValue(LOJA)
    api.getPublicSettings.mockResolvedValue({
      seoTitle: 'Locadora A | Andaimes em Curitiba',
      seoDescription: 'Andaimes, betoneiras e escoras em Curitiba.',
    })
    expect(await metadataDaVitrine('locadora-a', 'inicio')).toEqual({
      title: { absolute: 'Locadora A | Andaimes em Curitiba' },
      description: 'Andaimes, betoneiras e escoras em Curitiba.',
      alternates: { canonical: 'https://locadora-a.plataforma.example' },
      openGraph: {
        type: 'website',
        locale: 'pt_BR',
        title: 'Locadora A | Andaimes em Curitiba',
        description: 'Andaimes, betoneiras e escoras em Curitiba.',
        siteName: 'Locadora A',
        url: 'https://locadora-a.plataforma.example',
        images: [
          { url: 'https://cdn.example.test/a/logo.png', alt: 'Locadora A' },
        ],
      },
      twitter: {
        card: 'summary',
        title: 'Locadora A | Andaimes em Curitiba',
        description: 'Andaimes, betoneiras e escoras em Curitiba.',
        images: [
          { url: 'https://cdn.example.test/a/logo.png', alt: 'Locadora A' },
        ],
      },
    })
    expect(loja.getLojaDaVitrine).toHaveBeenCalledWith('locadora-a')
    expect(api.getPublicSettings).toHaveBeenCalledWith('locadora-a')
  })

  it('outras páginas: título da página com o nome da locadora e canonical no caminho dela', async () => {
    loja.getLojaDaVitrine.mockResolvedValue(LOJA)
    api.getPublicSettings.mockResolvedValue(null)
    const termos = await metadataDaVitrine('locadora-a', 'devolucao')
    expect(termos.title).toEqual({
      absolute: 'Política de Devolução | Locadora A',
    })
    expect(termos.alternates).toEqual({
      canonical: 'https://locadora-a.plataforma.example/politica-devolucao',
    })
    // A indexação é do layout [locadora] (site não indexável): a página não reabre nada.
    expect(termos).not.toHaveProperty('robots')
  })

  it('sem origem nem logo absoluto: sem canonical, sem og:url e sem imagem (nunca a de outra locadora)', async () => {
    loja.getLojaDaVitrine.mockResolvedValue({
      ...LOJA,
      origin: null,
      logoUrl: null,
    })
    api.getPublicSettings.mockResolvedValue(null)
    const metadata = await metadataDaVitrine('locadora-a', 'contato')
    expect(metadata).not.toHaveProperty('alternates')
    expect(metadata.openGraph).not.toHaveProperty('url')
    expect(metadata.openGraph).not.toHaveProperty('images')
    expect(JSON.stringify(metadata)).not.toMatch(/GB|locacoesgb|Porto Alegre/i)
  })

  it.each([
    '/logo.png',
    '//cdn.example.test/logo.png',
    'data:image/png;base64,AAAA',
  ])(
    'logo não absoluto %s: não entra no Open Graph nem no Twitter, mesmo com origem válida',
    async (logoUrl) => {
      loja.getLojaDaVitrine.mockResolvedValue({ ...LOJA, logoUrl })
      api.getPublicSettings.mockResolvedValue(null)
      const metadata = await metadataDaVitrine('locadora-a', 'sobre')
      expect(metadata.alternates).toEqual({
        canonical: 'https://locadora-a.plataforma.example/sobre',
      })
      expect(metadata.openGraph).not.toHaveProperty('images')
      expect(metadata.twitter).not.toHaveProperty('images')
    }
  )

  it('sem cartão (vitrine desligada) ou slug inválido: nada (o título neutro do layout raiz fica)', async () => {
    loja.getLojaDaVitrine.mockResolvedValue(null)
    api.getPublicSettings.mockResolvedValue(null)
    expect(await metadataDaVitrine('locadora-a', 'inicio')).toEqual({})
    expect(await metadataDaVitrine('admin', 'inicio')).toEqual({})
    expect(loja.getLojaDaVitrine).toHaveBeenCalledTimes(1)
  })
})

type RotaComSeo = {
  generateMetadata?: (props: {
    params: Promise<{ locadora: string }>
  }) => Promise<Metadata>
}

// Os caminhos e os títulos são o resultado público esperado de cada URL. Importar só metadataDaVitrine deixava a
// suíte verde quando generateMetadata desaparecia de oito páginas e o Next herdava o título neutro do layout raiz.
const ROTAS: ReadonlyArray<[string, RotaComSeo, string]> = [
  ['', inicio, 'Locadora A | Andaimes em Curitiba'],
  [
    '/equipamentos',
    equipamentos,
    'Catálogo de equipamentos para locação | Locadora A',
  ],
  ['/sobre', sobre, 'Sobre Locadora A'],
  ['/contato', contato, 'Contato | Locadora A'],
  ['/orcamento', orcamento, 'Solicitar orçamento | Locadora A'],
  ['/termos', termos, 'Termos de Uso e Condições | Locadora A'],
  ['/privacidade', privacidade, 'Política de Privacidade | Locadora A'],
  ['/cookies', cookies, 'Política de Cookies | Locadora A'],
  ['/politica-devolucao', devolucao, 'Política de Devolução | Locadora A'],
]

const OUTRA_LOJA = {
  name: 'Locadora B',
  city: 'Salvador',
  state: 'BA',
  logoUrl: 'https://cdn.example.test/b/logo.png',
  origin: 'https://locadora-b.plataforma.example/',
}

async function metadadosDaRota(rota: RotaComSeo, slug: string) {
  // É a presença do contrato no módulo real, seguida de sua execução, que importa. Não procuramos texto no fonte.
  expect(rota.generateMetadata).toBeTypeOf('function')
  if (!rota.generateMetadata)
    throw new Error('A página não publica seus metadados')
  return rota.generateMetadata({ params: Promise.resolve({ locadora: slug }) })
}

describe('metadados publicados pelas páginas reais da vitrine', () => {
  it.each(ROTAS)(
    '%s mantém o SEO de cada locadora em chamadas concorrentes',
    async (path, rota, title) => {
      const settings = {
        'locadora-a': {
          seoTitle: 'Locadora A | Andaimes em Curitiba',
          seoDescription: 'Andaimes e escoras com a Locadora A.',
          // Dados do painel não podem trocar a origem canônica nem a identidade do cartão.
          publicBaseUrl: 'https://origem-estranha.example.test',
          companyName: 'Empresa estranha',
        },
        'locadora-b': {
          seoTitle: 'Locadora B | Máquinas em Salvador',
          seoDescription: 'Máquinas e ferramentas com a Locadora B.',
        },
      }
      loja.getLojaDaVitrine.mockImplementation(async (slug: string) =>
        slug === 'locadora-a' ? LOJA : slug === 'locadora-b' ? OUTRA_LOJA : null
      )
      api.getPublicSettings.mockImplementation(
        async (slug: keyof typeof settings) => settings[slug] ?? null
      )

      const [alfa, beta] = await Promise.all([
        metadadosDaRota(rota, 'locadora-a'),
        metadadosDaRota(rota, 'locadora-b'),
      ])

      const betaTitle =
        path === ''
          ? 'Locadora B | Máquinas em Salvador'
          : title.replace('Locadora A', 'Locadora B')
      expect(alfa.title).toEqual({ absolute: title })
      expect(beta.title).toEqual({ absolute: betaTitle })
      for (const [metadata, slug, tenant, logoUrl, expectedTitle] of [
        [alfa, 'locadora-a', 'Locadora A', LOJA.logoUrl, title],
        [beta, 'locadora-b', 'Locadora B', OUTRA_LOJA.logoUrl, betaTitle],
      ] as const) {
        const canonical = `https://${slug}.plataforma.example${path}`
        expect(metadata.description).toEqual(expect.stringContaining(tenant))
        expect(metadata.alternates).toEqual({ canonical })
        expect(metadata.openGraph).toMatchObject({
          type: 'website',
          locale: 'pt_BR',
          title: expectedTitle,
          description: metadata.description,
          siteName: tenant,
          url: canonical,
          images: [{ url: logoUrl, alt: tenant }],
        })
        expect(metadata.twitter).toMatchObject({
          card: 'summary',
          title: expectedTitle,
          description: metadata.description,
          images: [{ url: logoUrl, alt: tenant }],
        })
        expect(metadata).not.toHaveProperty('robots')
        expect(loja.getLojaDaVitrine).toHaveBeenCalledWith(slug)
        expect(api.getPublicSettings).toHaveBeenCalledWith(slug)
      }
      if (path === '') {
        expect(alfa.description).toBe('Andaimes e escoras com a Locadora A.')
        expect(beta.description).toBe(
          'Máquinas e ferramentas com a Locadora B.'
        )
      }
      expect(JSON.stringify(alfa)).not.toContain('Locadora B')
      expect(JSON.stringify(beta)).not.toContain('Locadora A')
      expect(JSON.stringify([alfa, beta])).not.toContain('origem-estranha')
    }
  )

  it.each(ROTAS)(
    '%s não publica identidade de locadora inexistente ou slug reservado',
    async (_path, rota) => {
      loja.getLojaDaVitrine.mockResolvedValue(null)
      api.getPublicSettings.mockResolvedValue(null)
      expect(await metadadosDaRota(rota, 'locadora-inexistente')).toEqual({})
      expect(await metadadosDaRota(rota, 'admin')).toEqual({})
      expect(loja.getLojaDaVitrine).toHaveBeenCalledTimes(1)
      expect(api.getPublicSettings).toHaveBeenCalledTimes(1)
    }
  )
})
