/**
 * SEO Schemas adicionais da locadora: Organization, WebSite com SearchAction, Service e FAQPage.
 * Complementam o LocalBusiness e o Product. Todos os dados vêm da própria locadora (`business`, o mesmo
 * LocalBusiness de getLocalBusinessData); sem ela, só o FAQ (achado 143, T12: nunca dados de outra locadora).
 */

import {
  FAQ_CERTIFICACAO,
  SERVICO_COM_CERTIFICACAO,
  declarouTodos,
  type CompromissosDeclarados,
  type LocalBusinessData,
} from '../../../entities/configuracao'
import { serializeJsonLd } from '../../../shared/lib/seo/serialize-json-ld'

interface SEOSchemasProps {
  /** Dados da própria locadora; ausentes, Organization, WebSite e Service ficam de fora. */
  business?: LocalBusinessData | null
  /** Se deve incluir o schema de FAQ (apenas em páginas com FAQ) */
  includeFAQ?: boolean
  /** Perguntas frequentes para o schema FAQPage */
  faqItems?: Array<{ question: string; answer: string }>
  /**
   * Compromissos que a locadora declarou (onda 134, D-E): a certificação só entra no serviço de andaimes e
   * no FAQ com o compromisso dela. Sem eles (raiz legada), nenhuma afirmação de certificação.
   */
  compromissos?: CompromissosDeclarados | null
}

const SERVICES = [
  {
    name: 'Locação de Andaimes Suspensos',
    description:
      'Aluguel de andaimes suspensos elétricos e manuais para trabalhos em fachadas e altura.',
    certificacao: true,
  },
  {
    name: 'Locação de Betoneiras',
    description:
      'Aluguel de betoneiras de diversos tamanhos para preparo de concreto e argamassa. Equipamentos robustos e de fácil operação.',
  },
  {
    name: 'Locação de Compressores',
    description:
      'Aluguel de compressores de ar para construção civil, pintura e limpeza. Equipamentos potentes e econômicos.',
  },
  {
    name: 'Locação de Cadeiras Elétricas',
    description:
      'Aluguel de cadeiras elétricas para pintura e serviços em fachadas. Segurança e praticidade para trabalhos em altura.',
  },
]

const certificou = (compromissos?: CompromissosDeclarados | null) =>
  compromissos
    ? declarouTodos(compromissos, SERVICO_COM_CERTIFICACAO.requer)
    : false

export function SEOSchemas({
  business = null,
  includeFAQ = false,
  faqItems = [],
  compromissos = null,
}: SEOSchemasProps) {
  const schemas: Array<Record<string, unknown>> = []
  const comCertificacao = certificou(compromissos)

  if (business) {
    const url = business.url
    const organizationId = url ? { '@id': `${url}/#organization` } : {}
    const address = business.address

    // 1. Organization Schema - dados da própria locadora
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      ...organizationId,
      name: business.name,
      ...(url ? { url } : {}),
      ...(business.image
        ? {
            logo: { '@type': 'ImageObject', url: business.image },
            image: business.image,
          }
        : {}),
      ...(business.description ? { description: business.description } : {}),
      ...(business.telephone ? { telephone: business.telephone } : {}),
      ...(business.email ? { email: business.email } : {}),
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
      ...(business.sameAs && business.sameAs.length > 0
        ? { sameAs: business.sameAs }
        : {}),
      knowsAbout: [
        'Locação de equipamentos para construção civil',
        'Andaimes suspensos',
        'Betoneiras',
        'Compressores',
        'Equipamentos para trabalho em altura',
      ],
    })

    // 2. WebSite Schema com SearchAction - só com a origem do site da locadora
    if (url) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: business.name,
        url,
        inLanguage: 'pt-BR',
        publisher: organizationId,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${url}/equipamentos?busca={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      })
    }

    // 3. Service Schemas - serviços oferecidos
    SERVICES.forEach((service, index) => {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Service',
        ...(url ? { '@id': `${url}/#service-${index + 1}` } : {}),
        name: service.name,
        description:
          'certificacao' in service && comCertificacao
            ? `${service.description} ${SERVICO_COM_CERTIFICACAO.texto}`
            : service.description,
        serviceType: 'Locação de Equipamentos',
        provider: url
          ? organizationId
          : { '@type': 'Organization', name: business.name },
        availableChannel: {
          '@type': 'ServiceChannel',
          ...(url ? { serviceUrl: `${url}/orcamento` } : {}),
          ...(business.telephone ? { servicePhone: business.telephone } : {}),
          availableLanguage: 'pt-BR',
        },
      })
    })
  }

  // 4. FAQPage Schema (opcional); a pergunta de certificação só com o compromisso declarado (D-E)
  const perguntas =
    compromissos && declarouTodos(compromissos, FAQ_CERTIFICACAO.requer)
      ? [
          ...faqItems,
          {
            question: FAQ_CERTIFICACAO.question,
            answer: FAQ_CERTIFICACAO.answer,
          },
        ]
      : faqItems
  if (includeFAQ && perguntas.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: perguntas.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    })
  }

  return (
    <>
      {schemas.map((schema, index) => {
        // SEGURANÇA: faqItems e business chegam por props; serializeJsonLd escapa <, >, &,
        // U+2028 e U+2029 para nenhum texto fechar o <script>.
        const jsonLd = serializeJsonLd(schema)
        return (
          <script
            key={`seo-schema-${index}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd }}
          />
        )
      })}
    </>
  )
}

// FAQ padrão para a página de contato/sobre: sem nome, telefone, site ou cidade de uma locadora, e sem afirmar
// certificação (compromisso da locadora; onda 134, D-E).
export const defaultFAQItems = [
  {
    question: 'Quais equipamentos estão disponíveis para aluguel?',
    answer:
      'O catálogo do site mostra os equipamentos disponíveis para locação, com fotos, especificações e valores por período.',
  },
  {
    question: 'Qual a área de atendimento?',
    answer:
      'A entrega e a coleta são combinadas no orçamento, conforme o endereço da obra.',
  },
  {
    question: 'Como solicitar um orçamento de locação?',
    answer:
      'Pela página de orçamento do site ou pelos contatos da locadora informados no rodapé.',
  },
  {
    question: 'Qual o prazo mínimo de locação?',
    answer:
      'O prazo mínimo de locação varia conforme o equipamento. Entre em contato conosco para verificar as condições específicas para cada tipo de equipamento.',
  },
]
