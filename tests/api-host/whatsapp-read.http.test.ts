import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient, type WhatsAppConversation } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets } from './targets'

const context = inject('apiParity')
const hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const memberId = randomUUID()
const ids = Array.from({ length: 5 }, () => randomUUID())
const messageIds = Array.from({ length: 6 }, () => randomUUID())
const marker = 'WA' + randomUUID().replaceAll('-', '')
const time = new Date('2026-10-02T14:00:00.123Z')
const prefix = '/api/admin/whatsapp/conversations'
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[58]!,
}
const conversations: WhatsAppConversation[] = []
let cookie = '',
  clientCookie = ''
function dto(index: number, messageCount = 0) {
  const c = conversations[index]!
  return {
    id: c.id,
    phone: c.phone,
    displayName: c.displayName,
    lastMessageAt: c.lastMessageAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messageCount,
  }
}
async function request(
  host: string,
  path = '',
  headers: Record<string, string> = {},
  jar = cookie
) {
  const response = await fetch(host + prefix + path, {
    headers: {
      ...edge,
      Origin: edge['x-platform-origin'],
      Cookie: jar,
      'x-tenant-id': context.alfa.id,
      ...headers,
    },
  })
  return { status: response.status, body: await response.json() }
}
beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  clientCookie = await signInParityUser(context, edge, 0)
  await prisma.membership.create({
    data: {
      id: memberId,
      tenantId: context.alfa.id,
      userId: context.identity.users[1]!.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  for (let i = 0; i < ids.length; i++) {
    conversations.push(
      await prisma.whatsAppConversation.create({
        data: {
          id: ids[i]!,
          tenantId: i < 3 ? context.alfa.id : i === 3 ? context.bravo.id : null,
          phone: `${marker}-${i}`,
          displayName: i === 1 ? null : i === 0 ? 'Ana Local' : 'Outra Local',
          createdAt: time,
          updatedAt: time,
          lastMessageAt: new Date(time.getTime() + (3 - i) * 1000),
        },
      })
    )
  }
  await prisma.whatsAppMessage.createMany({
    data: messageIds.map((id, i) => ({
      id,
      conversationId: ids[i < 4 ? 0 : i === 4 ? 3 : 4]!,
      tenantId: i < 3 ? context.alfa.id : i === 4 ? context.bravo.id : null,
      providerMessageId: i === 0 ? null : `local-${id}`,
      direction: i === 1 ? 'OUTBOUND' : 'INBOUND',
      type: i === 1 ? 'IMAGE' : 'TEXT',
      body: `local-message-${i}`,
      mediaUrl: i === 1 ? 'https://media.example.test/local.png' : null,
      status: i === 1 ? 'sent' : null,
      timestamp: new Date(time.getTime() + i * 1000),
      createdAt: time,
    })),
  })
})
beforeEach(async () => {
  await prisma.membership.update({
    where: { id: memberId },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  })
})
afterAll(async () => {
  await prisma.whatsAppConversation.deleteMany({ where: { id: { in: ids } } })
  await prisma.membership.deleteMany({ where: { id: memberId } })
  await prisma.$disconnect()
  await pool.end()
})

it('runs with a non-superuser role without RLS bypass and FORCE RLS on both tables', async () => {
  const runtimePool = new Pool({ connectionString: context.runtimeUrl })
  try {
    expect(
      (
        await runtimePool.query(
          'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user'
        )
      ).rows
    ).toEqual([{ rolsuper: false, rolbypassrls: false }])
    expect(
      (
        await runtimePool.query(
          "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('whatsapp_conversations','whatsapp_messages') ORDER BY relname"
        )
      ).rows
    ).toEqual([
      { relrowsecurity: true, relforcerowsecurity: true },
      { relrowsecurity: true, relforcerowsecurity: true },
    ])
    expect(
      (await runtimePool.query('SELECT id FROM whatsapp_messages')).rows
    ).toEqual([])
  } finally {
    await runtimePool.end()
  }
})

it('retains legacy POST body validation on both hosts after the write extraction', async () => {
  const headers = {
    ...edge,
    Origin: edge['x-platform-origin'],
    Cookie: cookie,
    'x-tenant-id': context.alfa.id,
    'Content-Type': 'application/json',
  }
  for (const host of hosts)
    for (const [body, error] of [
      ['{', 'Body JSON inválido'],
      ['{"text":"   "}', 'Campo text é obrigatório'],
    ]) {
      const response = await fetch(host + prefix + '/' + ids[0] + '/messages', {
        method: 'POST',
        headers,
        body,
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error })
    }
})

describe.each(hosts)('WhatsApp administrative reads HTTP %s', (host) => {
  const routes = ['', `/${ids[0]}`, `/${ids[0]}/messages`]
  it.each(routes)('requires a real session for %s', async (route) => {
    expect(await request(host, route, {}, '')).toEqual({
      status: 401,
      body: { error: 'Authentication required' },
    })
  })
  it.each(routes)(
    'ignores global ADMIN when the current membership is CLIENT: %s',
    async (route) => {
      expect(await request(host, route, {}, clientCookie)).toEqual({
        status: 403,
        body: { error: 'Acesso negado' },
      })
    }
  )
  it.each(routes)(
    'keeps the headers-only same-origin guard for GET %s',
    async (route) => {
      expect(
        (await request(host, route, { Origin: 'https://bravo.platform.test' }))
          .status
      ).toBe(403)
    }
  )
  it.each(['FINANCIAL', 'REVOKED'] as const)(
    'rechecks current membership (%s) for every read',
    async (state) => {
      await prisma.membership.update({
        where: { id: memberId },
        data: state === 'REVOKED' ? { status: 'REVOKED' } : { role: state },
      })
      for (const route of routes)
        expect((await request(host, route)).status).toBe(403)
    }
  )
  it('allows OPERATOR, preserving list order, total and original DTO', async () => {
    await prisma.membership.update({
      where: { id: memberId },
      data: { role: 'OPERATOR' },
    })
    expect(await request(host, '?search=' + marker)).toEqual({
      status: 200,
      body: { conversations: [dto(0, 3), dto(1), dto(2)], total: 3 },
    })
    expect((await request(host, `/${ids[0]}`)).body).toEqual(dto(0, 3))
    expect((await request(host, `/${ids[0]}/messages`)).status).toBe(200)
  })
  it('keeps limit/offset page total and list negative-limit coercion', async () => {
    expect(await request(host, `?search=${marker}&limit=1&offset=1`)).toEqual({
      status: 200,
      body: { conversations: [dto(1)], total: 3 },
    })
    expect(await request(host, `?search=${marker}&limit=-1&offset=-1`)).toEqual(
      {
        status: 200,
        body: { conversations: [dto(0, 3)], total: 3 },
      }
    )
  })
  it('searches phone or displayName case-insensitively and trims the query', async () => {
    expect(
      await request(host, `?search=%20${marker.toLowerCase()}-1%20`)
    ).toEqual({
      status: 200,
      body: { conversations: [dto(1)], total: 1 },
    })
    expect(await request(host, '?search=%20aNA%20')).toEqual({
      status: 200,
      body: { conversations: [dto(0, 3)], total: 1 },
    })
    expect(await request(host, '?search=' + randomUUID())).toEqual({
      status: 200,
      body: { conversations: [], total: 0 },
    })
  })
  it('returns only the selected tenant on membership change', async () => {
    expect(
      await request(host, '?search=' + marker, {
        'x-tenant-id': context.bravo.id,
      })
    ).toEqual({
      status: 200,
      body: { conversations: [dto(3, 1)], total: 1 },
    })
  })
  it.each([3, 4, -1])(
    'keeps foreign/unassigned/missing detail and thread equally neutral (%s)',
    async (index) => {
      const id = index < 0 ? randomUUID() : ids[index]!
      for (const suffix of ['', '/messages'])
        expect(await request(host, '/' + id + suffix)).toEqual({
          status: 404,
          body: { error: 'Conversa não encontrada' },
        })
    }
  )
  it('preserves chronological message DTO and hides the unassigned row attached to the owned conversation', async () => {
    const result = await request(host, `/${ids[0]}/messages`)
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      messages: [0, 1, 2].map((i) => ({
        id: messageIds[i],
        conversationId: ids[0],
        providerMessageId: i === 0 ? null : `local-${messageIds[i]}`,
        direction: i === 1 ? 'OUTBOUND' : 'INBOUND',
        type: i === 1 ? 'IMAGE' : 'TEXT',
        body: `local-message-${i}`,
        mediaUrl: i === 1 ? 'https://media.example.test/local.png' : null,
        timestamp: new Date(time.getTime() + i * 1000).toISOString(),
        status: i === 1 ? 'sent' : null,
        createdAt: time.toISOString(),
      })),
    })
    expect(await request(host, `/${ids[1]}`)).toEqual({
      status: 200,
      body: dto(1),
    })
    expect(await request(host, `/${ids[1]}/messages`)).toEqual({
      status: 200,
      body: { messages: [] },
    })
  })
  it('paginates newest first internally, reverses the page and uses a strict timestamp cursor', async () => {
    const latest = await request(host, `/${ids[0]}/messages?limit=2`)
    expect(latest.body.messages.map((m: { id: string }) => m.id)).toEqual([
      messageIds[1],
      messageIds[2],
    ])
    const before = encodeURIComponent(
      new Date(time.getTime() + 1000).toISOString()
    )
    const older = await request(
      host,
      `/${ids[0]}/messages?limit=2&before=${before}`
    )
    expect(older.body.messages.map((m: { id: string }) => m.id)).toEqual([
      messageIds[0],
    ])
  })
  it.each(['before=invalid', 'before=', 'limit=0', 'limit=bad', 'limit=999'])(
    'preserves ignored cursor and legacy numeric fallback (%s)',
    async (query) => {
      const result = await request(host, `/${ids[0]}/messages?${query}`)
      expect(result.status).toBe(200)
      expect(result.body.messages.map((m: { id: string }) => m.id)).toEqual(
        messageIds.slice(0, 3)
      )
    }
  )
  it('keeps negative message take behavior rather than applying list clamping', async () => {
    const result = await request(host, `/${ids[0]}/messages?limit=-1`)
    expect(result.status).toBe(200)
    expect(result.body.messages.map((m: { id: string }) => m.id)).toEqual([
      messageIds[0],
    ])
  })
})
