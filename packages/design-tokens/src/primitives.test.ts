// Paridade 1:1 fonte do web aprovado -> primitivo, com tolerância zero.
// Normalização (documentada em __tests__/web-sources.ts):
//   cor     -> canais sRGB inteiros + alfa; tripla HSL via hslTripleToHex (CSS Color 4,
//              canal × 255 arredondado); hsl(var(--x)) resolvido no bloco :root;
//   px      -> rem × 16 em aritmética decimal exata (0.7rem = 11.2px);
//   ms      -> s × 1000 exato; em/vw/number -> o número declarado;
//   string  -> igualdade literal após colapsar espaços (clamp, pilhas de fonte);
//   shadow  -> igualdade literal com cada cor normalizada como em "cor" (rgba(0, 0, 0, 0.1) = rgb(0 0 0 / 10%)).
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hslTripleToHex, primitives } from './primitives'
import {
  colorKey,
  colorsIn,
  listWebFiles,
  parityProblems,
  readBaseJson,
  readRepoFile,
  readThemeBlocks,
  readTokensCss,
  repoRoot,
  type Kind,
  type Mapping,
} from './__tests__/web-sources'

const color = (name: keyof typeof primitives.color) =>
  [`color.${name}`, 'color'] as const
const alpha = (name: keyof typeof primitives.alpha) =>
  [`alpha.${name}`, 'color'] as const
const at = (path: string, kind: Kind) => [path, kind] as const

const BASE_JSON: Mapping = {
  'color.primary': color('orange600'),
  'color.primary-light': color('orange200'),
  'color.primary-dark': color('orange500'),
  'color.secondary': color('slate700'),
  'color.success': color('emerald500'),
  'color.warning': color('amber500'),
  'color.error': color('red500'),
  'color.info': color('blue500'),
  'color.background.primary': color('slate50'),
  'color.background.secondary': color('blue100'),
  'color.background.card': alpha('whiteA95'),
  'color.text.primary': color('gray900'),
  'color.text.secondary': color('gray500'),
  'color.text.muted': color('gray400'),
  'color.text.white': color('white'),
  'typography.fontFamily.sans': at('typography.family.sansStack', 'string'),
  'typography.fontFamily.heading': at(
    'typography.family.headingStack',
    'string'
  ),
  'typography.fontSize.h1': at('typography.fluid.h1.css', 'string'),
  'typography.fontSize.h2': at('typography.fluid.h2.css', 'string'),
  'typography.fontSize.h3': at('typography.fluid.h3.css', 'string'),
  'typography.fontSize.base': at('typography.fluid.base.css', 'string'),
  'typography.fontSize.small': at('typography.fluid.small.css', 'string'),
  'typography.lineHeight.tight': at('typography.fluid.h1.lineHeight', 'number'),
  'typography.lineHeight.normal': at(
    'typography.fluid.h2.lineHeight',
    'number'
  ),
  'typography.lineHeight.relaxed': at(
    'typography.fluid.h3.lineHeight',
    'number'
  ),
  'typography.lineHeight.loose': at(
    'typography.fluid.base.lineHeight',
    'number'
  ),
  'typography.letterSpacing.tight': at('letterSpacing.tight', 'em'),
  'typography.letterSpacing.normal': at('letterSpacing.normal', 'em'),
  'typography.letterSpacing.wide': at('letterSpacing.wide', 'em'),
  'spacing.xs': at('space.1', 'px'),
  'spacing.sm': at('space.2', 'px'),
  'spacing.md': at('space.4', 'px'),
  'spacing.lg': at('space.6', 'px'),
  'spacing.xl': at('space.8', 'px'),
  'spacing.2xl': at('space.12', 'px'),
  'borderRadius.sm': at('radius.lg', 'px'),
  'borderRadius.md': at('radius.xl', 'px'),
  'borderRadius.lg': at('radius.2xl', 'px'),
  'shadow.card': at('shadow.card', 'string'),
  'shadow.modal': at('shadow.modal', 'string'),
  'shadow.button': at('shadow.button', 'string'),
  'shadow.overlay': at('shadow.overlay', 'string'),
  'animation.duration.fast': at('motion.duration.fast', 'ms'),
  'animation.duration.normal': at('motion.duration.normal', 'ms'),
  'animation.duration.slow': at('motion.duration.slow', 'ms'),
  'animation.easing.ease-out': at('motion.easing.easeOut', 'string'),
  'animation.easing.ease-in': at('motion.easing.easeIn', 'string'),
  'animation.easing.ease-in-out': at('motion.easing.easeInOut', 'string'),
}

