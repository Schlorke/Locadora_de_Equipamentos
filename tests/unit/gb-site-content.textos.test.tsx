// @vitest-environment jsdom
// GB igual à produção (onda 134, lote vitrine-conteúdo, B7): os componentes da vitrine renderizados com o conteúdo
// institucional da GB (tools/gb-site-content.mjs, o que o tools/gb-site-settings.mjs grava) e a identidade de teste dão
// exatamente os textos dos goldens de 55763c1e (tests/unit/__fixtures__/vitrine-gb/, gravados no B0 a partir do código
// com os dados fixos da GB) e, na Sobre, a mesma marcação estática byte a byte. A frota é valor de fixture (200, o do hero
// e da Sobre da produção): o script não grava frota (D-B). Exceções nomeadas, as duas aprovadas pelo dono em 2026-10-07:
// - D-B: a GB mostra um número de frota só; o contato da produção dizia "50+" e o hero e a Sobre "+200"/"200+";
// - D-A: a linha de nota do detalhe ("4.8 (127 avaliações)") não tinha fonte e não volta.
// Segunda rodada: a GB real no corte, sem a frota (D-B, o dono preenche no painel), contra os mesmos goldens: só saem os
// números e selos de frota do hero, do contato e da Sobre; nenhum outro texto muda.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GB_SITE_CONTENT } from '../../tools/gb-site-content.mjs'
import {
  GB_BUSINESS_HOURS,
  GB_PUBLIC_SETTINGS,
  GB_SOCIAL_LINKS,
} from '../../tools/gb-site-settings.mjs'

/** Frota da fixture (D-B: o script não grava; o dono preenche no painel). */
const FROTA_DA_FIXTURE = 200

const GB = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock(
  '../../packages/frontend/src/entities/configuracao',
  async (original) => ({
    ...(await original<
      typeof import('../../packages/frontend/src/entities/configuracao')
    >()),
    // Com os dados do servidor (o hero da home), o hook não consulta a API: valem só eles, como no app real.
    usePublicSettings: (options?: {
      initialData?: Record<string, unknown> | null
    }) => ({
      settings: options?.initialData
        ? { ...GB.settings, aboutUsText: '', ...options.initialData }
        : GB.settings,
      isLoading: false,
      error: null,
    }),
  })
)
// O localizador real carrega o script do Google; no golden o cartão "Onde estamos" não tinha conteúdo.
vi.mock('../../packages/frontend/src/features/mapa-loja', () => ({
  GoogleStoreLocator: () => null,
}))

import { IdentidadePublicaProvider } from '../../packages/frontend/src/entities/organizacao'
import { ApplicationSessionProvider } from '../../packages/frontend/src/entities/sessao'
import Hero from '../../packages/frontend/src/widgets/hero/ui/Hero.web'
import WhyChooseUs from '../../packages/frontend/src/widgets/por-que-escolher/ui/PorQueEscolher.web'
import { ContatoPage } from '../../packages/frontend/src/pages/contato/ui/ContatoPage.web'
import { useContactPage } from '../../packages/frontend/src/pages/contato/model/use-contact-page'
import { EquipamentoDetalhePage } from '../../packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoDetalhePage.web'
import { SobrePage } from '../../packages/frontend/src/pages/sobre/ui/SobrePage.web'

GB.settings = {
  ...GB_PUBLIC_SETTINGS,
  marketingEmail: '',
  companyIconUrl: '',
  socialLinks: { ...GB_SOCIAL_LINKS },
  heroCarousel: [],
  waveAnimation: 'none',
  businessHours: GB_BUSINESS_HOURS,
  legalIdentity: null,
  siteContent: { ...GB_SITE_CONTENT, fleetSize: FROTA_DA_FIXTURE },
  legalDocuments: { terms: true, privacy: true, returnPolicy: true },
}

// O ambiente jsdom não dá import.meta.url com esquema file: o caminho sai da raiz do repositório (raiz do vitest).
const FIXTURES = path.resolve('tests/unit/__fixtures__/vitrine-gb')
const golden = (nome: string) =>
  JSON.parse(readFileSync(path.join(FIXTURES, nome), 'utf8')) as {
    identidade: { nome: string; cidade: string; uf: string; logoUrl: null }
    textos: string[]
    [chave: string]: unknown
  }

const comIdentidade = (children: ReactNode) =>
  createElement(
    IdentidadePublicaProvider,
    { value: golden('hero.json').identidade },
    children
  )

