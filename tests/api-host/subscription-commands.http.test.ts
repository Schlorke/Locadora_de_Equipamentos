import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { OwnerSubscriptionActionResponseSchema } from '@gb-locacoes/contracts/subscription'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { signInParityUser } from './identity'
import { startReceivingAccountFixture } from './receiving-account'
import { legacyRunning, otherTarget } from './targets'

/**
 * Onda 135 (B5): os quatro comandos do dono sobre a assinatura da plataforma (`activate`, `cancel`, `undo-cancel` e
 * `reactivate`) em HTTP real, nos hosts da rodada, com sessão real, papel de plataforma isolado e banco próprio da
 * fixture de recebimentos. Os comandos não fazem I/O de provedor na requisição: a ativação só registra a intenção e
 * enfileira a emissão para o worker isolado. Sem a raiz (API_LEGACY_MODE=absent) só o braço do serviço roda e a
 * repetição da mesma chave é feita na própria API (duas chamadas reais).
 */
const original = inject('apiParity')
const appOrigin = 'https://app.platform.test'
const prefix = '/api/admin/subscription/'
const ISSUE_TOPIC = 'subscriptions.provider-sync'
const LEGAL_KINDS = [
  'PLATFORM_TERMS',
  'PRIVACY_POLICY',
  'DATA_PROCESSING_AGREEMENT',
  'PAYMENTS_PARTNER_NOTICE',
] as const
const run = randomUUID().replaceAll('-', '').slice(0, 12)
let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>
let scope: ReturnType<typeof createPlatformScope>
let version = ''

beforeAll(async () => {
  fixture = await startReceivingAccountFixture(original)
  scope = createPlatformScope(fixture.platform)
  version = await scope.withPlatformTransaction(async (tx) => {
    // `plans.code` is ^[a-z0-9-]{2,32}$.
    const plan = await tx.plan.create({
      data: {
        code: 'owner-cmd-' + run,
        name: 'Synthetic owner commands',
        isPublic: true,
      },
    })
    return (
      await tx.planVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          amount: '149.90',
          entitlements: {
            schema: 1,
            limits: { equipments: 20, staffSeats: 3 },
            features: Object.fromEntries(
              ENTITLEMENT_FEATURES.map((key) => [key, true])
            ),
          },
          sellableFrom: new Date(Date.now() - 86_400_000),
        },
      })
    ).id
  })
  for (const [index, owner] of fixture.owners.entries()) {
    // Pares por host: a primeira locadora tem uma cortesia ativa (cancelar e desfazer); a segunda espera a ativação
    // paga, com o perfil de cobrança e os aceites que a emissão exige.
    const awaitingActivation = index % 2 === 1
    await scope.withProvisioningTransaction(owner.tenantId, async (tx) => {
      await tx.organization.update({
        where: { id: owner.tenantId },
        data: {
          legalName: 'Locadora Sintetica ' + index + ' Ltda',
          billingEmail: `billing-${run}-${index}@example.test`,
        },
      })
      await tx.subscription.create({
        data: awaitingActivation
          ? {
              tenantId: owner.tenantId,
              planVersionId: version,
              status: 'INCOMPLETE',
              billingMode: 'ASAAS',
              providerSync: 'NOT_REQUIRED',
            }
          : {
              tenantId: owner.tenantId,
              planVersionId: version,
              status: 'ACTIVE',
              billingMode: 'COMPLIMENTARY',
              complimentaryReason: 'SYNTHETIC_FIXTURE',
              complimentaryUntil: new Date(Date.now() + 30 * 86_400_000),
            },
      })
    })
    if (awaitingActivation)
      for (const kind of LEGAL_KINDS)
        await fixture.prisma.legalAcceptance.create({
          data: {
            userId: owner.user.id,
            tenantId: owner.tenantId,
            kind,
            version: 'synthetic-not-legal-text',
            textSha256: 'a'.repeat(64),
            acceptedAt: new Date(Date.now() - 60_000),
          },
        })
  }
}, 240000)
afterAll(async () => {
  await fixture?.stop()
}, 30000)

