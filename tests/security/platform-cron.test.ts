import { afterEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  runConfiguredPlatformJobs: fixture.run,
}))
import { GET as legacy } from '../../app/api/cron/platform/route'
import { GET as api } from '../../apps/services/api/src/app/api/cron/platform/route'

afterEach(() => {
  vi.unstubAllEnvs()
  fixture.run.mockReset()
})
describe.each([
  ['legacy', legacy],
  ['api', api],
])('platform cron %s', (_name, get) => {
  it.each([undefined, 'Bearer wrong'])(
    'denies %s before any platform pool or job',
    async (authorization) => {
      vi.stubEnv('CRON_SECRET', 'local-cron-fixture')
      const response = await get(
        new Request('http://localhost/api/cron/platform', {
          headers: authorization ? { authorization } : {},
        })
      )
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(fixture.run).not.toHaveBeenCalled()
    }
  )
  it('fails closed for missing cron configuration before touching platform composition', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const response = await get(
      new Request('http://localhost/api/cron/platform')
    )
    expect(response.status).toBe(503)
    expect(fixture.run).not.toHaveBeenCalled()
  })
  it('preserves status/body and marks authorized platform results private', async () => {
    vi.stubEnv('CRON_SECRET', 'local-cron-fixture')
    fixture.run.mockResolvedValue({
      status: 503,
      body: { error: 'Platform jobs unavailable' },
    })
    const response = await get(
      new Request('http://localhost/api/cron/platform', {
        headers: { authorization: 'Bearer local-cron-fixture' },
      })
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Platform jobs unavailable',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(fixture.run).toHaveBeenCalledOnce()
  })
})
