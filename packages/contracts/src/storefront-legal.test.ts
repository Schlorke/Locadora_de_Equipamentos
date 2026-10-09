/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AdminStorefrontLegalBodySchema,
  STOREFRONT_LEGAL_KINDS,
  STOREFRONT_LEGAL_MAX_BYTES,
  STOREFRONT_LEGAL_PAGE_PATHS,
  STOREFRONT_LEGAL_SLUGS,
  STOREFRONT_PAUSE_PUBLIC_PATHS,
  StorefrontLegalDocumentSchema,
  parseStorefrontLegalDocument,
  storefrontLegalItemParts,
  storefrontLegalKindFromSlug,
} from './storefront-legal'

/**
 * Nomes que um código-fonte exporta, valores e tipos. O teste de colisão lê o arquivo em vez de importar o módulo
 * inteiro (`import * as` com `Object.keys`): com o namespace, o knip contava todo export dos dois módulos como usado
 * por teste e um export morto deles virava test-only-export no pnpm hygiene; e `Object.keys` não via os tipos. O
 * caminho sai de path.join: `new URL('./arquivo.ts', import.meta.url)` o knip lê como import do módulo inteiro, com o
 * mesmo efeito do namespace (medido numa fixture do gate real em 2026-10-07).
 */
function exportedNamesIn(source: string): Set<string> {
  if (/^export\s*\*/m.test(source))
    throw new Error('`export *` não tem nomes no código-fonte')
  const names = new Set<string>()
  for (const [, name] of source.matchAll(
    /^export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:const\s+enum|const|let|var|function\*?|class|type|interface|enum|namespace)\s+([\p{L}_$][\p{L}\p{N}_$]*)/gmu
  ))
    names.add(name!)
  for (const [, list] of source.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm))
    for (const item of list!.split(',')) {
      const name = item
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
      if (name) names.add(name)
    }
  return names
}

const srcDir = path.dirname(fileURLToPath(import.meta.url))
const exportedNames = (file: string) =>
  exportedNamesIn(readFileSync(path.join(srcDir, file), 'utf8'))

// Textos legais por locadora (decisão do dono de 2026-10-06, item 3; U5 da ADR adr-tenant-hosts). O banco guarda
// estrutura validada (seções com parágrafos e listas), nunca HTML: o texto é sempre texto.
const documento = {
  version: 1,
  lastUpdated: '13 de Fevereiro de 2026',
  intro: 'A Locadora Nova preza pela transparência.',
  sections: [
    {
      id: 'condicoes-gerais',
      title: 'Condições Gerais',
      blocks: [
        { type: 'paragraph', text: 'A devolução segue o contrato.' },
        {
          type: 'list',
          items: [
            'Equipamento limpo.',
            { lead: 'Locação diária:', text: 'devolução no dia seguinte' },
            { lead: 'Só o destaque', text: '' },
          ],
        },
      ],
    },
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: 'Fale conosco:' }],
      contactCard: true,
      contactCardNote: 'Estamos à disposição.',
    },
  ],
}

