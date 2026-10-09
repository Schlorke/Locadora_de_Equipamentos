import { describe, expect, it } from 'vitest'
import {
  FORMATO_CNPJ,
  calcularDigitosCnpj,
  formatarCnpj,
  normalizarCnpj,
  validarCnpj,
  valorDoCaractereCnpj,
} from './cnpj'

/**
 * Oráculo independente, escrito a partir da descrição oficial e não do código
 * de produção: pesos de 2 a 9 atribuídos da direita para a esquerda e
 * reiniciados depois do 9, valor do caractere = ASCII − 48.
 */
function digitoOraculo(caracteres: string): number {
  let soma = 0
  let peso = 2
  for (let i = caracteres.length - 1; i >= 0; i--) {
    soma += (caracteres.charCodeAt(i) - 48) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  return soma % 11 < 2 ? 0 : 11 - (soma % 11)
}

function dvOraculo(base: string): string {
  const primeiro = digitoOraculo(base)
  return `${primeiro}${digitoOraculo(base + String(primeiro))}`
}

/** Validador numérico que existia em `orcamento/documento.ts` antes do CNPJ alfanumérico. */
function validarCnpjNumericoLegado(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, '')
  if (numbers.length !== 14) return false
  if (/^(\d)\1{13}$/.test(numbers)) return false
  let length = numbers.length - 2
  let sequence = numbers.substring(0, length)
  const digits = numbers.substring(length)
  let sum = 0
  let pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(sequence.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digits.charAt(0))) return false
  length = length + 1
  sequence = numbers.substring(0, length)
  sum = 0
  pos = length - 7
  for (let i = length; i >= 1; i--) {
    sum += parseInt(sequence.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return result === parseInt(digits.charAt(1))
}

/** Gerador determinístico (LCG) para os testes de propriedade não oscilarem. */
function gerador(semente: number): () => number {
  let estado = semente >>> 0
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0
    return estado / 2 ** 32
  }
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function sortear(
  aleatorio: () => number,
  alfabeto: string,
  tamanho: number
): string {
  let texto = ''
  for (let i = 0; i < tamanho; i++) {
    texto += alfabeto.charAt(Math.floor(aleatorio() * alfabeto.length))
  }
  return texto
}

describe('CNPJ: vetores oficiais', () => {
  it('aceita o exemplo alfanumérico da Receita Federal 12.ABC.345/01DE-35', () => {
    expect(calcularDigitosCnpj('12ABC34501DE')).toBe('35')
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true)
    expect(validarCnpj('12ABC34501DE35')).toBe(true)
  })

  it('aceita CNPJs numéricos públicos (Receita Federal, Banco do Brasil) com e sem máscara', () => {
    expect(validarCnpj('00.394.460/0058-87')).toBe(true)
    expect(validarCnpj('00394460005887')).toBe(true)
    expect(validarCnpj('00.000.000/0001-91')).toBe(true)
    expect(validarCnpj('11.222.333/0001-81')).toBe(true)
  })

  it('usa o valor ASCII − 48: dígitos valem 0..9 e letras maiúsculas 17..42', () => {
    expect(valorDoCaractereCnpj('0')).toBe(0)
    expect(valorDoCaractereCnpj('9')).toBe(9)
    expect(valorDoCaractereCnpj('A')).toBe(17)
    expect(valorDoCaractereCnpj('Z')).toBe(42)
  })
})

describe('CNPJ: maiúsculas e normalização sem apagar letras', () => {
  it('passa letras minúsculas para maiúsculas antes de validar', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35')
    expect(validarCnpj('12.abc.345/01de-35')).toBe(true)
  })

  it('tira só ponto, barra, hífen e espaços e mantém as letras', () => {
    expect(normalizarCnpj(' 12 ABC 345/01DE-35 ')).toBe('12ABC34501DE35')
    expect(normalizarCnpj('12.ABC.345/01DE-35')).toHaveLength(14)
  })

  it('não transforma caractere não ASCII em letra (ß não vira SS)', () => {
    expect(normalizarCnpj('ß')).toBe('ß')
    // Base válida com "SS" no meio: trocar "SS" por "ß" não pode ser aceito.
    const base = '12ABSS4501DE'
    const cnpj = base + calcularDigitosCnpj(base)
    expect(validarCnpj(cnpj)).toBe(true)
    expect(validarCnpj(cnpj.replace('SS', 'ß'))).toBe(false)
  })

  it('formata com letras em maiúsculas e devolve null para outra forma', () => {
    expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35')
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarCnpj('123')).toBeNull()
    expect(formatarCnpj('12ABC34501DEA5')).toBeNull()
  })
})

describe('CNPJ: rejeições', () => {
  it.each([
    ['dígito verificador trocado', '12ABC34501DE36'],
    ['dígitos verificadores invertidos', '12ABC34501DE53'],
    ['letra na posição do dígito verificador', '12ABC34501DEA5'],
    ['13 posições', '12ABC34501DE3'],
    ['15 posições', '12ABC34501DE355'],
    ['caractere fora da máscara', '12ABC34501DE3_'],
    ['símbolo no meio', '12#BC34501DE35'],
    ['letra acentuada', '12ÁBC34501DE35'],
    ['todos zeros', '00.000.000/0000-00'],
    ['todos iguais', '11.111.111/1111-11'],
    ['numérico com dígito errado', '11222333000180'],
    ['vazio', ''],
  ])('recusa %s (%s)', (_caso, valor) => {
    expect(validarCnpj(valor)).toBe(false)
  })

  it('não calcula dígito de base fora do formato', () => {
    expect(() => calcularDigitosCnpj('12abc34501de')).toThrow(RangeError)
    expect(() => calcularDigitosCnpj('12ABC34501D')).toThrow(RangeError)
  })
})

describe('CNPJ: propriedades', () => {
  it('concorda com o oráculo independente em 2.000 bases alfanuméricas', () => {
    const aleatorio = gerador(20260926)
    for (let i = 0; i < 2000; i++) {
      const base = sortear(aleatorio, ALFABETO, 12)
      const dv = dvOraculo(base)
      expect(calcularDigitosCnpj(base)).toBe(dv)
      expect(FORMATO_CNPJ.test(base + dv)).toBe(true)
      expect(validarCnpj(base + dv)).toBe(true)
      const errado = String((Number(dv.charAt(1)) + 1) % 10)
      expect(validarCnpj(base + dv.charAt(0) + errado)).toBe(false)
    }
  })

  it('mantém o resultado do validador numérico anterior para CNPJs só com dígitos', () => {
    const aleatorio = gerador(49)
    for (let i = 0; i < 2000; i++) {
      const base = sortear(aleatorio, '0123456789', 12)
      const correto = base + dvOraculo(base)
      const qualquer = sortear(aleatorio, '0123456789', 14)
      for (const cnpj of [correto, qualquer]) {
        const mascarado = `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
        expect(validarCnpj(cnpj)).toBe(validarCnpjNumericoLegado(cnpj))
        expect(validarCnpj(mascarado)).toBe(
          validarCnpjNumericoLegado(mascarado)
        )
      }
    }
  })
})
