import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BASELINE_RULES,
  DEFAULT_TOKEN_CONFIG,
  RATCHET_RULES,
  TAILWIND_ROOTS,
  TAILWIND_STATIC,
  checkTokens,
  classFindings,
  importantClassFindings,
  importantDeclarations,
  loadTokenConfig,
  readBaseline,
  serializeBaseline,
  updateBaseline,
  ZERO_TOLERANCE_RULES,
} from '../../tools/token-check.mjs'
import { guardBaselines } from '../../tools/ratchet-guard.mjs'
import {
  PROPAGATION_LEVELS,
  judgeLevels,
  readExpectations,
} from '../../tools/token-propagation-check.mjs'

type Finding = {
  file: string
  line: number
  rule: string
  property: string | null
  value: string
  ratchet?: { baseline: number; current: number }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(here, '__fixtures__', 'tokens')
const tool = path.resolve(here, '..', '..', 'tools', 'token-check.mjs')

// The canonical source is inside the scanned scope so that its exemption is observable.
const rulesConfig = { ...DEFAULT_TOKEN_CONFIG, scope: ['packages'] }
const rules = checkTokens(path.join(fixtures, 'rules'), rulesConfig, null)
const everything: Finding[] = [
  ...rules.violations.filter((v: Finding) => !v.ratchet),
  ...rules.ratcheted,
]

const found = (file: string, rule: string) =>
  everything
    .filter((v) => v.file === `packages/ui/src/${file}` && v.rule === rule)
    .map((v) => v.value)
    .sort()
const rulesIn = (file: string) =>
  [
    ...new Set(
      everything
        .filter((v) => v.file === `packages/ui/src/${file}`)
        .map((v) => v.rule)
    ),
  ].sort()

describe('token-check rules (fixtures)', () => {
  it('tailwind-palette-class: palette colors under variants, opacity and !, not semantic utilities', () => {
    expect(found('palette.tsx', 'tailwind-palette-class')).toEqual(
      [
        '!text-white',
        '[&_svg]:fill-red-500',
        'bg-orange-600',
        'border-gray-200/50',
        'hover:text-slate-700',
        'md:dark:from-orange-500',
        'ring-offset-blue-950',
        'text-slate-900',
        // Tailwind 4.3.3
        'bg-orange-600/7.5',
        'bg-orange-600/(--alpha)',
        'drop-shadow-orange-600',
        'hover:inset-ring-red-500',
        'inset-shadow-black/10',
        'text-shadow-sky-300',
        'mask-t-from-black',
        'scrollbar-thumb-slate-500',
        'border-bs-zinc-200',
        'dark:accent-mauve-500',
        'caret-mist-600',
        'outline-olive-300/[0.4]',
        'placeholder-taupe-400',
        'stroke-cyan-700!',
      ].sort()
    )
    // `!text-white` and `stroke-cyan-700!` also carry the important modifier (css-important).
    expect(found('palette.tsx', 'css-important')).toEqual(['!text-white', 'stroke-cyan-700!'])
    expect(rulesIn('palette.tsx')).toEqual(['css-important', 'tailwind-palette-class'])
    expect(
      rules.allowed.filter(
        (a: Finding) => a.file === 'packages/ui/src/palette.tsx'
      )
    ).toEqual([
      expect.objectContaining({
        rule: 'tailwind-palette-class',
        value: 'bg-slate-50',
        reason: 'fundo neutro aprovado neste fixture',
      }),
    ])
  })

  it('arbitrary values: lengths and colors are caught; var(), %, time, angle and unitless pass', () => {
    expect(found('arbitrary.tsx', 'arbitrary-dimension')).toEqual(
      [
        '[--gap:12px]',
        'h-[calc(100vh-64px)]',
        'max-w-[calc(100%-2rem)]',
        'md:top-[3.5rem]',
        'w-[123px]',
      ].sort()
    )
    expect(found('arbitrary.tsx', 'arbitrary-color')).toEqual([
      'group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]',
    ])
    // A hex inside brackets was always visible to the absolute rule and stays there, once.
    expect(found('arbitrary.tsx', 'color-literal')).toEqual(['#ea580c'])
    expect(rulesIn('arbitrary.tsx')).toEqual([
      'arbitrary-color',
      'arbitrary-dimension',
      'color-literal',
    ])
  })

  it('z-index-literal: classes, arbitrary values and style objects; layer tokens pass', () => {
    expect(found('layers.tsx', 'z-index-literal')).toEqual(
      [
        '-1',
        '-z-10',
        '20',
        '5',
        'OVERLAY_LAYER = 40',
        '[z-index:30]',
        'hover:z-20',
        'z-50',
        'z-[9999]',
      ].sort()
    )
    expect(rulesIn('layers.tsx')).toEqual(['z-index-literal'])
  })

  it('CSS: HSL triples in custom properties, z-index literals and @apply classes', () => {
    expect(found('theme.css', 'hsl-triple')).toEqual(
      [
        '12 76% 61%',
        '210deg 40% 98% / 50%',
        '24.6 95% 53.1%',
      ].sort()
    )
    expect(found('theme.css', 'z-index-literal')).toEqual(
      ['9999 !important', 'z-10'].sort()
    )
    expect(found('theme.css', 'tailwind-palette-class')).toEqual([
      'border-gray-200',
    ])
    expect(found('theme.css', 'css-important')).toEqual(['z-index: 9999 !important'])
    expect(rulesIn('theme.css')).toEqual([
      'css-important',
      'hsl-triple',
      'tailwind-palette-class',
      'z-index-literal',
    ])
  })

  it('hsl-triple in a style object custom property', () => {
    expect(found('inline-theme.tsx', 'hsl-triple')).toEqual(['24 95% 53%'])
    expect(rulesIn('inline-theme.tsx')).toEqual(['hsl-triple'])
  })

  it('the canonical token source may define triples and layers', () => {
    expect(
      everything.filter((v) => v.file.startsWith('packages/design-tokens/'))
    ).toEqual([])
    // Examined only for css-important, which it does not break.
    expect(rules.examined.css).toBe(2)
  })

  it('without a baseline every ratchet occurrence fails the gate', () => {
    expect(rules.ratchet.baselineFound).toBe(false)
    expect(rules.ratcheted.length).toBeGreaterThan(0)
    for (const v of rules.ratcheted)
      expect(rules.violations).toContainEqual({
        ...v,
        ratchet: expect.objectContaining({ baseline: 0 }),
      })
  })
})

/**
 * `bg-[var(--color-orange-600)]`, `bg-(--color-orange-600)` and `[color:var(--color-orange-600)]` render the same palette
 * color as `bg-orange-600`; the variable spelling used to escape the ratchet (wave 132, finding 145).
 */
describe('tailwind-palette-class through the palette variable', () => {
  it.each([
    'bg-[var(--color-orange-600)]',
    'text-[var(--color-blue-800)]',
    'border-[var(--color-red-200)]',
    'hover:bg-[var(--color-gray-50)]',
    'bg-(--color-orange-600)',
    'bg-[color:var(--color-orange-600)]',
    'bg-(color:--color-orange-600)',
    'bg-[var(--color-orange-600)]/50',
    'text-(--color-slate-700)/[0.4]',
    'ring-[var(--color-white)]',
    'from-(--color-black)',
    'md:dark:border-x-(--color-zinc-950)',
    '[color:var(--color-orange-600)]',
    '[--accent:var(--color-sky-300)]',
    'bg-[var(--color-orange-600,var(--fallback))]',
  ])('counts %s', (token) => {
    expect(classFindings(token)).toEqual([{ rule: 'tailwind-palette-class', value: token }])
  })

  it('keeps a literal fallback visible to the absolute color-literal rule', () => {
    expect(classFindings('bg-[var(--color-orange-600,#fff)]')).toEqual([
      { rule: 'tailwind-palette-class', value: 'bg-[var(--color-orange-600,#fff)]' },
      { rule: 'color-literal', value: '#fff', token: 'bg-[var(--color-orange-600,#fff)]' },
    ])
  })

  it.each([
    'bg-[var(--color-primary)]',
    'bg-(--brand)',
    'text-[var(--muted-foreground)]',
    'bg-[var(--color-orange-650)]',
    // Tailwind 4 reads `bg-[--x]` as the literal value, not as var(--x).
    'bg-[--color-orange-600]',
    '[color:var(--brand)]',
  ])('does not count %s', (token) => {
    expect(classFindings(token).filter((f: { rule: string }) => f.rule === 'tailwind-palette-class')).toEqual([])
  })
})

/**
 * Qualquer valor arbitrário que leia a paleta conta, não só o `var()` sozinho: `--theme()` e `theme()` (que o Tailwind
 * 4.3.3 resolve para o valor da cor), `var()` como fallback, dentro de `color-mix()`, de gradiente ou de sombra, e com o
 * nome da função em maiúsculas, que o CSS aceita (onda 132, achado 145, segunda rodada). As grafias que o Tailwind não
 * transforma em leitura da paleta seguem fora.
 */
describe('tailwind-palette-class wherever an arbitrary value reads the palette', () => {
  const palette = (token: string) =>
    classFindings(token).filter((f: { rule: string }) => f.rule === 'tailwind-palette-class')

  it.each([
    'bg-[--theme(--color-orange-600)]',
    'bg-[--theme(--color-orange-600/50%)]',
    'bg-[theme(colors.orange.600)]',
    'bg-[theme(--color-orange-600)]',
    "bg-[theme('colors.orange.600')]",
    'bg-[theme("--color-orange-600")]',
    'bg-[theme(colors.orange[600])]',
    'bg-[theme(colors.orange-600)]',
    'bg-[theme(colors.orange.600/50%)]',
    'bg-[theme(colors.orange.600_/_50%)]',
    'text-[theme(colors.white)]',
    'bg-[var(--brand,var(--color-orange-600))]',
    'bg-(--brand,var(--color-orange-600))',
    'bg-[color-mix(in_oklab,var(--color-orange-600)_50%,transparent)]',
    'bg-[--alpha(var(--color-orange-600)/50%)]',
    'bg-[linear-gradient(var(--color-orange-600),transparent)]',
    'bg-[VAR(--color-orange-600)]',
    'shadow-[0_0_0_1px_var(--color-orange-600)]',
    '[box-shadow:0_0_0_1px_var(--color-orange-600)]',
    '[--accent:theme(colors.sky.300)]',
    'hover:bg-[var(--brand,var(--color-black))]',
  ])('counts %s', (token) => {
    expect(palette(token)).toEqual([{ rule: 'tailwind-palette-class', value: token }])
  })

  it('keeps the dimension of a shadow that reads the palette in its own ratchet', () => {
    expect(classFindings('shadow-[0_0_0_1px_var(--color-orange-600)]')).toEqual([
      { rule: 'tailwind-palette-class', value: 'shadow-[0_0_0_1px_var(--color-orange-600)]' },
      { rule: 'arbitrary-dimension', value: 'shadow-[0_0_0_1px_var(--color-orange-600)]' },
    ])
  })

  it.each([
    // O Tailwind mantém o sublinhado no nome da variável: var(_--color-orange-600_) não é a paleta.
    'bg-[var(_--color-orange-600_)]',
    'bg-[var(--color-orange-600\\_x)]',
    // THEME() e --theme(colors.…) não são processados; theme() de chave inexistente não gera CSS.
    'bg-[THEME(--color-orange-600)]',
    'bg-[--theme(colors.orange.600)]',
    'bg-[theme(colors.primary)]',
    'bg-[theme(--color-orange-650)]',
    // Texto entre aspas não lê variável; redefinir a variável não é ler a paleta.
    "content-['var(--color-orange-600)']",
    '[--color-orange-600:var(--brand)]',
    'bg-[var(--brand,var(--color-primary))]',
  ])('does not count %s', (token) => {
    expect(palette(token)).toEqual([])
  })
})

const temporaryRoots: string[] = []

function ratchetRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'locadora-token-ratchet-'))
  temporaryRoots.push(root)
  fs.cpSync(path.join(fixtures, 'ratchet'), root, { recursive: true })
  return root
}

