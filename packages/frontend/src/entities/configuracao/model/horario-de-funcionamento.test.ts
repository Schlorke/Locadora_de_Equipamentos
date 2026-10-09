import { describe, expect, it } from 'vitest'
import {
  faixasDoHorario,
  horaDaVitrine,
  linhaDaFaixa,
} from './horario-de-funcionamento'

// Achado 147: o horário volta à vitrine a partir das configurações da própria locadora. Com o horário que o script da
// GB grava, as linhas são as mesmas da produção ("Seg-Sex: 8h às 18h" no rodapé; "Segunda a Sexta: 8h às 18h" e
// "Sábado: 8h às 12h • Domingo: Fechado" no contato).
const aberto = (open: string, close: string) => ({
  closed: false as const,
  open,
  close,
})
const HORARIO_DO_SCRIPT = {
  monday: aberto('08:00', '18:00'),
  tuesday: aberto('08:00', '18:00'),
  wednesday: aberto('08:00', '18:00'),
  thursday: aberto('08:00', '18:00'),
  friday: aberto('08:00', '18:00'),
  saturday: aberto('08:00', '12:00'),
  sunday: { closed: true as const },
}

describe('faixasDoHorario', () => {
  it('o horário do script da GB dá as linhas da produção', () => {
    const faixas = faixasDoHorario(HORARIO_DO_SCRIPT)
    expect(faixas.map((faixa) => linhaDaFaixa(faixa, 'curto'))).toEqual([
      'Seg-Sex: 8h às 18h',
      'Sáb: 8h às 12h',
      'Dom: Fechado',
    ])
    expect(faixas.map((faixa) => linhaDaFaixa(faixa, 'longo'))).toEqual([
      'Segunda a Sexta: 8h às 18h',
      'Sábado: 8h às 12h',
      'Domingo: Fechado',
    ])
  })

  it('outra locadora: minutos, dois dias seguidos e dia sem dado que quebra a faixa', () => {
    const faixas = faixasDoHorario({
      monday: aberto('07:30', '17:45'),
      tuesday: aberto('07:30', '17:45'),
      thursday: aberto('07:30', '17:45'),
      saturday: { closed: true },
      sunday: { closed: true },
    })
    expect(faixas.map((faixa) => linhaDaFaixa(faixa, 'longo'))).toEqual([
      'Segunda e Terça: 7h30 às 17h45',
      'Quinta: 7h30 às 17h45',
      'Sábado e Domingo: Fechado',
    ])
    expect(faixas.map((faixa) => faixa.diasCurto)).toEqual([
      'Seg-Ter',
      'Qui',
      'Sáb-Dom',
    ])
  })

  it('sem horário: nenhuma faixa (nunca o horário de outra locadora)', () => {
    for (const horario of [null, undefined, {}])
      expect(faixasDoHorario(horario)).toEqual([])
  })
})

describe('horaDaVitrine', () => {
  it('hora cheia sem minutos, meia hora com minutos, meia-noite', () => {
    expect(
      ['08:00', '18:00', '08:30', '00:00', '23:59'].map(horaDaVitrine)
    ).toEqual(['8h', '18h', '8h30', '0h', '23h59'])
  })
})
