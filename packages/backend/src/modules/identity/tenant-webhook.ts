import { integrationCredentialReference } from '../../runtime/index'
import type { PrismaClient } from '@prisma/client'
import type { createIntegrationCredentialResolver } from '../../runtime/index'
import { readAuthenticatedWebhook } from './webhook-auth'
import { isInboundIntegrationStatus } from './inbound-integration'
export type WebhookProvider = 'PIX' | 'ASAAS' | 'ZAPSIGN' | 'WHATSAPP'
export type WebhookRoute = { params: Promise<{ integrationId: string }> }
export type VerifiedIntegration = {
  id: string
  tenantId: string
  provider: string
  externalAccountId: string | null
}
export type AuthenticatedTenantWebhook = {
  body: unknown
  payloadHash: string
  integration: VerifiedIntegration
  context: { tenantId: string }
}
export function createTenantWebhookAuthentication({
  getPrisma,
  resolveIntegrationCredential,
}: {
  getPrisma: () => Pick<
    PrismaClient,
    'tenantIntegration' | 'externalResourceTenant'
  >
  resolveIntegrationCredential: ReturnType<
    typeof createIntegrationCredentialResolver
  >
}) {
  async function resolveWebhookIntegration(
    provider: WebhookProvider,
    route?: WebhookRoute
  ) {
    const integrationId = route ? (await route.params).integrationId : null
    if (!integrationId || !/^[A-Za-z0-9_-]{1,128}$/.test(integrationId))
      return null
    const integration = await getPrisma().tenantIntegration.findUnique({
      where: { id: integrationId },
      include: { organization: { select: { status: true } } },
    })
    if (
      !integration ||
      integration.provider !== provider ||
      !isInboundIntegrationStatus(integration.status)
    )
      return null
    const credential = await resolveIntegrationCredential(
      integrationCredentialReference(integration, undefined, 'webhook')
    )
    return credential ? { integration, credential } : null
  }
  async function authenticateTenantWebhook(
    request: Request,
    provider: WebhookProvider,
    route?: WebhookRoute
  ) {
    if (!route)
      return {
        ok: false as const,
        response: Response.json(
          { error: 'Integration-specific webhook URL required' },
          { status: 410 }
        ),
      }
    const resolved = await resolveWebhookIntegration(provider, route)
    if (!resolved)
      return {
        ok: false as const,
        response: Response.json(
          { error: 'Webhook authentication unavailable' },
          { status: 503 }
        ),
      }
    const asaasIngress =
      provider === 'ASAAS' &&
      /^\/api\/webhooks\/asaas\/[^/]+$/.test(new URL(request.url).pathname)
    const authenticated = await readAuthenticatedWebhook(request, {
      secret: resolved.credential.signingSecret,
      signingSecrets: resolved.credential.signingSecrets,
      allowSignature: !asaasIngress,
      signatureHeader:
        provider === 'WHATSAPP'
          ? 'x-hub-signature-256'
          : provider === 'ZAPSIGN'
            ? 'x-zapsign-signature'
            : 'x-webhook-signature',
      signaturePrefix: provider === 'WHATSAPP' ? 'sha256=' : '',
      tokenHeaders:
        provider === 'ASAAS'
          ? asaasIngress || resolved.integration.credentialSource === 'VAULT'
            ? ['asaas-access-token']
            : ['asaas-access-token', 'access_token', 'x-hook-token']
          : [],
      tokenHashes:
        provider === 'ASAAS' &&
        resolved.integration.credentialSource === 'VAULT'
          ? [
              resolved.integration.webhookTokenHash,
              resolved.integration.webhookTokenPreviousUntil &&
              resolved.integration.webhookTokenPreviousUntil.getTime() >
                Date.now()
                ? resolved.integration.webhookTokenPreviousHash
                : null,
            ].filter((hash): hash is string => Boolean(hash))
          : [],
    })
    if (!authenticated.ok) return authenticated
    return {
      ok: true as const,
      body: authenticated.body,
      payloadHash: authenticated.payloadHash,
      integration: resolved.integration,
      context: { tenantId: resolved.integration.tenantId },
    }
  }
  async function resolveWebhookResource(
    integration: VerifiedIntegration,
    resourceType: 'PAYMENT' | 'CONTRACT',
    externalId: string
  ): Promise<string | null> {
    const resource = await getPrisma().externalResourceTenant.findFirst({
      where: {
        integrationId: integration.id,
        provider: integration.provider,
        tenantId: integration.tenantId,
        resourceType,
        externalId,
      },
      select: { resourceId: true },
    })
    return resource?.resourceId || null
  }
  return {
    resolveWebhookIntegration,
    authenticateTenantWebhook,
    resolveWebhookResource,
  }
}
