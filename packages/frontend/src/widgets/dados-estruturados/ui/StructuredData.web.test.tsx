// @vitest-environment jsdom
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  getLocalBusinessData,
  type LocalBusinessData,
} from '../../../entities/configuracao'
import { StructuredData } from './StructuredData.web'

const XSS = '</script><script>alert(1)</script>'
const ORIGEM = 'https://locadora-alfa.example.test'
/** Negócio sintético de uma locadora (o teste anterior usava os dados padrão da GB, que saíram do frontend). */
const NEGOCIO: LocalBusinessData = {
  name: 'Locadora Alfa',
  url: ORIGEM,
  telephone: '+55 4130000000',
  taxID: '00.000.000/0001-91',
  address: {
    streetAddress: 'Rua A, 10',
    addressLocality: 'Curitiba',
    addressRegion: 'PR',
    addressCountry: 'BR',
  },
  // Onda 134: as categorias reais da locadora (antes, uma lista fixa da GB para qualquer locadora).
  offerCatalog: ['Andaimes Tubulares', 'Betoneiras'],
}

/** Interpreta o HTML renderizado com um parser HTML real, como o navegador faria. */
function parseRendered(html: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head></head><body>${html}<p id="depois">fim da página</p></body></html>`,
    'text/html'
  )
}

describe('StructuredData', () => {
  it('publica o negócio, o produto e a trilha', () => {
    const html = renderToStaticMarkup(
      createElement(StructuredData, {
        localBusiness: NEGOCIO,
        product: {
          name: 'Betoneira',
          description: 'Para concreto',
          image: ['/foto.jpg'],
          brand: 'Locadora Alfa',
          sku: 'abc',
          offers: {
            price: 100,
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: `${ORIGEM}/equipamentos/abc`,
          },
          category: 'Concreto',
          manufacturer: 'Locadora Alfa',
          seller: { name: 'Locadora Alfa', url: ORIGEM },
          shippingRegion: 'PR',
        },
        breadcrumbs: [{ name: 'Home', url: ORIGEM }],
      })
    )

    expect(html).toContain('Locadora Alfa')
    expect(html).toContain('00.000.000/0001-91')
    expect(html).toContain(`"@id": "${ORIGEM}/#business"`)
    expect(html).toContain(`"@id": "${ORIGEM}/equipamentos/abc#offer"`)
    expect(html).toMatch(
      /"seller": \{\s*"@type": "Organization",\s*"name": "Locadora Alfa",\s*"url": "https:\/\/locadora-alfa\.example\.test"/
    )
    expect(html).not.toMatch(/GB Loca|locacoesgb|34\.780\.330/i)
    const negocio = JSON.parse(
      parseRendered(html).querySelector('script')?.textContent ?? '{}'
    )
    expect(negocio.hasOfferCatalog).toEqual({
      '@type': 'OfferCatalog',
      name: 'Equipamentos para Locação',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Andaimes Tubulares' },
        { '@type': 'OfferCatalog', name: 'Betoneiras' },
      ],
    })
    expect(html).not.toMatch(
      /Andaimes Suspensos|Equipamentos para Altura|Compressores/
    )
    expect(html).toContain('https://schema.org/UsedCondition')
    expect(html).toContain('diária')
    // Achado 143: a nota fixa (4.8 de 124) não vinha de avaliações reais e a UF de entrega era o "RS" da GB; o teste
    // anterior exigia os dois. A região é a UF da própria locadora.
    expect(html).not.toContain('aggregateRating')
    expect(html).not.toMatch(/"ratingValue"|"reviewCount"|"RS"/)
    expect(html).toMatch(
      /"shippingDestination": \{\s*"@type": "DefinedRegion",\s*"addressCountry": "BR",\s*"addressRegion": \[\s*"PR"\s*\]/
    )
    expect(html).toContain('BreadcrumbList')
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    expect(html).toContain(`"priceValidUntil": "${validUntil}"`)
  })

  it('mantém inertes nomes maliciosos do negócio, do produto e da trilha', () => {
    const html = renderToStaticMarkup(
      createElement(StructuredData, {
        localBusiness: { ...NEGOCIO, name: `Locadora ${XSS}` },
        product: {
          name: `Betoneira ${XSS}`,
          description: '<!--<script>',
          image: ['/foto.jpg'],
          brand: 'Marca <img src=x onerror=alert(1)>',
          sku: 'abc',
          offers: {
            price: 100,
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: `${ORIGEM}/equipamentos/abc`,
          },
          category: 'Concreto',
          manufacturer: 'Fabricante',
        },
        breadcrumbs: [
          { name: `Categoria ${XSS}`, url: `${ORIGEM}/equipamentos?a=1&b=2` },
        ],
      })
    )

    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img')

    const doc = parseRendered(html)
    const scripts = [...doc.querySelectorAll('script')]
    expect(scripts).toHaveLength(3)
    expect(
      scripts.every((script) => script.type === 'application/ld+json')
    ).toBe(true)
    expect(doc.querySelectorAll('img')).toHaveLength(0)
    expect(doc.getElementById('depois')?.textContent).toBe('fim da página')

    const [negocio, produto, trilha] = scripts.map((script) =>
      JSON.parse(script.textContent ?? '')
    )
    expect(negocio.name).toBe(`Locadora ${XSS}`)
    expect(produto.name).toBe(`Betoneira ${XSS}`)
    expect(produto.description).toBe('<!--<script>')
    expect(produto.brand.name).toBe('Marca <img src=x onerror=alert(1)>')
    expect(trilha.itemListElement[0]).toMatchObject({
      name: `Categoria ${XSS}`,
      item: `${ORIGEM}/equipamentos?a=1&b=2`,
    })
  })

  // Achado 143: sem dados da locadora, nada de outra locadora entra no JSON-LD (nem vendedor, marca ou @id fixos).
  it('locadora só com o nome e produto sem marca: nenhum campo inventado', () => {
    const html = renderToStaticMarkup(
      createElement(StructuredData, {
        localBusiness: { name: 'Locadora Beta' },
        product: {
          name: 'Betoneira',
          description: 'Para concreto',
          image: ['/foto.jpg'],
          sku: 'abc',
          offers: {
            price: 100,
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: '/equipamentos/abc',
          },
          category: 'Concreto',
        },
      })
    )
    const [negocio, produto] = [
      ...parseRendered(html).querySelectorAll('script'),
    ].map((script) => JSON.parse(script.textContent ?? ''))
    // Onda 134: sem categorias da locadora, nenhum catálogo (antes, os 4 nomes fixos da GB).
    expect(Object.keys(negocio).sort()).toEqual(['@context', '@type', 'name'])
    expect(produto.brand).toBeUndefined()
    expect(produto.manufacturer).toBeUndefined()
    expect(produto.offers.seller).toBeUndefined()
    expect(produto.offers['@id']).toBe('/equipamentos/abc#offer')
    // Sem UF da locadora: a entrega fica só no país (nunca a UF de outra) e não há nota inventada.
    expect(produto.offers.shippingDetails.shippingDestination).toEqual({
      '@type': 'DefinedRegion',
      addressCountry: 'BR',
    })
    expect(produto.aggregateRating).toBeUndefined()
    expect(html).not.toMatch(/GB Loca|locacoesgb|34\.780\.330|Heinzelmann/i)
  })

  it('LocalBusiness null (sem identidade): só os outros schemas', () => {
    const html = renderToStaticMarkup(
      createElement(StructuredData, {
        localBusiness: null,
        breadcrumbs: [{ name: 'Home', url: '/' }],
      })
    )
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1)
    expect(html).not.toContain('LocalBusiness')
  })
})

// Decisão D-A do dono (2026-10-07): nunca aggregateRating no JSON-LD. O LocalBusiness sai por lista fechada de campos:
// mesmo um negócio que trouxesse uma nota (regressão no getLocalBusinessData) não a publica.
describe('StructuredData sem nota de avaliações (D-A)', () => {
  it('a nota da locadora (do painel ou de um negócio montado com ela) nunca entra no JSON-LD', () => {
    const NOTA = {
      rating: 4.8,
      count: 127,
      sourceName: 'Google',
      sourceUrl: 'https://maps.example.test/locadora-alfa',
    }
    const doPainel = getLocalBusinessData(
      { companyPhone: '(41) 3000-0000', siteContent: { reviews: NOTA } },
      { name: 'Locadora Alfa', url: ORIGEM }
    )
    const comNotaInjetada = {
      ...NEGOCIO,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 4.8,
        reviewCount: 127,
      },
      review: [{ '@type': 'Review', reviewRating: { ratingValue: 5 } }],
      reviews: NOTA,
    } as LocalBusinessData
    for (const localBusiness of [doPainel, comNotaInjetada]) {
      const html = renderToStaticMarkup(
        createElement(StructuredData, { localBusiness })
      )
      expect(html).toContain('"@type": "LocalBusiness"')
      expect(html).not.toMatch(
        /aggregateRating|AggregateRating|ratingValue|reviewCount|"review|"Review|maps\.example/
      )
    }
  })
})
