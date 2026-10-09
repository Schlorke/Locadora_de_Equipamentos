import { describe, expect, it, vi } from 'vitest'
import { createOnboardingOptionsHandler } from './onboarding-options'
import { OnboardingError } from '../modules/onboarding/index'
const env = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'example.invalid',
  PLATFORM_EDGE_SECRET: 's'.repeat(32),
}
const headers = {
  'x-platform-edge-auth': env.PLATFORM_EDGE_SECRET,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.example.invalid',
}
function setup() {
  const read = vi.fn(async () => ({ mode: 'off' }))
  return {
    read,
    handle: createOnboardingOptionsHandler({ environment: () => env, read }),
  }
}
function request(
  extra: Record<string, string> = {},
  url = 'https://internal.invalid/api/onboarding/options',
  method = 'GET'
) {
  return new Request(url, { method, headers: { ...headers, ...extra } })
}
const hostileHeaders: Record<string, string>[] = [
  { origin: 'https://evil.invalid' },
  { origin: 'https://bravo.example.invalid' },
  { 'sec-fetch-site': 'same-site' },
  { 'x-platform-edge-auth': 'forged' },
  {
    'x-platform-host-kind': 'tenant',
    'x-platform-tenant-slug': 'alfa',
    'x-platform-origin': 'https://alfa.example.invalid',
  },
  {
    'x-platform-host-kind': 'apex',
    'x-platform-origin': 'https://example.invalid',
  },
]
describe('anonymous app-bound options HTTP', () => {
  it.each(['GET', 'HEAD'])(
    'genuine app %s reads off privately without requiring account',
    async (method) => {
      const m = setup(),
        response = await m.handle(request({}, undefined, method))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ mode: 'off' })
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(response.headers.get('vary')).toBe('Cookie, Host')
      expect(m.read).toHaveBeenCalledTimes(1)
    }
  )
  it.each(hostileHeaders)(
    'hostile origin, forged edge or another host cannot read documents %#',
    async (extra) => {
      const m = setup(),
        response = await m.handle(request(extra))
      expect(response.status).toBe(403)
      expect(m.read).not.toHaveBeenCalled()
    }
  )
  it('no signed edge fails in production without trusting Host or forwarded host', async () => {
    const m = setup()
    const response = await m.handle(
      new Request('https://app.example.invalid/api/onboarding/options', {
        headers: { 'x-forwarded-host': 'app.example.invalid' },
      })
    )
    expect(response.status).toBe(403)
    expect(m.read).not.toHaveBeenCalled()
  })
  it('query refuses before publication and unsupported method has exact Allow', async () => {
    const m = setup()
    expect(
      (
        await m.handle(
          request(
            {},
            'https://internal.invalid/api/onboarding/options?publication=forged'
          )
        )
      ).status
    ).toBe(400)
    const response = await m.handle(request({}, undefined, 'POST'))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(m.read).not.toHaveBeenCalled()
  })
  it('unknown output and typed publication failure give neutral private errors', async () => {
    const m = setup()
    m.read.mockResolvedValueOnce({ mode: 'off', secret: 'never returned' } as {
      mode: string
    })
    let response = await m.handle(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain(
      'never returned'
    )
    m.read.mockRejectedValueOnce(
      new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
    )
    response = await m.handle(request())
    expect(await response.json()).toEqual({
      error: 'Não foi possível concluir esta etapa do cadastro.',
      code: 'LEGAL_PUBLICATION_UNAVAILABLE',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
