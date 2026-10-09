import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import {
  ContractAccessError,
  downloadRentalContract,
} from '@/lib/contracts/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rentalId: string }> }
) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    const { rentalId } = await params
    return downloadRentalContract(access.principal, rentalId)
  } catch (error) {
    if (error instanceof ContractAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao baixar contrato' },
      { status: 500 }
    )
  }
}
