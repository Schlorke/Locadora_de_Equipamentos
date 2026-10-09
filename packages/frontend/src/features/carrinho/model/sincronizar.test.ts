import { describe, expect, it } from 'vitest'
import { mapServerCartItem } from './sincronizar'
import { buildQuotePricing } from '../../../entities/orcamento'

describe('mapa do carrinho do servidor', () => {
  it('copia nome, preço e deixa o total ausente como indefinido', () => {
    const mapped = mapServerCartItem({
      equipmentId: 'abc',
      equipment: {
        name: 'Betoneira',
        maxStock: 4,
        description: 'Para concreto',
        category: { name: 'Concreto' },
        images: ['/foto.jpg'],
      },
      pricePerDay: 100,
      quantity: 2,
      days: 3,
    })

    expect(mapped.equipmentName).toBe('Betoneira')
    expect(mapped.pricePerDay).toBe(100)
    expect(mapped.finalPrice).toBeUndefined()
    expect(mapped.category).toEqual({ name: 'Concreto' })
    expect(mapped.images).toEqual(['/foto.jpg'])
  })

  it('converte o preço final numérico', () => {
    const mapped = mapServerCartItem({
      equipmentId: 'abc',
      equipment: { name: 'Betoneira' },
      pricePerDay: 100,
      quantity: 1,
      days: 1,
      finalPrice: 250,
    })
    expect(mapped.finalPrice).toBe(250)
  })

  it('usa a base do catálogo e suas regras, sem descontar novamente a taxa já ajustada da linha', () => {
    const mapped = mapServerCartItem({
      equipmentId: 'abc',
      equipment: { name: 'Betoneira', pricePerDay: '100', weeklyDiscount: 10 },
      pricePerDay: '90',
      quantity: 2,
      days: 7,
      finalPrice: '1260',
    })
    expect(mapped.pricePerDay).toBe(100)
    expect(mapped.weeklyDiscount).toBe(10)
    expect(buildQuotePricing(mapped, mapped.days, mapped.quantity).total).toBe(
      1260
    )
  })

  it('mantém valores diretos decimais e zero, além de datas e opção de fim de semana do aparelho', () => {
    const startDate = new Date('2026-10-03T12:00:00.000Z')
    const original = {
      equipmentId: 'abc',
      equipmentName: 'Antigo',
      pricePerDay: 100,
      days: 7,
      quantity: 1,
      startDate,
      includeWeekends: true,
      includeWeekendsConfirmed: true,
    }
    const mapped = mapServerCartItem(
      {
        equipmentId: 'abc',
        equipment: {
          name: 'Betoneira',
          pricePerDay: '100',
          weeklyUseDirectValue: true,
          weeklyDirectValue: '400.00',
          dailyUseDirectValue: true,
          dailyDirectValue: '0',
        },
        pricePerDay: '57.142857',
        quantity: 1,
        days: 7,
        finalPrice: 0,
      },
      original
    )
    expect(buildQuotePricing(mapped, 7, 1).total).toBe(400)
    expect(buildQuotePricing(mapped, 1, 1).total).toBe(0)
    expect(mapped).toMatchObject({
      finalPrice: 0,
      startDate,
      includeWeekends: true,
      includeWeekendsConfirmed: true,
    })
  })
})
