import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { PublicPlansResponseSchema } from '@gb-locacoes/contracts/subscription'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/tenant-principal'
import { signInParityUser } from './identity'
import { startReceivingAccountFixture } from './receiving-account'
import { emailLinks, emailsTo, startResendFixture } from './resend-provider'
import { legacyRunning, otherTarget } from './targets'

/** B3: successful contracts use the canonical disposable database/roles and real production HTTP hosts. */
const original = inject('apiParity')
const run = randomUUID()
const appOrigin = 'https://app.platform.test'
const rootToken = 'synthetic-platform-success-root-' + run
const mailKey = 're_platform_success_' + run
const hdr = new Uint8Array([
  ...new TextEncoder().encode(
    '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n'
  ),
  0xff,
  0x80,
  0x00,
  0xc0,
])
// A unique valid filename keeps persisted Next fetch caches from replacing this run's provider evidence.
const hdrPath = 'hdri/fixture_' + run.replaceAll('-', '') + '.hdr'
const hdrUrl =
  'https://raw.githubusercontent.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/' +
  hdrPath
const hdrRequests: Array<{ url: string; method: string }> = []
let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>
let resend: Awaited<ReturnType<typeof startResendFixture>>
let scope: ReturnType<typeof createPlatformScope>
let version = ''
const subscriptions: string[] = []

beforeAll(async () => {
  resend = await startResendFixture(mailKey)
  fixture = await startReceivingAccountFixture(original, {
    interceptHosts: ['raw.githubusercontent.com'],
    async provider(url, init) {
      hdrRequests.push({ url, method: init.method ?? 'GET' })
      if (url !== hdrUrl)
        return new Response('Unexpected fixture asset', { status: 404 })
      return new Response(hdr, {
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    },
    env: {
      PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256: createHash('sha256')
        .update(rootToken)
        .digest('hex'),
      PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256: '',
      RESEND_API_KEY: mailKey,
      RESEND_BASE_URL: resend.origin,
      FROM_EMAIL: 'Plataforma <no-reply@platform.test>',
    },
  })
  scope = createPlatformScope(fixture.platform)
  version = await scope.withPlatformTransaction(async (tx) => {
    // Only this fixture's database: make the expected published catalogue explicit.
    await tx.plan.updateMany({ data: { isPublic: false } })
    const plan = await tx.plan.create({
      data: {
        code: 'success-' + run.slice(0, 8),
        name: 'Synthetic public plan',
        isPublic: true,
      },
    })
    const offer = await tx.planVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        amount: '149.90',
        trialDays: 14,
        sellableFrom: new Date(Date.now() - 86_400_000),
        entitlements: {
          schema: 1,
          limits: { equipments: 20, staffSeats: 3 },
          features: Object.fromEntries(
            ENTITLEMENT_FEATURES.map((key) => [key, true])
          ),
        },
      },
    })
    await tx.planVersion.create({
      data: {
        planId: plan.id,
        version: 2,
        amount: '199.90',
        sellableFrom: new Date(Date.now() + 86_400_000),
        entitlements: offer.entitlements!,
      },
    })
    return offer.id
  })
  for (const [index, owner] of fixture.owners.entries())
    subscriptions[index] = await scope.withProvisioningTransaction(
      owner.tenantId,
      async (tx) => {
        const sub = await tx.subscription.create({
          data:
            index % 2 === 0
              ? {
                  tenantId: owner.tenantId,
                  planVersionId: version,
                  status: 'ACTIVE',
                  billingMode: 'COMPLIMENTARY',
                  complimentaryReason: 'SYNTHETIC_FIXTURE',
                  complimentaryUntil: new Date(Date.now() + 30 * 86_400_000),
                }
              : {
                  tenantId: owner.tenantId,
                  planVersionId: version,
                  status: 'ACTIVE',
                  billingMode: 'ASAAS',
                  providerEnvironment: 'sandbox',
                  providerSubscriptionId:
                    'synthetic-success-' + index + '-' + run,
                },
        })
        await tx.organization.update({
          where: { id: owner.tenantId },
          data: { access: 'FULL', sitePublishedAt: null },
        })
        return sub.id
      }
    )
}, 240_000)

afterAll(async () => {
  try {
    await fixture?.stop()
  } finally {
    await resend?.close()
  }
}, 30_000)

