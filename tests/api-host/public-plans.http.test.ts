import { describe, expect, inject, it } from 'vitest'
import { parityTargets } from './targets'

const context = inject('apiParity')
describe.each(parityTargets(context))('public plan catalog at %s', (host) => {
  it('returns a neutral non-cacheable 503 without a separately configured platform role', async () => {
    // The shared harness explicitly clears PLATFORM_DATABASE_URL rather than inheriting a real operator connection.
    const response = await fetch(host + '/api/public/plans')
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.json()).toEqual({
      error: 'Catálogo de planos indisponível',
    })
  })
})
