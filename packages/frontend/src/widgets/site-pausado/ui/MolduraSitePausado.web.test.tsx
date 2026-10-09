import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ComMolduraDaPausa, MolduraSitePausado } from './MolduraSitePausado.web'

const render = (
  props: Omit<Parameters<typeof MolduraSitePausado>[0], 'children'>
) =>
  renderToStaticMarkup(
    createElement(MolduraSitePausado, {
      ...props,
      children: createElement('main', null, 'aviso'),
    })
  )

describe('MolduraSitePausado (achado 142)', () => {
  it('marca da locadora no topo, o conteúdo e um rodapé mínimo, sem nenhum link (sem links legais informados)', () => {
    const html = render({ nome: 'Andaimes Sul', cidade: 'Curitiba', uf: 'PR' })
    expect(html).toMatch(
      /<header[^>]*>.*Andaimes Sul.*<\/header><main>aviso<\/main><footer/
    )
    expect(html).toContain('>AS<')
    expect(html).toContain('Andaimes Sul · Curitiba/PR')
    expect(html).toContain('© Andaimes Sul. Todos os direitos reservados.')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('<nav')
  })

  it('sem cidade e UF: só o nome no rodapé; nunca dado de outra locadora', () => {
    const html = render({ nome: 'Locadora Beta', cidade: null, uf: '  ' })
    expect(html).toContain('>Locadora Beta</p>')
    expect(html).not.toMatch(/GB Loca|Porto Alegre|CNPJ/)
  })

  it('só classes de token, sem cor fixa', () => {
    const html = render({ nome: 'Locadora Beta' })
    expect(html).not.toMatch(
      /#[0-9a-f]{3,6}|(?:bg|text|border)-(?:gray|slate|orange|white|black)/i
    )
  })

  // Onda 134 (decisão do dono de 2026-10-06, item 4): na pausa, as páginas legais continuam no ar e o rodapé da
  // moldura liga os documentos publicados e a Política de Cookies.
  it('com os links legais: um rodapé com os documentos publicados e Cookies, na ordem do rodapé da vitrine', () => {
    const html = render({
      nome: 'Andaimes Sul',
      links: [
        { href: '/termos', rotulo: 'Termos' },
        { href: '/cookies', rotulo: 'Cookies' },
      ],
    })
    expect(html).toMatch(
      /<footer[^>]*>.*<nav aria-label="Documentos legais"[^>]*><a[^>]*href="\/termos"[^>]*>Termos<\/a><a[^>]*href="\/cookies"[^>]*>Cookies<\/a><\/nav>.*<\/footer>/
    )
    expect(html).not.toMatch(
      /#[0-9a-f]{3,6}|(?:bg|text|border)-(?:gray|slate|orange|white|black)/i
    )
  })

  it('ComMolduraDaPausa: sem moldura, só o conteúdo; com moldura, o conteúdo dentro dela', () => {
    const conteudo = createElement('main', null, 'documento')
    expect(
      renderToStaticMarkup(
        createElement(ComMolduraDaPausa, { moldura: null, children: conteudo })
      )
    ).toBe('<main>documento</main>')
    const html = renderToStaticMarkup(
      createElement(ComMolduraDaPausa, {
        moldura: {
          nome: 'Andaimes Sul',
          documentos: { terms: false, privacy: true, returnPolicy: false },
        },
        children: conteudo,
      })
    )
    expect(html).toMatch(
      /<header[^>]*>.*Andaimes Sul.*<\/header><main>documento<\/main><footer/
    )
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual([
      '/privacidade',
      '/cookies',
    ])
  })
})
