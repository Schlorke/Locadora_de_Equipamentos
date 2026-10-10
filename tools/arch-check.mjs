#!/usr/bin/env node
// Context Window architecture gate for product repositories:
//   apps/clients/{web,mobile} + packages/{frontend (FSD), ui, design-tokens}.
// Uses the workspace TypeScript parser. Resolves imports and runtime reachability, checking:
//   FSD layer order, slice isolation, @x cross-imports, slice public APIs, wildcard public APIs,
//   foundations never importing upward, thin clients importing only package entry points,
//   runtime boundaries (universal / .web / .native) and server-only packages.
//   Ratcheted rules (WORKSPACE-ESCAPE, UNIVERSAL-DOM-JSX, UNIVERSAL-WEB-LIB and, for the legacy root declared in
//   arch.config.json legacyRoots, LEGACY-DEEP-IMPORT, LEGACY-DOM-JSX, LEGACY-WEB-LIB) are tolerated only up to the
//   versioned per-file baseline (tools/arch-baseline.json); a new file or a higher count fails. The legacy rules
//   keep debt moved into explicitly configured legacy roots from reading as a reduction. The former root app/ and
//   lib/ were retired in F; adversarial fixtures still configure them to characterize the compatibility rules.
//   tools/ratchet-guard.mjs anchors the baseline itself to the base branch (CI), including renames.
// Usage: node arch-check.mjs [--root <dir>] [--json] [--update-baseline | --init-baseline]
//   --update-baseline  lowers baseline entries to the current counts (never raises or adds an entry)
//   --init-baseline    creates the baseline from the current counts, only when no baseline file exists
// Reference: Feature-Sliced Design docs (layers, public API), https://feature-sliced.design/docs/reference
import fs from 'node:fs'
import {
  analyzeRuntime,
  createImportResolver,
  sourceFacts,
} from './arch-runtime.mjs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const LAYERS = [
  'app',
  'pages',
  'widgets',
  'features',
  'entities',
  'shared',
]
const SLICED = new Set(['pages', 'widgets', 'features', 'entities'])
const CODE_EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
// The former root .next was retired in F; this name-based list still skips generated directories inside hosts.
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'dist-export',
  'build',
  '.expo',
  'android',
  'ios',
  '.turbo',
  'coverage',
  'out',
])
const BAD_SEGMENTS = new Set([
  'components',
  'hooks',
  'types',
  'utils',
  'helpers',
])
const NODE_BUILTINS = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]))
const WEB_ONLY = [/^react-dom(\/|$)/, /^next(\/|$)/]
const NATIVE_ONLY = [
  /^react-native(\/|$)/,
  /^expo(-[a-z0-9-]+)?(\/|$)/,
  /^@expo\//,
  /^@react-native\//,
]
const SERVER_ONLY_MODULES = [
  /^server-only$/,
  /^@prisma\/client(\/|$)/,
  /^prisma(\/|$)/,
]

/** Rules whose current debt is frozen per file by the baseline and may only decrease. */
export const RATCHET_RULES = [
  'UNIVERSAL-DOM-JSX',
  'UNIVERSAL-WEB-LIB',
  'WORKSPACE-ESCAPE',
  'LEGACY-DEEP-IMPORT',
  'LEGACY-DOM-JSX',
  'LEGACY-WEB-LIB',
]
const DEFAULT_BASELINE = 'tools/arch-baseline.json'

const DEFAULT_CONFIG = {
  frontend: 'packages/frontend',
  foundations: { ui: 'packages/ui', tokens: 'packages/design-tokens' },
  clients: { web: 'apps/clients/web', mobile: 'apps/clients/mobile' },
  clientEntrypoints: ['app', 'pages/*'],
  serverOnlyPackages: [],
}

export function loadConfig(root) {
  const file = path.join(root, 'arch.config.json')
  const user = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {}
  return {
    ...DEFAULT_CONFIG,
    ...user,
    foundations: { ...DEFAULT_CONFIG.foundations, ...user.foundations },
    clients: { ...DEFAULT_CONFIG.clients, ...user.clients },
  }
}

function posix(p) {
  return p.split(path.sep).join('/')
}

