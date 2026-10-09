/**
 * O IP gravado na auditoria vem da mesma regra de confiança do rate limit
 * (`clientIpFromHeaders` em lib/rate-limit.ts), nunca do X-Forwarded-For cru:
 * um cliente não escolhe o endereço que fica registrado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocked = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/lib/tenant', () => ({
  resolveTenantPrincipal: vi.fn(),
  withTenantTransaction: async (
    _context: unknown,
    operation: (_tx: unknown) => Promise<unknown>
  ) => operation({ auditLog: { create: mocked.create } }),
}))

import { createAuditLog } from '@/lib/audit-logger'

const principal = {
  tenantId: 'tenant-A',
  userId: 'user-A',
  membershipId: 'member-A',
  role: 'ADMIN',
} as Parameters<typeof createAuditLog>[0]

async function recordedIp(headers: Record<string, string>) {
  mocked.create.mockClear()
  await createAuditLog(principal, {
    action: 'UPDATE',
    entity: 'QUOTE',
    entityId: 'quote-A',
    request: new NextRequest('https://app.example.test/api/x', { headers }),
  })
  expect(mocked.create).toHaveBeenCalledTimes(1)
  return mocked.create.mock.calls[0]![0].data.ipAddress as string | null
}

describe('audit log client address', () => {
  beforeEach(() => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '')
    vi.stubEnv('VERCEL', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('behind trusted proxies records the proxy-appended hop, not the spoofed leftmost entry', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TRUSTED_PROXY_HOPS', '1')
    expect(
      await recordedIp({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })
    ).toBe('203.0.113.9')
  })

  it('on Vercel records x-real-ip and ignores a client-sent X-Forwarded-For', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    expect(
      await recordedIp({
        'x-forwarded-for': '6.6.6.6',
        'x-real-ip': '198.51.100.7',
      })
    ).toBe('198.51.100.7')
  })

  it('in production without a trusted source records no client-chosen value', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('NODE_ENV', 'production')
    expect(
      await recordedIp({
        'x-forwarded-for': '6.6.6.6',
        'x-real-ip': '6.6.6.7',
      })
    ).toBe('unknown')
  })

  it('never stores a header value that is not an IP address', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(
      await recordedIp({ 'x-forwarded-for': '<script>alert(1)</script>' })
    ).toBe('unknown')
    expect(
      await recordedIp({ 'x-forwarded-for': ' 192.0.2.10:443 , 10.0.0.1' })
    ).toBe('192.0.2.10')
  })

  it('keeps the explicit address when there is no request', async () => {
    mocked.create.mockClear()
    await createAuditLog(principal, {
      action: 'VIEW',
      entity: 'QUOTE',
      ipAddress: '192.0.2.44',
    })
    expect(mocked.create.mock.calls[0]![0].data).toMatchObject({
      tenantId: 'tenant-A',
      userId: 'user-A',
      ipAddress: '192.0.2.44',
      userAgent: null,
    })
  })
})
