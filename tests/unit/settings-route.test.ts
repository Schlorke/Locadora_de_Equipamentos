import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  requireTenantPermission: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}))
// Contraparte da API compartilhada (onda 135, B5): a mesma rota montada pelo serviço, com os mesmos dublês na
// composição dele (`host/permissions` e `host/branding`). A metade legada sai no bloco F.
vi.mock('../../apps/services/api/src/host/permissions', () => ({
  requireTenantPermission: mocks.requireTenantPermission,
}))
vi.mock('../../apps/services/api/src/host/branding', () => ({
  getSettings: mocks.getSettings,
  updateSettings: mocks.updateSettings,
}))
import * as serviceRoute from '../../apps/services/api/src/app/api/admin/settings/route'
const principal = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  membershipId: 'member-a',
  role: 'ADMIN' as const,
}
const data = {
  seoTitle: 'Locadora A',
  seoDescription: 'Locações',
  themeColorPrimary: '#ea580c',
}
const getRequest = () =>
  new NextRequest('https://app.example.test/api/admin/settings')
const request = (body: unknown, origin = 'https://app.example.test') =>
  new NextRequest('https://app.example.test/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireTenantPermission.mockResolvedValue({ ok: true, principal })
  mocks.getSettings.mockResolvedValue({ success: true, data })
  mocks.updateSettings.mockResolvedValue({ success: true, data })
})
describe.each([['service', serviceRoute]] as const)(
  '%s',
  (_host, { GET, PUT }) => {
    describe('Settings tenant boundary', () => {
      it('does not read or write without a validated membership and permission', async () => {
        mocks.requireTenantPermission.mockImplementation(async () => ({
          ok: false,
          response: Response.json({ error: 'Acesso negado' }, { status: 403 }),
        }))
        expect((await GET(getRequest())).status).toBe(403)
        expect((await PUT(request(data))).status).toBe(403)
        expect(mocks.getSettings).not.toHaveBeenCalled()
        expect(mocks.updateSettings).not.toHaveBeenCalled()
      })
      it('uses SETTINGS READ and passes the server principal to the uncached query', async () => {
        const req = getRequest(),
          response = await GET(req)
        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(
          req,
          'SETTINGS',
          'READ'
        )
        expect(mocks.getSettings).toHaveBeenCalledExactlyOnceWith(principal)
      })
      it('blocks another origin and malformed input before writing', async () => {
        expect(
          (await PUT(request(data, 'https://other.example.test'))).status
        ).toBe(403)
        expect((await PUT(request({}))).status).toBe(400)
        expect(mocks.updateSettings).not.toHaveBeenCalled()
      })
      it('ignores client tenant fields and writes under the authorized principal', async () => {
        const req = request({ ...data, tenantId: 'tenant-b' })
        expect((await PUT(req)).status).toBe(200)
        expect(mocks.requireTenantPermission).toHaveBeenCalledWith(
          req,
          'SETTINGS',
          'WRITE'
        )
        expect(mocks.updateSettings).toHaveBeenCalledWith(
          principal,
          expect.objectContaining(data)
        )
        expect(mocks.updateSettings.mock.calls[0][1]).not.toHaveProperty(
          'tenantId'
        )
      })
    })
  }
)
