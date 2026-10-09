import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTenantPrincipal } from '@/lib/tenant'
import {
  ContractAccessError,
  generateRentalContract,
} from '@/lib/contracts/service'
import { GenerateRentalContractSchema as Input } from '@gb-locacoes/contracts/rental-contracts'
export async function POST(request: NextRequest) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const input = Input.parse(await request.json())
    return NextResponse.json({
      contract: await generateRentalContract(access.principal, input.rentalId),
    })
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
      { error: 'Erro ao gerar contrato' },
      { status: 500 }
    )
  }
}
