import { cancelAttempt } from '../../packages/backend/src/modules/billing/cancel-attempt'
import {
  parseAsaasWebhook,
  readAsaasPayment,
} from '../../packages/backend/src/modules/billing/asaas-events'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { inspect } from 'node:util'

import { Prisma } from '@prisma/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ASAAS_SECRET_FIELDS,
  AsaasSecretValue,
  REDACTED,
  asaasPath,
  createAsaasHttpClient,
  fromAsaasAmount,
  isKnownAsaasEvent,
  isRejectedRequest,
  normalizeAsaasDocument,
  parseAsaasAccountCreation,
  parseAsaasAccountStatus,
  parseAsaasDate,
  parseAsaasEvent,
  readAsaasTransportPolicy,
  redactAsaasSecrets,
  registerAsaasEgressTransport,
  sameAmount,
  toAsaasAmount,
  toMoney,
  type AsaasFetch,
  type AsaasHttpLogEntry,
  type CancellationState,
  type ChargeRequest,
  type ProviderCharge,
} from '@gb-locacoes/backend/billing'
import { BillingProviderError } from '../../packages/backend/src/modules/billing/asaas-http'
import {
  ChargeRequestRejected,
  issuePayment,
  ReconciliationRequired,
  UNKNOWN_ISSUANCE_SETTLE_MS,
  type IssuanceAttempt,
} from '../../packages/backend/src/modules/billing/issue-payment'
import { createAsaasGateway } from '../../packages/backend/src/modules/billing/asaas'

import {
  alphanumericCnpjFor,
  createFakeAsaas,
  defineAsaasContractSuite,
  FIXTURES_DIR,
  isValidCnpj,
  isValidCpf,
  listFixtureFiles,
  loadFixture,
  SAMPLE_DOCUMENTS,
  type FakeAsaas,
  type FakeFault,
} from '../helpers/fake-asaas'

type Json = Record<string, unknown>
const FUTURE_DUE_DATE = '2030-01-10'
const SECRET_MARKER = '$aact_hmlg_FAKE_LEAK_MARKER_000000000000'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function rootClient(
  fake: FakeAsaas,
  extra: {
    timeoutMs?: number
    logger?: (entry: AsaasHttpLogEntry) => void
    fetch?: AsaasFetch
  } = {}
) {
  return createAsaasHttpClient({
    credential: fake.rootApiKey,
    environment: fake.environment,
    fetch: extra.fetch ?? fake.fetch,
    ...extra,
  })
}

async function failure(
  promise: Promise<unknown>
): Promise<BillingProviderError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(BillingProviderError)
  return error as BillingProviderError
}

function renderings(value: unknown): string {
  const error = value as { stack?: unknown; message?: unknown }
  return [
    String(value),
    JSON.stringify(value),
    inspect(value, { depth: 10 }),
    String(error?.stack ?? ''),
    String(error?.message ?? ''),
  ].join('\n')
}

function pixRequest(overrides: Partial<ChargeRequest> = {}): ChargeRequest {
  return {
    reference: 'tenant-a:payment:1:initial',
    amount: new Prisma.Decimal('149.90'),
    dueDate: FUTURE_DUE_DATE,
    description: 'Locacao de equipamentos',
    method: 'PIX',
    customer: {
      name: 'Cliente Exemplo',
      email: 'cliente@example.test',
      document: SAMPLE_DOCUMENTS.cpf,
    },
    ...overrides,
  }
}

/**
 * Tentativa em memória como o repositório da emissão a guarda: `unknownSince` marca a entrada em
 * UNKNOWN ou a reserva (PROCESSING), pelo relógio `now`, e não muda enquanto ela continua no estado.
 */
function memoryIssuance(
  request: ChargeRequest,
  initial: IssuanceAttempt['state'] = 'QUEUED',
  options: { now?: () => Date; unknownSince?: Date | null } = {}
) {
  const now = options.now ?? (() => new Date())
  const uncertain = initial === 'UNKNOWN' || initial === 'PROCESSING'
  // FAILED: recusa definitiva gravada por `reject`; a aplicação nunca entrega essa tentativa à emissão.
  const state = {
    value: initial as IssuanceAttempt['state'] | 'FAILED',
    unknownSince: uncertain
      ? (options.unknownSince ?? now())
      : (null as Date | null),
  }
  const repository = {
    load: async () => ({
      id: 'attempt-1',
      state: state.value as IssuanceAttempt['state'],
      request,
      unknownSince: state.unknownSince,
    }),
    claim: vi.fn(async () => {
      if (state.value !== 'QUEUED') return false
      state.value = 'PROCESSING'
      state.unknownSince = now()
      return true
    }),
    unknown: vi.fn(async () => {
      if (state.value !== 'UNKNOWN') {
        state.value = 'UNKNOWN'
        state.unknownSince = now()
      }
    }),
    release: vi.fn(async () => {
      if (state.value === 'PROCESSING') {
        state.value = 'QUEUED'
        state.unknownSince = null
      }
    }),
    reject: vi.fn(async (_id: string, _error: BillingProviderError) => {
      if (state.value === 'PROCESSING') {
        state.value = 'FAILED'
        state.unknownSince = null
      }
    }),
    requeue: vi.fn(async () => {
      if (state.value !== 'UNKNOWN' && state.value !== 'PROCESSING')
        return false
      state.value = 'QUEUED'
      state.unknownSince = null
      return true
    }),
    issued: vi.fn(async () => {
      state.value = 'ISSUED'
    }),
  }
  return { state, repository }
}

// -----------------------------------------------------------------------------------------------
// Suíte de contrato compartilhada (a mesma que o S15 roda contra o sandbox)
// -----------------------------------------------------------------------------------------------

const contractFake = createFakeAsaas({
  now: () => new Date('2026-09-26T12:00:00Z'),
})
let suffix = 0
defineAsaasContractSuite({
  name: 'dublê',
  environment: contractFake.environment,
  rootApiKey: contractFake.rootApiKey,
  fetch: contractFake.fetch,
  uniqueSuffix: () => 'fake-' + String(++suffix),
  dueDate: () => '2026-10-10',
  subaccounts: true,
})

// -----------------------------------------------------------------------------------------------
// O dublê
// -----------------------------------------------------------------------------------------------