const cli = (root: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [tool, '--root', root, ...args], {
    encoding: 'utf8',
  })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

const card = (root: string) =>
  path.join(root, 'packages', 'ui', 'src', 'Card.tsx')
const baselineFile = (root: string) =>
  path.join(root, 'tools', 'token-baseline.json')
const edit = (file: string, from: string, to: string) => {
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes(from)) throw new Error(`fixture edit: ${from} not found`)
  fs.writeFileSync(file, text.replace(from, to))
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('token-check ratchet (tools/token-baseline.json)', () => {
  it('records counts per file and rule and passes at the baseline', () => {
    const root = ratchetRoot()
    expect(cli(root).status).toBe(1)
    const init = cli(root, '--init-baseline')
    expect(init.status).toBe(0)
    expect(readBaseline(baselineFile(root))).toEqual({
      files: {
        'packages/ui/src/Card.tsx': {
          'tailwind-palette-class': 2,
          'z-index-literal': 1,
        },
        'packages/ui/src/theme.css': { 'hsl-triple': 1 },
      },
    })
    const pass = cli(root)
    expect(pass.status).toBe(0)
    expect(pass.out).toContain('token gate passed')
  })

  it('fails when a file goes above its count and names the file, rule and counts', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    edit(card(root), 'className="text-slate-700"', 'className="text-slate-700 bg-orange-600"')
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain(
      'RATCHET increase packages/ui/src/Card.tsx tailwind-palette-class: baseline 2, now 3'
    )
    expect(result.out).toContain('bg-orange-600 (catraca: 3 > baseline 2)')
  })

  it('counts the palette read through its variable like the palette class: respelling never lowers the count', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    // Both spellings render `color: var(--color-slate-700)`; the variable one used to drop out of the count.
    edit(card(root), 'className="text-slate-700"', 'className="text-[var(--color-slate-700)]"')
    edit(card(root), ' bg-white', ' bg-(--color-white)')
    const respelled = cli(root)
    expect(respelled.status).toBe(0)
    expect(respelled.out).not.toContain('below baseline')
    expect(cli(root, '--update-baseline').out).toContain('nada diminuiu')
    edit(
      card(root),
      'className="text-[var(--color-slate-700)]"',
      'className="text-[var(--color-slate-700)] border-[var(--color-gray-200)]"'
    )
    const grown = cli(root)
    expect(grown.status).toBe(1)
    expect(grown.out).toContain(
      'RATCHET increase packages/ui/src/Card.tsx tailwind-palette-class: baseline 2, now 3'
    )
    expect(grown.out).toContain('border-[var(--color-gray-200)] (catraca: 3 > baseline 2)')
  })

  it('counts theme(), --theme() and a palette fallback like the palette class: no respelling lowers the count', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    edit(card(root), 'className="text-slate-700"', 'className="text-[theme(colors.slate.700)]"')
    edit(card(root), ' bg-white', ' bg-[--theme(--color-white)]')
    const respelled = cli(root)
    expect(respelled.status).toBe(0)
    expect(respelled.out).not.toContain('below baseline')
    edit(
      card(root),
      'className="text-[theme(colors.slate.700)]"',
      'className="text-[theme(colors.slate.700)] border-[color-mix(in_oklab,var(--brand,var(--color-gray-200))_50%,transparent)]"'
    )
    const grown = cli(root)
    expect(grown.status).toBe(1)
    expect(grown.out).toContain(
      'RATCHET increase packages/ui/src/Card.tsx tailwind-palette-class: baseline 2, now 3'
    )
  })

  it('fails for a new file with a ratchet violation', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    fs.writeFileSync(
      path.join(root, 'packages', 'ui', 'src', 'Novo.tsx'),
      'export const layer = "z-50";\n'
    )
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain(
      'RATCHET new file packages/ui/src/Novo.tsx z-index-literal: baseline 0, now 1'
    )
  })

  it('passes a reduction; --update-baseline locks it in and the lower count then holds', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    edit(card(root), ' bg-white', '')
    const reduced = cli(root)
    expect(reduced.status).toBe(0)
    expect(reduced.out).toContain('1 file/rule pair(s) below baseline')

    const update = cli(root, '--update-baseline')
    expect(update.status).toBe(0)
    expect(update.out).toContain(
      'lowered packages/ui/src/Card.tsx tailwind-palette-class: 2 -> 1'
    )
    expect(
      readBaseline(baselineFile(root))?.files['packages/ui/src/Card.tsx']
    ).toEqual({ 'tailwind-palette-class': 1, 'z-index-literal': 1 })

    edit(card(root), 'rounded-md', 'rounded-md bg-white')
    expect(cli(root).status).toBe(1)
  })

  it('--update-baseline refuses any increase and leaves the baseline untouched', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    const before = fs.readFileSync(baselineFile(root), 'utf8')
    // A reduction elsewhere does not buy an increase.
    edit(card(root), ' bg-white', '')
    fs.writeFileSync(
      path.join(root, 'packages', 'ui', 'src', 'theme.css'),
      ':root {\n  --brand: 24.6 95% 53.1%;\n  --ring: 0 0% 3.9%;\n}\n'
    )
    const update = cli(root, '--update-baseline')
    expect(update.status).toBe(1)
    expect(update.out).toContain('baseline not written: recusado')
    expect(update.out).toContain(
      'increase packages/ui/src/theme.css hsl-triple: 1 -> 2'
    )
    expect(fs.readFileSync(baselineFile(root), 'utf8')).toBe(before)
    expect(
      updateBaseline(root, undefined, { init: true })
    ).toMatchObject({ written: false })
    expect(fs.readFileSync(baselineFile(root), 'utf8')).toBe(before)
  })

  it('absolute rules are never absorbed by the baseline', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    edit(card(root), 'className="text-slate-700"', 'className="text-slate-700" style={{ color: "#ea580c" }}')
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain('TOKEN color-literal packages/ui/src/Card.tsx')
    expect(cli(root, '--update-baseline').status).toBe(0)
    expect(fs.readFileSync(baselineFile(root), 'utf8')).not.toContain(
      'color-literal'
    )
    expect(cli(root).status).toBe(1)

    const forged = baselineFile(root)
    fs.writeFileSync(
      forged,
      JSON.stringify({ files: { 'packages/ui/src/Card.tsx': { 'color-literal': 1 } } })
    )
    expect(() => readBaseline(forged)).toThrow(/not a ratchet rule/)
    expect(RATCHET_RULES).not.toContain('color-literal')
  })
})

