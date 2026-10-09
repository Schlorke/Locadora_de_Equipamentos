import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AvisoSitePausado } from './AvisoSitePausado.web'

const render = (props: Parameters<typeof AvisoSitePausado>[0]) =>
  renderToStaticMarkup(createElement(AvisoSitePausado, props))

describe('AvisoSitePausado (S13)', () => {
  it('aviso neutro com título, contato e área do cliente', () => {
    const html = render({
      nome: 'Locadora A',
      contato: { telefone: '(51) 3333-0000', email: 'contato@locadora.test' },
      areaDoClienteHref: '/area-cliente',
    })
    expect(html).toContain('role="heading" aria-level="1"')
    expect(html).toContain('Site temporariamente indisponível')
    expect(html).toContain('O site de Locadora A está fora do ar no momento.')
    expect(html).toContain('href="tel:+555133330000"')
    expect(html).toContain('href="mailto:contato@locadora.test"')
    expect(html).toContain('href="/area-cliente"')
    expect(html).toContain('Acessar a área do cliente')
    expect(html).not.toMatch(/assinatura|d[ií]vida|fatura|plataforma|suspens/i)
  })

  it('WhatsApp abre em outra aba sem expor a página', () => {
    const html = render({
      nome: 'Locadora A',
      contato: { whatsapp: '(51) 99999-0000' },
      areaDoClienteHref: null,
    })
    expect(html).toContain(
      'href="https://wa.me/5551999990000" class="underline underline-offset-4" target="_blank" rel="noopener noreferrer"'
    )
  })

  it('sem contato informado e sem área do cliente (modo legacy)', () => {
    const html = render({
      nome: 'Locadora A',
      contato: {},
      areaDoClienteHref: null,
    })
    expect(html).toContain(
      'Os contatos da locadora ainda não foram informados.'
    )
    expect(html).not.toContain('área do cliente')
    expect(html).not.toContain('<ul')
  })
})