describe('dublê do Asaas: fidelidade ao contrato', () => {
  it('fixtures são sanitizadas: chaves marcadas FAKE, e-mails e hosts de exemplo, documentos públicos', () => {
    const files = listFixtureFiles()
    expect(files.length).toBeGreaterThanOrEqual(15)
    const documents = new Set(Object.values(SAMPLE_DOCUMENTS))
    const secretKeys = new Set(
      ASAAS_SECRET_FIELDS.map((field) => field.toLowerCase())
    )
    const problems: string[] = []
    const walk = (value: unknown, where: string, secret: boolean) => {
      if (typeof value === 'string') {
        if (secret && !value.includes('FAKE'))
          problems.push(where + ': segredo sem marca FAKE')
        if (/@/.test(value) && !/^[^@\s]+@example\.test$/.test(value))
          problems.push(where + ': e-mail real')
        if (/^https?:\/\//.test(value)) {
          const host = new URL(value).hostname
          if (
            !host.endsWith('.example.test') &&
            !['sandbox.asaas.com', 'www.asaas.com'].includes(host)
          )
            problems.push(where + ': host ' + host)
        }
        if (
          /^(?:\d{11}|[0-9A-Z]{12}\d{2})$/.test(value) &&
          (isValidCpf(value) || isValidCnpj(value)) &&
          !documents.has(value)
        ) {
          problems.push(where + ': documento fora da lista pública')
        }
        return
      }
      if (Array.isArray(value))
        value.forEach((item, index) =>
          walk(item, where + '[' + index + ']', secret)
        )
      else if (value && typeof value === 'object') {
        // Um segredo é o valor TEXTO de um campo sensível (ex.: `apiKey`, inclusive `accessToken.apiKey`).
        for (const [key, item] of Object.entries(value))
          walk(item, where + '.' + key, secretKeys.has(key.toLowerCase()))
      }
    }
    for (const file of files)
      walk(
        JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), 'utf8')),
        file,
        false
      )
    expect(problems).toEqual([])
  })

  it('documentos: dígitos verificadores de CPF e CNPJ, inclusive o alfanumérico oficial', () => {
    expect(isValidCpf(SAMPLE_DOCUMENTS.cpf)).toBe(true)
    expect(isValidCpf('12345678900')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCnpj(SAMPLE_DOCUMENTS.cnpj)).toBe(true)
    expect(isValidCnpj(SAMPLE_DOCUMENTS.alphanumericCnpj)).toBe(true)
    expect(isValidCnpj('12ABC34501DE36')).toBe(false)
    expect(isValidCnpj('12abc34501de35')).toBe(false)
  })

  it('respostas têm exatamente os campos das fixtures', async () => {
    const fake = createFakeAsaas()
    const client = rootClient(fake)
    const customer = (await client.request({
      method: 'POST',
      path: '/customers',
      body: { name: 'Cliente', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
    })) as Json
    const payment = (await client.request({
      method: 'POST',
      path: '/payments',
      body: {
        customer: customer.id,
        billingType: 'BOLETO',
        value: 120.1,
        dueDate: FUTURE_DUE_DATE,
      },
    })) as Json
    const subscription = (await client.request({
      method: 'POST',
      path: '/subscriptions',
      body: {
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: 149.9,
        cycle: 'MONTHLY',
        nextDueDate: FUTURE_DUE_DATE,
      },
    })) as Json
    const webhook = (await client.request({
      method: 'POST',
      path: '/webhooks',
      body: {
        name: 'Hook',
        url: 'https://app.example.test/hook',
        sendType: 'SEQUENTIALLY',
        events: ['PAYMENT_RECEIVED'],
      },
    })) as Json
    const keys = (value: unknown) => Object.keys(value as Json).sort()
    expect(keys(customer)).toEqual(keys(loadFixture('customer')))
    expect(keys(payment)).toEqual(keys(loadFixture('payment')))
    expect(keys(subscription)).toEqual(keys(loadFixture('subscription')))
    expect(keys(webhook)).toEqual(keys(loadFixture('webhook')))
    expect(
      keys(await client.request({ method: 'GET', path: '/payments' }))
    ).toEqual(keys(loadFixture('list')))
    expect(
      keys(
        await client.request({
          method: 'GET',
          path: asaasPath`/payments/${String(payment.id)}/identificationField`,
        })
      )
    ).toEqual(keys(loadFixture('identification-field')))
    expect(
      keys(await client.request({ method: 'GET', path: '/myAccount/status' }))
    ).toEqual(keys(loadFixture('account-status')))
    for (const format of ['apiKey', 'accessToken'] as const) {
      const account = await rootClient(
        createFakeAsaas({ accountKeyFormat: format })
      ).request({ method: 'POST', path: '/accounts', body: subaccountBody() })
      expect(keys(account)).toEqual(
        keys(
          loadFixture(
            format === 'apiKey'
              ? 'account-created.api-key'
              : 'account-created.access-token'
          )
        )
      )
    }
  })

  it('autentica só pelo header access_token; Authorization é ignorado e dá 401', async () => {
    const fake = createFakeAsaas()
    const url = fake.origin + '/v3/customers'
    expect(
      (
        await fake.fetch(url, {
          headers: { Authorization: 'Bearer ' + fake.rootApiKey },
        })
      ).status
    ).toBe(401)
    expect(
      (await fake.fetch(url, { headers: { access_token: fake.rootApiKey } }))
        .status
    ).toBe(200)
    await expect(
      fake.fetch('https://api-sandbox.asaas.example.test/v3/customers', {
        headers: { access_token: fake.rootApiKey },
      })
    ).rejects.toThrow(TypeError)
  })

  it('valida os DTOs documentados: documento, valor, vencimento, forma de pagamento e cliente', async () => {
    const fake = createFakeAsaas({
      now: () => new Date('2026-09-26T12:00:00Z'),
    })
    const client = rootClient(fake)
    const customer = (await client.request({
      method: 'POST',
      path: '/customers',
      body: { name: 'Cliente', cpfCnpj: SAMPLE_DOCUMENTS.cnpj },
    })) as Json
    const base = {
      customer: customer.id,
      billingType: 'PIX',
      value: 120.1,
      dueDate: '2026-10-01',
    }
    const cases: [Json, string][] = [
      [{ ...base, value: 1.005 }, 'invalid_value'],
      [{ ...base, value: '120.10' }, 'invalid_value'],
      [{ ...base, value: 4.99 }, 'invalid_value'],
      [{ ...base, dueDate: '2026-09-25' }, 'invalid_dueDate'],
      [{ ...base, dueDate: '2026-02-31' }, 'invalid_dueDate'],
      [{ ...base, billingType: 'CASH' }, 'invalid_billingType'],
      [{ ...base, customer: 'cus_inexistente' }, 'invalid_customer'],
    ]
    for (const [body, code] of cases) {
      expect(
        await failure(
          client.request({ method: 'POST', path: '/payments', body })
        )
      ).toMatchObject({ reason: 'VALIDATION', providerCodes: [code] })
    }
    expect(
      await failure(
        client.request({
          method: 'POST',
          path: '/customers',
          body: { name: 'X', cpfCnpj: '12ABC34501DE36' },
        })
      )
    ).toMatchObject({ providerCodes: ['invalid_cpfCnpj'] })
    const strict = rootClient(createFakeAsaas({ alphanumericCnpj: 'reject' }))
    expect(
      await failure(
        strict.request({
          method: 'POST',
          path: '/customers',
          body: { name: 'X', cpfCnpj: SAMPLE_DOCUMENTS.alphanumericCnpj },
        })
      )
    ).toMatchObject({ providerCodes: ['invalid_cpfCnpj'] })
  })

  it('entrega de webhook: só eventos assinados, header asaas-access-token e corpo lido por parseAsaasEvent', async () => {
    const fake = createFakeAsaas()
    const client = rootClient(fake)
    const authToken = 'WebhookToken' + 'z'.repeat(31)
    const hook = (await client.request({
      method: 'POST',
      path: '/webhooks',
      body: {
        name: 'Hook',
        url: 'https://app.example.test/api/webhooks/asaas/platform',
        sendType: 'SEQUENTIALLY',
        authToken,
        events: ['PAYMENT_RECEIVED'],
      },
    })) as Json
    const customer = (await client.request({
      method: 'POST',
      path: '/customers',
      body: { name: 'Cliente', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
    })) as Json
    const payment = (await client.request({
      method: 'POST',
      path: '/payments',
      body: {
        customer: customer.id,
        billingType: 'PIX',
        value: 149.9,
        dueDate: FUTURE_DUE_DATE,
      },
    })) as Json
    expect(fake.deliveries).toHaveLength(0)
    fake.receivePayment(String(payment.id), { date: '2030-01-05' })
    expect(fake.deliveries.map((row) => row.event)).toEqual([
      'PAYMENT_RECEIVED',
    ])
    const request = fake.deliveryRequest(fake.deliveries[0]!)
    expect(request.headers.get('asaas-access-token')).toBe(authToken)
    expect(request.url).toBe(
      'https://app.example.test/api/webhooks/asaas/platform'
    )
    const parsed = parseAsaasEvent(await request.json())
    expect(
      parsed.ok &&
        parsed.event.category === 'PAYMENT' &&
        parsed.event.payment.value?.equals('149.90')
    ).toBe(true)
    expect(parsed).toMatchObject({
      ok: true,
      event: {
        type: 'PAYMENT_RECEIVED',
        payment: { id: payment.id, status: 'RECEIVED' },
      },
    })
    await client.request({
      method: 'PUT',
      path: '/webhooks/' + String(hook.id),
      body: { interrupted: true },
    })
    const second = (await client.request({
      method: 'POST',
      path: '/payments',
      body: {
        customer: customer.id,
        billingType: 'PIX',
        value: 50,
        dueDate: FUTURE_DUE_DATE,
      },
    })) as Json
    fake.receivePayment(String(second.id))
    expect(fake.deliveries).toHaveLength(1)
    await client.request({
      method: 'PUT',
      path: '/webhooks/' + String(hook.id),
      body: { interrupted: false },
    })
    fake.refundPayment(String(second.id))
    fake.receivePayment(String(second.id))
    expect(fake.deliveries.map((row) => row.event)).toEqual([
      'PAYMENT_RECEIVED',
      'PAYMENT_RECEIVED',
    ])
  })

  it('gera CNPJ alfanumérico válido e distinto por semente', () => {
    const first = alphanumericCnpjFor('run-1')
    expect(isValidCnpj(first)).toBe(true)
    expect(first).toMatch(/[A-Z]/)
    expect(alphanumericCnpjFor('run-2')).not.toBe(first)
    expect(alphanumericCnpjFor('run-1')).toBe(first)
  })

  it('subconta: ACCOUNT_STATUS_* chegam à subconta e parseAsaasEvent deduz a mudança', async () => {
    const fake = createFakeAsaas({ accountKeyFormat: 'accessToken' })
    const account = parseAsaasAccountCreation(
      await rootClient(fake).request({
        method: 'POST',
        path: '/accounts',
        body: subaccountBody({
          webhooks: [
            {
              name: 'Sub',
              url: 'https://app.example.test/api/webhooks/asaas/integration-1',
              sendType: 'SEQUENTIALLY',
              authToken: 'SubToken' + 'w'.repeat(30),
              events: [
                'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
                'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
              ],
            },
          ],
        }),
      })
    )
    fake.setAccountStatus(account.id, {
      general: 'APPROVED',
      documentation: 'APPROVED',
    })
    fake.emitAccountEvent(
      account.id,
      'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON'
    )
    expect(fake.deliveries.map((row) => row.event)).toEqual([
      'ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED',
      'ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON',
    ])
    const [approved, expiring] = fake.deliveries.map((row) =>
      parseAsaasEvent(row.body)
    )
    expect(approved).toMatchObject({
      ok: true,
      event: {
        category: 'ACCOUNT_STATUS',
        change: { field: 'general', status: 'APPROVED' },
        accountStatus: { id: account.id, general: 'APPROVED' },
      },
    })
    expect(expiring).toMatchObject({
      ok: true,
      event: { change: { field: 'commercialInfo', status: 'EXPIRING_SOON' } },
    })
    const sub = createAsaasHttpClient({
      credential: account.credential!.apiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    expect(
      parseAsaasAccountStatus(
        await sub.request({ method: 'GET', path: '/myAccount/status' })
      )
    ).toMatchObject({ general: 'APPROVED' })
    await expect(
      sub.request({ method: 'POST', path: '/accounts', body: subaccountBody() })
    ).rejects.toMatchObject({ reason: 'FORBIDDEN' })
  })

  it('chaves de subconta: gestão só com a janela aberta; chave desabilitada deixa de autenticar', async () => {
    const fake = createFakeAsaas()
    const root = rootClient(fake)
    const account = parseAsaasAccountCreation(
      await root.request({
        method: 'POST',
        path: '/accounts',
        body: subaccountBody(),
      })
    )
    const path = asaasPath`/accounts/${account.id}/accessTokens`
    await expect(
      root.request({ method: 'POST', path, body: { name: 'rotacao' } })
    ).rejects.toMatchObject({ reason: 'FORBIDDEN' })
    fake.openAccessTokenWindow()
    const created = (await root.request({
      method: 'POST',
      path,
      body: { name: 'rotacao' },
    })) as Json
    expect(created.apiKey).toEqual(expect.stringContaining('FAKE'))
    const listed = (await root.request({ method: 'GET', path })) as Json
    expect(JSON.stringify(listed)).not.toContain('$aact_')
    const old = (listed.data as Json[]).find((row) => row.name === 'criacao')!
    await root.request({
      method: 'PUT',
      path: asaasPath`/accounts/${account.id}/accessTokens/${String(old.id)}`,
      body: { enabled: false },
    })
    const oldClient = createAsaasHttpClient({
      credential: account.credential!.apiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    await expect(
      oldClient.request({ method: 'GET', path: '/myAccount/status' })
    ).rejects.toMatchObject({ reason: 'AUTHENTICATION' })
    const newClient = createAsaasHttpClient({
      credential: String(created.apiKey),
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    await expect(
      newClient.request({ method: 'GET', path: '/myAccount/status' })
    ).resolves.toMatchObject({ id: account.id })
  })

  /** Assinatura com três faturas: a pendente da criação, uma paga e uma vencida. */
  async function subscriptionWithInvoices(fake: FakeAsaas) {
    const client = rootClient(fake)
    const customer = (await client.request({
      method: 'POST',
      path: '/customers',
      body: { name: 'Locadora', cpfCnpj: SAMPLE_DOCUMENTS.cnpj },
    })) as Json
    const sub = (await client.request({
      method: 'POST',
      path: '/subscriptions',
      body: {
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: 149.9,
        cycle: 'MONTHLY',
        nextDueDate: FUTURE_DUE_DATE,
      },
    })) as Json
    const path = '/subscriptions/' + String(sub.id)
    const [first] = (
      (await client.request({ method: 'GET', path: path + '/payments' })) as {
        data: Json[]
      }
    ).data
    const received = fake.receivePayment(
      String(fake.generateSubscriptionPayment(String(sub.id)).id)
    )
    const overdue = fake.markOverdue(
      String(fake.generateSubscriptionPayment(String(sub.id)).id)
    )
    const invoices = async () =>
      Object.fromEntries(
        (
          (await client.request({
            method: 'GET',
            path: path + '/payments',
          })) as { data: Json[] }
        ).data.map((row) => [
          String(row.id),
          { value: row.value, status: row.status },
        ])
      )
    return {
      client,
      path,
      pending: String(first!.id),
      received: String(received.id),
      overdue: String(overdue.id),
      invoices,
    }
  }

  it('assinatura: updatePendingPayments muda só a fatura pendente; paga e vencida ficam como estão', async () => {
    const fake = createFakeAsaas()
    const { client, path, pending, received, overdue, invoices } =
      await subscriptionWithInvoices(fake)
    await client.request({
      method: 'PUT',
      path,
      body: { value: 199.9, updatePendingPayments: true },
    })
    expect(await invoices()).toEqual({
      [pending]: { value: 199.9, status: 'PENDING' },
      [received]: { value: 149.9, status: 'RECEIVED' },
      [overdue]: { value: 149.9, status: 'OVERDUE' },
    })
  })

  it('assinatura: DELETE é proibido pela plataforma (apagaria as faturas vencidas); o dublê recusa, registra e não apaga nada', async () => {
    const fake = createFakeAsaas()
    const { client, path, pending, received, overdue, invoices } =
      await subscriptionWithInvoices(fake)
    const before = await invoices()
    const refused = await client
      .request({ method: 'DELETE', path })
      .catch((error: unknown) => error)
    expect(refused).toBeInstanceOf(BillingProviderError)
    expect(refused).toMatchObject({ code: 'REJECTED', status: 405 })
    expect(fake.forbiddenRequests).toEqual([{ method: 'DELETE', path }])
    expect(await client.request({ method: 'GET', path })).toMatchObject({
      status: 'ACTIVE',
      deleted: false,
    })
    expect(await invoices()).toEqual(before)
    expect(Object.keys(before).sort()).toEqual(
      [pending, received, overdue].sort()
    )
    // Só quem reproduz o Asaas de propósito liga a remoção (que apaga pendentes e vencidas).
    const permissive = createFakeAsaas({ allowSubscriptionDelete: true })
    const asaas = await subscriptionWithInvoices(permissive)
    await asaas.client.request({ method: 'DELETE', path: asaas.path })
    expect(Object.keys(await asaas.invoices())).toEqual([asaas.received])
    expect(permissive.forbiddenRequests).toEqual([])
  })
})

function subaccountBody(overrides: Json = {}): Json {
  return {
    name: 'Locadora Exemplo LTDA',
    email: 'financeiro@example.test',
    cpfCnpj: SAMPLE_DOCUMENTS.cnpj,
    companyType: 'LIMITED',
    mobilePhone: '11900000000',
    incomeValue: 50000,
    address: 'Rua Exemplo',
    addressNumber: '100',
    province: 'Centro',
    postalCode: '01001000',
    site: 'https://exemplo.plataforma.example.test',
    ...overrides,
  }
}

// -----------------------------------------------------------------------------------------------
// Cliente HTTP único
// -----------------------------------------------------------------------------------------------

describe('cliente HTTP único do Asaas', () => {
  it('envia só access_token, com origem fixa, redirect error, timeout e User-Agent', async () => {
    const fake = createFakeAsaas()
    await rootClient(fake).request({
      method: 'GET',
      path: '/customers',
      query: { cpfCnpj: SAMPLE_DOCUMENTS.cpf, limit: 100 },
    })
    const [record] = fake.requests
    expect(record).toMatchObject({
      method: 'GET',
      path: '/customers',
      query: { cpfCnpj: SAMPLE_DOCUMENTS.cpf, limit: '100' },
      redirect: 'error',
      hadSignal: true,
      status: 200,
    })
    expect(record!.headerNames).toEqual(
      expect.arrayContaining(['access_token', 'user-agent', 'content-type'])
    )
    expect(record!.headerNames).not.toContain('authorization')
    const production = createFakeAsaas({ environment: 'production' })
    await expect(
      createAsaasHttpClient({
        credential: production.rootApiKey,
        environment: 'production',
        fetch: production.fetch,
      }).request({ method: 'GET', path: '/customers' })
    ).resolves.toMatchObject({ object: 'list' })
    expect(
      await failure(
        createAsaasHttpClient({
          credential: production.rootApiKey,
          environment: 'sandbox',
          fetch: production.fetch,
        }).request({ method: 'GET', path: '/customers' })
      )
    ).toMatchObject({ code: 'UNAVAILABLE', reason: 'NETWORK' })
  })

  it('usa o fetch global do momento da chamada quando nenhum transporte é injetado', async () => {
    const fake = createFakeAsaas()
    const client = createAsaasHttpClient({
      credential: fake.rootApiKey,
      environment: 'sandbox',
    })
    vi.stubGlobal('fetch', fake.fetch)
    await expect(
      client.request({ method: 'GET', path: '/customers' })
    ).resolves.toMatchObject({ object: 'list' })
    expect(fake.requests).toHaveLength(1)
  })

  it.each(['true', 'TRUE', ' 1 ', 'yes', 'on', 'desligar'])(
    'interruptor de emergência %j corta toda saída, inclusive gateway e leitor',
    async (value) => {
      vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', value)
      const fake = createFakeAsaas()
      const transport = vi.fn(fake.fetch)
      expect(
        await failure(
          rootClient(fake, { fetch: transport }).request({
            method: 'POST',
            path: '/customers',
            body: { name: 'X', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
          })
        )
      ).toMatchObject({
        code: 'UNAVAILABLE',
        reason: 'OUTBOUND_DISABLED',
        maybeApplied: false,
      })
      const gateway = createAsaasGateway({
        apiKey: fake.rootApiKey,
        environment: 'sandbox',
        fetch: transport,
      })
      expect(await failure(gateway.find('any'))).toMatchObject({
        reason: 'OUTBOUND_DISABLED',
      })
      expect(
        await failure(
          readAsaasPayment('pay_1', {
            apiKey: fake.rootApiKey,
            environment: 'sandbox',
            fetch: transport,
          })
        )
      ).toMatchObject({ reason: 'OUTBOUND_DISABLED' })
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it.each([undefined, '', 'false', '0', 'off', 'no', ' FALSE '])(
    'interruptor %j mantém a saída ligada',
    async (value) => {
      if (value !== undefined)
        vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', value)
      expect(readAsaasTransportPolicy().outboundDisabled).toBe(false)
      await expect(
        rootClient(createFakeAsaas()).request({
          method: 'GET',
          path: '/customers',
        })
      ).resolves.toMatchObject({ object: 'list' })
    }
  )

  it('saída por IP fixo: com proxy configurado só sai pelo transporte de egress; sem ele falha fechada e não vaza a URL', async () => {
    vi.stubEnv(
      'PLATFORM_ASAAS_EGRESS_PROXY_URL',
      'http://proxy-user:proxy-pass@egress.example.test:3128'
    )
    const fake = createFakeAsaas()
    const direct = vi.fn(fake.fetch)
    const blocked = await failure(
      rootClient(fake, { fetch: direct }).request({
        method: 'GET',
        path: '/customers',
      })
    )
    expect(blocked).toMatchObject({
      code: 'UNAVAILABLE',
      reason: 'EGRESS_UNAVAILABLE',
      maybeApplied: false,
    })
    expect(renderings(blocked)).not.toMatch(
      /proxy-user|proxy-pass|egress\.example\.test/
    )
    const proxies: string[] = []
    const unregister = registerAsaasEgressTransport((proxyUrl) => {
      proxies.push(proxyUrl.href)
      return fake.fetch
    })
    try {
      await expect(
        rootClient(fake, { fetch: direct }).request({
          method: 'GET',
          path: '/customers',
        })
      ).resolves.toMatchObject({ object: 'list' })
      expect(proxies).toEqual([
        'http://proxy-user:proxy-pass@egress.example.test:3128/',
      ])
      const own = vi.fn(fake.fetch)
      await createAsaasHttpClient({
        credential: fake.rootApiKey,
        environment: 'sandbox',
        fetch: direct,
        egress: () => own,
      }).request({ method: 'GET', path: '/customers' })
      expect(own).toHaveBeenCalledTimes(1)
      for (const invalid of ['ftp://egress.example.test', 'não é url']) {
        vi.stubEnv('PLATFORM_ASAAS_EGRESS_PROXY_URL', invalid)
        expect(
          await failure(
            rootClient(fake, { fetch: direct }).request({
              method: 'GET',
              path: '/customers',
            })
          )
        ).toMatchObject({ reason: 'EGRESS_UNAVAILABLE' })
      }
    } finally {
      unregister()
    }
    expect(direct).not.toHaveBeenCalled()
  })

  it('timeout: UNAVAILABLE/TIMEOUT; uma escrita fica marcada como talvez aplicada', async () => {
    const fake = createFakeAsaas()
    const client = rootClient(fake, { timeoutMs: 30 })
    fake.inject({
      method: 'POST',
      path: '/customers',
      fault: { kind: 'timeout' },
    })
    expect(
      await failure(
        client.request({
          method: 'POST',
          path: '/customers',
          body: { name: 'X', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
        })
      )
    ).toMatchObject({
      code: 'UNAVAILABLE',
      reason: 'TIMEOUT',
      maybeApplied: true,
      message: 'UNAVAILABLE',
    })
    fake.inject({
      method: 'GET',
      path: '/customers',
      fault: { kind: 'timeout' },
    })
    expect(
      await failure(client.request({ method: 'GET', path: '/customers' }))
    ).toMatchObject({ reason: 'TIMEOUT', maybeApplied: false })
    expect(
      await failure(
        client.request({ method: 'GET', path: '/customers', timeoutMs: 0 })
      )
    ).toMatchObject({ reason: 'INVALID_CONFIGURATION' })
  })

  it.each([
    [
      400,
      'POST',
      {
        code: 'REJECTED',
        reason: 'VALIDATION',
        providerCodes: ['invalid_value'],
        maybeApplied: false,
      },
    ],
    [
      401,
      'GET',
      {
        code: 'REJECTED',
        reason: 'AUTHENTICATION',
        providerCodes: ['invalid_access_token'],
      },
    ],
    [
      403,
      'POST',
      { code: 'REJECTED', reason: 'FORBIDDEN', maybeApplied: false },
    ],
    [404, 'GET', { code: 'REJECTED', reason: 'NOT_FOUND' }],
    [
      429,
      'POST',
      {
        code: 'UNAVAILABLE',
        reason: 'RATE_LIMITED',
        retryAfterSeconds: 60,
        maybeApplied: false,
      },
    ],
    [
      500,
      'POST',
      {
        code: 'UNAVAILABLE',
        reason: 'PROVIDER_ERROR',
        maybeApplied: true,
        providerCodes: [],
      },
    ],
    [
      502,
      'GET',
      { code: 'UNAVAILABLE', reason: 'PROVIDER_ERROR', maybeApplied: false },
    ],
    [
      503,
      'POST',
      { code: 'UNAVAILABLE', reason: 'PROVIDER_ERROR', maybeApplied: true },
    ],
  ] as const)('HTTP %i em %s vira %j', async (status, method, expected) => {
    const fake = createFakeAsaas()
    fake.inject({ path: '/customers', fault: { kind: 'status', status } })
    const request =
      method === 'POST'
        ? rootClient(fake).request({
            method,
            path: '/customers',
            body: { name: 'X', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
          })
        : rootClient(fake).request({ method, path: '/customers' })
    expect(await failure(request)).toMatchObject({
      ...expected,
      status,
      message: expected.code,
    })
  })

  it('queda de rede e corpo inválido não expõem detalhe', async () => {
    const fake = createFakeAsaas()
    fake.inject({ fault: { kind: 'network' } })
    expect(
      await failure(
        rootClient(fake).request({ method: 'GET', path: '/customers' })
      )
    ).toMatchObject({ reason: 'NETWORK', message: 'UNAVAILABLE' })
    const html: AsaasFetch = async () =>
      new Response('<html>erro</html>', { status: 200 })
    expect(
      await failure(
        rootClient(fake, { fetch: html }).request({
          method: 'POST',
          path: '/customers',
          body: {},
        })
      )
    ).toMatchObject({
      code: 'INVALID_RESPONSE',
      reason: 'MALFORMED_BODY',
      maybeApplied: true,
    })
  })

  it('redação: nenhum erro, log ou console contém chave, corpo, query, descrição do Asaas ou CPF/CNPJ', async () => {
    const consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (level) => vi.spyOn(console, level).mockImplementation(() => undefined)
    )
    const entries: AsaasHttpLogEntry[] = []
    const leaky: AsaasFetch = async (url, init) => {
      const headers = new Headers(init.headers)
      if (headers.get('access_token') !== SECRET_MARKER)
        throw new Error('unexpected key')
      if (url.includes('/network'))
        throw new TypeError('connect ECONNREFUSED ' + url + ' ' + SECRET_MARKER)
      const status = url.includes('/auth') ? 401 : 400
      return Response.json(
        {
          errors: [
            {
              code: 'invalid_cpfCnpj',
              description:
                'CPF ' +
                SAMPLE_DOCUMENTS.cpf +
                ' recusado para ' +
                SECRET_MARKER,
            },
          ],
        },
        { status }
      )
    }
    const client = createAsaasHttpClient({
      credential: new AsaasSecretValue(SECRET_MARKER),
      environment: 'sandbox',
      fetch: leaky,
      logger: (entry) => entries.push(entry),
    })
    const errors = [
      await failure(
        client.request({
          method: 'POST',
          path: '/customers',
          query: { cpfCnpj: SAMPLE_DOCUMENTS.cpf },
          body: { cpfCnpj: SAMPLE_DOCUMENTS.cpf, apiKey: SECRET_MARKER },
        })
      ),
      await failure(
        client.request({
          method: 'GET',
          path: '/auth',
          query: { cpfCnpj: SAMPLE_DOCUMENTS.cpf },
        })
      ),
      await failure(
        client.request({
          method: 'GET',
          path: '/network',
          query: { cpfCnpj: SAMPLE_DOCUMENTS.cpf },
        })
      ),
    ]
    expect(errors.map((error) => error.reason)).toEqual([
      'VALIDATION',
      'AUTHENTICATION',
      'NETWORK',
    ])
    expect(errors[0]!.providerCodes).toEqual(['invalid_cpfCnpj'])
    const everything =
      errors.map(renderings).join('\n') + JSON.stringify(entries)
    for (const forbidden of [
      SECRET_MARKER,
      SAMPLE_DOCUMENTS.cpf,
      'cpfCnpj=',
      'recusado',
      'ECONNREFUSED',
      'access_token',
    ]) {
      expect(everything).not.toContain(forbidden)
    }
    expect(
      entries.map((entry) => [
        entry.method,
        entry.path,
        entry.status,
        entry.outcome,
      ])
    ).toEqual([
      ['POST', '/customers', 400, 'VALIDATION'],
      ['GET', '/auth', 401, 'AUTHENTICATION'],
      ['GET', '/network', null, 'NETWORK'],
    ])
    for (const spy of consoles) expect(spy).not.toHaveBeenCalled()
  })

  it('um logger com defeito não altera a chamada', async () => {
    const fake = createFakeAsaas()
    const client = rootClient(fake, {
      logger: () => {
        throw new Error('logger down')
      },
    })
    await expect(
      client.request({ method: 'GET', path: '/customers' })
    ).resolves.toMatchObject({ object: 'list' })
  })

  it('redactAsaasSecrets remove os campos sensíveis em qualquer nível e os segredos conhecidos em texto', () => {
    const input: Json = {
      apiKey: SECRET_MARKER,
      nested: {
        accessToken: { id: 'tok', apiKey: SECRET_MARKER },
        AuthToken: 'x',
        'asaas-access-token': 'y',
      },
      headers: { access_token: SECRET_MARKER, Authorization: 'Bearer z' },
      onboardingUrl: 'https://asaas.example.test/onboarding/1',
      wrappedDek: 'dek',
      ciphertext: 'ct',
      note: 'falhou com ' + SECRET_MARKER,
      secret: new AsaasSecretValue(SECRET_MARKER),
      list: [{ apiKey: SECRET_MARKER }],
      keep: 'visível',
    }
    input.self = input
    const output = redactAsaasSecrets(input, [SECRET_MARKER]) as Json
    expect(JSON.stringify({ ...output, self: null })).not.toContain(
      SECRET_MARKER
    )
    expect(output).toMatchObject({
      apiKey: REDACTED,
      nested: {
        accessToken: REDACTED,
        AuthToken: REDACTED,
        'asaas-access-token': REDACTED,
      },
      headers: { access_token: REDACTED, Authorization: REDACTED },
      onboardingUrl: REDACTED,
      wrappedDek: REDACTED,
      ciphertext: REDACTED,
      note: 'falhou com ' + REDACTED,
      secret: REDACTED,
      list: [{ apiKey: REDACTED }],
      keep: 'visível',
    })
    expect(output.self).toBe(output)
    expect(input.apiKey).toBe(SECRET_MARKER)
  })

  it('caminhos: ids codificados, sem travessia, sem query embutida e sem outra origem', async () => {
    expect(asaasPath`/payments/${'a/b?c'}/pixQrCode`).toBe(
      '/payments/a%2Fb%3Fc/pixQrCode'
    )
    expect(() => asaasPath`/payments/${'..'}`).toThrow(BillingProviderError)
    expect(() => asaasPath`/payments/${''}`).toThrow(BillingProviderError)
    const transport = vi.fn<AsaasFetch>()
    const client = createAsaasHttpClient({
      credential: SECRET_MARKER,
      environment: 'sandbox',
      fetch: transport,
    })
    for (const bad of [
      '/payments/../accounts',
      '/payments/%2e%2e/accounts',
      '/payments?x=1',
      '//evil.example.test/x',
      'payments',
      '/payments#x',
      '/pay ments',
    ]) {
      expect(
        await failure(client.request({ method: 'GET', path: bad }))
      ).toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
    }
    expect(transport).not.toHaveBeenCalled()
  })

  it('corpo com Decimal, número não finito ou BigInt é recusado antes da rede', async () => {
    const transport = vi.fn<AsaasFetch>()
    const client = createAsaasHttpClient({
      credential: SECRET_MARKER,
      environment: 'sandbox',
      fetch: transport,
    })
    for (const body of [
      { value: new Prisma.Decimal('149.90') },
      { fine: { value: Number.NaN } },
      { value: Number.POSITIVE_INFINITY },
      { value: BigInt(1) },
    ]) {
      expect(
        await failure(
          client.request({ method: 'POST', path: '/payments', body })
        )
      ).toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
    }
    expect(transport).not.toHaveBeenCalled()
  })

  it('credencial ausente ou inutilizável falha sem rede; portador de segredo é aceito', async () => {
    for (const credential of [
      '',
      '   ',
      'chave com espaço',
      SECRET_MARKER + '\n',
    ]) {
      expect(() =>
        createAsaasHttpClient({
          credential,
          environment: 'sandbox',
          fetch: vi.fn<AsaasFetch>(),
        })
      ).toThrow(expect.objectContaining({ reason: 'MISSING_CREDENTIAL' }))
    }
    expect(() =>
      createAsaasHttpClient({
        credential: SECRET_MARKER,
        environment: 'homolog' as never,
      })
    ).toThrow(expect.objectContaining({ reason: 'INVALID_CONFIGURATION' }))
    const fake = createFakeAsaas()
    const client = createAsaasHttpClient({
      credential: new AsaasSecretValue(fake.rootApiKey),
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    await expect(
      client.request({ method: 'GET', path: '/customers' })
    ).resolves.toMatchObject({ object: 'list' })
  })
})

// -----------------------------------------------------------------------------------------------
// Dinheiro em Decimal
// -----------------------------------------------------------------------------------------------

describe('dinheiro: Decimal no módulo, number só na borda HTTP', () => {
  it('toAsaasAmount converte com 2 casas e recusa escala, sinal e perda de precisão', () => {
    expect(toAsaasAmount(new Prisma.Decimal('149.90'))).toBe(149.9)
    expect(toAsaasAmount(new Prisma.Decimal('0'))).toBe(0)
    expect(toAsaasAmount(new Prisma.Decimal('1234567.89'))).toBe(1234567.89)
    for (const bad of [
      '1.005',
      '-1',
      'NaN',
      'Infinity',
      '900719925474099.99',
    ]) {
      expect(() => toAsaasAmount(new Prisma.Decimal(bad))).toThrow(
        expect.objectContaining({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
      )
    }
  })

  it('fromAsaasAmount só aceita número JSON com até 2 casas', () => {
    expect(fromAsaasAmount(149.9).toFixed(2)).toBe('149.90')
    for (const bad of ['149.9', Number.NaN, 0.1 + 0.2, null])
      expect(() => fromAsaasAmount(bad)).toThrow(BillingProviderError)
  })

  it('sameAmount compara em Decimal e nunca confere valor inválido', () => {
    expect(sameAmount(149.9, new Prisma.Decimal('149.90'))).toBe(true)
    expect(sameAmount(149.9, '149.9')).toBe(true)
    expect(sameAmount(100, 100)).toBe(true)
    expect(sameAmount(149.91, new Prisma.Decimal('149.90'))).toBe(false)
    expect(sameAmount(0.1 + 0.2, '0.30')).toBe(false)
    expect(sameAmount(120, new Prisma.Decimal('120.001'))).toBe(false)
    expect(sameAmount(Number.NaN, 1)).toBe(false)
    expect(sameAmount(undefined, 1)).toBe(false)
    expect(toMoney('  10.50 ').equals('10.5')).toBe(true)
  })

  it('issuePayment compara o valor remoto em Decimal: 100.1 confere com Decimal("100.10")', async () => {
    const request = pixRequest({ amount: new Prisma.Decimal('100.10') })
    const remote: ProviderCharge = {
      id: 'pay-1',
      externalReference: request.reference,
      value: 100.1,
      billingType: 'PIX',
      status: 'PENDING',
    }
    const gateway = {
      find: vi.fn(async () => remote),
      create: vi.fn(),
      details: vi.fn(async () => ({ pixCode: 'code' })),
    }
    const { repository, state } = memoryIssuance(request, 'PROCESSING')
    await issuePayment(repository, gateway)
    expect(state.value).toBe('ISSUED')
    expect(repository.issued).toHaveBeenCalledWith('attempt-1', remote, {
      pixCode: 'code',
    })
    gateway.find.mockResolvedValue({ ...remote, value: 100.11 })
    const again = memoryIssuance(request, 'PROCESSING')
    await expect(
      issuePayment(again.repository, gateway)
    ).rejects.toBeInstanceOf(ReconciliationRequired)
    expect(again.state.value).toBe('UNKNOWN')
  })

  it('cancelAttempt compara o valor remoto em Decimal', async () => {
    const charge: ProviderCharge = {
      id: 'pay-old',
      externalReference: 'tenant:old',
      value: 100.1,
      billingType: 'BOLETO',
      status: 'PENDING',
    }
    let state: CancellationState = 'REQUESTED'
    const gateway = {
      get: vi.fn(async () => charge),
      cancel: vi.fn(async () => undefined),
    }
    await cancelAttempt(
      {
        load: async () => ({
          id: 'old',
          externalId: charge.id,
          reference: charge.externalReference,
          amount: new Prisma.Decimal('100.10'),
          state,
        }),
        claim: async () => {
          state = 'PROCESSING'
          return true
        },
        unknown: async () => {
          state = 'UNKNOWN'
        },
        release: async () => {
          state = 'REQUESTED'
        },
        confirmed: async () => {
          state = 'CONFIRMED'
        },
        paid: async () => undefined,
      },
      gateway
    )
    expect(state).toBe('CONFIRMED')
    expect(gateway.cancel).toHaveBeenCalledExactlyOnceWith('pay-old')
  })

  it('valor com mais de 2 casas é recusado antes da rede e da reserva', async () => {
    const gateway = { find: vi.fn(), create: vi.fn(), details: vi.fn() }
    const { repository, state } = memoryIssuance(
      pixRequest({ amount: new Prisma.Decimal('10.005') })
    )
    const error = await failure(issuePayment(repository, gateway))
    expect(error).toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
    expect(error).toBeInstanceOf(ChargeRequestRejected)
    expect(gateway.find).not.toHaveBeenCalled()
    expect(repository.claim).not.toHaveBeenCalled()
    expect(state.value).toBe('QUEUED')
  })

  it('o gateway envia o Decimal ao Asaas como número de 2 casas', async () => {
    const fake = createFakeAsaas()
    const gateway = createAsaasGateway({
      apiKey: fake.rootApiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    const charge = await gateway.create(
      pixRequest({ amount: new Prisma.Decimal('149.90') })
    )
    const post = fake.requests.find(
      (row) => row.method === 'POST' && row.path === '/payments'
    )!
    expect((post.body as Json).value).toBe(149.9)
    expect(sameAmount(charge.value, new Prisma.Decimal('149.90'))).toBe(true)
  })
})

// -----------------------------------------------------------------------------------------------
// CPF/CNPJ
// -----------------------------------------------------------------------------------------------

describe('CPF/CNPJ: o CNPJ alfanumérico chega intacto ao Asaas', () => {
  it('normalizeAsaasDocument tira só a máscara e preserva as letras em maiúsculas', () => {
    expect(
      normalizeAsaasDocument(SAMPLE_DOCUMENTS.alphanumericCnpjMasked)
    ).toBe('12ABC34501DE35')
    expect(normalizeAsaasDocument(' 12.abc.345/01de-35 ')).toBe(
      '12ABC34501DE35'
    )
    expect(normalizeAsaasDocument('123.456.789-09')).toBe('12345678909')
    expect(normalizeAsaasDocument('11.222.333/0001-81')).toBe('11222333000181')
    for (const bad of [
      '12ABC',
      'ABC45678909',
      '',
      '12ABC34501DEXY',
      '1234567890@',
    ]) {
      expect(() => normalizeAsaasDocument(bad)).toThrow(
        expect.objectContaining({ reason: 'INVALID_REQUEST' })
      )
    }
  })

  it('o gateway busca e cadastra o cliente com o CNPJ alfanumérico sem remover letras', async () => {
    const fake = createFakeAsaas()
    const gateway = createAsaasGateway({
      apiKey: fake.rootApiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    const request = pixRequest({
      customer: {
        name: 'Locadora Alfa',
        email: 'alfa@example.test',
        document: SAMPLE_DOCUMENTS.alphanumericCnpjMasked,
      },
    })
    await gateway.create(request)
    expect(
      fake.requests.find(
        (row) => row.method === 'GET' && row.path === '/customers'
      )!.query.cpfCnpj
    ).toBe('12ABC34501DE35')
    expect(
      (
        fake.requests.find(
          (row) => row.method === 'POST' && row.path === '/customers'
        )!.body as Json
      ).cpfCnpj
    ).toBe('12ABC34501DE35')
    fake.clearRecords()
    await gateway.create({
      ...request,
      reference: 'tenant-a:payment:2:initial',
    })
    expect(fake.countRequests('POST', '/customers')).toBe(0)
    expect(fake.countRequests('POST', '/payments')).toBe(1)
  })

  it('documento sem forma de CPF/CNPJ é recusado antes da reserva: a tentativa continua QUEUED', async () => {
    const fake = createFakeAsaas()
    const gateway = createAsaasGateway({
      apiKey: fake.rootApiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
    })
    const { repository, state } = memoryIssuance(
      pixRequest({
        customer: {
          name: 'X',
          email: 'x@example.test',
          document: 'CPF-INVALIDO',
        },
      })
    )
    const error = await failure(issuePayment(repository, gateway))
    expect(error).toMatchObject({ code: 'REJECTED', reason: 'INVALID_REQUEST' })
    expect(error).toBeInstanceOf(ChargeRequestRejected)
    expect(repository.claim).not.toHaveBeenCalled()
    expect(state.value).toBe('QUEUED')
    expect(fake.countRequests('POST', /.*/)).toBe(0)
  })
})

// -----------------------------------------------------------------------------------------------
// Criação de subconta
// -----------------------------------------------------------------------------------------------

describe('criação de subconta: apiKey e accessToken.apiKey', () => {
  it('aceita a chave no formato legado (apiKey)', () => {
    const account = parseAsaasAccountCreation(
      loadFixture('account-created.api-key')
    )
    expect(account).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      walletId: '00000000-0000-4000-9000-000000000001',
      credential: {
        source: 'apiKey',
        accessTokenId: null,
        expiresAt: null,
        expiresByLackOfUseAt: null,
      },
    })
    expect(account.credential!.apiKey.use((value) => value)).toBe(
      '$aact_hmlg_FAKE_SANITIZED_LEGACY_KEY_000000000001'
    )
  })

  it('aceita accessToken.apiKey com id e datas de expiração', () => {
    const account = parseAsaasAccountCreation(
      loadFixture('account-created.access-token')
    )
    expect(account.credential).toMatchObject({
      source: 'accessToken.apiKey',
      accessTokenId: '00000000-0000-4000-a000-000000000001',
      expiresAt: new Date('2027-01-15T00:00:00-03:00'),
      expiresByLackOfUseAt: new Date('2026-04-15T00:00:00-03:00'),
    })
    expect(account.credential!.apiKey.use((value) => value)).toBe(
      '$aact_hmlg_FAKE_SANITIZED_ACCESS_TOKEN_000000000001'
    )
  })

  it('a mesma chave nos dois lugares é aceita; chaves diferentes, id ausente ou chave malformada são recusados', () => {
    const body = loadFixture<Json>('account-created.access-token')
    const key = (body.accessToken as Json).apiKey
    expect(
      parseAsaasAccountCreation({ ...body, apiKey: key }).credential?.source
    ).toBe('accessToken.apiKey')
    expect(() =>
      parseAsaasAccountCreation({ ...body, apiKey: SECRET_MARKER })
    ).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }))
    expect(() => parseAsaasAccountCreation({ ...body, id: undefined })).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE' })
    )
    expect(() =>
      parseAsaasAccountCreation({ ...body, accessToken: { apiKey: 'curta' } })
    ).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }))
    expect(() =>
      parseAsaasAccountCreation({
        ...body,
        accessToken: { apiKey: 'chave com espaço e comprida' },
      })
    ).toThrow(BillingProviderError)
    const { accessToken: _dropped, ...withoutKey } = body
    expect(parseAsaasAccountCreation(withoutKey)).toEqual({
      id: body.id,
      walletId: body.walletId,
      credential: null,
    })
  })

  it('a chave nunca aparece em JSON, String, template ou inspect', () => {
    const account = parseAsaasAccountCreation({
      ...loadFixture<Json>('account-created.api-key'),
      apiKey: SECRET_MARKER,
    })
    const text = [
      JSON.stringify(account),
      String(account.credential!.apiKey),
      `${account.credential!.apiKey}`,
      inspect(account, { depth: 10 }),
    ].join('\n')
    expect(text).not.toContain(SECRET_MARKER)
    expect(text).toContain(REDACTED)
  })

  it.each(['apiKey', 'accessToken'] as const)(
    'contra o dublê no formato %s: a chave devolvida autentica só a subconta',
    async (format) => {
      const fake = createFakeAsaas({ accountKeyFormat: format })
      const account = parseAsaasAccountCreation(
        await rootClient(fake).request({
          method: 'POST',
          path: '/accounts',
          body: subaccountBody(),
        })
      )
      expect(account.credential!.source).toBe(
        format === 'apiKey' ? 'apiKey' : 'accessToken.apiKey'
      )
      const sub = createAsaasHttpClient({
        credential: account.credential!.apiKey,
        environment: 'sandbox',
        fetch: fake.fetch,
      })
      expect(
        parseAsaasAccountStatus(
          await sub.request({ method: 'GET', path: '/myAccount/status' })
        )
      ).toEqual({
        id: account.id,
        commercialInfo: 'PENDING',
        bankAccountInfo: 'PENDING',
        documentation: 'PENDING',
        general: 'PENDING',
      })
      expect(fake.requests.at(-1)!.accountId).toBe(account.id)
    }
  )
})

// -----------------------------------------------------------------------------------------------
// Eventos tipados
// -----------------------------------------------------------------------------------------------

describe('eventos do Asaas tipados', () => {
  const envelope = {
    id: 'evt_000000000001',
    dateCreated: '2026-01-20 10:00:00',
  }

  it('PAYMENT_*: recurso tipado com valores em Decimal e data em Brasília', () => {
    const parsed = parseAsaasEvent({
      ...envelope,
      event: 'PAYMENT_RECEIVED',
      payment: loadFixture('payment'),
    })
    expect(parsed).toMatchObject({
      ok: true,
      event: {
        category: 'PAYMENT',
        type: 'PAYMENT_RECEIVED',
        id: 'evt_000000000001',
        createdAt: new Date('2026-01-20T13:00:00Z'),
        payment: {
          id: 'pay_000000000001',
          status: 'PENDING',
          billingType: 'PIX',
          deleted: false,
        },
      },
    })
    if (!parsed.ok || parsed.event.category !== 'PAYMENT')
      throw new Error('unexpected')
    expect(parsed.event.payment.value?.toFixed(2)).toBe('149.90')
    expect(parsed.event.payment.value).toBeInstanceOf(Prisma.Decimal)
  })

  it('SUBSCRIPTION_*, ACCOUNT_STATUS_*, ACCESS_TOKEN_* e eventos desconhecidos', () => {
    expect(
      parseAsaasEvent({
        ...envelope,
        event: 'SUBSCRIPTION_INACTIVATED',
        subscription: loadFixture('subscription'),
      })
    ).toMatchObject({
      ok: true,
      event: {
        category: 'SUBSCRIPTION',
        subscription: { id: 'sub_000000000001', cycle: 'MONTHLY' },
      },
    })
    expect(
      parseAsaasEvent({
        ...envelope,
        event: 'ACCOUNT_STATUS_DOCUMENT_REJECTED',
        accountStatus: loadFixture('account-status'),
        account: { id: 'acc-1' },
      })
    ).toMatchObject({
      ok: true,
      event: {
        category: 'ACCOUNT_STATUS',
        change: { field: 'documentation', status: 'REJECTED' },
        account: { id: 'acc-1' },
      },
    })
    const token = parseAsaasEvent({
      ...envelope,
      event: 'ACCESS_TOKEN_EXPIRING_SOON',
      accessToken: {
        id: 'tok-1',
        name: 'principal',
        enabled: true,
        expirationDate: '2026-12-31 23:59:59',
        apiKey: SECRET_MARKER,
      },
    })
    expect(token).toMatchObject({
      ok: true,
      event: {
        category: 'ACCESS_TOKEN',
        accessToken: {
          id: 'tok-1',
          enabled: true,
          expiresAt: new Date('2027-01-01T02:59:59Z'),
        },
      },
    })
    expect(JSON.stringify(token)).not.toContain(SECRET_MARKER)
    expect(
      parseAsaasEvent({ ...envelope, event: 'TRANSFER_DONE' })
    ).toMatchObject({
      ok: true,
      event: { category: 'OTHER', type: 'TRANSFER_DONE' },
    })
    expect(
      parseAsaasEvent({
        event: 'PAYMENT_SOMETHING_NEW',
        payment: { id: 'pay_9' },
      })
    ).toMatchObject({
      ok: true,
      event: {
        category: 'PAYMENT',
        id: null,
        payment: { id: 'pay_9', value: null },
      },
    })
    expect(isKnownAsaasEvent('PAYMENT_SOMETHING_NEW')).toBe(false)
    expect(isKnownAsaasEvent('PAYMENT_RECEIVED')).toBe(true)
  })

  it('recusas: não objeto, sem tipo, sem recurso e valor inválido', () => {
    expect(parseAsaasEvent(null)).toEqual({
      ok: false,
      reason: 'NOT_AN_OBJECT',
    })
    expect(parseAsaasEvent({ payment: { id: 'pay_1' } })).toEqual({
      ok: false,
      reason: 'MISSING_EVENT_TYPE',
    })
    expect(parseAsaasEvent({ event: 'payment received' })).toEqual({
      ok: false,
      reason: 'MISSING_EVENT_TYPE',
    })
    expect(parseAsaasEvent({ event: 'PAYMENT_RECEIVED' })).toEqual({
      ok: false,
      reason: 'MISSING_RESOURCE',
    })
    expect(
      parseAsaasEvent({ event: 'SUBSCRIPTION_CREATED', subscription: {} })
    ).toEqual({ ok: false, reason: 'MISSING_RESOURCE' })
    for (const value of ['10', 0.1 + 0.2, Number.POSITIVE_INFINITY]) {
      expect(
        parseAsaasEvent({
          event: 'PAYMENT_RECEIVED',
          payment: { id: 'pay_1', value },
        })
      ).toEqual({ ok: false, reason: 'INVALID_RESOURCE' })
    }
  })

  it('leitura legada do webhook devolve o valor em Decimal e datas do Asaas são estritas', () => {
    expect(
      parseAsaasWebhook({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_1', status: 'RECEIVED', value: 149.9 },
      }).amount?.toFixed(2)
    ).toBe('149.90')
    expect(
      parseAsaasWebhook({
        payment: { id: 'pay_1', status: 'RECEIVED', value: 0.1 + 0.2 },
      }).amount
    ).toBeUndefined()
    expect(parseAsaasDate('2026-01-20')).toEqual(
      new Date('2026-01-20T03:00:00Z')
    )
    // Pago em 20/01 (data civil de São Paulo): nunca 19/01 às 21h, que é o que meia-noite UTC daria.
    expect(
      parseAsaasWebhook({
        payment: { id: 'pay_1', status: 'RECEIVED', paymentDate: '2026-01-20' },
      }).paidAt
    ).toEqual(new Date('2026-01-20T03:00:00Z'))
    expect(
      parseAsaasWebhook({
        payment: {
          id: 'pay_1',
          status: 'RECEIVED',
          paymentDate: '2026-01-21',
          clientPaymentDate: '2026-01-20',
        },
      }).paidAt
    ).toEqual(new Date('2026-01-20T03:00:00Z'))
    expect(
      parseAsaasWebhook({
        payment: {
          id: 'pay_1',
          status: 'RECEIVED',
          paymentDate: '2026-01-20 23:30:00',
        },
      }).paidAt
    ).toEqual(new Date('2026-01-21T02:30:00Z'))
    // Data que o Asaas não usa (ou impossível) não vira pagamento em outro dia: fica sem data.
    for (const bad of ['2026-02-31', '2026-01-20T10:00:00', 'amanhã'])
      expect(
        parseAsaasWebhook({
          payment: { id: 'pay_1', status: 'RECEIVED', paymentDate: bad },
        }).paidAt
      ).toBeUndefined()
    expect(parseAsaasDate('2026-01-20T10:00:00Z')).toEqual(
      new Date('2026-01-20T10:00:00Z')
    )
    for (const bad of [
      '2026-02-31',
      '2026-02-31 10:00:00',
      '20/01/2026',
      'amanhã',
      42,
    ])
      expect(parseAsaasDate(bad)).toBeNull()
    expect(
      parseAsaasAccountStatus({
        general: 'NOVO_STATUS',
        commercialInfo: 'APPROVED',
      })
    ).toMatchObject({
      general: 'UNKNOWN',
      commercialInfo: 'APPROVED',
      documentation: null,
    })
    expect(() => parseAsaasAccountStatus([])).toThrow(
      expect.objectContaining({ code: 'INVALID_RESPONSE' })
    )
  })
})

// -----------------------------------------------------------------------------------------------
// Cobrança fim a fim contra o dublê
// -----------------------------------------------------------------------------------------------

describe('cobrança contra o dublê: incerteza nunca repete POST', () => {
  function setup() {
    const fake = createFakeAsaas()
    const gateway = createAsaasGateway({
      apiKey: fake.rootApiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
      timeoutMs: 50,
    })
    return { fake, gateway }
  }

  it('POST aplicado com resposta perdida: UNKNOWN, e a próxima execução concilia pela busca sem segundo POST', async () => {
    const { fake, gateway } = setup()
    fake.inject({
      method: 'POST',
      path: '/payments',
      fault: { kind: 'apply-then-timeout' },
    })
    const { repository, state } = memoryIssuance(pixRequest())
    expect(await failure(issuePayment(repository, gateway))).toMatchObject({
      reason: 'TIMEOUT',
      maybeApplied: true,
    })
    expect(state.value).toBe('UNKNOWN')
    await issuePayment(repository, gateway)
    expect(state.value).toBe('ISSUED')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
  })

  it('429 na busca do cliente depois da reserva: nada foi criado, a tentativa volta a QUEUED e a próxima rodada emite uma vez', async () => {
    const { fake, gateway } = setup()
    fake.inject({
      method: 'GET',
      path: '/customers',
      fault: { kind: 'status', status: 429 },
    })
    const { repository, state } = memoryIssuance(pixRequest())
    expect(await failure(issuePayment(repository, gateway))).toMatchObject({
      reason: 'RATE_LIMITED',
      maybeApplied: false,
    })
    expect(repository.claim).toHaveBeenCalledTimes(1)
    expect(state.value).toBe('QUEUED')
    expect(repository.unknown).not.toHaveBeenCalled()
    expect(fake.countRequests('POST', '/payments')).toBe(0)
    await issuePayment(repository, gateway)
    expect(state.value).toBe('ISSUED')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
  })

  // Achado 15: o que decide entre voltar à fila e UNKNOWN é só `maybeApplied`. Uma leitura (GET)
  // que falha não escreveu nada; a resposta estragada do POST /payments já aplicado no Asaas pode
  // ter criado a cobrança — inclusive quando o JSON chega legível mas com forma inesperada.
  // Achado 102: o `maybeApplied` do `create` fala da COBRANÇA. O POST /customers estragado pode ter
  // cadastrado o cliente (idempotente: a próxima tentativa o acha pelo CPF/CNPJ), mas nenhuma
  // cobrança foi enviada: `maybeApplied=false`, e a tentativa volta à fila em vez de ficar UNKNOWN.
  it.each<
    [
      string,
      string,
      string,
      'MALFORMED_BODY' | 'UNEXPECTED_SHAPE',
      boolean,
      FakeFault,
    ]
  >([
    [
      'GET',
      '/customers',
      'corpo ilegível',
      'MALFORMED_BODY',
      false,
      { kind: 'body', body: '<html>manutenção</html>' },
    ],
    [
      'GET',
      '/customers',
      'forma inesperada',
      'UNEXPECTED_SHAPE',
      false,
      { kind: 'body', body: { data: 'x' } },
    ],
    [
      'POST',
      '/customers',
      'corpo ilegível',
      'MALFORMED_BODY',
      false,
      { kind: 'body', body: '<html>', apply: true },
    ],
    [
      'POST',
      '/customers',
      'forma inesperada',
      'UNEXPECTED_SHAPE',
      false,
      { kind: 'body', body: { object: 'customer' }, apply: true },
    ],
    [
      'POST',
      '/payments',
      'corpo ilegível',
      'MALFORMED_BODY',
      true,
      { kind: 'body', body: '<html>', apply: true },
    ],
    [
      'POST',
      '/payments',
      'forma inesperada',
      'UNEXPECTED_SHAPE',
      true,
      { kind: 'body', body: { id: 1 }, apply: true },
    ],
  ])(
    'gateway.create: %s %s com %s → %s, maybeApplied=%s',
    async (method, path, _label, reason, maybeApplied, fault) => {
      const { fake, gateway } = setup()
      fake.inject({ method, path, fault })
      expect(await failure(gateway.create(pixRequest()))).toMatchObject({
        code: 'INVALID_RESPONSE',
        reason,
        maybeApplied,
      })
    }
  )

  it.each<[string, 'MALFORMED_BODY' | 'UNEXPECTED_SHAPE', boolean, FakeFault]>([
    [
      'GET com forma inesperada',
      'UNEXPECTED_SHAPE',
      false,
      { kind: 'body', body: { id: 1 } },
    ],
    [
      'DELETE aplicado com corpo ilegível',
      'MALFORMED_BODY',
      true,
      { kind: 'body', body: '<html>', apply: true },
    ],
    [
      'DELETE aplicado com forma inesperada',
      'UNEXPECTED_SHAPE',
      true,
      { kind: 'body', body: { deleted: false }, apply: true },
    ],
  ])(
    'gateway de cancelamento: %s → %s, maybeApplied=%s',
    async (label, reason, maybeApplied, fault) => {
      const { fake, gateway } = setup()
      const charge = await gateway.create(
        pixRequest({ method: 'BOLETO', reference: 'tenant-a:boleto:1' })
      )
      fake.inject({
        method: label.startsWith('GET') ? 'GET' : 'DELETE',
        path: '/payments/' + charge.id,
        fault,
      })
      const call = label.startsWith('GET')
        ? gateway.get(charge.id)
        : gateway.cancel(charge.id)
      expect(await failure(call)).toMatchObject({
        code: 'INVALID_RESPONSE',
        reason,
        maybeApplied,
      })
    }
  )

  it.each<[string, unknown]>([
    ['corpo ilegível', '<html>manutenção</html>'],
    ['forma inesperada', { data: 'x' }],
  ])(
    'GET /customers 200 com %s depois da reserva: nada foi escrito, a tentativa volta a QUEUED e a próxima rodada emite uma vez',
    async (_label, body) => {
      const { fake, gateway } = setup()
      fake.inject({
        method: 'GET',
        path: '/customers',
        fault: { kind: 'body', body },
      })
      const { repository, state } = memoryIssuance(pixRequest())
      expect(await failure(issuePayment(repository, gateway))).toMatchObject({
        code: 'INVALID_RESPONSE',
        maybeApplied: false,
      })
      expect(repository.release).toHaveBeenCalledTimes(1)
      expect(repository.unknown).not.toHaveBeenCalled()
      expect(state.value).toBe('QUEUED')
      expect(fake.countRequests('POST', /.*/)).toBe(0)
      await issuePayment(repository, gateway)
      expect(state.value).toBe('ISSUED')
      expect(fake.countRequests('POST', '/payments')).toBe(1)
    }
  )

  it.each<[string, unknown]>([
    ['corpo ilegível', '<html>'],
    ['forma inesperada', { id: 1 }],
  ])(
    'POST /payments aplicado com resposta de %s: UNKNOWN (nunca volta à fila) e a próxima execução concilia pela busca sem segundo POST',
    async (_label, body) => {
      const { fake, gateway } = setup()
      fake.inject({
        method: 'POST',
        path: '/payments',
        fault: { kind: 'body', body, apply: true },
      })
      const { repository, state } = memoryIssuance(pixRequest())
      expect(await failure(issuePayment(repository, gateway))).toMatchObject({
        code: 'INVALID_RESPONSE',
        maybeApplied: true,
      })
      expect(repository.release).not.toHaveBeenCalled()
      expect(state.value).toBe('UNKNOWN')
      await issuePayment(repository, gateway)
      expect(state.value).toBe('ISSUED')
      expect(fake.countRequests('POST', '/payments')).toBe(1)
    }
  )

  it.each<[string, unknown]>([
    ['corpo ilegível', '<html>'],
    ['forma inesperada', { deleted: false }],
  ])(
    'DELETE aplicado com resposta de %s: UNKNOWN (nunca volta a REQUESTED) e a próxima execução confirma pela leitura sem outro DELETE',
    async (_label, body) => {
      const { fake, gateway } = setup()
      const charge = await gateway.create(
        pixRequest({ method: 'BOLETO', reference: 'tenant-a:boleto:1' })
      )
      let state: CancellationState = 'REQUESTED'
      const repository = {
        load: async () => ({
          id: 'old',
          externalId: charge.id,
          reference: 'tenant-a:boleto:1',
          amount: new Prisma.Decimal('149.90'),
          state,
        }),
        claim: async () => {
          if (state !== 'REQUESTED') return false
          state = 'PROCESSING'
          return true
        },
        unknown: async () => {
          state = 'UNKNOWN'
        },
        release: vi.fn(async () => {
          if (state === 'PROCESSING') state = 'REQUESTED'
        }),
        confirmed: vi.fn(async () => {
          state = 'CONFIRMED'
        }),
        paid: vi.fn(),
      }
      fake.inject({
        method: 'DELETE',
        path: '/payments/' + charge.id,
        fault: { kind: 'body', body, apply: true },
      })
      expect(await failure(cancelAttempt(repository, gateway))).toMatchObject({
        code: 'INVALID_RESPONSE',
        maybeApplied: true,
      })
      expect(repository.release).not.toHaveBeenCalled()
      expect(state).toBe('UNKNOWN')
      await cancelAttempt(repository, gateway)
      expect(state).toBe('CONFIRMED')
      expect(fake.countRequests('DELETE', '/payments/' + charge.id)).toBe(1)
    }
  )

  it('POST sem resposta e sem cobrança remota: ReconciliationRequired, nunca outro POST', async () => {
    const { fake, gateway } = setup()
    fake.inject({
      method: 'POST',
      path: '/payments',
      fault: { kind: 'timeout' },
    })
    const { repository, state } = memoryIssuance(pixRequest())
    await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
      BillingProviderError
    )
    await expect(issuePayment(repository, gateway)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(state.value).toBe('UNKNOWN')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
  })

  it('cancelamento: 404 não prova remoção; depois, um único DELETE confirmado', async () => {
    const { fake, gateway } = setup()
    const charge = await gateway.create(
      pixRequest({ method: 'BOLETO', reference: 'tenant-a:boleto:1' })
    )
    let state: CancellationState = 'REQUESTED'
    const repository = {
      load: async () => ({
        id: 'old',
        externalId: charge.id,
        reference: 'tenant-a:boleto:1',
        amount: new Prisma.Decimal('149.90'),
        state,
      }),
      claim: async () => {
        if (state !== 'REQUESTED') return false
        state = 'PROCESSING'
        return true
      },
      unknown: async () => {
        state = 'UNKNOWN'
      },
      release: async () => {
        if (state === 'PROCESSING') state = 'REQUESTED'
      },
      confirmed: vi.fn(async () => {
        state = 'CONFIRMED'
      }),
      paid: vi.fn(),
    }
    fake.inject({
      method: 'GET',
      path: '/payments/' + charge.id,
      fault: { kind: 'status', status: 404 },
    })
    expect(await failure(cancelAttempt(repository, gateway))).toMatchObject({
      reason: 'NOT_FOUND',
    })
    expect(repository.confirmed).not.toHaveBeenCalled()
    await cancelAttempt(repository, gateway)
    expect(state).toBe('CONFIRMED')
    expect(fake.countRequests('DELETE', '/payments/' + charge.id)).toBe(1)
  })

  it('com o interruptor ligado a tentativa não sai de QUEUED e nada chega ao Asaas', async () => {
    vi.stubEnv('PLATFORM_ASAAS_OUTBOUND_DISABLED', 'true')
    const { fake, gateway } = setup()
    const { repository, state } = memoryIssuance(pixRequest())
    expect(await failure(issuePayment(repository, gateway))).toMatchObject({
      reason: 'OUTBOUND_DISABLED',
    })
    expect(repository.claim).not.toHaveBeenCalled()
    expect(state.value).toBe('QUEUED')
    expect(fake.requests).toHaveLength(0)
  })
})

// -----------------------------------------------------------------------------------------------
// Achado 102: falha antes do POST /payments e conciliação das tentativas UNKNOWN
// -----------------------------------------------------------------------------------------------

describe('achado 102: falha no cliente nunca deixa a cobrança incerta; a UNKNOWN concilia pela referência', () => {
  const REFERENCE = 'tenant-a:payment:1:initial'
  function setup() {
    const clock = { now: new Date('2026-09-26T12:00:00Z') }
    const fake = createFakeAsaas({ now: () => clock.now })
    const gateway = createAsaasGateway({
      apiKey: fake.rootApiKey,
      environment: 'sandbox',
      fetch: fake.fetch,
      timeoutMs: 50,
    })
    const now = () => clock.now
    const later = (ms: number) => {
      clock.now = new Date(clock.now.getTime() + ms)
    }
    return { fake, gateway, now, later }
  }
  async function customersOf(fake: FakeAsaas) {
    const page = await rootClient(fake).request({
      method: 'GET',
      path: '/customers',
      query: { cpfCnpj: normalizeAsaasDocument(SAMPLE_DOCUMENTS.cpf) },
    })
    return (page as { data: Json[] }).data
  }
  async function chargesOf(fake: FakeAsaas) {
    const page = await rootClient(fake).request({
      method: 'GET',
      path: '/payments',
      query: { externalReference: REFERENCE },
    })
    return (page as { data: Json[] }).data
  }

  it.each<[string, FakeFault, string, boolean]>([
    ['503', { kind: 'status', status: 503 }, 'PROVIDER_ERROR', false],
    ['timeout sem resposta', { kind: 'timeout' }, 'TIMEOUT', false],
    ['queda de rede', { kind: 'network' }, 'NETWORK', false],
    [
      'aplicado e resposta perdida',
      { kind: 'apply-then-timeout' },
      'TIMEOUT',
      true,
    ],
    [
      'aplicado com corpo ilegível',
      { kind: 'body', body: '<html>', apply: true },
      'MALFORMED_BODY',
      true,
    ],
    [
      'aplicado com forma inesperada',
      { kind: 'body', body: { object: 'customer' }, apply: true },
      'UNEXPECTED_SHAPE',
      true,
    ],
  ])(
    'POST /customers %s depois da reserva: nenhuma cobrança saiu, a tentativa volta a QUEUED e a próxima rodada emite uma vez, com um cliente só',
    async (_label, fault, reason, applied) => {
      const { fake, gateway } = setup()
      fake.inject({ method: 'POST', path: '/customers', fault })
      const { repository, state } = memoryIssuance(pixRequest())
      expect(await failure(issuePayment(repository, gateway))).toMatchObject({
        reason,
        maybeApplied: false,
      })
      expect(repository.release).toHaveBeenCalledExactlyOnceWith('attempt-1')
      expect(repository.unknown).not.toHaveBeenCalled()
      expect(state.value).toBe('QUEUED')
      expect(fake.countRequests('POST', '/payments')).toBe(0)
      await issuePayment(repository, gateway)
      expect(state.value).toBe('ISSUED')
      expect(fake.countRequests('POST', '/payments')).toBe(1)
      // O cadastro aplicado é achado pela busca por CPF/CNPJ na rodada seguinte: nunca um segundo cliente.
      expect(fake.countRequests('POST', '/customers')).toBe(applied ? 1 : 2)
      expect(await customersOf(fake)).toHaveLength(1)
    }
  )

  it('UNKNOWN sem cobrança no Asaas: dentro da janela nada acontece; depois dela volta a QUEUED e emite uma vez', async () => {
    const { fake, gateway, now, later } = setup()
    fake.inject({
      method: 'POST',
      path: '/payments',
      fault: { kind: 'status', status: 503 },
    })
    const { repository, state } = memoryIssuance(pixRequest(), 'QUEUED', {
      now,
    })
    expect(await failure(issuePayment(repository, gateway, now))).toMatchObject(
      { reason: 'PROVIDER_ERROR', maybeApplied: true }
    )
    expect(state.value).toBe('UNKNOWN')
    // Dentro da janela a busca vazia não prova nada: nenhum POST às cegas.
    later(UNKNOWN_ISSUANCE_SETTLE_MS - 1)
    await expect(issuePayment(repository, gateway, now)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(repository.requeue).not.toHaveBeenCalled()
    expect(fake.countRequests('POST', '/payments')).toBe(1)
    later(1)
    await issuePayment(repository, gateway, now)
    expect(repository.requeue).toHaveBeenCalledExactlyOnceWith('attempt-1')
    expect(state.value).toBe('ISSUED')
    expect(fake.countRequests('POST', '/payments')).toBe(2)
    expect(await chargesOf(fake)).toHaveLength(1)
  })

  it('UNKNOWN com a cobrança que o POST incerto criou: depois da janela vincula pela referência, sem outro POST', async () => {
    const { fake, gateway, now, later } = setup()
    fake.inject({
      method: 'POST',
      path: '/payments',
      fault: { kind: 'apply-then-timeout' },
    })
    const { repository, state } = memoryIssuance(pixRequest(), 'QUEUED', {
      now,
    })
    expect(await failure(issuePayment(repository, gateway, now))).toMatchObject(
      { reason: 'TIMEOUT', maybeApplied: true }
    )
    expect(state.value).toBe('UNKNOWN')
    later(2 * UNKNOWN_ISSUANCE_SETTLE_MS)
    await issuePayment(repository, gateway, now)
    const [created] = await chargesOf(fake)
    expect(state.value).toBe('ISSUED')
    expect(repository.issued).toHaveBeenCalledWith(
      'attempt-1',
      expect.objectContaining({ id: created!.id }),
      expect.anything()
    )
    expect(repository.requeue).not.toHaveBeenCalled()
    expect(fake.countRequests('POST', '/payments')).toBe(1)
  })

  it('UNKNOWN com cobrança divergente na referência: continua UNKNOWN depois da janela e nada é enviado', async () => {
    const { fake, gateway, now, later } = setup()
    // Cobrança com a referência da tentativa, mas outro valor.
    const customer = (await rootClient(fake).request({
      method: 'POST',
      path: '/customers',
      body: { name: 'Cliente', cpfCnpj: SAMPLE_DOCUMENTS.cpf },
    })) as Json
    await rootClient(fake).request({
      method: 'POST',
      path: '/payments',
      body: {
        customer: customer.id,
        billingType: 'PIX',
        value: 99.9,
        dueDate: FUTURE_DUE_DATE,
        externalReference: REFERENCE,
      },
    })
    const { repository, state } = memoryIssuance(pixRequest(), 'UNKNOWN', {
      now,
    })
    later(UNKNOWN_ISSUANCE_SETTLE_MS)
    fake.clearRecords()
    await expect(issuePayment(repository, gateway, now)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(state.value).toBe('UNKNOWN')
    expect(repository.requeue).not.toHaveBeenCalled()
    expect(repository.issued).not.toHaveBeenCalled()
    expect(fake.countRequests('POST', /.*/)).toBe(0)
  })

  // Achado 116: o processo que reservou a tentativa morreu antes de gravar o desfecho do POST.
  it('PROCESSING abandonada sem cobrança no Asaas: dentro da janela nada; depois dela volta a QUEUED e emite uma vez', async () => {
    const { fake, gateway, now, later } = setup()
    const { repository, state } = memoryIssuance(pixRequest(), 'PROCESSING', {
      now,
    })
    later(UNKNOWN_ISSUANCE_SETTLE_MS - 1)
    await expect(issuePayment(repository, gateway, now)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(repository.requeue).not.toHaveBeenCalled()
    expect(state.value).toBe('PROCESSING')
    expect(fake.countRequests('POST', /.*/)).toBe(0)
    later(1)
    await issuePayment(repository, gateway, now)
    expect(repository.requeue).toHaveBeenCalledExactlyOnceWith('attempt-1')
    expect(state.value).toBe('ISSUED')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
    expect(await chargesOf(fake)).toHaveLength(1)
  })

  it('a volta à fila recusada (a tentativa mudou desde a leitura) não reserva nem emite', async () => {
    const { fake, gateway, now, later } = setup()
    const { repository, state } = memoryIssuance(pixRequest(), 'UNKNOWN', {
      now,
    })
    repository.requeue.mockResolvedValueOnce(false)
    later(UNKNOWN_ISSUANCE_SETTLE_MS)
    await expect(issuePayment(repository, gateway, now)).rejects.toBeInstanceOf(
      ReconciliationRequired
    )
    expect(repository.claim).not.toHaveBeenCalled()
    expect(state.value).toBe('UNKNOWN')
    expect(fake.countRequests('POST', /.*/)).toBe(0)
  })

  // Achado 116, segunda rodada: o Asaas recusa o próprio pedido (400). Repetir dá sempre a mesma
  // recusa: a tentativa encerra, sem voltar à fila (religação eterna) nem ficar incerta.
  it('POST /payments recusado pelo Asaas (vencimento no passado, 400): a tentativa encerra com os códigos do Asaas, sem voltar à fila', async () => {
    const { fake, gateway, now } = setup()
    const { repository, state } = memoryIssuance(
      pixRequest({ dueDate: '2026-09-01' }),
      'QUEUED',
      { now }
    )
    const error = await failure(issuePayment(repository, gateway, now))
    expect(error).toMatchObject({
      code: 'REJECTED',
      reason: 'VALIDATION',
      status: 400,
      providerCodes: ['invalid_dueDate'],
      maybeApplied: false,
    })
    expect(error).toBeInstanceOf(ChargeRequestRejected)
    expect(isRejectedRequest(error)).toBe(true)
    expect(repository.reject).toHaveBeenCalledExactlyOnceWith(
      'attempt-1',
      error
    )
    expect(repository.release).not.toHaveBeenCalled()
    expect(repository.unknown).not.toHaveBeenCalled()
    expect(state.value).toBe('FAILED')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
    expect(await chargesOf(fake)).toEqual([])
  })

  // Achado 125: o 400 de uma LEITURA não é recusa do pedido. Depois do POST aceito a cobrança existe
  // no Asaas; tratada como recusa definitiva, ficava no Asaas sem vínculo para sempre.
  const READ_REJECTION: FakeFault = {
    kind: 'status',
    status: 400,
    body: { errors: [{ code: 'invalid_action', description: 'x' }] },
  }
  it.each<['PIX' | 'BOLETO', RegExp]>([
    ['PIX', /\/pixQrCode$/],
    ['BOLETO', /\/identificationField$/],
  ])(
    '%s: 400 nos dados da cobrança depois do POST aceito é passageiro; a rodada seguinte acha a cobrança pela referência e vincula, sem outro POST',
    async (method, path) => {
      const { fake, gateway, now } = setup()
      const { repository, state } = memoryIssuance(
        pixRequest({ method }),
        'QUEUED',
        { now }
      )
      fake.inject({ method: 'GET', path, fault: READ_REJECTION })
      const error = await failure(issuePayment(repository, gateway, now))
      expect(error).toMatchObject({
        code: 'REJECTED',
        reason: 'VALIDATION',
        status: 400,
        providerCodes: ['invalid_action'],
      })
      expect(error).not.toBeInstanceOf(ChargeRequestRejected)
      expect(repository.reject).not.toHaveBeenCalled()
      expect(repository.release).not.toHaveBeenCalled()
      expect(repository.unknown).not.toHaveBeenCalled()
      expect(state.value).toBe('PROCESSING')
      const [created] = await chargesOf(fake)
      expect(created).toMatchObject({
        billingType: method,
        externalReference: REFERENCE,
      })
      await issuePayment(repository, gateway, now)
      expect(state.value).toBe('ISSUED')
      expect(repository.issued).toHaveBeenCalledTimes(1)
      expect(repository.issued.mock.calls[0]![1]).toMatchObject({
        id: created!.id,
      })
      expect(fake.countRequests('POST', '/payments')).toBe(1)
      expect(await chargesOf(fake)).toHaveLength(1)
    }
  )

  it('400 na busca pela referência na conciliação do UNKNOWN é passageiro: o episódio continua UNKNOWN e a rodada seguinte concilia e emite uma vez', async () => {
    const { fake, gateway, now, later } = setup()
    const { repository, state } = memoryIssuance(pixRequest(), 'UNKNOWN', {
      now,
    })
    later(UNKNOWN_ISSUANCE_SETTLE_MS)
    fake.inject({ method: 'GET', path: '/payments', fault: READ_REJECTION })
    const error = await failure(issuePayment(repository, gateway, now))
    expect(error).toMatchObject({
      code: 'REJECTED',
      reason: 'VALIDATION',
      status: 400,
    })
    expect(error).not.toBeInstanceOf(ChargeRequestRejected)
    expect(repository.requeue).not.toHaveBeenCalled()
    expect(repository.claim).not.toHaveBeenCalled()
    expect(state.value).toBe('UNKNOWN')
    await issuePayment(repository, gateway, now)
    expect(repository.requeue).toHaveBeenCalledExactlyOnceWith('attempt-1')
    expect(state.value).toBe('ISSUED')
    expect(fake.countRequests('POST', '/payments')).toBe(1)
    expect(await chargesOf(fake)).toHaveLength(1)
  })

  it('só a recusa do próprio pedido é definitiva: 401, 403, 404, 429, 5xx e o interruptor continuam passageiros', () => {
    expect(
      isRejectedRequest(
        new BillingProviderError('REJECTED', {
          reason: 'VALIDATION',
          status: 400,
        })
      )
    ).toBe(true)
    expect(
      isRejectedRequest(
        new BillingProviderError('REJECTED', { reason: 'INVALID_REQUEST' })
      )
    ).toBe(true)
    for (const passing of [
      new BillingProviderError('REJECTED', {
        reason: 'AUTHENTICATION',
        status: 401,
      }),
      new BillingProviderError('REJECTED', {
        reason: 'FORBIDDEN',
        status: 403,
      }),
      new BillingProviderError('REJECTED', {
        reason: 'NOT_FOUND',
        status: 404,
      }),
      new BillingProviderError('REJECTED', {
        reason: 'CLIENT_ERROR',
        status: 409,
      }),
      new BillingProviderError('UNAVAILABLE', {
        reason: 'RATE_LIMITED',
        status: 429,
      }),
      new BillingProviderError('UNAVAILABLE', {
        reason: 'PROVIDER_ERROR',
        status: 503,
      }),
      new BillingProviderError('UNAVAILABLE', { reason: 'OUTBOUND_DISABLED' }),
      new BillingProviderError('AMBIGUOUS', { reason: 'AMBIGUOUS_MATCH' }),
      // Recusa que pode ter sido aplicada nunca é recusa provada.
      new BillingProviderError('REJECTED', {
        reason: 'VALIDATION',
        status: 400,
        maybeApplied: true,
      }),
      new Error('REJECTED'),
    ])
      expect(isRejectedRequest(passing)).toBe(false)
  })
})