describe('tailwind-palette-class against the Tailwind 4.3.3 design system', () => {
  type DesignSystem = {
    theme: { namespace: (_name: string) => Map<string, unknown> }
    getClassList: () => [string, unknown][]
    candidatesToCss: (_classes: string[]) => (string | null)[]
  }

  const loadTailwind = async () => {
    const require = createRequire(import.meta.url)
    const dir = path.dirname(require.resolve('tailwindcss/package.json'))
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version
    const tw = await import(pathToFileURL(path.join(dir, 'dist', 'lib.mjs')).href)
    const ds: DesignSystem = await tw.__unstable__loadDesignSystem('@import "tailwindcss";', {
      base: dir,
      loadStylesheet: async (id: string, base: string) => {
        const file = id === 'tailwindcss' ? path.join(dir, 'index.css') : path.resolve(base, id)
        return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') }
      },
    })
    return { version, ds }
  }
  const flagged = (token: string) =>
    classFindings(token).some((f: Finding) => f.rule === 'tailwind-palette-class')

  it('flags exactly the classes whose CSS reads a default palette color', async () => {
    const { version, ds } = await loadTailwind()
    expect(version).toBe('4.3.3')
    const colors = [...ds.theme.namespace('--color').keys()]
    expect(colors).toHaveLength(288)
    const readsPalette = new RegExp(`var\\(--color-(?:${colors.join('|')})\\)`)
    const classes = ds.getClassList().map(([name]) => name)
    const css = ds.candidatesToCss(classes)
    const palette = classes.filter((_, i) => readsPalette.test(css[i] ?? ''))
    expect(palette.length).toBeGreaterThan(14000)
    expect(palette.filter((c) => !flagged(c))).toEqual([])
    expect(classes.filter((c, i) => !readsPalette.test(css[i] ?? '') && flagged(c))).toEqual([])
  })

  it('flags opacity modifiers, variants and ! that Tailwind 4.3.3 renders for every color utility', async () => {
    const { ds } = await loadTailwind()
    const utilities = [
      ...new Set(
        ds
          .getClassList()
          .map(([name]) => name)
          .filter((c) => c.endsWith('-orange-600'))
          .map((c) => c.slice(0, -'-orange-600'.length))
      ),
    ]
    expect(utilities).toEqual(expect.arrayContaining(['drop-shadow', 'inset-ring', 'inset-shadow', 'text-shadow', 'mask-t-from', 'scrollbar-thumb', 'border-bs']))
    const forms = utilities.flatMap((u) => [
      `${u}-orange-600/7.5`,
      `${u}-orange-600/(--alpha)`,
      `${u}-black/[0.3]`,
      `hover:dark:${u}-mauve-50`,
      `${u}-white!`,
      `[&_svg]:${u}-taupe-950/50`,
    ])
    const css = ds.candidatesToCss(forms)
    expect(forms.filter((_, i) => !css[i])).toEqual([])
    expect(forms.filter((c) => !flagged(c))).toEqual([])
  })

  it('flags the palette read through its variable in every color utility, exactly when the CSS reads it', async () => {
    const { ds } = await loadTailwind()
    const utilities = [
      ...new Set(
        ds
          .getClassList()
          .map(([name]) => name)
          .filter((c) => c.endsWith('-orange-600'))
          .map((c) => c.slice(0, -'-orange-600'.length))
      ),
    ]
    const spellings = utilities.flatMap((u) => [
      `${u}-[var(--color-orange-600)]`,
      `${u}-(--color-orange-600)`,
      `${u}-[color:var(--color-white)]`,
      `${u}-(color:--color-black)`,
      `[&_svg]:${u}-[var(--color-taupe-950,var(--x))]`,
    ])
    // Every utility renders the variable spellings (the bracket, the Tailwind 4 shorthand and the type hint).
    const spellingsCss = ds.candidatesToCss(spellings)
    expect(spellings.filter((_, i) => !spellingsCss[i])).toEqual([])
    const forms = [
      ...spellings,
      ...utilities.flatMap((u) => [
        `${u}-[var(--color-black)]/50`,
        `hover:${u}-(--color-mauve-50)/[0.3]`,
        `${u}-[var(--brand)]`,
        `${u}-(--brand)`,
        `${u}-[var(--color-orange-650)]`,
      ]),
      '[color:var(--color-orange-600)]',
      '[--accent:var(--color-sky-300)]',
      '[color:var(--brand)]',
    ]
    const css = ds.candidatesToCss(forms)
    const readsPalette = /var\(--color-(?:(?:slate|gray|zinc|neutral|stone|mauve|mist|olive|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|white|black)[,)]/
    const rendered = forms.filter((_, i) => css[i])
    const palette = rendered.filter((c) => readsPalette.test(css[forms.indexOf(c)]!))
    expect(palette.length).toBeGreaterThan(5 * utilities.length)
    expect(palette.filter((c) => !flagged(c))).toEqual([])
    expect(rendered.filter((c) => !palette.includes(c) && flagged(c))).toEqual([])
  })

  it('flags every arbitrary value whose CSS reads a palette color (var, theme, --theme, fallback, mix) and nothing else', async () => {
    const { ds } = await loadTailwind()
    const utilities = [
      ...new Set(
        ds
          .getClassList()
          .map(([name]) => name)
          .filter((c) => c.endsWith('-orange-600'))
          .map((c) => c.slice(0, -'-orange-600'.length))
      ),
    ]
    const values = [
      '[--theme(--color-orange-600)]',
      '[--theme(--color-orange-600/50%)]',
      '[theme(colors.orange.600)]',
      '[theme(--color-orange-600)]',
      "[theme('colors.orange.600')]",
      '[theme("--color-orange-600")]',
      '[theme(colors.orange[600])]',
      '[theme(colors.orange-600)]',
      '[theme(colors.orange.600/50%)]',
      '[theme(colors.orange.600_/_50%)]',
      '[theme(colors.white)]',
      '[var(--brand,var(--color-orange-600))]',
      '(--brand,var(--color-black))',
      '[color-mix(in_oklab,var(--color-orange-600)_50%,transparent)]',
      '[--alpha(var(--color-orange-600)/50%)]',
      '[VAR(--color-orange-600)]',
      '[var(_--color-orange-600_)]',
      '[var(--color-orange-600\\_x)]',
      '[var(--color-Orange-600)]',
      '[THEME(--color-orange-600)]',
      '[--theme(colors.orange.600)]',
      '[theme(colors.primary)]',
      '[theme(--color-orange-650)]',
      '[var(--brand,var(--color-primary))]',
      "['var(--color-orange-600)']",
    ]
    const forms = [
      ...utilities.flatMap((u) => values.map((v) => `${u}-${v}`)),
      'bg-[linear-gradient(var(--color-orange-600),transparent)]',
      'shadow-[0_0_0_1px_var(--color-orange-600)]',
      '[box-shadow:0_0_0_1px_var(--color-orange-600)]',
      '[mask-image:linear-gradient(var(--color-black),transparent)]',
      '[--accent:theme(colors.sky.300)]',
      'text-[length:var(--color-orange-600)]',
      "content-['var(--color-orange-600)']",
      '[--color-orange-600:var(--brand)]',
    ]
    const hues = 'slate|gray|zinc|neutral|stone|mauve|mist|olive|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
    const paletteKey = new RegExp(`^(?:(?:${hues})-(?:50|[1-9]00|950)|white|black)$`)
    const colors = ds.theme.namespace('--color') as Map<string, string>
    const paletteValues = [...colors].filter(([key]) => paletteKey.test(key)).map(([, value]) => value)
    expect(paletteValues).toHaveLength(288)
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // The CSS reads the palette through its variable (CSS function names ignore case) or through its resolved value.
    const readsPalette = new RegExp(
      `[vV][aA][rR]\\(--color-(?:(?:${hues})-(?:50|[1-9]00|950)|white|black)[,)]|(?<![\\w#])(?:${paletteValues.map(escape).join('|')})(?![\\w%.])`
    )
    // Declarations only: @property defaults (#fff, 0 0 #0000) and quoted strings are not color reads.
    const declarations = (css: string) =>
      css.replace(/@property[^{]*\{[^}]*\}/g, '').replace(/'[^']*'|"[^"]*"/g, "''")
    const css = ds.candidatesToCss(forms)
    const rendered = forms.filter((_, i) => css[i])
    const palette = rendered.filter((c) => readsPalette.test(declarations(css[forms.indexOf(c)]!)))
    expect(palette.length).toBeGreaterThan(14 * utilities.length)
    expect(rendered.length - palette.length).toBeGreaterThan(5 * utilities.length)
    expect(palette.filter((c) => !flagged(c))).toEqual([])
    expect(rendered.filter((c) => !palette.includes(c) && flagged(c))).toEqual([])
  })

  it('css-important knows every Tailwind 4.3.3 utility and flags each one only with the important modifier', async () => {
    const { ds } = await loadTailwind()
    const classes = ds.getClassList().map(([name]) => name)
    const roots = new Set<string>()
    const statics = new Set<string>()
    for (const name of classes) {
      const core = name.replace(/^-/, '')
      if (core.includes('-')) roots.add(core.split('-')[0]!)
      else statics.add(core)
    }
    // The embedded lists are exactly the design system's: a new or removed utility fails here.
    expect([...TAILWIND_ROOTS].sort()).toEqual([...roots].sort())
    expect([...TAILWIND_STATIC].sort()).toEqual([...statics].sort())
    // Every important form Tailwind renders is flagged in a string made only of classes, with no class context.
    const forms = (name: string) => [`!${name}`, `${name}!`, `hover:!${name}`, `[&_svg]:${name}!`]
    expect(ds.candidatesToCss(forms('bg-orange-600')).every(Boolean)).toBe(true)
    expect(
      classes.filter((name) => forms(name).some((form) => importantClassFindings(`px-4 ${form}`).length !== 1))
    ).toEqual([])
    expect(classes.filter((name) => importantClassFindings(`px-4 ${name}`).length)).toEqual([])
  })
})

describe('css-important (tools/token-check.mjs)', () => {
  const importantConfig = { ...DEFAULT_TOKEN_CONFIG, scope: ['packages'] }
  const report = checkTokens(path.join(fixtures, 'important'), importantConfig, null)
  const importantFindings = [...report.violations.filter((v: Finding) => !v.ratchet), ...report.ratcheted]
  const valuesIn = (file: string) =>
    importantFindings
      .filter((v: Finding) => v.file === file)
      .map((v: Finding) => `${v.line}: ${v.value}`)

  it('is a zero-tolerance rule: never ratcheted, listed in the baseline with no count', () => {
    expect(ZERO_TOLERANCE_RULES).toEqual(['css-important'])
    expect(RATCHET_RULES).not.toContain('css-important')
    expect(BASELINE_RULES).toEqual([...RATCHET_RULES, 'css-important'])
    const baseline = JSON.parse(
      fs.readFileSync(path.resolve(here, '..', '..', 'tools', 'token-baseline.json'), 'utf8')
    )
    expect(baseline.rules).toContain('css-important')
    expect(baseline.totals['css-important']).toBeUndefined()
    expect(
      Object.entries(baseline.files as Record<string, Record<string, number>>)
        .filter(([, counts]) => 'css-important' in counts)
        .map(([file]) => file)
    ).toEqual([])
    // Every finding of the fixture is a violation of its own, never a ratchet entry.
    expect(report.ratcheted.filter((v: Finding) => v.rule === 'css-important')).toEqual([])
    expect(report.violations.filter((v: Finding) => v.rule === 'css-important' && v.ratchet)).toEqual([])
    expect(report.zeroTolerance).toEqual({ 'css-important': importantFindings.length })
  })

  it('code: the Tailwind modifier in class contexts, inline style, CSS-in-JS and setProperty', () => {
    expect(valuesIn('packages/ui/src/important.tsx')).toEqual([
      '11: !bg-card',
      '11: hover:!text-primary',
      '12: md:!p-2',
      '12: !mt-0',
      '13: gap-2!',
      '14: ![position:static]',
      // A custom utility counts in a class context only (line 61 holds the same string outside one).
      '15: !glass-panel',
      '20: !rounded-md',
      '21: !h-8',
      '25: !bg-primary',
      '28: var(--foreground) !important',
      '29: display: none !important',
      '31: setProperty("overflow", …, "important")',
      '32: top: __expr__ px ! important',
      // Reduced motion is no exception, a block split by a substitution included.
      '36: animation: none !important',
      '36: transition: __expr__ !important',
      // The allow comment on this line does not exempt it.
      '39: gap: 0 !important',
    ])
    expect(new Set(importantFindings.map((v: Finding) => v.rule))).toEqual(new Set(['css-important']))
    expect(report.allowed).toEqual([])
  })

  it('stylesheets: declarations, @import … important and @apply, reduced-motion blocks included (no exception)', () => {
    expect(valuesIn('packages/ui/src/important.css')).toEqual([
      '2: @import "tailwindcss" important;',
      '5: color: var(--foreground) !important',
      '6: margin: 0 ! important',
      '10: @apply !bg-card hover:bg-muted! font-medium !important',
      '17: animation: none !important',
      '18: transition-duration: 0s !important',
      '22: transform: none !important',
      '33: animation-play-state: running !important',
      '39: opacity: 1 !important',
      '10: !bg-card',
      '10: hover:bg-muted!',
      '26: !animate-none',
    ])
  })

  it('preprocessor stylesheets are read for css-important only, without their // comments', () => {
    expect(valuesIn('packages/ui/src/important.scss')).toEqual([
      '5: color: $brand !important',
      '7: background: url(https://cdn.example/a.png) !important',
      '10: text-decoration: none !important',
    ])
  })

  it('the canonical token source may define tokens but not !important', () => {
    expect(valuesIn('packages/design-tokens/src/theme.css')).toEqual([
      '8: color: hsl(var(--brand)) !important',
    ])
    expect(valuesIn('packages/design-tokens/src/tokens.ts')).toEqual(['3: var(--brand) !important'])
    expect(report.examined).toEqual({ code: 2, css: 3 })
    // As in the real config, the canonical source is outside the scope and is still read for css-important.
    expect(DEFAULT_TOKEN_CONFIG.scope).not.toContain(DEFAULT_TOKEN_CONFIG.canonical[0])
    const apart = checkTokens(path.join(fixtures, 'important'), { ...DEFAULT_TOKEN_CONFIG, scope: ['packages/ui/src'] }, null)
    expect(
      apart.violations.filter((v: Finding) => v.file.startsWith('packages/design-tokens/')).map((v: Finding) => v.value)
    ).toEqual(['color: hsl(var(--brand)) !important', 'var(--brand) !important'])
    expect(apart.ratcheted.filter((v: Finding) => v.file.startsWith('packages/design-tokens/'))).toEqual([])
  })

  it('never flags interface text, comparisons, JS negation or loose words', () => {
    for (const text of [
      'Sucesso!',
      'Link copiado!',
      'copiada!',
      'ok!',
      'Voltamos em breve!',
      'Olá! Precisa de ajuda?',
      'Atenção: salvo!',
      'Endereço salvo com sucesso!',
    ]) {
      expect(importantClassFindings(text)).toEqual([])
      expect(importantDeclarations(text)).toEqual([])
    }
    expect(importantDeclarations('.important { content: "importante" } /* sem prioridade */')).toEqual([])
    // A class context accepts custom utilities, but still needs a class-shaped token.
    expect(importantClassFindings('!scrollbar-hide Sucesso!', { classContext: true })).toEqual([
      { rule: 'css-important', value: '!scrollbar-hide' },
    ])
    expect(importantClassFindings('!scrollbar-hide Sucesso!')).toEqual([])
  })

  it('reduced motion is no exception: every block counts, nested ones included', () => {
    const css = [
      '@media (prefers-reduced-motion: reduce) { .a { b: c !important } @supports (x: y) { .d { e: f !important } } }',
      '.g { h: i !important }',
      '@media screen and (prefers-reduced-motion: reduce) { .j { k: l !important } }',
      '@media not (prefers-reduced-motion: reduce) { .m { n: o !important } }',
      '@media (prefers-reduced-motion: no-preference) { .p { q: r !important } }',
    ].join('\n')
    expect(importantDeclarations(css).map((hit: { value: string }) => hit.value)).toEqual([
      'b: c !important',
      'e: f !important',
      'h: i !important',
      'k: l !important',
      'n: o !important',
      'q: r !important',
    ])
  })

  it('a single !important fails the gate on its own, and no baseline update absorbs it', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    expect(cli(root).out).toContain('zero tolerance (every scope, no baseline): css-important 0')
    edit(card(root), 'className="text-slate-700"', 'className="text-slate-700 !p-4"')
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toMatch(/^TOKEN css-important packages\/ui\/src\/Card\.tsx:\d+:\d+ className !p-4$/m)
    expect(result.out).not.toContain('RATCHET')
    expect(result.out).toContain('zero tolerance (every scope, no baseline): css-important 1')
    const before = fs.readFileSync(baselineFile(root), 'utf8')
    cli(root, '--update-baseline')
    updateBaseline(root, undefined, { init: true })
    expect(fs.readFileSync(baselineFile(root), 'utf8')).toBe(before)
    expect(cli(root).status).toBe(1)

    // A new stylesheet with one declaration fails too (no "new file" allowance).
    edit(card(root), 'className="text-slate-700 !p-4"', 'className="text-slate-700"')
    expect(cli(root).status).toBe(0)
    fs.writeFileSync(
      path.join(root, 'packages', 'ui', 'src', 'overrides.css'),
      '.card { color: var(--foreground) !important; }\n'
    )
    const css = cli(root)
    expect(css.status).toBe(1)
    expect(css.out).toContain(
      'TOKEN css-important packages/ui/src/overrides.css:1:1 !important color: var(--foreground) !important'
    )
    // No exception, not even a reduced-motion block.
    fs.writeFileSync(
      path.join(root, 'packages', 'ui', 'src', 'overrides.css'),
      '@media (prefers-reduced-motion: reduce) {\n  .card { animation: none !important; }\n}\n'
    )
    const reduced = cli(root)
    expect(reduced.status).toBe(1)
    expect(reduced.out).toContain(
      'TOKEN css-important packages/ui/src/overrides.css:2:1 !important animation: none !important'
    )
  })

  it('the baseline refuses any css-important count, in the product scope and in the legacy root', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    const file = baselineFile(root)
    const forge = (files: object) => fs.writeFileSync(file, JSON.stringify({ files }))
    forge({ 'packages/ui/src/Card.tsx': { 'css-important': 1 } })
    expect(() => readBaseline(file)).toThrow(/"css-important", a zero-tolerance rule/)
    expect(cli(root).status).toBe(1)
    forge({ 'app/page.tsx': { 'css-important': 1 } })
    expect(() => readBaseline(file, { legacyScope: ['app'] })).toThrow(/zero-tolerance/)
    // The serialized baseline keeps the rule listed, with no entry and no total.
    const written = JSON.parse(serializeBaseline({ 'packages/ui/src/Card.tsx': { 'z-index-literal': 1 } }))
    expect(written.rules).toEqual(BASELINE_RULES)
    expect(written.totals).not.toHaveProperty('css-important')
  })

  it('the ratchet guard still reports css-important dropped from the baseline rules', () => {
    const spec = (base: object, tree: object) => ({
      name: 'tokens',
      file: 'tools/token-baseline.json',
      baseText: JSON.stringify(base),
      treeText: JSON.stringify(tree),
      treeErrors: [],
    })
    const base = { rules: [...BASELINE_RULES], files: {} }
    const kept = guardBaselines({
      baselines: [spec(base, { rules: [...BASELINE_RULES], files: {} })],
      transfers: [],
      measureBase: () => ({ tokens: {} }),
    })
    expect(kept.ok).toBe(true)
    const dropped = guardBaselines({
      baselines: [spec(base, { rules: [...RATCHET_RULES], files: {} })],
      transfers: [],
      measureBase: () => ({ tokens: {} }),
    })
    expect(dropped.ok).toBe(false)
    expect(dropped.results[0]!.problems.join('\n')).toContain('rule css-important is ratcheted at the base but missing')
  })
})

