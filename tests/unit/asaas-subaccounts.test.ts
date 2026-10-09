import { inspect } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  createAsaasSubaccounts,
  checkSubaccountCompany,
  checkSubaccountInput,
  AsaasSecretValue,
  ACCOUNT_WEBHOOK_EVENTS,
  type AsaasFetch,
  type AsaasHttpLogEntry,
} from '../../packages/backend/src/modules/billing/index'
import { SAMPLE_DOCUMENTS } from '../helpers/fake-asaas'

const document = SAMPLE_DOCUMENTS.cnpj
const remote = { id: 'acc_owned', cpfCnpj: document, walletId: 'wallet_owned' }
const key = 'synthetic-subaccount-key-not-real-000000'
const hookToken = 'synthetic-webhook-token-not-real-000000'
const input = () => ({
  name: 'Synthetic owner',
  cpfCnpj: '11.222.333/0001-81',
  email: 'owner@example.test',
  loginEmail: 'owner@example.test',
  companyType: 'LIMITED' as const,
  mobilePhone: '(11) 99999-9999',
  site: 'https://alfa.example.test',
  incomeValue: new Prisma.Decimal('12345.67'),
  address: 'Synthetic address',
  addressNumber: '10',
  province: 'Synthetic district',
  postalCode: '01001000',
  webhook: {
    name: 'Locadora-integration-alfa',
    url: 'https://api.example.test/api/webhooks/asaas/integration-alfa',
    email: 'ops@example.test',
    token: new AsaasSecretValue(hookToken),
  },
})
function setup(responses: unknown[]) {
  const logs: AsaasHttpLogEntry[] = []
  const fetch = vi
    .fn<AsaasFetch>()
    .mockImplementation(async () => Response.json(responses.shift()))
  const api = createAsaasSubaccounts({
    credential: new AsaasSecretValue('synthetic-root-key-not-real'),
    environment: 'sandbox',
    fetch,
    policy: () => ({ outboundDisabled: false, egress: { kind: 'direct' } }),
    logger: (entry) => logs.push(entry),
  })
  return { fetch, api, logs }
}

