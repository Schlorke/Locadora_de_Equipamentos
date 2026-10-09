import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SitePausadoPage } from './SitePausadoPage.web'

const render = (props: Parameters<typeof SitePausadoPage>[0]) =>
  renderToStaticMarkup(createElement(SitePausadoPage, props))

describe('SitePausadoPage (S13)', () => {
  it('compõe o aviso da pausa num único main', () => {
    const html = render({
      nome: 'Locadora A',
      contato: { telefone: '(51) 3333-0000' },
      areaDoClienteHref: '/area-cliente',
    })
    expect(html.match(/<main/g)).toHaveLength(1)
    expect(html).toContain('Site temporariamente indisponível')
    expect(html).toContain('href="tel:+555133330000"')
    expect(html).toContain('href="/area-cliente"')
  })

  // Achado 142: moldura neutra (marca da locadora no topo e rodapé mínimo), sem a navegação da vitrine.
  it('moldura neutra com a marca da locadora, sem catálogo, orçamento, carrinho, busca ou categorias', () => {
    const html = render({
      nome: 'Locadora Pausada',
      cidade: 'Canoas',
      uf: 'RS',
      logoUrl: null,
      contato: { telefone: '(51) 3333-0000' },
      areaDoClienteHref: '/area-cliente',
    })
    expect(html.match(/<header/g)).toHaveLength(1)
    expect(html.match(/<footer/g)).toHaveLength(1)
    expect(html).toContain('Locadora Pausada · Canoas/RS')
    expect(html).toContain('© Locadora Pausada. Todos os direitos reservados.')
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
    // Onda 134: a Política de Cookies continua no ar na pausa e fica no rodapé (sem documento publicado, só ela).
    expect(hrefs).toEqual(['tel:+555133330000', '/area-cliente', '/cookies'])
    expect(html).not.toMatch(
      /equipamentos|or[cç]amento|carrinho|buscar|categorias|Links R[aá]pidos/i
    )
  })
})

// Onda 134 (decisão do dono de 2026-10-06, item 4): o rodapé da pausa liga as páginas legais, que continuam no ar.
describe('SitePausadoPage: links legais (onda 134)', () => {
  it('rodapé com os documentos publicados e Cookies; sem documento publicado, só Cookies', () => {
    const links = (
      documentos: Parameters<typeof SitePausadoPage>[0]['documentos']
    ) => {
      const html = render({
        nome: 'Locadora A',
        contato: {},
        areaDoClienteHref: null,
        documentos,
      })
      const rodape = html.slice(html.lastIndexOf('<footer'))
      return [...rodape.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    }
    expect(links({ terms: true, privacy: true, returnPolicy: true })).toEqual([
      '/privacidade',
      '/termos',
      '/cookies',
      '/politica-devolucao',
    ])
    expect(
      links({ terms: false, privacy: false, returnPolicy: false })
    ).toEqual(['/cookies'])
    expect(links(undefined)).toEqual(['/cookies'])
  })
})