describe('css-important in the Tailwind JS config and plugins', () => {
  const tailwindConfig = { ...DEFAULT_TOKEN_CONFIG, scope: ['packages/ui/src'] }
  const tailwindRoot = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'locadora-token-tailwind-'))
    temporaryRoots.push(root)
    fs.cpSync(path.join(fixtures, 'tailwind-config'), root, { recursive: true })
    return root
  }
  const important = (report: { violations: Finding[] }) =>
    report.violations
      .filter((v) => v.rule === 'css-important')
      .map((v) => `${v.file}:${v.line} ${v.property} ${v.value}`)

  it('reads the config a stylesheet loads (@config), its local plugins (require) and @plugin files, out of scope', () => {
    const report = checkTokens(path.join(fixtures, 'tailwind-config'), tailwindConfig, null)
    expect(
      [...report.tailwind].sort((a: { file: string }, b: { file: string }) => a.file.localeCompare(b.file))
    ).toEqual([
      { file: 'tailwind.config.cjs', kind: 'config' },
      { file: 'tailwind/base-plugin.cjs', kind: 'plugin' },
      { file: 'tailwind/compat.cjs', kind: 'plugin' },
    ])
    // `important: true` makes every utility !important; a color named "important" in theme is not the option.
    expect(important(report).sort()).toEqual([
      'tailwind.config.cjs:3 important important: true',
      'tailwind/base-plugin.cjs:3 style 0 !important',
      'tailwind/compat.cjs:3 style none !important',
    ])
  })

  it('a selector string is the option too; only the literal false passes; the CLI fails on the config alone', () => {
    const root = tailwindRoot()
    for (const plugin of ['base-plugin.cjs', 'compat.cjs']) edit(path.join(root, 'tailwind', plugin), ' !important', '')
    const config = path.join(root, 'tailwind.config.cjs')
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain('TOKEN css-important tailwind.config.cjs:3:3 important important: true')
    expect(result.out).toContain('tailwind JS read for css-important: tailwind.config.cjs (config)')

    edit(config, 'important: true', "important: '#app'")
    expect(important(checkTokens(root, tailwindConfig, null))).toEqual([
      "tailwind.config.cjs:3 important important: '#app'",
    ])
    edit(config, "important: '#app'", 'important: false')
    expect(important(checkTokens(root, tailwindConfig, null))).toEqual([])
    expect(cli(root).status).toBe(0)
  })

  it('the real stylesheet entry loads the root tailwind.config.cjs, which has no important option', () => {
    const repository = path.resolve(here, '..', '..')
    const report = checkTokens(
      repository,
      { ...DEFAULT_TOKEN_CONFIG, scope: ['packages/frontend/src/app/styles'], legacyScope: [], canonical: [] },
      null
    )
    expect(report.tailwind).toContainEqual({ file: 'tailwind.config.cjs', kind: 'config' })
    expect(important(report)).toEqual([])
  })
})

