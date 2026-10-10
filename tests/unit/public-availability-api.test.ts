import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_SITE } from '../helpers/public-site'
import { NextRequest } from 'next/server'
import { RentalMutationError } from '@gb-locacoes/backend/rentals'

const db = vi.hoisted(() => ({
  organization: vi.fn(),
  transaction: vi.fn(),
  equipment: vi.fn(),
  rentals: vi.fn(),
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
import { GET as service } from '../../apps/services/api/src/app/api/equipments/[id]/availability/route'

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2032-02-17T22:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db.organization.mockResolvedValue({
    id: 'tenant-alfa',
    status: 'ACTIVE',
    ...LIVE_SITE,
  })
  db.equipment.mockResolvedValue({
    id: 'eq-alfa',
    name: 'private-equipment-name',
    maxStock: 3,
  })
  db.rentals.mockResolvedValue([])
  db.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: db.tenantSetting,
      equipment: { findFirst: db.equipment },
      rental_items: { findMany: db.rentals },
    })
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const request = (query: string) =>
  new NextRequest(
    `http://api.test/api/equipments/eq-alfa/availability?tenantSlug=alfa${query}`
  )
const params = () => ({ params: Promise.resolve({ id: 'eq-alfa' }) })

// Primeiro caracterizado no handler legado; depois aplicado ao serviço.
describe.each([['serviço', service]] as const)(
  '%s — adapter de disponibilidade',
  (_host, handler) => {
    it('mês padrão usa UTC, cobre o ano bissexto e mantém a transação tenant', async () => {
      const response = await handler(request(''), params())
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.month).toBe('2032-02')
      expect(body.equipmentId).toBe('eq-alfa')
      expect(body.maxStock).toBe(3)
      expect(Object.keys(body.availability)).toHaveLength(29)
      expect(body.availability['2032-02-29']).toEqual({
        available: true,
        availableQuantity: 3,
        totalQuantity: 3,
      })
      expect(db.tenantSetting.mock.calls[0]![1]).toBe('tenant-alfa')
      expect(db.equipment).toHaveBeenCalledWith({
        where: { id: 'eq-alfa', tenantId: 'tenant-alfa' },
        select: { id: true, name: true, maxStock: true, available: true },
      })
      expect(JSON.stringify(body)).not.toContain('private-equipment-name')
    })
    it('primeiro mês vence datas inválidas e segunda ocorrência', async () => {
      const response = await handler(
        request('&month=2030-01&month=bad&startDate=bad&endDate=bad'),
        params()
      )
      expect(response.status).toBe(200)
      expect(Object.keys((await response.json()).availability)).toHaveLength(31)
    })
    it('mês inválido recusa antes de ler o equipamento', async () => {
      const response = await handler(request('&month=bad'), params())
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Formato de mês inválido. Use YYYY-MM',
      })
      expect(db.transaction).not.toHaveBeenCalled()
    })
    it('sem equipamento mantém o erro de domínio 404', async () => {
      db.equipment.mockResolvedValue(null)
      const response = await handler(request('&month=2030-01'), params())
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        error: 'Equipamento não encontrado',
      })
    })
    it('erro de domínio conserva somente mensagem e status', async () => {
      db.equipment.mockRejectedValue(
        new RentalMutationError('Locadora indisponível', 403, 'tenant_inactive')
      )
      const response = await handler(request('&month=2030-01'), params())
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Locadora indisponível' })
    })
    it.each(['organization', 'equipment'] as const)(
      'falha em %s fica no servidor e responde 500 genérico',
      async (stage) => {
        db[stage].mockRejectedValue(new Error('fixture-private-db-error'))
        const response = await handler(request('&month=2030-01'), params())
        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({
          error: 'Erro ao verificar disponibilidade',
        })
        if (stage === 'organization')
          expect(db.transaction).not.toHaveBeenCalled()
      }
    )
  }
)