function readPackages(root) {
  const packages = []
  const visit = (dir, depth) => {
    if (depth > 3) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    if (
      entries.some((e) => e.isFile() && e.name === 'package.json') &&
      dir !== root
    ) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
      )
      packages.push({
        name: pkg.name,
        dir,
        runtime: pkg.contextWindow?.runtime ?? null,
        exports: pkg.exports ?? null,
      })
    }
    for (const e of entries)
      if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
        visit(path.join(dir, e.name), depth + 1)
  }
  for (const top of ['apps', 'packages']) visit(path.join(root, top), 1)
  return packages
}

function listFiles(dir) {
  const files = []
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.'))
          walk(path.join(d, e.name))
      } else if (
        CODE_EXT.includes(path.extname(e.name)) &&
        !/\.d\.ts$/.test(e.name) &&
        // Metro/Node tooling config — not universal app code (RUNTIME-NODE would false-positive).
        e.name !== 'metro.config.js'
      ) {
        files.push(path.join(d, e.name))
      }
    }
  }
  walk(dir)
  return files
}

/** Removes comments while keeping strings (so string content never looks like code). */
export function stripComments(src) {
  let out = ''
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += n ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const chunk = src.slice(i, end === -1 ? src.length : end + 2)
      out += chunk.replace(/[^\n]/g, ' ')
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    out += c
    i += 1
  }
  return out
}

export function extractImports(src, file = 'source.tsx') {
  return sourceFacts(src, file).imports
}

/** Test code may use test harnesses (providers, react-dom/server) but product code may not import it. */
export function isTestFile(file) {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) ||
    file.split(/[\\/]/).includes('__tests__')
  )
}

function platformOf(file) {
  const base = path.basename(file)
  if (/\.web\.[cm]?[jt]sx?$/.test(base)) return 'web'
  if (/\.(native|ios|android)\.[cm]?[jt]sx?$/.test(base)) return 'native'
  return 'universal'
}

const indexCache = new Map()
function hasIndex(dir) {
  if (!indexCache.has(dir))
    indexCache.set(
      dir,
      CODE_EXT.some((ext) => fs.existsSync(path.join(dir, `index${ext}`)))
    )
  return indexCache.get(dir)
}

/** Slice of a path inside a sliced layer, supporting slice groups (group folder without index). */
function sliceOf(srcRoot, layer, parts) {
  const first = parts[1]
  if (!first) return { slice: null, rest: [] }
  const firstDir = path.join(srcRoot, layer, first)
  if (
    !hasIndex(firstDir) &&
    parts[2] &&
    hasIndex(path.join(firstDir, parts[2]))
  )
    return { slice: `${first}/${parts[2]}`, rest: parts.slice(3) }
  return { slice: first, rest: parts.slice(2) }
}

function classify(file, ctx) {
  const rel = (dir) => path.relative(dir, file)
  const inside = (dir) => {
    const r = rel(dir)
    return !r.startsWith('..') && !path.isAbsolute(r)
  }
  const fe = path.join(ctx.root, ctx.config.frontend)
  if (inside(path.join(fe, 'src'))) {
    const parts = posix(rel(path.join(fe, 'src'))).split('/')
    const layer = parts[0]
    const sliced = SLICED.has(layer)
    const { slice, rest } = sliced
      ? sliceOf(path.join(fe, 'src'), layer, parts)
      : { slice: null, rest: parts.slice(1) }
    return {
      kind: 'frontend',
      layer: LAYERS.includes(layer) ? layer : null,
      rawLayer: layer,
      slice,
      rest,
      platform: platformOf(file),
    }
  }
  if (inside(fe)) return { kind: 'frontend-root', platform: platformOf(file) }
  for (const [role, dir] of Object.entries(ctx.config.foundations))
    if (inside(path.join(ctx.root, dir)))
      return { kind: 'foundation', role, platform: platformOf(file) }
  for (const [role, dir] of Object.entries(ctx.config.clients))
    if (inside(path.join(ctx.root, dir)))
      return {
        kind: 'client',
        role,
        platform: role === 'web' ? 'web' : 'native',
      }
  const pkg = ctx.packages.find((p) => inside(p.dir))
  return { kind: 'other', pkg: pkg?.name ?? null, platform: platformOf(file) }
}

