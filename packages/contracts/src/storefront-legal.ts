import { z } from 'zod'
import { plainText } from './settings'

// ---- Textos legais da vitrine por locadora (onda 134) -------------------------------------------------------------
//
// Decisão do dono de 2026-10-06 (ADR adr-saas-subscription, B.18, item 3; U5 da ADR adr-tenant-hosts): Termos,
// Política de Privacidade e Política de Devolução de cada locadora, editados no painel. O banco guarda estrutura
// validada (seções com parágrafos e listas, destaque inicial do item), nunca HTML nem árvore de componentes: o texto é
// sempre texto, sem link nem marcação. Os nomes têm o prefixo `Storefront*` para não colidir com os termos da
// plataforma do cadastro (`LEGAL_DOCUMENT_KINDS` de `./onboarding`). A Política de Cookies é da plataforma e fica fora.

/** Documentos da vitrine, na ordem do rodapé. */
export const STOREFRONT_LEGAL_KINDS = [
  'terms',
  'privacy',
  'returnPolicy',
] as const
export type StorefrontLegalKind = (typeof STOREFRONT_LEGAL_KINDS)[number]
export const StorefrontLegalKindSchema = z.enum(STOREFRONT_LEGAL_KINDS)

/** Segmento de rota de cada documento (`/api/settings/public/legal-documents/{slug}` e a rota do painel). */
export const STOREFRONT_LEGAL_SLUGS: Readonly<
  Record<StorefrontLegalKind, string>
> = Object.freeze({
  terms: 'terms',
  privacy: 'privacy',
  returnPolicy: 'return-policy',
})

/** Página de cada documento na vitrine. */
export const STOREFRONT_LEGAL_PAGE_PATHS: Readonly<
  Record<StorefrontLegalKind, string>
> = Object.freeze({
  terms: '/termos',
  privacy: '/privacidade',
  returnPolicy: '/politica-devolucao',
})

/**
 * Páginas da vitrine que continuam no ar durante a pausa (decisão do dono de 2026-10-06, item 4; S13): os três
 * documentos e a Política de Cookies da plataforma. Fonte única para o proxy, o sitemap, o rodapé e a moldura da pausa.
 */
export const STOREFRONT_PAUSE_PUBLIC_PATHS = Object.freeze([
  STOREFRONT_LEGAL_PAGE_PATHS.terms,
  STOREFRONT_LEGAL_PAGE_PATHS.privacy,
  STOREFRONT_LEGAL_PAGE_PATHS.returnPolicy,
  '/cookies',
] as const)

/** Tipo do documento pelo segmento da rota; qualquer outro texto (inclusive o nome do tipo) não é rota. */
export function storefrontLegalKindFromSlug(
  slug: string
): StorefrontLegalKind | null {
  return (
    STOREFRONT_LEGAL_KINDS.find(
      (kind) => STOREFRONT_LEGAL_SLUGS[kind] === slug
    ) ?? null
  )
}

/** Versão do formato do documento. Um app antigo diante de outra versão pede para atualizar, sem esconder o motivo. */
export const STOREFRONT_LEGAL_DOCUMENT_VERSION = 1

/**
 * Teto do documento validado, em bytes UTF-8 do JSON. O CHECK do banco (262.144 bytes de `jsonb::text`) deixa folga
 * para a normalização do `jsonb` (espaço depois de `:` e `,`).
 */
export const STOREFRONT_LEGAL_MAX_BYTES = 200_000

const SECTION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Bytes UTF-8 do texto, contados por ponto de código (1 a 4 bytes, como o `TextEncoder`; um substituto isolado vira
 * U+FFFD, 3 bytes). O contrato é universal: o app em React Native não tem os tipos do DOM (onda 134, parte B).
 */
function utf8Bytes(texto: string): number {
  let bytes = 0
  for (const caractere of texto) {
    const codigo = caractere.codePointAt(0) ?? 0
    bytes += codigo < 0x80 ? 1 : codigo < 0x800 ? 2 : codigo < 0x10000 ? 3 : 4
  }
  return bytes
}

