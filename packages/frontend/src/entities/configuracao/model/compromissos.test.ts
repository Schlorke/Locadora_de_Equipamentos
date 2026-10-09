import { describe, expect, it } from 'vitest'
import { SITE_CONTENT_COMMITMENTS } from '@gb-locacoes/contracts/settings'
import {
  COMPROMISSOS,
  DETALHE_INCLUIDO,
  DETALHE_TOPO,
  FAQ_CERTIFICACAO,
  RESPOSTA_DO_EMAIL,
  RESPOSTA_RAPIDA,
  SELOS_DO_CONTATO,
  SERVICOS_DO_CONTATO,
  SERVICO_COM_CERTIFICACAO,
  SUPORTE_NOS_NUMEROS,
  beneficiosComCompromisso,
  comCompromissosDeclarados,
  compromissosDeclarados,
  declarouTodos,
  detalhePorQueEscolher,
  entregaNoMesmoDia,
  frasesPorCompromisso,
  type Compromisso,
} from './compromissos'
import { FRASES_VIGIADAS } from '../../../../../../tests/helpers/frases-vigiadas'

// Compromissos comerciais por locadora (onda 134; decisão do dono D-E): desligados por padrão; um elemento ligado a mais
// de um compromisso só aparece com todos (regra E).
const todos = Object.fromEntries(
  SITE_CONTENT_COMMITMENTS.map((chave) => [chave, true])
)

describe('compromissosDeclarados', () => {
  it('Locadora Nova sem conteúdo: todos desligados', () => {
    for (const conteudo of [undefined, null, {}, { commitments: {} }]) {
      const declarados = compromissosDeclarados(conteudo)
      expect(Object.keys(declarados).sort()).toEqual(
        [...SITE_CONTENT_COMMITMENTS].sort()
      )
      expect(Object.values(declarados).every((valor) => !valor)).toBe(true)
    }
  })

  it('só `true` liga; `false` e ausente ficam desligados', () => {
    const declarados = compromissosDeclarados({
      commitments: { support24h: true, freeDelivery: false },
    })
    expect(declarados.support24h).toBe(true)
    expect(declarados.freeDelivery).toBe(false)
    expect(declarados.certifiedEquipment).toBe(false)
  })

  it('cada compromisso tem o texto do painel', () => {
    expect(Object.keys(COMPROMISSOS).sort()).toEqual(
      [...SITE_CONTENT_COMMITMENTS].sort()
    )
    for (const texto of Object.values(COMPROMISSOS))
      expect(texto.length).toBeGreaterThan(10)
  })
})

describe('regra E', () => {
  it('o elemento aparece só com todos os compromissos dele', () => {
    const parcial = compromissosDeclarados({
      commitments: { fastDelivery: true, ownLogistics: true },
    })
    expect(
      declarouTodos(parcial, [
        'fastDelivery',
        'ownLogistics',
        'equipmentTracking',
      ])
    ).toBe(false)
    expect(declarouTodos(parcial, ['fastDelivery', 'ownLogistics'])).toBe(true)
    expect(declarouTodos(parcial, [])).toBe(false)
    expect(
      comCompromissosDeclarados(parcial, beneficiosComCompromisso('Curitiba'))
    ).toEqual([])
    expect(
      comCompromissosDeclarados(
        compromissosDeclarados({ commitments: todos }),
        beneficiosComCompromisso('Curitiba')
      ).map((cartao) => cartao.chave)
    ).toEqual(['certificados', 'entrega', 'rastreamento'])
  })

  it('a Locadora Nova não mostra nenhuma frase de compromisso', () => {
    const nenhum = compromissosDeclarados(null)
    const listas: ReadonlyArray<
      ReadonlyArray<{ readonly requer: readonly Compromisso[] }>
    > = [
      DETALHE_TOPO,
      DETALHE_INCLUIDO,
      detalhePorQueEscolher('Curitiba'),
      beneficiosComCompromisso('Curitiba'),
      SERVICOS_DO_CONTATO,
      SELOS_DO_CONTATO,
      [SUPORTE_NOS_NUMEROS, RESPOSTA_DO_EMAIL, RESPOSTA_RAPIDA],
      [FAQ_CERTIFICACAO, SERVICO_COM_CERTIFICACAO],
    ]
    for (const lista of listas)
      expect(comCompromissosDeclarados(nenhum, lista)).toEqual([])
  })
})

