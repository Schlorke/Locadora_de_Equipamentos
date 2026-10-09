import { withTestPlatformTransaction } from '../helpers/platform-fixture'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { otherTarget, parityTargets } from './targets'

const context = inject('apiParity')
const hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID(),
  integration = randomUUID(),
  foreignIntegration = randomUUID(),
  extraIntegration = randomUUID()
const conversations = Array.from({ length: 3 }, () => randomUUID())
const sharedProviderId = 'local-status-' + randomUUID()
const digits = BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12))
  .toString()
  .slice(-7)
  .padStart(7, '0')
const phone = '+551199' + digits
const secret = 'local-whatsapp-parity-secret'
const ref = 'env:LOCADORA_INTEGRATION_WHATSAPP_PARITY'
const sendPath = '/api/integrations/whatsapp/send'
const threadPath =
  '/api/admin/whatsapp/conversations/' + conversations[0] + '/messages'
const hookPath = '/api/webhooks/whatsapp/' + integration
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[57]!,
}
let cookie = '',
  clientCookie = ''
type ProviderRequest = {
  path: string
  method: string
  authorization: string
  body: string
  providerMessageId: string
}
const providerRequests = async (): Promise<ProviderRequest[]> =>
  (await fetch(context.whatsappOrigin + '/__fixture/requests')).json()
