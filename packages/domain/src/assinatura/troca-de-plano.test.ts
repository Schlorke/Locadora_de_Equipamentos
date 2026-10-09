import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import type { EstadoDaAssinatura } from './estado'
import { planejarTrocaDePlano } from './troca-de-plano'
import type { SentidoDaTroca } from './troca-de-plano'

const agora = new Date('2026-10-20T12:00:00-03:00')

function trocar(
  estado: EstadoDaAssinatura,
  sentido: SentidoDaTroca,
  currentPeriodEnd: string | null = '2026-11-04'
) {
  return planejarTrocaDePlano(
    { estado, sentido, valorNovo: '199.90', currentPeriodEnd },
    agora
  )
}

describe('planejarTrocaDePlano', () => {
  it.each([
    ['INCOMPLETE', 'UPGRADE', 'ASSINATURA_NAO_ATIVADA'],
    ['INCOMPLETE', 'DOWNGRADE', 'ASSINATURA_NAO_ATIVADA'],
    ['PAST_DUE', 'UPGRADE', 'DIVIDA_EM_ABERTO'],
    ['SUSPENDED', 'UPGRADE', 'DIVIDA_EM_ABERTO'],
    ['SUSPENDED', 'DOWNGRADE', 'DIVIDA_EM_ABERTO'],
    ['CANCELED', 'UPGRADE', 'ASSINATURA_ENCERRADA'],
    ['CANCELED', 'DOWNGRADE', 'ASSINATURA_ENCERRADA'],
  ] as const)('recusa %s em %s (%s)', (estado, sentido, motivo) => {
    expect(trocar(estado, sentido)).toEqual({ permitida: false, motivo })
  })

  it.each([
    ['TRIALING', 'UPGRADE'],
    ['ACTIVE', 'UPGRADE'],
    ['TRIALING', 'DOWNGRADE'],
    ['ACTIVE', 'DOWNGRADE'],
    ['PAST_DUE', 'DOWNGRADE'],
  ] as const)(
    'permite %s em %s, sempre sem ajuste proporcional',
    (estado, sentido) => {
      const troca = trocar(estado, sentido)
      expect(troca.permitida).toBe(true)
      if (!troca.permitida) return
      expect(troca.ajusteProporcional.isZero()).toBe(true)
      expect(troca.valorDaProximaFatura.equals(new Decimal('199.90'))).toBe(
        true
      )
    }
  )

  it('upgrade vale hoje; downgrade vale no fim do período', () => {
    expect(trocar('ACTIVE', 'UPGRADE')).toMatchObject({
      limitesNovosValemEm: '2026-10-20',
      agendada: false,
    })
    expect(trocar('ACTIVE', 'DOWNGRADE')).toMatchObject({
      limitesNovosValemEm: '2026-11-04',
      agendada: true,
    })
  })

  it('downgrade sem período em curso, ou com o período terminando hoje, vale hoje', () => {
    expect(trocar('TRIALING', 'DOWNGRADE', null)).toMatchObject({
      limitesNovosValemEm: '2026-10-20',
      agendada: false,
    })
    expect(trocar('ACTIVE', 'DOWNGRADE', '2026-10-20')).toMatchObject({
      limitesNovosValemEm: '2026-10-20',
      agendada: false,
    })
    expect(trocar('ACTIVE', 'DOWNGRADE', '2026-10-01')).toMatchObject({
      limitesNovosValemEm: '2026-10-20',
      agendada: false,
    })
  })

  it('recusa preço negativo, preço em number e fim de período inexistente', () => {
    expect(() =>
      planejarTrocaDePlano(
        {
          estado: 'ACTIVE',
          sentido: 'UPGRADE',
          valorNovo: '-1',
          currentPeriodEnd: null,
        },
        agora
      )
    ).toThrow(RangeError)
    expect(() =>
      planejarTrocaDePlano(
        {
          estado: 'ACTIVE',
          sentido: 'UPGRADE',
          valorNovo: 199.9 as unknown as string,
          currentPeriodEnd: null,
        },
        agora
      )
    ).toThrow(TypeError)
    expect(() => trocar('ACTIVE', 'DOWNGRADE', '2026-11-31')).toThrow(
      RangeError
    )
  })

  it('aceita plano gratuito (preço zero)', () => {
    const troca = planejarTrocaDePlano(
      {
        estado: 'ACTIVE',
        sentido: 'DOWNGRADE',
        valorNovo: '0',
        currentPeriodEnd: null,
      },
      agora
    )
    expect(troca.permitida && troca.valorDaProximaFatura.isZero()).toBe(true)
  })
})
