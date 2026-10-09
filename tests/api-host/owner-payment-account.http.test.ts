import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { signInParityUser } from './identity'
import { requestWeb, startWebConsumer } from './web-consumer'
import { namedParityTargets } from './targets'

const context = inject('apiParity')
const endpoint = '/api/admin/payment-account/connect'
const appOrigin = 'https://app.platform.test'
const edge = {
  'x-platform-edge-auth': context.secret,
  'x-platform-host-kind': 'app',
  'x-platform-origin': appOrigin,
  'x-platform-client-ip': context.directory.ips[44]!,
}

async function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  const vary = response.headers
    .get('vary')
    ?.toLowerCase()
    .split(/\s*,\s*/)
  expect(vary).toEqual(expect.arrayContaining(['cookie', 'host']))
  return response.json()
}

for (const [name, target] of namedParityTargets(context, {
  legacy: 'legacy',
  api: 'service',
})) {
  describe(`receiving-account requests through the real web proxy to ${name}`, () => {
    let web: Awaited<ReturnType<typeof startWebConsumer>>
    beforeAll(async () => {
      web = await startWebConsumer(context, target)
    }, 90_000)
    afterAll(async () => {
      await web?.stop()
    })

    const request = (headers: Record<string, string> = {}) =>
      requestWeb(web.origin + endpoint, {
        method: 'POST',
        headers: {
          Host: 'app.platform.test',
          Origin: appOrigin,
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'same-origin',
          'x-real-ip': context.directory.ips[44]!,
          ...headers,
        },
        body: '{}',
      })

    it('reaches the authentication refusal with a coherent app Host and Origin', async () => {
      const direct = await fetch(target + endpoint, {
        method: 'POST',
        headers: {
          ...edge,
          Origin: appOrigin,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      expect(await privateResponse(await request(), 401)).toEqual(
        await privateResponse(direct, 401)
      )
      expect(web.forwarded).toContain(endpoint)
    })

    it('keeps the private account GET behind the real authentication engine', async () => {
      await privateResponse(
        await requestWeb(web.origin + '/api/admin/payment-account', {
          headers: { Host: 'app.platform.test' },
        }),
        401
      )
    })

    it.each([
      'https://alfa.platform.test',
      'https://bravo.platform.test',
      'null',
    ])('refuses foreign or opaque browser Origin %s', async (Origin) => {
      expect(await privateResponse(await request({ Origin }), 403)).toEqual({
        error: 'Origem não permitida',
      })
    })

    it('does not treat same-origin metadata alone as an authenticated session', async () => {
      const headers = new Headers({
        Host: 'app.platform.test',
        'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json',
      })
      await privateResponse(
        await requestWeb(web.origin + endpoint, {
          method: 'POST',
          headers,
          body: '{}',
        }),
        401
      )
    })

    it('refuses same-site browser metadata even with the app Origin', async () => {
      await privateResponse(
        await request({ 'Sec-Fetch-Site': 'same-site' }),
        403
      )
    })

    it('replaces incoming forged edge context with the actual app Host', async () => {
      await privateResponse(
        await request({
          'x-platform-edge-auth': 'synthetic-invalid-edge',
          'x-platform-host-kind': 'tenant',
          'x-platform-tenant-slug': context.bravo.slug,
          'x-platform-origin': `https://${context.bravo.slug}.platform.test`,
        }),
        401
      )
    })

    it('never lets a forged edge Origin make a sibling browser origin trusted', async () => {
      const foreign = `https://${context.bravo.slug}.platform.test`
      await privateResponse(
        await request({
          ...edge,
          Origin: foreign,
          'x-platform-origin': foreign,
        }),
        403
      )
    })

    it('authenticates a real session while preserving the selected company role restriction', async () => {
      const cookie = await signInParityUser(context, edge, 0)
      const sessionEndpoint =
        context.identity.mode === 'legacy'
          ? '/api/auth/session'
          : '/api/auth/get-session'
      const session = await requestWeb(web.origin + sessionEndpoint, {
        headers: { Host: 'app.platform.test', Cookie: cookie },
      })
      expect(session.status).toBe(200)
      expect((await session.json()).user.id).toBe(context.identity.users[0]!.id)
      // This real user has a CLIENT membership in alfa. Global ADMIN must not
      // authorize the owner operation in a company selected by this request.
      expect(
        await privateResponse(
          await request({ Cookie: cookie, 'x-tenant-id': context.alfa.id }),
          403
        )
      ).toMatchObject({ code: 'OWNER_REQUIRED' })
    })
  })
}
