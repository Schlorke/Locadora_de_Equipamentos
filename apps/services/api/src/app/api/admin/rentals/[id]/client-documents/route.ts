import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveTenantPrincipal } from '../../../../../../host/private-identity'
import { InvalidDocumentError } from '@gb-locacoes/backend/documents'
import { uploadRentalClientDocument } from '../../../../../../host/client-documents'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const principal = access.principal
    if (!['ADMIN', 'OPERATOR'].includes(principal.role))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const { id: rentalId } = await params
    return await uploadRentalClientDocument(principal, rentalId, request)
  } catch (error) {
    if (error instanceof InvalidDocumentError || error instanceof z.ZodError)
      return NextResponse.json(
        {
          error:
            error instanceof InvalidDocumentError
              ? error.message
              : 'Documento inválido',
        },
        { status: 400 }
      )
    return NextResponse.json(
      { error: 'Erro ao enviar documento do cliente' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
