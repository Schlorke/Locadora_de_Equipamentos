import { NextResponse, type NextRequest } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import { CustomerError, listClientDocuments } from '@/lib/client-documents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    const { id: userId } = await params
    if (
      !['ADMIN', 'OPERATOR'].includes(principal.role) &&
      !(principal.role === 'CLIENT' && principal.userId === userId)
    )
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const documents = await listClientDocuments(principal, userId)
    return NextResponse.json(
      { documents },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    if (error instanceof CustomerError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao carregar documentos sensíveis do cliente' },
      { status: 500 }
    )
  }
}
