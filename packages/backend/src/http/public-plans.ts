import {
  PublicPlansResponseSchema,
  type PublicPlansResponse,
} from '@gb-locacoes/contracts/subscription'

export function createPublicPlansHandler(
  read: () => Promise<PublicPlansResponse>
) {
  return async (): Promise<Response> => {
    try {
      const body = PublicPlansResponseSchema.parse(await read())
      return Response.json(body, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
      })
    } catch {
      return Response.json(
        { error: 'Catálogo de planos indisponível' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }
}
