import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import {
  CreatePaymentAccountResponseSchema,
  PaymentAccountCreationOfferSchema,
  PaymentAccountResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import {
  ENTITLEMENT_FEATURES,
  PaymentAccountNotReadyErrorSchema,
} from '@gb-locacoes/contracts/entitlements'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { FakeAsaas } from '../helpers/fake-asaas'
import { signInParityUser } from './identity'
import { requestWeb, startWebConsumer } from './web-consumer'
import { startReceivingAccountFixture } from './receiving-account'
import { legacyRunning, otherTarget } from './targets'

/**
 * Wave 134 (S9): the owner's request of the receiving account through the compiled proxy to both API hosts, with
 * the creation on, the paid first invoice required, the subscription gate on and the Asaas contract double behind
 * the loopback provider. The two crons create the account; the charge barrier holds until approval.
 */
const original = inject('apiParity')
const fake = new FakeAsaas()
const CRON = 'synthetic-receiving-create-cron'
const endpoint = '/api/admin/payment-account/create'
const appOrigin = 'https://app.platform.test'
const income = '98765.43'
// The declared mobile phone (a marker) differs from the company phone that the offer may suggest.
const phone = '21976543210'
const companyPhone = '11912345678'
let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>
let scope: ReturnType<typeof createPlatformScope>

/** A plan version with every module, or without online payments. */
let plans = 0
const run = Math.random().toString(36).slice(2, 10)
async function subscribe(tenantId: string, onlinePayments = true) {
  await scope.withPlatformTransaction(async (tx) => {
    // `plans.code` is ^[a-z0-9-]{2,32}$.
    const plan = await tx.plan.create({
      data: { code: 's9-create-' + ++plans + '-' + run, name: 'Synthetic' },
    })
    const version = await tx.planVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        amount: '199.90',
        entitlements: {
          schema: 1,
          limits: { equipments: null, staffSeats: 2 },
          features: Object.fromEntries(
            ENTITLEMENT_FEATURES.map((key) => [
              key,
              key === 'onlinePayments' ? onlinePayments : true,
            ])
          ),
        },
      },
    })
    await tx.subscription.updateMany({
      where: { tenantId, status: { not: 'CANCELED' } },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelReason: 'STAFF',
      },
    })
    await tx.subscription.create({
      data: { tenantId, planVersionId: version.id, status: 'ACTIVE' },
    })
  })
}

beforeAll(async () => {
  fixture = await startReceivingAccountFixture(original, {
    env: {
      PLATFORM_SUBACCOUNT_CREATION: 'on',
      PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'STANDARD',
      PLATFORM_SUBACCOUNT_REQUIRES_PAID: 'true',
      PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'on',
      PLATFORM_ASAAS_ROOT_API_KEY: fake.rootApiKey,
      CRON_SECRET: CRON,
    },
    provider: (url, init) => fake.fetch(url, init),
  })
  scope = createPlatformScope(fixture.platform)
  for (const [index, owner] of fixture.owners.entries()) {
    await scope.withProvisioningTransaction(owner.tenantId, (tx) =>
      tx.organization.update({
        where: { id: owner.tenantId },
        data: {
          legalName: 'Locadora Sintetica ' + index + ' Ltda',
          companyType: 'LIMITED',
          phone: companyPhone,
          addressLine: 'Rua Sintetica',
          addressNumber: String(100 + index),
          district: 'Centro',
          postalCode: '01001000',
          city: 'Sao Paulo',
          state: 'SP',
        },
      })
    )
    await fixture.prisma.legalAcceptance.create({
      data: {
        userId: owner.user.id,
        tenantId: owner.tenantId,
        kind: 'PAYMENTS_PARTNER_NOTICE',
        version: '2026-10-01',
        textSha256: 'a'.repeat(64),
        acceptedAt: new Date(Date.now() - 60_000),
      },
    })
    await subscribe(owner.tenantId)
    // The first company of each pair has paid its first invoice; the second has not.
    if (index % 2 === 0)
      await scope.withPlatformTransaction(async (tx) => {
        const subscription = await tx.subscription.findFirstOrThrow({
          where: { tenantId: owner.tenantId, status: 'ACTIVE' },
        })
        await tx.platformInvoice.create({
          data: {
            tenantId: owner.tenantId,
            subscriptionId: subscription.id,
            status: 'PAID',
            providerPaymentId: 'pay_create_' + index,
            amount: '199.90',
            dueDate: new Date(),
            paidAt: new Date(),
            syncedAt: new Date(),
          },
        })
      })
  }
}, 240000)
afterAll(async () => {
  await fixture?.stop()
}, 30000)