/** Tokens nomeados do tokens.css (var() de outro token já resolvido). */
const TOKENS_CSS: Mapping = {
  '--brand': color('orange600'),
  '--brand-hover': color('orange700'),
  '--brand-border': color('orange400'),
  '--brand-tint': color('orange100'),
  '--brand-surface': color('orange50'),
  '--on-brand': color('white'),
  '--surface-control': color('white'),
  '--surface-admin': color('slate700'),
  '--surface-admin-canvas': color('gray50'),
  '--border-subtle': color('gray200'),
  '--border-strong': color('gray300'),
  '--focus-border': color('blue500'),
  '--focus-halo': alpha('blue500A10'),
  '--focus-ring': color('orange600'),
  '--field-invalid': color('red500'),
  '--field-invalid-halo': alpha('red500A10'),
  '--text-emphasis': color('slate800'),
  '--text-secondary': color('gray500'),
  '--text-faint': color('gray400'),
  '--text-disabled': color('gray300'),
  '--selection-surface': color('indigo200'),
  '--selection-text': color('indigo950'),
  '--header-surface': alpha('whiteA95'),
  '--header-border': alpha('gray200A80'),
  '--action-icon': color('slate700'),
  '--action-hover-surface': color('gray100'),
  '--action-danger': color('red500'),
  '--action-danger-hover': color('red700'),
  '--action-danger-surface': color('red100'),
  '--status-info-surface': color('blue100'),
  '--status-info-text': color('blue800'),
  '--status-info-border': color('blue200'),
  '--status-warning-surface': color('yellow100'),
  '--status-warning-text': color('yellow800'),
  '--status-warning-border': color('yellow200'),
  '--status-success-surface': color('green100'),
  '--status-success-text': color('green800'),
  '--status-success-border': color('green200'),
  '--status-danger-surface': color('red100'),
  '--status-danger-text': color('red800'),
  '--status-danger-border': color('red200'),
  '--whatsapp': color('whatsappGreen'),
  '--whatsapp-hover': color('whatsappTeal'),
  '--whatsapp-scroll-track': color('offWhite'),
  '--scroll-thumb': alpha('scrollbarOrange'),
  '--scroll-track': color('slate100'),
  '--scroll-thumb-muted': color('gray300'),
  '--scroll-thumb-muted-hover': color('gray400'),
  '--shadow-control': at('tailwindShadow.md', 'shadow'),
  '--shadow-control-hover': at('tailwindShadow.lg', 'shadow'),
  '--shadow-control-focus': at('shadow.controlFocus', 'shadow'),
  '--shadow-control-invalid-focus': at('shadow.controlInvalidFocus', 'shadow'),
  '--shadow-textarea': at('shadow.textarea', 'shadow'),
  '--shadow-raised': at('shadow.button', 'shadow'),
  '--shadow-raised-lg': at('shadow.raisedLg', 'shadow'),
  '--shadow-raised-xl': at('shadow.card', 'shadow'),
  '--shadow-card-hover': at('shadow.modal', 'shadow'),
  '--shadow-checkbox-focus': at('shadow.checkboxFocus', 'shadow'),
  '--border-width-1': at('borderWidth.1', 'px'),
  '--border-width-2': at('borderWidth.2', 'px'),
  '--border-width-4': at('borderWidth.4', 'px'),
  '--border-width-6': at('borderWidth.6', 'px'),
  '--space-0-5': at('space.0.5', 'px'),
  '--space-1': at('space.1', 'px'),
  '--space-1-5': at('space.1.5', 'px'),
  '--space-2': at('space.2', 'px'),
  '--space-4': at('space.4', 'px'),
  '--space-5': at('space.5', 'px'),
  '--space-6': at('space.6', 'px'),
  '--scroll-nudge': at('layout.scrollbarNudge', 'px'),
  '--rounded-scroll-thumb': at('radius.scrollbarThumb', 'px'),
  '--rounded-sm': at('radius.sm', 'px'),
  '--rounded-md': at('radius.md', 'px'),
  '--rounded-full': at('radius.full', 'px'),
  '--focus-ring-width': at('borderWidth.2', 'px'),
  '--focus-ring-offset': at('space.0.5', 'px'),
  '--viewport-width': at('layout.viewportWidthVw', 'vw'),
  '--header-offset': at('layout.headerOffset', 'px'),
  '--font-size-micro': at('typography.size.micro', 'px'),
  '--font-size-xs': at('typography.size.xs', 'px'),
  '--font-size-caption': at('typography.size.caption', 'px'),
  '--font-size-sm': at('typography.size.sm', 'px'),
  '--font-size-body': at('typography.size.base', 'px'),
  '--font-size-h1': at('typography.fluid.h1.css', 'string'),
  '--font-size-h2': at('typography.fluid.h2.css', 'string'),
  '--font-size-h3': at('typography.fluid.h3.css', 'string'),
  '--font-size-paragraph': at('typography.fluid.base.css', 'string'),
  '--font-size-small': at('typography.fluid.small.css', 'string'),
  '--line-height-h1': at('typography.fluid.h1.lineHeight', 'number'),
  '--line-height-h2': at('typography.fluid.h2.lineHeight', 'number'),
  '--line-height-h3': at('typography.fluid.h3.lineHeight', 'number'),
  '--line-height-paragraph': at('typography.fluid.base.lineHeight', 'number'),
  '--line-height-small': at('typography.fluid.small.lineHeight', 'number'),
  '--letter-spacing-display': at('letterSpacing.display', 'em'),
}