for (const [index, name] of ['legacy', 'service'].entries()) {
  if (index === 0 && !legacyRunning(original)) continue
  describe(`successful platform contracts at ${name}`, () => {
    const host = () => (index ? fixture.context.api : fixture.context.legacy!)
    const owner = () => fixture.owners[index * 2]!
    const edge = () => ({
      'x-platform-edge-auth': fixture.context.secret,
      'x-platform-host-kind': 'app',
      'x-platform-origin': appOrigin,
      'x-platform-client-ip': fixture.context.directory.ips[40 + index]!,
    })
    const post = (
      endpoint: string,
      body: unknown = {},
      headers: Record<string, string> = {},
      target = host()
    ) =>
      fetch(target + endpoint, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          ...edge(),
          Origin: appOrigin,
          'Sec-Fetch-Site': 'same-origin',
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      })

    it('auxiliary identity GET/POST succeeds in coexistence and is explicitly retired after cutover', async () => {
      const get = await fetch(host() + '/api/auth/v2/get-session', {
        headers: edge(),
        redirect: 'manual',
      })
      const out = await post('/api/auth/v2/sign-out')
      if (original.identity.mode === 'legacy') {
        expect(get.status).toBe(200)
        expect(await get.json()).toBeNull()
        expect(get.headers.get('cache-control')).toBe('no-store')
        expect(out.status).toBe(200)
        expect(await out.json()).toEqual({ success: true })
      } else {
        for (const response of [get, out]) {
          expect(response.status).toBe(410)
          expect(await response.json()).toEqual({
            error: 'Use /api/auth after cutover',
          })
        }
      }
    })

    it('reads only the currently sellable public offer through the isolated platform role', async () => {
      const response = await fetch(host() + '/api/public/plans')
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=0, s-maxage=60'
      )
      expect(response.headers.get('set-cookie')).toBeNull()
      const body = PublicPlansResponseSchema.parse(await response.json())
      expect(body.plans).toHaveLength(1)
      expect(body.plans[0]).toEqual({
        planVersionId: version,
        code: 'success-' + run.slice(0, 8),
        name: 'Synthetic public plan',
        version: 1,
        interval: 'MONTHLY',
        amount: '149.90',
        trialDays: 14,
        entitlements: {
          schema: 1,
          limits: { equipments: 20, staffSeats: 3 },
          features: Object.fromEntries(
            ENTITLEMENT_FEATURES.map((key) => [key, true])
          ),
        },
      })
    })

    it('publishes after the first equipment and commits exactly one publication audit across a replay', async () => {
      const tenantId = owner().tenantId
      const cookie = await signInParityUser(fixture.context, edge(), index * 2)
      const headers = { Cookie: cookie, 'x-tenant-id': tenantId }
      const refused = await post('/api/admin/site/publish', {}, headers)
      expect(refused.status).toBe(409)
      expect(await refused.json()).toMatchObject({
        code: 'FIRST_EQUIPMENT_REQUIRED',
      })
      await withTenantTransaction(
        fixture.business,
        { tenantId },
        async (tx) => {
          const category = await tx.category.create({
            data: {
              tenantId,
              name: 'Synthetic publication',
              slug: 'publication',
            },
          })
          await tx.equipment.create({
            data: {
              tenantId,
              categoryId: category.id,
              name: 'First synthetic equipment',
              pricePerDay: '10.00',
              images: [],
            },
          })
        }
      )
      const response = await post('/api/admin/site/publish', {}, headers)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      const body = await response.json()
      const persisted = await fixture.prisma.organization.findUniqueOrThrow({
        where: { id: tenantId },
      })
      expect(persisted.sitePublishedAt).toBeInstanceOf(Date)
      expect(body).toEqual({
        published: true,
        publishedAt: persisted.sitePublishedAt!.toISOString(),
      })
      const replay = await post(
        '/api/admin/site/publish',
        {},
        headers,
        otherTarget(fixture.context, host())
      )
      expect(replay.status).toBe(200)
      expect(await replay.json()).toEqual(body)
      expect(
        await fixture.prisma.platformAuditLog.count({
          where: {
            tenantId,
            action: 'SITE_PUBLISHED',
            actorUserId: owner().user.id,
          },
        })
      ).toBe(1)
      expect(
        (
          await fixture.prisma.organization.findUniqueOrThrow({
            where: { id: fixture.owners[index * 2 + 1]!.tenantId },
          })
        ).sitePublishedAt
      ).toBeNull()
    })

    it('serves pinned HDR bytes through the local provider with the production binary/cache contract', async () => {
      const before = hdrRequests.length
      const response = await fetch(host() + '/api/drei-proxy/' + hdrPath)
      expect(response.status).toBe(200)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(hdr)
      expect(response.headers.get('content-type')).toBe(
        'application/octet-stream'
      )
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable'
      )
      expect(response.headers.get('access-control-allow-origin')).toBeNull()
      expect(hdrRequests.slice(before)).toEqual([
        { url: hdrUrl, method: 'GET' },
      ])
    })

    it('acknowledges a root receipt only after inbox/outbox commit and deduplicates the cross-host replay', async () => {
      const tenantId = fixture.owners[index * 2 + 1]!.tenantId
      const eventId = 'successful-root-' + index + '-' + run
      const body = {
        id: eventId,
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay-' + eventId,
          status: 'RECEIVED',
          value: 149.9,
          subscription: 'synthetic-success-' + (index * 2 + 1) + '-' + run,
        },
      }
      const headers = { 'asaas-access-token': rootToken }
      const response = await post('/api/webhooks/asaas/platform', body, headers)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        accepted: true,
        duplicate: false,
      })
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      const receipt =
        await fixture.prisma.platformWebhookInbox.findUniqueOrThrow({
          where: {
            source_eventId: { source: 'ASAAS_ROOT', eventId: 'id:' + eventId },
          },
        })
      expect(receipt).toMatchObject({
        tenantId,
        sourceEnvironment: 'sandbox',
        status: 'RECEIVED',
        processedAt: null,
        payloadHash: createHash('sha256')
          .update(JSON.stringify(body))
          .digest('hex'),
      })
      const queued = () =>
        fixture.prisma.platformOutboxEvent.count({
          where: {
            tenantId,
            aggregateId: receipt.id,
            topic: 'subscriptions.invoice.webhook',
            status: 'PENDING',
          },
        })
      expect(await queued()).toBe(1)
      const replay = await post(
        '/api/webhooks/asaas/platform',
        body,
        headers,
        otherTarget(fixture.context, host())
      )
      expect(replay.status).toBe(200)
      expect(await replay.json()).toEqual({ accepted: true, duplicate: true })
      expect(await queued()).toBe(1)
      expect(await fixture.prisma.webhookInbox.count()).toBe(0)
      expect(
        await fixture.prisma.platformInvoice.count({ where: { tenantId } })
      ).toBe(0)
      expect(
        (
          await fixture.prisma.subscription.findUniqueOrThrow({
            where: { id: subscriptions[index * 2 + 1] },
          })
        ).status
      ).toBe('ACTIVE')
    })

    it.skipIf(original.identity.mode !== 'better-auth')(
      'verifies the real e-mail token without a callback as JSON after cutover',
      async () => {
        const email = `verify-success-${index}-${run}@example.test`
        const registered = await post('/api/auth/register', {
          email,
          name: 'Synthetic verification',
          password: 'synthetic-verification-password',
          phone: '11999990000',
          cpf: 'synthetic-' + index + '-' + run,
        })
        expect(registered.status).toBe(202)
        await expect
          .poll(async () => (await emailsTo(resend.origin, email)).length, {
            timeout: 15_000,
          })
          .toBe(1)
        const message = (await emailsTo(resend.origin, email))[0]!
        const links = emailLinks(message)
          .map((value) => new URL(value))
          .filter((url) => url.pathname === '/api/auth/verify-email')
        expect(links).toHaveLength(1)
        const link = links[0]!
        expect(link.origin).toBe(appOrigin)
        expect(link.searchParams.get('token')).toBeTruthy()
        link.searchParams.delete('callbackURL')
        expect(
          (await fixture.prisma.user.findUniqueOrThrow({ where: { email } }))
            .authEmailVerified
        ).toBe(false)
        const response = await fetch(host() + link.pathname + link.search, {
          headers: edge(),
          redirect: 'manual',
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ status: true, user: null })
        expect(
          (await fixture.prisma.user.findUniqueOrThrow({ where: { email } }))
            .authEmailVerified
        ).toBe(true)
      }
    )
  })
}