describe('nomes e caminhos dos documentos da vitrine', () => {
  it('três tipos, com slug de rota e página da vitrine', () => {
    expect([...STOREFRONT_LEGAL_KINDS]).toEqual([
      'terms',
      'privacy',
      'returnPolicy',
    ])
    expect(STOREFRONT_LEGAL_SLUGS).toEqual({
      terms: 'terms',
      privacy: 'privacy',
      returnPolicy: 'return-policy',
    })
    expect(STOREFRONT_LEGAL_PAGE_PATHS).toEqual({
      terms: '/termos',
      privacy: '/privacidade',
      returnPolicy: '/politica-devolucao',
    })
    expect([...STOREFRONT_PAUSE_PUBLIC_PATHS]).toEqual([
      '/termos',
      '/privacidade',
      '/politica-devolucao',
      '/cookies',
    ])
  })

  it('slug da rota para o tipo; o resto (inclusive o nome do tipo) não é rota', () => {
    expect(storefrontLegalKindFromSlug('terms')).toBe('terms')
    expect(storefrontLegalKindFromSlug('privacy')).toBe('privacy')
    expect(storefrontLegalKindFromSlug('return-policy')).toBe('returnPolicy')
    for (const slug of [
      'returnPolicy',
      'TERMS',
      'cookies',
      '',
      '__proto__',
      'constructor',
      'terms/',
    ])
      expect(storefrontLegalKindFromSlug(slug), slug).toBeNull()
  })

  it('não colide com os nomes dos termos da plataforma do onboarding', () => {
    const doOnboarding = exportedNames('onboarding.ts')
    const daVitrine = exportedNames('storefront-legal.ts')
    // Controle da leitura: valores, funções e tipos dos dois arquivos.
    expect([...doOnboarding]).toEqual(
      expect.arrayContaining([
        'LEGAL_DOCUMENT_KINDS',
        'LegalDocumentKind',
        'normalizeCnpjInput',
      ])
    )
    expect([...daVitrine]).toEqual(
      expect.arrayContaining([
        'STOREFRONT_LEGAL_KINDS',
        'StorefrontLegalKind',
        'storefrontLegalKindFromSlug',
        'StorefrontLegalDocumentRead',
      ])
    )
    expect([...daVitrine].filter((nome) => doOnboarding.has(nome))).toEqual([])
  })

  it('a leitura dos exports acha cada forma de export e recusa `export *` (controle do leitor)', () => {
    const fonte = [
      '/**',
      ' * export const comentario = 0',
      ' */',
      'const interno = 1',
      'export const valor = 1',
      'export declare const declarado: number',
      'export async function assincrona() {}',
      'export function* geradora() {}',
      'export abstract class Abstrata {}',
      'export const enum Constante { A }',
      'export type Tipo = string',
      'export interface Interface {}',
      'export enum Enumeracao { A }',
      'export { interno as renomeado, valor as outro }',
      'export type { Tipo as TipoReexportado }',
      "export { origem } from './origem'",
    ].join('\n')
    expect([...exportedNamesIn(fonte)].sort()).toEqual(
      [
        'Abstrata',
        'Constante',
        'Enumeracao',
        'Interface',
        'Tipo',
        'TipoReexportado',
        'assincrona',
        'declarado',
        'geradora',
        'origem',
        'outro',
        'renomeado',
        'valor',
      ].sort()
    )
    expect(() => exportedNamesIn("export * from './origem'")).toThrow(
      'export *'
    )
  })
})

