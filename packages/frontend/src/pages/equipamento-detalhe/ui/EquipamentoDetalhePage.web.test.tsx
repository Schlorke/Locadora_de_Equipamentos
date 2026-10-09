import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const configuracoes = vi.hoisted(() => ({
  siteContent: {} as Record<string, unknown>,
}))
vi.mock('../../../entities/configuracao', async (original) => ({
  ...(await original<typeof import('../../../entities/configuracao')>()),
  usePublicSettings: () => ({
    settings: { siteContent: configuracoes.siteContent },
    isLoading: false,
    error: null,
  }),
}))

import {
  ApplicationSessionProvider,
  type SessionState,
} from '../../../entities/sessao'
import { IdentidadePublicaProvider } from '../../../entities/organizacao'
import {
  EquipamentoDetalhePage,
  buildSharePayload,
} from './EquipamentoDetalhePage.web'

// A sessão é entregue pelo bootstrap do host (RuntimeBootstrap); aqui o visitante não está autenticado.
const visitante: SessionState = {
  data: null,
  status: 'unauthenticated',
  update: async () => null,
  signOut: async () => {},
}
const renderPage = (props: ComponentProps<typeof EquipamentoDetalhePage>) =>
  renderToStaticMarkup(
    <ApplicationSessionProvider value={visitante}>
      <EquipamentoDetalhePage {...props} />
    </ApplicationSessionProvider>
  )
const BETONEIRA = {
  name: 'Betoneira',
  equipmentId: 'abc',
  description: 'Para concreto',
  categoryName: 'Concreto',
  pricePerDay: 100,
  available: true,
  structuredData: 'DADOS',
  categorySlug: 'concreto',
  images: [],
}
const naLocadora = () =>
  renderToStaticMarkup(
    <ApplicationSessionProvider value={visitante}>
      <IdentidadePublicaProvider
        value={{
          nome: 'Locadora Nova',
          cidade: 'Curitiba',
          uf: 'PR',
          logoUrl: null,
        }}
      >
        <EquipamentoDetalhePage {...BETONEIRA} />
      </IdentidadePublicaProvider>
    </ApplicationSessionProvider>
  )
const textos = (html: string) =>
  html
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
const TODOS = {
  certifiedEquipment: true,
  freeDelivery: true,
  fastDelivery: true,
  sameDayDelivery: true,
  support24h: true,
}
/** Promessas do modelo que só valem com o compromisso da locadora (D-E). */
const PROMESSAS =
  /Equipamento Certificado|Entrega Gratuita|Suporte Garantido|Manutenção preventiva|Suporte técnico 24h|Entrega e retirada|Equipamentos Certificados|Entrega Rápida|Suporte 24h|Incluído na locação|Por que escolher/

beforeEach(() => {
  configuracoes.siteContent = {}
})

// Achado 143: o título leva o nome da própria locadora; o teste anterior afirmava o nome fixo da GB.
describe('compartilhar', () => {
  it('monta título com a locadora, texto e url', () => {
    expect(
      buildSharePayload(
        'Betoneira',
        'https://locadora-a.example.test/equipamentos/abc',
        'Locadora A'
      )
    ).toEqual({
      title: 'Betoneira - Locadora A',
      text: 'Confira este equipamento para locação: Betoneira',
      url: 'https://locadora-a.example.test/equipamentos/abc',
    })
  })

  it('sem locadora: só o nome do equipamento, nunca a marca de outra', () => {
    expect(buildSharePayload('Betoneira', '/equipamentos/abc').title).toBe(
      'Betoneira'
    )
    expect(
      buildSharePayload('Betoneira', '/equipamentos/abc', '  ').title
    ).toBe('Betoneira')
  })
})