function packageOfSpec(spec) {
  if (spec.startsWith('@')) {
    const [scope, name, ...rest] = spec.split('/')
    return { name: `${scope}/${name}`, subpath: rest.join('/') }
  }
  const [name, ...rest] = spec.split('/')
  return { name, subpath: rest.join('/') }
}

function globMatch(pattern, value) {
  const re = new RegExp(
    `^${pattern
      .split('*')
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]+')}$`
  )
  return re.test(value)
}

export function baselinePath(root, config = loadConfig(root)) {
  return path.resolve(root, config.ratchetBaseline || DEFAULT_BASELINE)
}

/** Reads the ratchet baseline. A missing file is an empty baseline: every ratcheted violation fails. */
export function readBaseline(file) {
  const baseline = {
    exists: fs.existsSync(file),
    files: {},
    total: 0,
    errors: [],
  }
  if (!baseline.exists) return baseline
  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    baseline.errors.push(`baseline is not valid JSON: ${error.message}`)
    return baseline
  }
  for (const [name, rules] of Object.entries(data?.files ?? {})) {
    for (const [rule, count] of Object.entries(rules ?? {})) {
      if (!RATCHET_RULES.includes(rule))
        baseline.errors.push(`${name}: "${rule}" is not a ratcheted rule`)
      else if (!Number.isInteger(count) || count < 1)
        baseline.errors.push(
          `${name}: ${rule} count must be a positive integer`
        )
      else {
        baseline.files[name] ??= {}
        baseline.files[name][rule] = count
        baseline.total += count
      }
    }
  }
  if (data?.total !== baseline.total)
    baseline.errors.push(
      `declared total ${data?.total} differs from the sum of the entries (${baseline.total})`
    )
  // `rules` lists the ratcheted rules the file was written with; a rule added later starts with no entries.
  const recorded = Array.isArray(data?.rules) ? data.rules : null
  for (const rule of recorded ?? [])
    if (!RATCHET_RULES.includes(rule))
      baseline.errors.push(
        `"rules" lists "${rule}", which is not a ratcheted rule`
      )
  for (const [name, rules] of Object.entries(baseline.files)) {
    for (const rule of Object.keys(rules))
      if (recorded && !recorded.includes(rule))
        baseline.errors.push(
          `${name}: ${rule} has entries but is missing from "rules"`
        )
  }
  if (data?.totalsByRule !== undefined) {
    const { byRule } = totals(baseline.files)
    for (const rule of RATCHET_RULES) {
      const declared =
        data.totalsByRule?.[rule] ??
        (recorded && !recorded.includes(rule) ? 0 : undefined)
      if (declared !== byRule[rule])
        baseline.errors.push(
          `declared ${rule} total ${data.totalsByRule?.[rule]} differs from the sum of its entries (${byRule[rule]})`
        )
    }
  }
  return baseline
}

/** Counts ratcheted violations per file and rule. */
export function countRatcheted(violations) {
  const counts = {}
  for (const v of violations) {
    if (!RATCHET_RULES.includes(v.rule)) continue
    counts[v.file] ??= {}
    counts[v.file][v.rule] = (counts[v.file][v.rule] ?? 0) + 1
  }
  return counts
}

const totals = (files) => {
  const byRule = Object.fromEntries(RATCHET_RULES.map((rule) => [rule, 0]))
  for (const rules of Object.values(files))
    for (const [rule, count] of Object.entries(rules)) byRule[rule] += count
  return {
    total: Object.values(byRule).reduce((sum, count) => sum + count, 0),
    byRule,
    files: Object.keys(files).length,
  }
}

/**
 * Splits ratcheted violations into tolerated (count within the file's baseline) and failing (a file/rule pair
 * above its baseline, including pairs the baseline does not know). Non-ratcheted violations always fail.
 */
