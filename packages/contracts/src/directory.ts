/**
 * Contrato público do diretório de locadoras (ADR docs/architecture/adr-tenant-hosts.md, D13).
 *
 * - Busca (`GET /api/public/tenants?q=`): `q` com 3 caracteres ou mais, no
 *   máximo 10 resultados, sem paginação e sem logo. Só dados globais de
 *   `organizations` de locadoras ACTIVE com opt-in.
 * - Cartão por slug (`GET /api/public/tenants/{slug}`): inclui o logo, lido
 *   numa transação da própria locadora.
 *
 * Nenhum schema aceita CNPJ, telefone, e-mail ou CEP: os objetos são estritos
 * e qualquer chave extra é rejeitada.
 */
import { z } from 'zod'
import { isTenantSlug } from './platform'

export const DIRECTORY_SEARCH_MIN_QUERY_LENGTH = 3
export const DIRECTORY_SEARCH_MAX_QUERY_LENGTH = 80
export const DIRECTORY_SEARCH_MAX_RESULTS = 10

const TenantSlugSchema = z
  .string()
  .refine(isTenantSlug, { message: 'Slug de locadora inválido ou reservado.' })
const NameSchema = z.string().trim().min(1).max(200)
const CitySchema = z.string().trim().min(1).max(120)
const StateSchema = z.string().regex(/^[A-Z]{2}$/)

/**
 * Parâmetros aceitos pela busca. Qualquer outro (ex.: paginação) é rejeitado.
 * `q` não aceita caractere de controle (C0, DEL e C1): nenhum nome de locadora
 * o contém e o PostgreSQL recusa NUL no `ILIKE` (erro 22021), então o valor
 * inválido para no 400, antes do limitador e do banco.
 */
export const DirectorySearchQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .min(DIRECTORY_SEARCH_MIN_QUERY_LENGTH)
    .max(DIRECTORY_SEARCH_MAX_QUERY_LENGTH)
    .regex(/^\P{Cc}*$/u, {
      message: 'A busca não aceita caracteres de controle.',
    }),
})

/** Item da busca: sem logo (leitura cruzada de dados de locadora). */
export const DirectorySearchItemSchema = z.strictObject({
  slug: TenantSlugSchema,
  name: NameSchema,
  city: CitySchema.nullable(),
  state: StateSchema.nullable(),
})

export const DirectorySearchResponseSchema = z.strictObject({
  results: z.array(DirectorySearchItemSchema).max(DIRECTORY_SEARCH_MAX_RESULTS),
})

/** Cartão público de uma locadora. O logo só é aceito em https. */
export const PublicTenantCardSchema = z.strictObject({
  slug: TenantSlugSchema,
  name: NameSchema,
  city: CitySchema.nullable(),
  state: StateSchema.nullable(),
  logoUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable(),
})

export type DirectorySearchQuery = z.infer<typeof DirectorySearchQuerySchema>
export type DirectorySearchItem = z.infer<typeof DirectorySearchItemSchema>
export type DirectorySearchResponse = z.infer<
  typeof DirectorySearchResponseSchema
>
export type PublicTenantCard = z.infer<typeof PublicTenantCardSchema>