for (const [index, name] of ['legacy', 'service'].entries()) {
  // Sem a raiz só o braço do serviço roda, com os mesmos donos da fixture (onda 135, E1).
  if (index === 0 && !legacyRunning(original)) continue
  describe(`owner subscription commands over HTTP at ${name}`, () => {
    let cookie = '',
      otherCookie = ''
    const host = () => (index ? fixture.context.api : fixture.context.legacy!)
    const replayHost = () => otherTarget(fixture.context, host())
    // A locadora com a cortesia e a que espera a ativação; o dono da primeira é ADMIN (não dono) da segunda.
    const owner = () => fixture.owners[index * 2]!
    const other = () => fixture.owners[index * 2 + 1]!
    const edge = () => ({
      'x-platform-edge-auth': fixture.context.secret,
      'x-platform-host-kind': 'app',
      'x-platform-origin': appOrigin,
      'x-platform-client-ip': fixture.context.directory.ips[58 + index * 2]!,
    })
    const command = (
      action: 'activate' | 'cancel' | 'undo-cancel' | 'reactivate',
      options: {
        key?: string | null
        tenantId?: string
        jar?: string
        body?: unknown
        contentType?: string
        target?: string
      } = {}
    ) =>
      fetch((options.target ?? host()) + prefix + action, {
        method: 'POST',
        headers: {
          ...edge(),
          Origin: appOrigin,
          'Sec-Fetch-Site': 'same-origin',
          'x-tenant-id': options.tenantId ?? owner().tenantId,
          ...((options.jar ?? cookie) ? { Cookie: options.jar ?? cookie } : {}),
          ...(options.key === null
            ? {}
            : { 'Idempotency-Key': options.key ?? randomUUID() }),
          ...(options.body === undefined
            ? {}
            : { 'Content-Type': options.contentType ?? 'application/json' }),
        },
        ...(options.body === undefined
          ? {}
          : {
              body:
                typeof options.body === 'string'
                  ? options.body
                  : JSON.stringify(options.body),
            }),
      })
    async function reply(response: Response, status: number) {
      expect(response.status).toBe(status)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      return response.json()
    }
    const subscription = (tenantId: string) =>
      fixture.prisma.subscription.findFirstOrThrow({ where: { tenantId } })
    const receipts = (tenantId: string, reason?: string) =>
      fixture.prisma.subscriptionEvent.count({
        where: { tenantId, source: 'OWNER', ...(reason ? { reason } : {}) },
      })

    beforeAll(async () => {
      // Sessões novas: os comandos exigem autenticação de até 10 minutos (isFreshAuthentication).
      cookie = await signInParityUser(fixture.context, edge(), index * 2, {
        fresh: true,
      })
      otherCookie = await signInParityUser(
        fixture.context,
        {
          ...edge(),
          'x-platform-client-ip':
            fixture.context.directory.ips[59 + index * 2]!,
        },
        index * 2 + 1,
        { fresh: true }
      )
    }, 90000)

    it('cancel and undo-cancel: one owner receipt per key, the replay is accepted once and a key never changes action', async () => {
      const tenantId = owner().tenantId
      const cancelKey = 'cancel-' + randomUUID()
      expect(
        OwnerSubscriptionActionResponseSchema.parse(
          await reply(await command('cancel', { key: cancelKey }), 200)
        )
      ).toEqual({ accepted: true })
      const canceled = await subscription(tenantId)
      expect(canceled.cancelAtPeriodEnd).toBe(true)
      expect(canceled.cancelRequestedAt).not.toBeNull()
      expect(await receipts(tenantId, 'CANCEL_REQUESTED')).toBe(1)
      // A mesma intenção repetida (no outro host quando a raiz roda) é aceita sem outro recibo.
      expect(
        await reply(
          await command('cancel', { key: cancelKey, target: replayHost() }),
          200
        )
      ).toEqual({ accepted: true })
      expect(await receipts(tenantId, 'CANCEL_REQUESTED')).toBe(1)
      // A chave fica presa à ação que a usou.
      expect(
        await reply(await command('undo-cancel', { key: cancelKey }), 409)
      ).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
      expect((await subscription(tenantId)).cancelAtPeriodEnd).toBe(true)
      expect(
        await reply(
          await command('undo-cancel', {
            key: 'undo-' + randomUUID(),
            target: replayHost(),
          }),
          200
        )
      ).toEqual({ accepted: true })
      const restored = await subscription(tenantId)
      expect(restored.cancelAtPeriodEnd).toBe(false)
      expect(restored.cancelRequestedAt).toBeNull()
      expect(await receipts(tenantId, 'CANCEL_UNDONE')).toBe(1)
      expect(await receipts(tenantId)).toBe(2)
    })

    it('refuses before any change: no session, no key, a body beyond {}, a non-owner ADMIN and commands of another lifecycle', async () => {
      const tenantId = owner().tenantId
      const before = {
        own: await receipts(tenantId),
        other: await receipts(other().tenantId),
        subscription: await subscription(tenantId),
      }
      expect((await command('cancel', { jar: '' })).status).toBe(401)
      expect(
        await reply(await command('cancel', { key: null }), 400)
      ).toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' })
      expect((await command('cancel', { key: 'short' })).status).toBe(400)
      expect(
        (await command('cancel', { body: { reason: 'any' } })).status
      ).toBe(400)
      expect(
        (await command('cancel', { body: 'cancel', contentType: 'text/plain' }))
          .status
      ).toBe(415)
      // ADMIN da outra locadora sem ser o dono dela.
      for (const action of ['cancel', 'activate'] as const)
        expect(
          await reply(
            await command(action, { tenantId: other().tenantId }),
            403
          )
        ).toMatchObject({ code: 'OWNER_REQUIRED' })
      // Cortesia ativa: não há o que ativar nem o que reativar.
      expect(await reply(await command('activate'), 409)).toMatchObject({
        code: 'SUBSCRIPTION_NOT_ACTIVATABLE',
      })
      expect(
        await reply(
          await command('reactivate', { body: { planVersionId: version } }),
          409
        )
      ).toMatchObject({ code: 'SUBSCRIPTION_NOT_REACTIVATABLE' })
      expect((await command('reactivate', { body: {} })).status).toBe(400)
      expect(await receipts(tenantId)).toBe(before.own)
      expect(await receipts(other().tenantId)).toBe(before.other)
      expect(await subscription(tenantId)).toEqual(before.subscription)
    })

    it('activate: the owner intent is committed once and queued for the isolated issuance worker, with no provider I/O', async () => {
      const tenantId = other().tenantId
      const pending = await subscription(tenantId)
      const key = 'activate-' + randomUUID()
      const providerCalls = fixture.requests.length
      expect(
        await reply(
          await command('activate', { key, tenantId, jar: otherCookie }),
          200
        )
      ).toEqual({ accepted: true })
      const requested = await subscription(tenantId)
      expect(requested).toMatchObject({
        id: pending.id,
        status: 'INCOMPLETE',
        providerSync: 'PENDING',
        providerEnvironment: 'sandbox',
        providerSubscriptionId: null,
      })
      const queued = () =>
        fixture.prisma.platformOutboxEvent.count({
          where: { tenantId, topic: ISSUE_TOPIC, aggregateId: pending.id },
        })
      expect(await queued()).toBe(1)
      expect(await receipts(tenantId, 'ACTIVATION_REQUESTED')).toBe(1)
      expect(
        await reply(
          await command('activate', {
            key,
            tenantId,
            jar: otherCookie,
            target: replayHost(),
          }),
          200
        )
      ).toEqual({ accepted: true })
      expect(await queued()).toBe(1)
      expect(await receipts(tenantId, 'ACTIVATION_REQUESTED')).toBe(1)
      expect(fixture.requests.length).toBe(providerCalls)
    })

    it('reactivate: preserves canceled history, waives overdue debt and queues one new recurrence without provider I/O', async () => {
      const tenantId = other().tenantId
      const previous = await subscription(tenantId)
      const key = 'reactivate-' + randomUUID()
      const providerCalls = fixture.requests.length
      const invoices = await scope.withProvisioningTransaction(
        tenantId,
        async (tx) => {
          await tx.subscription.update({
            where: { id: previous.id },
            data: { status: 'CANCELED', canceledAt: new Date() },
          })
          const overdue = await tx.platformInvoice.create({
            data: {
              tenantId,
              subscriptionId: previous.id,
              providerPaymentId: 'overdue-' + randomUUID(),
              status: 'OVERDUE',
              amount: '149.90',
              dueDate: new Date(Date.now() - 2 * 86_400_000),
              syncedAt: new Date(),
            },
          })
          const paid = await tx.platformInvoice.create({
            data: {
              tenantId,
              subscriptionId: previous.id,
              providerPaymentId: 'paid-' + randomUUID(),
              status: 'PAID',
              amount: '149.90',
              dueDate: new Date(Date.now() - 30 * 86_400_000),
              paidAt: new Date(Date.now() - 29 * 86_400_000),
              syncedAt: new Date(),
            },
          })
          return { overdue, paid }
        }
      )
      const body = { planVersionId: version }
      expect(
        await reply(
          await command('reactivate', {
            key,
            tenantId,
            jar: otherCookie,
            body,
          }),
          200
        )
      ).toEqual({ accepted: true })
      const current = await fixture.prisma.subscription.findFirstOrThrow({
        where: { tenantId, status: { not: 'CANCELED' } },
      })
      expect(current.id).not.toBe(previous.id)
      expect(current).toMatchObject({
        planVersionId: version,
        status: 'INCOMPLETE',
        billingMode: 'ASAAS',
        providerEnvironment: 'sandbox',
        providerSubscriptionId: null,
        providerSync: 'NOT_REQUIRED',
      })
      expect(
        (
          await fixture.prisma.subscription.findUniqueOrThrow({
            where: { id: previous.id },
          })
        ).status
      ).toBe('CANCELED')
      expect(
        await fixture.prisma.platformInvoice.findUniqueOrThrow({
          where: { id: invoices.overdue.id },
        })
      ).toMatchObject({
        status: 'CANCELED',
        canceledReason: 'REACTIVATION_WAIVER',
        debtWaivedAt: expect.any(Date),
      })
      expect(
        await fixture.prisma.platformInvoice.findUniqueOrThrow({
          where: { id: invoices.paid.id },
        })
      ).toEqual(invoices.paid)
      expect(
        (
          await fixture.prisma.organization.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).access
      ).toBe('SETUP')
      expect(await receipts(tenantId, 'REACTIVATION_REQUESTED')).toBe(1)
      expect(
        await fixture.prisma.subscriptionEvent.count({
          where: {
            tenantId,
            subscriptionId: previous.id,
            reason: 'REACTIVATION_PREDECESSOR',
            dedupeKey: 'reactivation-predecessor:' + current.id,
          },
        })
      ).toBe(1)
      const queued = () =>
        fixture.prisma.platformOutboxEvent.findMany({
          where: {
            tenantId,
            topic: 'subscriptions.reactivate',
            aggregateId: current.id,
          },
        })
      expect(await queued()).toMatchObject([
        {
          payload: {
            subscriptionId: current.id,
            previousSubscriptionId: previous.id,
          },
          status: 'PENDING',
        },
      ])
      expect(
        await reply(
          await command('reactivate', {
            key,
            tenantId,
            jar: otherCookie,
            body,
            target: replayHost(),
          }),
          200
        )
      ).toEqual({ accepted: true })
      expect(
        await fixture.prisma.subscription.count({
          where: { tenantId, status: { not: 'CANCELED' } },
        })
      ).toBe(1)
      expect(await queued()).toHaveLength(1)
      expect(await receipts(tenantId, 'REACTIVATION_REQUESTED')).toBe(1)
      expect(fixture.requests.length).toBe(providerCalls)
    })
  })
}