export function applyRatchet(violations, baseline) {
  const counts = countRatcheted(violations)
  const failing = []
  const tolerated = []
  for (const v of violations) {
    if (!RATCHET_RULES.includes(v.rule)) {
      failing.push(v)
      continue
    }
    const current = counts[v.file][v.rule]
    const allowed = baseline.files[v.file]?.[v.rule] ?? 0
    if (current > allowed)
      failing.push({
        ...v,
        message: `${v.message} [ratchet: ${current} > baseline ${allowed}]`,
      })
    else tolerated.push(v)
  }
  const reducible = []
  for (const [file, rules] of Object.entries(baseline.files)) {
    for (const [rule, allowed] of Object.entries(rules)) {
      const current = counts[file]?.[rule] ?? 0
      if (current < allowed)
        reducible.push({ file, rule, baseline: allowed, current })
    }
  }
  return { failing, tolerated, reducible, counts }
}

/** Lowers every baseline entry to the current count; never raises an entry nor admits a new file or rule. */
export function tightenBaseline(files, counts) {
  const next = {}
  for (const [file, rules] of Object.entries(files)) {
    for (const [rule, allowed] of Object.entries(rules)) {
      const kept = Math.min(allowed, counts[file]?.[rule] ?? 0)
      if (kept > 0) {
        next[file] ??= {}
        next[file][rule] = kept
      }
    }
  }
  return next
}

export function serializeBaseline(files) {
  const sorted = {}
  for (const file of Object.keys(files).sort())
    sorted[file] = Object.fromEntries(
      Object.keys(files[file])
        .sort()
        .map((rule) => [rule, files[file][rule]])
    )
  const summary = totals(sorted)
  return `${JSON.stringify(
    {
      $comment:
        'Ratchet of the architecture gate (pnpm arch). Counts per file and rule may only decrease: fix the code, then run pnpm arch --update-baseline. A file or rule missing here fails the gate.',
      rules: RATCHET_RULES,
      total: summary.total,
      totalsByRule: summary.byRule,
      files: sorted,
    },
    null,
    2
  )}\n`
}

