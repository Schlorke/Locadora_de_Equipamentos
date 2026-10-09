import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const accountId = '9007199254740993123',
  folderId = '9007199254740993124',
  messageId = '9007199254740993125'
const user = context.identity.users[1]!.id
const memberId = randomUUID(),
  tokenId = randomUUID(),
  foreignTokenId = randomUUID()
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[59]!,
}
const prefix = '/api/admin/zoho-mail'
const queries = `accountId=${accountId}&folderId=${folderId}`
const body = {
  fromAddress: 'mail@example.test',
  toAddress: 'recipient@example.test',
  ccAddress: '',
  bccAddress: '',
  subject: 'Local mutation',
  content: '<script>hi & bye</script>\nNext',
}
const routes: Array<{
  name: string
  method: string
  route: string
  body: Record<string, unknown> | undefined
}> = [
  { name: 'send', method: 'POST', route: prefix + '/messages/send', body },
  {
    name: 'reply',
    method: 'POST',
    route: prefix + '/messages/' + messageId + '/reply',
    body,
  },
  {
    name: 'draft',
    method: 'POST',
    route: prefix + '/messages/drafts',
    body: {
      ...body,
      draftFolderId: folderId,
      draftMessageId: '9007199254740993129',
    },
  },
  {
    name: 'update',
    method: 'PUT',
    route: prefix + '/messages/update',
    body: { action: 'read', messageIds: [messageId] },
  },
  {
    name: 'delete',
    method: 'DELETE',
    route:
      prefix +
      '/messages/' +
      messageId +
      '/delete?' +
      queries +
      '&expunge=true',
    body: undefined,
  },
  {
    name: 'upload',
    method: 'POST',
    route: prefix + '/attachments/upload',
    body: undefined,
  },
]
let requestIndex = 0
function payload(operation: (typeof routes)[number]) {
  if (operation.name !== 'upload')
    return operation.body === undefined
      ? undefined
      : JSON.stringify(operation.body)
  const form = new FormData()
  form.append(
    'files',
    new File([new Uint8Array([0, 127, 255, 13, 10])], 'Mail.txt', {
      type: 'text/plain',
    })
  )
  return form
}
let cookie = '',
  clientCookie = ''
