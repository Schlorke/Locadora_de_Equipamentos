// Página "Sobre" (achado 143; onda 134): só o nome, a cidade, o texto "Sobre nós" e o conteúdo institucional que a
// própria locadora declarou no painel (anos, clientes, frota, cidades, história, linha do tempo e Merchant Center),
// na marcação de 55763c1e. Sem o dado, o bloco não aparece. O teste anterior à onda 132 exigia "Sobre a GB Locações",
// isto é, afirmava o defeito (o conteúdo da GB em qualquer locadora).
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const configuracoes = vi.hoisted(() => ({
  aboutUsText: '',
  siteContent: {} as Record<string, unknown>,
  telefones: null as null | { companyPhone: string; whatsappNumber: string },
  carregando: false,
}))
vi.mock('../../../entities/configuracao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: {
      companyPhone: '(41) 3000-0000',
      whatsappNumber: '(41) 99999-1111',
      contactEmail: 'contato@locadora-nova.example.test',
      marketingEmail: '',
      companyAddress: 'Rua Nova, 1 - Centro, Curitiba - PR',
      aboutUsText: configuracoes.aboutUsText,
      socialLinks: {},
      heroCarousel: [],
      ...configuracoes.telefones,
      siteContent: configuracoes.siteContent,
    },
    isLoading: configuracoes.carregando,
    error: null,
  }),
}))

import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import { SobrePage, type SobreCarouselProps } from './SobrePage.web'

/** Conteúdo institucional da GB que aparecia em qualquer locadora: nome, região, números, história e selo. */
const DA_GB =
  /GB Loca|Porto Alegre|10\+|500\+|200\+|50\+|\+200|Anos de Experiência|Clientes Satisfeitos|Cidades Atendidas|há mais de|década|Fundação|2014|2017|Líder Regional|Nossa Jornada/i

/** Conteúdo completo de uma locadora que não é a GB. */
const CONTEUDO = {
  experienceYears: 8,
  clientsServed: 1200,
  fleetSize: 90,
  citiesServed: 15,
  history: 'A Locadora Nova começou com dois andaimes em 2017.',
  timeline: [
    { year: 2017, title: 'Começo', description: 'Primeiros andaimes' },
    {
      year: 2023,
      title: 'Nova sede',
      description: 'Mudança para o galpão próprio',
    },
  ],
  googleMerchantId: '123456789',
}

function renderizar({
  identidade,
  badge,
}: {
  identidade: { nome: string; cidade: string | null } | null
  badge?: (merchantId: string) => ReactNode
}) {
  const received: { current: SobreCarouselProps | null } = { current: null }
  const html = renderToStaticMarkup(
    <IdentidadePublicaProvider
      value={identidade && { ...identidade, uf: null, logoUrl: null }}
    >
      <SobrePage
        carousel={(props: SobreCarouselProps) => {
          received.current = props
          return 'CARROSSEL-3D'
        }}
        badge={badge}
      />
    </IdentidadePublicaProvider>
  )
  const texto = html
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
  return { html, texto, received }
}