async function clean() {
  const receipts = await prisma.webhookInbox.findMany({
    where: {
      integrationId: {
        in: [integration, foreignIntegration, extraIntegration],
      },
    },
    select: { id: true },
  })
  await prisma.outboxEvent.deleteMany({
    where: { aggregateId: { in: receipts.map((r) => r.id) } },
  })
  await prisma.webhookInbox.deleteMany({
    where: {
      integrationId: {
        in: [integration, foreignIntegration, extraIntegration],
      },
    },
  })
  await prisma.whatsAppMessage.deleteMany({
    where: { conversationId: { in: conversations } },
  })
}
async function send(
  host: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  jar = cookie
) {
  const response = await fetch(host + path, {
    method: 'POST',
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: jar,
      'x-tenant-id': context.alfa.id,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}
function event(account = '123456789', id = 'local-incoming-' + randomUUID()) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: account },
              messages: [
                {
                  from: phone.slice(1),
                  id,
                  type: 'text',
                  timestamp: '1760000000',
                  text: { body: 'Entrada local' },
                },
              ],
              contacts: [
                { wa_id: phone.slice(1), profile: { name: 'Contato local' } },
              ],
              statuses: [{ id: sharedProviderId, status: 'delivered' }],
            },
          },
        ],
      },
    ],
  }
}
async function webhook(host: string, value: unknown, signature?: string) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  const response = await fetch(host + hookPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256':
        signature ??
        'sha256=' + createHmac('sha256', secret).update(raw).digest('hex'),
    },
    body: raw,
  })
  return { status: response.status, body: await response.json() }
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  await prisma.tenantIntegration.createMany({
    data: [
      {
        id: integration,
        tenantId: context.alfa.id,
        provider: 'WHATSAPP',
        externalAccountId: '123456789',
        credentialsRef: ref,
      },
      {
        id: foreignIntegration,
        tenantId: context.bravo.id,
        provider: 'WHATSAPP',
        externalAccountId: '987654321',
        credentialsRef: 'env:LOCADORA_INTEGRATION_WHATSAPP_FOREIGN',
      },
      {
        id: extraIntegration,
        tenantId: context.alfa.id,
        provider: 'WHATSAPP',
        externalAccountId: '333333333',
        credentialsRef: ref,
        status: 'DISABLED',
      },
    ],
  })
  for (let n = 0; n < 3; n++)
    await prisma.whatsAppConversation.create({
      data: {
        id: conversations[n]!,
        tenantId: n === 0 ? context.alfa.id : n === 1 ? context.bravo.id : null,
        phone,
      },
    })
})
beforeEach(async () => {
  await clean()
  await fetch(context.whatsappOrigin + '/__fixture/requests', {
    method: 'DELETE',
  })
  await prisma.membership.update({
    where: { id: member },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
  await withTestPlatformTransaction(prisma, async (tx) =>
    tx.organization.update({
      where: { id: context.alfa.id },
      data: { status: 'ACTIVE' },
    })
  )
  await prisma.tenantIntegration.update({
    where: { id: integration },
    data: {
      status: 'ACTIVE',
      provider: 'WHATSAPP',
      credentialsRef: ref,
      externalAccountId: '123456789',
    },
  })
  await prisma.tenantIntegration.update({
    where: { id: extraIntegration },
    data: { status: 'DISABLED' },
  })
})
afterAll(async () => {
  try {
    await clean()
    await prisma.whatsAppConversation.deleteMany({
      where: { id: { in: conversations } },
    })
    await prisma.tenantIntegration.deleteMany({
      where: {
        id: { in: [integration, foreignIntegration, extraIntegration] },
      },
    })
    await prisma.membership.deleteMany({ where: { id: member } })
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'ACTIVE' },
      })
    )
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

describe.each(hosts)('WhatsApp writes and webhooks HTTP %s', (host) => {
  it.each([sendPath, threadPath])(
    'requires a real session and refuses current CLIENT membership: %s',
    async (path) => {
      expect((await send(host, path, '{', {}, '')).status).toBe(401)
      expect((await send(host, path, '{', {}, clientCookie)).status).toBe(403)
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each([sendPath, threadPath])(
    'rejects a sibling origin before any outbound effect: %s',
    async (path) => {
      expect(
        (await send(host, path, '{', { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(['FINANCIAL', 'REVOKED'] as const)(
    'rechecks membership %s before writes',
    async (state) => {
      await prisma.membership.update({
        where: { id: member },
        data: state === 'REVOKED' ? { status: 'REVOKED' } : { role: state },
      })
      for (const path of [sendPath, threadPath])
        expect((await send(host, path, '{')).status).toBe(403)
      expect(await providerRequests()).toEqual([])
    }
  )
  it('allows OPERATOR only on the administrative thread and preserves the DTO', async () => {
    await prisma.membership.update({
      where: { id: member },
      data: { role: 'OPERATOR' },
    })
    expect(
      await send(host, sendPath, { to: phone, message: 'local-only' })
    ).toEqual({ status: 403, body: { error: 'Forbidden' } })
    const result = await send(host, threadPath, {
      text: '  local-only  ',
      ignored: true,
    })
    expect(result.status).toBe(200)
    const request = (await providerRequests())[0]!
    const message = await prisma.whatsAppMessage.findUniqueOrThrow({
      where: { id: result.body.id },
    })
    expect(result.body).toEqual({
      id: message.id,
      conversationId: conversations[0],
      providerMessageId: request.providerMessageId,
      direction: 'OUTBOUND',
      type: 'TEXT',
      body: 'local-only',
      timestamp: message.timestamp.toISOString(),
      status: 'sent',
    })
    expect(message.tenantId).toBe(context.alfa.id)
    expect(request.path).toBe('/v21.0/123456789/messages')
    expect(request.authorization).toBe('Bearer local-whatsapp-parity-key')
    expect(JSON.parse(request.body)).toEqual({
      messaging_product: 'whatsapp',
      to: phone.slice(1),
      type: 'text',
      text: { body: 'local-only' },
    })
  })
  it.each([
    { label: 'foreign-tenant', id: conversations[1] },
    { label: 'unassigned-tenant', id: conversations[2] },
    { label: 'unknown', id: randomUUID() },
  ])('refuses $label conversation before Meta', async ({ id }) => {
    expect(
      await send(
        host,
        '/api/admin/whatsapp/conversations/' + id + '/messages',
        { text: 'local-only' }
      )
    ).toEqual({ status: 404, body: { error: 'Conversa não encontrada' } })
    expect(await providerRequests()).toEqual([])
  })
  it.each([
    {
      label: 'blank-message',
      body: { to: phone, message: '   ' },
      status: 400,
    },
    {
      label: 'oversized-message',
      body: { to: phone, message: 'x'.repeat(4097) },
      status: 400,
    },
    {
      label: 'unknown-field',
      body: { to: phone, message: 'local-only', extra: true },
      status: 400,
    },
    {
      label: 'unsupported-template',
      body: { to: phone, message: 'local-only', templateId: 'template' },
      status: 503,
    },
    {
      label: 'unsupported-variables',
      body: { to: phone, message: 'local-only', variables: {} },
      status: 503,
    },
    { label: 'malformed-json', body: '{', status: 502 },
  ])(
    'preserves strict integration validation and errors: $label',
    async ({ body, status }) => {
      expect((await send(host, sendPath, body)).status).toBe(status)
      expect(await providerRequests()).toEqual([])
      expect(
        await prisma.whatsAppMessage.count({
          where: { conversationId: conversations[0] },
        })
      ).toBe(0)
    }
  )
  it.each([sendPath, threadPath])(
    'persists processing before Meta responds, then sent: %s',
    async (path) => {
      const pending = send(
        host,
        path,
        path === sendPath
          ? { to: phone, message: ' local-provider-hold ', templateId: '' }
          : { text: ' local-provider-hold ' }
      )
      let heldId: string | undefined
      try {
        await expect.poll(async () => (await providerRequests()).length).toBe(1)
        heldId = (await providerRequests())[0]!.providerMessageId
        const persisted = await prisma.whatsAppMessage.findFirstOrThrow({
          where: {
            tenantId: context.alfa.id,
            conversationId: conversations[0],
          },
        })
        expect(persisted).toMatchObject({
          body: 'local-provider-hold',
          status: 'processing',
          providerMessageId: null,
          direction: 'OUTBOUND',
        })
        await fetch(context.whatsappOrigin + '/__fixture/release?id=' + heldId)
        expect((await pending).status).toBe(200)
        expect(
          await prisma.whatsAppMessage.findUnique({
            where: { id: persisted.id },
          })
        ).toMatchObject({ status: 'sent', providerMessageId: heldId })
      } finally {
        if (heldId)
          await fetch(
            context.whatsappOrigin + '/__fixture/release?id=' + heldId
          )
        await pending
      }
    }
  )
  it.each(['refused', 'no-id', 'invalid-json', 'network-error'])(
    'keeps unknown on provider %s without false confirmation or automatic retry',
    async (failure) => {
      const result = await send(host, sendPath, {
        to: phone,
        message: 'local-provider-' + failure,
      })
      expect(result).toEqual({
        status: 502,
        body: {
          error: 'Envio não confirmado; confira o histórico antes de reenviar',
        },
      })
      expect(await providerRequests()).toHaveLength(1)
      const messages = await prisma.whatsAppMessage.findMany({
        where: { conversationId: conversations[0] },
      })
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatchObject({
        tenantId: context.alfa.id,
        status: 'unknown',
        providerMessageId: null,
      })
    }
  )
  it.each(['missing', 'ambiguous', 'credential'] as const)(
    'fails closed for %s scoped configuration',
    async (reason) => {
      if (reason === 'missing')
        await prisma.tenantIntegration.update({
          where: { id: integration },
          data: { status: 'DISABLED' },
        })
      if (reason === 'ambiguous')
        await prisma.tenantIntegration.update({
          where: { id: extraIntegration },
          data: { status: 'ACTIVE' },
        })
      if (reason === 'credential')
        await prisma.tenantIntegration.update({
          where: { id: integration },
          data: { credentialsRef: 'env:LOCADORA_INTEGRATION_MISSING' },
        })
      expect(
        (await send(host, sendPath, { to: phone, message: 'local-only' }))
          .status
      ).toBe(503)
      expect(
        (await send(host, threadPath, { text: 'local-only' })).status
      ).toBe(500)
      expect(await providerRequests()).toEqual([])
    }
  )
  it('rejects an invalid recipient before persisting or contacting Meta', async () => {
    expect(
      (await send(host, sendPath, { to: 'abcdefgh', message: 'local-only' }))
        .status
    ).toBe(502)
    expect(await providerRequests()).toEqual([])
    expect(
      await prisma.whatsAppMessage.count({
        where: { conversationId: conversations[0] },
      })
    ).toBe(0)
  })
  it('preserves the integration-specific plain-text verification protocol', async () => {
    const query =
      '?hub.mode=subscribe&hub.verify_token=local-whatsapp-parity-verify&hub.challenge=12345'
    const good = await fetch(host + hookPath + query)
    expect(good.status).toBe(200)
    expect(good.headers.get('content-type')).toBe('text/plain')
    expect(await good.text()).toBe('12345')
    expect(
      (await fetch(host + hookPath + query.replace('parity-verify', 'wrong')))
        .status
    ).toBe(403)
    expect(
      (await fetch(host + hookPath + query.replace('subscribe', 'unsubscribe')))
        .status
    ).toBe(400)
    expect((await fetch(host + hookPath)).status).toBe(400)
    await prisma.tenantIntegration.update({
      where: { id: integration },
      data: { credentialsRef: 'env:LOCADORA_INTEGRATION_WHATSAPP_FOREIGN' },
    })
    expect((await fetch(host + hookPath + query)).status).toBe(403)
    expect(
      (
        await fetch(
          host + hookPath + query.replace('parity-verify', 'foreign-verify')
        )
      ).status
    ).toBe(200)
  })
  it.each(['DISABLED', 'OTHER_PROVIDER', 'MISSING_CREDENTIAL'] as const)(
    'refuses inactive verification configuration %s',
    async (state) => {
      await prisma.tenantIntegration.update({
        where: { id: integration },
        data:
          state === 'OTHER_PROVIDER'
            ? { provider: 'PIX' }
            : state === 'MISSING_CREDENTIAL'
              ? { credentialsRef: 'env:LOCADORA_INTEGRATION_MISSING' }
              : { status: state },
      })
      expect(
        (
          await fetch(
            host +
              hookPath +
              '?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1'
          )
        ).status
      ).toBe(503)
      expect((await webhook(host, event())).status).toBe(503)
    }
  )
  // The administrative block (Organization.status) does not switch the integration's authentication off: the receipt
  // is stored and deferred without business effects until the block is lifted, then processed once (wave 89 of
  // docs/features/shared-api-host.md; docs/architecture/adr-saas-subscription.md, webhook authentication "sem olhar
  // Organization.status"). The previous 503 expectation predated that decision.
  it('keeps a suspended locadora integration authenticated and defers the receipt without effects until unblocked', async () => {
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'SUSPENDED' },
      })
    )
    const verify =
      '?hub.mode=subscribe&hub.verify_token=local-whatsapp-parity-verify&hub.challenge=777'
    expect(
      (await fetch(host + hookPath + verify.replace('parity-verify', 'wrong')))
        .status
    ).toBe(403)
    const good = await fetch(host + hookPath + verify)
    expect(good.status).toBe(200)
    expect(await good.text()).toBe('777')
    const payload = event(),
      raw = JSON.stringify(payload),
      messageId = payload.entry[0]!.changes[0]!.value.messages[0]!.id
    for (const target of [host, ...hosts.filter((other) => other !== host)])
      expect(await webhook(target, raw)).toEqual({
        status: 200,
        body: { accepted: true, deferred: true },
      })
    const deferred = await prisma.webhookInbox.findMany({
      where: { integrationId: integration },
    })
    expect(deferred).toHaveLength(1)
    expect(deferred[0]).toMatchObject({
      tenantId: context.alfa.id,
      payloadHash: createHash('sha256').update(raw).digest('hex'),
      processedAt: null,
      processingToken: null,
      lockedUntil: null,
      lastError: null,
    })
    expect(
      await prisma.whatsAppMessage.count({
        where: { providerMessageId: messageId },
      })
    ).toBe(0)
    expect(await providerRequests()).toEqual([])
    await withTestPlatformTransaction(prisma, async (tx) =>
      tx.organization.update({
        where: { id: context.alfa.id },
        data: { status: 'ACTIVE' },
      })
    )
    expect(await webhook(host, raw)).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect(
      await prisma.whatsAppMessage.count({
        where: { providerMessageId: messageId },
      })
    ).toBe(1)
    const processed = await prisma.webhookInbox.findMany({
      where: { integrationId: integration },
    })
    expect(processed).toHaveLength(1)
    expect(processed[0]!.id).toBe(deferred[0]!.id)
    expect(processed[0]!.processedAt).toBeInstanceOf(Date)
    expect(await providerRequests()).toEqual([])
  })
  it.each(['missing', 'prefix', 'changed', 'wrong-secret'])(
    'checks raw-body HMAC %s before inbox or business effects',
    async (kind) => {
      const raw = JSON.stringify(event())
      const digest = createHmac(
        'sha256',
        kind === 'wrong-secret' ? 'local-whatsapp-foreign-secret' : secret
      )
        .update(kind === 'changed' ? raw + ' ' : raw)
        .digest('hex')
      expect(
        (
          await webhook(
            host,
            raw,
            kind === 'missing'
              ? ''
              : kind === 'prefix'
                ? digest
                : 'sha256=' + digest
          )
        ).status
      ).toBe(401)
      expect(
        await prisma.webhookInbox.count({
          where: { integrationId: integration },
        })
      ).toBe(0)
      expect(
        await prisma.whatsAppMessage.count({
          where: { conversationId: conversations[0] },
        })
      ).toBe(0)
    }
  )
  it('preserves body size, JSON, schema and account mismatch errors', async () => {
    expect((await webhook(host, 'x'.repeat(2 * 1024 * 1024 + 1))).status).toBe(
      413
    )
    expect(await webhook(host, '{')).toEqual({
      status: 400,
      body: { error: 'Invalid JSON' },
    })
    expect(await webhook(host, {})).toEqual({
      status: 400,
      body: { error: 'Invalid payload' },
    })
    expect(await webhook(host, event('987654321'))).toEqual({
      status: 403,
      body: { error: 'Webhook account mismatch' },
    })
  })
  it('persists inbound data and scoped statuses once with durable inbox/outbox, replaying across both hosts', async () => {
    for (let n = 0; n < 3; n++)
      await prisma.whatsAppMessage.create({
        data: {
          tenantId:
            n === 0 ? context.alfa.id : n === 1 ? context.bravo.id : null,
          conversationId: conversations[n]!,
          direction: 'OUTBOUND',
          providerMessageId: sharedProviderId,
          body: 'Old local',
          status: 'sent',
          timestamp: new Date(),
        },
      })
    const payload = event(),
      raw = JSON.stringify(payload),
      messageId = payload.entry[0]!.changes[0]!.value.messages[0]!.id
    expect(await webhook(host, raw)).toEqual({
      status: 200,
      body: { ok: true },
    })
    expect(
      // Segunda entrega real: no outro host enquanto coexistem, na própria API sem a raiz (onda 135, E1).
      await webhook(otherTarget(context, host), raw)
    ).toEqual({ status: 200, body: { success: true, duplicate: true } })
    expect(
      await prisma.whatsAppMessage.count({
        where: { providerMessageId: messageId },
      })
    ).toBe(1)
    expect(
      await prisma.whatsAppMessage.findFirst({
        where: { providerMessageId: messageId },
      })
    ).toMatchObject({
      tenantId: context.alfa.id,
      conversationId: conversations[0],
      direction: 'INBOUND',
      type: 'TEXT',
      body: 'Entrada local',
      timestamp: new Date(1760000000 * 1000),
    })
    expect(
      await prisma.whatsAppConversation.findUnique({
        where: { id: conversations[0] },
      })
    ).toMatchObject({
      displayName: 'Contato local',
      lastMessageAt: new Date(1760000000 * 1000),
    })
    for (let n = 0; n < 3; n++)
      expect(
        (
          await prisma.whatsAppMessage.findFirstOrThrow({
            where: {
              conversationId: conversations[n],
              providerMessageId: sharedProviderId,
            },
          })
        ).status
      ).toBe(n === 0 ? 'delivered' : 'sent')
    const receipts = await prisma.webhookInbox.findMany({
      where: { integrationId: integration },
    })
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toMatchObject({
      tenantId: context.alfa.id,
      payloadHash: createHash('sha256').update(raw).digest('hex'),
      processingToken: null,
      lockedUntil: null,
      lastError: null,
    })
    expect(receipts[0]!.processedAt).toBeInstanceOf(Date)
    expect(
      await prisma.outboxEvent.findMany({
        where: { aggregateId: receipts[0]!.id },
      })
    ).toMatchObject([
      {
        tenantId: context.alfa.id,
        topic: 'webhook.process',
        dedupeKey: context.alfa.id + ':webhook:' + receipts[0]!.id,
      },
    ])
    expect(await providerRequests()).toEqual([])
  })
  it('selects the other tenant account, token and conversation on a membership switch', async () => {
    const result = await send(
      host,
      '/api/admin/whatsapp/conversations/' + conversations[1] + '/messages',
      { text: 'local-bravo' },
      { 'x-tenant-id': context.bravo.id }
    )
    expect(result.status).toBe(200)
    expect(result.body.conversationId).toBe(conversations[1])
    const request = (await providerRequests())[0]!
    expect(request.path).toBe('/v21.0/987654321/messages')
    expect(request.authorization).toBe('Bearer local-whatsapp-foreign-key')
    expect(
      await prisma.whatsAppMessage.findUnique({ where: { id: result.body.id } })
    ).toMatchObject({
      tenantId: context.bravo.id,
      body: 'local-bravo',
      status: 'sent',
    })
    expect(
      await prisma.whatsAppMessage.count({
        where: { conversationId: conversations[0] },
      })
    ).toBe(0)
  })
  it.each(['same-host', 'both-hosts'])(
    'accepts concurrent receipts (%s) without losing, duplicating or requiring a persistence retry',
    async (topology) => {
      const payload = event()
      const results = await Promise.all(
        (topology === 'same-host' ? [host, host] : hosts).map((target) =>
          webhook(target, payload)
        )
      )
      for (const result of results) {
        expect([200, 202], JSON.stringify(results)).toContain(result.status)
      }
      expect(results.some((result) => result.status === 200)).toBe(true)
      expect(
        await prisma.webhookInbox.count({
          where: { integrationId: integration },
        })
      ).toBe(1)
      const receipt = await prisma.webhookInbox.findFirstOrThrow({
        where: { integrationId: integration },
      })
      expect(receipt.processedAt).toBeInstanceOf(Date)
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: receipt.id } })
      ).toBe(1)
      expect(
        await prisma.whatsAppMessage.count({
          where: {
            providerMessageId:
              payload.entry[0]!.changes[0]!.value.messages[0]!.id,
          },
        })
      ).toBe(1)
      expect(await webhook(host, payload)).toEqual({
        status: 200,
        body: { success: true, duplicate: true },
      })
    }
  )
  it.each(['GET', 'POST'])(
    'keeps the unscoped webhook URL retired with 410 (%s)',
    async (method) => {
      const response = await fetch(host + '/api/webhooks/whatsapp', { method })
      expect(response.status).toBe(410)
      expect(await response.json()).toEqual({
        error: 'Integration-specific webhook URL required',
      })
    }
  )
})
