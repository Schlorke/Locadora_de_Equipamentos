#!/usr/bin/env node
// Gera tests/visual/tailwind-parity/production.json: o estilo canônico que a PRODUÇÃO (main eb4c0098, Tailwind 3.4.17 +
// tailwind.config.cjs + app/globals.css da main, lidos do git) dá a cada utilitário, cadeia de variantes e combinação
// usados hoje no código do produto. O teste tests/visual/tailwind-parity.test.ts compara o CSS atual com essa fixture.
//
// Precisa do Tailwind 3.4.17 e dos plugins da main instalados (não são dependências do projeto): por padrão, no
// armazenamento do pnpm do repositório; --pnpm <pasta> aponta outro. Os tokens nomeados do design-tokens (tokens.css e
// theme.css) entram antes do CSS da main: `bg-[var(--brand)]` compara o mecanismo da classe (o valor de cada token é
// conferido com a produção em primitives.test.ts).
//
// Uso: node tests/visual/support/tailwind-parity-fixture.mjs [--pnpm <node_modules/.pnpm>] [--work <pasta temporária>]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import Module, { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from './tailwind-parity.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..', '..')
const args = process.argv.slice(2)
const opt = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const PNPM = path.resolve(
  opt('--pnpm', path.join(repo, 'node_modules', '.pnpm'))
)
const MAIN = 'eb4c0098'
const TW3 = {
  tailwindcss: 'tailwindcss@3.4.17/node_modules/tailwindcss',
  'tailwindcss-animate':
    'tailwindcss-animate@1.0.7_tailwindcss@3.4.17/node_modules/tailwindcss-animate',
  'tailwind-scrollbar': /^tailwind-scrollbar@4\.0\.2_.*tailwindcss@3\.4\.17$/,
  autoprefixer: /^autoprefixer@10\./,
}
const requireRoot = createRequire(path.join(repo, 'package.json'))
const postcss = requireRoot('postcss')
const tailwind4 = requireRoot('@tailwindcss/postcss')

// ---- fontes da main (git) -------------------------------------------------------------------------------------
const work = fs.mkdtempSync(
  path.join(path.resolve(opt('--work', os.tmpdir())), 'tailwind-parity-main-')
)
const written = []
for (const file of [
  'tailwind.config.cjs',
  'postcss.config.cjs',
  'app/globals.css',
  'design-tokens/output/tokens-tailwind.json',
]) {
  const out = path.join(work, file)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(
    out,
    execFileSync('git', ['show', `${MAIN}:${file}`], { cwd: repo })
  )
  written.push(out)
}

// ---- Tailwind 3 e plugins da main ------------------------------------------------------------------------------
const dirOf = (spec) => {
  if (typeof spec === 'string') return path.join(PNPM, spec)
  const name = fs.readdirSync(PNPM).find((d) => spec.test(d))
  if (!name) throw new Error(`pacote ${spec} ausente de ${PNPM}`)
  const inner = path.join(PNPM, name, 'node_modules')
  return path.join(inner, name.split('@')[0] || `@${name.split('@')[1]}`)
}
const MAP = Object.fromEntries(
  Object.entries(TW3).map(([name, spec]) => [name, dirOf(spec)])
)
for (const [name, dir] of Object.entries(MAP))
  if (!fs.existsSync(path.join(dir, 'package.json')))
    throw new Error(`${name}: ${dir} sem package.json`)
const original = Module._resolveFilename
Module._resolveFilename = function resolve(request, parent, ...rest) {
  for (const [name, dir] of Object.entries(MAP))
    if (request === name || request.startsWith(`${name}/`))
      return original.call(
        this,
        dir + request.slice(name.length),
        parent,
        ...rest
      )
  return original.call(this, request, parent, ...rest)
}
const requireTw3 = createRequire(path.join(work, 'tailwind.config.cjs'))
const tailwind3 = requireTw3('tailwindcss')
const autoprefixer = requireTw3('autoprefixer')
const version3 = requireTw3('tailwindcss/package.json').version
if (version3 !== '3.4.17')
  throw new Error(`Tailwind ${version3}; a produção usa 3.4.17`)
const config3 = requireTw3(path.join(work, 'tailwind.config.cjs'))
const prefixer = autoprefixer(
  requireTw3(path.join(work, 'postcss.config.cjs')).plugins?.autoprefixer ?? {}
)
const tokens = [
  'packages/design-tokens/src/theme.css',
  'packages/design-tokens/src/tokens.css',
]
  .map((f) => fs.readFileSync(path.join(repo, f), 'utf8'))
  .join('\n')
async function compile3(classes, css) {
  const input =
    css ??
    `${tokens}\n${fs.readFileSync(path.join(work, 'app', 'globals.css'), 'utf8')}`
  const result = await postcss([
    tailwind3({
      ...config3,
      content: [{ raw: classes.join(' '), extension: 'html' }],
    }),
    prefixer,
  ]).process(input, { from: path.join(work, 'app', 'globals.css') })
  return result.root
}

// ---- Tailwind 4 do projeto: classes usadas ------------------------------------------------------------------------
const entry = path.join(
  repo,
  'packages',
  'frontend',
  'src',
  'app',
  'styles',
  'globals.web.css'
)
const product = await postcss([
  tailwind4({
    base: path.join(repo, 'apps', 'clients', 'web'),
    optimize: false,
  }),
]).process(fs.readFileSync(entry, 'utf8'), { from: entry })
const used = P.productClasses(product.root)
const plan = P.planOf(used)
const { items, controls } = P.itemsOf(plan.bases)

