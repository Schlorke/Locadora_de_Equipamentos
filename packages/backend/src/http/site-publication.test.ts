import type { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSitePublicationHandler } from './site-publication'

const environment = {
  PLATFORM_ENV: 'production',
  PLATFORM_ROOT_DOMAIN: 'example.test',
  PLATFORM_EDGE_SECRET: 'synthetic-site-publication-edge-long32',
}
const principal = {
  tenantId: 'alfa',
  membershipId: 'owner-member',
  userId: 'owner',
  role: 'ADMIN' as const,
}
const instant = new Date('2026-10-04T12:00:00Z')
const transaction = vi.fn(async (_tenantId: string) => {})
const tx = {
  $executeRaw: async () => {},
  $queryRaw: async (sql: TemplateStringsArray) =>
    sql.join('').includes('platform_user_contacts')
      ? [{ authEmailVerified: true }]
      : [{ id: 'alfa' }],
  membership: {
    findFirst: async () => ({
      organization: {
        status: 'ACTIVE',
        ownerUserId: 'owner',
        access: 'FULL',
        sitePublishedAt: instant,
      },
    }),
  },
} as unknown as Prisma.TransactionClient
const handle = createSitePublicationHandler({
  transaction: async (tenantId, operation) => {
    await transaction(tenantId)
    return operation(tx)
  },
  withTenantTransaction: async () => {
    throw new Error('already published')
  },
  now: () => instant,
  environment: () => environment,
})
const headers = {
  'x-platform-edge-auth': environment.PLATFORM_EDGE_SECRET,
  'x-platform-host-kind': 'app',
  'x-platform-origin': 'https://app.example.test',
  Origin: 'https://app.example.test',
  'Content-Type': 'application/json',
}
const request = (
  body?: string,
  changes: Record<string, string> = {},
  query = ''
) =>
  new Request('https://backend.test/api/admin/site/publish' + query, {
    method: 'POST',
    headers: { ...headers, ...changes },
    body,
  })
beforeEach(() => {
  transaction.mockReset()
  transaction.mockResolvedValue(undefined)
})
describe('site publication HTTP contract', () => {
  it.each([undefined, '{}'])(
    'accepts an empty command %s with a private receipt',
    async (body) => {
      const response = await handle(request(body), principal)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        published: true,
        publishedAt: instant.toISOString(),
      })
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      expect(response.headers.get('Vary')).toBe('Cookie, Host')
    }
  )
  it.each([
    ['{"tenantId":"foreign"}', 400],
    ['{"siteIndexable":true}', 400],
    ['{"publishedAt":"2020-01-01"}', 400],
    ['null', 400],
    ['[]', 400],
    ['invalid', 400],
    [' '.repeat(1025), 413],
  ])('rejects body %s before any transaction', async (body, status) => {
    const response = await handle(request(body), principal)
    expect(response.status).toBe(status)
    expect(transaction).not.toHaveBeenCalled()
  })
  it.each([
    [{ Origin: 'https://bravo.example.test' }, 403],
    [{ 'Sec-Fetch-Site': 'same-site' }, 403],
    [{ 'x-platform-edge-auth': 'forged' }, 403],
    [
      {
        'x-platform-host-kind': 'tenant',
        'x-platform-tenant-slug': 'alfa',
        'x-platform-origin': 'https://alfa.example.test',
        Origin: 'https://alfa.example.test',
      },
      403,
    ],
    [{ 'Content-Type': 'text/plain' }, 415],
  ])('rejects untrusted context/content type %j', async (changes, status) => {
    expect((await handle(request('{}', changes), principal)).status).toBe(
      status
    )
    expect(transaction).not.toHaveBeenCalled()
  })
  it('rejects absent Origin, queries and wrong method before state changes', async () => {
    const noOrigin = request()
    noOrigin.headers.delete('Origin')
    expect((await handle(noOrigin, principal)).status).toBe(403)
    expect(
      (await handle(request(undefined, {}, '?tenantId=foreign'), principal))
        .status
    ).toBe(400)
    const response = await handle(
      new Request('https://backend.test/api/admin/site/publish', { headers }),
      principal
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
    expect(transaction).not.toHaveBeenCalled()
  })
  it('neutralizes driver errors that may include private configuration', async () => {
    transaction.mockRejectedValueOnce(
      new Error('connection string and password')
    )
    const response = await handle(request(), principal)
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('password')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
