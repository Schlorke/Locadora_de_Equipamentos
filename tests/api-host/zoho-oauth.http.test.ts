import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  inject,
  it,
} from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireTestDatabase } from '../helpers/test-database'
import { signInParityUser } from './identity'
import { parityTargets, rotatingTarget } from './targets'

const context = inject('apiParity'),
  hosts = parityTargets(context)
const pool = new Pool({ connectionString: requireTestDatabase(process.env) })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
const user = context.identity.users[1]!.id
const memberId = randomUUID(),
  foreignTokenId = randomUUID()
const identifier = (tenant = context.alfa.id) => `zoho-oauth:${tenant}:${user}`
const hash = (state: string) => createHash('sha256').update(state).digest('hex')
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.platform.test',
  'x-platform-client-ip': context.directory.ips[57]!,
}
const prefix = '/api/admin/zoho-mail/oauth'
const error = (message: string) =>
  '/admin/email?error=' + encodeURIComponent(message)
let cookie = '',
  clientCookie = ''
async function providerRequests() {
  return (
    await fetch(context.zohoOrigin + '/__fixture/requests')
  ).json() as Promise<
    Array<{ path: string; method: string; authorization: string; body: string }>
  >
}
async function request(
  host: string,
  route: string,
  options: {
    jar?: string
    method?: string
    headers?: Record<string, string | null>
  } = {}
) {
  const headers = new Headers({
    ...edge,
    Cookie: options.jar ?? cookie,
    Origin: edge['x-platform-origin'],
    'x-tenant-id': context.alfa.id,
  })
  for (const [name, value] of Object.entries(options.headers ?? {}))
    if (value === null) headers.delete(name)
    else headers.set(name, value)
  const response = await fetch(host + prefix + route, {
    method: options.method ?? 'GET',
    headers,
    redirect: 'manual',
  })
  return {
    status: response.status,
    headers: response.headers,
    body: response.headers.get('content-type')?.startsWith('application/json')
      ? await response.json()
      : await response.text(),
  }
}
const ownToken = () =>
  prisma.zohoMailToken.findUnique({
    where: { tenantId_userId: { tenantId: context.alfa.id, userId: user } },
  })
async function resetOwnToken() {
  const data = {
    accessToken: 'prior-local-access',
    refreshToken: 'prior-local-refresh',
    expiresAt: new Date(Date.now() + 3_600_000),
    accountId: 'prior-account',
    datacenter: 'com',
  }
  await prisma.zohoMailToken.upsert({
    where: { tenantId_userId: { tenantId: context.alfa.id, userId: user } },
    create: { ...data, tenantId: context.alfa.id, userId: user },
    update: data,
  })
}
async function authorize(host: string) {
  const started = Date.now(),
    r = await request(host, '/authorize')
  expect(r.status).toBe(307)
  const url = new URL(r.headers.get('location')!)
  expect(url.origin + url.pathname).toBe(
    'https://accounts.zoho.com/oauth/v2/auth'
  )
  expect(url.searchParams.get('redirect_uri')).toBe(
    'https://app.platform.test' + prefix + '/callback'
  )
  expect(url.searchParams.get('client_id')).toBe('local-zoho-fixture-client')
  expect(url.searchParams.get('access_type')).toBe('offline')
  const state = url.searchParams.get('state')!
  expect(state).toMatch(/^[a-f0-9]{32}$/)
  const setCookie = r.headers
    .getSetCookie()
    .find((value) => value.startsWith('zoho_oauth_state='))!
  expect(setCookie).toMatch(/; HttpOnly(?:;|$)/i)
  expect(setCookie).toMatch(/; Secure(?:;|$)/i)
  expect(setCookie).toMatch(/; SameSite=lax(?:;|$)/i)
  expect(setCookie).toMatch(/; Max-Age=600(?:;|$)/i)
  expect(setCookie).toMatch(/; Path=\/(?:;|$)/i)
  expect(setCookie).not.toMatch(/; Domain=/i)
  const pair = setCookie.split(';')[0]!
  expect(
    JSON.parse(decodeURIComponent(pair.slice(pair.indexOf('=') + 1)))
  ).toEqual({
    state,
    tenantId: context.alfa.id,
    userId: user,
  })
  const verification = await prisma.authVerification.findFirstOrThrow({
    where: { identifier: identifier(), value: hash(state) },
  })
  expect(verification.value).not.toBe(state)
  expect(verification.expiresAt.getTime()).toBeGreaterThanOrEqual(
    started + 600_000
  )
  expect(verification.expiresAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 600_000
  )
  expect(await providerRequests()).toEqual([])
  return { state, pair, jar: cookie + '; ' + pair, verification }
}
const callbackRoute = (state: string, code = 'local-oauth-code') =>
  '/callback?' + new URLSearchParams({ code, state }).toString()
