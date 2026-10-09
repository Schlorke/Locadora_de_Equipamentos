import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  command: vi.fn(),
  session: vi.fn(),
}))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: mocks.access }))
vi.mock('@/lib/application-session', () => ({
  getServerSession: mocks.session,
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocks.access,
}))
vi.mock('../../apps/services/api/src/host/session', () => ({
  getServerSession: mocks.session,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  handleConfiguredOwnerCancellation: mocks.command,
  handleConfiguredOwnerActivation: mocks.command,
  handleConfiguredOwnerReactivation: mocks.command,
}))
import * as legacyCancel from '@/app/api/admin/subscription/cancel/route'
import * as legacyUndo from '@/app/api/admin/subscription/undo-cancel/route'
import * as apiCancel from '../../apps/services/api/src/app/api/admin/subscription/cancel/route'
import * as apiUndo from '../../apps/services/api/src/app/api/admin/subscription/undo-cancel/route'
import * as legacyActivate from '@/app/api/admin/subscription/activate/route'
import * as apiActivate from '../../apps/services/api/src/app/api/admin/subscription/activate/route'
import * as legacyReactivate from '@/app/api/admin/subscription/reactivate/route'
import * as apiReactivate from '../../apps/services/api/src/app/api/admin/subscription/reactivate/route'
const adapters = [
  ['legacy cancel', legacyCancel, 'cancel'],
  ['legacy undo', legacyUndo, 'undo-cancel'],
  ['API cancel', apiCancel, 'cancel'],
  ['API undo', apiUndo, 'undo-cancel'],
  ['legacy activate', legacyActivate, 'activate'],
  ['API activate', apiActivate, 'activate'],
  ['legacy reactivate', legacyReactivate, 'reactivate'],
  ['API reactivate', apiReactivate, 'reactivate'],
] as const
const principal = {
  tenantId: 'tenant-alfa',
  membershipId: 'membership-alfa',
  userId: 'owner-alfa',
  role: 'ADMIN',
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.access.mockResolvedValue({ ok: true, principal })
  mocks.command.mockResolvedValue(
    Response.json(
      { accepted: true },
      {
        headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
      }
    )
  )
})
describe.each(adapters)(
  '%s keeps dual-host cancellation contracts',
  (_name, adapter, action) => {
    const req = () =>
      new Request('https://app.example.test/api/admin/subscription/' + action, {
        method: 'POST',
        headers: { 'Idempotency-Key': 'fixture-cancel' },
      })
    it('delegates the original request, scoped principal, constant action and trusted session reader', async () => {
      const request = req()
      const response = await adapter.POST(request)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ accepted: true })
      if (action === 'activate' || action === 'reactivate')
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith(
          request,
          principal,
          mocks.session
        )
      else
        expect(mocks.command).toHaveBeenCalledExactlyOnceWith(
          request,
          principal,
          action,
          mocks.session
        )
      expect(adapter.runtime).toBe('nodejs')
      expect(adapter.dynamic).toBe('force-dynamic')
      expect(adapter.revalidate).toBe(0)
    })
    it('preserves central security/budget refusal and Retry-After without running command', async () => {
      mocks.access.mockResolvedValue({
        ok: false,
        response: Response.json(
          { code: 'RateLimited' },
          { status: 429, headers: { 'Retry-After': '120' } }
        ),
      })
      const response = await adapter.POST(req())
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('120')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(response.headers.get('Vary')).toBe('Cookie, Host')
      expect(mocks.command).not.toHaveBeenCalled()
    })
    it('does not confuse CLIENT/global-role metadata with an active ADMIN principal', async () => {
      mocks.access.mockResolvedValue({
        ok: true,
        principal: { ...principal, role: 'CLIENT', isOwner: true },
      })
      const response = await adapter.POST(req())
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'OWNER_REQUIRED' })
      expect(mocks.command).not.toHaveBeenCalled()
    })
    it('engine/composition failure stays neutral and private', async () => {
      mocks.command.mockRejectedValue(new Error('fixture private detail'))
      const response = await adapter.POST(req())
      expect(response.status).toBe(503)
      expect(JSON.stringify(await response.json())).not.toContain(
        'private detail'
      )
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    })
  }
)
