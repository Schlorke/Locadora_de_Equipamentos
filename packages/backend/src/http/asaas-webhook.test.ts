import { describe, expect, it, vi } from 'vitest'
import { createAsaasWebhookReceiver } from './asaas-webhook'
import { asaasReceiptPayload } from '../modules/billing/index'

describe('Asaas ingress classification', () => {
  const integration = {
    id: 'integration-a',
    tenantId: 'tenant-a',
    provider: 'ASAAS',
    externalAccountId: null,
  }
  it.each([
    ['PAYMENT_RECEIVED', false, false],
    ['PAYMENT_NEW_UNKNOWN', false, true],
    ['SUBSCRIPTION_CREATED', false, true],
    ['OTHER_NEW', false, true],
    ['ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED', true, false],
    ['ACCESS_TOKEN_DISABLED', true, false],
  ] as const)(
    'routes %s to exactly one existing persistence port',
    async (type, platform, ignored) => {
      const body = {
        id: 'event',
        event: type,
        payment: { id: 'payment', status: 'RECEIVED', value: 10 },
        subscription: { id: 'sub' },
      }
      const input = {
        body,
        integration,
        context: { tenantId: integration.tenantId },
        payloadHash: 'hash',
      }
      const acceptTenant = vi.fn(async () => Response.json({ accepted: true }))
      const acceptPlatform = vi.fn(async () =>
        Response.json({ accepted: true })
      )
      expect(
        (
          await createAsaasWebhookReceiver({ acceptTenant, acceptPlatform })(
            input
          )
        ).status
      ).toBe(200)
      expect(acceptTenant).toHaveBeenCalledTimes(platform ? 0 : 1)
      expect(acceptPlatform).toHaveBeenCalledTimes(platform ? 1 : 0)
      if (platform)
        expect(acceptPlatform).toHaveBeenCalledWith({
          ...input,
          source: 'ASAAS_ACCOUNT',
        })
      else expect(acceptTenant).toHaveBeenCalledWith(input, ignored)
    }
  )
  it('drops keys and customer details without changing consumer fields', () => {
    const payload = asaasReceiptPayload({
      id: 'event',
      event: 'PAYMENT_RECEIVED',
      apiKey: 'secret',
      accessToken: {
        id: 'key-id',
        apiKey: 'secret',
        name: 'personal key',
        enabled: true,
      },
      payment: {
        id: 'payment',
        value: 10,
        status: 'RECEIVED',
        customer: 'cus_id',
        customerEmail: 'private@example.invalid',
        creditCard: { number: 'secret' },
        clientPaymentDate: '2026-10-03',
      },
    })
    expect(payload).toEqual({
      id: 'event',
      event: 'PAYMENT_RECEIVED',
      accessToken: { id: 'key-id', enabled: true },
      payment: {
        id: 'payment',
        value: 10,
        status: 'RECEIVED',
        customer: 'cus_id',
        clientPaymentDate: '2026-10-03',
      },
    })
    expect(JSON.stringify(payload)).not.toContain('secret')
    expect(JSON.stringify(payload)).not.toContain('private')
  })
})