// ---- produção ---------------------------------------------------------------------------------------------------
const itemClasses = [
  ...new Set(
    [...items, ...controls].flatMap((it) => it.classes).map(P.toProduction)
  ),
]
const frames = P.uiFrames(repo, fs, path)
const comboClasses = P.COMBOS.flatMap((c) => {
  const k = P.comboClasses(c, frames)
  return [
    ...k.production,
    ...k.parentProduction,
    ...(c.childClasses ?? []).flatMap((s) => s.split(' ')).map(P.toProduction),
  ]
}).filter(Boolean)
// Classes dos componentes da produção comparados como elementos de foco (achado 128).
const focusClasses = P.FOCUS_ELEMENTS.flatMap((e) => e.producao)
const sheet3 = P.prepareSheet(
  await compile3([
    ...new Set([...itemClasses, ...comboClasses, ...focusClasses]),
  ])
)
const utilities3 = await compile3(
  [...new Set(plan.bases.map(P.toProduction))],
  '@tailwind components;\n@tailwind utilities;'
)
const generated3 = new Set()
utilities3.walkRules((rule) => {
  for (const sel of rule.selectors) {
    const cls = [
      ...sel.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^0-9a-fA-F]|[\w-])+)/g),
    ]
      .map((m) => P.unescapeCss(m[1]))
      .find((t) => !/^(group|peer|dark)(\/.*)?$/.test(t))
    if (cls) generated3.add(cls)
  }
})
// Classes próprias da produção (app/globals.css da main, fora do Tailwind): contam como geradas.
const globals = fs.readFileSync(path.join(work, 'app', 'globals.css'), 'utf8')
for (const m of globals.matchAll(/\.([a-z][\w-]*)\s*[{,:]/g))
  generated3.add(m[1])

const controlStyles = {}
for (const c of controls)
  controlStyles[c.key] = P.flatStyle(
    P.styleOfClasses(sheet3, c.classes.map(P.toProduction), {
      tag: c.tag,
      children: c.children,
    })
  )
const bases = {}
for (const it of items) {
  const production = P.toProduction(it.base)
  const entryOf = (bases[it.base] ??= {
    producao: production,
    gerada: generated3.has(production),
    modos: {},
  })
  const style = P.flatStyle(
    P.styleOfClasses(sheet3, it.classes.map(P.toProduction), {
      tag: it.tag,
      children: it.children,
    })
  )
  entryOf.modos[it.mode] = {
    controle: it.control,
    delta: P.deltaOf(style, controlStyles[it.control]),
  }
}
const probes = plan.chains.map((c) => `${c}:${P.PROBE}`)
const variants3 = P.variantEntries(
  P.flattenCss(await compile3(probes, '@tailwind utilities;')),
  plan.chains
)
const chains = Object.fromEntries(
  plan.chains.map((c) => [
    c,
    variants3.has(c) ? { entradas: variants3.get(c).entries } : null,
  ])
)
const combos = {}
for (const combo of P.COMBOS) {
  const k = P.comboClasses(combo, frames)
  const opts = {
    ...P.comboOptions(combo, k.parentProduction),
    childClasses: (combo.childClasses ?? []).map((s) =>
      s.split(' ').filter(Boolean).map(P.toProduction).join(' ')
    ),
  }
  const el = P.flatStyle(P.styleOfClasses(sheet3, k.production, opts))
  const ctrl = P.flatStyle(
    P.styleOfClasses(sheet3, [], { ...opts, childClasses: [] })
  )
  combos[combo.name] = { controle: ctrl, delta: P.deltaOf(el, ctrl) }
}

const elements = {}
for (const c of P.ELEMENT_CHECKS)
  elements[`${c.name} | ${c.target ? `${c.target} ` : ''}${c.prop}`] =
    P.elementCheckValue(sheet3, c)

// Contorno do componente da produção em cada passada de foco (todas, para qualquer elemento).
const focus = Object.fromEntries(
  P.FOCUS_ELEMENTS.map((e) => [
    e.name,
    Object.fromEntries(
      Object.keys(P.FOCUS_PASSES).map((pass) => [
        pass,
        P.focusOutline(sheet3, e.producao, e, pass),
      ])
    ),
  ])
)

const fixture = {
  producao: `main ${MAIN}, Tailwind ${version3} (tailwind.config.cjs, app/globals.css)`,
  gerador: 'tests/visual/support/tailwind-parity-fixture.mjs',
  classes: used.size,
  controles: controlStyles,
  utilitarios: bases,
  cadeias: chains,
  combinacoes: combos,
  elementos: elements,
  foco: focus,
}
const out = path.join(
  repo,
  'tests',
  'visual',
  'tailwind-parity',
  'production.json'
)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `${JSON.stringify(fixture, null, 1)}\n`)
for (const f of written.reverse()) fs.unlinkSync(f)
for (const d of ['design-tokens/output', 'design-tokens', 'app', '.'])
  fs.rmdirSync(path.join(work, d))
console.log(
  `production.json: ${used.size} classes, ${plan.bases.length} utilitários, ${plan.chains.length} cadeias, ${P.COMBOS.length} combinações, ${P.FOCUS_ELEMENTS.length} elementos de foco`
)