describe('root subaccount adapter', () => {
  it.each([document, SAMPLE_DOCUMENTS.alphanumericCnpj])(
    'bounds exact CNPJ lookup and verifies a point read: %s',
    async (cpfCnpj) => {
      const account = { ...remote, cpfCnpj }
      const { api, fetch, logs } = setup([
        { data: [account], hasMore: false, totalCount: 1 },
        {
          ...account,
          apiKey: key,
          accessToken: { apiKey: key },
          email: 'private@example.test',
        },
      ])
      expect(await api.find(cpfCnpj)).toEqual({
        id: remote.id,
        document: cpfCnpj,
        walletId: remote.walletId,
      })
      const url = new URL(fetch.mock.calls[0]![0])
      expect(url.origin).toBe('https://api-sandbox.asaas.com')
      expect(url.pathname).toBe('/v3/accounts')
      expect(Object.fromEntries(url.searchParams)).toEqual({
        cpfCnpj,
        offset: '0',
        limit: '2',
      })
      expect(fetch.mock.calls[1]![0]).toBe(
        'https://api-sandbox.asaas.com/v3/accounts/acc_owned'
      )
      for (const [, request] of fetch.mock.calls) {
        expect(request.method).toBe('GET')
        expect(request.body).toBeUndefined()
        expect(new Headers(request.headers).get('access_token')).toBe(
          'synthetic-root-key-not-real'
        )
        expect(request.redirect).toBe('error')
      }
      expect(JSON.stringify(logs)).not.toContain(cpfCnpj)
      expect(JSON.stringify(logs)).not.toContain(key)
    }
  )
  it('absence is not evidence permitting a second POST', async () => {
    const { api, fetch } = setup([{ data: [], hasMore: false, totalCount: 0 }])
    expect(await api.find(document)).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([
    { data: [remote, remote], hasMore: false },
    { data: [remote], hasMore: true },
    { data: [], hasMore: false, totalCount: 1 },
    { data: [remote], hasMore: false, totalCount: 0 },
    {
      data: [{ ...remote, cpfCnpj: SAMPLE_DOCUMENTS.alphanumericCnpj }],
      hasMore: false,
    },
    { data: [{ ...remote, cpfCnpj: undefined }], hasMore: false },
    { data: [{ ...remote, id: '../unowned' }], hasMore: false },
    { data: [], hasMore: 'false' },
  ])('rejects incomplete, ambiguous or foreign pages: %j', async (page) => {
    const { api, fetch } = setup([page])
    await expect(api.find(document)).rejects.toMatchObject({
      reason: expect.stringMatching(/AMBIGUOUS_MATCH|UNEXPECTED_SHAPE/),
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it.each([
    { ...remote, id: 'acc_other' },
    { ...remote, walletId: 'wallet_other' },
    { ...remote, cpfCnpj: SAMPLE_DOCUMENTS.alphanumericCnpj },
    { ...remote, cpfCnpj: document.slice(0, -1) + '0' },
  ])('refuses an inconsistent point read: %j', async (point) => {
    const { api, fetch } = setup([{ data: [remote], hasMore: false }, point])
    await expect(api.find(document)).rejects.toBeInstanceOf(Error)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(['apiKey', 'accessToken'] as const)(
    'creates with one embedded webhook and protects one-time %s',
    async (format) => {
      const created = {
        id: remote.id,
        walletId: remote.walletId,
        ...(format === 'apiKey'
          ? { apiKey: key }
          : {
              accessToken: {
                id: 'token_owned',
                apiKey: key,
                expirationDate: '2030-01-01',
                projectedExpirationDateByLackOfUse: '2030-02-01',
              },
            }),
      }
      const { api, fetch, logs } = setup([created])
      const result = await api.create(input())
      const [, request] = fetch.mock.calls[0]!
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(request.method).toBe('POST')
      const body = JSON.parse(request.body as string)
      expect(body).toEqual({
        name: 'Synthetic owner',
        cpfCnpj: document,
        email: 'owner@example.test',
        loginEmail: 'owner@example.test',
        companyType: 'LIMITED',
        mobilePhone: '11999999999',
        site: 'https://alfa.example.test',
        incomeValue: 12345.67,
        address: 'Synthetic address',
        addressNumber: '10',
        province: 'Synthetic district',
        postalCode: '01001000',
        webhooks: [
          {
            name: 'Locadora-integration-alfa',
            url: input().webhook.url,
            email: 'ops@example.test',
            authToken: hookToken,
            enabled: true,
            interrupted: false,
            apiVersion: 3,
            sendType: 'SEQUENTIALLY',
            events: [...ACCOUNT_WEBHOOK_EVENTS],
          },
        ],
      })
      expect(result.credential?.apiKey.use((value) => value)).toBe(key)
      if (format === 'accessToken')
        expect(result.credential).toMatchObject({
          accessTokenId: 'token_owned',
          expiresAt: new Date('2030-01-01T03:00:00Z'),
          expiresByLackOfUseAt: new Date('2030-02-01T03:00:00Z'),
        })
      for (const output of [
        JSON.stringify(result),
        inspect(result),
        JSON.stringify(logs),
      ]) {
        expect(output).not.toContain(key)
        expect(output).not.toContain(hookToken)
      }
    }
  )
  it.each([
    { cpfCnpj: SAMPLE_DOCUMENTS.cpf },
    { incomeValue: new Prisma.Decimal('1.001') },
    { incomeValue: new Prisma.Decimal('-1') },
    { site: 'http://alfa.example.test' },
    { site: 'https://alfa.example.test/tenant' },
    { postalCode: '01001-000' },
    { mobilePhone: '123' },
    { companyType: 'UNSUPPORTED' },
    { webhook: { ...input().webhook, url: 'invalid-private-url' } },
    { webhook: { ...input().webhook, token: new AsaasSecretValue('short') } },
  ])(
    'refuses invalid declared company data before transport: %j',
    async (extra) => {
      const { api, fetch } = setup([])
      await expect(
        api.create({ ...input(), ...extra } as Parameters<typeof api.create>[0])
      ).rejects.toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it.each([
    { id: '../unowned', apiKey: key },
    { id: remote.id, apiKey: 'short' },
    { id: remote.id, apiKey: key, accessToken: { apiKey: key + 'other' } },
  ])(
    'a malformed success is uncertain, not a rejected creation: %j',
    async (response) => {
      const { api, fetch } = setup([response])
      await expect(api.create(input())).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        maybeApplied: true,
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  )
  it.each(['network', 'timeout', '5xx', 'malformed'] as const)(
    'never retries an uncertain %s POST',
    async (fault) => {
      const { api, fetch, logs } = setup([])
      fetch.mockImplementation(async () => {
        if (fault === '5xx')
          return new Response('private upstream details', { status: 500 })
        if (fault === 'malformed') return new Response('private invalid body')
        throw fault === 'timeout'
          ? new DOMException('private details', 'TimeoutError')
          : new Error('private network details')
      })
      await expect(api.create(input())).rejects.toMatchObject({
        maybeApplied: true,
      })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(logs)).not.toContain('private')
    }
  )
  it('the creation body is built and validated without I/O, exactly as POST /accounts sends it', async () => {
    const { api, fetch } = setup([
      { id: remote.id, walletId: remote.walletId, apiKey: key },
    ])
    const checked = checkSubaccountInput(input())
    expect(fetch).not.toHaveBeenCalled()
    await api.create(input())
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual(checked)
    const { incomeValue, webhook, mobilePhone, ...company } = input()
    expect(incomeValue && webhook && mobilePhone).toBeTruthy()
    expect(checkSubaccountCompany(company)).toEqual({
      name: 'Synthetic owner',
      cpfCnpj: document,
      email: 'owner@example.test',
      loginEmail: 'owner@example.test',
      companyType: 'LIMITED',
      site: 'https://alfa.example.test',
      address: 'Synthetic address',
      addressNumber: '10',
      province: 'Synthetic district',
      postalCode: '01001000',
    })
  })
  it.each([
    { site: 'http://alfa.example.test' },
    { site: 'https://alfa.example.test/path' },
    { site: 'https://alfa.example.test/?tenant=alfa' },
    { site: 'https://user:pass@alfa.example.test' },
    { postalCode: '1001000' },
    { postalCode: '01001-000' },
    { cpfCnpj: '11.222.333/0001-80' },
    { cpfCnpj: SAMPLE_DOCUMENTS.cpf },
    { name: '   ' },
    { companyType: 'SA' },
    { loginEmail: 'not-an-email' },
  ])('local company validation refuses %j without echoing it', (extra) => {
    const { incomeValue, webhook, mobilePhone, ...company } = {
      ...input(),
      ...extra,
    }
    expect(incomeValue && webhook && mobilePhone).toBeTruthy()
    let failure: unknown
    try {
      checkSubaccountCompany(
        company as Parameters<typeof checkSubaccountCompany>[0]
      )
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({
      code: 'REJECTED',
      reason: 'INVALID_REQUEST',
    })
    expect(JSON.stringify(failure) + String(failure)).not.toContain(
      Object.values(extra)[0]
    )
  })
  it.each(['1133334444', '(11) 3333-4444', '11887654321'])(
    'the mobilePhone field accepts only a mobile number, never %s',
    async (mobilePhone) => {
      const { api, fetch } = setup([])
      expect(() => checkSubaccountInput({ ...input(), mobilePhone })).toThrow(
        'REJECTED'
      )
      await expect(
        api.create({ ...input(), mobilePhone })
      ).rejects.toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it('honors the emergency switch without falling back to tenant transport', async () => {
    const fetch = vi.fn<AsaasFetch>()
    const api = createAsaasSubaccounts({
      credential: 'root-fixture',
      environment: 'sandbox',
      fetch,
      policy: () => ({ outboundDisabled: true, egress: { kind: 'direct' } }),
    })
    await expect(api.find(document)).rejects.toMatchObject({
      reason: 'OUTBOUND_DISABLED',
    })
    await expect(api.create(input())).rejects.toMatchObject({
      reason: 'OUTBOUND_DISABLED',
      maybeApplied: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
