import { authenticatePlatformAsaasWebhook } from '@gb-locacoes/backend/identity'
import { acceptConfiguredPlatformAsaasReceipt } from '@gb-locacoes/backend/runtime'

export async function POST(request: Request) {
  const authenticated = await authenticatePlatformAsaasWebhook(request)
  if (!authenticated.ok) return authenticated.response
  return acceptConfiguredPlatformAsaasReceipt({
    ...authenticated,
    source: 'ASAAS_ROOT',
  })
}
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