describe('jsx-text-escape (JavaScript escapes that JSX shows literally)', () => {
  const escapesConfig = { ...DEFAULT_TOKEN_CONFIG, scope: ['packages/ui/src'], legacyScope: ['app'] }
  const report = checkTokens(path.join(fixtures, 'escapes'), escapesConfig, null)

  it('is an absolute rule of the product scope', () => {
    expect(RATCHET_RULES).not.toContain('jsx-text-escape')
    expect(ZERO_TOLERANCE_RULES).not.toContain('jsx-text-escape')
  })

  it('flags JSX text and JSX attribute strings, never JavaScript strings, pattern, comments or real characters', () => {
    expect(
      report.violations
        .filter((v: Finding) => v.rule === 'jsx-text-escape')
        .map((v: Finding) => `${v.file}:${v.line} ${v.property} ${v.value}`)
    ).toEqual([
      'packages/ui/src/Escapes.tsx:6 title \\u00f3',
      'packages/ui/src/Escapes.tsx:6 aria-label \\u00e7',
      'packages/ui/src/Escapes.tsx:7 JSX text \\u00e7',
      'packages/ui/src/Escapes.tsx:8 data-hint \\u{e7}',
      'packages/ui/src/Escapes.tsx:8 JSX text \\xe7',
    ])
    expect(report.violations.filter((v: Finding) => v.rule !== 'jsx-text-escape')).toEqual([])
  })

  it('does not apply to the legacy root', () => {
    expect(report.ratcheted.filter((v: Finding) => v.file === 'app/Legado.tsx')).toEqual([])
    expect(report.violations.filter((v: Finding) => v.file === 'app/Legado.tsx')).toEqual([])
  })
})

