import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredOnboardingOptions: mocks.handle,
}))
import * as legacy from '../../app/api/onboarding/options/route'
import * as service from '../../apps/services/api/src/app/api/onboarding/options/route'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.handle.mockResolvedValue(
    Response.json(
      { mode: 'off' },
      {
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  )
})
describe.each([
  ['legacy', legacy],
  ['API', service],
] as const)('%s onboarding options', (_name, route) => {
  it('passes the exact request to one shared runtime and preserves response headers', async () => {
    const request = new Request(
      'https://app.example.invalid/api/onboarding/options'
    )
    const response = await route.GET(request)
    expect(mocks.handle).toHaveBeenCalledExactlyOnceWith(request)
    expect(await response.json()).toEqual({ mode: 'off' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie, Host')
    expect(route.runtime).toBe('nodejs')
    expect(route.dynamic).toBe('force-dynamic')
  })
  it('contains no mutation or legacy removal', () => {
    expect(Object.keys(route).sort()).toEqual([
      'GET',
      'dynamic',
      'revalidate',
      'runtime',
    ])
  })
})
