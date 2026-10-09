import { NextResponse } from 'next/server'
import {
  consumeDirectorySearchRateLimit,
  parseDirectorySearchParams,
  prismaRateLimitCounter,
  searchDirectory,
} from '@gb-locacoes/backend/directory'
import { prisma } from '@/lib/prisma'
import { clientIpFromHeaders, identityRateLimitSecret } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'no-store' } as const

/**
 * Busca do diretório de locadoras (ADR docs/architecture/adr-tenant-hosts.md,
 * T13). Anônima e servida no apex: `q` com 3 a 80 caracteres e nenhum outro
 * parâmetro (400); no máximo 10 locadoras ACTIVE com opt-in, só slug, nome,
 * cidade e UF. Rate limit por IP em `platform_rate_limits`, compartilhado entre
 * instâncias (429 com `Retry-After`). Parâmetro inválido não consome a janela.
 * A chave das janelas é `PLATFORM_RATE_LIMIT_SECRET`, exigida em produção pelo
 * mesmo critério dos limitadores de identidade (`isPlatformProduction`, via
 * `identityRateLimitSecret`), nunca pelo `NODE_ENV` sozinho.
 */
export async function GET(request: Request) {
  const query = parseDirectorySearchParams(new URL(request.url).searchParams)
  if (!query)
    return NextResponse.json(
      {
        error: 'Informe apenas q, com 3 a 80 caracteres.',
        code: 'INVALID_QUERY',
      },
      { status: 400, headers: NO_STORE }
    )
  try {
    const now = Date.now()
    const limit = await consumeDirectorySearchRateLimit(
      prismaRateLimitCounter(prisma),
      {
        ip: clientIpFromHeaders(request.headers),
        secret: identityRateLimitSecret(process.env),
        now,
      }
    )
    if (!limit.allowed)
      return NextResponse.json(
        {
          error: 'Muitas buscas. Tente novamente em instantes.',
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            ...NO_STORE,
            'Retry-After': String(
              Math.max(1, Math.ceil((limit.resetTime - now) / 1000))
            ),
          },
        }
      )
    const results = await searchDirectory(prisma, query)
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  } catch (error) {
    console.error('Erro na busca do diretório de locadoras:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar locadoras' },
      { status: 500, headers: NO_STORE }
    )
  }
}
