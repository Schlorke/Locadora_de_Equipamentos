import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
const estado = vi.hoisted(() => ({
  extra: {} as Record<string, unknown>,
  carregando: false,
}))
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: {
      companyPhone: '(11) 1234-5678',
      whatsappNumber: '(11) 99999-1111',
      contactEmail: 'contato@tenant.test',
      marketingEmail: '',
      companyAddress: 'Endereço da locadora',
      socialLinks: {},
      heroCarousel: [],
      siteContent: {},
      ...estado.extra,
    },
    isLoading: estado.carregando,
    error: null,
  }),
}))
// O mapa real carrega o script do Google; aqui só o local que a página entrega a ele.
vi.mock('../../../features/mapa-loja', () => ({
  GoogleStoreLocator: ({
    location,
    className,
    moldura,
  }: {
    location?: { title: string; address1: string } | null
    className?: string
    moldura?: string
  }) =>
    location
      ? createElement(
          'div',
          { 'data-mapa': location.title, 'data-moldura': moldura, className },
          location.address1
        )
      : null,
}))
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import { ContatoPage } from './ContatoPage'

const aberto = (open: string, close: string) => ({ closed: false, open, close })
const HORARIO = {
  monday: aberto('08:00', '18:00'),
  tuesday: aberto('08:00', '18:00'),
  wednesday: aberto('08:00', '18:00'),
  thursday: aberto('08:00', '18:00'),
  friday: aberto('08:00', '18:00'),
  saturday: aberto('08:00', '12:00'),
  sunday: { closed: true },
}
const TODOS = {
  certifiedEquipment: true,
  fastDelivery: true,
  support24h: true,
  flexibleScheduling: true,
  freeConsulting: true,
  responseWithin24h: true,
}

const naLocadora = (cidade: string | null = 'Curitiba') =>
  renderToStaticMarkup(
    createElement(IdentidadePublicaProvider, {
      value: { nome: 'Locadora Alfa', cidade, uf: 'PR', logoUrl: null },
      children: createElement(ContatoPage),
    })
  )

const comExtra = <T,>(extra: Record<string, unknown>, fn: () => T): T => {
  estado.extra = extra
  try {
    return fn()
  } finally {
    estado.extra = {}
  }
}