describe('token-check legacy scope (app/, lib/, proxy.ts)', () => {
  const legacyFixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'locadora-token-legacy-'))
    temporaryRoots.push(root)
    fs.cpSync(path.join(fixtures, 'legacy'), root, { recursive: true })
    return root
  }
  const legacyConfig = {
    ...DEFAULT_TOKEN_CONFIG,
    scope: ['packages/ui/src'],
    legacyScope: ['app', 'lib', 'proxy.ts'],
  }

  it('the real config covers the legacy root with code', () => {
    expect(DEFAULT_TOKEN_CONFIG.legacyScope).toEqual(
      expect.arrayContaining(['app', 'lib', 'proxy.ts'])
    )
  })

  it('the legacy scope is the legacy root with code of arch.config.json: a root the architecture gate retires is not legacy here', () => {
    const repoRoot = path.resolve(here, '..', '..')
    const arch = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'arch.config.json'), 'utf8')
    ) as { legacyRoots: Array<{ path: string; runtime: string }> }
    const withCode = arch.legacyRoots
      .filter(
        (entry) =>
          !['browser-assets', 'generated-token-compatibility'].includes(
            entry.runtime
          )
      )
      .map((entry) => entry.path)
    // A pasta que o arch.config.json deixa de declarar (stores/, instrumentation.ts) sai daqui também: recriada,
    // o arch-check a reprova como raiz não classificada, e o token-check não pode tratá-la como legado.
    expect(loadTokenConfig(repoRoot).legacyScope).toEqual(withCode)
    expect(DEFAULT_TOKEN_CONFIG.legacyScope).toEqual(withCode)
  })

  it('ratchets every rule found there, absolute ones included, per file', () => {
    const report = checkTokens(path.join(fixtures, 'legacy'), legacyConfig, null)
    expect(report.ratchet.counts).toEqual({
      'app/page.tsx': {
        'tailwind-palette-class': 1,
        'color-literal': 1,
        'dimension-literal': 1,
      },
      'lib/email.ts': { 'color-literal': 1 },
      'packages/ui/src/Badge.tsx': { 'tailwind-palette-class': 2 },
      'proxy.ts': { 'color-literal': 1 },
    })
    // Without a baseline every occurrence fails, and all of them as ratchet increases.
    expect(report.violations.filter((v: Finding) => !v.ratchet)).toEqual([])
    expect(report.violations).toHaveLength(7)
  })

  it('moving a file with debt from packages/ui into app/ is a new file, not a reduction', () => {
    const root = legacyFixture()
    expect(cli(root, '--init-baseline').status).toBe(0)
    expect(cli(root).status).toBe(0)
    fs.renameSync(
      path.join(root, 'packages', 'ui', 'src', 'Badge.tsx'),
      path.join(root, 'app', 'Badge.tsx')
    )
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain(
      'RATCHET new file app/Badge.tsx tailwind-palette-class: baseline 0, now 2'
    )
    // --update-baseline locks the reduction but cannot admit the moved file.
    expect(cli(root, '--update-baseline').status).toBe(1)
  })

  it('css-important is a violation in the legacy root too, never a ratchet entry', () => {
    const root = legacyFixture()
    fs.writeFileSync(path.join(root, 'app', 'estilo.css'), '.faixa {\n  display: none !important;\n}\n')
    fs.writeFileSync(path.join(root, 'lib', 'estilo.ts'), "export const escondido = 'display: none !important'\n")
    const report = checkTokens(root, legacyConfig, null)
    expect(
      report.violations
        .filter((v: Finding) => v.rule === 'css-important')
        .map((v: Finding) => [v.file, v.value, Boolean(v.ratchet)])
    ).toEqual([
      ['app/estilo.css', 'display: none !important', false],
      ['lib/estilo.ts', 'display: none !important', false],
    ])
    expect(report.ratchet.counts['app/estilo.css']).toBeUndefined()
    expect(report.ratchet.counts['lib/estilo.ts']).toBeUndefined()
  })

  it('a new legacy file with an absolute finding fails; the baseline may hold absolute rules only there', () => {
    const root = legacyFixture()
    expect(cli(root, '--init-baseline').status).toBe(0)
    fs.writeFileSync(path.join(root, 'lib', 'novo.ts'), 'export const fundo = "#000000";\n')
    const result = cli(root)
    expect(result.status).toBe(1)
    expect(result.out).toContain('RATCHET new file lib/novo.ts color-literal: baseline 0, now 1')

    const forged = baselineFile(root)
    fs.writeFileSync(
      forged,
      JSON.stringify({ files: { 'packages/ui/src/Badge.tsx': { 'color-literal': 1 } } })
    )
    expect(() => readBaseline(forged, legacyConfig)).toThrow(/not a ratchet rule/)
    fs.writeFileSync(forged, JSON.stringify({ files: { 'lib/email.ts': { 'color-literal': 1 } } }))
    expect(readBaseline(forged, legacyConfig)).toEqual({
      files: { 'lib/email.ts': { 'color-literal': 1 } },
    })
  })
})

