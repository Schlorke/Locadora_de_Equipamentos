// Seção "Por que escolher" renderizada para uma locadora que não é a GB (achado 143): o nome e a cidade dela, sem os
// clientes, os anos de mercado e a região da GB. O teste anterior lia o código-fonte e exigia "Parceira de Grandes
// Construtoras" e "10 Anos de Experiência", isto é, afirmava o defeito. Onda 134: esses cartões voltam só com o
// conteúdo e os compromissos que a própria locadora declarou no painel.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const configuracao = vi.hoisted(() => ({
  siteContent: {} as Record<string, unknown>,
  telefones: null as null | { companyPhone: string; whatsappNumber: string },
  carregando: false,
}))
vi.mock('../../../entities/configuracao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: {
      companyPhone: '(41) 3000-0000',
      whatsappNumber: '(41) 99999-0000',
      ...configuracao.telefones,
      siteContent: configuracao.siteContent,
    },
    isLoading: configuracao.carregando,
    error: null,
  }),
}))

import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import WhyChooseUs, { beneficiosComVisual } from './PorQueEscolher.web'

const FATOS_DA_GB =
  /GB Loca|Porto Alegre|Melnick|Cyrela|Joal|Teitelbaum|UMA Incorporadora|ABF Developments|Grandes Construtoras|10 Anos|Há 10 anos/i

const DECLARADO = {
  commitments: {
    certifiedEquipment: true,
    fastDelivery: true,
    ownLogistics: true,
    equipmentTracking: true,
  },
  featuredClients: ['Construtora Alfa'],
  experienceYears: 5,
}

function renderizar(
  identidade: {
    nome: string
    cidade: string | null
    uf: string | null
  } | null
) {
  const html = renderToStaticMarkup(
    <IdentidadePublicaProvider
      value={identidade && { ...identidade, logoUrl: null }}
    >
      <WhyChooseUs />
    </IdentidadePublicaProvider>
  )
  // O título é animado palavra a palavra (um <span> por palavra): compara o texto visível.
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  return { html, texto }
}