export function check(root, { config = loadConfig(root) } = {}) {
  root = path.resolve(root)
  indexCache.clear()
  const packages = readPackages(root)
  const resolver = createImportResolver(root, packages)
  const ctx = { root, config, packages }
  const byName = new Map(packages.map((p) => [p.name, p]))
  const frontendDir = path.join(root, config.frontend)
  const frontendPkg = packages.find(
    (p) => path.resolve(p.dir) === path.resolve(frontendDir)
  )
  const uiPkg = packages.find(
    (p) =>
      path.resolve(p.dir) ===
      path.resolve(path.join(root, config.foundations.ui))
  )
  const serverOnly = new Set([
    ...config.serverOnlyPackages,
    ...packages.filter((p) => p.runtime === 'server').map((p) => p.name),
  ])
  const violations = []
  const warnings = []
  const add = (rule, file, line, message) =>
    violations.push({
      rule,
      file: posix(path.relative(root, file)),
      line,
      message,
    })

  if (!frontendPkg)
    add(
      'TOPOLOGY',
      path.join(root, config.frontend),
      0,
      `missing package at ${config.frontend}`
    )
  for (const [role, dir] of [
    ...Object.entries(config.foundations),
    ...Object.entries(config.clients),
  ]) {
    if (!fs.existsSync(path.join(root, dir, 'package.json')))
      add(
        'TOPOLOGY',
        path.join(root, dir),
        0,
        `missing ${role} package at ${dir}`
      )
  }

  const srcRoot = path.join(frontendDir, 'src')
  if (fs.existsSync(srcRoot)) {
    for (const e of fs.readdirSync(srcRoot, { withFileTypes: true })) {
      const full = path.join(srcRoot, e.name)
      if (e.isDirectory() && !LAYERS.includes(e.name))
        add(
          e.name === 'processes' ? 'FSD-DEPRECATED-LAYER' : 'FSD-UNKNOWN-LAYER',
          full,
          0,
          `"${e.name}" is not an FSD layer`
        )
      // The diagnostic's app/ is the frontend package subpath, not the former root app/ retired in F.
      if (e.isFile() && CODE_EXT.includes(path.extname(e.name)))
        add(
          'FSD-GLOBAL-BARREL',
          full,
          0,
          'no code at the FSD root: expose app/ and pages/* through package exports instead of a global barrel'
        )
      if (e.isDirectory() && SLICED.has(e.name)) {
        const checkSlice = (sliceDir, label) => {
          const index = CODE_EXT.map((ext) =>
            path.join(sliceDir, `index${ext}`)
          ).find((f) => fs.existsSync(f))
          if (!index)
            add(
              'FSD-PUBLIC-API',
              sliceDir,
              0,
              `slice ${label} has no index public API`
            )
          else if (
            /\bexport\s+\*\s+from\b/.test(
              stripComments(fs.readFileSync(index, 'utf8'))
            )
          )
            add(
              'FSD-WILDCARD-API',
              index,
              0,
              'wildcard re-export in a slice public API (list exports explicitly)'
            )
          for (const seg of fs
            .readdirSync(sliceDir, { withFileTypes: true })
            .filter((x) => x.isDirectory())) {
            if (BAD_SEGMENTS.has(seg.name))
              warnings.push({
                rule: 'FSD-SEGMENT-NAME',
                file: posix(path.relative(root, path.join(sliceDir, seg.name))),
                message: `segment "${seg.name}" describes essence, not purpose`,
              })
          }
        }
        for (const child of fs
          .readdirSync(full, { withFileTypes: true })
          .filter((x) => x.isDirectory())) {
          const childDir = path.join(full, child.name)
          const subSlices = fs
            .readdirSync(childDir, { withFileTypes: true })
            .filter(
              (x) => x.isDirectory() && hasIndex(path.join(childDir, x.name))
            )
          if (!hasIndex(childDir) && subSlices.length) {
            for (const f of fs.readdirSync(childDir, { withFileTypes: true })) {
              if (f.isFile() && CODE_EXT.includes(path.extname(f.name)))
                add(
                  'FSD-GROUP-CODE',
                  path.join(childDir, f.name),
                  0,
                  `slice group ${e.name}/${child.name} must not contain code`
                )
            }
            for (const s of subSlices)
              checkSlice(
                path.join(childDir, s.name),
                `${e.name}/${child.name}/${s.name}`
              )
          } else checkSlice(childDir, `${e.name}/${child.name}`)
        }
      }
    }
  }

  const scanDirs = [
    frontendDir,
    ...Object.values(config.foundations).map((d) => path.join(root, d)),
    ...Object.values(config.clients).map((d) => path.join(root, d)),
  ]
  for (const dir of scanDirs) {
    for (const file of listFiles(dir)) {
      const src = fs.readFileSync(file, 'utf8')
      const imports = extractImports(src, file)
      if (isTestFile(file)) continue
      const from = classify(file, ctx)
      for (const imp of imports) {
        if (
          (imp.spec.startsWith('.') || imp.spec.startsWith('/')) &&
          isTestFile(`${imp.spec}.ts`) &&
          !/\.[cm]?[jt]sx?$/.test(imp.spec)
        ) {
          add(
            'TEST-IMPORT',
            file,
            imp.line,
            `product code imports test code "${imp.spec}"`
          )
        } else if (isTestFile(imp.spec))
          add(
            'TEST-IMPORT',
            file,
            imp.line,
            `product code imports test code "${imp.spec}"`
          )
      }
      if (
        from.kind === 'frontend' &&
        from.layer === 'shared' &&
        from.rest[0] === 'ui' &&
        uiPkg
      ) {
        const delegates = imports.some(
          (imp) =>
            imp.spec === uiPkg.name || imp.spec.startsWith(`${uiPkg.name}/`)
        )
        if (!delegates)
          add(
            'UI-DUPLICATE-SOURCE',
            file,
            1,
            `shared/ui must delegate to ${uiPkg.name}; a second component source is not allowed`
          )
      }
      for (const imp of imports) {
        const { spec, line } = imp
        const isRelative = spec.startsWith('.') || spec.startsWith('/')
        let target = null
        let external = null
        if (isRelative) {
          const abs = path.resolve(path.dirname(file), spec)
          const fromPkg = packages.find(
            (p) => !path.relative(p.dir, file).startsWith('..')
          )
          const toPkg = packages.find(
            (p) => !path.relative(p.dir, abs).startsWith('..')
          )
          if (fromPkg && toPkg && fromPkg !== toPkg)
            add(
              'PACKAGE-BOUNDARY',
              file,
              line,
              `relative import "${spec}" crosses from ${fromPkg.name} into ${toPkg.name}; import the package entry point`
            )
          target = { ...classify(abs, ctx), abs }
        } else {
          const { name, subpath } = packageOfSpec(spec)
          const pkg = byName.get(name)
          if (pkg) {
            target = { kind: 'package', pkg, subpath }
          } else {
            const resolved = resolver.resolve(
              file,
              spec,
              from.platform === 'native' ? 'native' : 'web'
            )
            if (resolved.kind === 'local')
              target = { ...classify(resolved.file, ctx), abs: resolved.file }
            else external = spec
          }
        }

        // Server-only code never reaches clients or universal packages.
        const specName = packageOfSpec(spec).name
        if (
          !imp.typeOnly &&
          !isRelative &&
          (serverOnly.has(specName) ||
            SERVER_ONLY_MODULES.some((re) => re.test(spec)))
        ) {
          if (
            from.kind !== 'other' &&
            !(from.kind === 'client' && from.role === 'web')
          )
            add(
              'SERVER-ONLY',
              file,
              line,
              `"${spec}" is server-only and cannot be imported by ${from.kind}${from.role ? `/${from.role}` : ''}`
            )
        }

        // Runtime boundaries.
        if (external && !imp.typeOnly && from.kind !== 'other') {
          const universal =
            from.kind === 'frontend' ||
            from.kind === 'frontend-root' ||
            from.kind === 'foundation'
          if (
            NODE_BUILTINS.has(spec.split('/')[0]) ||
            NODE_BUILTINS.has(spec)
          ) {
            if (from.kind !== 'client' || from.role !== 'web')
              add(
                'RUNTIME-NODE',
                file,
                line,
                `Node built-in "${spec}" in ${from.kind} code`
              )
          }
          if (
            WEB_ONLY.some((re) => re.test(spec)) &&
            (from.platform === 'native' ||
              (universal && from.platform === 'universal'))
          ) {
            add(
              'RUNTIME-WEB-ONLY',
              file,
              line,
              `"${spec}" is web-only; move it to a .web.tsx variant or the web client`
            )
          }
          if (
            NATIVE_ONLY.some((re) => re.test(spec)) &&
            (from.platform === 'web' ||
              (universal && from.platform === 'universal'))
          ) {
            add(
              'RUNTIME-NATIVE-ONLY',
              file,
              line,
              `"${spec}" is native-only; move it to a .native.tsx variant or the mobile client`
            )
          }
        }

        if (!target) continue
        const toFrontendPath =
          target.kind === 'frontend'
            ? target
            : target.kind === 'package' && target.pkg === frontendPkg
              ? { kind: 'frontend-subpath', subpath: target.subpath }
              : null

        // Foundations never import upward.
        if (from.kind === 'foundation') {
          const toFoundation =
            target.kind === 'foundation'
              ? target.role
              : target.kind === 'package'
                ? Object.entries(config.foundations).find(
                    ([, d]) =>
                      path.resolve(path.join(root, d)) ===
                      path.resolve(target.pkg.dir)
                  )?.[0]
                : null
          if (
            toFrontendPath ||
            target.kind === 'client' ||
            (target.kind === 'package' &&
              Object.values(config.clients).some(
                (d) =>
                  path.resolve(path.join(root, d)) ===
                  path.resolve(target.pkg.dir)
              ))
          ) {
            add(
              'FOUNDATION-UPWARD',
              file,
              line,
              `foundation ${from.role} imports product/client code "${spec}"`
            )
          } else if (from.role === 'tokens' && toFoundation === 'ui') {
            add(
              'FOUNDATION-UPWARD',
              file,
              line,
              'design tokens must not depend on the UI package'
            )
          }
        }

        // Clients are thin: only package entry points, never each other.
        if (from.kind === 'client') {
          if (target.kind === 'client' && target.role !== from.role)
            add(
              'CLIENT-CROSS',
              file,
              line,
              `${from.role} client imports ${target.role} client code`
            )
          if (
            target.kind === 'package' &&
            Object.entries(config.clients).some(
              ([role, d]) =>
                role !== from.role &&
                path.resolve(path.join(root, d)) ===
                  path.resolve(target.pkg.dir)
            )
          )
            add(
              'CLIENT-CROSS',
              file,
              line,
              `${from.role} client imports the ${spec} client package`
            )
          if (toFrontendPath?.kind === 'frontend')
            add(
              'CLIENT-DEEP-IMPORT',
              file,
              line,
              `client reaches into packages/frontend internals via "${spec}"`
            )
          if (
            toFrontendPath?.kind === 'frontend-subpath' &&
            !config.clientEntrypoints.some((p) =>
              globMatch(p, toFrontendPath.subpath)
            )
          ) {
            add(
              'CLIENT-DEEP-IMPORT',
              file,
              line,
              `"${spec}" is not a frontend entry point (${config.clientEntrypoints.join(', ')})`
            )
          }
          if (
            target.kind === 'package' &&
            target.subpath &&
            target.pkg !== frontendPkg &&
            !target.pkg.exports?.[`./${target.subpath}`]
          ) {
            add(
              'CLIENT-DEEP-IMPORT',
              file,
              line,
              `"${spec}" is not an exported entry point of ${target.pkg.name}`
            )
          }
        }

        // FSD rules inside packages/frontend.
        if (from.kind === 'frontend' && from.layer) {
          if (toFrontendPath?.kind === 'frontend-subpath') {
            add(
              'FSD-SELF-PACKAGE',
              file,
              line,
              `use a relative import inside packages/frontend instead of "${spec}"`
            )
            continue
          }
          if (target.kind !== 'frontend' || !target.layer) continue
          const fromRank = LAYERS.indexOf(from.layer)
          const toRank = LAYERS.indexOf(target.layer)
          const sameSlice =
            from.layer === target.layer &&
            (!SLICED.has(from.layer) || from.slice === target.slice)
          if (sameSlice) continue
          if (toRank < fromRank) {
            add(
              'FSD-LAYER',
              file,
              line,
              `${from.layer} cannot import from the higher layer ${target.layer} ("${spec}")`
            )
            continue
          }
          if (toRank === fromRank) {
            const xapi = target.rest[0] === '@x'
            if (
              xapi &&
              from.layer === 'entities' &&
              target.rest[1]?.replace(/\.[cm]?[jt]sx?$/, '') ===
                from.slice.split('/').pop()
            )
              continue
            add(
              xapi ? 'FSD-XAPI' : 'FSD-SLICE',
              file,
              line,
              xapi
                ? `@x API ${target.slice}/@x/${target.rest[1]} is reserved for entities/${target.rest[1]}`
                : `${from.layer}/${from.slice} cannot import sibling slice ${target.layer}/${target.slice}`
            )
            continue
          }
          if (SLICED.has(target.layer)) {
            const rest = target.rest.filter(Boolean)
            const isIndex =
              rest.length === 0 ||
              (rest.length === 1 && /^index(\.[cm]?[jt]sx?)?$/.test(rest[0]))
            if (!isIndex)
              add(
                'FSD-PUBLIC-API',
                file,
                line,
                `import ${target.layer}/${target.slice} through its index, not "${spec}"`
              )
          }
        }
      }
    }
  }
  const runtime = analyzeRuntime(root, config, packages)
  violations.push(...runtime.violations)
  const baselineFile = baselinePath(root, config)
  const baseline = readBaseline(baselineFile)
  const applied = applyRatchet(violations, baseline)
  const baselineRel = posix(path.relative(root, baselineFile))
  for (const error of baseline.errors)
    applied.failing.push({
      rule: 'RATCHET-BASELINE',
      file: baselineRel,
      line: 0,
      message: error,
    })
  const ratchet = {
    baselineFile: baselineRel,
    baselineExists: baseline.exists,
    baseline: totals(baseline.files),
    current: totals(applied.counts),
    failing: applied.failing.filter((v) => RATCHET_RULES.includes(v.rule))
      .length,
    tolerated: applied.tolerated,
    reducible: applied.reducible,
    counts: applied.counts,
    baselineFiles: baseline.files,
    baselineValid: baseline.errors.length === 0,
  }
  return {
    violations: applied.failing,
    warnings,
    packages: packages.map((p) => p.name),
    runtime,
    ratchet,
  }
}

