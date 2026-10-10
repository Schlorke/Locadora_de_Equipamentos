import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { sessionCookies, signInParityUser } from './identity'
import { requestWeb, startWebConsumer } from './web-consumer'
import { legacyRunning } from './targets'

const context = inject('apiParity')
const pool = new Pool({
  connectionString: requireTestDatabase(process.env),
  max: 2,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const member = randomUUID()
const rentals = [randomUUID(), randomUUID()]
const profiles = [randomUUID(), randomUUID()]
const quotes = [randomUUID(), randomUUID()]
const owner = context.identity.users[0]!.id
const adminUser = context.identity.users[1]!.id
const fixtureIp = context.directory.ips[42]!
const bytes = Buffer.from('%PDF-1.7\nprivate consumer fixture\n%%EOF')
const hash = (value: Uint8Array | string) =>
  createHash('sha256').update(value).digest('hex')
const uploadPath = (rental = rentals[0]!) =>
  `/api/admin/rentals/${rental}/client-documents`
const listPath = `/api/admin/clients/${owner}/documents`
const oauth = '/api/admin/zoho-mail/oauth'
const identifier = `zoho-oauth:${context.alfa.id}:${adminUser}`
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': fixtureIp,
  'x-forwarded-for': fixtureIp,
}
let cookie = ''
let migratedDocument = ''
let pending: { state: string; jar: string } | undefined

function form() {
  const result = new FormData()
  result.set('type', 'ID_DOCUMENT')
  result.set('captureMetadata', JSON.stringify({ source: 'web consumer' }))
  result.set(
    'file',
    new File([bytes], 'identidade com espaços.pdf', { type: 'application/pdf' })
  )
  return result
}
async function storage(mode = 'ready') {
  expect(
    (
      await fetch(context.storageOrigin + '/__fixture/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
    ).status
  ).toBe(200)
}
async function storageCalls(): Promise<
  Array<{ method: string; path: string; body: unknown }>
> {
  return (await fetch(context.storageOrigin + '/__fixture/requests')).json()
}
async function providerCalls(): Promise<
  Array<{ method: string; path: string; body: string }>
> {
  return (await fetch(context.zohoOrigin + '/__fixture/requests')).json()
}
// Normalize only PDFKit's creation instant and derived document ID. Content,
// fonts, layout and all other metadata must survive the actual proxy unchanged.
function normalizedPdf(value: Buffer) {
  return value
    .toString('latin1')
    .replace(/\(D:\d{14}Z\)/g, '(D:00000000000000Z)')
    .replace(
      /\/ID \[<[a-f0-9]+> <[a-f0-9]+>\]/gi,
      '/ID [<00000000000000000000000000000000> <00000000000000000000000000000000>]'
    )
}

// Decode the PDFKit base-font text used by this fixture, including its compressed streams.
// This proves the business content; it does not certify PDF layout or accessibility.
function pdfText(value: Buffer) {
  return [
    ...value
      .toString('latin1')
      .matchAll(/\bstream\r?\n([\s\S]*?)\r?\nendstream/g),
  ]
    .map((match) => {
      const commands = inflateSync(Buffer.from(match[1]!, 'latin1')).toString(
        'latin1'
      )
      return [...commands.matchAll(/<([a-f0-9]+)>/gi)]
        .map((word) => Buffer.from(word[1]!, 'hex').toString('latin1'))
        .join('')
    })
    .join('\n')
    .replace(/\u00a0/g, ' ')
}

async function checkedQuotePdf(response: Response) {
  expect(response.status).toBe(200)
  expect(
    Object.fromEntries(
      [
        'content-type',
        'content-disposition',
        'cache-control',
        'x-content-type-options',
      ].map((name) => [name, response.headers.get(name)])
    )
  ).toEqual({
    'content-type': 'application/pdf',
    'content-disposition': `attachment; filename="Orcamento-CONSUMER-${quotes[0]}.pdf"`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  const document = Buffer.from(await response.arrayBuffer())
  expect(document.subarray(0, 8).toString()).toBe('%PDF-1.3')
  expect(document.toString('latin1')).toContain('%%EOF')
  const content = pdfText(document)
  for (const expected of [
    'alfa',
    '11.222.333/0001-81',
    `ORÇAMENTO CONSUMER-${quotes[0]}`,
    'Cliente: Consumer PDF 0',
    'E-mail: consumer-pdf@example.test',
    'Telefone:',
    'Emissão: 31/12/2029',
    'Período: 31/01/2030 a 02/02/2030',
    'EQUIPAMENTOS',
    'Betoneira alfa 00',
    '1 unidade(s)',
    '2 dia(s)',
    'diária R$ 25,00',
    'Total do item: R$ 50,00',
    'Valor total: R$ 50,00',
  ])
    expect(content).toContain(expected)
  for (const foreign of [
    'Consumer PDF 1',
    `CONSUMER-${quotes[1]}`,
    'Betoneira bravo',
    'GB Locações',
  ])
    expect(content).not.toContain(foreign)
  return document
}

beforeAll(async () => {
  cookie = await signInParityUser(context, edge, 1)
  await prisma.membership.create({
    data: {
      id: member,
      tenantId: context.alfa.id,
      userId: adminUser,
      role: 'ADMIN',
    },
  })
  for (const [index, tenant] of [context.alfa, context.bravo].entries()) {
    await prisma.clientProfile.create({
      data: {
        id: profiles[index]!,
        tenantId: tenant.id,
        userId: owner,
        email: 'consumer-document@example.test',
        name: 'Consumer document owner',
      },
    })
    await prisma.rentals.create({
      data: {
        id: rentals[index]!,
        tenantId: tenant.id,
        userid: owner,
        startdate: new Date('2030-02-01'),
        enddate: new Date('2030-02-03'),
        total: '50',
      },
    })
    await prisma.quote.create({
      data: {
        id: quotes[index]!,
        tenantId: tenant.id,
        userId: owner,
        quoteCode: 'CONSUMER-' + quotes[index],
        name: 'Consumer PDF ' + index,
        email: 'consumer-pdf@example.test',
        phone: '',
        status: 'APPROVED',
        createdAt: new Date('2030-01-01'),
        startDate: new Date('2030-02-01'),
        endDate: new Date('2030-02-03'),
        total: '50',
        originalTotal: '50',
        finalTotal: '50',
        items: {
          create: {
            tenantId: tenant.id,
            equipmentId: tenant.equipmentIds[0]!,
            quantity: 1,
            days: 2,
            pricePerDay: '25',
            total: '50',
            startDate: new Date('2030-02-01'),
            endDate: new Date('2030-02-03'),
          },
        },
      },
    })
  }
}, 30000)
beforeEach(async () => {
  await storage()
  expect(
    (
      await fetch(context.zohoOrigin + '/__fixture/requests', {
        method: 'DELETE',
      })
    ).status
  ).toBe(200)
})
afterAll(async () => {
  try {
    await storage()
    await prisma.authVerification.deleteMany({ where: { identifier } })
    await prisma.zohoMailToken.deleteMany({
      where: { tenantId: context.alfa.id, userId: adminUser },
    })
    await prisma.clientDocument.deleteMany({
      where: { rentalId: { in: rentals } },
    })
    await prisma.quote.deleteMany({ where: { id: { in: quotes } } })
    await prisma.rentals.deleteMany({ where: { id: { in: rentals } } })
    await prisma.clientProfile.deleteMany({ where: { id: { in: profiles } } })
    await prisma.membership.deleteMany({ where: { id: member } })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

// O braço "legacy rollback" só existe enquanto a raiz roda; sem ela (absent) o web opera só sobre a API compartilhada
// (onda 135, E1). Sai junto com a raiz no bloco F.
describe.each([
  ['shared API', context.api] as const,
  ...(legacyRunning(context)
    ? [['legacy rollback', context.legacy] as const]
    : []),
])('operational web consumer -> %s', (_name, target) => {
  let web: Awaited<ReturnType<typeof startWebConsumer>>
  const call = (pathname: string, init: RequestInit = {}) => {
    const headers = new Headers({
      Host: 'app.platform.test',
      Cookie: cookie,
      'x-tenant-id': context.alfa.id,
      'x-real-ip': fixtureIp,
      'x-forwarded-for': fixtureIp,
    })
    new Headers(init.headers).forEach((value, name) => headers.set(name, value))
    return requestWeb(web.origin + pathname, {
      ...init,
      redirect: 'manual',
      headers,
    })
  }
  beforeAll(async () => {
    web = await startWebConsumer(context, target)
  }, 90000)
  afterAll(async () => {
    if (web) await web.stop()
  })

  it('preserves PDF bytes and download headers through the real proxy and rollback', async () => {
    const endpoint = `/api/admin/quotes/${quotes[0]}/download`
    const response = await call(endpoint)
    const document = await checkedQuotePdf(response)
    const direct = await fetch(target + endpoint, {
      headers: { ...edge, Cookie: cookie, 'x-tenant-id': context.alfa.id },
    })
    const directDocument = await checkedQuotePdf(direct)
    // parity-scan: proxy and direct are two real requests to this same target, each checked against the fixture above.
    expect(normalizedPdf(document)).toBe(normalizedPdf(directDocument))
    const foreign = await call(`/api/admin/quotes/${quotes[1]}/download`)
    expect(foreign.status).toBe(404)
    expect(foreign.headers.get('content-disposition')).toBeNull()
  })

  it('preserves real multipart bytes, private storage and uploaded records after rollback', async () => {
    if (target === context.legacy) {
      expect(migratedDocument).not.toBe('')
      const list = await call(listPath)
      expect(list.status).toBe(200)
      expect(
        (await list.json()).documents.map((d: { id: string }) => d.id)
      ).toContain(migratedDocument)
    }
    const response = await call(uploadPath(), {
      method: 'POST',
      headers: { Origin: 'https://app.platform.test' },
      body: form(),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const { document } = await response.json()
    expect(document).toMatchObject({
      userId: owner,
      rentalId: rentals[0],
      mimeType: 'application/pdf',
      fileSize: bytes.length,
      fileHash: hash(bytes),
    })
    expect(document).not.toHaveProperty('filePath')
    expect(new URL(document.signedUrl).origin).toBe(context.storageOrigin)
    const stored = await prisma.clientDocument.findUniqueOrThrow({
      where: { id: document.id },
    })
    expect(stored).toMatchObject({
      tenantId: context.alfa.id,
      uploadedBy: adminUser,
      captureMetadata: { source: 'web consumer' },
    })
    expect(
      stored.filePath.startsWith(`tenants/${context.alfa.id}/clients/${owner}/`)
    ).toBe(true)
    const calls = await storageCalls()
    expect(
      calls.find((c) => c.method === 'POST' && c.path.includes('/object/sign/'))
        ?.body
    ).toEqual({ expiresIn: 300 })
    expect(
      calls.find(
        (c) =>
          c.method === 'POST' &&
          c.path.startsWith('/storage/v1/object/gb-locacoes-client-documents/')
      )?.body
    ).toEqual({ bytes: bytes.length })
    if (target === context.api) migratedDocument = document.id
  })

  it('rejects multipart from a sibling or foreign rental before storage and preserves provider failure', async () => {
    const before = await prisma.clientDocument.count({
      where: { rentalId: rentals[0] },
    })
    const sibling = await call(uploadPath(), {
      method: 'POST',
      headers: {
        Origin: `https://${context.bravo.slug}.platform.test`,
        'Sec-Fetch-Site': 'same-site',
      },
      body: form(),
    })
    expect(sibling.status).toBe(403)
    const foreign = await call(uploadPath(rentals[1]), {
      method: 'POST',
      headers: { Origin: 'https://app.platform.test' },
      body: form(),
    })
    expect(foreign.status).toBe(404)
    expect(await storageCalls()).toEqual([])
    await storage('upload-failure')
    const failed = await call(uploadPath(), {
      method: 'POST',
      headers: { Origin: 'https://app.platform.test' },
      body: form(),
    })
    expect(failed.status).toBe(502)
    expect(
      await prisma.clientDocument.count({ where: { rentalId: rentals[0] } })
    ).toBe(before)
  })

  async function authorize() {
    const response = await call(oauth + '/authorize', {
      headers: { Origin: 'https://app.platform.test' },
    })
    expect(response.status).toBe(307)
    const destination = new URL(response.headers.get('location')!)
    expect(destination.origin).toBe('https://accounts.zoho.com')
    expect(destination.searchParams.get('redirect_uri')).toBe(
      'https://app.platform.test' + oauth + '/callback'
    )
    const state = destination.searchParams.get('state')!
    expect(state).toMatch(/^[a-f0-9]{32}$/)
    expect(
      response.headers
        .getSetCookie()
        .find((v) => v.startsWith('zoho_oauth_state='))
    ).toMatch(/; HttpOnly(?:;|$)/i)
    expect(
      await prisma.authVerification.count({
        where: { identifier, value: hash(state) },
      })
    ).toBe(1)
    return { state, jar: sessionCookies(response, cookie) }
  }

  it('consumes OAuth state once through the proxy without losing redirects, cookies or tenant scope', async () => {
    const authorization =
      target === context.legacy ? pending! : await authorize()
    expect(authorization).toBeDefined()
    const endpoint =
      oauth +
      '/callback?' +
      new URLSearchParams({
        code: 'local-oauth-code',
        state: authorization.state,
      })
    const response = await call(endpoint, {
      headers: {
        Cookie: authorization.jar,
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'navigate',
      },
    })
    expect(response.status).toBe(307)
    const destination = new URL(response.headers.get('location')!, web.origin)
    expect(destination.pathname + destination.search).toBe(
      '/admin/email?success=true'
    )
    expect(
      response.headers
        .getSetCookie()
        .some((v) => v.startsWith('zoho_oauth_state=;'))
    ).toBe(true)
    expect(
      await prisma.authVerification.count({
        where: { identifier, value: hash(authorization.state) },
      })
    ).toBe(0)
    expect(
      await prisma.zohoMailToken.findUniqueOrThrow({
        where: {
          tenantId_userId: { tenantId: context.alfa.id, userId: adminUser },
        },
      })
    ).toMatchObject({
      accessToken: 'local-access-a',
      refreshToken: 'local-refresh-a',
    })
    const calls = await providerCalls()
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['POST', '/zoho/accounts.zoho.com/oauth/v2/token'],
      ['GET', '/zoho/mail.zoho.com/api/accounts'],
    ])
    expect(new URLSearchParams(calls[0]!.body).get('redirect_uri')).toBe(
      'https://app.platform.test' + oauth + '/callback'
    )
    expect(
      (
        await call(endpoint, { headers: { Cookie: authorization.jar } })
      ).headers.get('location')
    ).toContain('error=')
    expect(await providerCalls()).toEqual(calls)
    if (target === context.api) pending = await authorize()
  })

  it('keeps public cache boundaries when alternating real tenant Hosts', async () => {
    for (const tenant of [context.alfa, context.bravo, context.alfa]) {
      const response = await call('/api/equipments', {
        headers: { Host: `${tenant.slug}.platform.test` },
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('public, max-age=60')
      expect(response.headers.get('cdn-cache-control')).toBeNull()
      expect(response.headers.get('vary')?.toLowerCase()).toContain('host')
      const body = await response.text()
      expect(body).toContain(tenant.equipmentIds[0])
      expect(body).not.toContain(
        (tenant === context.alfa ? context.bravo : context.alfa).equipmentIds[0]
      )
    }
    const own = await call(listPath)
    expect(own.headers.get('cache-control')).toBe('private, no-store')
  })

  it('renders public equipment HTML using the shared HTTP gateway with isolated tenant data', async () => {
    for (const tenant of [context.alfa, context.bravo]) {
      const equipment = await prisma.equipment.findUniqueOrThrow({
        where: { id: tenant.equipmentIds[0]! },
        select: { name: true },
      })
      const response = await call(`/equipamentos/${tenant.equipmentIds[0]}`, {
        headers: { Host: `${tenant.slug}.platform.test` },
      })
      expect(
        response.status,
        JSON.stringify({
          contentType: response.headers.get('content-type'),
          forwarded: web.forwarded.slice(-6),
          snippet: (await response.clone().text()).slice(0, 400),
        })
      ).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
      expect(response.headers.get('cache-control')).toContain('no-store')
      // Remove Flight and JSON-LD scripts: a data string alone does not prove
      // that the product rendered its actual heading in the HTML response.
      const markup = (await response.text()).replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        ''
      )
      expect(markup.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]).toContain(
        equipment.name
      )
      expect(
        web.forwarded.some((url) =>
          url.startsWith(
            `/api/equipments/${tenant.equipmentIds[0]}?tenantSlug=${tenant.slug}`
          )
        )
      ).toBe(true)
    }
  }, 30000)

  it('keeps the API project as sole Vercel scheduler and protects manual job transport', async () => {
    // Bloco K (onda 135): the Vercel crons live in the API project, which this suite runs; the web project never
    // schedules. The former root vercel.json was retired in F; restoring the fallback uses the complete pre-deletion tag
    // (docs/operations/runbook-corte-raiz-legada.md).
    const api = JSON.parse(
      readFileSync('apps/services/api/vercel.json', 'utf8')
    )
    expect(api.crons.map((c: { path: string }) => c.path)).toContain(
      '/api/cron/outbox'
    )
    expect(
      JSON.parse(readFileSync('apps/clients/web/vercel.json', 'utf8'))
    ).not.toHaveProperty('crons')
    // Every scheduled path exists on the target and refuses a call without the cron secret, before any work.
    for (const cron of api.crons as { path: string }[])
      expect((await fetch(target + cron.path)).status, cron.path).toBe(401)
    const before = await prisma.auditLog.count({
      where: { action: 'CRON_EXECUTION_CHECKPOINT' },
    })
    const authorization =
      'Bearer ' + (process.env.API_CRON_SECRET ?? 'local-api-cron-fixture-only')
    // Crons/webhooks are denied on EVERY web host, even with a genuine secret.
    // Jobs retain their direct backend origin; consumers never become schedulers.
    for (const headers of [
      new Headers(),
      new Headers({ Authorization: authorization }),
    ]) {
      const forwarded = web.forwarded.length
      expect(
        (await call('/api/cron/verify-boleto-payments', { headers })).status
      ).toBe(404)
      expect(web.forwarded.length).toBe(forwarded)
    }
    expect(
      await prisma.auditLog.count({
        where: { action: 'CRON_EXECUTION_CHECKPOINT' },
      })
    ).toBe(before)
    expect(
      (await fetch(target + '/api/cron/verify-boleto-payments')).status
    ).toBe(401)
    const response = await fetch(target + '/api/cron/verify-boleto-payments', {
      headers: { Authorization: authorization },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(
      body.results.map((r: { tenantId: string }) => r.tenantId)
    ).not.toContain(context.suspended)
    expect(
      await prisma.auditLog.count({
        where: {
          tenantId: context.alfa.id,
          action: 'CRON_EXECUTION_CHECKPOINT',
          entityId: 'verify-boleto-payments',
        },
      })
    ).toBeGreaterThan(0)
  })
})
