import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import {
  ConnectAsaasAccountResponseSchema,
  PaymentAccountResponseSchema,
  AccountRecoveryResponseSchema,
} from '@gb-locacoes/contracts/payment-account'
import { withTenantTransaction } from '../../packages/backend/src/modules/identity/index'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { sessionCookies, signInParityUser } from './identity'
import { requestWeb, startWebConsumer } from './web-consumer'
import { startReceivingAccountFixture } from './receiving-account'
import { legacyRunning } from './targets'

const original = inject('apiParity')
let fixture: Awaited<ReturnType<typeof startReceivingAccountFixture>>
const endpoint = '/api/admin/payment-account/connect'
const appOrigin = 'https://app.platform.test'
beforeAll(async () => {
  fixture = await startReceivingAccountFixture(original)
}, 180000)
afterAll(async () => {
  await fixture?.stop()
}, 30000)

async function privateBody(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(
    response.headers
      .get('vary')
      ?.toLowerCase()
      .split(/\s*,\s*/)
  ).toEqual(expect.arrayContaining(['cookie', 'host']))
  const text = await response.text()
  for (const owner of fixture.owners) expect(text).not.toContain(owner.apiKey)
  return JSON.parse(text)
}

for (const [index, name] of ['legacy', 'service'].entries()) {
  // Sem a raiz (API_LEGACY_MODE=absent) só o braço do serviço roda, com os mesmos donos da fixture (onda 135, E1).
  if (index === 0 && !legacyRunning(original)) continue
  describe(`owner connection through the compiled proxy to ${name}`, () => {
    let web: Awaited<ReturnType<typeof startWebConsumer>>
    let cookie: string, otherCookie: string
    const owner = () => fixture.owners[index * 2]!
    const other = () => fixture.owners[index * 2 + 1]!
    const headers = () => ({
      Host: 'app.platform.test',
      Origin: appOrigin,
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      Cookie: cookie,
      'x-tenant-id': owner().tenantId,
    })
    const connect = (body: unknown, extra: Record<string, string> = {}) =>
      requestWeb(web.origin + endpoint, {
        method: 'POST',
        headers: { ...headers(), ...extra },
        body: JSON.stringify(body),
      })
    const read = (extra: Record<string, string> = {}) =>
      requestWeb(web.origin + '/api/admin/payment-account', {
        headers: { ...headers(), ...extra },
      })

    beforeAll(async () => {
      web = await startWebConsumer(
        fixture.context,
        index ? fixture.context.api : fixture.context.legacy!
      )
      const edge = {
        'x-platform-edge-auth': fixture.context.secret,
        'x-platform-host-kind': 'app',
        'x-platform-origin': appOrigin,
        'x-platform-client-ip': fixture.context.directory.ips[55 + index * 2]!,
      }
      cookie = await signInParityUser(fixture.context, edge, index * 2, {
        fresh: true,
      })
      otherCookie = await signInParityUser(
        fixture.context,
        {
          ...edge,
          'x-platform-client-ip':
            fixture.context.directory.ips[56 + index * 2]!,
        },
        index * 2 + 1,
        { fresh: true }
      )
    }, 90000)
    afterAll(async () => {
      await web?.stop()
    })

    it('reads the current owner account as absent using the real business role', async () => {
      expect(await privateBody(await read(), 200)).toEqual({ account: null })
    })

    it('wave 134: with the creation switch absent, the offer is unavailable and a request is refused without effects', async () => {
      const create = '/api/admin/payment-account/create'
      expect(
        await privateBody(
          await requestWeb(web.origin + create, { headers: headers() }),
          200
        )
      ).toEqual({
        available: false,
        blocker: 'CREATION_UNAVAILABLE',
        model: null,
        company: null,
        suggestedMobilePhone: null,
        companyDataVersion: null,
        lastRequestOutcome: null,
      })
      expect(
        await privateBody(
          await requestWeb(web.origin + create, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              incomeValue: '98765.43',
              mobilePhone: '11987654321',
              companyDataConfirmed: true,
              companyDataVersion: 'a'.repeat(64),
            }),
          }),
          409
        )
      ).toMatchObject({ code: 'PAYMENT_ACCOUNT_CREATION_UNAVAILABLE' })
      expect(
        await fixture.prisma.paymentAccount.count({
          where: { tenantId: owner().tenantId },
        })
      ).toBe(0)
    })

    it('refuses an ADMIN who is not the selected company owner before any provider call', async () => {
      const before = fixture.requests.length
      expect(
        await privateBody(
          await connect(
            { apiKey: owner().apiKey },
            {
              'x-tenant-id': other().tenantId,
            }
          ),
          403
        )
      ).toMatchObject({ code: 'OWNER_REQUIRED' })
      expect(fixture.requests).toHaveLength(before)
    })

    it('requires the provider company document to match without creating any secret or account', async () => {
      expect(
        await privateBody(await connect({ apiKey: other().apiKey }), 409)
      ).toMatchObject({
        code: 'ACCOUNT_DOCUMENT_MISMATCH',
      })
      expect(
        await fixture.prisma.paymentAccount.count({
          where: { tenantId: owner().tenantId },
        })
      ).toBe(0)
      expect(
        await fixture.prisma.integrationSecret.count({
          where: { tenantId: owner().tenantId },
        })
      ).toBe(0)
    })

    it('rejects caller-supplied environment and sibling origin without provider I/O', async () => {
      const before = fixture.requests.length
      await privateBody(
        await connect({ apiKey: owner().apiKey, environment: 'production' }),
        400
      )
      await privateBody(
        await connect(
          { apiKey: owner().apiKey },
          { Origin: 'https://bravo.platform.test' }
        ),
        403
      )
      expect(fixture.requests).toHaveLength(before)
    })

    it('accepts the fresh owner and atomically stores ciphertext, account and audit while retaining restriction', async () => {
      const response = await privateBody(
        await connect({ apiKey: owner().apiKey }),
        202
      )
      expect(ConnectAsaasAccountResponseSchema.parse(response)).toEqual({
        accepted: true,
      })
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
        include: { integration: { include: { secrets: true } } },
      })
      expect(account).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'WEBHOOK_MISSING',
        approvedAt: null,
        providerAccountId: null,
        mode: 'ASAAS_CONNECTED_ACCOUNT',
      })
      expect(account.integration).toMatchObject({
        status: 'PROVISIONING',
        credentialSource: 'VAULT',
        credentialsRef: null,
      })
      expect(account.integration.secrets).toHaveLength(1)
      expect(account.integration.secrets[0]?.state).toBe('ACTIVE')
      expect(
        Buffer.from(account.integration.secrets[0]!.ciphertext!).toString()
      ).not.toContain(owner().apiKey)
      const audits = await fixture.prisma.platformAuditLog.findMany({
        where: {
          tenantId: owner().tenantId,
          action: 'payment-account.connected',
        },
      })
      expect(audits).toHaveLength(1)
      expect(JSON.stringify(audits)).not.toContain(owner().apiKey)
      const projection = PaymentAccountResponseSchema.parse(
        await privateBody(await read(), 200)
      )
      expect(projection.account).toMatchObject({
        status: 'RESTRICTED',
        healthIssue: 'WEBHOOK_MISSING',
      })
      expect(JSON.stringify(projection)).not.toContain(account.integrationId)
      expect(
        fixture.requests.filter((entry) => entry.owner === index * 2)
      ).toEqual([
        {
          owner: index * 2,
          method: 'GET',
          path: '/v3/myAccount/commercialInfo/',
        },
        { owner: index * 2, method: 'GET', path: '/v3/myAccount/status/' },
      ])
    })

    it('returns the same strict receipt for simultaneous retries without another provider read or record', async () => {
      const before = fixture.requests.length
      for (const response of await Promise.all([
        connect({ apiKey: owner().apiKey }),
        connect({ apiKey: owner().apiKey }),
      ]))
        expect(await privateBody(response, 202)).toEqual({ accepted: true })
      expect(fixture.requests).toHaveLength(before)
      for (const count of [
        fixture.prisma.paymentAccount.count({
          where: { tenantId: owner().tenantId },
        }),
        fixture.prisma.integrationSecret.count({
          where: { tenantId: owner().tenantId },
        }),
        fixture.prisma.platformAuditLog.count({
          where: {
            tenantId: owner().tenantId,
            action: 'payment-account.connected',
          },
        }),
      ])
        expect(await count).toBe(1)
    })

    it('uses a real selection cookie and refuses a conflicting company header', async () => {
      const selection = await requestWeb(
        web.origin + '/api/auth/organizations/selection',
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ tenantId: owner().tenantId }),
        }
      )
      expect(selection.status).toBe(200)
      expect(selection.headers.get('cache-control')).toBe('no-store')
      expect((await selection.json()).selection.tenant.id).toBe(
        owner().tenantId
      )
      const selectedCookie = sessionCookies(selection, cookie)
      expect(selectedCookie).toContain('selected-tenant-id=')
      const cookieHeaders = new Headers(headers())
      cookieHeaders.set('Cookie', selectedCookie)
      cookieHeaders.delete('x-tenant-id')
      const before = fixture.requests.length
      expect(
        await privateBody(
          await requestWeb(web.origin + endpoint, {
            method: 'POST',
            headers: cookieHeaders,
            body: JSON.stringify({ apiKey: owner().apiKey }),
          }),
          202
        )
      ).toEqual({ accepted: true })
      cookieHeaders.set('x-tenant-id', other().tenantId)
      await privateBody(
        await requestWeb(web.origin + endpoint, {
          method: 'POST',
          headers: cookieHeaders,
          body: JSON.stringify({ apiKey: owner().apiKey }),
        }),
        400
      )
      expect(fixture.requests).toHaveLength(before)
    })

    it('does not replace the connected credential or expose it to the other owner', async () => {
      const before = fixture.requests.length
      expect(
        await privateBody(await connect({ apiKey: other().apiKey }), 409)
      ).toMatchObject({
        code: 'PAYMENT_ACCOUNT_ALREADY_EXISTS',
      })
      expect(fixture.requests).toHaveLength(before)
      expect(
        await privateBody(
          await read({ Cookie: otherCookie, 'x-tenant-id': other().tenantId }),
          200
        )
      ).toEqual({ account: null })
      await privateBody(await read({ 'x-tenant-id': other().tenantId }), 403)
      const hidden = await withTenantTransaction(
        fixture.business,
        { tenantId: other().tenantId },
        (tx) =>
          tx.paymentAccount.findMany({ where: { tenantId: owner().tenantId } })
      )
      expect(hidden).toEqual([])
    })

    it('reads only recovery receipts for the current account incident and key, with canonical role isolation', async () => {
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
      })
      const key = await fixture.prisma.integrationSecret.findFirstOrThrow({
        where: { integrationId: account.integrationId, state: 'ACTIVE' },
      })
      await createPlatformScope(fixture.platform).withProvisioningTransaction(
        owner().tenantId,
        async (tx) => {
          await tx.platformOutboxEvent.updateMany({
            where: {
              tenantId: owner().tenantId,
              topic: 'payment-accounts.health',
            },
            data: { status: 'COMPLETED', lockedUntil: null, lockedBy: null },
          })
          await tx.paymentAccount.update({
            where: { id: account.id },
            data: {
              healthIssue: 'WEBHOOK_INTERRUPTED',
              lastErrorCode: 'WEBHOOK_RECONCILIATION_REQUIRED',
              nextAttemptAt: new Date(Date.now() + 120000),
              lockedUntil: null,
            },
          })
          const incident = await tx.platformAuditLog.create({
            data: {
              tenantId: owner().tenantId,
              actorKind: 'SYSTEM',
              action: 'payment-account.reconciliation.started',
              targetType: 'PaymentAccount',
              targetId: account.id,
            },
          })
          await tx.platformAuditLog.create({
            data: {
              tenantId: owner().tenantId,
              actorKind: 'SYSTEM',
              action: 'payment-account.reconciliation.progress',
              targetType: 'PaymentAccount',
              targetId: account.id,
              metadata: {
                incidentId: incident.id,
                keyId: key.id,
                complete: true,
                checked: 17,
              },
            },
          })
        }
      )
      const body = await privateBody(
        await requestWeb(web.origin + '/api/admin/payment-account/recovery', {
          headers: headers(),
        }),
        200
      )
      expect(AccountRecoveryResponseSchema.parse(body)).toMatchObject({
        recovery: {
          state: 'SNAPSHOT_COMPLETE',
          checked: 17,
          canRequest: true,
          requestPending: false,
        },
      })
      for (const internal of [account.id, account.integrationId, key.id])
        expect(JSON.stringify(body)).not.toContain(internal)
      await expect(
        createPlatformScope(fixture.platform).withProvisioningTransaction(
          owner().tenantId,
          (tx) => tx.payment.count()
        )
      ).rejects.toThrow()
      await expect(
        withTenantTransaction(
          fixture.business,
          { tenantId: owner().tenantId },
          (tx) => tx.platformAuditLog.count()
        )
      ).rejects.toThrow()
    })
    it('refuses non-owner ADMIN and sibling origin and never sends a provider request from recovery HTTP', async () => {
      const before = fixture.requests.length
      const path = web.origin + '/api/admin/payment-account/recovery'
      await privateBody(
        await requestWeb(path, {
          headers: { ...headers(), 'x-tenant-id': other().tenantId },
        }),
        403
      )
      expect(
        await privateBody(
          await requestWeb(path, {
            headers: {
              ...headers(),
              'x-tenant-id': other().tenantId,
              Cookie: otherCookie,
            },
          }),
          200
        )
      ).toEqual({ recovery: null })
      await privateBody(
        await requestWeb(path, {
          method: 'POST',
          headers: { ...headers(), Origin: 'https://bravo.platform.test' },
          body: '{"confirmation":true}',
        }),
        403
      )
      await privateBody(
        await requestWeb(path, {
          method: 'POST',
          headers: headers(),
          body: '{"confirmation":true,"resume":true}',
        }),
        400
      )
      expect(fixture.requests).toHaveLength(before)
    })
    it('queues one explicit recovery under concurrent real owner requests, preserves backoff and never approves', async () => {
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
      })
      const before = fixture.requests.length
      const previous = await fixture.prisma.platformAuditLog.findFirstOrThrow({
        where: {
          tenantId: owner().tenantId,
          targetId: account.id,
          action: 'payment-account.reconciliation.started',
        },
        orderBy: { createdAt: 'desc' },
      })
      const path = web.origin + '/api/admin/payment-account/recovery'
      for (const response of await Promise.all(
        [0, 1].map(() =>
          requestWeb(path, {
            method: 'POST',
            headers: headers(),
            body: '{"confirmation":true}',
          })
        )
      ))
        expect(await privateBody(response, 202)).toEqual({ accepted: true })
      const events = await fixture.prisma.platformOutboxEvent.findMany({
        where: {
          tenantId: owner().tenantId,
          topic: 'payment-accounts.health',
          status: 'PENDING',
        },
      })
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        aggregateId: account.id,
        payload: { accountId: account.id },
        availableAt: account.nextAttemptAt,
      })
      expect(
        await fixture.prisma.platformAuditLog.count({
          where: {
            tenantId: owner().tenantId,
            action: 'payment-account.reconciliation.requested',
          },
        })
      ).toBe(1)
      expect(
        await fixture.prisma.paymentAccount.findUniqueOrThrow({
          where: { id: account.id },
        })
      ).toMatchObject({
        status: 'RESTRICTED',
        approvedAt: null,
        healthIssue: 'WEBHOOK_INTERRUPTED',
        nextAttemptAt: account.nextAttemptAt,
        lockedUntil: null,
      })
      expect(
        await privateBody(await requestWeb(path, { headers: headers() }), 200)
      ).toMatchObject({
        recovery: {
          requestPending: true,
          canRequest: false,
          state: 'WAITING',
          checked: 0,
        },
      })
      const current = await fixture.prisma.platformAuditLog.findFirstOrThrow({
        where: {
          tenantId: owner().tenantId,
          targetId: account.id,
          action: 'payment-account.reconciliation.started',
        },
        orderBy: { createdAt: 'desc' },
      })
      expect(current).toMatchObject({
        actorKind: 'OWNER',
        reasonCategory: 'OWNER_RECHECK_REQUESTED',
        metadata: {
          previousIncidentId: previous.id,
          keyId: expect.any(String),
        },
      })
      expect(current.id).not.toBe(previous.id)
      expect(
        await fixture.prisma.platformAuditLog.findUnique({
          where: { id: previous.id },
        })
      ).toEqual(previous)
      expect(
        await fixture.prisma.platformAuditLog.findFirst({
          where: {
            tenantId: owner().tenantId,
            action: 'payment-account.reconciliation.progress',
            metadata: { path: ['incidentId'], equals: previous.id },
          },
        })
      ).toMatchObject({ metadata: { checked: 17, complete: true } })
      expect(fixture.requests).toHaveLength(before)
    })
    it('a completed snapshot refresh reuses the waiting retry without advancing its deadline or bypassing a claim', async () => {
      const account = await fixture.prisma.paymentAccount.findFirstOrThrow({
        where: { tenantId: owner().tenantId },
      })
      const incident = await fixture.prisma.platformAuditLog.findFirstOrThrow({
        where: {
          tenantId: owner().tenantId,
          targetId: account.id,
          action: 'payment-account.reconciliation.started',
        },
        orderBy: { createdAt: 'desc' },
      })
      const key = await fixture.prisma.integrationSecret.findFirstOrThrow({
        where: { integrationId: account.integrationId, state: 'ACTIVE' },
      })
      await createPlatformScope(fixture.platform).withProvisioningTransaction(
        owner().tenantId,
        (tx) =>
          tx.platformAuditLog.create({
            data: {
              tenantId: owner().tenantId,
              actorKind: 'SYSTEM',
              action: 'payment-account.reconciliation.progress',
              targetType: 'PaymentAccount',
              targetId: account.id,
              metadata: {
                incidentId: incident.id,
                keyId: key.id,
                checked: 20,
                complete: true,
              },
            },
          })
      )
      const event = await fixture.prisma.platformOutboxEvent.findFirstOrThrow({
        where: {
          tenantId: owner().tenantId,
          topic: 'payment-accounts.health',
          status: 'PENDING',
        },
      })
      const path = web.origin + '/api/admin/payment-account/recovery'
      expect(
        await privateBody(await requestWeb(path, { headers: headers() }), 200)
      ).toMatchObject({
        recovery: {
          state: 'SNAPSHOT_COMPLETE',
          checked: 20,
          canRequest: true,
          requestPending: true,
        },
      })
      const before = fixture.requests.length
      const audits = await fixture.prisma.platformAuditLog.count({
        where: {
          tenantId: owner().tenantId,
          action: 'payment-account.reconciliation.started',
        },
      })
      for (const response of await Promise.all(
        [0, 1].map(() =>
          requestWeb(path, {
            method: 'POST',
            headers: headers(),
            body: '{"confirmation":true}',
          })
        )
      ))
        expect(await privateBody(response, 202)).toEqual({ accepted: true })
      expect(
        await fixture.prisma.platformOutboxEvent.findUnique({
          where: { id: event.id },
        })
      ).toEqual(event)
      expect(
        await fixture.prisma.platformOutboxEvent.count({
          where: {
            tenantId: owner().tenantId,
            topic: 'payment-accounts.health',
            status: 'PENDING',
          },
        })
      ).toBe(1)
      expect(
        await fixture.prisma.platformAuditLog.count({
          where: {
            tenantId: owner().tenantId,
            action: 'payment-account.reconciliation.started',
          },
        })
      ).toBe(audits + 1)
      expect(
        await privateBody(await requestWeb(path, { headers: headers() }), 200)
      ).toMatchObject({
        recovery: { state: 'WAITING', checked: 0, canRequest: false },
      })
      const fresh = await fixture.prisma.platformAuditLog.findFirstOrThrow({
        where: {
          tenantId: owner().tenantId,
          action: 'payment-account.reconciliation.started',
        },
        orderBy: { createdAt: 'desc' },
      })
      await createPlatformScope(fixture.platform).withProvisioningTransaction(
        owner().tenantId,
        async (tx) => {
          await tx.platformAuditLog.create({
            data: {
              tenantId: owner().tenantId,
              actorKind: 'SYSTEM',
              action: 'payment-account.reconciliation.progress',
              targetType: 'PaymentAccount',
              targetId: account.id,
              metadata: {
                incidentId: fresh.id,
                keyId: key.id,
                checked: 20,
                complete: true,
              },
            },
          })
          await tx.platformOutboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSING',
              lockedBy: 'fixture-worker',
              lockedUntil: new Date(Date.now() + 300000),
            },
          })
        }
      )
      expect(
        await privateBody(await requestWeb(path, { headers: headers() }), 200)
      ).toMatchObject({ recovery: { canRequest: false, requestPending: true } })
      expect(
        await privateBody(
          await requestWeb(path, {
            method: 'POST',
            headers: headers(),
            body: '{"confirmation":true}',
          }),
          202
        )
      ).toEqual({ accepted: true })
      expect(
        await fixture.prisma.platformAuditLog.count({
          where: {
            tenantId: owner().tenantId,
            action: 'payment-account.reconciliation.started',
          },
        })
      ).toBe(audits + 1)
      expect(fixture.requests).toHaveLength(before)
    })

    it('uses an isolated platform login and never issues a provider write', async () => {
      const roles = await fixture.platform.$queryRaw<Array<{ safe: boolean }>>`
        SELECT current_user=session_user AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
        AS safe FROM pg_roles WHERE rolname=current_user
      `
      expect(roles).toEqual([{ safe: true }])
      expect(fixture.requests.every((entry) => entry.method === 'GET')).toBe(
        true
      )
      await expect(fixture.platform.payment.findMany()).rejects.toThrow()
    })
  })
}
