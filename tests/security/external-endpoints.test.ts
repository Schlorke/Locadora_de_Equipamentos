const fPreparedDatabase = vi.hoisted(() => ({
  value: undefined as
    undefined | Awaited<ReturnType<typeof createFPreparedDatabase>>,
  pool: null as null | import('pg').Pool,
}))
async function createFPreparedDatabase() {
  return { prisma: mocks.prisma }
}
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
  })
  return {
    prisma: {
      tenantIntegration: model(),
      externalResourceTenant: model(),
      organization: model(),
      payment: model(),
      paymentAttempt: model(),
      auditLog: model(),
      quote: model(),
      contract: model(),
      outboxEvent: model(),
      rentals: model(),
      equipment: model(),
      notification: model(),
      maintenance: model(),
      whatsAppConversation: model(),
      whatsAppMessage: model(),
    },
    processPayment: vi.fn(),
    convert: vi.fn(),
    expire: vi.fn(),
    lateFees: vi.fn(),
    sync: vi.fn(),
    verify: vi.fn(),
    send: vi.fn(),
  }
})

import * as seed from '../../apps/services/api/src/app/api/admin/seed-admin/route'
import * as login from '../../apps/services/api/src/app/api/test-login/route'
import * as storage from '../../apps/services/api/src/app/api/fix-storage/route'
import * as setup from '../../apps/services/api/src/app/api/supabase-setup/route'
import {
  mapAsaasStatus,
  parseAsaasWebhook,
} from '../../packages/backend/src/modules/billing/asaas-events'
import { runTenantCron } from '../../apps/services/api/src/host/tenant-cron'
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => {
  fPreparedDatabase.value = await createFPreparedDatabase()
  const originalComposition = await (async (
    importOriginal: <T = unknown>() => Promise<T>
  ) => ({
    ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
    getDatabaseRuntime: () => ({ prisma: mocks.prisma }),
    ...(await (async () => {
      const F = await (() => ({
        default: () => ({ emails: { send: mocks.send } }),
      }))()
      return { createResendClient: () => F.default() }
    })()),
  }))(importOriginal)
  return {
    ...originalComposition,
    getDatabaseRuntime: () => ({
      prisma: fPreparedDatabase.value!.prisma,
      ...(fPreparedDatabase.pool ? { pool: fPreparedDatabase.pool } : {}),
    }),
  }
})
vi.mock(
  '../../apps/services/api/src/host/payment-webhooks',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/payment-webhooks')
    >()),
    ...(await (() => ({
      runWebhookInboxEffect: vi.fn(),
      acceptTenantWebhook: (
        event: unknown,
        consume: (_event: unknown) => Promise<Response>
      ) => consume(event),
    }))()),
    ...(await (() => ({
      verifyTenantBoleto: mocks.verify,
    }))()),
    ...(await (() => ({
      processPayment: mocks.processPayment,
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/tenant-transaction',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/tenant-transaction')
    >()),
    ...(await (() => ({
      withTenantTransaction: (
        _context: unknown,
        operation: (_tx: unknown) => unknown
      ) => operation(mocks.prisma),
    }))()),
  })
)
vi.mock(
  '../../apps/services/api/src/host/quotations',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../apps/services/api/src/host/quotations')
    >()),
    ...(await (() => ({
      convertPaidQuotePayment: mocks.convert,
      autoConvertApprovedQuotes: vi.fn(),
    }))()),
    ...(await (() => ({ checkAndExpireQuotes: mocks.expire }))()),
    ...(await (() => ({
      calculateAndApplyLateFees: mocks.lateFees,
    }))()),
  })
)
// O serviço monta os consumidores de webhook com o processador da fábrica de cobrança (`host/payment-webhooks`): o
// mesmo dublê de processamento entra pela fábrica, já que trocar só o export do host não alcança os consumidores.
vi.mock('@gb-locacoes/backend/billing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/billing')>()),
  createPaymentProcessor: () => ({ processPayment: mocks.processPayment }),
}))

import * as serviceRoute0 from '../../apps/services/api/src/app/api/payments/pix/webhook/[integrationId]/route'

import * as serviceRoute1 from '../../apps/services/api/src/app/api/payments/boleto/webhook/[integrationId]/route'

import * as serviceRoute2 from '../../apps/services/api/src/app/api/contracts/zapsign-webhook/[integrationId]/route'

