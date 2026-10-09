import { beforeAll, afterAll, describe, expect, inject, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import { requireTestDatabase } from '../helpers/test-database'
import {
  createHttpClient,
  HttpError,
} from '../../packages/frontend/src/shared/api/http-client'
import { sessionCookies, signInParityUser } from './identity'
import { requestWeb, startWebConsumer } from './web-consumer'
import { legacyRunning, parityTargets } from './targets'

const context = inject('apiParity')
// Reserved fixture IP is already owned by global-setup's limiter cleanup.
const fixtureIp = context.directory.ips[41]!
const clientIpHeaders = { 'x-real-ip': fixtureIp, 'x-forwarded-for': fixtureIp }
const digest = (data: Uint8Array) =>
  createHash('sha256').update(data).digest('hex')
const pool = new Pool({
  connectionString: requireTestDatabase(process.env),
  max: 1,
})
let migratedCookie = ''
afterAll(() => pool.end())

// O braço "legacy rollback" (WEB_API_ORIGIN de volta à raiz) só existe enquanto a raiz roda; sem ela (absent) o web
// consome só a API compartilhada (onda 135, E1/E3). Sai junto com a raiz no bloco F.
describe.each([
  ['shared API', context.api] as const,
  ...(legacyRunning(context)
    ? [['legacy rollback', context.legacy] as const]
    : []),
])('web consumer -> %s', (_name, target) => {
  let web: Awaited<ReturnType<typeof startWebConsumer>>
  let cookie = ''
  const host = `${context.alfa.slug}.platform.test`
  const request = (pathname: string, init: RequestInit = {}) =>
    requestWeb(web.origin + pathname, {
      ...init,
      headers: {
        Host: host,
        Cookie: cookie,
        ...clientIpHeaders,
        ...init.headers,
      },
      redirect: 'manual',
    })
  beforeAll(async () => {
    web = await startWebConsumer(context, target)
  }, 90000)
  afterAll(async () => {
    if (web) await web.stop()
  })

  it('serves favicon, font and 3D model byte-identically without reaching either API', async () => {
    for (const asset of [
      '/favicon.ico',
      '/fonts/twemoji-country-flags.woff2',
      '/models/Compressor.glb',
    ]) {
      const response = await request(asset)
      expect(response.status).toBe(200)
      expect(digest(new Uint8Array(await response.arrayBuffer()))).toBe(
        digest(readFileSync(path.join('public', asset.slice(1))))
      )
      expect(web.forwarded).not.toContain(asset)
    }
  })

  it('preserves tenant routing and replaces forged edge headers with the real Host', async () => {
    const response = await request('/api/equipments', {
      headers: {
        'x-platform-edge-auth': context.secret,
        'x-platform-host-kind': 'tenant',
        'x-platform-tenant-slug': context.bravo.slug,
        'x-platform-origin': `https://${context.bravo.slug}.platform.test`,
      },
    })
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain(context.alfa.equipmentIds[0])
    expect(body).not.toContain(context.bravo.equipmentIds[0])
    expect(
      web.forwarded.some((url) =>
        url.startsWith('/api/equipments?tenantSlug=' + context.alfa.slug)
      )
    ).toBe(true)
    expect(
      (await request('/api/equipments?tenantSlug=' + context.bravo.slug)).status
    ).toBe(400)
  })

  it('blocks internal jobs and admin APIs on the tenant host before forwarding', async () => {
    for (const endpoint of ['/api/cron/outbox', '/api/admin/settings']) {
      const before = web.forwarded.length
      expect((await request(endpoint)).status).toBe(404)
      expect(web.forwarded.length).toBe(before)
    }
  })

  it('passes real login cookies through Next and preserves the session after changing API destination', async () => {
    const endpoint =
      context.identity.mode === 'legacy'
        ? '/api/auth/session'
        : '/api/auth/get-session'
    if (target === context.legacy) {
      expect(migratedCookie).not.toBe('')
      const restored = await requestWeb(web.origin + endpoint, {
        headers: {
          Host: 'app.platform.test',
          Cookie: migratedCookie,
          ...clientIpHeaders,
        },
      })
      expect(restored.status).toBe(200)
      expect((await restored.json()).user.id).toBe(
        context.identity.users[0]!.id
      )
    }
    const appHeaders = {
      Host: 'app.platform.test',
      Origin: 'https://app.platform.test',
      'Content-Type': 'application/json',
      ...clientIpHeaders,
    }
    if (context.identity.mode === 'legacy') {
      const csrf = await requestWeb(web.origin + '/api/auth/csrf', {
        headers: appHeaders,
      })
      expect(csrf.status).toBe(200)
      const { csrfToken } = await csrf.json()
      const result = await requestWeb(
        web.origin + '/api/auth/callback/credentials',
        {
          method: 'POST',
          headers: {
            ...appHeaders,
            Cookie: sessionCookies(csrf),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            csrfToken,
            email: context.identity.users[0]!.email,
            password: context.identity.users[0]!.password,
            callbackUrl: 'https://app.platform.test/admin',
            json: 'true',
          }),
          redirect: 'manual',
        }
      )
      expect(result.status).toBe(200)
      expect(new URL((await result.json()).url).searchParams.has('error')).toBe(
        false
      )
      cookie = sessionCookies(result)
      expect(cookie).toContain('next-auth.session-token=')
    } else {
      const result = await requestWeb(web.origin + '/api/auth/sign-in/email', {
        method: 'POST',
        headers: appHeaders,
        body: JSON.stringify({
          email: context.identity.users[0]!.email,
          password: context.identity.users[0]!.password,
        }),
        redirect: 'manual',
      })
      expect(result.status).toBe(200)
      const token = result.headers
        .getSetCookie()
        .find((value) => value.startsWith('__Host-locadora.session_token='))
      expect(token).toMatch(/; Secure(?:;|$)/i)
      expect(token).toMatch(/; HttpOnly(?:;|$)/i)
      expect(token).not.toMatch(/; Domain=/i)
      cookie = sessionCookies(result)
    }
    if (target === context.api) migratedCookie = cookie
    // A sessão vale no web e em todo host no ar (a raiz só enquanto existe).
    for (const origin of [web.origin, ...parityTargets(context)]) {
      const response = await requestWeb(origin + endpoint, {
        headers: {
          Host: 'app.platform.test',
          Cookie: cookie,
          ...clientIpHeaders,
        },
      })
      expect(response.status).toBe(200)
      expect((await response.json()).user.id).toBe(
        context.identity.users[0]!.id
      )
    }
  })

  it('preserves authenticated tenant isolation and rejects a sibling origin without writing', async () => {
    const headers = { 'x-tenant-id': context.alfa.id }
    const current = await request('/api/addresses', { headers })
    expect(current.status).toBe(200)
    const body = await current.text()
    expect(body).toContain(context.addresses.alfa[0])
    expect(body).not.toContain(context.addresses.bravo[0])
    const before = await pool.query(
      'SELECT count(*)::int AS count FROM addresses WHERE "tenantId"=$1',
      [context.alfa.id]
    )
    const forged = await request('/api/addresses', {
      method: 'POST',
      headers: {
        ...headers,
        Origin: `https://${context.bravo.slug}.platform.test`,
        'Sec-Fetch-Site': 'same-site',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(forged.status).toBe(403)
    const after = await pool.query(
      'SELECT count(*)::int AS count FROM addresses WHERE "tenantId"=$1',
      [context.alfa.id]
    )
    expect(after.rows).toEqual(before.rows)
    const own = await request('/api/addresses', {
      method: 'POST',
      headers: {
        ...headers,
        Origin: `https://${host}`,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    expect(own.status).toBe(400) // Passed the origin gate; unchanged strict address schema.
  })

  // B5 da onda 135: o orçamento da vitrine (POST /api/quotes, chamado pelo formulário de /orcamento) passa pelo proxy
  // compilado do host da locadora e nasce na locadora do Host, mesmo com cabeçalhos de borda forjados para outra.
  it('creates a public quote through the tenant host proxy, owned by the Host tenant', async () => {
    const marker = 'web-tenant-quote-' + randomUUID()
    const forwarded = web.forwarded.length
    const response = await request('/api/quotes', {
      method: 'POST',
      headers: {
        Cookie: '',
        Origin: `https://${host}`,
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
        'x-platform-edge-auth': context.secret,
        'x-platform-host-kind': 'tenant',
        'x-platform-tenant-slug': context.bravo.slug,
        'x-platform-origin': `https://${context.bravo.slug}.platform.test`,
      },
      body: JSON.stringify({
        customerName: marker,
        customerEmail: 'web-tenant-quote@example.test',
        customerPhone: '',
        deliveryType: 'PICKUP',
        items: [
          {
            equipmentId: context.alfa.equipmentIds[0],
            quantity: 1,
            days: 3,
            startDate: '2034-04-01T00:00:00.000Z',
            endDate: '2034-04-04T00:00:00.000Z',
            pricePerDay: 0.01,
            total: 0.03,
          },
        ],
        total: 0.03,
      }),
    })
    try {
      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        tenantId: context.alfa.id,
        name: marker,
        userId: null,
        status: 'PENDING',
      })
      expect(
        web.forwarded
          .slice(forwarded)
          .some((url) => url.startsWith('/api/quotes'))
      ).toBe(true)
      const stored = await pool.query(
        'SELECT q."tenantId" AS quote, i."tenantId" AS item FROM quotes q JOIN quote_items i ON i."quoteId" = q.id WHERE q.name = $1',
        [marker]
      )
      expect(stored.rows).toEqual([
        { quote: context.alfa.id, item: context.alfa.id },
      ])
    } finally {
      const ids = (
        await pool.query<{ id: string }>(
          'SELECT id FROM quotes WHERE name = $1',
          [marker]
        )
      ).rows.map((row) => row.id)
      await pool.query(
        'DELETE FROM outbox_events WHERE "aggregateId" = ANY($1)',
        [ids]
      )
      await pool.query('DELETE FROM quote_items WHERE "quoteId" = ANY($1)', [
        ids,
      ])
      await pool.query('DELETE FROM quotes WHERE id = ANY($1)', [ids])
    }
  })
})

it('the shared mobile HTTP client consumes both destinations with the same session and explicit tenant', async () => {
  const cookie = await signInParityUser(
    context,
    {
      'x-platform-edge-auth': context.secret,
      'x-platform-host-kind': 'app',
      'x-platform-origin': 'https://app.platform.test',
      'x-platform-client-ip': fixtureIp,
      'x-forwarded-for': fixtureIp,
    },
    0
  )
  for (const baseUrl of [...parityTargets(context)].reverse()) {
    const client = createHttpClient({
      baseUrl,
      requireBaseUrl: true,
      credentials: context.identity.mode === 'legacy' ? 'include' : 'omit',
      getHeaders: () => ({ Cookie: cookie, 'x-tenant-id': context.alfa.id }),
    })
    const addresses = await client.request<{
      addresses: Array<{ id: string }>
    }>('/api/addresses')
    expect(addresses.addresses.map((entry) => entry.id)).toContain(
      context.addresses.alfa[0]
    )
    expect(addresses.addresses.map((entry) => entry.id)).not.toContain(
      context.addresses.bravo[0]
    )
    const other = await client.request<{ addresses: Array<{ id: string }> }>(
      '/api/addresses',
      { headers: { 'x-tenant-id': context.bravo.id } }
    )
    // This user belongs to both companies: selection must switch scope, never merge it.
    expect(other.addresses.map((entry) => entry.id)).toContain(
      context.addresses.bravo[0]
    )
    expect(other.addresses.map((entry) => entry.id)).not.toContain(
      context.addresses.alfa[0]
    )
    const revoked = client.request('/api/addresses', {
      headers: { 'x-tenant-id': context.unconfigured },
    })
    await expect(revoked).rejects.toMatchObject({ status: 403 })
    await expect(revoked).rejects.toBeInstanceOf(HttpError)
    const catalog = await client.request<{ equipments: Array<{ id: string }> }>(
      '/api/equipments?tenantSlug=' + context.alfa.slug
    )
    expect(JSON.stringify(catalog)).toContain(context.alfa.equipmentIds[0])
    expect(JSON.stringify(catalog)).not.toContain(context.bravo.equipmentIds[0])
  }
}, 30000)
