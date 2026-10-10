import 'server-only'
import {
  parsePublicEquipment,
  type PublicEquipment,
} from '@gb-locacoes/contracts'
export type { PublicEquipment } from '@gb-locacoes/contracts'
import { cache } from 'react'
import {
  isTenantSlug,
  resolveWebPlatformEnv,
} from '@gb-locacoes/contracts/platform'
import {
  PublicTenantCardSchema,
  type PublicTenantCard,
} from '@gb-locacoes/contracts/directory'
import {
  CLIENT_AREA_CARD_SCOPE,
  PUBLIC_TENANT_CARD_SCOPE_PARAM,
} from '@gb-locacoes/contracts/subscription'
import {
  STOREFRONT_LEGAL_SLUGS,
  parseStorefrontLegalDocument,
  type StorefrontLegalDocument,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import {
  readSiteState,
  readTenantSiteState,
  type SiteState,
  type TenantSiteState,
} from './site-state'

/**
 * Gateway server-only do host web para as APIs públicas do backend (desenho 4.3 e 4.4).
 *
 * As páginas da árvore `[locadora]` não tocam banco nem Prisma: leem o backend em `WEB_API_ORIGIN` com a
 * locadora explícita (`tenantSlug` do segmento, que o proxy tirou do Host). Sem contexto de borda, o backend
 * aplica o contrato explícito (tabela 4.5) e continua isolando por `withTenantTransaction`.
 *
 * Fase 1 (D11): leituras dinâmicas, sem cache de dados. O Lote 9 liga ISR com as tags `t:{slug}:*`.
 */

export class PublicApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicApiError'
  }
}

/** Cartão da locadora mais o modo do site (S13): LIVE ou PAUSED; OFF é o 404 (`null`). */
export type PublicSite = PublicTenantCard & SiteState

/**
 * Cartão da locadora no escopo da área do cliente (B.5, linha "Área do cliente final") mais o modo do site, que aqui
 * pode ser OFF: a locadora ainda atende a área do cliente com o site desligado por falta de publicação.
 */
export type TenantSite = PublicTenantCard & TenantSiteState

export interface PublicSettings {
  companyPhone?: string
  whatsappNumber?: string
  contactEmail?: string
  companyAddress?: string
  aboutUsText?: string
  /** Redes da própria locadora (JSON-LD `sameAs`). */
  socialLinks?: Record<string, unknown>
  heroCarousel?: unknown
  waveAnimation?: unknown
  /** Horário público (JSON-LD `openingHours`); validado pelas entidades da vitrine. */
  businessHours?: unknown
  /** Conteúdo institucional (onda 134): lido chave a chave pelas entidades da vitrine. */
  siteContent?: unknown
  /** Quais textos legais a locadora publicou (onda 134). */
  legalDocuments?: unknown
  /** Título e descrição SEO que a locadora gravou no painel (onda 135, A4): a home da vitrine os usa. */
  seoTitle?: string
  seoDescription?: string
}

/** Documento legal publicado pela locadora, já validado pelo contrato (onda 134). */
export interface PublicLegalDocument {
  readonly document: StorefrontLegalDocument
  readonly publishedAt: string | null
}

type Fetcher = (_input: string, _init: RequestInit) => Promise<Response>

export interface PublicApiOptions {
  /** Origem do backend; padrão: `WEB_API_ORIGIN` validada por `resolveWebPlatformEnv`. */
  readonly apiOrigin?: string
  readonly fetch?: Fetcher
}

const EQUIPMENT_ID = /^[A-Za-z0-9_-]{1,128}$/

function backendOrigin(options: PublicApiOptions): string {
  if (options.apiOrigin) return options.apiOrigin
  const origin = resolveWebPlatformEnv(process.env).apiOrigin
  if (origin === null)
    throw new PublicApiError('WEB_API_ORIGIN não configurada para o host web.')
  return origin
}

