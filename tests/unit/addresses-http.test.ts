import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocked = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    address: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
  return { tx, transaction: vi.fn(), principal: vi.fn() }
})
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocked.transaction },
}))
vi.mock('@/lib/tenant', () => ({ resolveTenantPrincipal: mocked.principal }))
// Contraparte da API compartilhada (onda 135, E5/B5): as mesmas rotas montadas pelo serviço, com os mesmos dublês nas
// composições dele (`apps/services/api/src/host/*` e o banco do runtime do backend). A metade legada sai no bloco F.
vi.mock('@gb-locacoes/backend/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@gb-locacoes/backend/runtime')>()),
  getDatabaseRuntime: () => ({ prisma: { $transaction: mocked.transaction } }),
}))
vi.mock('../../apps/services/api/src/host/private-identity', () => ({
  resolveTenantPrincipal: mocked.principal,
}))
import * as legacyRoute0 from '@/app/api/addresses/route'
import * as serviceRoute0 from '../../apps/services/api/src/app/api/addresses/route'
import * as legacyRoute1 from '@/app/api/addresses/[id]/route'
import * as serviceRoute1 from '../../apps/services/api/src/app/api/addresses/[id]/route'

const HOSTS = [
  [
    'legacy root',
    {
      GET: legacyRoute0.GET,
      POST: legacyRoute0.POST,
      PATCH: legacyRoute1.PATCH,
      DELETE: legacyRoute1.DELETE,
    },
  ],
  [
    'service',
    {
      GET: serviceRoute0.GET,
      POST: serviceRoute0.POST,
      PATCH: serviceRoute1.PATCH,
      DELETE: serviceRoute1.DELETE,
    },
  ],
] as const

describe.each(HOSTS)('%s', (_host, { GET, POST, PATCH, DELETE }) => {
  const principal = {
    tenantId: 'tenant-A',
    userId: 'user-A',
    membershipId: 'member-A',
    role: 'CLIENT' as const,
  }
  const input = {
    street: 'Test street',
    number: '1',
    neighborhood: 'Test neighborhood',
    city: 'Test city',
    state: 'SP',
    zipCode: '01001000',
  }
  const saved = {
    id: 'address-A',
    ...input,
    tenantId: principal.tenantId,
    userId: principal.userId,
    isPrimary: false,
  }
  const params = { params: Promise.resolve({ id: saved.id }) }
  const request = (method: string, body?: unknown) =>
    new NextRequest('https://app.example.test/api/addresses', {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    })

  beforeEach(() => {
    vi.resetAllMocks()
    mocked.principal.mockResolvedValue({ ok: true, principal })
    mocked.transaction.mockImplementation(async (operation) =>
      operation(mocked.tx)
    )
    mocked.tx.address.findMany.mockResolvedValue([saved])
    mocked.tx.address.count.mockResolvedValue(1)
    mocked.tx.address.create.mockImplementation(async ({ data }) => ({
      id: saved.id,
      ...data,
    }))
    mocked.tx.address.findFirst.mockResolvedValue(saved)
    mocked.tx.address.findFirstOrThrow.mockResolvedValue(saved)
    mocked.tx.address.updateMany.mockResolvedValue({ count: 1 })
    mocked.tx.address.deleteMany.mockResolvedValue({ count: 1 })
  })

  describe('Address HTTP adapters use the extracted customer service', () => {
    it.each([401, 403, 409])(
      'propagates denied principal %i before database access',
      async (status) => {
        mocked.principal.mockResolvedValue({
          ok: false,
          response: Response.json({ error: 'Denied' }, { status }),
        })
        expect((await GET(request('GET'))).status).toBe(status)
        expect(mocked.transaction).not.toHaveBeenCalled()
      }
    )
    it('preserves GET envelope and sets the tenant on the injected transaction', async () => {
      const response = await GET(request('GET'))
      expect(await response.json()).toEqual({ addresses: [saved] })
      expect(mocked.tx.$queryRaw.mock.calls[0]?.[1]).toBe(principal.tenantId)
      expect(mocked.tx.address.findMany).toHaveBeenCalledWith({
        where: { tenantId: principal.tenantId, userId: principal.userId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      })
    })
    it('preserves POST 201 and drops identity/tenant/relations supplied in the payload', async () => {
      mocked.tx.address.count.mockResolvedValue(0)
      const response = await POST(
        request('POST', {
          ...input,
          state: 'sp',
          tenantId: 'tenant-B',
          userId: 'user-B',
          user: { connect: { id: 'user-B' } },
        })
      )
      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({
        address: { ...saved, isPrimary: true },
      })
      expect(mocked.tx.address.create).toHaveBeenCalledWith({
        data: {
          ...input,
          tenantId: principal.tenantId,
          userId: principal.userId,
          isPrimary: true,
        },
      })
    })
    it.each(['POST', 'PATCH'])(
      'rejects invalid %s fields before starting a transaction',
      async (method) => {
        const response =
          method === 'POST'
            ? await POST(request(method, { ...input, zipCode: 'invalid' }))
            : await PATCH(request(method, { street: '' }), params)
        expect(response.status).toBe(400)
        expect(mocked.transaction).not.toHaveBeenCalled()
      }
    )
    it('rejects malformed JSON without consulting storage', async () => {
      const response = await POST(
        new NextRequest('https://app.example.test/api/addresses', {
          method: 'POST',
          body: '{',
        })
      )
      expect(response.status).toBe(400)
      expect(mocked.transaction).not.toHaveBeenCalled()
    })
    it('preserves PATCH ownership predicates after extraction', async () => {
      const response = await PATCH(
        request('PATCH', {
          city: 'Updated',
          tenantId: 'tenant-B',
          userId: 'user-B',
        }),
        params
      )
      expect(response.status).toBe(200)
      expect(mocked.tx.address.updateMany).toHaveBeenCalledWith({
        where: {
          id: saved.id,
          tenantId: principal.tenantId,
          userId: principal.userId,
        },
        data: { city: 'Updated' },
      })
    })
    it.each(['PATCH', 'DELETE'])(
      'returns 404 for an invisible ID during %s',
      async (method) => {
        mocked.tx.address.findFirst.mockResolvedValue(null)
        const response =
          method === 'PATCH'
            ? await PATCH(request(method, { city: 'Updated' }), params)
            : await DELETE(request(method), params)
        expect(response.status).toBe(404)
        expect(mocked.tx.address.updateMany).not.toHaveBeenCalled()
        expect(mocked.tx.address.deleteMany).not.toHaveBeenCalled()
      }
    )
    it('preserves DELETE response and both ownership keys', async () => {
      const response = await DELETE(request('DELETE'), params)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        message: 'Endereço removido com sucesso',
      })
      expect(mocked.tx.address.deleteMany).toHaveBeenCalledWith({
        where: {
          id: saved.id,
          tenantId: principal.tenantId,
          userId: principal.userId,
        },
      })
    })
    it('does not expose database error messages', async () => {
      mocked.transaction.mockRejectedValue(new Error('internal storage detail'))
      const response = await GET(request('GET'))
      expect(response.status).toBe(500)
      expect(await response.text()).not.toContain('internal storage detail')
    })
  })
})
