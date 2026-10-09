/**
 * Busca do diretório de locadoras (`GET /api/public/tenants?q=`).
 * Contrato: `DirectorySearchQuerySchema` e `DirectorySearchResponseSchema` em
 * `@gb-locacoes/contracts/directory`; ADR docs/architecture/adr-tenant-hosts.md
 * (Diretório, Migração B, T13).
 *
 * - `q` com 3 a 80 caracteres após `trim`, único parâmetro aceito (sem
 *   paginação; `q` repetido é ambíguo e recusado).
 * - No máximo 10 resultados, só organizações `ACTIVE` com `directoryListed`
 *   (opt-in; o padrão é ficar fora).
 * - Só dados globais de `organizations`: slug, nome, cidade e UF. Nunca CNPJ
 *   (`document`), telefone, e-mail, CEP (`postalCode`) ou logo (o logo é dado
 *   da locadora e só sai no cartão por slug). A leitura seleciona apenas esses
 *   campos e cada item passa pelo schema estrito, que recusa chave extra.
 */
import type { PrismaClient } from '@prisma/client'
import {
  DIRECTORY_SEARCH_MAX_RESULTS,
  DirectorySearchItemSchema,
  DirectorySearchQuerySchema,
  DirectorySearchResponseSchema,
  type DirectorySearchItem,
  type DirectorySearchQuery,
  type DirectorySearchResponse,
} from '@gb-locacoes/contracts/directory'

export type DirectorySearchDatabase = Pick<PrismaClient, 'organization'>

// Mesma normalização do cartão (card.ts): o texto publicado nunca passa do schema.
const NAME_MAX = 200
const CITY_MAX = 120

function text(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function state(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase()
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

/**
 * `%`, `_` e `\` literais no ILIKE. O Prisma monta `ILIKE '%' || $1 || '%'`
 * sem escapar curingas: sem isto, `q=%%%` listaria todo o diretório.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * Lê os parâmetros da busca. Devolve `null` (400 no adaptador) quando `q`
 * falta, é curto, longo, repetido, ou quando chega qualquer outro parâmetro.
 */
export function parseDirectorySearchParams(
  params: URLSearchParams
): DirectorySearchQuery | null {
  const values = new Map<string, string[]>()
  for (const [name, value] of params)
    values.set(name, [...(values.get(name) ?? []), value])
  const single: Record<string, string> = {}
  for (const [name, list] of values) {
    if (list.length !== 1) return null
    single[name] = list[0]!
  }
  const parsed = DirectorySearchQuerySchema.safeParse(single)
  return parsed.success ? parsed.data : null
}

/** Executa a busca; a resposta sempre cumpre `DirectorySearchResponseSchema`. */
export async function searchDirectory(
  db: DirectorySearchDatabase,
  query: DirectorySearchQuery
): Promise<DirectorySearchResponse> {
  const { q } = DirectorySearchQuerySchema.parse(query)
  const rows = await db.organization.findMany({
    where: {
      directoryListed: true,
      status: 'ACTIVE',
      name: { contains: escapeLikePattern(q), mode: 'insensitive' },
    },
    select: { slug: true, name: true, city: true, state: true },
    orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    take: DIRECTORY_SEARCH_MAX_RESULTS,
  })
  const results = rows.flatMap((row): DirectorySearchItem[] => {
    // Slug reservado ou nome vazio: fora do diretório, nunca um erro para quem busca.
    const item = DirectorySearchItemSchema.safeParse({
      slug: row.slug,
      name: text(row.name, NAME_MAX),
      city: text(row.city, CITY_MAX),
      state: state(row.state),
    })
    return item.success ? [item.data] : []
  })
  return DirectorySearchResponseSchema.parse({ results })
}