function documentShape(strict: boolean) {
  const object = strict ? z.strictObject : z.object
  const item = z.union([
    plainText(1, 2000),
    object({ lead: plainText(1, 160), text: plainText(0, 2000) }),
  ])
  const block = z.discriminatedUnion('type', [
    object({ type: z.literal('paragraph'), text: plainText(1, 5000) }),
    object({ type: z.literal('list'), items: z.array(item).min(1).max(60) }),
  ])
  const section = object({
    id: z.string().max(60).regex(SECTION_ID),
    title: plainText(1, 160),
    blocks: z.array(block).min(1).max(60),
    /** Mostra o cartão de contato da locadora no fim da seção. */
    contactCard: z.boolean().optional(),
    /** Frase do cartão; sem ela, o cartão usa a descrição padrão do widget. */
    contactCardNote: plainText(1, 300).optional(),
  }).refine(
    (value) =>
      value.contactCardNote === undefined || value.contactCard === true,
    { message: 'A nota do cartão exige o cartão de contato' }
  )
  return object({
    version: z.literal(STOREFRONT_LEGAL_DOCUMENT_VERSION),
    /** "Última atualização", como a locadora escreve (ex.: "19 de janeiro de 2026"). */
    lastUpdated: plainText(1, 60),
    intro: plainText(1, 4000).optional(),
    sections: z
      .array(section)
      .min(1)
      .max(40)
      .refine(
        (sections) =>
          new Set(sections.map((value) => value.id)).size === sections.length,
        { message: 'Seções com o mesmo id' }
      ),
  }).refine(
    (value) => utf8Bytes(JSON.stringify(value)) <= STOREFRONT_LEGAL_MAX_BYTES,
    { message: 'Documento acima do limite' }
  )
}

/** Escrita (painel): estrito; chave desconhecida, outra versão ou caractere de controle recusam o documento. */
export const StorefrontLegalDocumentSchema = documentShape(true)
export type StorefrontLegalDocument = z.infer<
  typeof StorefrontLegalDocumentSchema
>
export type StorefrontLegalSection = StorefrontLegalDocument['sections'][number]
export type StorefrontLegalBlock = StorefrontLegalSection['blocks'][number]
export type StorefrontLegalListItem = Extract<
  StorefrontLegalBlock,
  { type: 'list' }
>['items'][number]

const StorefrontLegalDocumentReadSchema = documentShape(false)

export type StorefrontLegalDocumentRead =
  | { status: 'ok'; document: StorefrontLegalDocument }
  | { status: 'unsupported-version' }
  | { status: 'invalid' }

/**
 * Leitura (vitrine, app e backend): ignora chave desconhecida, separa a versão que este código não conhece (o app
 * antigo pede atualização) do documento inválido. Nunca devolve um documento fora do contrato.
 */
export function parseStorefrontLegalDocument(
  raw: unknown
): StorefrontLegalDocumentRead {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { status: 'invalid' }
  const version = (raw as { version?: unknown }).version
  if (
    typeof version === 'number' &&
    version !== STOREFRONT_LEGAL_DOCUMENT_VERSION
  )
    return { status: 'unsupported-version' }
  const parsed = StorefrontLegalDocumentReadSchema.safeParse(raw)
  return parsed.success
    ? { status: 'ok', document: parsed.data }
    : { status: 'invalid' }
}

/**
 * Regra de renderização do item com destaque, a mesma na web e no app: `<strong>{lead}</strong>` seguido de
 * `' ' + text` (sem texto, sem o espaço). É o formato dos itens da Política de Devolução da produção.
 */
export function storefrontLegalItemParts(item: StorefrontLegalListItem): {
  lead: string | null
  text: string
} {
  if (typeof item === 'string') return { lead: null, text: item }
  return { lead: item.lead, text: item.text === '' ? '' : ' ' + item.text }
}

/** Corpo do `PUT /api/admin/settings/legal-documents/{kind}`. */
export const AdminStorefrontLegalBodySchema = z.strictObject({
  document: StorefrontLegalDocumentSchema,
})

/** Resposta pública: o documento publicado da locadora e o instante da publicação (ISO 8601). */
export const StorefrontLegalDocumentResponseSchema = z.strictObject({
  kind: StorefrontLegalKindSchema,
  document: StorefrontLegalDocumentSchema,
  publishedAt: z.iso.datetime(),
})
export type StorefrontLegalDocumentResponse = z.infer<
  typeof StorefrontLegalDocumentResponseSchema
>

/** Resposta do painel: o documento atual (ou nenhum) e o instante da última publicação. */
export const AdminStorefrontLegalResponseSchema = z.strictObject({
  kind: StorefrontLegalKindSchema,
  document: StorefrontLegalDocumentSchema.nullable(),
  publishedAt: z.iso.datetime().nullable(),
})
export type AdminStorefrontLegalResponse = z.infer<
  typeof AdminStorefrontLegalResponseSchema
>