async function providerRequests() {
  return (
    await fetch(context.zohoOrigin + '/__fixture/requests')
  ).json() as Promise<
    Array<{
      path: string
      method: string
      authorization: string
      body: string
      files?: Array<{ name: string; size: number; bytes: number[] }>
    }>
  >
}
async function request(
  host: string,
  operation: (typeof routes)[number],
  extra: Record<string, string> = {},
  jar = cookie,
  sent: string | FormData | undefined = payload(operation)
) {
  const response = await fetch(host + operation.route, {
    method: operation.method,
    body: sent,
    headers: {
      ...edge,
      'x-platform-client-ip': context.directory.ips[(requestIndex++ % 50) + 1]!,
      Cookie: jar,
      Origin: edge['x-platform-origin'],
      'x-tenant-id': context.alfa.id,
      ...(operation.name === 'upload'
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...extra,
    },
    redirect: 'manual',
  })
  return {
    status: response.status,
    body: response.headers.get('content-type')?.startsWith('application/json')
      ? await response.json()
      : await response.text(),
    headers: response.headers,
  }
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  await prisma.membership.create({
    data: {
      id: memberId,
      tenantId: context.alfa.id,
      userId: user,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  await prisma.zohoMailToken.createMany({
    data: [
      {
        id: tokenId,
        tenantId: context.alfa.id,
        userId: user,
        accessToken: 'local-access-a',
        refreshToken: 'local-refresh-a',
        accountId,
        datacenter: 'com',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      {
        id: foreignTokenId,
        tenantId: context.bravo.id,
        userId: user,
        accessToken: 'foreign-fixture-token',
        refreshToken: 'foreign-refresh-fixture',
        accountId: 'foreign-account',
        datacenter: 'com',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ],
  })
})
beforeEach(async () => {
  await fetch(context.zohoOrigin + '/__fixture/requests', { method: 'DELETE' })
  await prisma.membership.update({
    where: { id: memberId },
    data: { status: 'ACTIVE', role: 'ADMIN' },
  })
  await prisma.zohoMailToken.update({
    where: { id: tokenId },
    data: {
      accessToken: 'local-access-a',
      refreshToken: 'local-refresh-a',
      datacenter: 'com',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  })
})
afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      tenantId: context.alfa.id,
      userId: user,
      entity: 'EMAIL',
      action: 'SEND',
    },
  })
  await prisma.zohoMailToken.deleteMany({
    where: { id: { in: [tokenId, foreignTokenId] } },
  })
  await prisma.membership.deleteMany({ where: { id: memberId } })
  await prisma.$disconnect()
  await pool.end()
})
/** Corpo de sucesso esperado de cada operação de e-mail, montado da fixture (onda 135, B2). */
function expectedZohoBody(name: string): unknown {
  if (name === 'draft') return { success: true, draftId: '9007199254740993130' }
  if (name === 'update')
    return { success: true, result: { status: { code: 200 } } }
  if (name === 'upload')
    return {
      attachments: [
        {
          storeName: 'fixture',
          attachmentName: 'Mail.txt',
          attachmentPath: 'fixture/Mail.txt',
          fileName: 'Mail.txt',
          size: 5,
        },
      ],
    }
  if (['send', 'reply', 'delete'].includes(name)) return { success: true }
  throw new Error('Unknown Zoho mutation fixture')
}
describe('Zoho writes HTTP parity with real sessions, RLS and local transport', () => {
  it.each(routes)(
    '$name denies missing session before provider',
    async (op) => {
      for (const host of hosts) {
        const r = await request(host, op, {}, '')
        expect(r.status).toBe(401)
        expect(r.body).toEqual({ error: 'Authentication required' })
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes)(
    '$name denies global ADMIN with CLIENT membership',
    async (op) => {
      for (const host of hosts) {
        const r = await request(host, op, {}, clientCookie)
        expect(r.status).toBe(403)
        expect(r.body).toEqual({ error: 'Acesso negado' })
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes)('$name denies sibling Origin before provider', async (op) => {
    for (const host of hosts)
      expect(
        (await request(host, op, { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
    expect(await providerRequests()).toEqual([])
  })
  it.each(routes)(
    '$name immediately refuses revoked membership',
    async (op) => {
      await prisma.membership.update({
        where: { id: memberId },
        data: { status: 'REVOKED' },
      })
      for (const host of hosts)
        expect((await request(host, op)).status).toBe(403)
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes)(
    '$name preserves successful payload, audit and scoped provider token',
    async (op) => {
      const before = await prisma.auditLog.count({
        where: {
          tenantId: context.alfa.id,
          userId: user,
          action: 'SEND',
          entity: 'EMAIL',
        },
      })
      const bodies: Awaited<ReturnType<typeof request>>['body'][] = []
      for (const host of hosts) {
        const r = await request(host, op)
        expect(r.status).toBe(200)
        expect(r.body).toEqual(expectedZohoBody(op.name))
        bodies.push(r.body)
      }
      const calls = await providerRequests()
      // Chamadas ao provedor por host da rodada (onda 135, B2): duas no rascunho, uma nas demais.
      expect(calls).toHaveLength((op.name === 'draft' ? 2 : 1) * hosts.length)
      expect(
        calls.every(
          (row) => row.authorization === 'Zoho-oauthtoken local-access-a'
        )
      ).toBe(true)
      if (op.name === 'send' || op.name === 'reply' || op.name === 'draft') {
        const sent = JSON.parse(calls[0]!.body)
        expect(sent.content).toBe(
          '&lt;script&gt;hi &amp; bye&lt;/script&gt;<br>\nNext'
        )
        expect(sent.toAddress).toBe(body.toAddress)
        expect(sent).not.toHaveProperty('ccAddress')
        expect(sent).not.toHaveProperty('bccAddress')
        if (op.name === 'reply') expect(sent.action).toBe('Reply')
        if (op.name === 'draft') {
          expect(bodies[0]).toEqual({
            success: true,
            draftId: '9007199254740993130',
          })
          expect(calls[1]!.method).toBe('DELETE')
          expect(calls[1]!.path).toContain(
            '/' + folderId + '/messages/9007199254740993129'
          )
        }
      }
      if (op.name === 'delete') expect(calls[0]!.path).toContain('expunge=true')
      if (op.name === 'upload') {
        expect(calls[0]!.files).toEqual([
          { name: 'Mail.txt', size: 5, bytes: [0, 127, 255, 13, 10] },
        ])
        expect(bodies[0].attachments[0]).toMatchObject({
          storeName: 'fixture',
          attachmentName: 'Mail.txt',
          fileName: 'Mail.txt',
          size: 5,
        })
      }
      const after = await prisma.auditLog.count({
        where: {
          tenantId: context.alfa.id,
          userId: user,
          action: 'SEND',
          entity: 'EMAIL',
        },
      })
      expect(after - before).toBe(
        op.name === 'send' || op.name === 'reply' ? hosts.length : 0
      )
      expect(
        (
          await prisma.zohoMailToken.findUniqueOrThrow({
            where: { id: foreignTokenId },
          })
        ).accessToken
      ).toBe('foreign-fixture-token')
    }
  )
  it.each([
    ['archive', 'archiveMails'],
    ['unarchive', 'unArchiveMails'],
    ['read', 'markAsRead'],
    ['unread', 'markAsUnread'],
    ['move', 'moveMessage'],
    ['star', 'setFlag'],
    ['unstar', 'setFlag'],
    ['spam', 'moveToSpam'],
    ['notspam', 'markNotSpam'],
  ])(
    'preserves update %s raw long integers and thread preference',
    async (action, mode) => {
      const op = {
        ...routes[3]!,
        body: {
          action,
          messageIds: [messageId],
          threadIds: ['9007199254740993128'],
          targetFolderId: folderId,
          sourceFolderId: '9007199254740993122',
          isArchive: true,
          isFolderSpecific: true,
        },
      }
      for (const host of hosts)
        expect((await request(host, op)).status).toBe(200)
      const calls = await providerRequests()
      // Uma chamada ao provedor por host da rodada, cada uma conferida contra o corpo esperado (onda 135, B2).
      expect(calls).toHaveLength(hosts.length)
      for (const call of calls) {
        expect(call.body).toContain('"mode":"' + mode + '"')
        expect(call.body).toContain('"threadId":[9007199254740993128]')
        expect(call.body.includes('"messageId"')).toBe(action === 'move')
        if (action === 'move')
          expect(call.body).toContain('"destfolderId":9007199254740993124')
      }
    }
  )
  it.each(routes.slice(0, 3))(
    '$name retains invalid JSON and schema issues before provider',
    async (op) => {
      for (const host of hosts) {
        const json = await request(host, op, {}, cookie, '{')
        expect(json.status).toBe(400)
        expect(json.body).toEqual({ error: 'Corpo da requisição inválido' })
        const r = await request(
          host,
          op,
          {},
          cookie,
          JSON.stringify({ ...op.body, ccAddress: undefined })
        )
        expect(r.status).toBe(400)
        expect(r.body.details).toEqual(
          expect.arrayContaining([
            {
              field: 'ccAddress',
              message: 'Invalid input: expected string, received undefined',
            },
          ])
        )
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes.slice(0, 2))(
    '$name retains process-scoped cached response before parsing/audit',
    async (op) => {
      const key = randomUUID(),
        before = await prisma.auditLog.count({
          where: {
            tenantId: context.alfa.id,
            userId: user,
            entity: 'EMAIL',
            action: 'SEND',
          },
        })
      for (const host of hosts) {
        expect(
          (await request(host, op, { 'x-idempotency-key': key })).status
        ).toBe(200)
        const cached = await request(
          host,
          op,
          { 'x-idempotency-key': key },
          cookie,
          '{'
        )
        expect(cached.status).toBe(200)
        expect(cached.body).toEqual({ success: true })
      }
      expect(await providerRequests()).toHaveLength(hosts.length)
      expect(
        await prisma.auditLog.count({
          where: {
            tenantId: context.alfa.id,
            userId: user,
            entity: 'EMAIL',
            action: 'SEND',
          },
        })
      ).toBe(before + hosts.length)
    }
  )
  it('keeps foreign account delete refusal before reading its token', async () => {
    for (const host of hosts)
      expect(
        (
          await request(host, {
            ...routes[4]!,
            route: routes[4]!.route.replace(accountId, 'foreign-account'),
          })
        ).status
      ).toBe(403)
    expect(await providerRequests()).toEqual([])
  })
  it.each(routes.slice(0, 3))(
    '$name preserves provider failure envelope',
    async (op) => {
      for (const host of hosts) {
        const r = await request(host, {
          ...op,
          body: { ...op.body, subject: 'provider-failure' },
        })
        expect(r.status).toBe(500)
        expect(r.body).toEqual({ error: 'fixture throttled' })
      }
    }
  )
  it('accepts OPERATOR but rejects FINANCIAL without transport', async () => {
    await prisma.membership.update({
      where: { id: memberId },
      data: { role: 'OPERATOR' },
    })
    for (const host of hosts)
      expect((await request(host, routes[3]!)).status).toBe(200)
    await fetch(context.zohoOrigin + '/__fixture/requests', {
      method: 'DELETE',
    })
    await prisma.membership.update({
      where: { id: memberId },
      data: { role: 'FINANCIAL' },
    })
    for (const host of hosts)
      expect((await request(host, routes[3]!)).status).toBe(403)
    expect(await providerRequests()).toEqual([])
  })
  it('retains strict limit ahead of token, body and cache', async () => {
    const fixed = { 'x-platform-client-ip': context.directory.ips[58]! }
    const op = routes[0]!
    for (const host of hosts) {
      for (let i = 0; i < 10; i++)
        expect((await request(host, op, fixed, cookie, '{')).status).toBe(400)
      const r = await request(host, op, fixed)
      expect(r.status).toBe(429)
      expect(r.headers.get('x-ratelimit-limit')).toBe('10')
      expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0)
    }
    expect(await providerRequests()).toEqual([])
  })
})
