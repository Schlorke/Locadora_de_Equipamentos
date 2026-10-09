import { describe, expect, it } from 'vitest'
import { rejectExplicitCrossOrigin } from './explicit-origin'
import { rejectExplicitCrossOrigin as principalReadRule } from '../modules/identity/same-origin-mutation'
import { rejectUntrustedZohoOrigin } from './zoho-origin'

const SECRET = 'edge-secret-explicit-origin-0123456789'
const ROOT = 'plataforma.test'
const env = {
  PLATFORM_ENV: 'staging',
  PLATFORM_ROOT_DOMAIN: ROOT,
  PLATFORM_EDGE_SECRET: SECRET,
  PLATFORM_EDGE_SECRET_PREVIOUS: '',
}
const appEdge = {
  'x-platform-edge-auth': SECRET,
  'x-platform-host-kind': 'app',
  'x-platform-origin': `https://app.${ROOT}`,
}
const read = (headers: Record<string, string>, method = 'GET') =>
  new Request('https://backend.internal/api/admin/badges', { method, headers })

async function refusal(response: Response | null) {
  expect(response).not.toBeNull()
  return {
    status: response!.status,
    cache: response!.headers.get('cache-control'),
    body: await response!.json(),
  }
}

describe('rejectExplicitCrossOrigin (private reads that refuse a foreign Origin on GET)', () => {
  it('lets requests without an Origin through: native app, server-to-server and top-level navigation', () => {
    expect(rejectExplicitCrossOrigin(undefined, env)).toBeNull()
    expect(rejectExplicitCrossOrigin(read(appEdge), env)).toBeNull()
    expect(
      rejectExplicitCrossOrigin(
        read({ ...appEdge, 'Sec-Fetch-Site': 'same-origin' }),
        env
      )
    ).toBeNull()
  })

  it('accepts the exact origin the trusted edge computed for the host', () => {
    expect(
      rejectExplicitCrossOrigin(
        read({ ...appEdge, Origin: `https://app.${ROOT}` }),
        env
      )
    ).toBeNull()
  })

  it.each(['GET', 'HEAD'])(
    'refuses a sibling locadora Origin on safe %s with the central 403 envelope',
    async (method) => {
      expect(
        await refusal(
          rejectExplicitCrossOrigin(
            read({ ...appEdge, Origin: `https://bravo.${ROOT}` }, method),
            env
          )
        )
      ).toEqual({
        status: 403,
        cache: 'no-store',
        body: { error: 'Origem não permitida' },
      })
    }
  )

  it.each([
    ['opaque', { Origin: 'null' }],
    [
      'cross-site metadata',
      { Origin: `https://app.${ROOT}`, 'Sec-Fetch-Site': 'cross-site' },
    ],
  ])('refuses an explicit %s browser request', async (_label, headers) => {
    expect(
      (
        await refusal(
          rejectExplicitCrossOrigin(read({ ...appEdge, ...headers }), env)
        )
      ).status
    ).toBe(403)
  })

  it('compares with the request origin when there is no edge and no configured public origin', async () => {
    expect(
      rejectExplicitCrossOrigin(
        read({ Origin: 'https://backend.internal' }),
        {}
      )
    ).toBeNull()
    expect(
      (
        await refusal(
          rejectExplicitCrossOrigin(
            read({ Origin: `https://bravo.${ROOT}` }),
            {}
          )
        )
      ).status
    ).toBe(403)
  })

  it('is the very rule the common private principal applies to every read (wave 132, finding 144)', () => {
    expect(rejectExplicitCrossOrigin).toBe(principalReadRule)
  })

  it('is the same rule the private Zoho reads already apply', async () => {
    const sibling = read({ ...appEdge, Origin: `https://bravo.${ROOT}` })
    expect(await refusal(rejectUntrustedZohoOrigin(sibling, env))).toEqual(
      await refusal(rejectExplicitCrossOrigin(sibling, env))
    )
    expect(rejectUntrustedZohoOrigin(read(appEdge), env)).toBeNull()
  })
})
