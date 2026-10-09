import { type NextRequest } from 'next/server'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { POST as createQuote } from '@/app/api/quotes/route'
import { successResponse } from '@/lib/api-response'

export const runtime = 'nodejs'
export async function POST(request: NextRequest) {
  // Mutação de navegador só da própria origem, antes de tudo (CSRF entre locadoras irmãs).
  const crossOrigin = rejectCrossOriginMutation(request)
  if (crossOrigin) return crossOrigin
  const response = await createQuote(request)
  if (!response || response.status !== 201) return response
  const quote = await response.json()
  return successResponse(
    { id: quote.id, totalValue: quote.total, status: quote.status },
    201,
    'Orçamento criado com sucesso! Entraremos em contato em até 2 horas úteis.'
  )
}
