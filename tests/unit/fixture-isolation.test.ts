import { describe, expect, it, vi } from 'vitest'

const query = vi.hoisted(() => vi.fn())
// As fixtures (tests/helpers/fixtures.ts) leem o banco pelo runtime do backend (onda 135, E4): o dublê fica nele.
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      outboxEvent: { deleteMany: query },
      organization: { upsert: query },
    },
  }),
}))
import {
  cleanupTestData,
  createTestTracker,
  ensureTestTenant,
} from '../helpers/fixtures'

describe('fixture tenant boundaries', () => {
  it('creates independent explicit tenant identities before any database call', () => {
    const first = createTestTracker()
    const second = createTestTracker()
    expect(first.tenantId).toMatch(/^fixture-/)
    expect(first.tenantSlug).toBe(first.tenantId)
    expect(first.tenantId).not.toBe(second.tenantId)
  })
  it('refuses setup and cleanup without a fixture tenant, before issuing SQL', async () => {
    const tracker = createTestTracker()
    Object.assign(tracker, { tenantId: undefined })
    await expect(ensureTestTenant(tracker)).rejects.toThrow(
      'Explicit fixture tenant required'
    )
    await expect(cleanupTestData(tracker)).rejects.toThrow(
      'Explicit fixture tenant required'
    )
    expect(query).not.toHaveBeenCalled()
  })
})
