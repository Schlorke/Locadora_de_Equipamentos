import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock("../../../entities/configuracao",()=>({usePublicSettings:()=>({settings:{companyPhone:"(11) 1234-5678",whatsappNumber:"(11) 99999-1111",contactEmail:"contato@tenant.test",marketingEmail:"",companyAddress:"Endereço da locadora",socialLinks:{},heroCarousel:[]},isLoading:false,error:null})}));
import { CookiesPage } from './CookiesPage'

describe('CookiesPage', () => {
  it('mantém o título e a seção de introdução', () => {
    const html = renderToStaticMarkup(createElement(CookiesPage))
    expect(html).toContain('Política de Cookies')
    expect(html).toContain('Introdução')
    expect(html).toContain(
      'Estamos prontos para esclarecer suas dúvidas sobre cookies.'
    )
    expect(html).toContain('(11) 1234-5678')
    expect(html).toContain('Para gerenciar cookies, acesse as configurações')
  })
})

// Onda 134 (decisão do dono de 2026-10-06, item 4): na pausa, a Política de Cookies continua no ar dentro da moldura
// neutra da locadora, com os links legais publicados no rodapé.
describe('CookiesPage em pausa', () => {
  it('com a moldura: marca da locadora no topo e links dos documentos publicados e Cookies no rodapé', () => {
    const html = renderToStaticMarkup(
      createElement(CookiesPage, {
        moldura: {
          nome: 'Locadora A',
          cidade: 'Canoas',
          uf: 'RS',
          logoUrl: null,
          documentos: { terms: true, privacy: false, returnPolicy: false },
        },
      })
    )
    expect(html).toMatch(/^<div class="flex min-h-screen flex-col bg-background"><header/)
    expect(html).toContain('Política de Cookies')
    expect(html).toContain('Locadora A · Canoas/RS')
    const rodape = html.slice(html.lastIndexOf('<footer'))
    expect([...rodape.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(['/termos', '/cookies'])
  })

  it('sem moldura (site no ar): a página como antes, sem a moldura neutra', () => {
    const html = renderToStaticMarkup(createElement(CookiesPage))
    expect(html).toMatch(/^<div class="min-h-screen bg-gray-50">/)
    expect(html).not.toContain('<footer')
  })
})