async function privateBody(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  const text = await response.text()
  for (const marker of [income, '98765', phone, fake.rootApiKey])
    expect(text).not.toContain(marker)
  return text ? JSON.parse(text) : null
}
const cron = async (host: string) => {
  const response = await fetch(host + '/api/cron/platform', {
    headers: { authorization: 'Bearer ' + CRON },
  })
  expect(response.status).toBe(200)
}
const posts = (document: string) =>
  fake.requests.filter(
    (row) =>
      row.method === 'POST' &&
      row.path === '/accounts' &&
      (row.body as { cpfCnpj?: string } | null)?.cpfCnpj === document
  ).length

for (const [index, name] of ['legacy', 'service'].entries()) {
  // Sem a raiz (API_LEGACY_MODE=absent) só o braço do serviço roda, com os mesmos donos da fixture (onda 135, E1).
  if (index === 0 && !legacyRunning(original)) continue
  describe(`owner creation through the compiled proxy to ${name}`, () => {
    let web: Awaited<ReturnType<typeof startWebConsumer>>
    let cookie: string, otherCookie: string
    const host = () => (index ? fixture.context.api : fixture.context.legacy!)
    const owner = () => fixture.owners[index * 2]!
    const other = () => fixture.owners[index * 2 + 1]!
    const headers = (extra: Record<string, string> = {}) => ({
      Host: 'app.platform.test',
      Origin: appOrigin,
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      Cookie: cookie,
      'x-tenant-id': owner().tenantId,
      ...extra,
    })
    const offer = (extra: Record<string, string> = {}) =>
      requestWeb(web.origin + endpoint, { headers: headers(extra) })
    const create = (body: unknown, extra: Record<string, string> = {}) =>
      requestWeb(web.origin + endpoint, {
        method: 'POST',
        headers: headers(extra),
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    const pix = (quoteId: string) =>
      requestWeb(web.origin + '/api/payments/pix', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ quoteId, amount: 100, dueDate: '2030-01-10' }),
      })
    let version = ''

    beforeAll(async () => {
      // One double for the file: each host starts counting its own provider calls.
      fake.clearRecords()
      web = await startWebConsumer(fixture.context, host())
      const edge = {
        'x-platform-edge-auth': fixture.context.secret,
        'x-platform-host-kind': 'app',
        'x-platform-origin': appOrigin,
        'x-platform-client-ip': fixture.context.directory.ips[58 + index * 2]!,
      }
      cookie = await signInParityUser(fixture.context, edge, index * 2, {
        fresh: true,
      })
      otherCookie = await signInParityUser(
        fixture.context,
        {
          ...edge,
          'x-platform-client-ip':
            fixture.context.directory.ips[59 + index * 2]!,
        },
        index * 2 + 1,
        { fresh: true }
      )
    }, 90000)
    afterAll(async () => {
      await web?.stop()
    })

    it('the owner reads the available offer; another company, a non-owner and foreign origins are refused', async () => {
      const body = PaymentAccountCreationOfferSchema.parse(
        await privateBody(await offer(), 200)
      )
      expect(body).toMatchObject({
        available: true,
        model: 'STANDARD',
        company: { site: 'https://' + owner().tenantId + '.platform.test' },
      })
      version = body.companyDataVersion!
      // The ADMIN member of another company who is not its owner.
      expect(
        await privateBody(await offer({ 'x-tenant-id': other().tenantId }), 403)
      ).toMatchObject({ code: 'OWNER_REQUIRED' })
      // Its own owner reads the blocker of the unpaid first invoice.
      expect(
        await privateBody(
          await offer({ Cookie: otherCookie, 'x-tenant-id': other().tenantId }),
          200
        )
      ).toMatchObject({ available: false, blocker: 'FIRST_PAYMENT_REQUIRED' })
      for (const origin of [
        'https://' + other().tenantId + '.platform.test',
        'null',
      ])
        expect((await offer({ Origin: origin })).status).toBe(403)
      expect((await offer({ 'Sec-Fetch-Site': 'same-site' })).status).toBe(403)
      expect(fake.requests).toHaveLength(0)
    })

    it('M17: the request needs the exact panel origin and the strict body, never echoed', async () => {
      const valid = {
        incomeValue: income,
        mobilePhone: phone,
        companyDataConfirmed: true,
        companyDataVersion: version,
      }
      await privateBody(
        await create(valid, {
          Origin: 'https://' + other().tenantId + '.platform.test',
          'Sec-Fetch-Site': 'same-site',
        }),
        403
      )
      for (const body of [
        { ...valid, incomeValue: 98765.43 },
        { ...valid, incomeValue: '98765.431' },
        { ...valid, mobilePhone: '1133334444' },
        { ...valid, incomeRange: '50K_100K' },
      ])
        expect(await privateBody(await create(body), 400)).toMatchObject({
          code: 'INVALID_INPUT',
        })
      expect(
        await privateBody(
          await create({ ...valid, companyDataVersion: 'b'.repeat(64) }),
          409
        )
      ).toMatchObject({ code: 'COMPANY_DATA_CHANGED' })
      expect(
        await fixture.prisma.paymentAccount.count({
          where: { tenantId: { in: [owner().tenantId, other().tenantId] } },
        })
      ).toBe(0)
    })

    it('SETUP accepts concurrent requests as one account, without the provider; the same CNPJ is then in use', async () => {
      // Another company paying its first invoice under the same, unverified CNPJ: available until this request.
      await scope.withProvisioningTransaction(other().tenantId, (tx) =>
        tx.organization.update({
          where: { id: other().tenantId },
          data: {
            document: owner().document,
            documentNormalized: owner().document,
          },
        })
      )
      await scope.withPlatformTransaction(async (tx) => {
        const subscription = await tx.subscription.findFirstOrThrow({
          where: { tenantId: other().tenantId, status: 'ACTIVE' },
        })
        await tx.platformInvoice.create({
          data: {
            tenantId: other().tenantId,
            subscriptionId: subscription.id,
            status: 'PAID',
            providerPaymentId: 'pay_create_other_' + index,
            amount: '199.90',
            dueDate: new Date(),
            paidAt: new Date(),
            syncedAt: new Date(),
          },
        })
      })
      const asOther = { Cookie: otherCookie, 'x-tenant-id': other().tenantId }
      const competing = PaymentAccountCreationOfferSchema.parse(
        await privateBody(await offer(asOther), 200)
      )
      expect(competing).toMatchObject({ available: true, blocker: null })
      const valid = {
        incomeValue: income,
        mobilePhone: phone,
        companyDataConfirmed: true,
        companyDataVersion: version,
      }
      // The crons of the other host may already have projected FULL from the paid invoice; this proof is SETUP.
      await scope.withPlatformTransaction((tx) =>
        tx.organization.update({
          where: { id: owner().tenantId },
          data: { access: 'SETUP' },
        })
      )
      const responses = await Promise.all([create(valid), create(valid)])
      for (const response of responses)
        expect(
          CreatePaymentAccountResponseSchema.parse(
            await privateBody(response, 202)
          )
        ).toEqual({ accepted: true })
      expect(fake.requests).toHaveLength(0)
      expect(
        await fixture.prisma.paymentAccount.findMany({
          where: { tenantId: owner().tenantId },
        })
      ).toEqual([
        expect.objectContaining({
          mode: 'ASAAS_SUBACCOUNT',
          status: 'PROVISIONING',
          subaccountModel: 'STANDARD',
        }),
      ])
      expect(
        (
          await fixture.prisma.organization.findUniqueOrThrow({
            where: { id: owner().tenantId },
          })
        ).access
      ).toBe('SETUP')
      // Ownership of the CNPJ (ADR SaaS B.8): the other company goes to review instead of a second account.
      expect(
        await privateBody(
          await create(
            { ...valid, companyDataVersion: competing.companyDataVersion },
            asOther
          ),
          409
        )
      ).toMatchObject({ code: 'DOCUMENT_IN_USE' })
      expect(await privateBody(await offer(asOther), 200)).toMatchObject({
        blocker: 'DOCUMENT_IN_USE',
      })
      expect(
        await fixture.prisma.paymentAccount.count({
          where: { tenantId: other().tenantId },
        })
      ).toBe(0)
    })

    it('the cron of this host creates the account once; the owner view shows only its state', async () => {
      await cron(host())
      expect(posts(owner().document)).toBe(1)
      // The exact value and phone typed by the owner are the body of that only POST (decision of 2026-10-06).
      expect(
        fake.requests.find(
          (row) =>
            row.method === 'POST' &&
            row.path === '/accounts' &&
            (row.body as { cpfCnpj?: string } | null)?.cpfCnpj ===
              owner().document
        )?.body
      ).toMatchObject({ incomeValue: 98765.43, mobilePhone: phone })
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
        include: { integration: true },
      })
      expect(account).toMatchObject({
        status: 'AWAITING_OWNER',
        lastErrorCode: 'WEBHOOK_UPDATE_PENDING',
        integration: { status: 'PROVISIONING' },
      })
      const view = PaymentAccountResponseSchema.parse(
        await privateBody(
          await requestWeb(web.origin + '/api/admin/payment-account', {
            headers: headers(),
          }),
          200
        )
      )
      expect(view.account).toMatchObject({
        kind: 'STANDARD',
        status: 'AWAITING_OWNER',
      })
      for (const internal of [
        account.id,
        account.integrationId,
        account.providerAccountId!,
        account.walletId!,
      ])
        expect(JSON.stringify(view)).not.toContain(internal)
      expect(
        await fixture.prisma.paymentAccountProvisioningRequest.findUniqueOrThrow(
          { where: { paymentAccountId: account.id } }
        )
      ).toMatchObject({
        incomeValue: null,
        mobilePhone: null,
        purgeReason: 'CREATED',
      })
      // A second real run (the other host while both run, the API again without the root) never repeats the creation.
      await cron(otherTarget(fixture.context, host()))
      expect(posts(owner().document)).toBe(1)
    })

    it('S33: a new charge is refused with 409 until the health approves the account, then queued', async () => {
      // After the first paid invoice the subscription is FULL; SETUP refuses any new charge before this barrier.
      await scope.withPlatformTransaction((tx) =>
        tx.organization.update({
          where: { id: owner().tenantId },
          data: { access: 'FULL' },
        })
      )
      const quote = await fixture.prisma.quote.create({
        data: {
          tenantId: owner().tenantId,
          name: 'Synthetic payer',
          email: 'payer@example.test',
          phone: '00000000000',
          cpf: '12345678909',
          total: 100,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      })
      expect(
        PaymentAccountNotReadyErrorSchema.parse(
          await privateBody(await pix(quote.id), 409)
        )
      ).toEqual({
        code: 'PAYMENT_ACCOUNT_NOT_READY',
        error:
          'A conta de recebimentos ainda não está pronta para emitir cobranças.',
      })
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
      })
      fake.setAccountStatus(account.providerAccountId!, {
        commercialInfo: 'APPROVED',
        bankAccountInfo: 'APPROVED',
        documentation: 'APPROVED',
        general: 'APPROVED',
      })
      // The health delivery queued by the seal is due 15 s later; move both instants instead of waiting.
      const due = new Date(Date.now() - 1000)
      await fixture.prisma.paymentAccount.update({
        where: { id: account.id },
        data: { nextAttemptAt: due },
      })
      await fixture.prisma.platformOutboxEvent.updateMany({
        where: {
          aggregateId: account.id,
          topic: 'payment-accounts.health',
          status: 'PENDING',
        },
        data: { availableAt: due },
      })
      await cron(host())
      expect(
        await fixture.prisma.paymentAccount.findUniqueOrThrow({
          where: { id: account.id },
          include: { integration: true },
        })
      ).toMatchObject({
        status: 'APPROVED',
        integration: { status: 'ACTIVE' },
      })
      const accepted = await pix(quote.id)
      expect(accepted.status).toBe(202)
      expect(await accepted.json()).toMatchObject({ processing: 'PENDING' })
    })
  })
}

