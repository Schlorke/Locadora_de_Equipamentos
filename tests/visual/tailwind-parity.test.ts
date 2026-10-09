// Paridade Tailwind 3 × 4 (lote css-paridade, achado 127): para CADA utilitário e cada cadeia de variantes usados no
// código do produto, o CSS global atual (packages/frontend/src/app/styles/globals.web.css, Tailwind 4, como o
// build:web) dá ao elemento o mesmo estilo que a produção (main eb4c0098, Tailwind 3.4.17), em repouso e no foco (com o
// anel de foco do navegador), gravado em tailwind-parity/production.json pelo gerador
// support/tailwind-parity-fixture.mjs. Exceções só com motivo, em tailwind-parity/exceptions.json. Sem navegador:
// support/tailwind-parity.mjs resolve a cascata e normaliza os valores.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import * as P from './support/tailwind-parity.mjs'

type Flat = Record<string, string>
interface Fixture {
  controles: Record<string, Flat>
  utilitarios: Record<
    string,
    {
      producao: string
      gerada: boolean
      modos: Record<string, { controle: string; delta: Flat }>
    }
  >
  cadeias: Record<string, { entradas: string[] } | null>
  combinacoes: Record<string, { controle: Flat; delta: Flat }>
  elementos: Record<string, string>
  foco: Record<string, Record<string, string>>
}
interface Exceptions {
  utilitarios: Record<string, string>
  cadeias: Record<string, string>
  notas: Record<string, string>
  elementos: Record<string, string>
  foco: {
    passadas: string[]
    atual: string
    producao: string
    motivo: string
  }[]
}

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const requireRoot = createRequire(path.join(repo, 'package.json'))
const postcss = requireRoot('postcss')
const tailwind = requireRoot('@tailwindcss/postcss')
const entry = path.join(
  repo,
  'packages',
  'frontend',
  'src',
  'app',
  'styles',
  'globals.web.css'
)
const fixture: Fixture = JSON.parse(
  fs.readFileSync(path.join(here, 'tailwind-parity', 'production.json'), 'utf8')
)
const exceptions: Exceptions = JSON.parse(
  fs.readFileSync(path.join(here, 'tailwind-parity', 'exceptions.json'), 'utf8')
)
const REGENERATE =
  'rode `node tests/visual/support/tailwind-parity-fixture.mjs` (tests/visual/README.md, seção "Paridade com a produção")'

let plan: { bases: string[]; chains: string[] }
let items: {
  base: string
  mode: string
  tag: string
  children: number
  classes: string[]
  control: string
}[]
let controls: {
  key: string
  tag: string
  classes: string[]
  children: number
}[]
let sheet: ReturnType<typeof P.prepareSheet>
let variants: Map<string, { entries: string[]; notes: string[] }>
let frames: Record<string, string>

const compile = async (extra = '') => {
  const css = fs.readFileSync(entry, 'utf8') + extra
  return (
    await postcss([
      tailwind({
        base: path.join(repo, 'apps', 'clients', 'web'),
        optimize: false,
      }),
    ]).process(css, { from: entry })
  ).root
}
const inline = (classes: string[]) =>
  `\n@source inline("${[...new Set(classes)].join(' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");\n`

beforeAll(async () => {
  plan = P.planOf(P.productClasses(await compile()))
  ;({ items, controls } = P.itemsOf(plan.bases))
  frames = P.uiFrames(repo, fs, path)
  const comboClasses = P.COMBOS.flatMap((c) => {
    const k = P.comboClasses(c, frames)
    return [
      ...k.current,
      ...k.parent,
      ...(c.childClasses ?? []).flatMap((s: string) => s.split(' ')),
    ]
  }).filter(Boolean)
  const probes = plan.chains.map((c) => `${c}:${P.PROBE}`)
  const focusClasses = P.FOCUS_ELEMENTS.flatMap((e) =>
    P.focusElementClasses(e, frames)
  )
  const root = await compile(
    inline([
      ...items.flatMap((it) => it.classes),
      ...comboClasses,
      ...focusClasses,
      ...probes,
    ])
  )
  sheet = P.prepareSheet(root)
  variants = P.variantEntries(sheet.flat, plan.chains)
}, 300_000)

