// Conteúdo institucional e compromissos no painel (onda 134, lote vitrine-conteúdo, B10). O formulário trabalha com
// texto e grava o objeto inteiro em `settings.siteContent` pelo `PUT /api/admin/settings`, validado pelo contrato
// (`SiteContentSchema`, escrita estrita). Campo vazio fica ausente: a vitrine não mostra o bloco (omissão). Compromisso
// desligado também fica ausente (D-E: desligado por padrão). Nenhum valor padrão: só o que a locadora digitou.
import {
  SITE_CONTENT_COMMITMENTS,
  SiteContentSchema,
  parsePublicSiteContent,
  type SiteContent,
  type SiteContentCommitment,
  type SiteMeasurementKey,
} from '@gb-locacoes/contracts/settings'

export interface MarcoDoFormulario {
  year: string
  title: string
  description: string
}

export interface ConteudoDoFormulario {
  experienceYears: string
  fleetSize: string
  clientsServed: string
  projectsCompleted: string
  citiesServed: string
  /** Uma construtora por linha. */
  featuredClients: string
  history: string
  timeline: MarcoDoFormulario[]
  /** Um destaque por linha (coluna "Equipamentos" do rodapé). */
  footerHighlights: string
  commitments: Record<SiteContentCommitment, boolean>
  latitude: string
  longitude: string
  placeId: string
  addressLine1: string
  addressLine2: string
  googleMerchantId: string
  reviewsRating: string
  reviewsCount: string
  reviewsSourceName: string
  reviewsSourceUrl: string
  // Onda 135, A11: medição e verificação (seção "SEO & Meta Tags" do painel).
  googleAnalyticsId: string
  googleAdsId: string
  googleSiteVerification: string
  facebookDomainVerification: string
}

/** Chave do erro no formulário (o campo, ou o grupo: marcos, local e avaliações). */
export type CampoDoConteudo =
  | 'experienceYears'
  | 'fleetSize'
  | 'clientsServed'
  | 'projectsCompleted'
  | 'citiesServed'
  | 'featuredClients'
  | 'history'
  | 'timeline'
  | 'footerHighlights'
  | 'storeLocation'
  | 'googleMerchantId'
  | 'reviews'
  | 'commitments'
  | 'googleAnalyticsId'
  | 'googleAdsId'
  | 'googleSiteVerification'
  | 'facebookDomainVerification'

const MENSAGENS: Record<CampoDoConteudo, string> = {
  experienceYears: 'Informe um número inteiro de 1 a 150.',
  fleetSize: 'Informe um número inteiro de 1 a 1.000.000.',
  clientsServed: 'Informe um número inteiro de 1 a 1.000.000.',
  projectsCompleted: 'Informe um número inteiro de 1 a 1.000.000.',
  citiesServed: 'Informe um número inteiro de 1 a 1.000.000.',
  featuredClients:
    'Até 12 construtoras, uma por linha, com até 80 caracteres cada.',
  history: 'Use até 1.500 caracteres, sem quebra de linha.',
  timeline:
    'Cada marco precisa de ano (1900 a 2100), título (até 80 caracteres) e descrição (até 240); são até 12 marcos.',
  footerHighlights:
    'Até 8 destaques, um por linha, com até 60 caracteres cada.',
  storeLocation:
    'Informe a latitude (-90 a 90), a longitude (-180 a 180) e a primeira linha do endereço; o Place ID tem de 16 a 256 letras, números, - ou _.',
  googleMerchantId:
    'O ID do Merchant Center tem só números (de 6 a 15 dígitos).',
  reviews:
    'A nota (1 a 5, com uma casa decimal), a quantidade, o nome da fonte e o link https da fonte vão juntos: sem fonte, não há nota.',
  commitments: 'Compromisso inválido.',
  googleAnalyticsId:
    'O ID do Google Analytics 4 começa com G- seguido de letras maiúsculas e números (ex.: G-ABC123DEF4).',
  googleAdsId:
    'O ID do Google Ads começa com AW- seguido só de números (ex.: AW-123456789).',
  googleSiteVerification:
    'Cole o código do Search Console (o valor de content da meta google-site-verification): de 20 a 100 letras, números, - ou _.',
  facebookDomainVerification:
    'Cole o código da Meta (o valor de content da meta facebook-domain-verification): de 20 a 64 letras minúsculas e números.',
}

