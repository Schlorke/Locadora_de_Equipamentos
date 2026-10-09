// Benefícios da seção "Por que escolher" (achado 143; onda 134): o texto do modelo, a cidade do cartão e o conteúdo
// institucional e os compromissos que a própria locadora declarou no painel. Sem dado, o cartão não aparece.
import { describe, expect, it } from 'vitest'
import { beneficiosDaLocadora } from './beneficios'

/** Fatos da GB que apareciam em qualquer locadora: região, clientes e anos de mercado. */
const FATOS_DA_GB =
  /Porto Alegre|Melnick|Cyrela|Joal|Teitelbaum|UMA Incorporadora|ABF Developments|Grandes Construtoras|10 Anos|Há 10 anos/i

const TODOS_OS_COMPROMISSOS = {
  certifiedEquipment: true,
  fastDelivery: true,
  ownLogistics: true,
  equipmentTracking: true,
} as const

const textos = (
  cidade: string | null,
  conteudo?: Parameters<typeof beneficiosDaLocadora>[1]
) =>
  beneficiosDaLocadora(cidade, conteudo)
    .map((beneficio) => `${beneficio.title} ${beneficio.description}`)
    .join('\n')

describe('beneficiosDaLocadora', () => {
  it('Locadora Nova sem conteúdo nem compromisso: só a declaração de valor do modelo (D-E)', () => {
    expect(beneficiosDaLocadora('Curitiba').map((b) => b.chave)).toEqual([
      'atendimento',
    ])
    expect(beneficiosDaLocadora('Curitiba', {}).map((b) => b.chave)).toEqual([
      'atendimento',
    ])
    expect(textos('Curitiba')).not.toMatch(FATOS_DA_GB)
  })

  it('com tudo declarado: os seis cartões na ordem de 55763c1e, com os dados da própria locadora', () => {
    const conteudo = {
      commitments: TODOS_OS_COMPROMISSOS,
      featuredClients: ['Construtora Alfa', 'Obras Beta'],
      experienceYears: 7,
    }
    expect(
      beneficiosDaLocadora('Curitiba', conteudo).map((b) => [b.chave, b.title])
    ).toEqual([
      ['certificados', 'Equipamentos Certificados'],
      ['entrega', 'Entrega Rápida e Eficiente'],
      ['atendimento', 'Atendimento Especializado'],
      ['construtoras', 'Parceira de Grandes Construtoras'],
      ['anos', '7 Anos de Experiência'],
      ['rastreamento', 'Rastreamento dos Equipamentos'],
    ])
    const texto = textos('Curitiba', conteudo)
    expect(texto).toContain(
      'Entregamos em toda região de Curitiba com logística própria e rastreamento dos equipamentos em tempo real.'
    )
    expect(texto).toContain(
      'Atendemos grandes construtoras como Construtora Alfa, Obras Beta e outras.'
    )
    expect(texto).toContain(
      'Há 7 anos oferecendo soluções em locação de equipamentos com foco em segurança, qualidade e comprometimento.'
    )
  })

  it('regra E: a entrega exige entrega rápida, logística própria e rastreamento; o rastreamento só o rastreamento', () => {
    const chaves = (commitments: Record<string, boolean>) =>
      beneficiosDaLocadora(null, { commitments }).map((b) => b.chave)
    expect(chaves({ fastDelivery: true, ownLogistics: true })).toEqual([
      'atendimento',
    ])
    expect(chaves({ equipmentTracking: true })).toEqual([
      'atendimento',
      'rastreamento',
    ])
    expect(
      chaves({ fastDelivery: true, ownLogistics: true, equipmentTracking: true })
    ).toEqual(['entrega', 'atendimento', 'rastreamento'])
    // Só `true` declara: falso ou ausente não.
    expect(chaves({ certifiedEquipment: false })).toEqual(['atendimento'])
  })

  it('um ano no singular; sem cidade, região neutra', () => {
    expect(
      beneficiosDaLocadora(null, { experienceYears: 1 }).find(
        (b) => b.chave === 'anos'
      )
    ).toEqual({
      chave: 'anos',
      title: '1 Ano de Experiência',
      description:
        'Há 1 ano oferecendo soluções em locação de equipamentos com foco em segurança, qualidade e comprometimento.',
    })
    expect(textos(null, { commitments: TODOS_OS_COMPROMISSOS })).toContain(
      'Entregamos em toda a região com logística própria e rastreamento dos equipamentos em tempo real.'
    )
    expect(textos('   ', { commitments: TODOS_OS_COMPROMISSOS })).toBe(
      textos(null, { commitments: TODOS_OS_COMPROMISSOS })
    )
  })
})
