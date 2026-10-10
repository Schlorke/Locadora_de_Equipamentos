import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  read: vi.fn(),
  register: vi.fn(),
  resend: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: mocks.session,
}))
vi.mock('../../apps/services/api/src/host/credential-accounts', () => ({
  ownerAccountHandlers: mocks,
}))
import * as serviceRegister from '../../apps/services/api/src/app/api/auth/owner-register/route'
import * as serviceRead from '../../apps/services/api/src/app/api/auth/owner-account/route'
import * as serviceResend from '../../apps/services/api/src/app/api/auth/owner-verification/route'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'current-owner' } })
  for (const handler of [mocks.read, mocks.register, mocks.resend])
    handler.mockImplementation(() =>
      Promise.resolve(
        Response.json(
          { message: 'fixture' },
          {
            headers: {
              'Cache-Control': 'private, no-store',
              Vary: 'Cookie, Host',
            },
          }
        )
      )
    )
})
afterEach(() => vi.unstubAllEnvs())
describe.each([['API', serviceRegister, serviceRead, serviceResend]] as const)(
  '%s owner account adapters',
  (_name, register, read, resend) => {
    it('rejects a sibling browser origin before even reading the session', async () => {
      vi.stubEnv('PLATFORM_ENV', 'staging')
      vi.stubEnv('PLATFORM_ROOT_DOMAIN', 'example.invalid')
      vi.stubEnv('PLATFORM_EDGE_SECRET', 's'.repeat(32))
      const response = await resend.POST(
        new Request('https://app.example.invalid/api/auth/owner-verification', {
          method: 'POST',
          headers: {
            'x-platform-edge-auth': 's'.repeat(32),
            'x-platform-host-kind': 'app',
            'x-platform-origin': 'https://app.example.invalid',
            Origin: 'https://bravo.example.invalid',
            'Sec-Fetch-Site': 'same-site',
          },
        })
      )
      expect(response.status).toBe(403)
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(mocks.session).not.toHaveBeenCalled()
      expect(mocks.resend).not.toHaveBeenCalled()
    })
    it('delegates anonymous registration without inventing a user or duplicating its rule', async () => {
      const request = new Request(
        'https://app.example.invalid/api/auth/owner-register',
        { method: 'POST' }
      )
      await register.POST(request)
      expect(mocks.register).toHaveBeenCalledExactlyOnceWith(request)
      expect(mocks.session).not.toHaveBeenCalled()
      expect(Object.keys(register).sort()).toEqual([
        'POST',
        'dynamic',
        'revalidate',
        'runtime',
      ])
    })
    it('binds reads and resends to the real session id and preserves private headers', async () => {
      const get = new Request(
        'https://app.example.invalid/api/auth/owner-account'
      )
      const post = new Request(
        'https://app.example.invalid/api/auth/owner-verification',
        { method: 'POST' }
      )
      const response = await read.GET(get)
      await resend.POST(post)
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith(get, 'current-owner')
      expect(mocks.resend).toHaveBeenCalledExactlyOnceWith(
        post,
        'current-owner'
      )
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('vary')).toBe('Cookie, Host')
    })
    it('refuses missing identity before fact lookup or resend in both private routes', async () => {
      mocks.session.mockResolvedValue(null)
      for (const response of [
        await read.GET(new Request('https://app.example.invalid')),
        await resend.POST(
          new Request('https://app.example.invalid', { method: 'POST' })
        ),
      ]) {
        expect(response.status).toBe(401)
        expect(response.headers.get('cache-control')).toBe('private, no-store')
      }
      expect(mocks.read).not.toHaveBeenCalled()
      expect(mocks.resend).not.toHaveBeenCalled()
    })
  }
)
