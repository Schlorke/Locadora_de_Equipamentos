import { createHash, createHmac } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createTenantWebhookAuthentication } from './tenant-webhook'
import { createIntegrationCredentialResolver } from '../../runtime/integration-credentials'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const route = { params: Promise.resolve({ integrationId: 'gateway_a' }) }
function fixture(
  source = 'VAULT',
  expired = false,
  integrationStatus = 'ACTIVE',
  organizationStatus = 'ACTIVE'
) {
  const row = {
    id: 'gateway_a',
    tenantId: 'tenant-alfa',
    provider: 'ASAAS',
    status: integrationStatus,
    organization: { status: organizationStatus },
    environment: 'sandbox',
    credentialSource: source,
    credentialsRef: 'env:LOCADORA_INTEGRATION_A',
    webhookTokenHash: hash('current'),
    webhookTokenPreviousHash: hash('previous'),
    webhookTokenPreviousUntil: new Date(
      Date.now() + (expired ? -60000 : 60000)
    ),
  }
  return createTenantWebhookAuthentication({
    getPrisma: () =>
      ({
        tenantIntegration: { findUnique: async () => row },
      }) as unknown as PrismaClient,
    resolveIntegrationCredential: createIntegrationCredentialResolver(
      () => ({ LOCADORA_INTEGRATION_A_SECRET: 'current' }),
      async () => ({ signingSecret: '' })
    ),
  })
}
const request = (header: string, token: string) =>
  new Request('https://local.test/hook', {
    method: 'POST',
    body: '{"id":"one"}',
    headers: { [header]: token },
  })
describe('vault webhook token authentication', () => {
  it('the new Asaas URL accepts only its token header even for ENV_REF, preserving the old URL', async () => {
    const body = '{"id":"one"}'
    const signature = createHmac('sha256', 'current').update(body).digest('hex')
    const cases: Record<string, string>[] = [
      { 'x-webhook-signature': signature },
      { access_token: 'current' },
      { 'asaas-access-token': 'wrong', 'x-webhook-signature': signature },
    ]
    for (const headers of cases) {
      const auth = fixture('ENV_REF')
      const old = await auth.authenticateTenantWebhook(
        new Request(
          'https://local.test/api/payments/boleto/webhook/gateway_a',
          { method: 'POST', body, headers }
        ),
        'ASAAS',
        route
      )
      expect(old.ok).toBe(true)
      const current = await auth.authenticateTenantWebhook(
        new Request('https://local.test/api/webhooks/asaas/gateway_a', {
          method: 'POST',
          body,
          headers,
        }),
        'ASAAS',
        route
      )
      expect(current.ok).toBe(false)
      if (!current.ok) expect(current.response.status).toBe(401)
    }
    expect(
      (
        await fixture('ENV_REF').authenticateTenantWebhook(
          new Request('https://local.test/api/webhooks/asaas/gateway_a', {
            method: 'POST',
            body,
            headers: { 'asaas-access-token': 'current' },
          }),
          'ASAAS',
          route
        )
      ).ok
    ).toBe(true)
  })
  it.each(['ACTIVE', 'PROVISIONING', 'INBOUND_ONLY'])(
    'authenticates %s independently of administrative tenant status',
    async (status) => {
      for (const organization of ['ACTIVE', 'SUSPENDED', 'DISABLED']) {
        expect(
          (
            await fixture(
              'VAULT',
              false,
              status,
              organization
            ).authenticateTenantWebhook(
              request('asaas-access-token', 'current'),
              'ASAAS',
              route
            )
          ).ok
        ).toBe(true)
      }
    }
  )
  it.each(['DISABLED', 'unknown'])(
    'still refuses unavailable integration %s',
    async (status) => {
      const result = await fixture(
        'VAULT',
        false,
        status
      ).authenticateTenantWebhook(
        request('asaas-access-token', 'current'),
        'ASAAS',
        route
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(503)
    }
  )
  it.each(['current', 'previous'])(
    'accepts stored hashes (%s) without requiring the outbound key',
    async (token) => {
      expect(
        (
          await fixture().authenticateTenantWebhook(
            request('asaas-access-token', token),
            'ASAAS',
            route
          )
        ).ok
      ).toBe(true)
    }
  )
  it.each(['access_token', 'x-hook-token'])(
    'rejects the legacy alias %s only for VAULT',
    async (header) => {
      const denied = await fixture().authenticateTenantWebhook(
        request(header, 'current'),
        'ASAAS',
        route
      )
      expect(denied.ok).toBe(false)
      if (!denied.ok) expect(denied.response.status).toBe(401)
      expect(
        (
          await fixture('ENV_REF').authenticateTenantWebhook(
            request(header, 'current'),
            'ASAAS',
            route
          )
        ).ok
      ).toBe(true)
    }
  )
  it('does not accept an expired previous hash or arbitrary token', async () => {
    for (const token of ['previous', 'wrong']) {
      const denied = await fixture('VAULT', true).authenticateTenantWebhook(
        request('asaas-access-token', token),
        'ASAAS',
        route
      )
      expect(denied.ok).toBe(false)
      if (!denied.ok) expect(denied.response.status).toBe(401)
    }
    expect(
      (
        await fixture('VAULT', true).authenticateTenantWebhook(
          request('asaas-access-token', 'current'),
          'ASAAS',
          route
        )
      ).ok
    ).toBe(true)
  })
})