/** Os campos de medição e verificação do formulário (o contrato: `SITE_MEASUREMENT_KEYS`). */
const CAMPOS_DE_MEDICAO = [
  'googleAnalyticsId',
  'googleAdsId',
  'googleSiteVerification',
  'facebookDomainVerification',
] as const satisfies readonly SiteMeasurementKey[]

/** Rótulo, exemplo e ajuda de cada campo de medição e verificação, os mesmos na web e no app. */
export const CAMPOS_DA_MEDICAO: ReadonlyArray<{
  readonly campo: (typeof CAMPOS_DE_MEDICAO)[number]
  readonly rotulo: string
  readonly exemplo: string
  readonly ajuda: string
}> = [
  {
    campo: 'googleAnalyticsId',
    rotulo: 'ID do Google Analytics 4',
    exemplo: 'G-ABC123DEF4',
    ajuda: 'Mede as visitas do seu site no Google Analytics.',
  },
  {
    campo: 'googleAdsId',
    rotulo: 'ID do Google Ads (conversões)',
    exemplo: 'AW-123456789',
    ajuda: 'Mede as conversões dos seus anúncios no Google Ads.',
  },
  {
    campo: 'googleSiteVerification',
    rotulo: 'Código de verificação do Google Search Console',
    exemplo: 'Cole o código ou a meta inteira',
    ajuda:
      'Comprova no Search Console que o site é seu (método "Tag HTML"). A verificação pelo DNS do domínio também vale.',
  },
  {
    campo: 'facebookDomainVerification',
    rotulo: 'Código de verificação do domínio no Facebook (Meta)',
    exemplo: 'Cole o código ou a meta inteira',
    ajuda: 'Comprova o domínio do site no Gerenciador de Negócios da Meta.',
  },
]

/** Os campos de medição e verificação do formulário, sem o resto do conteúdo (restaurar uma seção sem tocar a outra). */
export function medicaoDoFormulario(
  form: ConteudoDoFormulario
): Pick<ConteudoDoFormulario, (typeof CAMPOS_DE_MEDICAO)[number]> {
  return {
    googleAnalyticsId: form.googleAnalyticsId,
    googleAdsId: form.googleAdsId,
    googleSiteVerification: form.googleSiteVerification,
    facebookDomainVerification: form.facebookDomainVerification,
  }
}

/**
 * O código de verificação como a locadora cola: só o valor, ou a meta inteira que o Search Console e a Meta mostram
 * (`<meta name="..." content="CODIGO" />`); da meta sai só o `content`. O contrato valida o resto.
 */
function codigoDeVerificacao(valor: string): string {
  const limpo = valor.trim()
  const meta = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(limpo)
  return (meta ? meta[1]! : limpo).trim()
}

const texto = (valor: unknown) =>
  typeof valor === 'number' ? String(valor) : ''

/** Conteúdo gravado (lido chave a chave, como a vitrine) → formulário. */
export function conteudoDoFormulario(raw: unknown): ConteudoDoFormulario {
  const { content } = parsePublicSiteContent(raw)
  const local = content.storeLocation
  const notas = content.reviews
  return {
    experienceYears: texto(content.experienceYears),
    fleetSize: texto(content.fleetSize),
    clientsServed: texto(content.clientsServed),
    projectsCompleted: texto(content.projectsCompleted),
    citiesServed: texto(content.citiesServed),
    featuredClients: (content.featuredClients ?? []).join('\n'),
    history: content.history ?? '',
    timeline: (content.timeline ?? []).map((marco) => ({
      year: String(marco.year),
      title: marco.title,
      description: marco.description,
    })),
    footerHighlights: (content.footerHighlights ?? []).join('\n'),
    commitments: Object.fromEntries(
      SITE_CONTENT_COMMITMENTS.map((chave) => [
        chave,
        content.commitments?.[chave] === true,
      ])
    ) as Record<SiteContentCommitment, boolean>,
    latitude: texto(local?.latitude),
    longitude: texto(local?.longitude),
    placeId: local?.placeId ?? '',
    addressLine1: local?.addressLine1 ?? '',
    addressLine2: local?.addressLine2 ?? '',
    googleMerchantId: content.googleMerchantId ?? '',
    reviewsRating: texto(notas?.rating),
    reviewsCount: texto(notas?.count),
    reviewsSourceName: notas?.sourceName ?? '',
    reviewsSourceUrl: notas?.sourceUrl ?? '',
    googleAnalyticsId: content.googleAnalyticsId ?? '',
    googleAdsId: content.googleAdsId ?? '',
    googleSiteVerification: content.googleSiteVerification ?? '',
    facebookDomainVerification: content.facebookDomainVerification ?? '',
  }
}

