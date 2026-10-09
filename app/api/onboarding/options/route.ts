import { handleConfiguredOnboardingOptions } from '@gb-locacoes/backend/runtime'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export function GET(request: Request) {
  return handleConfiguredOnboardingOptions(request)
}