describe('StorefrontLegalDocumentSchema (escrita)', () => {
  it('aceita o documento e apara os textos', () => {
    expect(StorefrontLegalDocumentSchema.parse(documento)).toEqual(documento)
    const aparado = StorefrontLegalDocumentSchema.parse({
      ...documento,
      intro: '  Introdução.  ',
    })
    expect(aparado.intro).toBe('Introdução.')
  })

  it('aceita texto de script e entidades HTML como texto (renderizado como nó de texto)', () => {
    const carga = '<script>alert(1)</script> javascript:alert(1) &lt;b&gt;'
    const parsed = StorefrontLegalDocumentSchema.parse({
      ...documento,
      sections: [
        {
          id: 'carga',
          title: carga,
          blocks: [
            { type: 'paragraph', text: carga },
            { type: 'list', items: [carga, { lead: carga, text: carga }] },
          ],
        },
      ],
    })
    expect(parsed.sections[0]!.title).toBe(carga)
  })

  it('ids das seções: kebab-case até 60 caracteres e únicos', () => {
    const secao = documento.sections[0]!
    for (const [id, aceito] of [
      ['secao-1', true],
      ['a', true],
      ['a'.repeat(60), true],
      ['a'.repeat(61), false],
      ['Secao', false],
      ['secao_1', false],
      ['-secao', false],
      ['secao-', false],
      ['secao--1', false],
      ['seção', false],
      ['', false],
    ] as const)
      expect(
        StorefrontLegalDocumentSchema.safeParse({
          ...documento,
          sections: [{ ...secao, id }],
        }).success,
        id
      ).toBe(aceito)
    expect(
      StorefrontLegalDocumentSchema.safeParse({
        ...documento,
        sections: [secao, { ...secao, title: 'Outra' }],
      }).success
    ).toBe(false)
  })

  it('recusa chave desconhecida, versão diferente e bloco desconhecido', () => {
    for (const invalido of [
      { ...documento, html: '<p>x</p>' },
      { ...documento, version: 2 },
      { ...documento, version: '1' },
      {
        ...documento,
        sections: [{ ...documento.sections[0], style: 'color:red' }],
      },
      {
        ...documento,
        sections: [
          {
            ...documento.sections[0],
            blocks: [{ type: 'html', text: '<b>x</b>' }],
          },
        ],
      },
      {
        ...documento,
        sections: [
          {
            ...documento.sections[0],
            blocks: [{ type: 'paragraph', text: 'x', href: 'https://x' }],
          },
        ],
      },
      {
        ...documento,
        sections: [
          {
            ...documento.sections[0],
            blocks: [
              { type: 'list', items: [{ lead: 'x', text: 'y', link: 'z' }] },
            ],
          },
        ],
      },
    ])
      expect(
        StorefrontLegalDocumentSchema.safeParse(invalido).success,
        JSON.stringify(invalido).slice(0, 120)
      ).toBe(false)
  })

  it('limites de seções, blocos, itens e textos', () => {
    const secao = (n: number) => ({
      id: `s-${n}`,
      title: 'Seção',
      blocks: [{ type: 'paragraph', text: 'Texto.' }],
    })
    const com = (patch: Record<string, unknown>) =>
      StorefrontLegalDocumentSchema.safeParse({ ...documento, ...patch })
        .success
    expect(com({ sections: [] })).toBe(false)
    expect(
      com({ sections: Array.from({ length: 40 }, (_, n) => secao(n)) })
    ).toBe(true)
    expect(
      com({ sections: Array.from({ length: 41 }, (_, n) => secao(n)) })
    ).toBe(false)
    const blocos = (blocks: unknown[]) =>
      com({ sections: [{ id: 'a', title: 'A', blocks }] })
    expect(blocos([])).toBe(false)
    expect(blocos(Array(60).fill({ type: 'paragraph', text: 'x' }))).toBe(true)
    expect(blocos(Array(61).fill({ type: 'paragraph', text: 'x' }))).toBe(false)
    expect(blocos([{ type: 'paragraph', text: 'x'.repeat(5000) }])).toBe(true)
    expect(blocos([{ type: 'paragraph', text: 'x'.repeat(5001) }])).toBe(false)
    expect(blocos([{ type: 'paragraph', text: '   ' }])).toBe(false)
    expect(blocos([{ type: 'list', items: [] }])).toBe(false)
    expect(blocos([{ type: 'list', items: Array(60).fill('x') }])).toBe(true)
    expect(blocos([{ type: 'list', items: Array(61).fill('x') }])).toBe(false)
    expect(blocos([{ type: 'list', items: ['x'.repeat(2001)] }])).toBe(false)
    expect(
      blocos([{ type: 'list', items: [{ lead: 'x'.repeat(161), text: '' }] }])
    ).toBe(false)
    expect(blocos([{ type: 'list', items: [{ lead: '', text: 'x' }] }])).toBe(
      false
    )
    expect(com({ lastUpdated: '' })).toBe(false)
    expect(com({ lastUpdated: 'x'.repeat(61) })).toBe(false)
    expect(com({ intro: 'x'.repeat(4001) })).toBe(false)
    expect(com({ intro: undefined })).toBe(true)
    expect(com({ sections: [{ ...secao(1), title: 'x'.repeat(161) }] })).toBe(
      false
    )
  })

  it('nota do cartão de contato só com o cartão e até 300 caracteres', () => {
    const contato = documento.sections[1]!
    const com = (patch: Record<string, unknown>) =>
      StorefrontLegalDocumentSchema.safeParse({
        ...documento,
        sections: [{ ...contato, ...patch }],
      }).success
    expect(com({})).toBe(true)
    expect(com({ contactCardNote: undefined })).toBe(true)
    expect(com({ contactCardNote: 'x'.repeat(301) })).toBe(false)
    expect(com({ contactCard: false })).toBe(false)
    expect(com({ contactCard: undefined })).toBe(false)
    expect(com({ contactCard: false, contactCardNote: undefined })).toBe(true)
  })

  it('caractere de controle é recusado', () => {
    // Inclui o separador de parágrafo e os isolamentos de direção (LRI, RLI, FSI, PDI), que invertem a leitura de um
    // trecho do texto legal como os controles embutidos (U+202A–U+202E).
    for (const codigo of [
      0x0000, 0x000a, 0x2028, 0x2029, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    ])
      expect(
        StorefrontLegalDocumentSchema.safeParse({
          ...documento,
          intro: `Linha${String.fromCharCode(codigo)}linha`,
        }).success,
        `U+${codigo.toString(16).toUpperCase().padStart(4, '0')}`
      ).toBe(false)
    // Também na primeira e na última posição, onde o `.trim()` não os remove (o ataque de direção clássico abre o
    // texto com o U+202E); um controle no fim do título da seção também recusa o documento.
    const aceita = (patch: Record<string, unknown>) =>
      StorefrontLegalDocumentSchema.safeParse({ ...documento, ...patch })
        .success
    const comTitulo = (title: string) => ({
      sections: [
        { ...documento.sections[0]!, title },
        ...documento.sections.slice(1),
      ],
    })
    expect(aceita({ intro: 'Linha' })).toBe(true)
    expect(aceita(comTitulo('Seção'))).toBe(true)
    for (const codigo of [0x0000, 0x0085, 0x202e, 0x2066, 0x2069]) {
      const controle = String.fromCharCode(codigo)
      const ponto = `U+${codigo.toString(16).toUpperCase().padStart(4, '0')}`
      for (const intro of [`${controle}Linha`, `Linha${controle}`])
        expect(aceita({ intro }), `${ponto} na ponta da introdução`).toBe(false)
      expect(aceita(comTitulo(`Seção${controle}`)), `${ponto} no título`).toBe(
        false
      )
    }
  })

  it('teto de 200.000 bytes em UTF-8, contado em bytes e não em caracteres', () => {
    // Texto multibyte: 4 bytes por caractere. Cabe em caracteres (limites por campo), estoura em bytes.
    const emoji = '\u{1F600}'
    const secoes = (paragrafo: string, quantas: number) =>
      Array.from({ length: quantas }, (_, n) => ({
        id: `s-${n}`,
        title: 'Seção',
        blocks: Array(12).fill({ type: 'paragraph', text: paragrafo }),
      }))
    const ascii = { ...documento, sections: secoes('x'.repeat(2400), 6) }
    expect(StorefrontLegalDocumentSchema.safeParse(ascii).success).toBe(true)
    const multibyte = { ...documento, sections: secoes(emoji.repeat(1200), 6) }
    expect(
      new TextEncoder().encode(JSON.stringify(multibyte)).length
    ).toBeGreaterThan(STOREFRONT_LEGAL_MAX_BYTES)
    expect(StorefrontLegalDocumentSchema.safeParse(multibyte).success).toBe(
      false
    )
    expect(STOREFRONT_LEGAL_MAX_BYTES).toBe(200_000)
  })

  it('conta 1, 2, 3 e 4 bytes como o TextEncoder: no teto exato passa, um byte acima recusa', () => {
    // Onda 134, parte B: o teto é contado sem TextEncoder (o contrato também roda no app). Último parágrafo com
    // caracteres de 2 (ç), 3 (€) e 4 bytes (emoji) e o resto em ASCII, para fechar o documento em exatamente 200.000.
    const bytes = (valor: unknown) =>
      new TextEncoder().encode(JSON.stringify(valor)).length
    const montar = (tamanho: number, final: string) => ({
      ...documento,
      sections: [
        ...Array.from({ length: 12 }, (_, n) => ({
          id: `s-${n}`,
          title: 'Seção',
          blocks: Array(4).fill({
            type: 'paragraph',
            text: 'x'.repeat(tamanho),
          }),
        })),
        {
          id: 'fim',
          title: 'Fim',
          blocks: [{ type: 'paragraph', text: final }],
        },
      ],
    })
    const especiais = 'ç€\u{1F600}'
    const sobra = bytes(montar(0, especiais))
    const tamanho = Math.floor((STOREFRONT_LEGAL_MAX_BYTES - sobra - 2000) / 48)
    const resto = STOREFRONT_LEGAL_MAX_BYTES - bytes(montar(tamanho, especiais))
    expect(resto).toBeGreaterThanOrEqual(0)
    const exato = montar(tamanho, especiais + 'x'.repeat(resto))
    expect(bytes(exato)).toBe(STOREFRONT_LEGAL_MAX_BYTES)
    expect(StorefrontLegalDocumentSchema.safeParse(exato).success).toBe(true)
    const acima = montar(tamanho, especiais + 'x'.repeat(resto + 1))
    expect(bytes(acima)).toBe(STOREFRONT_LEGAL_MAX_BYTES + 1)
    expect(StorefrontLegalDocumentSchema.safeParse(acima).success).toBe(false)
  })

  it('corpo do painel: só { document }', () => {
    expect(
      AdminStorefrontLegalBodySchema.safeParse({ document: documento }).success
    ).toBe(true)
    expect(
      AdminStorefrontLegalBodySchema.safeParse({
        document: documento,
        publishedAt: '2026-01-01T00:00:00.000Z',
      }).success
    ).toBe(false)
    expect(AdminStorefrontLegalBodySchema.safeParse(documento).success).toBe(
      false
    )
  })
})