async function getJson(
  path: string,
  options: PublicApiOptions
): Promise<{ status: number; body: unknown; response: Response }> {
  const url = backendOrigin(options) + path
  const doFetch: Fetcher =
    options.fetch ?? ((input, init) => fetch(input, init))
  let response: Response
  try {
    response = await doFetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    throw new PublicApiError(`Backend indisponível em ${path.split('?')[0]}.`)
  }
  let body: unknown = null
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await response.json()
    } catch {
      body = null
    }
  }
  return { status: response.status, body, response }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/** Converte a resposta de `GET /api/settings/public` no subconjunto que as páginas usam. */
export function parsePublicSettings(body: unknown): PublicSettings | null {
  if (!isRecord(body)) return null
  return {
    companyPhone: optionalText(body.companyPhone),
    whatsappNumber: optionalText(body.whatsappNumber),
    contactEmail: optionalText(body.contactEmail),
    companyAddress: optionalText(body.companyAddress),
    aboutUsText: optionalText(body.aboutUsText),
    socialLinks: isRecord(body.socialLinks) ? body.socialLinks : undefined,
    heroCarousel: body.heroCarousel,
    waveAnimation: body.waveAnimation,
    businessHours: body.businessHours,
    siteContent: body.siteContent,
    legalDocuments: body.legalDocuments,
    seoTitle: optionalText(body.seoTitle),
    seoDescription: optionalText(body.seoDescription),
  }
}

/**
 * Cartão público da locadora do segmento, com o modo do site. `null` para slug inválido, reservado, inexistente,
 * suspenso ou com o site desligado (o backend responde o mesmo 404 neutro para todos): o layout chama `notFound()`.
 * Falha do backend lança.
 */
export async function fetchPublicSite(
  slug: string,
  options: PublicApiOptions = {}
): Promise<PublicSite | null> {
  if (!isTenantSlug(slug)) return null
  const { status, body, response } = await getJson(
    '/api/public/tenants/' + encodeURIComponent(slug),
    options
  )
  if (status === 404) return null
  if (status !== 200)
    throw new PublicApiError(`Cartão da locadora respondeu ${status}.`)
  const card = PublicTenantCardSchema.safeParse(body)
  if (!card.success || card.data.slug !== slug)
    throw new PublicApiError('Cartão da locadora fora do contrato.')
  let site: SiteState
  try {
    site = readSiteState(response)
  } catch {
    throw new PublicApiError('Modo do site fora do contrato.')
  }
  return { ...card.data, ...site }
}

/**
 * Cartão da locadora do segmento no escopo da área do cliente (`?scope=client-area`), com o modo do site (LIVE, PAUSED
 * ou OFF). `null` quando a locadora não tem área do cliente nem vitrine (slug inválido ou reservado, inexistente, com
 * bloqueio administrativo, SETUP ou ARCHIVED com a fiscalização `on`: o mesmo 404 neutro): o layout da locadora chama
 * `notFound()`. Falha do backend lança.
 */
export async function fetchTenantSite(
  slug: string,
  options: PublicApiOptions = {}
): Promise<TenantSite | null> {
  if (!isTenantSlug(slug)) return null
  const { status, body, response } = await getJson(
    '/api/public/tenants/' +
      encodeURIComponent(slug) +
      '?' +
      PUBLIC_TENANT_CARD_SCOPE_PARAM +
      '=' +
      CLIENT_AREA_CARD_SCOPE,
    options
  )
  if (status === 404) return null
  if (status !== 200)
    throw new PublicApiError(`Cartão da locadora respondeu ${status}.`)
  const card = PublicTenantCardSchema.safeParse(body)
  if (!card.success || card.data.slug !== slug)
    throw new PublicApiError('Cartão da locadora fora do contrato.')
  let site: TenantSiteState
  try {
    site = readTenantSiteState(response)
  } catch {
    throw new PublicApiError('Modo do site fora do contrato.')
  }
  return { ...card.data, ...site }
}

/** A vitrine de uma locadora com área do cliente: `null` com o site desligado. */
export function storefrontOf(site: TenantSite | null): PublicSite | null {
  if (site === null || site.mode === 'OFF') return null
  return { ...site, mode: site.mode }
}