describe('frases do modelo (as mesmas da produção)', () => {
  it('detalhe: topo, incluído e "Por que escolher", com a ligação de cada frase', () => {
    expect(DETALHE_TOPO.map(({ texto, requer }) => [texto, requer])).toEqual([
      ['Equipamento Certificado', ['certifiedEquipment']],
      ['Entrega Gratuita', ['freeDelivery']],
      ['Suporte Garantido', ['support24h']],
    ])
    expect(
      DETALHE_INCLUIDO.map(({ texto, requer }) => [texto, requer])
    ).toEqual([
      ['Manutenção preventiva', ['certifiedEquipment']],
      ['Suporte técnico 24h', ['support24h']],
      ['Entrega e retirada', ['freeDelivery']],
    ])
    expect(
      detalhePorQueEscolher('Curitiba').map(({ titulo, requer }) => [
        titulo,
        requer,
      ])
    ).toEqual([
      ['Equipamentos Certificados', ['certifiedEquipment']],
      ['Entrega Rápida', ['fastDelivery', 'sameDayDelivery']],
      ['Suporte 24h', ['support24h']],
    ])
  })

  it('entrega no mesmo dia com a cidade do cartão; sem cidade, texto neutro', () => {
    expect(entregaNoMesmoDia('Curitiba')).toBe(
      'Entrega no mesmo dia para região metropolitana de Curitiba'
    )
    expect(entregaNoMesmoDia('  ')).toBe(
      'Entrega no mesmo dia na região metropolitana'
    )
    expect(beneficiosComCompromisso(null)[1]!.descricao).toBe(
      'Entregamos em toda a região com logística própria e rastreamento dos equipamentos em tempo real.'
    )
  })

  it('contato, rodapé e FAQ', () => {
    expect(SERVICOS_DO_CONTATO.map((s) => [s.titulo, s.requer])).toEqual([
      ['Agendamento Flexível', ['flexibleScheduling']],
      ['Qualidade Garantida', ['certifiedEquipment']],
    ])
    expect(SELOS_DO_CONTATO.map((s) => [s.texto, s.requer])).toEqual([
      ['Consultoria Gratuita', ['freeConsulting']],
      ['Entrega Rápida', ['fastDelivery']],
      ['Suporte 24h', ['support24h']],
    ])
    expect(SUPORTE_NOS_NUMEROS).toMatchObject({
      numero: '24h',
      rotulo: 'Suporte Técnico',
      requer: ['support24h'],
    })
    expect(RESPOSTA_DO_EMAIL.requer).toEqual(['responseWithin24h'])
    expect(RESPOSTA_RAPIDA.requer).toEqual(['fastResponseGuaranteed'])
    expect(FAQ_CERTIFICACAO.requer).toEqual(['certifiedEquipment'])
  })

  it('a trava cobre cada frase publicada (título, descrição e texto)', () => {
    const publicadas = [
      ...DETALHE_TOPO.map((f) => f.texto),
      ...DETALHE_INCLUIDO.map((f) => f.texto),
      ...detalhePorQueEscolher('Curitiba').flatMap((c) => [
        c.titulo,
        c.descricao,
      ]),
      ...beneficiosComCompromisso('Curitiba').flatMap((c) => [
        c.titulo,
        c.descricao,
      ]),
      ...SERVICOS_DO_CONTATO.map((c) => c.descricao),
      ...SELOS_DO_CONTATO.map((f) => f.texto),
      SUPORTE_NOS_NUMEROS.rotulo,
      RESPOSTA_DO_EMAIL.texto,
      RESPOSTA_RAPIDA.texto,
      FAQ_CERTIFICACAO.answer,
      SERVICO_COM_CERTIFICACAO.texto,
    ]
    for (const frase of publicadas)
      expect(
        FRASES_VIGIADAS.some((vigiada) => frase.includes(vigiada)),
        frase
      ).toBe(true)
  })
})

describe('frasesPorCompromisso (o que o painel mostra em cada compromisso; onda 134, B10)', () => {
  it('cada compromisso lista as frases exatas que ele publica, na ordem das telas', () => {
    const frases = frasesPorCompromisso('Curitiba')
    expect(Object.keys(frases).sort()).toEqual(
      [...SITE_CONTENT_COMMITMENTS].sort()
    )
    expect(frases.freeDelivery).toEqual([
      'Entrega Gratuita',
      'Entrega e retirada',
    ])
    expect(frases.sameDayDelivery).toEqual([
      'Entrega Rápida: Entrega no mesmo dia para região metropolitana de Curitiba',
    ])
    expect(frases.fastResponseGuaranteed).toEqual(['Resposta rápida garantida'])
    expect(frases.responseWithin24h).toEqual(['Resposta em até 24 horas'])
    expect(frases.support24h).toContain('Suporte Garantido')
    expect(frases.support24h).toContain('24h Suporte Técnico')
    expect(frases.certifiedEquipment).toContain(
      'Os equipamentos possuem certificação de segurança? Sim, todos os nossos equipamentos passam por manutenção regular e possuem certificação de segurança conforme normas vigentes. Garantimos equipamentos em perfeito estado de funcionamento.'
    )
    for (const [chave, lista] of Object.entries(frases))
      expect(lista.length, chave).toBeGreaterThan(0)
  })
})