describe('parseStorefrontLegalDocument (leitura)', () => {
  it('documento válido: ok', () => {
    expect(parseStorefrontLegalDocument(documento)).toEqual({
      status: 'ok',
      document: documento,
    })
  })

  it('ignora chave desconhecida em vez de esconder o documento', () => {
    const lido = parseStorefrontLegalDocument({
      ...documento,
      futureField: true,
      sections: [{ ...documento.sections[0], icon: 'x' }],
    })
    expect(lido).toEqual({
      status: 'ok',
      document: { ...documento, sections: [documento.sections[0]] },
    })
  })

  it('versão não suportada é diferente de documento inválido ou ausente', () => {
    expect(parseStorefrontLegalDocument({ ...documento, version: 2 })).toEqual({
      status: 'unsupported-version',
    })
    expect(
      parseStorefrontLegalDocument({ version: 3, formatoNovo: [] })
    ).toEqual({ status: 'unsupported-version' })
    for (const invalido of [
      null,
      undefined,
      'texto',
      [],
      { ...documento, version: undefined },
      { ...documento, sections: [] },
      {
        ...documento,
        sections: [
          { ...documento.sections[0], blocks: [{ type: 'html', text: 'x' }] },
        ],
      },
    ])
      expect(
        parseStorefrontLegalDocument(invalido),
        JSON.stringify(invalido)?.slice(0, 80)
      ).toEqual({ status: 'invalid' })
  })
})

describe('item de lista com destaque', () => {
  it('junção do destaque com o texto: um espaço entre os dois e nenhum sem texto', () => {
    expect(storefrontLegalItemParts('Equipamento limpo.')).toEqual({
      lead: null,
      text: 'Equipamento limpo.',
    })
    expect(
      storefrontLegalItemParts({
        lead: 'Locação diária:',
        text: 'devolução no dia seguinte',
      })
    ).toEqual({ lead: 'Locação diária:', text: ' devolução no dia seguinte' })
    expect(
      storefrontLegalItemParts({ lead: 'Só o destaque', text: '' })
    ).toEqual({ lead: 'Só o destaque', text: '' })
  })
})
