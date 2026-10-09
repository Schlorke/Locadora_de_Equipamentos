import {
  parseDirectorySearchParams,
  type consumeDirectorySearchRateLimit,
  type searchDirectory,
} from '../modules/directory/index'

export function createPublicDirectorySearchHandler(deps: {
  consumeLimit: (
    _request: Request,
    _now: number
  ) => ReturnType<typeof consumeDirectorySearchRateLimit>
  search: (
    _query: Parameters<typeof searchDirectory>[1]
  ) => ReturnType<typeof searchDirectory>
}) {
  const noStore = { 'Cache-Control': 'no-store' } as const
  return async function GET(request: Request): Promise<Response> {
    const query = parseDirectorySearchParams(new URL(request.url).searchParams)
    if (!query)
      return Response.json(
        {
          error: 'Informe apenas q, com 3 a 80 caracteres.',
          code: 'INVALID_QUERY',
        },
        { status: 400, headers: noStore }
      )
    try {
      const now = Date.now()
      const limit = await deps.consumeLimit(request, now)
      if (!limit.allowed)
        return Response.json(
          {
            error: 'Muitas buscas. Tente novamente em instantes.',
            code: 'RATE_LIMITED',
          },
          {
            status: 429,
            headers: {
              ...noStore,
              'Retry-After': String(
                Math.max(1, Math.ceil((limit.resetTime - now) / 1000))
              ),
            },
          }
        )
      const results = await deps.search(query)
      return Response.json(results, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      })
    } catch (error) {
      console.error('Erro na busca do diretório de locadoras:', error)
      return Response.json(
        { error: 'Erro ao buscar locadoras' },
        { status: 500, headers: noStore }
      )
    }
  }
}
