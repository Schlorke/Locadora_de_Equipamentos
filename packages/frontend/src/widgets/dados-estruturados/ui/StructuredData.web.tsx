'use client'

import type { StructuredDataProps } from '../model/types'
import { serializeJsonLd } from '../../../shared/lib/seo/serialize-json-ld'

export function StructuredData({
  localBusiness,
  product,
  breadcrumbs,
}: StructuredDataProps) {
  const schemas = []

  // Local Business Schema: só os campos da própria locadora (T12; achado 143).
  if (localBusiness) {
    const address = localBusiness.address
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      ...(localBusiness.url ? { '@id': `${localBusiness.url}/#business` } : {}),
      name: localBusiness.name,
      ...(localBusiness.description
        ? { description: localBusiness.description }
        : {}),
      ...(localBusiness.url ? { url: localBusiness.url } : {}),
      ...(localBusiness.telephone
        ? { telephone: localBusiness.telephone }
        : {}),
      ...(localBusiness.email ? { email: localBusiness.email } : {}),
      ...(localBusiness.taxID ? { taxID: localBusiness.taxID } : {}),
      ...(localBusiness.areaServed
        ? { areaServed: localBusiness.areaServed }
        : {}),
      ...(address
        ? {
            address: {
              '@type': 'PostalAddress',
              streetAddress: address.streetAddress,
              ...(address.addressLocality
                ? { addressLocality: address.addressLocality }
                : {}),
              ...(address.addressRegion
                ? { addressRegion: address.addressRegion }
                : {}),
              ...(address.postalCode ? { postalCode: address.postalCode } : {}),
              addressCountry: address.addressCountry,
            },
          }
        : {}),
      ...(localBusiness.geo
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: localBusiness.geo.latitude,
              longitude: localBusiness.geo.longitude,
            },
          }
        : {}),
      ...(localBusiness.openingHours && localBusiness.openingHours.length > 0
        ? { openingHours: localBusiness.openingHours }
        : {}),
      ...(localBusiness.contactPoints && localBusiness.contactPoints.length > 0
        ? {
            contactPoint: localBusiness.contactPoints.map((contactPoint) => ({
              '@type': 'ContactPoint',
              telephone: contactPoint.telephone,
              ...(contactPoint.contactType
                ? { contactType: contactPoint.contactType }
                : {}),
              ...(contactPoint.areaServed
                ? { areaServed: contactPoint.areaServed }
                : {}),
              ...(contactPoint.availableLanguage
                ? { availableLanguage: contactPoint.availableLanguage }
                : {}),
            })),
          }
        : {}),
      ...(localBusiness.sameAs && localBusiness.sameAs.length > 0
        ? { sameAs: localBusiness.sameAs }
        : {}),
      ...(localBusiness.image ? { image: localBusiness.image } : {}),
      ...(localBusiness.hasMap ? { hasMap: localBusiness.hasMap } : {}),
      // Catálogo com as categorias reais da locadora (onda 134); sem categorias, nenhum. Nunca nota de avaliação
      // (aggregateRating): a diretriz do Google recusa nota de outro site e autoavaliação (decisão D-A).
      ...(localBusiness.offerCatalog && localBusiness.offerCatalog.length > 0
        ? {
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Equipamentos para Locação',
              itemListElement: localBusiness.offerCatalog.map((name) => ({
                '@type': 'OfferCatalog',
                name,
              })),
            },
          }
        : {}),
    })
  }

  // Product Schema - Otimizado para Google Merchant Center
  if (product) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.image,
      ...(product.brand
        ? {
            brand: {
              '@type': 'Brand',
              name: product.brand,
            },
          }
        : {}),
      sku: product.sku,
      // MPN (Manufacturer Part Number) para identificação única no Merchant Center
      mpn: product.sku,
      // Condição do item - usado/rental para equipamentos de locação
      itemCondition: 'https://schema.org/UsedCondition',
      category: product.category,
      ...(product.manufacturer
        ? {
            manufacturer: {
              '@type': 'Organization',
              name: product.manufacturer,
            },
          }
        : {}),
      offers: {
        '@type': 'Offer',
        '@id': `${product.offers.url}#offer`,
        price: product.offers.price,
        priceCurrency: product.offers.priceCurrency,
        availability: product.offers.availability,
        url: product.offers.url,
        // Especificação de preço detalhada (preço por dia de locação)
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: product.offers.price,
          priceCurrency: product.offers.priceCurrency,
          unitCode: 'DAY', // Código UN/CEFACT para "dia"
          unitText: 'diária',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitCode: 'DAY',
          },
        },
        ...(product.seller
          ? {
              seller: {
                '@type': 'Organization',
                name: product.seller.name,
                ...(product.seller.url ? { url: product.seller.url } : {}),
              },
            }
          : {}),
        priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        // Informações de entrega para Merchant Center
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: {
            '@type': 'MonetaryAmount',
            value: 0,
            currency: 'BRL',
          },
          // Região da própria locadora (UF do cartão); sem ela, só o país. Nunca a UF de outra (achado 143).
          shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'BR',
            ...(product.shippingRegion
              ? { addressRegion: [product.shippingRegion] }
              : {}),
          },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
              '@type': 'QuantitativeValue',
              minValue: 0,
              maxValue: 1,
              unitCode: 'DAY',
            },
            transitTime: {
              '@type': 'QuantitativeValue',
              minValue: 0,
              maxValue: 1,
              unitCode: 'DAY',
            },
          },
        },
        // Política de devolução para Merchant Center
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'BR',
          returnPolicyCategory:
            'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 7,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/FreeReturn',
        },
      },
      // Sem aggregateRating: a nota fixa não vinha de avaliações reais (achado 143).
    })
  }

  // Breadcrumb Schema
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    })
  }

  return (
    <>
      {schemas.map((schema, index) => {
        // SEGURANÇA: nome, descrição e trilha vêm de dados cadastrados; JSON.stringify
        // não escapa "</script>". serializeJsonLd escapa <, >, &, U+2028 e U+2029.
        const jsonLd = serializeJsonLd(schema, 2)

        return (
          <script
            key={index}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )
      })}
    </>
  )
}