/** Textos visíveis em ordem (sem script e style), com o espaço normalizado (o mesmo extrator do B0). */
function textos(html: string, seletor?: string): string[] {
  const doc = new DOMParser().parseFromString(
    '<body>' + html + '</body>',
    'text/html'
  )
  const raiz = seletor ? [...doc.querySelectorAll(seletor)] : [doc.body]
  const saida: string[] = []
  for (const no of raiz) {
    const walker = doc.createTreeWalker(no, NodeFilter.SHOW_TEXT)
    for (let atual = walker.nextNode(); atual; atual = walker.nextNode()) {
      const pai = atual.parentElement?.tagName
      if (pai === 'SCRIPT' || pai === 'STYLE') continue
      const texto = (atual.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (texto) saida.push(texto)
    }
  }
  return saida
}

describe('vitrine da GB com o conteúdo do script igual aos goldens de 55763c1e', () => {
  it('hero: subtítulo, selos e todos os textos', () => {
    const hero = renderToStaticMarkup(
      comIdentidade(
        createElement(Hero, {
          initialSettings: {
            heroCarousel: [],
            waveAnimation: 'none',
            siteContent: {
              experienceYears: GB_SITE_CONTENT.experienceYears,
              fleetSize: FROTA_DA_FIXTURE,
            },
          },
        })
      )
    )
    const esperado = golden('hero.json')
    expect(textos(hero, '.hero-subtitle')).toEqual(esperado.subtitulo)
    expect(textos(hero, '.hero-badge-left')).toEqual(esperado.seloEsquerdo)
    expect(textos(hero, '.hero-badge-right')).toEqual(esperado.seloDireito)
    expect(textos(hero)).toEqual(esperado.textos)
  })

  it('"Por que escolher" da home: os seis cartões e o CTA', () => {
    const html = renderToStaticMarkup(comIdentidade(createElement(WhyChooseUs)))
    // O selo de marca de cada cartão ("GB Locacoes" fixo na produção) virou o nome do cartão na onda 132 (achado 143)
    // e não muda neste lote. O golden do B0 renderizou o widget de 55763c1e sobre o cartão atual, que só mostra o selo
    // quando recebe a marca: a comparação dos textos do conteúdo deixa esse selo de fora (seis, um por cartão).
    const semSeloDeMarca = textos(html).filter(
      (texto) => texto !== golden('hero.json').identidade.nome
    )
    expect(textos(html).length - semSeloDeMarca.length).toBe(6)
    expect(semSeloDeMarca).toEqual(golden('por-que-escolher.json').textos)
  })

  it('contato: modelo e página, com a exceção D-B (um número de frota só)', () => {
    const esperado = golden('contato.json')
    // D-B: na produção o contato dizia "50+ Equipamentos Disponíveis"; a GB tem um número de frota só (o do painel).
    const comFrota = (lista: string[]) =>
      lista.map((texto) => (texto === '50+' ? `${FROTA_DA_FIXTURE}+` : texto))
    const html = renderToStaticMarkup(comIdentidade(createElement(ContatoPage)))
    expect(textos(html)).toEqual(comFrota(esperado.textos))
    let modelo: ReturnType<typeof useContactPage> | null = null
    const Captura = () => {
      modelo = useContactPage()
      return null
    }
    renderToStaticMarkup(comIdentidade(createElement(Captura)))
    const lido = modelo as unknown as ReturnType<typeof useContactPage>
    const esperadoDoModelo = esperado.modelo as {
      contactInfo: unknown[]
      services: unknown[]
      stats: Array<{ number: string; label: string }>
    }
    expect(
      lido.contactInfo.map(({ title, main, subtitle }) => ({
        title,
        main,
        subtitle,
      }))
    ).toEqual(esperadoDoModelo.contactInfo)
    expect(
      lido.services.map(({ title, description }) => ({ title, description }))
    ).toEqual(esperadoDoModelo.services)
    expect(lido.stats).toEqual(
      esperadoDoModelo.stats.map((stat) =>
        stat.number === '50+'
          ? { ...stat, number: `${FROTA_DA_FIXTURE}+` }
          : stat
      )
    )
  })

  it('detalhe do equipamento: promessas e anos; a exceção D-A (sem a nota sem fonte)', () => {
    const visitante = {
      data: null,
      status: 'unauthenticated',
      update: async () => null,
      signOut: async () => {},
    }
    const html = renderToStaticMarkup(
      createElement(
        ApplicationSessionProvider,
        { value: visitante as never },
        comIdentidade(
          createElement(EquipamentoDetalhePage, {
            name: 'Betoneira',
            equipmentId: 'abc',
            description: 'Para concreto',
            categoryName: 'Concreto',
            pricePerDay: 100,
            available: true,
            structuredData: 'DADOS',
            categorySlug: 'concreto',
            images: [],
          } as never)
        )
      )
    )
    // D-A: "4.8" e "(127 avaliações)" eram a nota sem fonte; a GB fica sem a linha até o dono informar a fonte.
    const semNota = golden('equipamento-detalhe.json').textos.filter(
      (texto) => texto !== '4.8' && texto !== '(127 avaliações)'
    )
    expect(textos(html)).toEqual(semNota)
  })

  it('Sobre: os mesmos textos e a mesma marcação estática, byte a byte (referência da decisão sobre a captura)', () => {
    const sobre = renderToStaticMarkup(
      comIdentidade(
        createElement(SobrePage, {
          carousel: () => null,
          badge: () => createElement('div', { id: 'google-merchant-badge' }),
        })
      )
    )
    expect(textos(sobre)).toEqual(golden('sobre.json').textos)
    // Approved canonical spelling (2026-10-08): both classes compile to flex-shrink: 0.
    // Keep the historical golden intact and translate only this known equivalent.
    expect(sobre + '\n').toBe(
      readFileSync(path.join(FIXTURES, 'sobre.markup.html'), 'utf8').replaceAll(
        'flex-shrink-0',
        'shrink-0'
      )
    )
  })
})

/** Tira da lista uma sequência contígua de textos, que precisa existir exatamente uma vez. */
function semTrecho(lista: string[], trecho: string[]): string[] {
  const inicios = lista
    .map((_, indice) => indice)
    .filter((indice) =>
      trecho.every((texto, passo) => lista[indice + passo] === texto)
    )
  expect(inicios, trecho.join(' | ')).toHaveLength(1)
  return [
    ...lista.slice(0, inicios[0]),
    ...lista.slice(inicios[0]! + trecho.length),
  ]
}

describe('GB no corte, sem a frota (D-B): só os números e os selos de frota saem', () => {
  const comFrota = GB.settings
  beforeAll(() => {
    // O que o tools/gb-site-settings.mjs grava, sem frota nenhuma (nem 200 nem 50).
    GB.settings = { ...comFrota, siteContent: { ...GB_SITE_CONTENT } }
  })
  afterAll(() => {
    GB.settings = comFrota
  })

  it('hero: sem o selo "+200 Equipamentos Disponíveis"; subtítulo e selo de anos iguais', () => {
    const hero = renderToStaticMarkup(
      comIdentidade(
        createElement(Hero, {
          initialSettings: {
            heroCarousel: [],
            waveAnimation: 'none',
            siteContent: { experienceYears: GB_SITE_CONTENT.experienceYears },
          },
        })
      )
    )
    const esperado = golden('hero.json')
    expect(textos(hero, '.hero-badge-left')).toEqual([])
    expect(textos(hero, '.hero-subtitle')).toEqual(esperado.subtitulo)
    expect(textos(hero, '.hero-badge-right')).toEqual(esperado.seloDireito)
    expect(textos(hero)).toEqual(
      semTrecho(esperado.textos, ['+200', 'Equipamentos Disponíveis'])
    )
  })

  it('contato: sem o número "50+ Equipamentos Disponíveis"; o resto igual', () => {
    const esperado = golden('contato.json')
    const html = renderToStaticMarkup(comIdentidade(createElement(ContatoPage)))
    expect(textos(html)).toEqual(
      semTrecho(esperado.textos, ['50+', 'Equipamentos Disponíveis'])
    )
    let modelo: ReturnType<typeof useContactPage> | null = null
    const Captura = () => {
      modelo = useContactPage()
      return null
    }
    renderToStaticMarkup(comIdentidade(createElement(Captura)))
    const lido = modelo as unknown as ReturnType<typeof useContactPage>
    expect(lido.stats).toEqual(
      (
        esperado.modelo as { stats: Array<{ number: string; label: string }> }
      ).stats.filter((stat) => stat.label !== 'Equipamentos Disponíveis')
    )
  })

  it('Sobre: sem o número "200+ Equipamentos" e o selo "+200 Equipamentos Disponíveis"; o resto igual', () => {
    const sobre = renderToStaticMarkup(
      comIdentidade(
        createElement(SobrePage, {
          carousel: () => null,
          badge: () => createElement('div', { id: 'google-merchant-badge' }),
        })
      )
    )
    expect(textos(sobre)).toEqual(
      semTrecho(
        semTrecho(golden('sobre.json').textos, [
          '200+',
          'Equipamentos',
          'Ampla variedade de equipamentos para todas as necessidades',
        ]),
        ['+200', 'Equipamentos Disponíveis']
      )
    )
  })
})
