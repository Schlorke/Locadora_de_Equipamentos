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
const routes = [
  `${prefix}/accounts`,
  `${prefix}/folders?${queries}`,
  `${prefix}/messages?${queries}&limit=250&start=9`,
  `${prefix}/messages/${messageId}?${queries}`,
  `${prefix}/messages/${messageId}/attachments/9007199254740993126?${queries}&filename=%C3%A1%20Mail.pdf`,
  `${prefix}/messages/${messageId}/inline?${queries}&contentId=logo%5B1%5D&fileName=Logo.png`,
]
let cookie = '',
  clientCookie = ''
async function providerRequests() {
  return (
    await fetch(context.zohoOrigin + '/__fixture/requests')
  ).json() as Promise<
    Array<{ path: string; method: string; authorization: string }>
  >
}
async function request(
  host: string,
  route: string,
  extra: Record<string, string> = {},
  jar = cookie
) {
  const response = await fetch(host + route, {
    headers: {
      ...edge,
      Cookie: jar,
      Origin: edge['x-platform-origin'],
      'x-tenant-id': context.alfa.id,
      ...extra,
    },
    redirect: 'manual',
  })
  if (response.headers.get('content-type')?.startsWith('application/json'))
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    }
  return {
    status: response.status,
    body: [...new Uint8Array(await response.arrayBuffer())],
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
  await prisma.zohoMailToken.deleteMany({
    where: { id: { in: [tokenId, foreignTokenId] } },
  })
  await prisma.membership.deleteMany({ where: { id: memberId } })
  await prisma.$disconnect()
  await pool.end()
})
/** Mensagem completa esperada da leitura, montada do dublê do Zoho (onda 135, B2). */
function expectedZohoMessage(): unknown {
  const inline = `${prefix}/messages/${messageId}/inline?accountId=${accountId}&folderId=${folderId}&contentId=`
  const content = `<img src="${inline}logo%5B1%5D&fileName=Logo.png"><img src="${inline}other&fileName=Other.png">`
  return {
    message: {
      messageId,
      subject: 'Local mail',
      fromAddress: { displayName: 'Ana', emailAddress: 'ana@example.test' },
      toAddress: [{ displayName: 'Bob', emailAddress: 'bob@example.test' }],
      receivedTime: 1700000000000,
      isRead: false,
      hasAttachments: true,
      attachments: [
        { attachmentId: '9007199254740993126', fileName: 'Mail.pdf', size: 5 },
      ],
      htmlContent: content,
      content,
    },
  }
}
describe('Zoho read HTTP parity using real sessions, RLS and a local provider', () => {
  it.each(routes)(
    'denies missing session before Zoho for %s',
    async (route) => {
      for (const host of hosts) {
        const r = await request(host, route, {}, '')
        expect(r.status).toBe(401)
        expect(r.body).toEqual({ error: 'Authentication required' })
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes)(
    'denies global ADMIN with CLIENT membership for %s',
    async (route) => {
      for (const host of hosts) {
        const r = await request(host, route, {}, clientCookie)
        expect(r.status).toBe(403)
        expect(r.body).toEqual({ error: 'Acesso negado' })
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(routes)('denies sibling Origin before Zoho for %s', async (route) => {
    for (const host of hosts)
      expect(
        (await request(host, route, { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
    expect(await providerRequests()).toEqual([])
  })
  it.each(routes.slice(1))(
    'rejects an account belonging to the other tenant for %s',
    async (route) => {
      for (const host of hosts) {
        const r = await request(
          host,
          route.replace(accountId, 'foreign-account')
        )
        expect(r.status).toBe(403)
        expect(r.body).toEqual({
          error: 'Conta de e-mail não autorizada nesta locadora',
        })
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it('lists provider accounts with exact large IDs and the token of the current tenant', async () => {
    for (const host of hosts) {
      const r = await request(host, routes[0]!)
      expect(r.status).toBe(200)
      expect(r.body).toEqual({
        accounts: [{ accountId, primaryEmailAddress: 'mail@example.test' }],
      })
    }
    expect((await providerRequests()).map((row) => row.authorization)).toEqual(
      hosts.map(() => 'Zoho-oauthtoken local-access-a')
    )
  })
  it('lists folders and preserves list normalization and pagination', async () => {
    for (const host of hosts) {
      expect((await request(host, routes[1]!)).body).toEqual({
        folders: [{ folderId, folderName: 'Inbox', unreadCount: 2 }],
      })
      const r = await request(host, routes[2]!)
      expect(r.status).toBe(200)
      expect(r.body).toEqual({
        messages: [
          {
            messageId,
            sender: 'Ana &lt;ana@example.test&gt;',
            status: '0',
            fixtureLimit: '100',
            fixtureStart: '9',
            fixtureFolder: folderId,
            fromAddress: {
              displayName: 'Ana',
              emailAddress: 'ana@example.test',
            },
            isRead: false,
          },
        ],
      })
    }
  })
  it('reads metadata/content and rewrites inline URLs consumed by the client', async () => {
    const results = []
    for (const host of hosts) {
      const r = await request(host, routes[3]!)
      expect(r.status).toBe(200)
      expect(r.body.message).toMatchObject({
        messageId,
        fromAddress: { displayName: 'Ana', emailAddress: 'ana@example.test' },
        toAddress: [{ displayName: 'Bob', emailAddress: 'bob@example.test' }],
        attachments: [
          {
            attachmentId: '9007199254740993126',
            fileName: 'Mail.pdf',
            size: 5,
          },
        ],
        isRead: false,
        receivedTime: 1700000000000,
      })
      expect(r.body.message.content).toContain(
        'contentId=logo%5B1%5D&fileName=Logo.png'
      )
      expect(r.body.message.content).toContain(
        'contentId=other&fileName=Other.png'
      )
      expect(r.body.message.content).toBe(r.body.message.htmlContent)
      results.push(r.body)
    }
    for (const result of results) expect(result).toEqual(expectedZohoMessage())
  })
  it.each([4, 5])(
    'keeps binary bytes and security headers for content route %s',
    async (index) => {
      for (const host of hosts) {
        const r = await request(host, routes[index]!)
        expect(r.status).toBe(200)
        expect(r.body).toEqual([0, 127, 255, 13, 10])
        expect(r.headers.get('content-type')).toBe('image/png')
        expect(r.headers.get('cache-control')).toBe('private, no-store')
        expect(r.headers.get('content-security-policy')).toBe(
          "sandbox; default-src 'none'"
        )
        expect(r.headers.get('x-content-type-options')).toBe('nosniff')
        if (index === 4)
          expect(r.headers.get('content-disposition')).toBe(
            'attachment; filename="__Mail.pdf"'
          )
        else expect(r.headers.get('content-length')).toBe('5')
      }
    }
  )
  it('preserves JSON/binary error envelopes and upstream status', async () => {
    for (const host of hosts) {
      const json = await request(
        host,
        routes[2]!.replace(folderId, 'provider-failure')
      )
      expect(json.status).toBe(500)
      expect(json.body).toEqual({ error: 'fixture throttled' })
      const binary = await request(
        host,
        routes[4]!.replace(folderId, 'provider-failure')
      )
      expect(binary.status).toBe(429)
      expect(binary.body).toEqual({
        error: '{"status":{"description":"fixture throttled"}}',
      })
      const image = await request(
        host,
        routes[5]!.replace(folderId, 'provider-failure')
      )
      expect(image.status).toBe(429)
      expect(image.body).toEqual({ error: 'Erro ao buscar imagem inline' })
    }
  })
  it('renews an expired tenant/user token, persists it and never touches the foreign token', async () => {
    for (const host of hosts) {
      await prisma.zohoMailToken.update({
        where: { id: tokenId },
        data: { accessToken: 'expired-local', expiresAt: new Date(0) },
      })
      expect((await request(host, routes[0]!)).status).toBe(200)
      expect(
        (
          await prisma.zohoMailToken.findUniqueOrThrow({
            where: { id: tokenId },
          })
        ).accessToken
      ).toBe('local-refreshed-a')
    }
    expect(
      (await providerRequests()).filter((row) =>
        row.path.includes('oauth/v2/token')
      )
    ).toHaveLength(hosts.length)
    expect(
      (
        await prisma.zohoMailToken.findUniqueOrThrow({
          where: { id: foreignTokenId },
        })
      ).accessToken
    ).toBe('foreign-fixture-token')
  })
  it('keeps disconnected responses on datacenter mismatch without provider access', async () => {
    await prisma.zohoMailToken.update({
      where: { id: tokenId },
      data: { datacenter: 'eu' },
    })
    for (const host of hosts)
      expect((await request(host, routes[0]!)).status).toBe(401)
    expect(await providerRequests()).toEqual([])
  })
  it('accepts OPERATOR but immediately rejects revocation and FINANCIAL', async () => {
    await prisma.membership.update({
      where: { id: memberId },
      data: { role: 'OPERATOR' },
    })
    for (const host of hosts)
      expect((await request(host, routes[0]!)).status).toBe(200)
    await prisma.membership.update({
      where: { id: memberId },
      data: { status: 'REVOKED' },
    })
    for (const host of hosts)
      expect((await request(host, routes[0]!)).status).toBe(403)
    await prisma.membership.update({
      where: { id: memberId },
      data: { status: 'ACTIVE', role: 'FINANCIAL' },
    })
    for (const host of hosts)
      expect((await request(host, routes[0]!)).status).toBe(403)
  })
})