describe('EquipamentoDetalhePage', () => {
  it('mantém o nome, o preço e as informações, sem nota fixa, fato da GB nem promessa sem compromisso (D-E)', () => {
    const html = renderPage(BETONEIRA)

    expect(html).toContain('Betoneira')
    // Achado 143: a nota "4.8 (127 avaliações)" era fixa (sem avaliação real); o teste anterior a exigia.
    expect(html).not.toMatch(/4\.8|127 avalia|avaliaç/)
    expect(html).toContain('Disponível')
    expect(html).toContain('Sobre este equipamento')
    expect(html).toContain('Para concreto')
    expect(html).toContain('R$ 100.00')
    expect(html).toContain('Equipamentos')
    expect(html).toContain('href="/equipamentos?categoria=concreto"')
    expect(html).toContain('Home')
    expect(html).not.toContain('shadow-[4px_8px_18px_2px_rgba(0,0,0,0.18)]')
    // Onda 134 (D-E): sem compromisso declarado, nenhuma promessa do modelo (topo, incluído e "Por que escolher").
    expect(html).not.toMatch(PROMESSAS)
    expect(html).not.toMatch(/GB Loca|Porto Alegre|10 anos/i)
    expect(html).toContain('Zoom para ampliar')
    expect(html).toContain(
      '/placeholder.svg?height=600&amp;width=800&amp;text=Equipamento'
    )
    expect(html).toContain('Entrega na região')
    expect(html).toContain('Incluir finais de semana')
    expect(html).toContain('Quinzenal')
    expect(html).toContain('href="/equipamentos"')
  })

  it('mostra indisponível e esconde a descrição vazia', () => {
    const html = renderPage({
      name: 'Andaime',
      equipmentId: 'andaime',
      description: null,
      categoryName: 'Altura',
      pricePerDay: 0,
      available: false,
      structuredData: null,
      images: ['/foto.jpg'],
    })

    expect(html).toContain('Indisponível')
    expect(html).not.toContain('Sobre este equipamento')
    expect(html).toContain('R$ 0.00')
  })

  it('com os compromissos e os anos da locadora do host: as promessas da produção, com o nome e a cidade dela', () => {
    configuracoes.siteContent = { commitments: TODOS, experienceYears: 7 }
    const html = naLocadora()
    const texto = textos(html)
    // Linha do topo (a mesma do app), na ordem de 55763c1e.
    expect(
      texto.slice(
        texto.indexOf('Voltar aos Equipamentos') + 1,
        texto.indexOf('Zoom para ampliar')
      )
    ).toEqual([
      'Equipamento Certificado',
      'Entrega Gratuita',
      'Suporte Garantido',
    ])
    expect(
      texto.slice(
        texto.indexOf('Incluído na locação:') + 1,
        texto.indexOf('Incluído na locação:') + 4
      )
    ).toEqual([
      'Manutenção preventiva',
      'Suporte técnico 24h',
      'Entrega e retirada',
    ])
    expect(
      texto.slice(texto.indexOf('Por que escolher a Locadora Nova?'))
    ).toEqual([
      'Por que escolher a Locadora Nova?',
      'Mais de 7 anos de experiência no mercado',
      'Equipamentos Certificados',
      'Todos os equipamentos passam por rigorosa inspeção e possuem certificações de segurança',
      'Entrega Rápida',
      'Entrega no mesmo dia para região metropolitana de Curitiba',
      'Suporte 24h',
      'Equipe técnica disponível 24 horas para suporte e emergências',
    ])
    expect(html).toContain('Entrega em Curitiba e região')
    expect(html).not.toMatch(/GB Loca|Porto Alegre|10 anos|4\.8|127 avalia/i)
  })

  it('regra E: cada promessa só com todos os compromissos dela; sem cartão, o bloco sai (com ou sem anos)', () => {
    configuracoes.siteContent = {
      commitments: { support24h: true, fastDelivery: true },
      experienceYears: 3,
    }
    const texto = textos(naLocadora())
    expect(texto).toContain('Suporte Garantido')
    expect(texto).not.toContain('Equipamento Certificado')
    expect(texto).not.toContain('Entrega Gratuita')
    expect(texto).toContain('Suporte técnico 24h')
    expect(texto).not.toContain('Manutenção preventiva')
    // "Entrega Rápida" exige também a entrega no mesmo dia.
    expect(texto).not.toContain('Entrega Rápida')
    expect(texto).toContain('Suporte 24h')
    configuracoes.siteContent = { experienceYears: 3 }
    expect(naLocadora()).not.toMatch(PROMESSAS)
  })

  it('nota de avaliações só com a fonte declarada (D-A), na marcação de 55763c1e com o link da fonte', () => {
    configuracoes.siteContent = {
      reviews: {
        rating: 4.8,
        count: 127,
        sourceName: 'Google',
        sourceUrl: 'https://g.example.test/locadora',
      },
    }
    const html = naLocadora()
    expect(html).toMatch(
      /<div class="flex items-center gap-3 mb-4"><div class="flex items-center gap-1">(<svg[^>]*class="[^"]*h-4 w-4 fill-yellow-400 text-yellow-400"[^>]*>.*?<\/svg>){5}<span class="font-semibold text-sm ml-1">4\.8<\/span><\/div><span class="text-xs text-gray-500">\(127 avaliações no <a href="https:\/\/g\.example\.test\/locadora" rel="nofollow noopener" target="_blank" class="[^"]*">Google<\/a>\)<\/span><\/div>/
    )
    configuracoes.siteContent = {
      reviews: {
        rating: 4.2,
        count: 9,
        sourceName: 'Google',
        sourceUrl: 'https://g.example.test/locadora',
      },
    }
    expect(naLocadora().match(/fill-yellow-400/g)).toHaveLength(4)
  })
})
