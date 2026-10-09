import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { requestReceivingAccount, ReceivingCreateError } from './create-account'

const values = {
  incomeValue: '98765.43',
  mobilePhone: '11987654321',
  companyDataVersion: 'a'.repeat(64),
}
const send = (response: () => Response | Promise<Response>) => {
  const fetcher = vi.fn(async () => response())
  return {
    fetcher,
    result: requestReceivingAccount(createHttpClient({ fetcher }), values).then(
      () => null,
      (error: unknown) =>
        error instanceof ReceivingCreateError ? error.problem : error
    ),
  }
}

describe('owner request of the receiving account', () => {
  it('sends the strict contract once, without caching, and accepts only the strict receipt', async () => {
    const { fetcher, result } = send(() =>
      Response.json({ accepted: true }, { status: 202 })
    )
    expect(await result).toBeNull()
    expect(fetcher).toHaveBeenCalledOnce()
    const [path, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(path).toBe('/api/admin/payment-account/create')
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store' })
    expect(JSON.parse(String(init.body))).toEqual({
      ...values,
      companyDataConfirmed: true,
    })
  })

  it.each([
    ['a number value', { incomeValue: 98765.43 }],
    ['three decimal places', { incomeValue: '98765.431' }],
    ['a landline', { mobilePhone: '1133334444' }],
    ['no version', { companyDataVersion: '' }],
  ])('refuses %s before any request', async (_label, patch) => {
    const fetcher = vi.fn()
    await expect(
      requestReceivingAccount(createHttpClient({ fetcher }), {
        ...values,
        ...(patch as object),
      } as typeof values)
    ).rejects.toMatchObject({ problem: 'input' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'FRESH_SESSION_REQUIRED', 'reauthentication'],
    [401, undefined, 'session'],
    [402, 'SUBSCRIPTION_RESTRICTED', 'subscription'],
    [402, 'MODULE_NOT_IN_PLAN', 'plan'],
    [403, 'EMAIL_NOT_VERIFIED', 'email'],
    [403, 'TENANT_ARCHIVED', 'archived'],
    [403, 'OWNER_REQUIRED', 'owner'],
    [409, 'TENANT_REQUIRED', 'selection'],
    [409, 'DOCUMENT_IN_USE', 'document'],
    [409, 'COMPANY_DATA_CHANGED', 'changed'],
    [409, 'FIRST_PAYMENT_REQUIRED', 'payment'],
    [409, 'PAYMENTS_NOTICE_REQUIRED', 'notice'],
    [409, 'PAYMENT_ACCOUNT_ALREADY_EXISTS', 'existing'],
    [409, 'PAYMENT_INTEGRATION_ALREADY_EXISTS', 'existing'],
    [409, 'PAYMENT_ACCOUNT_CREATION_UNAVAILABLE', 'unavailable'],
    [409, 'constructor', 'changed'],
    [400, 'INVALID_INPUT', 'input'],
    [429, undefined, 'rate'],
    [503, undefined, 'uncertain'],
    [200, undefined, 'uncertain'],
  ] as const)('%s %s is %s', async (status, code, problem) => {
    const { result } = send(() =>
      Response.json({ error: 'private', ...(code ? { code } : {}) }, { status })
    )
    expect(await result).toBe(problem)
  })

  it('an unexpected receipt or a network failure is uncertain', async () => {
    expect(
      await send(() =>
        Response.json({ accepted: true, private: 1 }, { status: 202 })
      ).result
    ).toBe('uncertain')
    expect(
      await send(() => {
        throw new Error('network')
      }).result
    ).toBe('uncertain')
  })
})