function cleared(headers: Headers) {
  expect(
    headers
      .getSetCookie()
      .some(
        (value) =>
          value.startsWith('zoho_oauth_state=;') &&
          /Expires=Thu, 01 Jan 1970/i.test(value)
      )
  ).toBe(true)
}
async function foreignUnchanged() {
  expect(
    (
      await prisma.zohoMailToken.findUniqueOrThrow({
        where: { id: foreignTokenId },
      })
    ).accessToken
  ).toBe('foreign-fixture-token')
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
  await prisma.zohoMailToken.create({
    data: {
      id: foreignTokenId,
      tenantId: context.bravo.id,
      userId: user,
      accessToken: 'foreign-fixture-token',
      refreshToken: 'foreign-refresh-fixture',
      expiresAt: new Date(Date.now() + 3_600_000),
      accountId: 'foreign-account',
      datacenter: 'com',
    },
  })
})
beforeEach(async () => {
  await fetch(context.zohoOrigin + '/__fixture/requests', { method: 'DELETE' })
  await prisma.authVerification.deleteMany({
    where: { identifier: { in: [identifier(), identifier(context.bravo.id)] } },
  })
  await prisma.membership.update({
    where: { id: memberId },
    data: { status: 'ACTIVE', role: 'ADMIN' },
  })
  await resetOwnToken()
})
afterAll(async () => {
  await prisma.authVerification.deleteMany({
    where: { identifier: { in: [identifier(), identifier(context.bravo.id)] } },
  })
  await prisma.zohoMailToken.deleteMany({
    where: {
      tenantId: { in: [context.alfa.id, context.bravo.id] },
      userId: user,
    },
  })
  await prisma.membership.deleteMany({ where: { id: memberId } })
  await prisma.$disconnect()
  await pool.end()
})
describe('Zoho OAuth HTTP parity with real sessions, state consumption and RLS', () => {
  it.each(['/authorize', '/disconnect'])(
    'refuses missing session/CLIENT before effects at %s',
    async (route) => {
      for (const host of hosts)
        for (const [jar, status, message] of [
          ['', 401, 'Authentication required'],
          [clientCookie, 403, 'Acesso negado'],
        ] as const) {
          const r = await request(host, route, {
            jar,
            method: route === '/disconnect' ? 'DELETE' : 'GET',
          })
          expect(r.status).toBe(status)
          expect(r.body).toEqual({ error: message })
        }
      expect(
        await prisma.authVerification.count({
          where: { identifier: identifier() },
        })
      ).toBe(0)
      expect((await ownToken())?.accessToken).toBe('prior-local-access')
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(['/authorize', '/disconnect'])(
    'refuses sibling Origin before effects at %s',
    async (route) => {
      for (const host of hosts)
        expect(
          (
            await request(host, route, {
              method: route === '/disconnect' ? 'DELETE' : 'GET',
              headers: { Origin: 'https://bravo.platform.test' },
            })
          ).status
        ).toBe(403)
      expect(
        await prisma.authVerification.count({
          where: { identifier: identifier() },
        })
      ).toBe(0)
      expect((await ownToken())?.accessToken).toBe('prior-local-access')
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each([
    ['?error=access_denied&code=ignored', 'Acesso negado ao Zoho'],
    ['?error=provider+problem&code=ignored', 'provider problem'],
    ['', 'Código de autorização não recebido'],
    ['?code=present', 'Authentication required'],
  ])(
    'preserves unauthenticated callback precedence %s',
    async (query, message) => {
      for (const host of hosts) {
        const r = await request(host, '/callback' + query, { jar: '' })
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe(error(message))
        expect(r.headers.getSetCookie()).toEqual([])
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(['', '?error=access_denied'])(
    'leaves state/cookie untouched for early provider/code error %s',
    async (query) => {
      for (const host of hosts) {
        const a = await authorize(host)
        const r = await request(host, '/callback' + query, { jar: a.jar })
        expect(r.status).toBe(307)
        expect(r.headers.getSetCookie()).toEqual([])
        expect(
          await prisma.authVerification.count({
            where: { id: a.verification.id },
          })
        ).toBe(1)
      }
    }
  )
  it('denies inactive/current CLIENT membership without consuming a valid state', async () => {
    const a = await authorize(hosts[0]!)
    for (const data of [
      { status: 'SUSPENDED' as const },
      { status: 'ACTIVE' as const, role: 'CLIENT' as const },
    ]) {
      await prisma.membership.update({ where: { id: memberId }, data })
      for (const host of hosts) {
        const r = await request(host, callbackRoute(a.state), { jar: a.jar })
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).not.toContain('success=true')
        expect(r.headers.getSetCookie()).toEqual([])
      }
      expect(
        await prisma.authVerification.count({
          where: { id: a.verification.id },
        })
      ).toBe(1)
    }
    expect(await providerRequests()).toEqual([])
  })
  it.each(['absent', 'malformed', 'nonce', 'tenant', 'user', 'missing-query'])(
    'rejects %s state before exchange and clears only the cookie',
    async (kind) => {
      for (const host of hosts) {
        const a = await authorize(host)
        const saved = {
          state: a.state,
          tenantId: context.alfa.id,
          userId: user,
        }
        if (kind === 'nonce') saved.state = 'different'
        if (kind === 'tenant') saved.tenantId = context.bravo.id
        if (kind === 'user') saved.userId = context.identity.users[0]!.id
        const jar =
          kind === 'absent'
            ? cookie
            : cookie +
              '; zoho_oauth_state=' +
              encodeURIComponent(
                kind === 'malformed' ? '{bad' : JSON.stringify(saved)
              )
        const r = await request(
          host,
          kind === 'missing-query'
            ? '/callback?code=local-oauth-code'
            : callbackRoute(a.state),
          { jar }
        )
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe(
          error(
            kind === 'malformed'
              ? 'Estado OAuth inválido'
              : 'Estado OAuth inválido para esta locadora'
          )
        )
        cleared(r.headers)
        expect(
          await prisma.authVerification.count({
            where: { id: a.verification.id },
          })
        ).toBe(1)
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(['null', '[]', '"nonce"', '123', 'true'])(
    'rejects non-object JSON cookie %s without consuming state or reaching the provider',
    async (value) => {
      for (const host of hosts) {
        const a = await authorize(host)
        const before = await ownToken()
        const r = await request(host, callbackRoute(a.state), {
          jar: cookie + '; zoho_oauth_state=' + encodeURIComponent(value),
        })
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe(error('Estado OAuth inválido'))
        cleared(r.headers)
        expect(
          await prisma.authVerification.count({
            where: { id: a.verification.id },
          })
        ).toBe(1)
        expect(await ownToken()).toEqual(before)
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it.each(['expired', 'used', 'duplicate'])(
    'rejects %s SQL state before exchange',
    async (kind) => {
      for (const host of hosts) {
        const a = await authorize(host)
        if (kind === 'expired')
          await prisma.authVerification.update({
            where: { id: a.verification.id },
            data: { expiresAt: new Date(0) },
          })
        if (kind === 'used')
          await prisma.authVerification.delete({
            where: { id: a.verification.id },
          })
        if (kind === 'duplicate')
          await prisma.authVerification.create({
            data: {
              id: randomUUID(),
              identifier: identifier(),
              value: hash(a.state),
              expiresAt: a.verification.expiresAt,
            },
          })
        const r = await request(host, callbackRoute(a.state), { jar: a.jar })
        expect(r.status).toBe(307)
        expect(r.headers.get('location')).toBe(
          error('Estado OAuth expirado ou já utilizado')
        )
        cleared(r.headers)
        expect(
          await prisma.authVerification.count({
            where: { identifier: identifier(), value: hash(a.state) },
          })
        ).toBe(kind === 'expired' ? 1 : 0)
      }
      expect(await providerRequests()).toEqual([])
    }
  )
  it('consumes the scoped state once, exchanges against the fixed callback and upserts only the current token', async () => {
    for (const host of hosts) {
      await resetOwnToken()
      const a = await authorize(host),
        started = Date.now()
      const r = await request(host, callbackRoute(a.state), { jar: a.jar })
      expect(r.status).toBe(307)
      expect(r.headers.get('location')).toBe('/admin/email?success=true')
      cleared(r.headers)
      expect(
        await prisma.authVerification.count({
          where: { id: a.verification.id },
        })
      ).toBe(0)
      const token = await ownToken()
      expect(token).toMatchObject({
        tenantId: context.alfa.id,
        userId: user,
        accessToken: 'local-access-a',
        refreshToken: 'local-refresh-a',
        accountId: '9007199254740993123',
        datacenter: 'com',
      })
      expect(token!.expiresAt.getTime()).toBeGreaterThanOrEqual(
        started + 3_540_000
      )
      expect(token!.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 3_540_000
      )
      const calls = await providerRequests()
      expect(calls.map((call) => [call.method, call.path])).toEqual([
        ['POST', '/zoho/accounts.zoho.com/oauth/v2/token'],
        ['GET', '/zoho/mail.zoho.com/api/accounts'],
      ])
      const body = new URLSearchParams(calls[0]!.body)
      expect(body.get('code')).toBe('local-oauth-code')
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('redirect_uri')).toBe(
        'https://app.platform.test' + prefix + '/callback'
      )
      expect(calls[1]!.authorization).toBe('Zoho-oauthtoken local-access-a')
      await foreignUnchanged()
      await fetch(context.zohoOrigin + '/__fixture/requests', {
        method: 'DELETE',
      })
    }
  })
  it('supports the provider top-level return without Origin while still requiring bound state', async () => {
    for (const host of hosts) {
      const a = await authorize(host)
      const r = await request(host, callbackRoute(a.state), {
        jar: a.jar,
        headers: {
          Origin: null,
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'navigate',
        },
      })
      expect(r.headers.get('location')).toBe('/admin/email?success=true')
      cleared(r.headers)
      await fetch(context.zohoOrigin + '/__fixture/requests', {
        method: 'DELETE',
      })
    }
  })
  it('rejects sibling Origin on callback without consuming state or reaching the provider', async () => {
    const a = await authorize(hosts[0]!)
    for (const host of hosts) {
      const r = await request(host, callbackRoute(a.state), {
        jar: a.jar,
        headers: { Origin: 'https://bravo.platform.test' },
      })
      expect(r.status).toBe(307)
      expect(r.headers.get('location')).not.toContain('success=true')
      expect(r.headers.getSetCookie()).toEqual([])
    }
    expect(
      await prisma.authVerification.count({ where: { id: a.verification.id } })
    ).toBe(1)
    expect(await providerRequests()).toEqual([])
  })
  it('exchange failure consumes state and does not change either tenant token', async () => {
    for (const host of hosts) {
      const a = await authorize(host)
      const r = await request(host, callbackRoute(a.state, 'local-bad-code'), {
        jar: a.jar,
      })
      expect(r.headers.get('location')).toBe(
        error('Falha ao conectar conta de e-mail')
      )
      cleared(r.headers)
      const retry = await request(host, callbackRoute(a.state), { jar: a.jar })
      expect(retry.headers.get('location')).toBe(
        error('Estado OAuth expirado ou já utilizado')
      )
      expect((await providerRequests()).length).toBe(1)
      expect((await ownToken())?.accessToken).toBe('prior-local-access')
      await foreignUnchanged()
      await fetch(context.zohoOrigin + '/__fixture/requests', {
        method: 'DELETE',
      })
    }
  })
  it('discovery failure keeps the token and a null account while redirecting to success', async () => {
    for (const host of hosts) {
      const a = await authorize(host)
      const r = await request(
        host,
        callbackRoute(a.state, 'local-no-account-code'),
        { jar: a.jar }
      )
      expect(r.headers.get('location')).toBe('/admin/email?success=true')
      expect(await ownToken()).toMatchObject({
        accessToken: 'local-no-account-access',
        accountId: null,
      })
      await foreignUnchanged()
      await fetch(context.zohoOrigin + '/__fixture/requests', {
        method: 'DELETE',
      })
    }
  })
  it('allows exactly one concurrent callback across both hosts', async () => {
    const a = await authorize(hosts[0]!)
    // Dois callbacks reais e simultâneos: raiz e API, ou a API duas vezes sem a raiz (onda 135, B2).
    const results = await Promise.all(
      [0, 1].map((index) =>
        request(rotatingTarget(context, index), callbackRoute(a.state), {
          jar: a.jar,
        })
      )
    )
    expect(results.map((r) => r.headers.get('location')).sort()).toEqual(
      [
        error('Estado OAuth expirado ou já utilizado'),
        '/admin/email?success=true',
      ].sort()
    )
    for (const r of results) cleared(r.headers)
    expect((await providerRequests()).length).toBe(2)
    expect(
      await prisma.authVerification.count({ where: { id: a.verification.id } })
    ).toBe(0)
    await foreignUnchanged()
  })
  it('disconnect deletes only the own token, is idempotent and retains a pending state without provider revocation', async () => {
    for (const host of hosts) {
      await resetOwnToken()
      const a = await authorize(host)
      for (let n = 0; n < 2; n++) {
        const r = await request(host, '/disconnect', { method: 'DELETE' })
        expect(r.status).toBe(200)
        expect(r.body).toEqual({ success: true })
        expect(r.headers.getSetCookie()).toEqual([])
      }
      expect(await ownToken()).toBeNull()
      expect(
        await prisma.authVerification.count({
          where: { id: a.verification.id },
        })
      ).toBe(1)
      await foreignUnchanged()
    }
    expect(await providerRequests()).toEqual([])
  })
})
