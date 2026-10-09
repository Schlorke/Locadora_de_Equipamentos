import { describe, expect, it } from 'vitest'
import {
  compararDias,
  diaCivilDeColunaDate,
  diaCivilEmSaoPaulo,
  diferencaEmDias,
  maiorDia,
  menorDia,
  somarDias,
  validarDiaCivil,
} from './dia-civil'

describe('diaCivilEmSaoPaulo', () => {
  it('usa o dia civil de America/Sao_Paulo, não o de UTC', () => {
    expect(diaCivilEmSaoPaulo(new Date('2026-10-13T02:59:59.999Z'))).toBe(
      '2026-10-12'
    )
    expect(diaCivilEmSaoPaulo(new Date('2026-10-13T03:00:00.000Z'))).toBe(
      '2026-10-13'
    )
    expect(diaCivilEmSaoPaulo(new Date('2026-12-31T23:30:00-03:00'))).toBe(
      '2026-12-31'
    )
  })

  it('segue o horário de verão histórico do fuso (2018: UTC−2)', () => {
    expect(diaCivilEmSaoPaulo(new Date('2018-12-01T01:59:59Z'))).toBe(
      '2018-11-30'
    )
    expect(diaCivilEmSaoPaulo(new Date('2018-12-01T02:00:00Z'))).toBe(
      '2018-12-01'
    )
  })

  it('recusa data inválida', () => {
    expect(() => diaCivilEmSaoPaulo(new Date('x'))).toThrow(RangeError)
  })
})

describe('diaCivilDeColunaDate', () => {
  it('lê a coluna @db.Date pelos campos UTC (meia-noite UTC não é o dia anterior)', () => {
    const colunaDoPrisma = new Date('2026-10-05T00:00:00.000Z')
    expect(diaCivilDeColunaDate(colunaDoPrisma)).toBe('2026-10-05')
    expect(diaCivilEmSaoPaulo(colunaDoPrisma)).toBe('2026-10-04')
    expect(() => diaCivilDeColunaDate(new Date(Number.NaN))).toThrow(RangeError)
  })
})

describe('aritmética de dias civis', () => {
  it('soma e subtrai dias atravessando mês, ano e ano bissexto', () => {
    expect(somarDias('2026-10-05', 37)).toBe('2026-11-11')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(() => somarDias('2026-03-01', 0.5)).toThrow(RangeError)
  })

  it('compara e mede distância em dias', () => {
    expect(diferencaEmDias('2026-11-11', '2026-10-05')).toBe(37)
    expect(diferencaEmDias('2026-10-05', '2026-11-11')).toBe(-37)
    expect(compararDias('2026-10-05', '2026-10-05')).toBe(0)
    expect(menorDia('2026-10-06', '2026-10-05')).toBe('2026-10-05')
    expect(menorDia('2026-10-05', '2026-10-06')).toBe('2026-10-05')
    expect(maiorDia('2026-10-06', '2026-10-05')).toBe('2026-10-06')
    expect(maiorDia('2026-10-05', '2026-10-06')).toBe('2026-10-06')
  })

  it('valida formato e existência do dia', () => {
    expect(validarDiaCivil('2028-02-29')).toBe('2028-02-29')
    expect(() => validarDiaCivil('2026-02-29')).toThrow(RangeError)
    expect(() => validarDiaCivil('2026-10-5')).toThrow(RangeError)
    expect(() => validarDiaCivil('2026-10-05T00:00:00Z')).toThrow(RangeError)
    expect(() => validarDiaCivil('0050-01-01')).toThrow(RangeError)
  })
})
