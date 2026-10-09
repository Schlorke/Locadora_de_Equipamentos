import { expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import {
  connectReceivingAccount,
  ReceivingConnectError,
} from './connect-account'

const apiKey = '$aact_hmlg_' + 'synthetic'.repeat(8)
it('sanitizes transport failures, including cancellation, without storing an error cause', async () => {
  for (const aborted of [false, true]) {
    const client = createHttpClient({
      fetcher: async () => {
        throw Object.assign(new Error(apiKey), {
          name: aborted ? 'AbortError' : 'Error',
        })
      },
    })
    const error = await connectReceivingAccount(client, apiKey).catch(
      (error) => error
    )
    expect(error.message).not.toContain(apiKey)
    expect(error.cause).toBeUndefined()
    expect(error.name === 'AbortError').toBe(aborted)
    if (!aborted) expect(error.problem).toBe('uncertain')
  }
})
it('uses the existing private POST and accepts only its strict 202 receipt', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ accepted: true }, { status: 202 })
  )
  await connectReceivingAccount(createHttpClient({ fetcher }), apiKey)
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledWith(
    '/api/admin/payment-account/connect',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    })
  )
})
it.each(['', 'invalid', apiKey + '\nextra', '$aact_' + 'x'.repeat(1025)])(
  'rejects invalid input locally without exposing it',
  async (value) => {
    const fetcher = vi.fn()
    const error = await connectReceivingAccount(
      createHttpClient({ fetcher }),
      value
    ).catch((error) => error)
    expect(error).toBeInstanceOf(ReceivingConnectError)
    expect(error.problem).toBe('key')
    expect(error.message).not.toContain(value || 'apiKey')
    expect(fetcher).not.toHaveBeenCalled()
  }
)
it.each([
  [200, { accepted: true }],
  [202, { accepted: false }],
  [202, { accepted: true, apiKey }],
  [202, null],
  [503, { error: apiKey }],
])('quarantines an uncertain result (%s)', async (status, data) => {
  const fetcher = vi.fn(async () => Response.json(data, { status }))
  const error = await connectReceivingAccount(
    createHttpClient({ fetcher }),
    apiKey
  ).catch((error) => error)
  expect(error).toBeInstanceOf(ReceivingConnectError)
  expect(error.problem).toBe('uncertain')
  expect(error.message).not.toContain(apiKey)
})
it.each([
  [401, 'FRESH_SESSION_REQUIRED', 'reauthentication'],
  [401, '', 'session'],
  [403, 'EMAIL_NOT_VERIFIED', 'email'],
  [403, 'TENANT_ARCHIVED', 'archived'],
  [403, 'OWNER_REQUIRED', 'owner'],
  [403, '', 'owner'],
  [409, 'TENANT_REQUIRED', 'selection'],
  [409, 'INVALID_CNPJ', 'company'],
  [409, 'ACCOUNT_DOCUMENT_MISMATCH', 'document'],
  [409, 'COMPANY_DATA_CHANGED', 'changed'],
  [409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS', 'existing'],
  [409, 'PAYMENT_INTEGRATION_ALREADY_EXISTS', 'existing'],
  [400, 'CREDENTIAL_ENVIRONMENT_CONFLICT', 'environment'],
  [400, 'CREDENTIAL_REJECTED', 'rejected'],
  [400, 'INVALID_API_KEY', 'key'],
  [400, '', 'uncertain'],
  [429, '', 'rate'],
])(
  'maps a refusal %s/%s without echoing provider errors',
  async (status, code, problem) => {
    const client = createHttpClient({
      fetcher: async () => Response.json({ code, error: apiKey }, { status }),
    })
    const error = await connectReceivingAccount(client, apiKey).catch(
      (error) => error
    )
    expect(error).toBeInstanceOf(ReceivingConnectError)
    expect(error.problem).toBe(problem)
    expect(error.message).not.toContain(apiKey)
  }
)
