import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  createTenantWebhookAuthentication,
  type WebhookProvider,
  type WebhookRoute,
  type VerifiedIntegration,
} from '@gb-locacoes/backend/identity'
import { createIntegrationCredentialResolver } from '@gb-locacoes/backend/runtime'
export type {
  WebhookProvider,
  WebhookRoute,
  VerifiedIntegration,
} from '@gb-locacoes/backend/identity'
export const resolveIntegrationCredential =
  createIntegrationCredentialResolver()
const authentication = createTenantWebhookAuthentication({
  getPrisma: () => getDatabaseRuntime().prisma,
  resolveIntegrationCredential,
})
export async function resolveWebhookIntegration(
  provider: WebhookProvider,
  route?: WebhookRoute
) {
  return authentication.resolveWebhookIntegration(provider, route)
}
export async function authenticateTenantWebhook(
  request: Request,
  provider: WebhookProvider,
  route?: WebhookRoute
) {
  return authentication.authenticateTenantWebhook(request, provider, route)
}
export async function resolveWebhookResource(
  integration: VerifiedIntegration,
  resourceType: 'PAYMENT' | 'CONTRACT',
  externalId: string
): Promise<string | null> {
  return authentication.resolveWebhookResource(
    integration,
    resourceType,
    externalId
  )
}
