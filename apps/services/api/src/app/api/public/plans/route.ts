import { readConfiguredPublicPlans } from '@gb-locacoes/backend/runtime'
export async function GET(): Promise<Response> {
  return readConfiguredPublicPlans()
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