import * as serviceRoute3 from '../../apps/services/api/src/app/api/webhooks/whatsapp/[integrationId]/route'

import * as serviceRoute4 from '../../apps/services/api/src/app/api/cron/auto-convert-quotes/route'

import * as serviceRoute5 from '../../apps/services/api/src/app/api/cron/boleto-overdue-alerts/route'

import * as serviceRoute6 from '../../apps/services/api/src/app/api/cron/expire-quotes/route'

import * as serviceRoute7 from '../../apps/services/api/src/app/api/cron/late-fees/route'

import * as serviceRoute8 from '../../apps/services/api/src/app/api/cron/preventive-maintenance/route'

import * as serviceRoute9 from '../../apps/services/api/src/app/api/cron/send-notifications/route'

import * as serviceRoute10 from '../../apps/services/api/src/app/api/cron/sync-google-merchant/route'

import * as serviceRoute11 from '../../apps/services/api/src/app/api/cron/verify-boleto-payments/route'

import * as serviceRoute12 from '../../apps/services/api/src/app/api/cron/outbox/route'

const HOSTS = [
  [
    'service',
    {
      pixHandler: serviceRoute0.POST,
      boletoHandler: serviceRoute1.POST,
      zapsignHandler: serviceRoute2.POST,
      whatsappHandler: serviceRoute3.POST,
      handshakeHandler: serviceRoute3.GET,
      autoConvert: serviceRoute4.GET,
      alerts: serviceRoute5.GET,
      expire: serviceRoute6.GET,
      lateFees: serviceRoute7.GET,
      maintenance: serviceRoute8.GET,
      notifications: serviceRoute9.GET,
      merchant: serviceRoute10.GET,
      verifyBoletos: serviceRoute11.GET,
      outbox: serviceRoute12.GET,
    },
  ],
] as const