describe('paridade com a produção (Tailwind 3.4.17)', () => {
  it('preserva o espaço de interpolação do degradê ao comparar com a produção sRGB', () => {
    const historical = P.canonical(
      'background-image',
      'linear-gradient(to bottom right, #f00 0%, #00f 100%)'
    )
    expect(
      P.canonical(
        'background-image',
        'linear-gradient(to bottom right in srgb, #f00, #00f)'
      )
    ).toBe(historical)
    const oklab = P.canonical(
      'background-image',
      'linear-gradient(to bottom right in oklab, #f00, #00f)'
    )
    expect(oklab).not.toBe(historical)
    expect(oklab).toContain('in oklab')
  })

  it('toda classe usada no produto tem o valor da produção na fixture (classe nova: regenere a fixture)', () => {
    expect(plan.bases.length).toBeGreaterThan(1000)
    const missingBases = plan.bases.filter(
      (b) => !(b in fixture.utilitarios) && !(b in exceptions.utilitarios)
    )
    const missingChains = plan.chains.filter(
      (c) => !(c in fixture.cadeias) && !(c in exceptions.cadeias)
    )
    expect({ missingBases, missingChains }, REGENERATE).toEqual({
      missingBases: [],
      missingChains: [],
    })
  })

  // Achado 141: o tom da paleta lido pela variável do tema (`bg-[var(--color-gray-50)]`) era, na produção, a classe da
  // paleta (`bg-gray-50`); a produção não tinha a variável. A fixture guarda o estilo dessa classe.
  it('tom da paleta pela variável do tema tem o estilo da classe da paleta da produção', () => {
    expect(P.toProduction('bg-[var(--color-gray-50)]')).toBe('bg-gray-50')
    expect(P.toProduction('hover:text-[var(--color-red-800)]')).toBe(
      'hover:text-red-800'
    )
    expect(P.toProduction('border-[var(--color-yellow-200)]/50')).toBe(
      'border-yellow-200/50'
    )
    expect(P.toProduction('bg-[var(--color-white)]')).toBe('bg-white')
    // Variáveis que não são tom da paleta (e utilitários que não são de cor) continuam com o próprio nome.
    for (const own of [
      'bg-[var(--color-bg)]',
      'border-[var(--color-border)]',
      'z-[var(--layer-inset)]',
      'w-[var(--color-gray-50)]',
    ])
      expect(P.toProduction(own)).toBe(own)
    // Achado 148: o produto deixou de escrever a paleta pela variável (os selos e o fundo do painel usam os tokens
    // semânticos do design-tokens) e a catraca tailwind-palette-class do `pnpm tokens` a conta como classe da paleta.
    // A lista pode ficar vazia; uma ocorrência que voltar continua conferida com a classe da produção.
    const paletteVars = plan.bases.filter((b) =>
      /^[a-z-]+-\[var\(--color-[a-z]+-\d+\)\]$/.test(b)
    )
    for (const base of paletteVars) {
      expect(fixture.utilitarios[base]?.producao, base).toBe(
        P.toProduction(base)
      )
      expect(P.toProduction(base), base).not.toContain('var(')
    }
  })

  it('nenhum utilitário usado era inerte na produção (o Tailwind 3 não gerava a classe), salvo os próprios do projeto', () => {
    const inert = plan.bases.filter(
      (b) =>
        fixture.utilitarios[b] &&
        !fixture.utilitarios[b].gerada &&
        !(b in exceptions.utilitarios)
    )
    expect(inert).toEqual([])
  })

  it('cada utilitário usado dá ao elemento (e aos filhos, em space-*/divide-*) o estilo da produção, a 1440 e a 390 px, nas cores forçadas e no foco por teclado (com o anel do navegador)', () => {
    const controlStyles = new Map(
      controls.map((c) => [
        c.key,
        P.flatStyle(
          P.styleOfClasses(sheet, c.classes, {
            tag: c.tag,
            children: c.children,
          })
        ),
      ])
    )
    const failures: string[] = []
    for (const it of items) {
      if (it.base in exceptions.utilitarios) continue
      const expected = fixture.utilitarios[it.base]?.modos[it.mode]
      if (!expected) continue
      const el4 = P.flatStyle(
        P.styleOfClasses(sheet, it.classes, {
          tag: it.tag,
          children: it.children,
        })
      )
      const diffs = P.deltaDiff({
        el4,
        ctrl4: controlStyles.get(it.control)!,
        el3: expected.delta,
        ctrl3: fixture.controles[expected.controle]!,
      })
      for (const d of diffs)
        failures.push(
          `${it.classes.join(' ')} [${it.mode}] ${d.k}: atual=${d.atual} produção=${d.producao}`
        )
    }
    expect(failures).toEqual([])
  }, 300_000)

  it('cada cadeia de variantes usada tem a condição da produção (media, seletor e declarações que a variante injeta)', () => {
    const failures: string[] = []
    for (const chain of plan.chains) {
      if (chain in exceptions.cadeias) continue
      const expected = fixture.cadeias[chain]
      const actual = variants.get(chain)
      if (expected === undefined) continue
      if (expected === null) {
        failures.push(`${chain}: a produção não gerava esta variante`)
        continue
      }
      if (!actual) {
        failures.push(`${chain}: o Tailwind 4 não gera esta variante`)
        continue
      }
      if (JSON.stringify(actual.entries) !== JSON.stringify(expected.entradas))
        failures.push(
          `${chain}:\n    atual:    ${actual.entries.join(' ‖ ')}\n    produção: ${expected.entradas.join(' ‖ ')}`
        )
      for (const note of actual.notes)
        if (!exceptions.notas[note])
          failures.push(
            `${chain}: nota "${note}" sem motivo em exceptions.json`
          )
    }
    expect(failures).toEqual([])
  })

  it('as combinações que dependiam da ordem, da especificidade, do estado (foco por teclado e por mouse) ou da fonte do navegador renderizam como na produção, inclusive as molduras de gatilho e de campo', () => {
    const failures: string[] = []
    for (const combo of P.COMBOS) {
      const expected = fixture.combinacoes[combo.name]
      expect(expected, `${combo.name}: ${REGENERATE}`).toBeDefined()
      const k = P.comboClasses(combo, frames)
      const opts = P.comboOptions(combo, k.parent)
      const el4 = P.flatStyle(P.styleOfClasses(sheet, k.current, opts))
      const ctrl4 = P.flatStyle(
        P.styleOfClasses(sheet, [], { ...opts, childClasses: [] })
      )
      const only = combo.props ? new RegExp(combo.props) : null
      for (const d of P.deltaDiff({
        el4,
        ctrl4,
        el3: expected!.delta,
        ctrl3: expected!.controle,
        absolute: !!combo.producao,
      }))
        if (!only || only.test(d.k.split(' ').pop()!))
          failures.push(
            `${combo.name} ${d.k}: atual=${d.atual} produção=${d.producao}`
          )
    }
    expect(failures).toEqual([])
  })

  it('cada elemento de foco de packages/ui (gatilhos e itens de menu, X do Dialog e do Sheet, caixa de seleção, abas, CloseButton, cartão de filtros) tem o contorno do componente da produção em repouso, no clique e no teclado, no modo normal e nas cores forçadas, salvo as diferenças aprovadas', () => {
    // Regra do foco (achado 128, decisão do usuário): em repouso e no clique, nenhum contorno em nenhum modo; no
    // teclado, o anel da marca no modo normal e, nas cores forçadas, um contorno visível na cor do sistema. A
    // comparação é por ELEMENTO (as molduras lidas da fonte, no DOM do componente), não por utilitário: o
    // outline-hidden em repouso é igual ao outline-none da produção classe a classe, mas desenha nas cores forçadas.
    const failures: string[] = []
    const used = new Set<number>()
    for (const element of P.FOCUS_ELEMENTS) {
      const expected = fixture.foco?.[element.name]
      if (!expected) {
        failures.push(`${element.name}: ${REGENERATE}`)
        continue
      }
      const classes = P.focusElementClasses(element, frames)
      for (const pass of P.focusPassesOf(element)) {
        const atual = P.focusOutline(sheet, classes, element, pass)
        const producao = expected[pass]
        if (atual === producao) continue
        const approved = exceptions.foco.findIndex(
          (a) =>
            a.passadas.includes(pass) &&
            a.atual === atual &&
            a.producao === producao
        )
        if (approved >= 0) used.add(approved)
        else
          failures.push(
            `${element.name} [${pass}]: atual=${atual} produção=${producao}`
          )
      }
    }
    expect(failures).toEqual([])
    const unused = exceptions.foco
      .map((a, i) =>
        used.has(i) ? null : `${a.passadas.join(', ')}: ${a.atual}`
      )
      .filter(Boolean)
    expect(unused, 'diferença aprovada de foco sem uso: remova').toEqual([])
  })

  it('regra do foco nos mesmos elementos: nenhum contorno em repouso e no clique em nenhum modo; no teclado, o anel da marca e, nas cores forçadas, um contorno visível', () => {
    // A paridade acima aceita o que a produção fazia; esta prova a regra (decisão do usuário, achado 128) mesmo onde a
    // produção não tinha foco visível. Anel da marca: 2px sólido no --focus-ring (#ea580c), afastado 2px. A caixa de
    // seleção mantém no modo normal o halo laranja da produção (sombra, `teclado: 'halo'`), que as cores forçadas apagam.
    const BRAND_RING = 'solid 2px rgba(234,88,12,1) offset 2px'
    const failures: string[] = []
    for (const element of P.FOCUS_ELEMENTS) {
      const classes = P.focusElementClasses(element, frames)
      for (const pass of P.focusPassesOf(element)) {
        const atual = P.focusOutline(sheet, classes, element, pass)
        const expected =
          pass === 'teclado'
            ? element.teclado === 'halo'
              ? 'nenhum'
              : BRAND_RING
            : pass === 'cores-forçadas teclado'
              ? 'visível'
              : 'nenhum'
        const ok =
          expected === 'visível' ? atual !== 'nenhum' : atual === expected
        if (!ok)
          failures.push(
            `${element.name} [${pass}]: atual=${atual} esperado=${expected}`
          )
      }
    }
    expect(failures).toEqual([])
  })

  it('elementos sem classe têm o preflight da produção (cursor dos botões, fundo dos campos, placeholder), salvo exceções', () => {
    const failures: string[] = []
    for (const check of P.ELEMENT_CHECKS) {
      const key = `${check.name} | ${check.target ? `${check.target} ` : ''}${check.prop}`
      const expected = fixture.elementos[key]
      if (expected === undefined) {
        failures.push(`${key}: ${REGENERATE}`)
        continue
      }
      const actual = P.elementCheckValue(sheet, check)
      if (actual !== expected && !exceptions.elementos[key])
        failures.push(`${key}: atual=${actual} produção=${expected}`)
      if (actual === expected && exceptions.elementos[key])
        failures.push(`${key}: igual à produção; remova a exceção`)
    }
    expect(failures).toEqual([])
  })

  it('nenhum degradê sem parada inicial (from-*): na produção ele não desenhava, no Tailwind 4 desenha', () => {
    const literals = P.productLiterals(repo, fs, path)
    expect(literals.length).toBeGreaterThan(10_000)
    expect(P.gradientsWithoutFrom(literals)).toEqual([])
  })

  it('nenhum utilitário que o Tailwind 4 removeu (ring-opacity-*, bg-opacity-*…): davam estilo na produção e agora não', () => {
    expect(P.removedInTailwind4(P.productLiterals(repo, fs, path))).toEqual([])
  })

  it('toda exceção tem motivo (8+ caracteres) e ainda está em uso', () => {
    const problems: string[] = []
    for (const [kind, list, used] of [
      ['utilitário', exceptions.utilitarios, plan.bases],
      ['cadeia', exceptions.cadeias, plan.chains],
    ] as const) {
      for (const [name, reason] of Object.entries(list)) {
        if (typeof reason !== 'string' || reason.trim().length < 8)
          problems.push(`${kind} ${name}: sem motivo`)
        if (!used.includes(name))
          problems.push(`${kind} ${name}: não é mais usado; remova a exceção`)
      }
    }
    for (const a of exceptions.foco) {
      if (typeof a.motivo !== 'string' || a.motivo.trim().length < 8)
        problems.push(`foco ${a.passadas.join(', ')}: sem motivo`)
      for (const pass of a.passadas)
        if (!(pass in P.FOCUS_PASSES))
          problems.push(`foco: passada desconhecida ${pass}`)
    }
    const notes = new Set([...variants.values()].flatMap((v) => v.notes))
    for (const [name, reason] of Object.entries(exceptions.notas)) {
      if (reason.trim().length < 8) problems.push(`nota ${name}: sem motivo`)
      if (!notes.has(name))
        problems.push(`nota ${name}: nenhuma cadeia a usa; remova`)
    }
    expect(problems).toEqual([])
  })
})
