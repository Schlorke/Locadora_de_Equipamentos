import { publicStorefrontLegal } from '@/lib/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/**
 * Texto legal publicado pela locadora (Termos, Privacidade ou Devolução; onda 134). Superfície `identity`: responde
 * com o site no ar ou em pausa (as páginas legais continuam no ar na pausa); desligado dá o 404 do D10. A mesma
 * fábrica do serviço (`createPublicStorefrontLegalHandler`), composta em `lib/catalog.ts`.
 */
export function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> }
) {
  return publicStorefrontLegal(request, context)
}
