#!/usr/bin/env node
// Gera tests/visual/tailwind-parity/production.json: o estilo canônico que a PRODUÇÃO (main eb4c0098, Tailwind 3.4.17 +
// tailwind.config.cjs + app/globals.css fixados em production-sources/) dá a cada utilitário, cadeia de variantes e combinação
// usados hoje no código do produto. O teste tests/visual/tailwind-parity.test.ts compara o CSS atual com essa fixture.
// A antiga app/globals.css da raiz foi retirada em F; a fonte acima é um blob histórico fixado, não runtime atual.
//
// Precisa do Tailwind 3.4.17 e dos plugins da main instalados (não são dependências do projeto): por padrão, no
// armazenamento do pnpm do repositório; --pnpm <pasta> aponta outro. Os tokens nomeados do design-tokens (tokens.css e
// theme.css) entram antes do CSS da main: `bg-[var(--brand)]` compara o mecanismo da classe (o valor de cada token é
// conferido com a produção em primitives.test.ts).
//
// Uso: node tests/visual/support/tailwind-parity-fixture.mjs [--pnpm <node_modules/.pnpm>] [--work <pasta temporária>] [--out <arquivo>]
import { createHash } from 'node:crypto'
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
const SOURCE_COMMIT = 'eb4c0098d5d8686b8d72e9aaf560968bb65274e4'
const OUTPUT = path.resolve(
  opt('--out', path.join(repo, 'tests/visual/tailwind-parity/production.json'))
)
const TW3 = {
  tailwindcss: 'tailwindcss@3.4.17/node_modules/tailwindcss',
  'tailwindcss-animate':
    'tailwindcss-animate@1.0.7_tailwindcss@3.4.17/node_modules/tailwindcss-animate',
  'tailwind-scrollbar': /^tailwind-scrollbar@4\.0\.2_.*tailwindcss@3\.4\.17$/,
  autoprefixer: /^autoprefixer@10\.4\.24(?:_|$)/,
}
const requireRoot = createRequire(path.join(repo, 'package.json'))
const postcss = requireRoot('postcss')
const tailwind4 = requireRoot('@tailwindcss/postcss')

// ---- fontes canônicas arquivadas (sem depender do histórico Git) ------------------------------------------------
const sources = path.join(
  repo,
  'tests/visual/tailwind-parity/production-sources'
)
const sourcePaths = [
  'tailwind.config.cjs',
  'postcss.config.cjs',
  'app/globals.css',
  'design-tokens/output/tokens-tailwind.json',
]
const readSource = (file) => {
  const segments = file.split('/')
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  )
    throw new Error('Caminho de fonte canônica inválido')
  let current = sources
  if (
    !fs.lstatSync(current).isDirectory() ||
    fs.lstatSync(current).isSymbolicLink()
  )
    throw new Error('Pasta de fontes canônicas inválida')
  for (let index = 0; index < segments.length; index++) {
    current = path.join(current, segments[index])
    const stat = fs.lstatSync(current)
    if (
      stat.isSymbolicLink() ||
      (index === segments.length - 1 ? !stat.isFile() : !stat.isDirectory())
    )
      throw new Error(
        'Fonte canônica deve ser arquivo regular sem links: ' + file
      )
  }
  return fs.readFileSync(current)
}
const sourceManifest = JSON.parse(readSource('manifest.json').toString())
if (
  sourceManifest.schemaVersion !== 1 ||
  sourceManifest.sourceCommit !== SOURCE_COMMIT ||
  sourceManifest.tailwindVersion !== '3.4.17' ||
  !Array.isArray(sourceManifest.files) ||
  sourceManifest.files.length !== sourcePaths.length ||
  new Set(sourceManifest.files.map((file) => file.path)).size !==
    sourcePaths.length ||
  sourceManifest.files.some((file) => !sourcePaths.includes(file.path))
)
  throw new Error(
    'Manifesto de fontes canônicas ausente, incompleto ou divergente da produção'
  )
const canonical = sourcePaths.map((file) => {
  const expected = sourceManifest.files.find((entry) => entry.path === file)
  if (
    !Number.isSafeInteger(expected.bytes) ||
    expected.bytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(expected.sha256) ||
    !/^[a-f0-9]{40}$/.test(expected.gitBlob) ||
    !['100644', '100755'].includes(expected.mode)
  )
    throw new Error('Metadados de fonte canônica inválidos: ' + file)
  if (expected.fixture !== file + '.source')
    throw new Error('Caminho de fixture canônica inválido: ' + file)
  const bytes = readSource(expected.fixture)
  const gitBlob = createHash('sha1')
    .update('blob ' + bytes.length + '\0')
    .update(bytes)
    .digest('hex')
  if (
    bytes.length !== expected.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== expected.sha256 ||
    gitBlob !== expected.gitBlob
  )
    throw new Error(
      'Fonte canônica não corresponde aos bytes da produção: ' + file
    )
  return { file, bytes }
})
// Valida todas as fontes antes de criar ou escrever qualquer saída temporária.
const work = fs.mkdtempSync(
  path.join(path.resolve(opt('--work', os.tmpdir())), 'tailwind-parity-main-')
)
const written = []
for (const { file, bytes } of canonical) {
  const out = path.join(work, file)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, bytes)
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
const expectedVersions = {
  tailwindcss: '3.4.17',
  'tailwindcss-animate': '1.0.7',
  'tailwind-scrollbar': '4.0.2',
  autoprefixer: '10.4.24',
}
for (const [name, dir] of Object.entries(MAP)) {
  const packageFile = path.join(dir, 'package.json')
  if (!fs.existsSync(packageFile))
    throw new Error(name + ': ' + dir + ' sem package.json')
  const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version
  if (version !== expectedVersions[name])
    throw new Error(
      name + ' ' + version + '; a produção usa ' + expectedVersions[name]
    )
}
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
const out = OUTPUT
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, `${JSON.stringify(fixture, null, 1)}\n`)
for (const f of written.reverse()) fs.unlinkSync(f)
for (const d of ['design-tokens/output', 'design-tokens', 'app', '.'])
  fs.rmdirSync(path.join(work, d))
console.log(
  `production.json: ${used.size} classes, ${plan.bases.length} utilitários, ${plan.chains.length} cadeias, ${P.COMBOS.length} combinações, ${P.FOCUS_ELEMENTS.length} elementos de foco`
)