describe('the subscription gate on the creation (enforcement on)', () => {
  let web: Awaited<ReturnType<typeof startWebConsumer>>
  let cookie: string
  // The second owner of the service pair never requested an account.
  const subject = () => fixture.owners[3]!
  const headers = () => ({
    Host: 'app.platform.test',
    Origin: appOrigin,
    'Sec-Fetch-Site': 'same-origin',
    'Content-Type': 'application/json',
    Cookie: cookie,
    'x-tenant-id': subject().tenantId,
  })
  beforeAll(async () => {
    web = await startWebConsumer(fixture.context, fixture.context.api)
    cookie = await signInParityUser(
      fixture.context,
      {
        'x-platform-edge-auth': fixture.context.secret,
        'x-platform-host-kind': 'app',
        'x-platform-origin': appOrigin,
        'x-platform-client-ip': fixture.context.directory.ips[63]!,
      },
      3,
      { fresh: true }
    )
    // Its own CNPJ again, so only the subscription decides.
    await scope.withProvisioningTransaction(subject().tenantId, (tx) =>
      tx.organization.update({
        where: { id: subject().tenantId },
        data: {
          document: subject().document,
          documentNormalized: subject().document,
        },
      })
    )
  }, 90000)
  afterAll(async () => {
    await web?.stop()
  })
  const body = {
    incomeValue: income,
    mobilePhone: phone,
    companyDataConfirmed: true,
    companyDataVersion: '',
  }

  it('a restricted subscription reads SUBSCRIPTION_RESTRICTED and the request gets 402', async () => {
    const available = PaymentAccountCreationOfferSchema.parse(
      await privateBody(
        await requestWeb(web.origin + endpoint, { headers: headers() }),
        200
      )
    )
    expect(available.available).toBe(true)
    body.companyDataVersion = available.companyDataVersion!
    await scope.withPlatformTransaction((tx) =>
      tx.organization.update({
        where: { id: subject().tenantId },
        data: { access: 'RESTRICTED' },
      })
    )
    expect(
      await privateBody(
        await requestWeb(web.origin + endpoint, { headers: headers() }),
        200
      )
    ).toMatchObject({ available: false, blocker: 'SUBSCRIPTION_RESTRICTED' })
    expect(
      await privateBody(
        await requestWeb(web.origin + endpoint, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(body),
        }),
        402
      )
    ).toMatchObject({ code: 'SUBSCRIPTION_RESTRICTED' })
  })

  it('D-4: a plan without online payments reads MODULE_NOT_IN_PLAN and the request gets 402', async () => {
    await scope.withPlatformTransaction((tx) =>
      tx.organization.update({
        where: { id: subject().tenantId },
        data: { access: 'SETUP' },
      })
    )
    await subscribe(subject().tenantId, false)
    expect(
      await privateBody(
        await requestWeb(web.origin + endpoint, { headers: headers() }),
        200
      )
    ).toMatchObject({ available: false, blocker: 'MODULE_NOT_IN_PLAN' })
    expect(
      await privateBody(
        await requestWeb(web.origin + endpoint, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(body),
        }),
        402
      )
    ).toMatchObject({ code: 'MODULE_NOT_IN_PLAN' })
    expect(
      await fixture.prisma.paymentAccount.count({
        where: { tenantId: subject().tenantId },
      })
    ).toBe(0)
  })
})
