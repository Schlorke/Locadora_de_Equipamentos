import { describe, expect, it } from 'vitest'
import {
  avaliarCota,
  direitosEfetivos,
  permiteEscrita,
  recursoNoPlano,
} from './direitos'
import type { AjusteDeDireito } from './direitos'
import type { AcessoDaOrganizacao } from './estado'

const plano = {
  schema: 1 as const,
  limits: { equipments: 30, staffSeats: null },
  features: { customDomain: false, logistics: true },
}

describe('avaliarCota', () => {
  it('permite até o limite e bloqueia a criação no limite (30 de 30)', () => {
    expect(avaliarCota(30, 29)).toEqual({
      permitido: true,
      limite: 30,
      usado: 29,
      restante: 1,
    })
    expect(avaliarCota(30, 30)).toEqual({
      permitido: false,
      limite: 30,
      usado: 30,
      restante: 0,
    })
  })

  it('depois de um downgrade o uso acima do limite só bloqueia a criação, sem restante negativo', () => {
    expect(avaliarCota(10, 30)).toEqual({
      permitido: false,
      limite: 10,
      usado: 30,
      restante: 0,
    })
  })

  it('limite null é ilimitado', () => {
    expect(avaliarCota(null, 10_000)).toEqual({
      permitido: true,
      limite: null,
      usado: 10_000,
      restante: null,
    })
  })

  it('considera o acréscimo pedido (duplicar vários itens de uma vez)', () => {
    expect(avaliarCota(30, 28, 2).permitido).toBe(true)
    expect(avaliarCota(30, 28, 3).permitido).toBe(false)
  })

  it('recusa números que não são contagens', () => {
    expect(() => avaliarCota(-1, 0)).toThrow(RangeError)
    expect(() => avaliarCota(1.5, 0)).toThrow(RangeError)
    expect(() => avaliarCota(30, -1)).toThrow(RangeError)
    expect(() => avaliarCota(30, 0, 0)).toThrow(RangeError)
    expect(() => avaliarCota(30, 0, 1.5)).toThrow(RangeError)
  })
})

describe('recursoNoPlano', () => {
  it('só o recurso ligado está no plano; ausente ou herdado do protótipo não está', () => {
    expect(recursoNoPlano(plano, 'logistics')).toBe(true)
    expect(recursoNoPlano(plano, 'customDomain')).toBe(false)
    expect(recursoNoPlano<string>(plano, 'whatsapp')).toBe(false)
    expect(recursoNoPlano<string>(plano, 'toString')).toBe(false)
  })
})

describe('permiteEscrita', () => {
  const casos: Array<
    [AcessoDaOrganizacao, Parameters<typeof permiteEscrita>[1], boolean]
  > = [
    ['FULL', undefined, true],
    ['SETUP', undefined, false],
    ['SETUP', { configuracao: true }, true],
    ['SETUP', { restrito: true, arquivado: true }, false],
    ['RESTRICTED', undefined, false],
    ['RESTRICTED', { restrito: true }, true],
    ['RESTRICTED', { configuracao: true, arquivado: true }, false],
    ['ARCHIVED', undefined, false],
    ['ARCHIVED', { arquivado: true }, true],
    ['ARCHIVED', { configuracao: true, restrito: true }, false],
  ]

  it.each(casos)('%s com exceção %o → %s', (acesso, excecao, esperado) => {
    expect(permiteEscrita(acesso, excecao)).toBe(esperado)
  })
})

describe('direitosEfetivos', () => {
  const agora = new Date('2026-10-20T12:00:00Z')
  const ajuste = (
    parcial: Partial<AjusteDeDireito> & Pick<AjusteDeDireito, 'key' | 'value'>
  ): AjusteDeDireito => ({
    createdAt: new Date('2026-10-01T00:00:00Z'),
    expiresAt: null,
    revokedAt: null,
    ...parcial,
  })

  it('aplica limites e módulos vigentes sem alterar o plano de origem', () => {
    const { direitos, ignorados } = direitosEfetivos(
      plano,
      [
        ajuste({ key: 'limits.equipments', value: 50 }),
        ajuste({ key: 'features.customDomain', value: true }),
      ],
      agora
    )
    expect(direitos).toEqual({
      schema: 1,
      limits: { equipments: 50, staffSeats: null },
      features: { customDomain: true, logistics: true },
    })
    expect(ignorados).toEqual([])
    expect(plano.limits.equipments).toBe(30)
    expect(plano.features.customDomain).toBe(false)
  })

  it('entre ajustes da mesma chave vale o mais recente, qualquer que seja a ordem recebida', () => {
    const antigo = ajuste({
      key: 'limits.equipments',
      value: 40,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    })
    const novo = ajuste({
      key: 'limits.equipments',
      value: null,
      createdAt: new Date('2026-10-02T00:00:00Z'),
    })
    expect(
      direitosEfetivos(plano, [novo, antigo], agora).direitos.limits.equipments
    ).toBeNull()
    expect(
      direitosEfetivos(plano, [antigo, novo], agora).direitos.limits.equipments
    ).toBeNull()
  })

  it('ignora ajuste revogado ou expirado até o instante atual, e aplica o que ainda vai expirar ou ser revogado', () => {
    const { direitos, ignorados } = direitosEfetivos(
      plano,
      [
        ajuste({ key: 'limits.equipments', value: 99, revokedAt: agora }),
        ajuste({ key: 'features.customDomain', value: true, expiresAt: agora }),
        ajuste({
          key: 'limits.staffSeats',
          value: 5,
          expiresAt: new Date('2026-10-21T00:00:00Z'),
        }),
        ajuste({
          key: 'features.logistics',
          value: false,
          revokedAt: new Date('2026-10-21T00:00:00Z'),
        }),
      ],
      agora
    )
    expect(direitos.limits).toEqual({ equipments: 30, staffSeats: 5 })
    expect(direitos.features).toEqual({ customDomain: false, logistics: false })
    expect(ignorados).toEqual([
      { key: 'limits.equipments', motivo: 'REVOGADO' },
      { key: 'features.customDomain', motivo: 'EXPIRADO' },
    ])
  })

  it('nunca aplica chave fora do plano nem valor de tipo errado', () => {
    const { direitos, ignorados } = direitosEfetivos(
      plano,
      [
        ajuste({ key: 'limits.unknown', value: 1 }),
        ajuste({ key: 'features.whatsapp', value: true }),
        ajuste({ key: 'limits.__proto__', value: 1 }),
        ajuste({ key: 'features.toString', value: true }),
        ajuste({ key: 'plan.equipments', value: 1 }),
        ajuste({ key: 'limits', value: 1 }),
        ajuste({ key: 'limits.equipments.max', value: 1 }),
        ajuste({ key: 'limits.equipments', value: '50' }),
        ajuste({ key: 'limits.equipments', value: -1 }),
        ajuste({ key: 'limits.equipments', value: 2.5 }),
        ajuste({ key: 'features.customDomain', value: 'true' }),
      ],
      agora
    )
    expect(direitos).toEqual(plano)
    expect(ignorados.map((item) => item.motivo)).toEqual([
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'CHAVE_DESCONHECIDA',
      'VALOR_INVALIDO',
      'VALOR_INVALIDO',
      'VALOR_INVALIDO',
      'VALOR_INVALIDO',
    ])
    expect(Object.getPrototypeOf(direitos.limits)).toBe(Object.prototype)
  })

  it('recusa relógio inválido', () => {
    expect(() => direitosEfetivos(plano, [], new Date('x'))).toThrow(RangeError)
  })
})
