export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
import { ContractAccessError } from '@gb-locacoes/backend/documents'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantPrincipal } from '../../../../host/private-identity'
import { rejectCrossOriginMutation } from '@gb-locacoes/backend/identity'
import { requestContractSignature } from '../../../../host/contracts'
import { RequestContractSignatureSchema as Input } from '@gb-locacoes/contracts/rental-contracts'
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const crossOrigin = rejectCrossOriginMutation(request)
    if (crossOrigin) return crossOrigin
    const input = Input.parse(await request.json())
    return NextResponse.json(
      await requestContractSignature(access.principal, input.contractId),
      { status: 202 }
    )
  } catch (error) {
    if (error instanceof ContractAccessError)
      return NextResponse.json(error.policy ?? { error: error.message }, {
        status: error.status,
        ...(error.policy
          ? {
              headers: {
                'Cache-Control': 'private, no-store',
                Vary: 'Cookie, Host',
              },
            }
          : {}),
      })
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    return NextResponse.json(
      { error: 'Erro ao solicitar assinatura' },
      { status: 500 }
    )
  }
}