/**
 * Configurações públicas da locadora. Como no host anterior, a ausência (409 sem configuração) ou uma falha de
 * leitura cai nos padrões da página em vez de derrubá-la.
 */
export async function fetchPublicSettings(
  slug: string,
  options: PublicApiOptions = {}
): Promise<PublicSettings | null> {
  if (!isTenantSlug(slug)) return null
  try {
    const { status, body } = await getJson(
      '/api/settings/public?tenantSlug=' + encodeURIComponent(slug),
      options
    )
    return status === 200 ? parsePublicSettings(body) : null
  } catch (error) {
    console.error(
      '[public-api] configurações públicas indisponíveis; usando padrões',
      {
        error: error instanceof Error ? error.message : 'unknown',
      }
    )
    return null
  }
}

/**
 * Nomes das categorias públicas da locadora, para o catálogo de ofertas do JSON-LD (onda 134). O JSON-LD é opcional:
 * falha ou resposta fora do contrato fica sem catálogo (registrada) em vez de derrubar a página.
 */
export async function fetchPublicCategoryNames(
  slug: string,
  options: PublicApiOptions = {}
): Promise<string[]> {
  if (!isTenantSlug(slug)) return []
  try {
    const { status, body } = await getJson(
      '/api/categories?tenantSlug=' + encodeURIComponent(slug),
      options
    )
    if (status !== 200 || !Array.isArray(body))
      throw new PublicApiError(`Categorias da locadora responderam ${status}.`)
    return body
      .filter(isRecord)
      .map((category) => category.name)
      .filter((name): name is string => typeof name === 'string')
  } catch (error) {
    console.error(
      '[public-api] categorias indisponíveis; JSON-LD sem catálogo',
      {
        error: error instanceof Error ? error.message : 'unknown',
      }
    )
    return []
  }
}

/**
 * Texto legal publicado pela locadora (onda 134; páginas `/termos`, `/privacidade` e `/politica-devolucao`). `null` só
 * no 404 (documento não publicado ou locadora inexistente: a página chama `notFound()`). Qualquer outra falha (5xx,
 * backend fora, versão que este código não conhece, documento fora do contrato) lança: nunca vira um 404 falso.
 */
export async function fetchPublicLegalDocument(
  slug: string,
  kind: StorefrontLegalKind,
  options: PublicApiOptions = {}
): Promise<PublicLegalDocument | null> {
  if (!isTenantSlug(slug)) return null
  const { status, body } = await getJson(
    '/api/settings/public/legal-documents/' +
      STOREFRONT_LEGAL_SLUGS[kind] +
      '?tenantSlug=' +
      encodeURIComponent(slug),
    options
  )
  if (status === 404) return null
  if (status !== 200)
    throw new PublicApiError(`Documento legal respondeu ${status}.`)
  const lido = parseStorefrontLegalDocument(
    isRecord(body) ? body.document : null
  )
  if (lido.status !== 'ok')
    throw new PublicApiError(
      lido.status === 'unsupported-version'
        ? 'Versão do documento legal desconhecida.'
        : 'Documento legal fora do contrato.'
    )
  const publishedAt =
    isRecord(body) && typeof body.publishedAt === 'string'
      ? body.publishedAt
      : null
  return { document: lido.document, publishedAt }
}

/** Detalhe público de um equipamento da locadora. `null` para id inválido ou de outra locadora (404). */
export async function fetchPublicEquipment(
  slug: string,
  id: string,
  options: PublicApiOptions = {}
): Promise<PublicEquipment | null> {
  if (!isTenantSlug(slug) || !EQUIPMENT_ID.test(id)) return null
  const { status, body } = await getJson(
    '/api/equipments/' +
      encodeURIComponent(id) +
      '?tenantSlug=' +
      encodeURIComponent(slug),
    options
  )
  if (status === 404) return null
  if (status !== 200)
    throw new PublicApiError(`Detalhe do equipamento respondeu ${status}.`)
  const equipment = parsePublicEquipment(body)
  if (equipment === null || equipment.id !== id)
    throw new PublicApiError('Detalhe do equipamento fora do contrato.')
  return equipment
}

