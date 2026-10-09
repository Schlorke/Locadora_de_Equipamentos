import { describe, expect, it } from 'vitest'
import {
  calcularDigitosCpf,
  formatarCpf,
  normalizarCpf,
  validarCpf,
} from './cpf'

/** Validador que existia em `orcamento/documento.ts`, usado como oráculo para entradas só com dígitos e máscara. */
function validarCpfLegado(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '')
  if (numbers.length !== 11) return false
  if (/^(\d)\1{10}$/.test(numbers)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(numbers.charAt(i)) * (10 - i)
  let digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  if (digit !== parseInt(numbers.charAt(9))) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(numbers.charAt(i)) * (11 - i)
  digit = 11 - (sum % 11)
  if (digit >= 10) digit = 0
  return digit === parseInt(numbers.charAt(10))
}

function gerador(semente: number): () => number {
  let estado = semente >>> 0
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return estado / 2 ** 32
  }
}

describe('CPF', () => {
  it('calcula os dígitos verificadores pelo módulo 11', () => {
    expect(calcularDigitosCpf('529982247')).toBe('25')
    expect(calcularDigitosCpf('111444777')).toBe('35')
    expect(() => calcularDigitosCpf('52998224')).toThrow(RangeError)
    expect(() => calcularDigitosCpf('52998224A')).toThrow(RangeError)
  })

  it('aceita com e sem máscara e recusa dígito errado, repetidos e tamanho errado', () => {
    expect(validarCpf('529.982.247-25')).toBe(true)
    expect(validarCpf('52998224725')).toBe(true)
    expect(validarCpf(' 111.444.777-35 ')).toBe(true)
    expect(validarCpf('529.982.247-26')).toBe(false)
    expect(validarCpf('111.111.111-11')).toBe(false)
    expect(validarCpf('000.000.000-00')).toBe(false)
    expect(validarCpf('5299822472')).toBe(false)
    expect(validarCpf('529982247255')).toBe(false)
    expect(validarCpf('')).toBe(false)
  })

  it('não apaga letras nem símbolos: um CPF com caractere estranho é inválido', () => {
    expect(normalizarCpf('529.982.247-2x')).toBe('5299822472X')
    expect(validarCpf('529.982.247-25x')).toBe(false)
    expect(validarCpf('x529.982.247-25')).toBe(false)
    expect(validarCpf('529_982_247_25')).toBe(false)
  })

  it('formata 11 dígitos e devolve null para outra forma', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
    expect(formatarCpf('529-982-247.25')).toBe('529.982.247-25')
    expect(formatarCpf('123')).toBeNull()
    expect(formatarCpf('5299822472A')).toBeNull()
  })

  it('mantém o resultado do validador anterior para entradas só com dígitos e máscara', () => {
    const aleatorio = gerador(11)
    for (let i = 0; i < 2000; i++) {
      let base = ''
      for (let j = 0; j < 9; j++) base += String(Math.floor(aleatorio() * 10))
      const correto = base + calcularDigitosCpf(base)
      let qualquer = ''
      for (let j = 0; j < 11; j++)
        qualquer += String(Math.floor(aleatorio() * 10))
      for (const cpf of [correto, qualquer]) {
        const mascarado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
        expect(validarCpf(cpf)).toBe(validarCpfLegado(cpf))
        expect(validarCpf(mascarado)).toBe(validarCpfLegado(mascarado))
      }
    }
  })
})