describe.each(HOSTS)(
  '%s',
  (
    _host,
    {
      pixHandler,
      boletoHandler,
      zapsignHandler,
      whatsappHandler,
      handshakeHandler,
      autoConvert,
      alerts,
      expire,
      lateFees,
      maintenance,
      notifications,
      merchant,
      verifyBoletos,
      outbox,
    }
  ) => {
    const route = (provider: string) => ({
      params: Promise.resolve({ integrationId: `integration-${provider}` }),
    })
    const pix = (request: NextRequest) => pixHandler(request, route('PIX'))
    const boleto = (request: NextRequest) =>
      boletoHandler(request, route('ASAAS'))
    const zapsign = (request: NextRequest) =>
      zapsignHandler(request, route('ZAPSIGN'))
    const whatsapp = (request: NextRequest) =>
      whatsappHandler(request, route('WHATSAPP'))
    const handshake = (request: NextRequest) =>
      handshakeHandler(request, route('WHATSAPP'))
    const secret = 'test-only-webhook-secret'
    const envNames = [
      'CRON_SECRET',
      'LOCADORA_INTEGRATION_ASAAS_SECRET',
      'BOLETO_WEBHOOK_SECRET',
      'LOCADORA_INTEGRATION_PIX_SECRET',
      'LOCADORA_INTEGRATION_ZAPSIGN_SECRET',
      'LOCADORA_INTEGRATION_WHATSAPP_SECRET',
      'LOCADORA_INTEGRATION_WHATSAPP_VERIFY_TOKEN',
    ]
    const cronHandlers = {
      autoConvert,
      alerts,
      expire,
      lateFees,
      maintenance,
      notifications,
      merchant,
      verifyBoletos,
      outbox,
    }
    const hooks = [
      {
        name: 'PIX',
        handler: pix,
        env: 'LOCADORA_INTEGRATION_PIX_SECRET',
        header: 'x-webhook-signature',
        prefix: '',
        body: {
          paymentId: 'payment-1',
          transactionId: 'transaction-1',
          amount: 100,
          status: 'PAID',
        },
      },
      {
        name: 'boleto',
        handler: boleto,
        env: 'LOCADORA_INTEGRATION_ASAAS_SECRET',
        header: 'x-webhook-signature',
        prefix: '',
        body: {
          payment: { id: 'transaction-1', status: 'CONFIRMED', value: 100 },
        },
      },
      {
        name: 'ZapSign',
        handler: zapsign,
        env: 'LOCADORA_INTEGRATION_ZAPSIGN_SECRET',
        header: 'x-zapsign-signature',
        prefix: '',
        body: { doc_token: 'doc-1', status: 'SIGNED' },
      },
      {
        name: 'WhatsApp',
        handler: whatsapp,
        env: 'LOCADORA_INTEGRATION_WHATSAPP_SECRET',
        header: 'x-hub-signature-256',
        prefix: 'sha256=',
        body: { entry: [] },
      },
    ]
    function request(
      body: unknown,
      header = 'x-webhook-signature',
      prefix = '',
      raw?: string
    ) {
      const text = raw ?? JSON.stringify(body)
      return new NextRequest('http://localhost/api/webhook', {
        method: 'POST',
        body: text,
        headers: {
          [header]:
            prefix + createHmac('sha256', secret).update(text).digest('hex'),
        },
      })
    }
    function cronRequest(token = secret) {
      return new NextRequest('http://localhost/api/cron', {
        headers: { authorization: `Bearer ${token}` },
      })
    }
    function expectNoWork() {
      for (const [name, model] of Object.entries(mocks.prisma))
        if (name !== 'tenantIntegration')
          for (const fn of Object.values(model))
            expect(fn).not.toHaveBeenCalled()
      for (const fn of [
        mocks.processPayment,
        mocks.convert,
        mocks.expire,
        mocks.lateFees,
        mocks.sync,
        mocks.verify,
        mocks.send,
      ])
        expect(fn).not.toHaveBeenCalled()
    }
    function paymentState(initial: string, method = 'PIX', snapshot = initial) {
      const state = {
        id: 'payment-1',
        status: initial,
        amount: 100,
        method,
        transactionId: 'transaction-1',
        dueDate: new Date('2020-01-01'),
        quoteId: null,
      }
      mocks.prisma.payment.findUnique.mockResolvedValue({
        ...state,
        status: snapshot,
      })
      mocks.prisma.payment.findFirst.mockResolvedValue({
        ...state,
        status: snapshot,
      })
      mocks.prisma.payment.findMany.mockResolvedValue([
        { ...state, status: snapshot },
      ])
      mocks.prisma.payment.updateMany.mockImplementation(
        async ({ where, data }) => {
          const statuses =
            typeof where.status === 'string' ? [where.status] : where.status.in
          if (!statuses.includes(state.status)) return { count: 0 }
          Object.assign(state, data)
          return { count: 1 }
        }
      )
      mocks.processPayment.mockImplementation(async () => {
        if (['PENDING', 'OVERDUE'].includes(state.status)) state.status = 'PAID'
      })
      return state
    }
    beforeEach(() => {
      vi.resetAllMocks()
      for (const name of envNames) vi.stubEnv(name, '')
      vi.stubEnv('FROM_EMAIL', '')
      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          throw new Error('Network forbidden in security tests')
        })
      )
      mocks.prisma.tenantIntegration.findUnique.mockImplementation(
        async ({ where }) => ({
          id: where.id,
          tenantId: 'tenant-1',
          provider: where.id.replace('integration-', ''),
          credentialsRef: `env:LOCADORA_INTEGRATION_${where.id.replace('integration-', '')}`,
          externalAccountId: 'phone-account-1',
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
        })
      )
      mocks.prisma.externalResourceTenant.findFirst.mockImplementation(
        async ({ where }) => ({
          resourceId:
            where.resourceType === 'CONTRACT' ? 'contract-1' : 'payment-1',
        })
      )
      mocks.prisma.organization.findMany.mockResolvedValue([{ id: 'tenant-1' }])
      mocks.prisma.paymentAttempt.findFirst.mockResolvedValue(null)
      mocks.prisma.paymentAttempt.updateMany.mockResolvedValue({ count: 1 })
      mocks.convert.mockResolvedValue({ converted: false })
      mocks.prisma.whatsAppConversation.upsert.mockResolvedValue({
        id: 'conversation-1',
      })
    })
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })

    describe('retired operational HTTP surface', () => {
      it.each([
        ['seed GET', seed.GET],
        ['seed POST', seed.POST],
        ['test login', login.POST],
        ['fix storage', storage.POST],
        ['setup GET', setup.GET],
        ['setup POST', setup.POST],
      ])('%s returns 410 without side effects', async (_name, handler) => {
        expect((await handler()).status).toBe(410)
        expectNoWork()
      })
    })
    describe.each(Object.entries(cronHandlers))('cron %s', (_name, handler) => {
      it('fails closed when secret is missing, even for old development fallback', async () => {
        expect(
          (await handler(cronRequest('development-cron-secret'))).status
        ).toBe(503)
        expectNoWork()
      })
      it('rejects wrong secret before work', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        expect((await handler(cronRequest('incorrect'))).status).toBe(401)
        expectNoWork()
      })
    })
    describe.each(hooks)(
      '$name webhook authentication',
      ({ handler, env, header, prefix, body }) => {
        it('fails closed without configured secret', async () => {
          expect((await handler(request(body, header, prefix))).status).toBe(
            503
          )
          expectNoWork()
        })
        it('rejects missing signature', async () => {
          vi.stubEnv(env, secret)
          expect(
            (
              await handler(
                new NextRequest('http://localhost/api/webhook', {
                  method: 'POST',
                  body: JSON.stringify(body),
                })
              )
            ).status
          ).toBe(401)
          expectNoWork()
        })
        it('rejects tampered body with otherwise valid signature', async () => {
          vi.stubEnv(env, secret)
          const req = request(body, header, prefix)
          const changed = new NextRequest(req.url, {
            method: 'POST',
            headers: req.headers,
            body: JSON.stringify({ changed: true }),
          })
          expect((await handler(changed)).status).toBe(401)
          expectNoWork()
        })
        it('rejects signed invalid JSON', async () => {
          vi.stubEnv(env, secret)
          expect((await handler(request({}, header, prefix, '{'))).status).toBe(
            400
          )
          expectNoWork()
        })
        it('rejects signed malformed event before database', async () => {
          vi.stubEnv(env, secret)
          expect((await handler(request({}, header, prefix))).status).toBe(400)
          expectNoWork()
        })
      }
    )
    describe('valid provider deliveries', () => {
      it('PIX reads raw body once and processes payment without activating rental', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
        paymentState('PENDING')
        const req = request(hooks[0].body)
        const read = vi.spyOn(req, 'text')
        expect((await pix(req)).status).toBe(200)
        expect(read).toHaveBeenCalledTimes(1)
        expect(mocks.processPayment).toHaveBeenCalledWith(
          { tenantId: 'tenant-1' },
          'payment-1',
          {
            status: 'PAID',
            externalId: 'transaction-1',
            paidAt: expect.any(Date),
          }
        )
        expect(mocks.prisma.rentals.update).not.toHaveBeenCalled()
      })
      it('PIX rejects a payment from another method', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
        paymentState('PENDING', 'BOLETO')
        expect((await pix(request(hooks[0].body))).status).toBe(400)
        expect(mocks.processPayment).not.toHaveBeenCalled()
      })
      it('PIX rejects mismatched transaction reference', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
        paymentState('PENDING')
        expect(
          (await pix(request({ ...hooks[0].body, transactionId: 'other' })))
            .status
        ).toBe(400)
        expect(mocks.processPayment).not.toHaveBeenCalled()
      })
      it.each(['PAID', 'CANCELLED', 'REFUNDED'])(
        'PIX PAID replay preserves %s',
        async (status) => {
          vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
          const state = paymentState(status)
          expect((await pix(request(hooks[0].body))).status).toBe(200)
          expect(state.status).toBe(status)
          expect(mocks.processPayment).not.toHaveBeenCalled()
        }
      )
      it.each(['OVERDUE', 'CANCELLED', 'PENDING'])(
        'PIX stale %s cannot downgrade concurrent PAID',
        async (status) => {
          vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
          const state = paymentState('PAID', 'PIX', 'PENDING')
          expect(
            (
              await pix(
                request({
                  paymentId: 'payment-1',
                  transactionId: 'transaction-1',
                  status,
                })
              )
            ).status
          ).toBe(200)
          expect(state.status).toBe('PAID')
        }
      )
      it('boleto accepts provider token in header and confirms payment', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        paymentState('PENDING', 'BOLETO')
        const req = new NextRequest('http://localhost/api/webhook', {
          method: 'POST',
          headers: { 'asaas-access-token': secret },
          body: JSON.stringify(hooks[1].body),
        })
        expect((await boleto(req)).status).toBe(200)
        expect(mocks.processPayment).toHaveBeenCalledTimes(1)
        expect(mocks.convert).toHaveBeenCalledWith(
          { tenantId: 'tenant-1' },
          'payment-1'
        )
      })
      it('ASAAS confirms PIX emitted by the same tenant gateway integration', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        paymentState('PENDING', 'PIX')
        expect(
          (
            await boleto(
              request({
                payment: {
                  id: 'transaction-1',
                  status: 'CONFIRMED',
                  value: 100,
                },
              })
            )
          ).status
        ).toBe(200)
        expect(
          mocks.prisma.payment.findFirst.mock.calls[0][0].where.method
        ).toEqual({ in: ['BOLETO', 'PIX'] })
        expect(mocks.processPayment).toHaveBeenCalledWith(
          { tenantId: 'tenant-1' },
          'payment-1',
          expect.objectContaining({
            externalId: 'transaction-1',
            status: 'PAID',
          })
        )
      })
      it('PAYMENT_DELETED confirms charge cancellation without cancelling the obligation', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        const state = paymentState('PENDING', 'BOLETO')
        mocks.prisma.paymentAttempt.findFirst.mockResolvedValue({
          id: 'attempt-old',
          status: 'ISSUED',
        })
        expect(
          (
            await boleto(
              request({
                event: 'PAYMENT_DELETED',
                payment: { id: 'transaction-old', status: 'DELETED' },
              })
            )
          ).status
        ).toBe(200)
        expect(
          mocks.prisma.paymentAttempt.updateMany.mock.calls[0][0].data
        ).toMatchObject({ cancellationStatus: 'CONFIRMED' })
        expect(state.status).toBe('PENDING')
        expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
      })
      it('records a PAID old attempt for reconciliation without settling the current obligation', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        paymentState('PENDING', 'BOLETO')
        mocks.prisma.payment.findFirst.mockResolvedValue(null)
        mocks.prisma.paymentAttempt.findFirst.mockResolvedValue({
          id: 'attempt-old',
          amount: 100,
          status: 'CANCELLED',
        })
        const response = await boleto(
          request({
            payment: { id: 'transaction-old', status: 'CONFIRMED', value: 100 },
          })
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          reconciliationRequired: true,
        })
        expect(mocks.processPayment).not.toHaveBeenCalled()
        expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
          'PAYMENT_RECONCILIATION_REQUIRED'
        )
      })
      it.each([undefined, 1, 101])(
        'refuses mismatched or missing paid amount %s',
        async (value) => {
          vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
          paymentState('PENDING', 'BOLETO')
          expect(
            (
              await boleto(
                request({
                  payment: { id: 'transaction-1', status: 'CONFIRMED', value },
                })
              )
            ).status
          ).toBe(409)
          expect(mocks.processPayment).not.toHaveBeenCalled()
        }
      )
      it('boleto does not accept a token in the URL', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        expect(
          (
            await boleto(
              new NextRequest(`http://localhost/api/webhook?token=${secret}`, {
                method: 'POST',
                body: JSON.stringify(hooks[1].body),
              })
            )
          ).status
        ).toBe(401)
        expectNoWork()
      })
      it.each(['OVERDUE', 'CANCELLED'])(
        'boleto stale %s cannot downgrade concurrent PAID',
        async (status) => {
          vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
          const state = paymentState('PAID', 'BOLETO', 'PENDING')
          expect(
            (
              await boleto(
                request({ payment: { id: 'transaction-1', status } })
              )
            ).status
          ).toBe(200)
          expect(state.status).toBe('PAID')
        }
      )
      it.each(['PIX', 'BOLETO'])(
        '%s only refunds a confirmed payment',
        async (method) => {
          vi.stubEnv(
            method === 'PIX'
              ? 'LOCADORA_INTEGRATION_PIX_SECRET'
              : 'LOCADORA_INTEGRATION_ASAAS_SECRET',
            secret
          )
          const state = paymentState('PENDING', method)
          const response =
            method === 'PIX'
              ? await pix(
                  request({
                    paymentId: 'payment-1',
                    transactionId: 'transaction-1',
                    status: 'REFUNDED',
                  })
                )
              : await boleto(
                  request({
                    payment: { id: 'transaction-1', status: 'REFUNDED' },
                  })
                )
          expect(response.status).toBe(200)
          expect(state.status).toBe('PENDING')
        }
      )
      it('ZapSign reads once, confirms eligible contract and leaves rental pending', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ZAPSIGN_SECRET', secret)
        mocks.prisma.contract.findFirst.mockResolvedValue({
          id: 'contract-1',
          status: 'SENT',
          rental: { users: { name: 'Test User' } },
        })
        mocks.prisma.contract.updateMany.mockResolvedValue({ count: 1 })
        const req = request(hooks[2].body, 'x-zapsign-signature')
        const read = vi.spyOn(req, 'text')
        expect((await zapsign(req)).status).toBe(200)
        expect(read).toHaveBeenCalledTimes(1)
        expect(mocks.prisma.contract.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: 'contract-1',
              tenantId: 'tenant-1',
              status: { in: ['DRAFT', 'SENT'] },
            },
          })
        )
        expect(mocks.prisma.rentals.update).not.toHaveBeenCalled()
      })
      it('WhatsApp validates Meta signature before persisting its parsed message', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_WHATSAPP_SECRET', secret)
        const body = {
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: { phone_number_id: 'phone-account-1' },
                    messages: [
                      {
                        id: 'message-1',
                        from: '5511999990000',
                        timestamp: '1700000000',
                        type: 'text',
                        text: { body: 'test' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }
        expect(
          (await whatsapp(request(body, 'x-hub-signature-256', 'sha256=')))
            .status
        ).toBe(200)
        expect(mocks.prisma.whatsAppMessage.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenantId_providerMessageId: {
                tenantId: 'tenant-1',
                providerMessageId: 'message-1',
              },
            },
          })
        )
      })
      it('WhatsApp requires sha256 prefix', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_WHATSAPP_SECRET', secret)
        expect(
          (await whatsapp(request({ entry: [] }, 'x-hub-signature-256'))).status
        ).toBe(401)
        expectNoWork()
      })
      it('preserves Meta verification handshake', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_WHATSAPP_VERIFY_TOKEN', secret)
        vi.stubEnv('LOCADORA_INTEGRATION_WHATSAPP_SECRET', secret)
        const response = await handshake(
          new NextRequest(
            `http://localhost/api/webhook?hub.mode=subscribe&hub.verify_token=${secret}&hub.challenge=12345`
          )
        )
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('12345')
        expectNoWork()
      })
    })
    describe('authorized cron transitions', () => {
      it('executes a job for the correct authorization', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        mocks.lateFees.mockResolvedValue({ updated: 0 })
        expect((await lateFees(cronRequest())).status).toBe(200)
        expect(mocks.lateFees).toHaveBeenCalledTimes(1)
      })
      it('paid expired boleto is never marked overdue in the same run', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        const state = paymentState('PENDING', 'BOLETO')
        mocks.verify.mockResolvedValue({ status: 'paid', amount: 100 })
        expect((await verifyBoletos(cronRequest())).status).toBe(200)
        expect(state.status).toBe('PAID')
        expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
      })
      it('concurrent payment confirmation survives expired pending provider snapshot', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        const state = paymentState('PAID', 'BOLETO', 'PENDING')
        mocks.verify.mockResolvedValue({ status: 'pending' })
        const response = await verifyBoletos(cronRequest())
        expect(response.status).toBe(200)
        expect(state.status).toBe('PAID')
        expect((await response.json()).results[0].result.results.overdue).toBe(
          0
        )
      })
      it('still marks an unpaid expired boleto overdue', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        const state = paymentState('PENDING', 'BOLETO')
        mocks.verify.mockResolvedValue({ status: 'pending' })
        expect((await verifyBoletos(cronRequest())).status).toBe(200)
        expect(state.status).toBe('OVERDUE')
      })
    })

    describe('cron boleto attempt isolation', () => {
      it('uses persisted organization progress across daily invocations at the same hour', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        try {
          vi.stubEnv('CRON_SECRET', secret)
          mocks.prisma.organization.findMany.mockResolvedValue([
            { id: 'tenant-A' },
            { id: 'tenant-B' },
          ])
          const progress = new Map<string, Date>()
          mocks.prisma.auditLog.findFirst.mockImplementation(
            async ({ where }) =>
              progress.has(where.tenantId)
                ? { createdAt: progress.get(where.tenantId) }
                : null
          )
          mocks.prisma.auditLog.create.mockImplementation(async ({ data }) => {
            progress.set(data.tenantId, new Date())
            return { id: 'checkpoint' }
          })
          const job = vi.fn(async (_context: { tenantId: string }) => {
            vi.setSystemTime(Date.now() + 130000)
            return Response.json({ success: true })
          })
          const options = {
            job: 'verify-boleto-payments' as const,
            checkpoint: 'daily-fixture',
            budgetMs: 180000,
            minRemainingMs: 60000,
          }
          await runTenantCron(cronRequest(), job, options)
          vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
          await runTenantCron(cronRequest(), job, options)
          expect(job.mock.calls.map((call) => call[0])).toEqual([
            { tenantId: 'tenant-A' },
            { tenantId: 'tenant-B' },
          ])
        } finally {
          vi.useRealTimers()
        }
      })

      it('stops before exhausting the gateway reserve and persists the last attempted id', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
        try {
          vi.stubEnv('CRON_SECRET', secret)
          const state = paymentState('PENDING', 'BOLETO')
          mocks.prisma.payment.findMany.mockResolvedValue([
            state,
            { ...state, id: 'payment-2' },
            { ...state, id: 'payment-3' },
          ])
          mocks.verify.mockImplementation(async () => {
            vi.setSystemTime(Date.now() + 70000)
            return { status: 'pending' }
          })
          await verifyBoletos(cronRequest())
          expect(mocks.verify).toHaveBeenCalledTimes(2)
          expect(
            mocks.prisma.auditLog.create.mock.calls[0]![0].data
          ).toMatchObject({
            tenantId: 'tenant-1',
            action: 'CRON_BOLETO_CHECKPOINT',
            changes: { afterId: 'payment-2', checked: 2 },
          })
        } finally {
          vi.useRealTimers()
        }
      })
      it('resumes after the persisted tenant cursor and wraps after the last pending id', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        const state = paymentState('PENDING', 'BOLETO')
        mocks.prisma.auditLog.findFirst.mockResolvedValue({
          changes: { afterId: 'last-payment' },
        })
        mocks.prisma.payment.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([state])
        mocks.verify.mockResolvedValue({ status: 'pending' })
        await verifyBoletos(cronRequest())
        expect(
          mocks.prisma.payment.findMany.mock.calls[0]![0].where
        ).toMatchObject({ tenantId: 'tenant-1', id: { gt: 'last-payment' } })
        expect(
          mocks.prisma.payment.findMany.mock.calls[1]![0].where.id
        ).toBeUndefined()
      })

      it('cancels only the provider attempt while preserving the obligation', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        const state = paymentState('PENDING', 'BOLETO')
        mocks.verify.mockResolvedValue({ status: 'cancelled' })
        expect((await verifyBoletos(cronRequest())).status).toBe(200)
        expect(state.status).toBe('PENDING')
        expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
        expect(
          mocks.prisma.paymentAttempt.updateMany.mock.calls[0]![0]
        ).toMatchObject({
          where: {
            tenantId: 'tenant-1',
            paymentId: 'payment-1',
            externalId: 'transaction-1',
          },
          data: { status: 'CANCELLED' },
        })
      })
      it.each([undefined, 1, 101])(
        'does not settle a mismatched or absent amount %s',
        async (amount) => {
          vi.stubEnv('CRON_SECRET', secret)
          const state = paymentState('PENDING', 'BOLETO')
          mocks.verify.mockResolvedValue({ status: 'paid', amount })
          await verifyBoletos(cronRequest())
          expect(state.status).toBe('PENDING')
          expect(mocks.processPayment).not.toHaveBeenCalled()
        }
      )
      it('binds overdue updates to the current external reference and tenant', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        paymentState('PENDING', 'BOLETO')
        mocks.verify.mockResolvedValue({ status: 'pending' })
        await verifyBoletos(cronRequest())
        expect(
          mocks.prisma.payment.findMany.mock.calls[0]![0].where.tenantId
        ).toBe('tenant-1')
        expect(
          mocks.prisma.payment.updateMany.mock.calls[0]![0].where
        ).toMatchObject({
          tenantId: 'tenant-1',
          transactionId: 'transaction-1',
          status: 'PENDING',
        })
      })
    })

    describe('Asaas refund lifecycle', () => {
      it.each([
        'REFUND_REQUESTED',
        'REFUND_IN_PROGRESS',
        'REFUND_DENIED',
      ] as const)(
        '%s retains the confirmed payment until refund completes',
        (status) => {
          expect(mapAsaasStatus(status)).toBe('paid')
          expect(
            parseAsaasWebhook({ payment: { id: 'transaction-1', status } })
              .status
          ).toBe('paid')
        }
      )
      it('only completed refund events without status authorize a refund', () => {
        expect(
          parseAsaasWebhook({
            event: 'PAYMENT_REFUNDED',
            payment: { id: 'transaction-1' },
          }).status
        ).toBe('refunded')
        expect(
          parseAsaasWebhook({
            event: 'PAYMENT_REFUND_IN_PROGRESS',
            payment: { id: 'transaction-1' },
          }).status
        ).toBeUndefined()
        expect(
          parseAsaasWebhook({
            event: 'PAYMENT_REFUND_DENIED',
            payment: { id: 'transaction-1' },
          }).status
        ).toBeUndefined()
      })
      it('acknowledges a denied refund without downgrading PAID', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_ASAAS_SECRET', secret)
        const state = paymentState('PAID', 'BOLETO')
        expect(
          (
            await boleto(
              request({
                payment: { id: 'transaction-1', status: 'REFUND_DENIED' },
              })
            )
          ).status
        ).toBe(200)
        expect(state.status).toBe('PAID')
        expect(mocks.prisma.payment.updateMany).not.toHaveBeenCalled()
      })
    })

    describe('tenant-bound integration isolation', () => {
      it('a global legacy secret never authorizes an unconfigured tenant integration', async () => {
        vi.stubEnv('PIX_WEBHOOK_SECRET', secret)
        expect((await pix(request(hooks[0].body))).status).toBe(503)
        expect(mocks.prisma.payment.findFirst).not.toHaveBeenCalled()
      })
      it('rejects a valid signature for an unrelated integration credential', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', 'other-tenant-secret')
        expect((await pix(request(hooks[0].body))).status).toBe(401)
        expect(
          mocks.prisma.externalResourceTenant.findFirst
        ).not.toHaveBeenCalled()
      })
      it('an authenticated event cannot access resources outside its registry', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
        mocks.prisma.externalResourceTenant.findFirst.mockResolvedValue(null)
        expect((await pix(request(hooks[0].body))).status).toBe(404)
        expect(mocks.prisma.payment.findFirst).not.toHaveBeenCalled()
      })
      it('does not use the tenant supplied by the payload', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_PIX_SECRET', secret)
        paymentState('PENDING')
        expect(
          (
            await pix(
              request({ ...hooks[0].body, tenantId: 'attacker-tenant' })
            )
          ).status
        ).toBe(200)
        expect(mocks.prisma.payment.findFirst).toHaveBeenCalledWith({
          where: { id: 'payment-1', tenantId: 'tenant-1' },
        })
        expect(mocks.processPayment.mock.calls[0]?.[0]).toEqual({
          tenantId: 'tenant-1',
        })
      })
      it('refuses WhatsApp events for another phone account', async () => {
        vi.stubEnv('LOCADORA_INTEGRATION_WHATSAPP_SECRET', secret)
        const body = {
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: { phone_number_id: 'other-account' },
                    messages: [],
                  },
                },
              ],
            },
          ],
        }
        expect(
          (await whatsapp(request(body, 'x-hub-signature-256', 'sha256=')))
            .status
        ).toBe(403)
        expect(mocks.prisma.whatsAppMessage.upsert).not.toHaveBeenCalled()
      })
      it('only enumerates active organizations for a cron', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        mocks.lateFees.mockResolvedValue({ updated: 0 })
        mocks.prisma.organization.findMany.mockResolvedValue([
          { id: 'tenant-A' },
          { id: 'tenant-B' },
        ])
        expect((await lateFees(cronRequest())).status).toBe(200)
        expect(mocks.prisma.organization.findMany).toHaveBeenCalledWith({
          where: { status: 'ACTIVE' },
          select: { id: true },
        })
        expect(mocks.lateFees.mock.calls).toEqual([
          [{ tenantId: 'tenant-A' }],
          [{ tenantId: 'tenant-B' }],
        ])
      })
      it('keeps the global Merchant integration quarantined even for an authorized cron', async () => {
        vi.stubEnv('CRON_SECRET', secret)
        expect((await merchant(cronRequest())).status).toBe(503)
        expect(mocks.sync).not.toHaveBeenCalled()
      })
    })
  }
)
