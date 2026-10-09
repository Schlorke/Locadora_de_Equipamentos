import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantPrincipal } from '@/lib/tenant'
import {
  ContractAccessError,
  generateRentalContract,
  readRentalContract,
  canManageContracts,
} from '@/lib/contracts/service'
type Route = { params: Promise<{ id: string }> }
export async function POST(request: NextRequest, { params }: Route) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    // O mesmo 403 que generateRentalContract devolve, antes de qualquer leitura.
    if (!canManageContracts(access.principal))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const { id } = await params
    return NextResponse.json({
      contract: await generateRentalContract(access.principal, id),
    })
  } catch (error) {
    if (error instanceof ContractAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    return NextResponse.json(
      { error: 'Erro ao gerar contrato' },
      { status: 500 }
    )
  }
}
export async function GET(request: NextRequest, { params }: Route) {
  try {
    const access = await resolveTenantPrincipal(request)
    if (!access.ok) return access.response
    if (!canManageContracts(access.principal))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    const { id } = await params
    const contract = await readRentalContract(access.principal, id)
    return contract
      ? NextResponse.json(
          { contract },
          { headers: { 'Cache-Control': 'private, no-store' } }
        )
      : NextResponse.json({ error: 'Contrato não encontrado' }, { status: 404 })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao carregar contrato' },
      { status: 500 }
    )
  }
}