/** Inteiro como a locadora digita ("1.200" ou "1200"); vazio é ausente; outro texto segue para o contrato recusar. */
function inteiro(valor: string): number | undefined {
  const limpo = valor.trim()
  if (!limpo) return undefined
  if (/^\d{1,3}(?:\.\d{3})+$/.test(limpo))
    return Number(limpo.replace(/\./g, ''))
  return Number(limpo)
}

/** Decimal com vírgula ou ponto; vazio é ausente. */
function decimal(valor: string): number | undefined {
  const limpo = valor.trim()
  return limpo ? Number(limpo.replace(',', '.')) : undefined
}

const linhas = (valor: string) =>
  valor
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)

const preenchido = (...valores: string[]) =>
  valores.some((valor) => valor.trim() !== '')

/** Formulário → `siteContent` validado (ou `null` e os erros por campo). */
export function conteudoParaSalvar(form: ConteudoDoFormulario): {
  conteudo: SiteContent | null
  erros: Partial<Record<CampoDoConteudo, string>>
} {
  const bruto: Record<string, unknown> = {}
  for (const campo of [
    'experienceYears',
    'fleetSize',
    'clientsServed',
    'projectsCompleted',
    'citiesServed',
  ] as const) {
    const valor = inteiro(form[campo])
    if (valor !== undefined) bruto[campo] = valor
  }
  const construtoras = linhas(form.featuredClients)
  if (construtoras.length > 0) bruto.featuredClients = construtoras
  if (form.history.trim()) bruto.history = form.history.trim()
  const marcos = form.timeline.filter((marco) =>
    preenchido(marco.year, marco.title, marco.description)
  )
  if (marcos.length > 0)
    bruto.timeline = marcos.map((marco) => ({
      year: inteiro(marco.year) ?? Number.NaN,
      title: marco.title.trim(),
      description: marco.description.trim(),
    }))
  const destaques = linhas(form.footerHighlights)
  if (destaques.length > 0) bruto.footerHighlights = destaques
  const ligados = SITE_CONTENT_COMMITMENTS.filter(
    (chave) => form.commitments[chave] === true
  )
  if (ligados.length > 0)
    bruto.commitments = Object.fromEntries(
      ligados.map((chave) => [chave, true])
    )
  if (
    preenchido(
      form.latitude,
      form.longitude,
      form.placeId,
      form.addressLine1,
      form.addressLine2
    )
  )
    bruto.storeLocation = {
      latitude: decimal(form.latitude) ?? Number.NaN,
      longitude: decimal(form.longitude) ?? Number.NaN,
      ...(form.placeId.trim() ? { placeId: form.placeId.trim() } : {}),
      addressLine1: form.addressLine1.trim(),
      ...(form.addressLine2.trim()
        ? { addressLine2: form.addressLine2.trim() }
        : {}),
    }
  if (form.googleMerchantId.trim())
    bruto.googleMerchantId = form.googleMerchantId.trim()
  if (
    preenchido(
      form.reviewsRating,
      form.reviewsCount,
      form.reviewsSourceName,
      form.reviewsSourceUrl
    )
  )
    bruto.reviews = {
      rating: decimal(form.reviewsRating) ?? Number.NaN,
      count: inteiro(form.reviewsCount) ?? Number.NaN,
      sourceName: form.reviewsSourceName.trim(),
      sourceUrl: form.reviewsSourceUrl.trim(),
    }
  // Medição e verificação (onda 135, A11): o ID como a locadora digita, sem espaço nas pontas; o código de
  // verificação também pode vir colado na meta inteira.
  for (const campo of CAMPOS_DE_MEDICAO) {
    const valor =
      campo === 'googleSiteVerification' ||
      campo === 'facebookDomainVerification'
        ? codigoDeVerificacao(form[campo])
        : form[campo].trim()
    if (valor) bruto[campo] = valor
  }
  const parsed = SiteContentSchema.safeParse(bruto)
  if (parsed.success) return { conteudo: parsed.data, erros: {} }
  const erros: Partial<Record<CampoDoConteudo, string>> = {}
  for (const issue of parsed.error.issues) {
    const campo = issue.path[0] as CampoDoConteudo
    if (campo in MENSAGENS) erros[campo] = MENSAGENS[campo]
  }
  return { conteudo: null, erros }
}
