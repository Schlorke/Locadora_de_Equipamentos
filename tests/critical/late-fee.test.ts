import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'
import { calculateAndApplyLateFees as legacyLateFees } from '@/lib/late-fee-calculator'
import { calculateAndApplyLateFees as serviceLateFees } from '../../apps/services/api/src/host/quotations'
import {
  cleanupTestData,
  createCategory,
  createEquipment,
  createQuoteWithItems,
  createTestTracker,
} from '../helpers/fixtures'

// Contraparte da API compartilhada (onda 135, E5): a mesma regra pela composição do serviço
// (`apps/services/api/src/host/*`), sobre o mesmo banco descartável (`getDatabaseRuntime`). A fachada da raiz legada
// sai no bloco F; a do serviço fica.
const { prisma } = getDatabaseRuntime()
const HOSTS = [
  { name: 'legacy root', calculateAndApplyLateFees: legacyLateFees },
  { name: 'service', calculateAndApplyLateFees: serviceLateFees },
] as const

describe.each(HOSTS)(
  '$name: late fee calculation',
  ({ calculateAndApplyLateFees }) => {
    const tracker = createTestTracker()
    let equipmentId: string

    beforeAll(async () => {
      const category = await createCategory(tracker)
      const equipment = await createEquipment(tracker, category.id)
      equipmentId = equipment.id
    })

    afterAll(async () => {
      await cleanupTestData(tracker)
    })

    it('persists a calculated fee of 100 for five days without approving it', async () => {
      const startDate = new Date('2026-01-06T00:00:00.000Z')
      const endDate = new Date('2026-01-11T00:00:00.000Z')
      const quote = await createQuoteWithItems(tracker, {
        equipmentId,
        status: 'APPROVED',
        startDate,
        endDate,
      })

      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          originalTotal: 1000,
          total: 1000,
          lateFee: null,
          lateFeeApproved: false,
        },
      })

      // Only Date is fixed: the real database sockets and transaction timers keep running.
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(new Date('2026-01-16T00:00:00.000Z'))
        const result = await calculateAndApplyLateFees({
          tenantId: tracker.tenantId,
        })
        expect(result).toMatchObject({
          processedQuotes: 1,
          updatedQuotes: 1,
          failedQuotes: 0,
          errors: [],
        })

        const updatedQuote = await prisma.quote.findUniqueOrThrow({
          where: { id: quote.id, tenantId: tracker.tenantId },
          select: { lateFee: true, lateFeeApproved: true },
        })

        expect(updatedQuote.lateFee?.toNumber()).toBe(100)
        expect(updatedQuote.lateFeeApproved).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  }
)
