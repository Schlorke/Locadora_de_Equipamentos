import type { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createQuoteWithItems,
  createTestTracker,
  createUser,
} from '../helpers/fixtures'

const sessionState = vi.hoisted(() => ({ userId: 'test-admin' }))

// Contraparte da API compartilhada (onda 135, E5): a mesma sessão no leitor do serviço (`host/session`), a mesma
// rota montada pelo serviço e o mesmo banco descartável (`getDatabaseRuntime`). A metade da raiz legada sai no F.
vi.mock('../../apps/services/api/src/host/session', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../apps/services/api/src/host/session')
  >()),
  getServerSession: async () => ({ user: { id: sessionState.userId } }),
}))

const { prisma } = getDatabaseRuntime()
const HOSTS = [
  {
    name: 'service',
    route: () =>
      import('../../apps/services/api/src/app/api/admin/quotes/[id]/route'),
  },
] as const

describe.each(HOSTS)('$name: admin quote adjustment', ({ route }) => {
  const tracker = createTestTracker()
  let PATCH: Awaited<ReturnType<typeof route>>['PATCH']
  beforeAll(async () => {
    ;({ PATCH } = await route())
  })
  let equipmentId: string

  beforeAll(async () => {
    const adminUser = await createUser(tracker, {
      role: 'ADMIN',
      email: `admin-${Date.now()}@example.com`,
    })
    sessionState.userId = adminUser.id

    const category = await createCategory(tracker)
    const equipment = await createEquipment(tracker, category.id)
    equipmentId = equipment.id
  })

  afterAll(async () => {
    await cleanupTestData(tracker)
  })

  it('requires reason when adjusting final total', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 3,
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({ finalTotal: 999 }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(400)
    const data = (await response!.json()) as { error?: string }
    expect(data.error).toBeTruthy()
  })

  it('rejects non-positive final total adjustments', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 3,
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({
        finalTotal: 0,
        priceAdjustmentReason: 'invalid total for test',
      }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(400)
    const data = (await response!.json()) as { error?: string }
    expect(data.error).toBeTruthy()
  })

  it('records approval and sets status to APPROVED', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 2,
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(200)

    const updated = await prisma.quote.findUnique({
      where: { id: quote.id },
      select: { status: true, approvedAt: true, approvedBy: true },
    })

    expect(updated?.status).toBe('APPROVED')
    expect(updated?.approvedAt).toBeTruthy()
    expect(updated?.approvedBy).toBe(sessionState.userId)
  })

  it('stores final total and justification', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 4,
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({
        finalTotal: 1234.56,
        priceAdjustmentReason: 'manual adjustment for test',
      }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(200)

    const updated = await prisma.quote.findUnique({
      where: { id: quote.id },
      select: { finalTotal: true, priceAdjustmentReason: true },
    })

    expect(Number(updated?.finalTotal || 0)).toBeCloseTo(1234.56, 2)
    expect(updated?.priceAdjustmentReason).toBe('manual adjustment for test')
  })

  it('preserves manual final total when approving late fee in same request', async () => {
    const quote = await createQuoteWithItems(tracker, {
      equipmentId,
      days: 5,
    })

    const request = new Request('http://localhost/api/admin/quotes', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tracker.tenantId,
      },
      body: JSON.stringify({
        finalTotal: 1000,
        priceAdjustmentReason: 'manual adjustment with late fee',
        lateFee: 120,
        lateFeeApproved: true,
      }),
    })

    const response = await PATCH(request as NextRequest, {
      params: Promise.resolve({ id: quote.id }),
    })

    expect(response).toBeDefined()
    expect(response!.status).toBe(200)

    const updated = await prisma.quote.findUnique({
      where: { id: quote.id },
      select: { finalTotal: true, priceAdjustmentReason: true, lateFee: true },
    })

    expect(Number(updated?.finalTotal || 0)).toBeCloseTo(1120, 2)
    expect(updated?.priceAdjustmentReason).toBe(
      'manual adjustment with late fee'
    )
    expect(Number(updated?.lateFee || 0)).toBeCloseTo(120, 2)
  })
})