describe('token-check baseline totals', () => {
  it('declared totals must match the sum of the entries', () => {
    const root = ratchetRoot()
    expect(cli(root, '--init-baseline').status).toBe(0)
    const file = baselineFile(root)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(data.totals['z-index-literal']).toBe(1)
    data.totals['z-index-literal'] = 5
    fs.writeFileSync(file, JSON.stringify(data))
    expect(() => readBaseline(file)).toThrow(/declared z-index-literal total 5 differs/)
    expect(cli(root).status).not.toBe(0)
  })
})

describe('check:tokens verdict (tools/token-propagation-expectations.json)', () => {
  const measured = (overrides: Record<string, boolean> = {}): [string, boolean][] =>
    Object.entries({
      'tokens.ts unchanged': true,
      'alias to the temporary copy': true,
      'style resolution (native)': true,
      'style resolution (web)': false,
      'web render': false,
      ...overrides,
    })
  const expected = { 'style resolution (web)': 'classes Tailwind literais', 'web render': 'não executado' }
  const verdictOf = (levels: [string, boolean][], notProven: Record<string, string>) =>
    judgeLevels(levels, notProven)

  it('passes when every not-proven level is listed with a reason and every other level is proven', () => {
    const result = verdictOf(measured(), expected)
    expect(result.ok).toBe(true)
    expect(result.verdicts.map((v: { verdict: string }) => v.verdict)).toEqual(['ok', 'ok', 'ok', 'expected', 'expected'])
  })

  it('fails a proven level that regresses and a listed level that became proven', () => {
    const regression = verdictOf(measured({ 'style resolution (native)': false }), expected)
    expect(regression.ok).toBe(false)
    expect(regression.verdicts.find((v: { name: string }) => v.name === 'style resolution (native)')?.verdict).toBe('regression')
    const nowProven = verdictOf(measured({ 'web render': true }), expected)
    expect(nowProven.ok).toBe(false)
    expect(nowProven.verdicts.find((v: { name: string }) => v.name === 'web render')?.verdict).toBe('unexpected pass')
    expect(verdictOf(measured({ 'tokens.ts unchanged': false }), expected).ok).toBe(false)
  })

  it('integrity checks and unknown levels cannot be listed; every entry needs a reason', () => {
    const { notProven, problems } = readExpectations(
      JSON.stringify({
        notProven: {
          'tokens.ts unchanged': 'não pode',
          'style resolution (web)': 'curto',
          'mobile export': 'não executado sem alias do Metro',
        },
      })
    )
    expect(notProven).toEqual({ 'mobile export': 'não executado sem alias do Metro' })
    expect(problems).toHaveLength(2)
    expect(PROPAGATION_LEVELS).not.toContain('tokens.ts unchanged')
    expect(verdictOf(measured(), { ...expected, 'mobile export': 'não medido aqui' }).ok).toBe(false)
  })

  it('the versioned expectation lists only propagation levels, each with a reason', () => {
    const file = path.resolve(here, '..', '..', 'tools', 'token-propagation-expectations.json')
    const { notProven, problems } = readExpectations(fs.readFileSync(file, 'utf8'))
    expect(problems).toEqual([])
    expect(Object.keys(notProven).sort()).toEqual(['mobile export', 'style resolution (web)', 'web render'])
  })
})
