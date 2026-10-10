import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  organization: vi.fn(),
  transaction: vi.fn(),
  equipment: vi.fn(),
  tenantSetting: vi.fn(),
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({
    prisma: {
      organization: { findUnique: db.organization },
      $transaction: db.transaction,
    },
  }),
}))
import { GET as service } from '../../apps/services/api/src/app/api/equipments/[id]/route'

const request = () =>
  new NextRequest('http://api.test/api/equipments/eq-alfa?tenantSlug=alfa')
const params = (id = 'eq-alfa') => ({ params: Promise.resolve({ id }) })
beforeEach(() => {
  vi.resetAllMocks()
  db.organization.mockResolvedValue({
    id: 'tenant-alfa',
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  db.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: db.tenantSetting,
      equipment: { findFirst: db.equipment },
    })
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe.each([['serviço', service]] as const)(
  '%s — detalhe/erros',
  (_host, handler) => {
    it.each(['', 'invalid id', 'x'.repeat(129)])(
      'ID inválido %s recusa antes de acessar equipamento',
      async (id) => {
        const response = await handler(request(), params(id))
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
          error: 'Equipamento não encontrado',
        })
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(db.transaction).not.toHaveBeenCalled()
      }
    )
    it('leitura por id usa tenant na mesma transação e seleciona só campos públicos', async () => {
      db.equipment.mockResolvedValue(null)
      const response = await handler(request(), params())
      expect(response.status).toBe(404)
      expect(db.tenantSetting.mock.calls[0]![1]).toBe('tenant-alfa')
      const call = db.equipment.mock.calls[0]![0]
      expect(call.where).toEqual({ id: 'eq-alfa', tenantId: 'tenant-alfa' })
      expect(Object.keys(call.select).sort()).toEqual(
        [
          'id',
          'name',
          'description',
          'pricePerDay',
          'images',
          'available',
          'maxStock',
          'dailyDiscount',
          'weeklyDiscount',
          'biweeklyDiscount',
          'monthlyDiscount',
          'popularPeriod',
          'dailyDirectValue',
          'weeklyDirectValue',
          'biweeklyDirectValue',
          'monthlyDirectValue',
          'dailyUseDirectValue',
          'weeklyUseDirectValue',
          'biweeklyUseDirectValue',
          'monthlyUseDirectValue',
          'dailyRentalEnabled',
          'weeklyRentalEnabled',
          'biweeklyRentalEnabled',
          'monthlyRentalEnabled',
          'updatedAt',
          'category',
        ].sort()
      )
      expect(Object.keys(call.select.category.select).sort()).toEqual(
        [
          'id',
          'name',
          'slug',
          'icon',
          'iconColor',
          'bgColor',
          'fontColor',
          'customIcon',
        ].sort()
      )
    })
    it.each(['organization', 'equipment'] as const)(
      'falha em %s mantém o erro genérico sem vazar o banco',
      async (stage) => {
        db[stage].mockRejectedValue(new Error('fixture-private-error'))
        const response = await handler(request(), params())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao buscar equipamento',
        })
        if (stage === 'organization')
          expect(db.transaction).not.toHaveBeenCalled()
      }
    )
  }
)