describe('Por que escolher', () => {
  it('outra locadora sem conteúdo: nome dela; nenhum cliente, ano de mercado, região da GB nem compromisso (D-E)', () => {
    configuracao.siteContent = {}
    const { html, texto } = renderizar({
      nome: 'Locadora Nova',
      cidade: 'Curitiba',
      uf: 'PR',
    })
    expect(texto).toContain('Por que Escolher a Locadora Nova?')
    expect(texto).toContain('Atendimento Especializado')
    expect(texto).not.toContain('Equipamentos Certificados')
    expect(texto).not.toContain('Entregamos em toda região')
    expect(texto).not.toContain('Rastreamento dos Equipamentos')
    expect(texto.match(FATOS_DA_GB)?.[0]).toBeUndefined()
    // O telefone da própria locadora no CTA, com +55.
    expect(html).toContain('href="tel:+554130000000"')
    expect(html).toContain('href="/orcamento"')
  })

  it('com o conteúdo declarado: os seis cartões, cada um com o ícone e a cor de 55763c1e', () => {
    configuracao.siteContent = DECLARADO
    const { texto } = renderizar({
      nome: 'Locadora Nova',
      cidade: 'Curitiba',
      uf: 'PR',
    })
    expect(texto).toContain('Entregamos em toda região de Curitiba')
    expect(texto).toContain(
      'Atendemos grandes construtoras como Construtora Alfa e outras.'
    )
    expect(texto).toContain('5 Anos de Experiência')
    expect(
      beneficiosComVisual(null, DECLARADO).map((b) => [
        b.title,
        b.icon.displayName,
        b.accentColor,
      ])
    ).toEqual([
      ['Equipamentos Certificados', 'Shield', 'from-blue-500 to-blue-600'],
      ['Entrega Rápida e Eficiente', 'Truck', 'from-green-500 to-green-600'],
      ['Atendimento Especializado', 'Clock', 'from-purple-500 to-purple-600'],
      [
        'Parceira de Grandes Construtoras',
        'Users',
        'from-orange-500 to-orange-600',
      ],
      ['5 Anos de Experiência', 'Award', 'from-yellow-500 to-yellow-600'],
      [
        'Rastreamento dos Equipamentos',
        'Headphones',
        'from-red-500 to-red-600',
      ],
    ])
  })

  // Telefone e WhatsApp são opcionais numa locadora: o botão do CTA juntava os dois com um "|" fixo, que sobrava sem
  // um deles ("(41) 3000-0000 |", "| (41) …") e ficava sozinho sem os dois. Agora cada número aparece só quando foi
  // informado, o "|" só entre os dois e, sem nenhum, o botão sai (carregando, fica no lugar, sem número nem "|").
  it('CTA: só os números informados, "|" só entre os dois; sem nenhum, sem o botão do telefone', () => {
    configuracao.siteContent = {}
    const BOTAO =
      '<div class="w-full sm:w-auto inline-flex items-center justify-center px-8 h-14 bg-white text-orange-600 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-300 hover:scale-105 group gap-2 shadow-lg">'
    const TELEFONE =
      '<a href="tel:+554130000000" class="hidden sm:inline">(41) 3000-0000</a>'
    const SEPARADOR = '<span class="hidden sm:inline text-orange-400">|</span>'
    const WHATSAPP = '<a href="tel:+5541999990000" class="">(41) 99999-0000</a>'
    const ORCAMENTO = '<a href="/orcamento"'
    const cta = (telefones: {
      companyPhone: string
      whatsappNumber: string
    }) => {
      configuracao.telefones = telefones
      try {
        const { html } = renderizar({
          nome: 'Locadora Nova',
          cidade: 'Curitiba',
          uf: 'PR',
        })
        return html.slice(
          html.lastIndexOf(
            '<div class="flex flex-col sm:flex-row gap-4 items-center md:items-start w-full">'
          )
        )
      } finally {
        configuracao.telefones = null
      }
    }
    // Com os dois (a GB): a marcação de 55763c1e, igual byte a byte.
    expect(
      cta({ companyPhone: '(41) 3000-0000', whatsappNumber: '(41) 99999-0000' })
    ).toContain(`${BOTAO}${TELEFONE}${SEPARADOR}${WHATSAPP}</div>${ORCAMENTO}`)
    // Sem WhatsApp (vazio ou só espaços): só o telefone, sem "|".
    for (const whatsappNumber of ['', '   '])
      expect(
        cta({ companyPhone: '(41) 3000-0000', whatsappNumber }),
        JSON.stringify(whatsappNumber)
      ).toContain(`${BOTAO}${TELEFONE}</div>${ORCAMENTO}`)
    // Sem telefone: só o WhatsApp, sem "|".
    for (const companyPhone of ['', '   '])
      expect(
        cta({ companyPhone, whatsappNumber: '(41) 99999-0000' }),
        JSON.stringify(companyPhone)
      ).toContain(`${BOTAO}${WHATSAPP}</div>${ORCAMENTO}`)
    // Sem os dois: o botão do telefone sai; o do orçamento fica.
    const semNenhum = cta({ companyPhone: ' ', whatsappNumber: '' })
    expect(semNenhum).not.toContain(BOTAO)
    expect(semNenhum).not.toContain('tel:')
    expect(semNenhum).not.toContain('|')
    expect(semNenhum).toContain(ORCAMENTO)
    // Carregando: o botão fica no lugar, vazio (sem "|").
    configuracao.carregando = true
    try {
      expect(cta({ companyPhone: '', whatsappNumber: '' })).toContain(
        `${BOTAO}</div>${ORCAMENTO}`
      )
    } finally {
      configuracao.carregando = false
    }
  })

  it('sem locadora: título e região neutros', () => {
    configuracao.siteContent = { commitments: DECLARADO.commitments }
    const { texto } = renderizar(null)
    expect(texto).toContain('Por que Escolher a nossa locadora?')
    expect(texto).toContain('Entregamos em toda a região')
    expect(texto.match(FATOS_DA_GB)?.[0]).toBeUndefined()
  })
})
