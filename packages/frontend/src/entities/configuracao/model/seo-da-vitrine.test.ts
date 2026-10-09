import { describe, expect, it } from 'vitest'
import { seoDaVitrine, type PaginaDaVitrine } from './seo-da-vitrine'

// Onda 135, A4 (E12): o SEO de cada página da vitrine é o da própria locadora: nome e cidade do cartão, título e
// descrição do painel na home e canonical/Open Graph na origem canônica do host dela. Nunca dado de outra locadora.
const LOJA = {
  name: 'Locadora Alfa',
  city: 'Curitiba',
  state: 'pr',
  logoUrl: 'https://cdn.example.test/alfa/logo.png',
  origin: 'https://alfa.plataforma.example/',
}

const PAGINAS: ReadonlyArray<[PaginaDaVitrine, string]> = [
  ['inicio', 'https://alfa.plataforma.example'],
  ['equipamentos', 'https://alfa.plataforma.example/equipamentos'],
  ['sobre', 'https://alfa.plataforma.example/sobre'],
  ['contato', 'https://alfa.plataforma.example/contato'],
  ['orcamento', 'https://alfa.plataforma.example/orcamento'],
  ['termos', 'https://alfa.plataforma.example/termos'],
  ['privacidade', 'https://alfa.plataforma.example/privacidade'],
  ['cookies', 'https://alfa.plataforma.example/cookies'],
  ['devolucao', 'https://alfa.plataforma.example/politica-devolucao'],
]

describe('seoDaVitrine', () => {
  it.each(PAGINAS)(
    '%s: título e descrição com o nome da locadora, canonical na origem dela',
    (pagina, canonical) => {
      const seo = seoDaVitrine(pagina, LOJA, null)
      expect(seo.canonicalUrl).toBe(canonical)
      expect(seo.title).toContain('Locadora Alfa')
      expect(seo.description).toContain('Locadora Alfa')
      expect(seo.siteName).toBe('Locadora Alfa')
      expect(seo.imageUrl).toBe('https://cdn.example.test/alfa/logo.png')
      expect(seo.description.length).toBeLessThanOrEqual(160)
    }
  )

  it('títulos distintos por página e a cidade/UF do cartão nas páginas comerciais', () => {
    const titulos = PAGINAS.map(([pagina]) => seoDaVitrine(pagina, LOJA).title)
    expect(new Set(titulos).size).toBe(PAGINAS.length)
    expect(seoDaVitrine('equipamentos', LOJA).description).toContain(
      'em Curitiba/PR'
    )
    expect(seoDaVitrine('contato', LOJA).title).toBe('Contato | Locadora Alfa')
  })

  it('a home usa o título e a descrição SEO do painel; sem a descrição, o "Sobre nós"', () => {
    expect(
      seoDaVitrine('inicio', LOJA, {
        seoTitle: '  Alfa Andaimes  ',
        seoDescription: 'Andaimes e betoneiras em Curitiba.',
        aboutUsText: 'Texto sobre nós',
      })
    ).toMatchObject({
      title: 'Alfa Andaimes',
      description: 'Andaimes e betoneiras em Curitiba.',
    })
    expect(
      seoDaVitrine('inicio', LOJA, {
        seoTitle: null,
        seoDescription: '   ',
        aboutUsText: 'Texto sobre nós',
      })
    ).toMatchObject({
      title: 'Locadora Alfa | Locação de equipamentos',
      description: 'Texto sobre nós',
    })
    // As outras páginas não usam o título da home.
    expect(
      seoDaVitrine('sobre', LOJA, { seoTitle: 'Alfa Andaimes' }).title
    ).toBe('Sobre Locadora Alfa')
  })

  it('sem origem, cidade ou logo absoluto: o trecho fica de fora, nunca um padrão de outra locadora', () => {
    const seo = seoDaVitrine('equipamentos', {
      name: 'Locadora Beta',
      city: null,
      state: null,
      logoUrl: '/logo.png',
      origin: null,
    })
    expect(seo.canonicalUrl).toBeNull()
    expect(seo.imageUrl).toBeNull()
    expect(seo.description).not.toMatch(/ em /)
    expect(JSON.stringify(seo)).not.toMatch(/GB|Porto Alegre|locacoesgb/i)
  })
})
