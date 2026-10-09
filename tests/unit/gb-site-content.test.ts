// Dados da GB para o corte do conteúdo da vitrine (tools/gb-site-content.mjs; onda 134, lote vitrine-conteúdo). O script
// em Node puro não importa o contrato TS: aqui os dados passam pelos esquemas do contrato, e os textos legais são
// conferidos contra a caracterização das páginas de antes da troca (tests/unit/__fixtures__/paginas-legais/, B0).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SITE_CONTENT_COMMITMENTS,
  SiteContentSchema,
} from '../../packages/contracts/src/settings'
import {
  STOREFRONT_LEGAL_KINDS,
  StorefrontLegalDocumentSchema,
} from '../../packages/contracts/src/storefront-legal'
import {
  GB_LEGAL_DOCUMENTS,
  GB_SITE_CONTENT,
  GB_SITE_CONTENT_PENDING,
} from '../../tools/gb-site-content.mjs'
import {
  blocosParaTexto,
  textoParaBlocos,
} from '../../packages/frontend/src/entities/documento-legal'

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
  'paginas-legais'
)
const fixture = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf8')

type Node =
  string | { tag: string; props?: Record<string, unknown>; children?: Node[] }

const textOf = (node: Node): string =>
  typeof node === 'string' ? node : (node.children ?? []).map(textOf).join('')