const THEME_ROOT: Mapping = {
  '--background': color('white'),
  '--foreground': color('slate950Shadcn'),
  '--card': color('white'),
  '--card-foreground': color('slate950Shadcn'),
  '--primary': color('slate900'),
  '--primary-foreground': color('slate50'),
  '--secondary': color('slate100'),
  '--secondary-foreground': color('slate900'),
  '--muted': color('slate100'),
  '--muted-foreground': color('slate500'),
  '--accent': color('slate100'),
  '--accent-foreground': color('slate900'),
  '--destructive': color('red500'),
  '--destructive-foreground': color('slate50'),
  '--border': color('slate200'),
  '--input': color('slate200'),
  '--radius': at('radius.lg', 'px'),
  '--chart-1': color('chartLight1'),
  '--chart-2': color('chartLight2'),
  '--chart-3': color('chartLight3'),
  '--chart-4': color('chartLight4'),
  '--chart-5': color('chartLight5'),
  '--header-height': at('layout.headerHeight', 'px'),
  '--ring': color('neutral950'),
  '--sidebar-background': color('zinc50'),
  '--sidebar-foreground': color('zinc700'),
  '--sidebar-primary': color('zinc900'),
  '--sidebar-primary-foreground': color('zinc50'),
  '--sidebar-accent': color('zinc100'),
  '--sidebar-accent-foreground': color('zinc900'),
  '--sidebar-border': color('gray200'),
  '--sidebar-ring': color('blue500'),
  '--popover': color('white'),
  '--popover-foreground': color('slate950Shadcn'),
  '--layer-base': at('layer.base', 'number'),
  '--layer-step': at('layer.step', 'number'),
  '--layer-inset': at('layer.inset', 'number'),
  '--layer-floating': at('layer.floating', 'number'),
  '--layer-sticky': at('layer.sticky', 'number'),
  '--layer-fab': at('layer.fab', 'number'),
  '--layer-dropdown': at('layer.dropdown', 'number'),
  '--layer-popover': at('layer.popover', 'number'),
  '--layer-dialog-backdrop': at('layer.dialogBackdrop', 'number'),
  '--layer-dialog': at('layer.dialog', 'number'),
  '--layer-tooltip': at('layer.tooltip', 'number'),
  '--layer-spotlight': at('layer.spotlight', 'number'),
  '--layer-legacy-stack': at('layer.legacyStack', 'number'),
  '--z-dropdown': at('layer.dropdown', 'number'),
  '--z-modal': at('layer.dialog', 'number'),
  '--z-popover': at('layer.popover', 'number'),
  '--z-tooltip': at('layer.tooltip', 'number'),
}

const THEME_DARK: Mapping = {
  '--background': color('slate950Shadcn'),
  '--foreground': color('slate50'),
  '--card': color('slate950Shadcn'),
  '--card-foreground': color('slate50'),
  '--primary': color('slate50'),
  '--primary-foreground': color('slate900'),
  '--secondary': color('slate800'),
  '--secondary-foreground': color('slate50'),
  '--muted': color('slate800'),
  '--muted-foreground': color('slate400'),
  '--accent': color('slate800'),
  '--accent-foreground': color('slate50'),
  '--destructive': color('red900'),
  '--destructive-foreground': color('slate50'),
  '--border': color('slate800'),
  '--input': color('slate800'),
  '--ring': color('slate300'),
  '--chart-1': color('chartDark1'),
  '--chart-2': color('chartDark2'),
  '--chart-3': color('chartDark3'),
  '--chart-4': color('chartDark4'),
  '--chart-5': color('chartDark5'),
  '--sidebar-background': color('zinc900'),
  '--sidebar-foreground': color('zinc100'),
  '--sidebar-primary': color('blue700'),
  '--sidebar-primary-foreground': color('white'),
  '--sidebar-accent': color('zinc800'),
  '--sidebar-accent-foreground': color('zinc100'),
  '--sidebar-border': color('zinc800'),
  '--sidebar-ring': color('blue500'),
  '--popover': color('slate950Shadcn'),
  '--popover-foreground': color('slate50'),
}

