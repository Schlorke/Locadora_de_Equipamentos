import { describe, expect, it } from 'vitest'
import { formatarDocumento, identificarDocumento } from './tipo'

describe('identificarDocumento', () => {
  it('reconhece CPF, CNPJ numérico e CNPJ alfanumérico válidos e devolve a forma normalizada', () => {
    expect(identificarDocumento('529.982.247-25')).toEqual({
      tipo: 'CPF',
      normalizado: '52998224725',
    })
    expect(identificarDocumento('11.222.333/0001-81')).toEqual({
      tipo: 'CNPJ',
      normalizado: '11222333000181',
    })
    expect(identificarDocumento('12.abc.345/01de-35')).toEqual({
      tipo: 'CNPJ',
      normalizado: '12ABC34501DE35',
    })
  })

  it('devolve null para documento inválido ou de outra forma', () => {
    expect(identificarDocumento('529.982.247-26')).toBeNull()
    expect(identificarDocumento('12ABC34501DE36')).toBeNull()
    expect(identificarDocumento('abc')).toBeNull()
  })
})

describe('formatarDocumento', () => {
  it('formata pela forma: 11 dígitos como CPF e 14 posições como CNPJ', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25')
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarDocumento('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
    expect(formatarDocumento('123')).toBeNull()
  })
})