/** Categoria do sitemap.xml: o slug (filtro do catálogo) e a última alteração (ISO), quando a leitura a traz. */
export interface PublicSitemapCategory {
  readonly slug: string
  readonly updatedAt: string | null
}

/** O que o sitemap.xml da locadora lista do catálogo dela. */
export interface PublicSitemapCatalog {
  /** Equipamentos disponíveis. */
  readonly equipmentIds: string[]
  /** Categorias com ao menos um equipamento disponível, na ordem da leitura pública (nome). */
  readonly categories: PublicSitemapCategory[]
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

/** Lista pública da locadora (`/api/equipments` ou `/api/categories`); fora do contrato ou falha do backend lança. */
async function publicList(
  path: string,
  slug: string,
  options: PublicApiOptions
): Promise<Record<string, unknown>[]> {
  const { status, body } = await getJson(
    path + '?tenantSlug=' + encodeURIComponent(slug),
    options
  )
  if (status !== 200 || !Array.isArray(body))
    throw new PublicApiError(`${path} da locadora respondeu ${status}.`)
  return body.filter(isRecord)
}

/**
 * Catálogo do sitemap.xml da locadora (S13; onda 135, A7): os equipamentos disponíveis e, como o antigo `app/sitemap.ts`
 * da raiz retirado no clone F, as categorias com ao menos um equipamento disponível (o filtro `/equipamentos?categoria=`), com a data
 * de alteração de cada uma. Falha ou resposta fora do contrato em qualquer das duas leituras lança; o sitemap mantém
 * só as páginas fixas, como a raiz fazia.
 */
export async function fetchPublicSitemapCatalog(
  slug: string,
  options: PublicApiOptions = {}
): Promise<PublicSitemapCatalog> {
  if (!isTenantSlug(slug)) return { equipmentIds: [], categories: [] }
  const [equipments, categories] = await Promise.all([
    publicList('/api/equipments', slug, options),
    publicList('/api/categories', slug, options),
  ])
  const available = equipments.filter((item) => item.isAvailable !== false)
  const withAvailable = new Set(
    available
      .map((item) => (isRecord(item.category) ? item.category.id : null))
      .filter((id): id is string => typeof id === 'string')
  )
  return {
    equipmentIds: available
      .map((item) => item.id)
      .filter(
        (id): id is string => typeof id === 'string' && EQUIPMENT_ID.test(id)
      ),
    categories: categories
      .filter(
        (category) =>
          typeof category.id === 'string' &&
          withAvailable.has(category.id) &&
          typeof category.slug === 'string' &&
          category.slug !== ''
      )
      .map((category) => ({
        slug: category.slug as string,
        updatedAt:
          typeof category.updatedAt === 'string' &&
          ISO_INSTANT.test(category.updatedAt)
            ? category.updatedAt
            : null,
      })),
  }
}

// Deduplicados por requisição (layout, generateMetadata e página leem os mesmos dados). A vitrine sai do mesmo cartão
// da área do cliente (uma leitura por requisição): com o site no ar ou em pausa, a área do cliente sempre existe.
export const getTenantSite = cache((slug: string) => fetchTenantSite(slug))
export const getPublicSite = cache(async (slug: string) =>
  storefrontOf(await getTenantSite(slug))
)
export const getPublicSettings = cache((slug: string) =>
  fetchPublicSettings(slug)
)
export const getPublicEquipment = cache((slug: string, id: string) =>
  fetchPublicEquipment(slug, id)
)
export const getPublicCategoryNames = cache((slug: string) =>
  fetchPublicCategoryNames(slug)
)
export const getPublicLegalDocument = cache(
  (slug: string, kind: StorefrontLegalKind) =>
    fetchPublicLegalDocument(slug, kind)
)