/** Human-readable gate report; the ratchet lines always show the baseline total for tracking. */
export function formatReport(result) {
  const lines = []
  for (const v of result.violations)
    lines.push(`${v.rule} ${v.file}:${v.line} ${v.message}`)
  for (const w of result.warnings)
    lines.push(`warning ${w.rule} ${w.file} ${w.message}`)
  const { ratchet } = result
  const byRule = (summary) =>
    RATCHET_RULES.map((rule) => `${rule} ${summary.byRule[rule]}`).join(', ')
  if (!ratchet.baselineExists)
    lines.push(
      `architecture ratchet: no baseline at ${ratchet.baselineFile}; every ${RATCHET_RULES.join('/')} violation fails`
    )
  lines.push(
    `architecture ratchet: baseline total ${ratchet.baseline.total} in ${ratchet.baseline.files} file(s) (${byRule(ratchet.baseline)}) [${ratchet.baselineFile}]`
  )
  lines.push(
    `architecture ratchet: current total ${ratchet.current.total} in ${ratchet.current.files} file(s) (${byRule(ratchet.current)}); ${ratchet.failing} above baseline`
  )
  if (ratchet.reducible.length) {
    const delta = ratchet.reducible.reduce(
      (sum, entry) => sum + entry.baseline - entry.current,
      0
    )
    lines.push(
      `architecture ratchet: ${ratchet.reducible.length} entr${ratchet.reducible.length === 1 ? 'y' : 'ies'} below baseline (-${delta}); run "pnpm arch --update-baseline" to lock in the reduction`
    )
  }
  lines.push(
    result.violations.length
      ? `\n${result.violations.length} architecture violation(s)`
      : `architecture gate passed (${result.packages.length} packages)`
  )
  return lines.join('\n')
}