describe('SobrePage', () => {
  it('Locadora Nova sem conteúdo: nome, cidade e texto dela; nenhum número, selo, linha do tempo nem selo do Google', () => {
    configuracoes.aboutUsText = 'Locação de andaimes em Curitiba desde 2022.'
    configuracoes.siteContent = {}
    const { html, received } = renderizar({
      identidade: { nome: 'Locadora Nova', cidade: 'Curitiba' },
      badge: () => 'SELO-GOOGLE',
    })
    expect(html).toContain('Sobre a Locadora Nova')
    expect(html).toContain(
      'Em Curitiba e região, oferecendo soluções em equipamentos para construção civil</p>'
    )
    expect(html).toContain('Locação de andaimes em Curitiba desde 2022.')
    expect(html).toContain('Nossa História')
    expect(html).toContain('Nossos Valores')
    expect(html.match(DA_GB)?.[0]).toBeUndefined()
    expect(html).not.toContain('hero-badge')
    // Sem o ID do Merchant Center da própria locadora, a seção não aparece.
    expect(html).not.toContain('SELO-GOOGLE')
    expect(html).not.toContain('Google Avaliações do Consumidor')
    expect(html).toContain('tel:+554130000000')
    expect(html).toContain('tel:+5541999991111')
    // Carrossel 3D: o primeiro modelo só ajusta depois do ScrollReveal (sem zoom no carregamento).
    expect(html).toContain('CARROSSEL-3D')
    expect(received.current?.isRevealComplete).toBe(false)
    expect(received.current?.autoRotate).toBe(true)
    expect(received.current?.autoRotateInterval).toBe(6000)
    expect(received.current?.models.map((model) => model.modelUrl)).toEqual([
      '/models/Compressor.glb',
      '/models/Betoneira.glb',
      '/models/Andaime.glb',
    ])
  })

  it('com o conteúdo declarado: números, história, selos, linha do tempo e selo do Google da própria locadora', () => {
    configuracoes.aboutUsText = 'Texto Sobre nós'
    configuracoes.siteContent = CONTEUDO
    const recebido: string[] = []
    const { html, texto } = renderizar({
      identidade: { nome: 'Locadora Nova', cidade: 'Curitiba' },
      badge: (id) => {
        recebido.push(id)
        return 'SELO-GOOGLE'
      },
    })
    expect(html).toContain(
      'Em Curitiba e região, oferecendo soluções em equipamentos para construção civil há mais de 8 anos'
    )
    // Números na ordem de 55763c1e: anos, clientes, frota e cidades.
    const numeros = texto.slice(
      texto.indexOf('Referência em locação de equipamentos') + 1,
      texto.indexOf('Nossa História')
    )
    expect(numeros).toEqual([
      '8+',
      'Anos de Experiência',
      'Há 8 anos atendendo o mercado da construção civil',
      '1.200+',
      'Clientes Satisfeitos',
      'Empresas e profissionais que confiam em nossos serviços',
      '90+',
      'Equipamentos',
      'Ampla variedade de equipamentos para todas as necessidades',
      '15+',
      'Cidades Atendidas',
      'Cobertura em Curitiba e região metropolitana',
    ])
    // A história declarada é o primeiro parágrafo (sem ela, o texto "Sobre nós").
    expect(html).toContain(
      '<p class="text-lg leading-relaxed">A Locadora Nova começou com dois andaimes em 2017.</p>'
    )
    expect(html).not.toContain('Texto Sobre nós')
    // Selos em volta do carrossel, com as classes da revelação.
    expect(html).toMatch(
      /hero-badge-left[^>]*><div class="text-2xl font-bold animate-count-up">\+90<\/div><div class="text-sm font-medium">Equipamentos Disponíveis/
    )
    expect(html).toMatch(
      /hero-badge-right[^>]*><div class="text-2xl font-bold">8\+<\/div><div class="text-sm font-medium">Anos de Experiência/
    )
    expect(html).toMatch(
      /hero-badge-top-left[^>]*><div class="text-2xl font-bold">1\.200\+<\/div><div class="text-sm font-medium">Clientes Satisfeitos/
    )
    // Linha do tempo da locadora.
    expect(html).toContain('Nossa Jornada')
    expect(html).toContain('A evolução da Locadora Nova ao longo dos anos')
    expect(
      texto
        .slice(
          texto.indexOf('A evolução da Locadora Nova ao longo dos anos') + 1
        )
        .slice(0, 6)
    ).toEqual([
      '2017',
      'Começo',
      'Primeiros andaimes',
      '2023',
      'Nova sede',
      'Mudança para o galpão próprio',
    ])
    // Selo do Google com o ID da própria locadora.
    expect(recebido).toEqual(['123456789'])
    expect(html).toContain('SELO-GOOGLE')
    expect(html).toContain(
      'A Locadora Nova participa do programa Google Avaliações do Consumidor.'
    )
  })

  it('cada bloco depende só do próprio dado; uma década usa a redação da produção; sem cidade, cobertura neutra', () => {
    configuracoes.aboutUsText = ''
    configuracoes.siteContent = { experienceYears: 12, citiesServed: 3 }
    const { html, texto } = renderizar({
      identidade: { nome: 'Locadora Nova', cidade: null },
    })
    expect(texto).toContain(
      'Mais de uma década atendendo o mercado da construção civil'
    )
    expect(texto).toContain('Cobertura na região')
    expect(html).toContain(
      'Soluções em equipamentos para construção civil há mais de 12 anos'
    )
    expect(html).toContain('hero-badge-right')
    expect(html).not.toContain('hero-badge-left')
    expect(html).not.toContain('hero-badge-top-left')
    expect(html).not.toContain('Clientes Satisfeitos')
    expect(html).not.toContain('Nossa Jornada')
    expect(html).not.toContain('<p class="text-lg leading-relaxed"></p>')
  })

  it('sem locadora: título neutro e, mesmo com ID do Merchant Center, sem selo do Google (o texto exige o nome)', () => {
    configuracoes.aboutUsText = '  '
    configuracoes.siteContent = { googleMerchantId: '123456789' }
    const { html } = renderizar({
      identidade: null,
      badge: () => 'SELO-GOOGLE',
    })
    expect(html).toContain('Sobre nós')
    expect(html).toContain('Soluções em equipamentos para construção civil')
    expect(html).not.toContain('<p class="text-lg leading-relaxed"></p>')
    expect(html).not.toContain('SELO-GOOGLE')
    expect(html.match(DA_GB)?.[0]).toBeUndefined()
  })

  // Telefone e WhatsApp são opcionais numa locadora: o botão do CTA juntava os dois com um "|" fixo, que sobrava sem
  // um deles e ficava sozinho sem os dois. Agora cada número só quando informado, o "|" só entre os dois e, sem
  // nenhum, o botão sai (carregando, fica no lugar com o ícone, sem número nem "|").
  it('CTA: só os números informados, "|" só entre os dois; sem nenhum, sem o botão do telefone', () => {
    configuracoes.aboutUsText = ''
    configuracoes.siteContent = {}
    const BOTAO =
      '<div class="inline-flex items-center gap-3 px-8 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 transition-all duration-300 hover:scale-105 border border-white/30">'
    const TELEFONE =
      '<a href="tel:+554130000000" class="hidden sm:inline hover:underline">(41) 3000-0000</a>'
    const SEPARADOR = '<span class="hidden sm:inline text-white/70">|</span>'
    const WHATSAPP =
      '<a href="tel:+5541999991111" class="hover:underline">(41) 99999-1111</a>'
    /** O botão do telefone depois do ícone (o mesmo `svg` da produção), ou `null` sem o botão. */
    const botao = (telefones: {
      companyPhone: string
      whatsappNumber: string
    }): string | null => {
      configuracoes.telefones = telefones
      try {
        const { html } = renderizar({
          identidade: { nome: 'Locadora Nova', cidade: 'Curitiba' },
        })
        expect(html).toContain('href="/orcamento"')
        const inicio = html.indexOf(BOTAO)
        if (inicio === -1) return null
        const depoisDoIcone = html.indexOf('</svg>', inicio) + '</svg>'.length
        return html.slice(
          depoisDoIcone,
          html.indexOf('</div>', depoisDoIcone) + '</div>'.length
        )
      } finally {
        configuracoes.telefones = null
      }
    }
    // Com os dois (a GB): a marcação de 55763c1e (a Sobre da GB é conferida byte a byte em gb-site-content.textos).
    expect(
      botao({
        companyPhone: '(41) 3000-0000',
        whatsappNumber: '(41) 99999-1111',
      })
    ).toBe(`${TELEFONE}${SEPARADOR}${WHATSAPP}</div>`)
    // Sem WhatsApp (vazio ou só espaços): só o telefone, sem "|".
    for (const whatsappNumber of ['', '   '])
      expect(
        botao({ companyPhone: '(41) 3000-0000', whatsappNumber }),
        JSON.stringify(whatsappNumber)
      ).toBe(`${TELEFONE}</div>`)
    // Sem telefone: só o WhatsApp, sem "|".
    for (const companyPhone of ['', '   '])
      expect(
        botao({ companyPhone, whatsappNumber: '(41) 99999-1111' }),
        JSON.stringify(companyPhone)
      ).toBe(`${WHATSAPP}</div>`)
    // Sem os dois: o botão do telefone sai; o do orçamento fica.
    expect(botao({ companyPhone: '', whatsappNumber: ' ' })).toBeNull()
    // Carregando: o botão fica no lugar, só com o ícone.
    configuracoes.carregando = true
    try {
      expect(botao({ companyPhone: '', whatsappNumber: '' })).toBe('</div>')
    } finally {
      configuracoes.carregando = false
    }
  })
})
