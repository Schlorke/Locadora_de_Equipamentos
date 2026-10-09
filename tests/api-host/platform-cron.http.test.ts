import { expect, inject, it } from 'vitest'
import type {} from './global-setup'
import { parityTargets } from './targets'

const context = inject('apiParity')
it('protects the platform cron on both HTTP hosts and never falls back to the business connection', async () => {
  for (const host of parityTargets(context)) {
    const denied = await fetch(host + '/api/cron/platform', {
      redirect: 'manual',
    })
    expect(denied.status).toBe(401)
    expect(await denied.json()).toEqual({ error: 'Unauthorized' })
    expect(denied.headers.get('cache-control')).toBe('private, no-store')
    const authorized = await fetch(host + '/api/cron/platform', {
      redirect: 'manual',
      headers: {
        authorization:
          'Bearer ' +
          (process.env.API_CRON_SECRET ?? 'local-api-cron-fixture-only'),
      },
    })
    expect(authorized.status).toBe(503)
    expect(await authorized.json()).toEqual({
      error: 'Platform jobs unavailable',
    })
    expect(authorized.headers.get('cache-control')).toBe('private, no-store')
  }
})