/** Writes the baseline: init only creates a missing file; update only lowers existing entries. */
export function writeBaseline(
  root,
  result,
  mode,
  { config = loadConfig(root) } = {}
) {
  const file = baselinePath(root, config)
  const { ratchet } = result
  if (mode === 'init') {
    if (ratchet.baselineExists)
      throw new Error(
        `${ratchet.baselineFile} already exists; use --update-baseline, which can only lower it`
      )
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, serializeBaseline(ratchet.counts))
    return file
  }
  if (!ratchet.baselineExists)
    throw new Error(
      `${ratchet.baselineFile} does not exist; create it once with --init-baseline`
    )
  if (!ratchet.baselineValid)
    throw new Error(
      `${ratchet.baselineFile} is invalid; fix it before updating`
    )
  fs.writeFileSync(
    file,
    serializeBaseline(tightenBaseline(ratchet.baselineFiles, ratchet.counts))
  )
  return file
}

function main() {
  const args = process.argv.slice(2)
  let root = process.cwd()
  let asJson = false
  let baselineMode = null
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root') root = path.resolve(args[++i])
    else if (args[i] === '--json') asJson = true
    else if (args[i] === '--update-baseline' || args[i] === '--init-baseline') {
      if (baselineMode) {
        process.stderr.write(
          'use either --update-baseline or --init-baseline\n'
        )
        process.exit(64)
      }
      baselineMode = args[i] === '--init-baseline' ? 'init' : 'update'
    } else {
      process.stderr.write(`unknown argument ${args[i]}\n`)
      process.exit(64)
    }
  }
  let result = check(root)
  if (baselineMode) {
    try {
      const file = writeBaseline(root, result, baselineMode)
      process.stderr.write(
        `${baselineMode === 'init' ? 'created' : 'tightened'} ${posix(path.relative(root, file))}\n`
      )
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(64)
    }
    result = check(root)
  }
  if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else process.stdout.write(`${formatReport(result)}\n`)
  process.exit(result.violations.length ? 1 : 0)
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
const self = fileURLToPath(import.meta.url)
if (
  process.platform === 'win32'
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self
)
  main()