const THEME: Record<string, Mapping> = {
  root: THEME_ROOT,
  dark: THEME_DARK,
  'root@(width >= 640px)': {
    '--header-height': at('layout.headerHeightSm', 'px'),
  },
}

const blocks = readThemeBlocks()
const resolverFor = (block: Record<string, string>) => (name: string) => {
  const value = block[name] ?? blocks.root?.[name]
  if (value === undefined) throw new Error(`variável ${name} não declarada`)
  return value
}

describe('hslTripleToHex (conversão documentada)', () => {
  it('segue a CSS Color 4 e arredonda cada canal', () => {
    expect(hslTripleToHex('0 0% 100%')).toBe('#ffffff')
    expect(hslTripleToHex('222.2 47.4% 11.2%')).toBe('#0f172a')
    expect(hslTripleToHex('222.2 84% 4.9%')).toBe('#020817')
    expect(hslTripleToHex('0 84.2% 60.2%')).toBe('#ef4444')
    expect(hslTripleToHex('220 70% 50%')).toBe('#2662d9')
    expect(() => hslTripleToHex('hsl(0 0% 0%)')).toThrow()
  })

  it('normaliza a matiz para [0, 360) antes de converter, como a CSS Color 4', () => {
    // -120deg é 240deg (azul); sem normalizar, o resto negativo do JS produzia #ff00ff.
    expect(hslTripleToHex('-120 100% 50%')).toBe('#0000ff')
    expect(hslTripleToHex('-120 100% 50%')).toBe(hslTripleToHex('240 100% 50%'))
    expect(hslTripleToHex('-150 100% 50%')).toBe('#0080ff')
    expect(hslTripleToHex('-150 100% 50%')).toBe(hslTripleToHex('210 100% 50%'))
    expect(hslTripleToHex('-480 100% 50%')).toBe(hslTripleToHex('240 100% 50%'))
    expect(hslTripleToHex('480 100% 50%')).toBe('#00ff00')
    expect(hslTripleToHex('360 100% 50%')).toBe(hslTripleToHex('0 100% 50%'))
  })

  it('nenhuma tripla do tema cai na fronteira de arredondamento', () => {
    for (const block of [blocks.root, blocks.dark]) {
      for (const value of Object.values(block)) {
        // A matiz pode ser negativa (CSS válido); normalizada como em hslTripleToHex.
        const m = /^(-?\d*\.?\d+)\s+(\d*\.?\d+)%\s+(\d*\.?\d+)%$/.exec(value)
        if (!m) continue
        const [h, s, l] = [
          ((Number(m[1]) % 360) + 360) % 360,
          Number(m[2]) / 100,
          Number(m[3]) / 100,
        ]
        const a = s * Math.min(l, 1 - l)
        for (const n of [0, 8, 4]) {
          const k = (n + h / 30) % 12
          const scaled = (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
          expect(Math.abs((scaled % 1) - 0.5), `${value}`).toBeGreaterThan(0.02)
        }
      }
    }
  })
})

describe('paridade com __tests__/fixtures/base.json', () => {
  it('todo valor tem primitivo igual (0 sem mapeamento)', () => {
    const source = readBaseJson()
    expect(Object.keys(source)).toHaveLength(48)
    expect(parityProblems(source, BASE_JSON)).toEqual([])
  })
})

describe('sem variáveis com nome de hash', () => {
  it('o legacy.css saiu: as 19 variáveis --legacy-* viraram tokens nomeados do tokens.css e ninguém mais as lê', () => {
    expect(() =>
      readRepoFile('packages/design-tokens/src/legacy.css')
    ).toThrow()
    const code = listWebFiles()
      .map((file) => readRepoFile(file))
      .join('\n')
    expect(code).not.toMatch(/--legacy-(color|size)-/)
  })

  it('cada token nomeado que substituiu uma variável de hash é lido pelo código web', () => {
    const code = listWebFiles()
      .map((file) => readRepoFile(file))
      .join('\n')
    const replacements = [
      '--text-secondary',
      '--header-surface',
      '--header-border',
      '--action-icon',
      '--action-hover-surface',
      '--action-danger',
      '--action-danger-hover',
      '--action-danger-surface',
      '--whatsapp',
      '--whatsapp-hover',
      '--whatsapp-scroll-track',
      '--space-4',
      '--viewport-width',
      '--header-offset',
    ]
    expect(
      replacements.filter((name) => !new RegExp(`${name}(?![\\w-])`).test(code))
    ).toEqual([])
  })
})

describe('paridade com tokens.css', () => {
  it('todos os tokens nomeados têm primitivo igual (0 sem mapeamento)', () => {
    expect(parityProblems(readTokensCss(), TOKENS_CSS)).toEqual([])
  })

  it('toda cor de sombra é um primitivo com alfa', () => {
    const alphas = new Set(
      Object.values(primitives.alpha).map((value) => colorKey(value))
    )
    const shadows = Object.entries(readTokensCss()).filter(([name]) =>
      name.startsWith('--shadow-')
    )
    expect(shadows.length).toBeGreaterThan(5)
    for (const [name, value] of shadows)
      for (const c of colorsIn(value))
        expect(alphas.has(colorKey(c)), `${name}: ${c}`).toBe(true)
  })

  it('nenhum nome de hash: os tokens se chamam pelo papel', () => {
    for (const name of Object.keys(readTokensCss()))
      expect(name, name).not.toMatch(/legacy|-[0-9a-f]{6}$/)
  })
})

describe('paridade com theme.css (:root, .dark, :root de ≥640px)', () => {
  it('lê exatamente os blocos mapeados', () => {
    expect(Object.keys(blocks).sort()).toEqual(Object.keys(THEME).sort())
  })

  it('as 64 triplas HSL e demais valores têm primitivo igual (0 sem mapeamento)', () => {
    const triples = [blocks.root, blocks.dark]
      .flatMap((b) => Object.values(b))
      .filter((v) => /%\s*$/.test(v))
    expect(triples).toHaveLength(64)
    const problems = Object.entries(THEME).flatMap(([key, mapping]) =>
      parityProblems(
        blocks[key] ?? {},
        mapping,
        resolverFor(blocks[key] ?? {})
      ).map((p) => `${key}: ${p}`)
    )
    expect(problems).toEqual([])
  })
})

describe('primitivos de cor não inventados', () => {
  it('toda cor e cor com alfa vem de uma fonte mapeada ou da fachada anterior', () => {
    const referenced = new Set<string>()
    for (const mapping of [BASE_JSON, TOKENS_CSS, ...Object.values(THEME)])
      for (const [path] of Object.values(mapping)) referenced.add(path)
    // Cores das sombras de tokens.css.
    for (const [name, value] of Object.entries(readTokensCss()).filter(([n]) =>
      n.startsWith('--shadow-')
    ))
      for (const c of colorsIn(value)) {
        const key = Object.entries(primitives.alpha).find(
          ([, v]) => colorKey(v) === colorKey(c)
        )?.[0]
        if (!key) throw new Error(`${name}: cor ${c} sem primitivo`)
        referenced.add(`alpha.${key}`)
      }
    // Tons que só a fachada anterior (tokens.ts) usava: laranja 300 da grade animada.
    const facadeOnly = new Set(['color.orange300'])
    const unused = [
      ...Object.keys(primitives.color).map((k) => `color.${k}`),
      ...Object.keys(primitives.alpha).map((k) => `alpha.${k}`),
    ].filter((path) => !referenced.has(path) && !facadeOnly.has(path))
    expect(unused).toEqual([])
  })
})

describe('tipografia fluida', () => {
  it('o clamp literal corresponde a min/preferred/max e a altura de linha ao tailwind.config', () => {
    const config = readRepoFile('tailwind.config.cjs')
    for (const [name, fluid] of Object.entries(primitives.typography.fluid)) {
      const toRem = (px: number) => `${px / 16}rem`
      expect(fluid.css).toBe(
        `clamp(${toRem(fluid.minPx)}, ${fluid.preferredVw}vw, ${toRem(fluid.maxPx)})`
      )
      const entry = new RegExp(
        `${name}: \\['${fluid.css.replace(/[()]/g, '\\$&')}', \\{ lineHeight: '([\\d.]+)' \\}\\]`
      ).exec(config)
      expect(entry?.[1], name).toBe(String(fluid.lineHeight))
    }
  })
})

describe('Tailwind usado pelo web (paleta da produção, escalas do 4.3.3)', () => {
  const theme = readRepoFile('node_modules/tailwindcss/theme.css')
  const themeVar = (name: string) => {
    const m = new RegExp(`\\n\\s*--${name}:\\s*([^;]+);`).exec(theme)
    if (!m) throw new Error(`--${name} ausente do theme.css`)
    return m[1].trim()
  }
  const tailwindKey = (tone: string) => tone.replace(/-(\d+)$/, '$1')
  const orange600Definition = /\borange600:\s*(["'])(#[0-9A-Fa-f]{6})\1/g
  const colorDefinition = (key: string) =>
    new RegExp(
      `(?:^|[\\s{,"'])${key}["']?:\\s*(["'])#[0-9A-Fa-f]{3,8}\\1`,
      'gm'
    )
  const countDefinitions = (sources: readonly string[], pattern: RegExp) =>
    sources.reduce(
      (total, text) => total + [...text.matchAll(pattern)].length,
      0
    )

  it('a definição de orange600 aceita aspas pareadas e exatamente seis dígitos hex', () => {
    const count = (source: string) =>
      countDefinitions([source], orange600Definition)
    expect(count("orange600: '#ea580c',")).toBe(1)
    expect(count('orange600: "#ea580c",')).toBe(1)
    expect(count(`orange600: '#ea580c",`)).toBe(0)
    expect(count(`orange600: "#ea580c',`)).toBe(0)
    expect(count("orange600: '#ea580',")).toBe(0)
    expect(count("orange600: '#ea580ca',")).toBe(0)
  })

  it('a contagem de tons reconhece ambas as aspas e continua detectando cópias literais', () => {
    const pattern = colorDefinition('orange600')
    expect(countDefinitions(["orange600: '#ea580c',"], pattern)).toBe(1)
    expect(countDefinitions(['orange600: "#ea580c",'], pattern)).toBe(1)
    expect(
      countDefinitions(
        ["orange600: '#ea580c',", 'orange600: "#ea580c",'],
        pattern
      )
    ).toBe(2)
    expect(countDefinitions([`orange600: '#ea580c",`], pattern)).toBe(0)
    expect(countDefinitions([`orange600: "#ea580c',`], pattern)).toBe(0)
    expect(countDefinitions(['orange600: tailwind.orange600,'], pattern)).toBe(
      0
    )
  })

  it('usa o tailwindcss 4.3.3 medido', () => {
    expect(
      JSON.parse(readRepoFile('node_modules/tailwindcss/package.json')).version
    ).toBe('4.3.3')
  })

  it('a paleta é a da produção (Tailwind 3.4.17): 22 famílias de 50 a 950, black e white, com a impressão digital dos valores', () => {
    const families = [
      'slate',
      'gray',
      'zinc',
      'neutral',
      'stone',
      'red',
      'orange',
      'amber',
      'yellow',
      'lime',
      'green',
      'emerald',
      'teal',
      'cyan',
      'sky',
      'blue',
      'indigo',
      'violet',
      'purple',
      'fuchsia',
      'pink',
      'rose',
    ]
    const shades = [
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '950',
    ]
    expect(Object.keys(primitives.tailwind)).toEqual([
      'black',
      'white',
      ...families.flatMap((f) => shades.map((s) => `${f}${s}`)),
    ])
    for (const [key, value] of Object.entries(primitives.tailwind))
      expect(value, key).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/)
    // sha256 de "chave=valor" por linha, na ordem acima, calculado de tailwindcss@3.4.17/lib/public/colors.js (a
    // versão da main eb4c0098): qualquer tom alterado à mão muda a impressão digital.
    const text = Object.entries(primitives.tailwind)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
    expect(createHash('sha256').update(text).digest('hex')).toBe(
      '6e341e6544c09b82080253f0fdab6cd384aa0d224ee8db93a525d49fd25eacd9'
    )
    expect(primitives.tailwind.orange600).toBe('#ea580c')
  })

  it('os tons com o mesmo nome em `color` (base.json, theme.css, tokens.css) têm o mesmo hex da paleta', () => {
    const shared = Object.entries(primitives.color).filter(
      ([key]) => key in primitives.tailwind
    )
    expect(shared.length).toBeGreaterThan(30)
    const long = (hex: string) =>
      hex.length === 4
        ? `#${[...hex.slice(1)].map((c) => c + c).join('')}`
        : hex
    for (const [key, hex] of shared)
      expect(
        long(primitives.tailwind[key as keyof typeof primitives.tailwind]),
        key
      ).toBe(hex)
  })

  it('cada tom tem uma única definição hex no código de packages/design-tokens/src: `color` referencia a paleta', () => {
    // Fonte única: o hex de um tom mora só em primitives.tailwind; os tons homônimos de `color` são referências. O
    // portão `pnpm check:tokens` (tools/token-propagation-check.mjs) troca a única definição de orange600 por uma
    // sentinela e exige exatamente uma; uma cópia literal em `color` o derruba ("found 2").
    const srcDir = path.join(repoRoot, 'packages', 'design-tokens', 'src')
    const sources = (fs.readdirSync(srcDir, { recursive: true }) as string[])
      .filter(
        (file) =>
          /\.tsx?$/.test(file) &&
          !/(?:^|[\\/])__tests__[\\/]|\.test\.tsx?$/.test(file)
      )
      .map((file) => fs.readFileSync(path.join(srcDir, file), 'utf8'))
    expect(sources.length).toBeGreaterThan(3)
    const count = (pattern: RegExp) => countDefinitions(sources, pattern)
    // A mesma expressão do portão.
    expect(count(orange600Definition)).toBe(1)
    const repeated = Object.keys(primitives.tailwind)
      .map((key) => [key, count(colorDefinition(key))] as const)
      .filter(
        ([key, total]) => total !== 1 && !(key === 'white' && total === 2)
      )
    // white é a exceção: #fff na paleta (a notação do colors.js do Tailwind 3) e #ffffff em `color` (6 dígitos, o
    // contrato dos consumidores); o teste acima garante que é a mesma cor.
    expect(repeated).toEqual([])
  })

  it('palette.css declara no @theme exatamente os tons de primitives.tailwind, na mesma ordem, e o Tailwind 4 não os redefine', () => {
    const css = readRepoFile('packages/design-tokens/src/palette.css')
    const declared = [
      ...css.matchAll(/--color-([a-z]+)(?:-(\d+))?:\s*([^;]+);/g),
    ].map((m) => [`${m[1]}${m[2] ?? ''}`, m[3].trim()])
    expect(declared).toEqual(Object.entries(primitives.tailwind))
    expect(css).toMatch(/@theme\s*\{/)
    expect(css).not.toMatch(/@theme\s+(?:default|inline)/)
    // O tema padrão do Tailwind 4 (`@theme default`) perde para um @theme sem `default`: o OKLCH não volta.
    expect(themeVar('color-orange-600')).toMatch(/^oklch\(/)
    expect(
      readRepoFile('packages/frontend/src/app/styles/globals.web.css')
    ).toContain("@import '@gb-locacoes/design-tokens/palette.css';")
  })

  it('todo tom de paleta usado em classe no código web tem primitivo', () => {
    const families =
      'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
    const utility = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])[a-z-]*-((?:${families})-(?:50|[1-9]00|950)|white|black)(?![\\w-])`,
      'g'
    )
    const used = new Set<string>()
    const files = listWebFiles()
    expect(files).toEqual(
      expect.arrayContaining([
        'packages/ui/src/web/Button.web.tsx',
        'packages/frontend/src/widgets/hero/ui/Hero.web.tsx',
        'apps/clients/web/src/app/layout.tsx',
      ])
    )
    for (const file of files)
      for (const m of readRepoFile(file).matchAll(utility)) used.add(m[1])
    // Empty or incomplete discovery must fail; removing unused colors is valid.
    expect([...used]).toEqual(
      expect.arrayContaining(['orange-600', 'slate-700'])
    )
    const missing = [...used]
      .map(tailwindKey)
      .filter((key) => !(key in primitives.tailwind))
    expect(missing).toEqual([])
  })

  it('scales.css grava no @theme as escalas da produção que o 4.3.3 mudou, com os valores de primitives.ts', () => {
    const css = readRepoFile('packages/design-tokens/src/scales.css')
    const decl = Object.fromEntries(
      [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
        m[1],
        m[2].trim(),
      ])
    )
    // O lint de CSS pede alfa em porcentagem; primitives.ts guarda a notação do Tailwind 3 (0.05).
    const alpha = (v: string | undefined) =>
      v?.replace(/\/ ([\d.]+)%/g, (_, p: string) => `/ ${Number(p) / 100}`)
    expect(css).toMatch(/@theme\s+inline\s*\{/)
    expect(
      readRepoFile('packages/frontend/src/app/styles/globals.web.css')
    ).toContain("@import '@gb-locacoes/design-tokens/scales.css';")
    expect(alpha(decl['--shadow-sm'])).toBe(primitives.tailwindShadow.sm)
    // O shadow-sm do 4.3.3 é o shadow do 3: é por isso que scales.css existe.
    expect(themeVar('shadow-sm')).not.toBe(primitives.tailwindShadow.sm)
    expect(decl['--blur-sm']).toBe(`${primitives.tailwindScale.blurSm}px`)
    for (const [key, value] of Object.entries(
      primitives.tailwindScale.dropShadow
    ))
      expect(alpha(decl[`--drop-shadow-${key}`]), key).toBe(value)
    expect(decl['--radius-full']).toBe(
      `${primitives.tailwindScale.radiusFull}px`
    )
    // `outline` do 3 só dava o estilo sólido: sem largura própria (3px em repouso, a do anel do navegador no foco).
    expect(decl['--default-outline-width']).toBe('revert-layer')
    expect(decl['--default-ring-width']).toBe(
      `${primitives.tailwindScale.ringWidth}px`
    )
    expect(alpha(decl['--default-ring-color'])).toBe(
      primitives.tailwindScale.ringColor
    )
    // Breakpoints em px, como os screens do 3: o 4.3.3 os dá em rem (48rem só casa numa janela de 960px com a fonte
    // do navegador em 20px; 768px casa em 768px com qualquer fonte).
    for (const [key, px] of Object.entries(
      primitives.tailwindScale.breakpoint
    )) {
      expect(decl[`--breakpoint-${key}`], key).toBe(`${px}px`)
      expect(themeVar(`breakpoint-${key}`), key).toBe(`${px / 16}rem`)
    }
    // Altura de linha absoluta de text-xs…9xl (a do 3): rem × 16 ou sem unidade × tamanho = sizeLineHeight.
    const { size, sizeLineHeight } = primitives.typography
    const lineHeights = Object.entries(decl).filter(([name]) =>
      name.startsWith('--line-height-text-')
    )
    expect(
      lineHeights.map(([name]) => name.slice('--line-height-text-'.length))
    ).toEqual([
      'xs',
      'sm',
      'lg',
      'xl',
      '2xl',
      '3xl',
      '4xl',
      '5xl',
      '6xl',
      '7xl',
      '8xl',
      '9xl',
    ])
    for (const [name, value] of lineHeights) {
      const key = name.slice('--line-height-text-'.length)
      if (!(key in sizeLineHeight)) {
        expect(value, key).toBe('1')
        continue
      }
      const rem = /^([\d.]+)rem$/.exec(value)
      const px = rem
        ? Number(rem[1]) * 16
        : Number(value) * size[key as keyof typeof size]
      expect(px, key).toBe(sizeLineHeight[key as keyof typeof sizeLineHeight])
    }
  })

  it('sombras, escala de texto, pesos, leading, tracking e raios batem com o theme.css', () => {
    for (const key of ['md', 'lg', 'xl', '2xl'] as const)
      expect(primitives.tailwindShadow[key]).toBe(themeVar(`shadow-${key}`))
    // shadow-inner não é variável de tema: vem do tema de compatibilidade (ativo pelo @config).
    expect(readRepoFile('node_modules/tailwindcss/dist/lib.js')).toContain(
      `inner:"${primitives.tailwindShadow.inner}"`
    )

    expect(themeVar('spacing')).toBe('0.25rem')
    for (const [step, px] of Object.entries(primitives.space))
      expect(px, step).toBe(Number(step) * 4)

    const { size, sizeLineHeight, weight, leading } = primitives.typography
    for (const [key, px] of Object.entries(sizeLineHeight)) {
      const rem = /^([\d.]+)rem$/.exec(themeVar(`text-${key}`))
      expect(size[key as keyof typeof size], key).toBe(Number(rem?.[1]) * 16)
      const lh = themeVar(`text-${key}--line-height`)
      const ratio = /^calc\(([\d.]+) \/ [\d.]+\)$/.exec(lh)
      expect(px, key).toBe(
        ratio
          ? Number(ratio[1]) * 16
          : Number(lh) * size[key as keyof typeof size]
      )
    }
    for (const key of [
      'light',
      'normal',
      'medium',
      'semibold',
      'bold',
      'extrabold',
    ] as const)
      expect(weight[key]).toBe(themeVar(`font-weight-${key}`))
    for (const key of ['tight', 'normal', 'relaxed'] as const)
      expect(leading[key]).toBe(Number(themeVar(`leading-${key}`)))
    expect(primitives.letterSpacing.wider).toBe(
      Number(themeVar('tracking-wider').replace('em', ''))
    )
    expect(primitives.letterSpacing.widest).toBe(
      Number(themeVar('tracking-widest').replace('em', ''))
    )
    for (const key of ['xl', '2xl', '3xl'] as const)
      expect(primitives.radius[key]).toBe(
        Number(themeVar(`radius-${key}`).replace('rem', '')) * 16
      )
  })

  it('rounded-sm/md/lg seguem o --radius do tailwind.config', () => {
    const config = readRepoFile('tailwind.config.cjs')
    const base = primitives.radius.lg
    expect(config).toMatch(/lg: 'var\(--radius\)'/)
    const md = /md: 'calc\(var\(--radius\) - (\d+)px\)'/.exec(config)
    const sm = /sm: 'calc\(var\(--radius\) - (\d+)px\)'/.exec(config)
    expect(primitives.radius.md).toBe(base - Number(md?.[1]))
    expect(primitives.radius.sm).toBe(base - Number(sm?.[1]))
  })
})