describe('ContatoPage', () => {
  it('mantém o título, o envio e o contato da própria locadora', () => {
    const html = renderToStaticMarkup(createElement(ContatoPage))
    expect(html).toContain('Entre em Contato')
    expect(html).toContain('Enviar Solicitação')
    expect(html).toContain('(11) 1234-5678')
  })

  // Achado 143: nada do horário nem da cidade da GB; a cidade é a do cartão da própria locadora.
  it('sem horário fixo e com a cidade da própria locadora', () => {
    const semLocadora = renderToStaticMarkup(createElement(ContatoPage))
    expect(semLocadora).not.toMatch(
      /Segunda a Sexta: 8h|Sábado: 8h|Porto Alegre|Horário de Funcionamento/
    )
    expect(semLocadora).toContain('Atendimento na região')
    const comLocadora = naLocadora()
    expect(comLocadora).toContain(
      'Atendimento em Curitiba e região metropolitana'
    )
    expect(comLocadora).toContain('metropolitana de Curitiba')
    expect(comLocadora).not.toMatch(/Porto Alegre/)
  })

  // Achado 147: o cartão de horário volta com o horário da PRÓPRIA locadora, nas linhas da produção.
  it('horário da própria locadora: primeira faixa no destaque, as demais (com o dia fechado) no subtítulo', () => {
    comExtra({ businessHours: HORARIO }, () => {
      const html = renderToStaticMarkup(createElement(ContatoPage))
      expect(html).toContain('Horário de Funcionamento')
      expect(html).toContain('>Segunda a Sexta: 8h às 18h</p>')
      expect(html).toContain('>Sábado: 8h às 12h • Domingo: Fechado</p>')
    })
    comExtra({ businessHours: { sunday: { closed: true } } }, () => {
      // Só dia fechado: sem cartão de horário.
      expect(renderToStaticMarkup(createElement(ContatoPage))).not.toContain(
        'Horário de Funcionamento'
      )
    })
  })

  // Onda 134 (D-E): sem conteúdo nem compromisso declarados, nenhum número, promessa ou selo do modelo.
  it('Locadora Nova sem conteúdo: sem números, sem promessas, sem selos e sem o cartão do mapa', () => {
    const html = naLocadora()
    expect(html).not.toMatch(
      /\d+\+|24h|Anos de Experiência|Projetos Realizados|Equipamentos Disponíveis|Suporte Técnico/
    )
    expect(html).not.toMatch(
      /Agendamento Flexível|Qualidade Garantida|Consultoria Gratuita|Entrega Rápida|Suporte 24h|Resposta em até 24 horas/
    )
    // A declaração de valor do modelo fica.
    expect(html).toContain('Atendimento Especializado')
    // Sem horário de segunda a sexta, o telefone não promete "segunda a sexta"; o WhatsApp da locadora continua.
    expect(html).toContain('>WhatsApp disponível</p>')
    expect(html).not.toContain('Atendimento de segunda a sexta')
    // Sem local declarado, o cartão "Onde estamos" sai inteiro (sem aviso de mapa).
    expect(html).not.toContain('Onde estamos')
  })

  it('com o conteúdo, os compromissos, o horário e o local da locadora: tudo na ordem de 55763c1e', () => {
    const html = comExtra(
      {
        businessHours: HORARIO,
        siteContent: {
          experienceYears: 7,
          projectsCompleted: 340,
          fleetSize: 60,
          commitments: TODOS,
          storeLocation: {
            latitude: -25.43,
            longitude: -49.27,
            addressLine1: 'Rua Nova, 1',
          },
        },
      },
      () => naLocadora()
    )
    const texto = html
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)
    const topo = texto.slice(
      texto.indexOf(
        'Estamos prontos para atender você e tornar seu projeto realidade. Fale conosco e descubra as melhores soluções em locação de equipamentos.'
      ) + 1,
      texto.indexOf('Solicite um Orçamento')
    )
    expect(topo).toEqual([
      '7+',
      'Anos de Experiência',
      '340+',
      'Projetos Realizados',
      '60+',
      'Equipamentos Disponíveis',
      '24h',
      'Suporte Técnico',
    ])
    expect(html).toContain(
      '>Atendimento de segunda a sexta | WhatsApp disponível</p>'
    )
    expect(html).toContain('>Resposta em até 24 horas</p>')
    const diferenciais = texto.slice(
      texto.indexOf('O que nos torna únicos no mercado de locação') + 1,
      texto.indexOf('Onde estamos')
    )
    expect(diferenciais).toEqual([
      'Atendimento Especializado',
      'Consultoria técnica para escolha dos equipamentos ideais',
      'Agendamento Flexível',
      'Entrega e coleta nos horários que funcionam para você',
      'Qualidade Garantida',
      'Equipamentos revisados e com certificação de segurança',
    ])
    // Mapa com o local da própria locadora e a moldura do cartão, a classe da produção (eb4c0098:app/contato/page.tsx:297),
    // que mora no mapa (Mapa.web.test.tsx confere a classe da moldura).
    expect(html).toContain(
      '<div data-mapa="Locadora Alfa" data-moldura="cartao">Rua Nova, 1</div>'
    )
    expect(texto.slice(-3)).toEqual([
      'Consultoria Gratuita',
      'Entrega Rápida',
      'Suporte 24h',
    ])
  })

  // Subtítulo do cartão "Telefone": "Atendimento de segunda a sexta" só com os cinco dias úteis abertos e "WhatsApp
  // disponível" só com o WhatsApp da locadora; sem nenhum dos dois, o cartão fica sem subtítulo.
  it('subtítulo do telefone: segunda a sexta só com os cinco dias úteis abertos; WhatsApp só com o número', () => {
    const subtituloDoTelefone = (html: string): string | null => {
      const inicio = html.indexOf('>Telefone</h3>')
      expect(inicio).toBeGreaterThan(-1)
      const cartao = html.slice(inicio, html.indexOf('</div>', inicio))
      const linhas = [...cartao.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map(
        (linha) => linha[1]
      )
      // A primeira linha é o número; a segunda, quando existe, o subtítulo.
      expect(linhas.length).toBeGreaterThan(0)
      return linhas[1] ?? null
    }
    const pagina = (extra: Record<string, unknown>) =>
      subtituloDoTelefone(comExtra(extra, () => naLocadora()))
    const fechado = { closed: true }
    // Parte dos dias úteis abertos: cada um dos cinco, sozinho, fechado ou sem dado (a regra vale para os cinco, não
    // só para a sexta), ou só a segunda aberta. Nada de "segunda a sexta".
    const parteDosDiasUteis: [string, Record<string, unknown>][] = [
      ...['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].flatMap(
        (dia): [string, Record<string, unknown>][] => [
          [`${dia} fechado`, { ...HORARIO, [dia]: fechado }],
          [`${dia} sem dado`, { ...HORARIO, [dia]: undefined }],
        ]
      ),
      [
        'só segunda aberta',
        {
          monday: aberto('08:00', '18:00'),
          tuesday: fechado,
          wednesday: fechado,
          thursday: fechado,
          friday: fechado,
        },
      ],
    ]
    for (const [caso, businessHours] of parteDosDiasUteis) {
      expect(pagina({ businessHours }), caso).toBe('WhatsApp disponível')
      expect(pagina({ businessHours, whatsappNumber: '' }), caso).toBeNull()
    }
    // Os cinco dias úteis abertos, mesmo com o fim de semana fechado ou sem dado.
    const diasUteis = {
      monday: aberto('09:00', '17:00'),
      tuesday: aberto('09:00', '17:00'),
      wednesday: aberto('09:00', '17:00'),
      thursday: aberto('09:00', '17:00'),
      friday: aberto('09:00', '16:00'),
    }
    expect(pagina({ businessHours: diasUteis })).toBe(
      'Atendimento de segunda a sexta | WhatsApp disponível'
    )
    // Sem WhatsApp (vazio ou só espaços), o subtítulo não promete WhatsApp.
    for (const whatsappNumber of ['', '   '])
      expect(pagina({ businessHours: HORARIO, whatsappNumber })).toBe(
        'Atendimento de segunda a sexta'
      )
    // Sem horário: só o WhatsApp, ou nenhum subtítulo.
    expect(pagina({})).toBe('WhatsApp disponível')
    expect(pagina({ businessHours: {} })).toBe('WhatsApp disponível')
    expect(pagina({ whatsappNumber: '' })).toBeNull()
  })

  // Telefone e WhatsApp são opcionais numa locadora (`usePublicSettings` normaliza o ausente para ''). A linha principal
  // do cartão "Telefone" juntava os dois com um " | " fixo: sem WhatsApp saía "(11) 1234-5678 | ", sem telefone
  // " | (11) …" e sem os dois " | ". Agora junta só os números informados, com o mesmo separador só entre os dois; sem
  // nenhum, o cartão sai, como o de horário. Com as configurações ainda carregando, o cartão fica no lugar (sem número
  // nem separador), para não empurrar os outros cartões quando os números chegam.
  it('linha do telefone: só os números informados, " | " só entre os dois; sem nenhum, sem o cartão', () => {
    /** Linhas do cartão "Telefone" (o número e, quando existe, o subtítulo); `null` sem o cartão. */
    const cartaoDoTelefone = (html: string): string[] | null => {
      const inicio = html.indexOf('>Telefone</h3>')
      if (inicio === -1) return null
      const cartao = html.slice(inicio, html.indexOf('</div>', inicio))
      return [...cartao.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map(
        (linha) => linha[1]!
      )
    }
    const pagina = (extra: Record<string, unknown>) => {
      const html = comExtra(extra, () => naLocadora())
      // Nenhuma linha da página começa ou termina no separador.
      for (const [, texto] of html.matchAll(/>([^<]*)</g))
        expect(texto!.trim(), texto).not.toMatch(/^\||\|$/)
      return cartaoDoTelefone(html)
    }
    // Com os dois (a GB): a linha de 55763c1e, igual byte a byte.
    expect(pagina({})).toEqual([
      '(11) 1234-5678 | (11) 99999-1111',
      'WhatsApp disponível',
    ])
    // Sem WhatsApp (vazio ou só espaços): só o telefone.
    for (const whatsappNumber of ['', '   '])
      expect(
        pagina({ whatsappNumber }),
        JSON.stringify(whatsappNumber)
      ).toEqual(['(11) 1234-5678'])
    expect(pagina({ whatsappNumber: '', businessHours: HORARIO })).toEqual([
      '(11) 1234-5678',
      'Atendimento de segunda a sexta',
    ])
    // Sem telefone: só o WhatsApp.
    for (const companyPhone of ['', '   '])
      expect(pagina({ companyPhone }), JSON.stringify(companyPhone)).toEqual([
        '(11) 99999-1111',
        'WhatsApp disponível',
      ])
    // Sem os dois: o cartão sai, mesmo abrindo de segunda a sexta; os outros cartões ficam.
    for (const extra of [
      { companyPhone: '', whatsappNumber: '' },
      { companyPhone: ' ', whatsappNumber: '  ', businessHours: HORARIO },
    ]) {
      expect(pagina(extra), JSON.stringify(extra)).toBeNull()
      const html = comExtra(extra, () => naLocadora())
      expect(html).toContain('>E-mail</h3>')
      expect(html).toContain('>Endereço</h3>')
    }
    // Carregando: o cartão fica no lugar, sem número nem separador.
    estado.carregando = true
    try {
      expect(pagina({ companyPhone: '', whatsappNumber: '' })).toEqual([''])
    } finally {
      estado.carregando = false
    }
  })

  it('regra E e e-mail de marketing: cada selo e serviço só com o compromisso dele', () => {
    const html = comExtra(
      {
        marketingEmail: 'vendas@tenant.test',
        siteContent: {
          commitments: { support24h: true, responseWithin24h: true },
        },
      },
      () => naLocadora()
    )
    expect(html).toContain('>24h<')
    expect(html).toContain('Suporte 24h')
    expect(html).not.toMatch(
      /Consultoria Gratuita|Entrega Rápida|Agendamento Flexível|Qualidade Garantida/
    )
    // Com e-mail de marketing, o subtítulo é o da produção (sem a promessa de resposta).
    expect(html).toContain('>vendas@tenant.test · Automação comercial</p>')
    expect(html).not.toContain('Resposta em até 24 horas')
  })
})
