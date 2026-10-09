// Utilitários para Structured Data - Server-side safe
// Este arquivo NÃO tem 'use client', então pode ser usado em Server Components
import {
  BUSINESS_DAYS,
  PublicBusinessHoursSchema,
  parsePublicSiteContent,
  type BusinessDay,
} from '@gb-locacoes/contracts/settings'
import { linkDoMapa } from './local-da-loja'

export interface LocalBusinessData {
  name: string
  description?: string
  url?: string
  telephone?: string
  taxID?: string
  areaServed?: string
  email?: string
  address?: {
    streetAddress: string
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry: string
  }
  geo?: {
    latitude: number
    longitude: number
  }
  openingHours?: string[]
  contactPoints?: Array<{
    contactType?: string
    telephone: string
    areaServed?: string
    availableLanguage?: string
  }>
  sameAs?: string[]
  /** URL da imagem do negócio (logo ou foto). Ajuda o Google a exibir no painel. */
  image?: string
  /** URL do mapa (ex.: Google Maps). Sinaliza localização física para o Google. */
  hasMap?: string
  /** Nomes das categorias reais da locadora (`hasOfferCatalog`, onda 134); sem categorias, nenhum catálogo. */
  offerCatalog?: string[]
}

/** Configurações públicas da locadora que entram no LocalBusiness. */
export interface LocalBusinessSettings {
  companyPhone?: string | null
  whatsappNumber?: string | null
  contactEmail?: string | null
  companyAddress?: string | null
  aboutUsText?: string | null
  socialLinks?: unknown
  /** Horário público (`businessHours` de `GET /api/settings/public`): vira `openingHours` (onda 134). */
  businessHours?: unknown
  /** Conteúdo institucional (`siteContent`): o `storeLocation` vira `geo` e `hasMap` (onda 134). */
  siteContent?: unknown
}

/** Identidade pública da própria locadora (cartão) e a origem canônica do site dela. */
export interface LocalBusinessIdentity {
  name?: string | null
  /** Origem canônica do site da locadora (`https://{slug}.<raiz>`), sem barra final. */
  url?: string | null
  city?: string | null
  state?: string | null
  logoUrl?: string | null
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const brazilianPhone = (value: string | undefined): string | undefined => {
  const digits = value?.replace(/\D/g, '')
  return digits ? `+55 ${digits}` : undefined
}

const SCHEMA_ORG_DAYS: Readonly<Record<BusinessDay, string>> = {
  monday: 'Mo',
  tuesday: 'Tu',
  wednesday: 'We',
  thursday: 'Th',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'Su',
}

/**
 * `openingHours` do schema.org a partir do horário público da locadora, no formato da produção
 * (`['Mo-Fr 08:00-18:00', 'Sa 08:00-12:00']`): dias seguidos com o mesmo horário formam uma faixa; dia fechado ou sem
 * dado fica de fora e quebra a faixa. Sem horário válido, nenhum.
 */
export function openingHoursSchemaOrg(raw: unknown): string[] {
  const parsed = PublicBusinessHoursSchema.safeParse(raw)
  if (!parsed.success) return []
  const groups: Array<{ days: BusinessDay[]; hours: string }> = []
  let previous: BusinessDay | null = null
  for (const day of BUSINESS_DAYS) {
    const value = parsed.data[day]
    if (!value || value.closed) {
      previous = null
      continue
    }
    const hours = `${value.open}-${value.close}`
    const last = groups[groups.length - 1]
    if (last && previous && last.hours === hours) last.days.push(day)
    else groups.push({ days: [day], hours })
    previous = day
  }
  return groups.map(({ days, hours }) => {
    const first = SCHEMA_ORG_DAYS[days[0]!]
    const final = SCHEMA_ORG_DAYS[days[days.length - 1]!]
    return `${days.length === 1 ? first : `${first}-${final}`} ${hours}`
  })
}

const SOCIAL_KEYS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'twitter',
] as const

/**
 * LocalBusiness (schema.org) só com os dados da própria locadora: o nome e a cidade do cartão público e o contato,
 * o endereço e as redes das configurações públicas dela. Campo ausente fica de fora; sem nome, não há LocalBusiness
 * (`null`). Nunca completa com dado de outra locadora (T12 da ADR adr-tenant-hosts; achado 143).
 */
export function getLocalBusinessData(
  settings?: LocalBusinessSettings | null,
  identity?: LocalBusinessIdentity | null,
  /** Nomes das categorias públicas da própria locadora (`GET /api/categories`), para o catálogo de ofertas. */
  catalog?: readonly string[] | null
): LocalBusinessData | null {
  const name = text(identity?.name)
  if (!name) return null
  const telephone = brazilianPhone(text(settings?.companyPhone))
  const whatsapp = brazilianPhone(text(settings?.whatsappNumber))
  const street = text(settings?.companyAddress)
  const url = text(identity?.url)?.replace(/\/+$/, '')
  const links =
    settings?.socialLinks && typeof settings.socialLinks === 'object'
      ? (settings.socialLinks as Record<string, unknown>)
      : {}
  const sameAs = SOCIAL_KEYS.map((key) => text(links[key])).filter(
    (value): value is string => Boolean(value && /^https:\/\//i.test(value))
  )
  if (whatsapp)
    sameAs.push(
      `https://api.whatsapp.com/send?phone=${whatsapp.replace(/\D/g, '')}`
    )
  const contactPoints = [
    ...(telephone
      ? [
          {
            contactType: 'Serviço ao cliente',
            telephone,
            availableLanguage: 'Português',
          },
        ]
      : []),
    ...(whatsapp
      ? [
          {
            contactType: 'Atendimento via WhatsApp',
            telephone: whatsapp,
            availableLanguage: 'Português',
          },
        ]
      : []),
  ]
  const data: LocalBusinessData = { name }
  const description = text(settings?.aboutUsText)
  if (description) data.description = description
  if (url) data.url = url
  if (telephone ?? whatsapp) data.telephone = telephone ?? whatsapp
  const email = text(settings?.contactEmail)
  if (email) data.email = email
  if (street)
    data.address = {
      streetAddress: street,
      ...(text(identity?.city)
        ? { addressLocality: text(identity?.city) }
        : {}),
      ...(text(identity?.state)
        ? { addressRegion: text(identity?.state) }
        : {}),
      addressCountry: 'BR',
    }
  if (contactPoints.length > 0) data.contactPoints = contactPoints
  if (sameAs.length > 0) data.sameAs = sameAs
  const image = text(identity?.logoUrl)
  if (image) data.image = image
  // Onda 134: local e horário só os que a própria locadora declarou (o conteúdo é lido chave a chave).
  const { content } = parsePublicSiteContent(settings?.siteContent)
  if (content.storeLocation) {
    data.geo = {
      latitude: content.storeLocation.latitude,
      longitude: content.storeLocation.longitude,
    }
    const map = linkDoMapa(content)
    if (map) data.hasMap = map
  }
  const openingHours = openingHoursSchemaOrg(settings?.businessHours)
  if (openingHours.length > 0) data.openingHours = openingHours
  const offerCatalog = [
    ...new Set((catalog ?? []).map((name) => text(name)).filter(Boolean)),
  ] as string[]
  if (offerCatalog.length > 0) data.offerCatalog = offerCatalog
  return data
}
