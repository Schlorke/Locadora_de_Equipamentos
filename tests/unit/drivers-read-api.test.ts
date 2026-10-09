import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ principal: vi.fn(), drivers: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: state.principal }))
vi.mock('@/lib/drivers', () => ({
  listDrivers: state.drivers,
  createDriver: vi.fn(),
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: state.principal,
}))
vi.mock('../../apps/services/api/src/host/operations', () => ({
  listDrivers: state.drivers,
}))
import { GET as legacy } from '@/app/api/admin/drivers/route'
import { GET as service } from '../../apps/services/api/src/app/api/admin/drivers/route'
const principal = {
  tenantId: 'tenant-fixture',
  userId: 'user-fixture',
  membershipId: 'member-fixture',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  state.principal.mockResolvedValue({ ok: true, principal })
  state.drivers.mockResolvedValue([
    {
      id: 'driver-fixture',
      tenantId: principal.tenantId,
      name: 'Fixture',
      status: 'ACTIVE',
    },
  ])
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
describe.each([
  ['legacy', legacy],
  ['service', service],
] as const)('%s driver listing characterization', (_host, GET) => {
  const request = (query = '') =>
    new NextRequest(`https://api.platform.test/api/admin/drivers${query}`)
  it.each([
    '',
    '?status=',
    '?status=ACTIVE',
    '?status=INACTIVE',
    '?status=ON_LEAVE',
    '?status=invalid',
    '?status=ACTIVE&status=INACTIVE',
  ])('preserves status forwarding and DTO: %s', async (query) => {
    const response = await GET(request(query))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      drivers: await state.drivers.mock.results[0]!.value,
    })
    expect(state.drivers).toHaveBeenCalledWith(
      principal,
      new URL(request(query).url).searchParams.get('status') || undefined
    )
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it.each(['CLIENT', 'OPERATOR', 'FINANCIAL'])(
    'denies %s before business access',
    async (role) => {
      state.principal.mockResolvedValueOnce({
        ok: true,
        principal: { ...principal, role },
      })
      const response = await GET(request())
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
      expect(state.drivers).not.toHaveBeenCalled()
    }
  )
  it('returns the principal denial without modifying its headers', async () => {
    const denial = Response.json(
      { error: 'Authentication required' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
    state.principal.mockResolvedValueOnce({ ok: false, response: denial })
    expect(await GET(request())).toBe(denial)
    expect(state.drivers).not.toHaveBeenCalled()
  })
  it.each(['principal', 'drivers'] as const)(
    'keeps %s failure generic',
    async (dependency) => {
      state[dependency].mockRejectedValueOnce(
        new Error('private-fixture-detail')
      )
      const response = await GET(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
      expect(console.error).toHaveBeenCalledWith('Tenant operation failed')
    }
  )
})
