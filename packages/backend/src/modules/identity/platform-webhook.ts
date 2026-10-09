import { readAuthenticatedWebhook } from './webhook-auth'

/** Root notifications never use tenant secrets, cookies or alternate token headers. */
export async function authenticatePlatformAsaasWebhook(
  request: Request,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const current = env.PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256
  const previous = env.PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256
  const environment = env.PLATFORM_ASAAS_ENVIRONMENT
  if (!current || !['sandbox', 'production'].includes(environment ?? ''))
    return {
      ok: false as const,
      response: Response.json(
        { error: 'Webhook authentication unavailable' },
        { status: 503 }
      ),
    }
  return readAuthenticatedWebhook(request, {
    secret: undefined,
    signatureHeader: 'x-webhook-signature',
    tokenHeaders: ['asaas-access-token'],
    tokenHashes: previous ? [current, previous] : [current],
  })
}
