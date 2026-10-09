// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SEOSchemas, defaultFAQItems } from './SEOSchemas.web'

const XSS = '</script><script>alert(1)</script>'
const NEGOCIO = {
  name: 'Locadora Alfa',
  url: 'https://locadora-alfa.example.test',
  telephone: '+55 4130000000',
}

/** Interpreta o HTML renderizado com um parser HTML real, como o navegador faria. */
function parseRendered(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}<p id="depois">fim da página</p></body></html>`,
    'text/html'
  )
}

describe('SEOSchemas', () => {
  it('mantém inerte uma pergunta ou resposta maliciosa do FAQ', () => {
    const faqItems = [
      { question: `Qual o prazo? ${XSS}`, answer: '<!--<script>' },
      {
        question: 'Entregam?',
        answer: 'Sim <img src=x onerror=alert(1)> & retiramos',
      },
    ]

    const html = renderToStaticMarkup(
      createElement(SEOSchemas, {
        business: NEGOCIO,
        includeFAQ: true,
        faqItems,
      })
    )

    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img')

    const doc = parseRendered(html)
    const scripts = [...doc.querySelectorAll('script')]
    // Organization + WebSite + 4 Service + FAQPage.
    expect(scripts).toHaveLength(7)
    expect(
      scripts.every((script) => script.type === 'application/ld+json')
    ).toBe(true)
    expect(doc.querySelectorAll('img')).toHaveLength(0)
    expect(doc.getElementById('depois')?.textContent).toBe('fim da página')

    const faq = JSON.parse(scripts[6]!.textContent ?? '')
    expect(faq['@type']).toBe('FAQPage')
    expect(
      faq.mainEntity.map(
        (entry: { name: string; acceptedAnswer: { text: string } }) => ({
          question: entry.name,
          answer: entry.acceptedAnswer.text,
        })
      )
    ).toEqual(faqItems)
  })

  it('sem caractere perigoso, cada bloco continua igual ao JSON.stringify compacto', () => {
    const html = renderToStaticMarkup(
      createElement(SEOSchemas, {
        business: NEGOCIO,
        includeFAQ: true,
        faqItems: defaultFAQItems,
      })
    )

    const bodies = [...parseRendered(html).querySelectorAll('script')].map(
      (script) => script.textContent ?? ''
    )

    expect(bodies).toHaveLength(7)
    for (const body of bodies)
      expect(body).toBe(JSON.stringify(JSON.parse(body)))
  })

  // Achado 143 (T12): a organização, o site e os serviços são os da locadora informada; sem ela, só o FAQ, e o FAQ
  // padrão não cita nome, telefone, site ou cidade de nenhuma locadora.
  it('sem a locadora: só o FAQ, sem nenhum dado da GB', () => {
    const html = renderToStaticMarkup(
      createElement(SEOSchemas, { includeFAQ: true, faqItems: defaultFAQItems })
    )
    const schemas = [...parseRendered(html).querySelectorAll('script')].map(
      (script) => JSON.parse(script.textContent ?? '')
    )
    expect(schemas.map((schema) => schema['@type'])).toEqual(['FAQPage'])
    expect(html).not.toMatch(
      /GB Loca|locacoesgb|locacoes_gb|2313-6262|99820-5163|Porto Alegre|-29\.99/i
    )
  })

  it('com a locadora: @id, URL de busca e canal de serviço na origem dela', () => {
    const html = renderToStaticMarkup(
      createElement(SEOSchemas, { business: NEGOCIO })
    )
    const [organization, website, service] = [
      ...parseRendered(html).querySelectorAll('script'),
    ].map((script) => JSON.parse(script.textContent ?? ''))
    expect(organization).toMatchObject({
      '@id': `${NEGOCIO.url}/#organization`,
      name: 'Locadora Alfa',
      url: NEGOCIO.url,
    })
    expect(website.potentialAction.target.urlTemplate).toBe(
      `${NEGOCIO.url}/equipamentos?busca={search_term_string}`
    )
    expect(service.availableChannel).toEqual({
      '@type': 'ServiceChannel',
      serviceUrl: `${NEGOCIO.url}/orcamento`,
      servicePhone: '+55 4130000000',
      availableLanguage: 'pt-BR',
    })
    expect(html).not.toMatch(/GB Loca|locacoesgb/i)
  })

  // Onda 134 (D-E): a certificação de segurança é compromisso da locadora. O FAQ padrão (raiz legada, sem as
  // configurações da locadora no layout) não a afirma; o serviço de andaimes e o FAQ só a citam com o compromisso.
  it('FAQ padrão sem a pergunta de certificação; com o compromisso declarado, a pergunta volta no fim', () => {
    expect(defaultFAQItems.map((item) => item.question)).not.toContain(
      'Os equipamentos possuem certificação de segurança?'
    )
    expect(JSON.stringify(defaultFAQItems)).not.toMatch(/certifica/i)
    const faq = (compromissos?: Record<string, boolean>) => {
      const html = renderToStaticMarkup(
        createElement(SEOSchemas, {
          includeFAQ: true,
          faqItems: defaultFAQItems,
          compromissos,
        } as never)
      )
      const [schema] = [...parseRendered(html).querySelectorAll('script')].map(
        (script) => JSON.parse(script.textContent ?? '')
      )
      return (schema.mainEntity as Array<{ name: string }>).map(
        (question) => question.name
      )
    }
    expect(faq()).toHaveLength(defaultFAQItems.length)
    expect(faq({ certifiedEquipment: false })).toHaveLength(
      defaultFAQItems.length
    )
    expect(faq({ certifiedEquipment: true }).at(-1)).toBe(
      'Os equipamentos possuem certificação de segurança?'
    )
  })

  it('serviço de andaimes só afirma a certificação com o compromisso declarado', () => {
    const andaimes = (compromissos?: Record<string, boolean>) => {
      const html = renderToStaticMarkup(
        createElement(SEOSchemas, { business: NEGOCIO, compromissos } as never)
      )
      return [...parseRendered(html).querySelectorAll('script')]
        .map((script) => JSON.parse(script.textContent ?? ''))
        .find((schema) => schema.name === 'Locação de Andaimes Suspensos')
        .description as string
    }
    expect(andaimes()).toBe(
      'Aluguel de andaimes suspensos elétricos e manuais para trabalhos em fachadas e altura.'
    )
    expect(andaimes({ certifiedEquipment: true })).toBe(
      'Aluguel de andaimes suspensos elétricos e manuais para trabalhos em fachadas e altura. Equipamentos com manutenção em dia e certificação de segurança.'
    )
  })
})