/** Documento no formato do contrato reconstruído das árvores DocumentNode gravadas antes da troca. */
function fromCharacterization(name: string) {
  const { metadata, sections, documentBlocks } = JSON.parse(fixture(name)) as {
    metadata: { updatedAt: string }
    sections: Array<{ id: string; title: string }>
    documentBlocks: Array<Exclude<Node, string>>
  }
  const [introCard, ...cards] = documentBlocks
  return {
    version: 1,
    lastUpdated: metadata.updatedAt,
    intro: textOf(introCard!),
    sections: cards.map((card, index) => {
      const [h2, body] = (card.children![0] as Exclude<Node, string>)
        .children as Array<Exclude<Node, string>>
      const section: Record<string, unknown> = {
        id: (card.props as { id: string }).id,
        title: (h2!.children as Node[])
          .filter((child) => typeof child === 'string')
          .join(''),
        blocks: [],
      }
      expect(section.id).toBe(sections[index]!.id)
      for (const child of body!.children as Array<Exclude<Node, string>>) {
        if (child.tag === 'p')
          (section.blocks as unknown[]).push({
            type: 'paragraph',
            text: textOf(child),
          })
        else if (child.tag === 'ul')
          (section.blocks as unknown[]).push({
            type: 'list',
            items: (child.children as Array<Exclude<Node, string>>).map(
              (li) => {
                const [first, rest] = li.children as Node[]
                return typeof first === 'string'
                  ? first
                  : { lead: textOf(first!), text: (rest as string).slice(1) }
              }
            ),
          })
        else if (child.tag === 'ContactInfoCard') {
          section.contactCard = true
          const note = (child.props as { description?: string } | undefined)
            ?.description
          if (note) section.contactCardNote = note
        }
      }
      return section
    }),
  }
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;')

describe('GB_SITE_CONTENT', () => {
  it('cumpre o contrato de escrita sem mudar nenhum valor', () => {
    expect(SiteContentSchema.parse(GB_SITE_CONTENT)).toEqual(GB_SITE_CONTENT)
  })

  it('sem frota (D-B) e sem nota de avaliações (D-A), listadas como pendentes', () => {
    expect(GB_SITE_CONTENT).not.toHaveProperty('fleetSize')
    expect(GB_SITE_CONTENT).not.toHaveProperty('reviews')
    expect([...GB_SITE_CONTENT_PENDING]).toEqual([
      'siteContent.fleetSize (D-B)',
      'siteContent.reviews (D-A)',
      // Onda 135 (D4): os códigos de verificação vinham do ambiente da produção, nunca do código.
      'siteContent.googleSiteVerification (D4)',
      'siteContent.facebookDomainVerification (D4)',
    ])
  })

  it('os 11 compromissos ligados (D-E: a produção mostrava todos)', () => {
    expect(GB_SITE_CONTENT.commitments).toEqual(
      Object.fromEntries(SITE_CONTENT_COMMITMENTS.map((key) => [key, true]))
    )
  })

  it('dados congelados (o script nunca os altera em memória)', () => {
    expect(Object.isFrozen(GB_SITE_CONTENT)).toBe(true)
    expect(Object.isFrozen(GB_SITE_CONTENT.timeline[0])).toBe(true)
    expect(Object.isFrozen(GB_LEGAL_DOCUMENTS.terms.sections[0])).toBe(true)
  })
})

describe('GB_LEGAL_DOCUMENTS', () => {
  it.each(STOREFRONT_LEGAL_KINDS)(
    '%s cumpre o contrato de escrita sem mudar nenhum texto',
    (kind) => {
      const document = GB_LEGAL_DOCUMENTS[kind]
      expect(StorefrontLegalDocumentSchema.parse(document)).toEqual(document)
    }
  )

  it('Privacidade e Devolução são exatamente as árvores de antes da troca, seção a seção', () => {
    expect(GB_LEGAL_DOCUMENTS.privacy).toEqual(
      fromCharacterization('privacidade.document-blocks.json')
    )
    expect(GB_LEGAL_DOCUMENTS.returnPolicy).toEqual(
      fromCharacterization('politica-devolucao.document-blocks.json')
    )
    // A Privacidade usa a descrição padrão do cartão de contato; a Devolução, a própria nota.
    expect(GB_LEGAL_DOCUMENTS.privacy.sections.at(-1)).toMatchObject({
      id: 'contato',
      contactCard: true,
    })
    expect(GB_LEGAL_DOCUMENTS.privacy.sections.at(-1)).not.toHaveProperty(
      'contactCardNote'
    )
    expect(
      GB_LEGAL_DOCUMENTS.returnPolicy.sections.at(-1)?.contactCardNote
    ).toBe(
      'Estamos à disposição para ajudar com a devolução dos seus equipamentos.'
    )
  })

  it('Termos: cada texto (data, abertura, títulos, parágrafos, itens e nota do cartão) está na página de antes da troca', () => {
    const html = fixture('termos.web.html')
    const terms = GB_LEGAL_DOCUMENTS.terms
    const texts = [
      'Última atualização: ' + terms.lastUpdated,
      terms.intro!,
      ...terms.sections.flatMap((section) => [
        section.title,
        ...(section.contactCardNote ? [section.contactCardNote] : []),
        ...section.blocks.flatMap((block) =>
          block.type === 'paragraph'
            ? [block.text]
            : block.items.map((item) =>
                typeof item === 'string' ? item : item.lead
              )
        ),
      ]),
    ]
    expect(texts.length).toBeGreaterThan(50)
    for (const text of texts) expect(html, text).toContain(escapeHtml(text))
    // Só a seção de contato mostra o cartão, como na página de antes.
    expect(
      terms.sections.filter((section) => section.contactCard).map((s) => s.id)
    ).toEqual(['contato'])
    expect(terms.sections.map((section) => section.id)).toEqual(
      [...html.matchAll(/<div[^>]* id="([a-z0-9-]+)"/g)].map(
        (match) => match[1]
      )
    )
  })
})

describe('GB_LEGAL_DOCUMENTS no editor do painel', () => {
  it.each(STOREFRONT_LEGAL_KINDS)(
    '%s: cada seção vai para a sintaxe leve e volta igual',
    (kind) => {
      for (const section of GB_LEGAL_DOCUMENTS[kind].sections)
        expect(
          textoParaBlocos(blocosParaTexto(section.blocks as never)),
          section.id
        ).toEqual(section.blocks)
    }
  )
})

// Goldens de texto da GB (B0): as versões de 55763c1e renderizadas com a identidade de teste "GB Locações"/"Porto Alegre"
// (tests/unit/__fixtures__/vitrine-gb/). Os valores de GB_SITE_CONTENT são exatamente os que essas telas mostravam;
// a comparação dos componentes novos com os goldens entra com a vitrine (B7).
describe('GB_SITE_CONTENT contra os goldens de texto de 55763c1e', () => {
  const golden = (nome: string) =>
    JSON.parse(
      fs.readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '__fixtures__',
          'vitrine-gb',
          nome
        ),
        'utf8'
      )
    ) as { textos: string[]; [chave: string]: unknown }

  it('anos de mercado: hero, "Por que escolher", contato e Sobre', () => {
    const anos = GB_SITE_CONTENT.experienceYears
    expect(golden('hero.json').subtitulo).toEqual([
      `Há ${anos} anos oferecendo soluções em locação de equipamentos para obras e serviços em altura. Segurança, qualidade e manutenção constante.`,
    ])
    expect(golden('hero.json').seloDireito).toEqual([
      `${anos}+`,
      'Anos de Experiência',
    ])
    expect(golden('por-que-escolher.json').textos).toContain(
      `${anos} Anos de Experiência`
    )
    expect(golden('contato.json').modelo).toMatchObject({
      stats: expect.arrayContaining([
        { number: `${anos}+`, label: 'Anos de Experiência' },
      ]),
    })
    expect(golden('sobre.json').textos).toContain(
      `Em Porto Alegre e região, oferecendo soluções em equipamentos para construção civil há mais de ${anos} anos`
    )
  })

  it('construtoras clientes, clientes, projetos e cidades', () => {
    expect(golden('por-que-escolher.json').textos).toContain(
      `Atendemos grandes construtoras como ${GB_SITE_CONTENT.featuredClients.join(', ')} e outras.`
    )
    const sobre = golden('sobre.json').textos
    expect(sobre).toEqual(
      expect.arrayContaining([
        `${GB_SITE_CONTENT.clientsServed}+`,
        'Clientes Satisfeitos',
        `${GB_SITE_CONTENT.citiesServed}+`,
        'Cidades Atendidas',
      ])
    )
    expect(golden('contato.json').modelo).toMatchObject({
      stats: expect.arrayContaining([
        {
          number: `${GB_SITE_CONTENT.projectsCompleted}+`,
          label: 'Projetos Realizados',
        },
      ]),
    })
  })

  it('história e linha do tempo da Sobre, na ordem', () => {
    const sobre = golden('sobre.json').textos
    expect(sobre).toContain(GB_SITE_CONTENT.history)
    const jornada = sobre.slice(sobre.indexOf('Nossa Jornada') + 2)
    expect(jornada.slice(0, 12)).toEqual(
      GB_SITE_CONTENT.timeline.flatMap((item) => [
        String(item.year),
        item.title,
        item.description,
      ])
    )
  })

  it('frota (D-B) e nota (D-A) eram fatos da GB nos goldens, e ficam de fora dos dados do script', () => {
    expect(golden('hero.json').seloEsquerdo).toEqual([
      '+200',
      'Equipamentos Disponíveis',
    ])
    expect(golden('contato.json').modelo).toMatchObject({
      stats: expect.arrayContaining([
        { number: '50+', label: 'Equipamentos Disponíveis' },
      ]),
    })
    expect(golden('equipamento-detalhe.json').textos).toEqual(
      expect.arrayContaining(['4.8', '(127 avaliações)'])
    )
    expect(GB_SITE_CONTENT).not.toHaveProperty('fleetSize')
    expect(GB_SITE_CONTENT).not.toHaveProperty('reviews')
  })
})
