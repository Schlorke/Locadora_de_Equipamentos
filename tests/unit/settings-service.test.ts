import { SettingsSchema } from '@gb-locacoes/contracts/settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  withTenantTransaction: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  organization: vi.fn(),
  lock: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Contraparte da API compartilhada (onda 135, B5): o mesmo serviço de configurações montado pelo serviço
// (`host/branding`, sobre `host/tenant-transaction`), com o mesmo executor de transação como dublê.
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: mocks.withTenantTransaction,
}))
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  createSupabaseImageStorage: () => ({ getImageStorage: () => null }),
}))
import * as serviceSettings from '../../apps/services/api/src/host/branding'
import { revalidatePath } from 'next/cache'
const principal = {
  tenantId: 'tenant-a',
  userId: 'user-a',
  membershipId: 'member-a',
  role: 'ADMIN' as const,
}
beforeEach(() => {
  vi.mocked(revalidatePath).mockReset()
  vi.clearAllMocks()
  mocks.withTenantTransaction.mockImplementation(
    async (_principal, operation) =>
      operation({
        setting: {
          findMany: mocks.findMany,
          create: mocks.create,
          update: mocks.update,
        },
        organization: { findUnique: mocks.organization },
        $queryRaw: mocks.lock,
      })
  )
  mocks.findMany.mockResolvedValue([])
  mocks.organization.mockResolvedValue({ name: 'Locadora A' })
  mocks.create.mockImplementation(async ({ data: row }) => ({
    id: 'setting-a',
    ...row,
  }))
  mocks.update.mockImplementation(async ({ data: row }) => ({
    id: 'setting-a',
    tenantId: 'tenant-a',
    ...row,
  }))
})
describe.each([['service', serviceSettings]] as const)(
  '%s',
  (_host, { getSettings, updateSettings }) => {
    describe('Tenant settings service', () => {
      it('does not expose stored credentials or query another tenant', async () => {
        mocks.findMany.mockResolvedValue([
          {
            id: 'setting-a',
            tenantId: 'tenant-a',
            smtpConfig: {
              password: 'secret-placeholder',
              username: 'private-login',
              host: 'smtp.example.test',
            },
            securityConfig: {
              recaptchaSecretKey: 'recaptcha-placeholder',
              recaptchaSiteKey: 'public-key',
            },
          },
        ])
        const result = await getSettings(principal)
        expect(result.success).toBe(true)
        expect(JSON.stringify(result)).not.toContain('secret-placeholder')
        expect(JSON.stringify(result)).not.toContain('private-login')
        expect(JSON.stringify(result)).not.toContain('recaptcha-placeholder')
        expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
          where: { tenantId: 'tenant-a' },
          take: 2,
        })
        expect(mocks.withTenantTransaction).toHaveBeenCalledWith(
          principal,
          expect.any(Function)
        )
      })
      it('returns tenant-specific defaults without mutating a read request', async () => {
        const result = await getSettings(principal)
        expect(result).toEqual(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              seoTitle: 'Locadora A',
              contactEmail: '',
            }),
          })
        )
        expect(mocks.create).not.toHaveBeenCalled()
      })
      it('locks the organization and preserves private stored values on a normal edit', async () => {
        mocks.findMany.mockResolvedValue([
          {
            id: 'setting-a',
            tenantId: 'tenant-a',
            smtpConfig: { password: 'stored-placeholder' },
            securityConfig: { recaptchaSecretKey: 'stored-recaptcha' },
          },
        ])
        const result = await updateSettings(principal, data)
        expect(result.success).toBe(true)
        expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.findMany.mock.invocationCallOrder[0]!
        )
        expect(mocks.update).toHaveBeenCalledWith({
          where: { id_tenantId: { id: 'setting-a', tenantId: 'tenant-a' } },
          data: expect.objectContaining({
            smtpConfig: { password: 'stored-placeholder' },
            securityConfig: { recaptchaSecretKey: 'stored-recaptcha' },
          }),
        })
        expect(JSON.stringify(result)).not.toContain('stored-placeholder')
      })
      it('rejects plaintext credentials before opening a transaction', async () => {
        expect(
          (
            await updateSettings(principal, {
              ...data,
              smtpConfig: { password: 'attempted-placeholder' },
            })
          ).success
        ).toBe(false)
        expect(mocks.withTenantTransaction).not.toHaveBeenCalled()
      })
      it('fails rather than choosing an arbitrary duplicated settings row', async () => {
        mocks.findMany.mockResolvedValue([{ id: 'one' }, { id: 'two' }])
        expect((await getSettings(principal)).success).toBe(false)
        expect((await updateSettings(principal, data)).success).toBe(false)
        expect(mocks.update).not.toHaveBeenCalled()
        expect(mocks.create).not.toHaveBeenCalled()
      })
      it('invalidates both existing paths only after the transaction completes', async () => {
        const events: string[] = []
        const transaction = mocks.withTenantTransaction.getMockImplementation()!
        mocks.withTenantTransaction.mockImplementation(
          async (principal, operation) => {
            const result = await transaction(principal, operation)
            events.push('commit')
            return result
          }
        )
        vi.mocked(revalidatePath).mockImplementation((path) => {
          events.push(path)
        })
        expect((await updateSettings(principal, data)).success).toBe(true)
        expect(events).toEqual(['commit', '/admin/settings', '/'])
      })
      it('preserves the existing failure envelope if post-commit invalidation throws', async () => {
        vi.mocked(revalidatePath).mockImplementation(() => {
          throw new Error('cache fixture unavailable')
        })
        const result = await updateSettings(principal, data)
        expect(result).toEqual({
          success: false,
          error: 'Não foi possível atualizar as configurações desta locadora.',
        })
        expect(mocks.create).toHaveBeenCalledOnce()
        expect(revalidatePath).toHaveBeenCalledExactlyOnceWith(
          '/admin/settings'
        )
      })
    })
  }
)

const data = SettingsSchema.parse({
  seoTitle: 'Locadora A',
  seoDescription: 'Locações',
  themeColorPrimary: '#ea580c',
})
