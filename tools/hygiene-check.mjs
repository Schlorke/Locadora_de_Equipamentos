#!/usr/bin/env node
// Gate de higiene (pnpm hygiene). Reprova sobra que nenhum outro gate enxerga:
//   - arquivo, export, tipo, dependência, binário ou import sem dono, pelo knip (knip.jsonc) a partir das entradas
//     reais: raiz legada (app/, lib/, tools/, tests/, stories/), host web, host mobile e pacotes. Nos pacotes o knip
//     também cobra o export sem consumidor do próprio ponto de entrada (includeEntryExports);
//   - código que só um teste mantém vivo: um segundo passe do knip sem os testes (sem *.test/*.spec e pastas de
//     teste nas entradas e no project, plugins vitest e playwright desligados) acha o arquivo e o export que só são
//     alcançados por teste (test-only-file, test-only-export). O teste colocado é obrigatório (check:test-names),
//     então sem este passe todo módulo morto com teste passaria;
//   - variante .native sem irmã web/universal nem entrada em "exports" (o knip não resolve o sufixo do Metro, então
//     knip.jsonc trata cada .native como entrada e esta regra impede que uma .native morta se esconda assim). O
//     export de uma .native vale o da irmã, que o Metro troca por ela: sai do relatório quando a irmã exporta o mesmo
//     nome e fica quando só a .native o tem (ninguém o alcança);
//   - CSS sem importador nos workspaces em que o knip não lê CSS (ele avisa: project-extension-unregistered);
//   - tag JSDoc que esconde export do knip: o knip nunca reporta export marcado com public, beta ou alias;
//   - saída de ferramenta e de depuração (Playwright, cobertura, builds, caches, logs) fora do .gitignore ou versionada;
//   - pacote que o código de um workspace importa sem declarar no package.json dele (workspace-unlisted): o knip
//     aceita a dependência declarada só na raiz, e o workspace quebra quando a raiz sai ou é podada (E24 da onda 135).
//     Vale para o código de produção; teste, story e config de ferramenta de teste usam o ferramental da raiz;
//   - exceção velha: item da linha de base que já não acontece e dica do knip de exceção ou entrada que sobrou.
// O que ainda espera decisão fica em tools/hygiene-baseline.json, cada item com o motivo. A linha de base só
// encolhe: um item novo nela é barrado pelo ratchet-guard (tools/ratchet-guard.mjs), que também barra exceção nova
// no knip.jsonc sem aprovação em tools/ratchet-transfers.json.
//
// Uso: node tools/hygiene-check.mjs [--root <dir>] [--json]
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const BASELINE_FILE = 'tools/hygiene-baseline.json'
export const KNIP_CONFIG = 'knip.jsonc'
const REPORTER = fileURLToPath(
  new URL('./hygiene-knip-reporter.mjs', import.meta.url)
)
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const MIN_REASON = 12

/** Tipos de achado do knip que o gate cobra (os que o knip.jsonc não desliga) e os deste script. */
export const FINDING_TYPES = new Set([
  'files',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
  'exports',
  'nsExports',
  'types',
  'nsTypes',
  'enumMembers',
  'namespaceMembers',
  'duplicates',
  'catalog',
  'catalogReferences',
  'native-orphan',
  'test-only-file',
  'test-only-export',
  'css-orphan',
  'export-tag',
  'tool-output-not-ignored',
  'tool-output-tracked',
  'workspace-unlisted',
])
/** Achados de arquivo: o item da linha de base não leva "names", salvo quando o caminho é um glob (ver readBaseline). */
export const FILE_LEVEL_TYPES = new Set([
  'files',
  'native-orphan',
  'test-only-file',
  'css-orphan',
])
/** Dicas do knip que apontam exceção ou entrada que já não serve: reprovam como item velho da linha de base. */
export const FAILING_HINTS = new Set([
  'ignore',
  'ignoreFiles',
  'ignoreBinaries',
  'ignoreDependencies',
  'ignoreUnresolved',
  'ignoreWorkspaces',
  'workspaces',
  'entry-empty',
  'entry-redundant',
  'project-empty',
])
/**
 * Saídas de ferramenta e de depuração local. `rule` é a linha do .gitignore que as descreve (sintaxe do git; pasta
 * termina em "/") e acha o arquivo versionado; cada caminho de `samples` precisa ser ignorado pelo .gitignore da raiz
 * (pasta termina em "/"). Um `git add .` (o .husky/pre-commit roda um) versionaria o que o .gitignore não cobre.
 */
export const TOOL_OUTPUTS = [
  // MCP do Playwright; Playwright (resultados, relatório, blobs e cache).
  { rule: '.playwright-mcp/', samples: ['.playwright-mcp/'] },
  { rule: 'test-results/', samples: ['test-results/'] },
  { rule: 'playwright-report/', samples: ['playwright-report/'] },
  { rule: 'blob-report/', samples: ['blob-report/'] },
  // vitest --coverage, na raiz ou num workspace.
  { rule: 'coverage/', samples: ['coverage/', 'packages/ui/coverage/'] },
  // pnpm visual:capture e build-storybook.
  { rule: '.tmp/visual/current/', samples: ['.tmp/visual/current/'] },
  { rule: 'storybook-static/', samples: ['storybook-static/'] },
  // Builds e caches do Next, do Expo, do gerador OpenAPI, do Turborepo e do TypeScript incremental.
  { rule: '.next/', samples: ['.next/', 'apps/clients/web/.next/'] },
  { rule: '.expo/', samples: ['apps/clients/mobile/.expo/'] },
  { rule: 'dist-export/', samples: ['apps/clients/mobile/dist-export/'] },
  { rule: '.openapi-gen/', samples: ['.openapi-gen/'] },
  { rule: '.turbo/', samples: ['.turbo/'] },
  {
    rule: '*.tsbuildinfo',
    samples: ['tsconfig.tsbuildinfo', 'apps/clients/web/tsconfig.tsbuildinfo'],
  },
  { rule: 'next-env.d.ts', samples: ['apps/clients/web/next-env.d.ts'] },
  { rule: '.eslintcache', samples: ['.eslintcache'] },
  { rule: '.stylelintcache', samples: ['.stylelintcache'] },
  // Logs e saídas redirecionadas de lint/build/teste: trazem caminhos da máquina (docs/architecture/security.md).
  {
    rule: '*.log',
    samples: ['build-web.log', 'apps/clients/web/next-dev.log'],
  },
  { rule: 'eslint-output.txt', samples: ['eslint-output.txt'] },
  { rule: 'build-output.txt', samples: ['build-output.txt'] },
  { rule: 'test-output.txt', samples: ['test-output.txt'] },
]

const toPosix = (value) => value.split(path.sep).join('/')
const isRecord = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const asList = (value) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

/** Glob simples de caminho: `**` atravessa pastas, `*` e `?` ficam dentro de um segmento. */
export function globToRegExp(pattern) {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*' && pattern[index + 1] === '*') {
      const slash = pattern[index + 2] === '/'
      source += slash ? '(?:.*/)?' : '.*'
      index += slash ? 2 : 1
    } else if (char === '*') source += '[^/]*'
    else if (char === '?') source += '[^/]'
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

const isGlob = (pattern) => /[*?]/.test(pattern)
const pathMatches = (pattern, file) =>
  isGlob(pattern) ? globToRegExp(pattern).test(file) : pattern === file

/** A parte literal de um glob, até a pasta antes do primeiro curinga: `lib/a/**` -> `lib/a/`. */
export function globBase(pattern) {
  const segments = pattern.split('/')
  const literal = []
  for (const segment of segments.slice(0, -1)) {
    if (isGlob(segment)) break
    literal.push(segment)
  }
  return literal.length ? `${literal.join('/')}/` : ''
}

/**
 * Lê a linha de base: { entries: [{ type, path, names?, reason }] }. Em item de arquivo (files, native-orphan,
 * test-only-file, css-orphan) `path` é o caminho e não há "names"; ou `path` é um glob e "names" lista cada arquivo
 * que ele aceita, relativo à parte literal do glob (um arquivo morto novo na pasta não entra calado). Nos outros tipos
 * `path` é o caminho exato e "names" lista os símbolos/dependências daquele arquivo. Devolve as entradas válidas e os
 * problemas de formato.
 */
export function readBaseline(text) {
  if (text === null) return { entries: [], problems: [] }
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      entries: [],
      problems: [`${BASELINE_FILE}: JSON inválido (${error.message})`],
    }
  }
  if (!isRecord(data) || !Array.isArray(data.entries))
    return {
      entries: [],
      problems: [`${BASELINE_FILE}: esperado { "entries": [...] }`],
    }
  const entries = []
  const problems = []
  const seen = new Set()
  for (const [index, entry] of data.entries.entries()) {
    const where = `${BASELINE_FILE} entries[${index}]`
    if (!isRecord(entry)) {
      problems.push(`${where}: cada item é um objeto`)
      continue
    }
    const fileLevel = FILE_LEVEL_TYPES.has(entry.type)
    const glob = typeof entry.path === 'string' && isGlob(entry.path)
    const namesValid =
      Array.isArray(entry.names) &&
      entry.names.length > 0 &&
      entry.names.every((name) => typeof name === 'string' && name)
    if (!FINDING_TYPES.has(entry.type))
      problems.push(
        `${where}: "type" desconhecido (${JSON.stringify(entry.type)})`
      )
    else if (typeof entry.path !== 'string' || entry.path.trim() === '')
      problems.push(`${where}: falta "path"`)
    else if (
      typeof entry.reason !== 'string' ||
      entry.reason.trim().length < MIN_REASON
    )
      problems.push(
        `${where} (${entry.path}): falta o motivo ("reason", ${MIN_REASON}+ caracteres)`
      )
    else if (glob && !fileLevel)
      problems.push(
        `${where} (${entry.path}): glob só vale em item de arquivo (${[...FILE_LEVEL_TYPES].join(', ')}); "${entry.type}" leva o caminho exato`
      )
    else if (fileLevel && !glob && entry.names !== undefined)
      problems.push(
        `${where} (${entry.path}): "${entry.type}" não leva "names"`
      )
    else if (fileLevel && glob && !namesValid)
      problems.push(
        `${where} (${entry.path}): glob precisa listar em "names" cada arquivo que aceita, relativo a "${globBase(entry.path)}"`
      )
    else if (!fileLevel && !namesValid)
      problems.push(
        `${where} (${entry.path}): "${entry.type}" precisa de "names" (lista não vazia)`
      )
    else {
      const key = `${entry.type} ${entry.path}`
      if (seen.has(key))
        problems.push(`${where}: "${key}" repetido; junte os nomes num item só`)
      seen.add(key)
      entries.push({
        type: entry.type,
        path: entry.path,
        names: fileLevel && !glob ? undefined : [...entry.names],
        base: fileLevel && glob ? globBase(entry.path) : undefined,
        reason: entry.reason.trim(),
      })
    }
  }
  return { entries, problems }
}

/** O nome com que um item da linha de base aceita o achado: o arquivo relativo ao glob ou o símbolo. */
const acceptedName = (entry, finding) =>
  entry.base !== undefined
    ? finding.file.slice(entry.base.length)
    : finding.name

/**
 * Cruza os achados com a linha de base: `failing` são os achados que nenhum item cobre; `stale` os itens (ou nomes
 * de um item) que não cobrem mais nada, porque a linha de base só encolhe e item velho esconderia a volta da sobra.
 */
export function applyBaseline(findings, entries) {
  const used = new Map(entries.map((entry) => [entry, new Set()]))
  const failing = []
  for (const finding of findings) {
    const entry = entries.find(
      (candidate) =>
        candidate.type === finding.type &&
        pathMatches(candidate.path, finding.file) &&
        (candidate.names === undefined ||
          candidate.names.includes(acceptedName(candidate, finding)))
    )
    if (entry)
      used
        .get(entry)
        .add(
          entry.names === undefined
            ? finding.file
            : acceptedName(entry, finding)
        )
    else failing.push(finding)
  }
  const stale = []
  for (const entry of entries) {
    const hits = used.get(entry)
    if (entry.names === undefined) {
      if (hits.size === 0) stale.push({ entry })
    } else
      for (const name of entry.names)
        if (!hits.has(name)) stale.push({ entry, name })
  }
  return { failing, stale }
}

/** Regras de um .gitignore: negação, só pasta (termina em "/"), ancorada (tem "/" no começo ou no meio). */
function gitignoreRules(text) {
  const rules = []
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '')
    if (!line || line.startsWith('#')) continue
    const negated = line.startsWith('!')
    if (negated) line = line.slice(1)
    const directoryOnly = line.endsWith('/')
    line = line.replace(/\/+$/, '')
    const anchored = line.includes('/')
    line = line.replace(/^\/+/, '')
    if (!line) continue
    rules.push({ negated, directoryOnly, anchored, regex: globToRegExp(line) })
  }
  return rules
}

/**
 * O .gitignore ignora `sample` (caminho relativo à raiz; pasta termina em "/") como o git: regra sem "/" no meio vale
 * em qualquer nível pelo nome, regra com "/" vale a partir da raiz, "/" no fim só casa pasta, a última regra que
 * alcança o caminho decide e o que está dentro de uma pasta ignorada não volta com "!".
 */
export function gitignoreCovers(text, sample) {
  const rules = gitignoreRules(text)
  const file = sample.endsWith('/') ? `${sample}sonda` : sample
  const segments = file.split('/')
  for (let depth = 1; depth <= segments.length; depth += 1) {
    const prefix = segments.slice(0, depth).join('/')
    const directory = depth < segments.length
    let ignored = false
    for (const rule of rules) {
      if (rule.directoryOnly && !directory) continue
      if (rule.regex.test(rule.anchored ? prefix : segments[depth - 1]))
        ignored = !rule.negated
    }
    if (ignored) return true
  }
  return false
}

/** Arquivos que fazem uma variante `.native` legítima: a irmã (mesmo nome, sem sufixo ou `.web`). */
const SIBLING_SUFFIXES = ['.ts', '.tsx', '.web.ts', '.web.tsx']
const NATIVE_FILE = /\.native\.(ts|tsx)$/

function walk(directory, visit) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, visit)
    else visit(absolute)
  }
}

const exportTargets = (value, into = new Set()) => {
  if (typeof value === 'string') into.add(value.replace(/^\.\//, ''))
  else if (Array.isArray(value))
    for (const item of value) exportTargets(item, into)
  else if (isRecord(value))
    for (const item of Object.values(value)) exportTargets(item, into)
  return into
}

const SOURCE = /\.(?:[cm]?[jt]sx?)$/
const EXPLICIT_NATIVE =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]*\.native)['"]/g

/**
 * Variantes .native de packages/* que nada alcança: sem irmã web/universal (o Metro troca a irmã pela .native), fora
 * de "exports" do pacote e sem import explícito pelo sufixo (`./native/Button.native`).
 */
export function nativeOrphans(root) {
  const findings = []
  const packagesDir = path.join(root, 'packages')
  if (!fs.existsSync(packagesDir)) return findings
  for (const name of fs.readdirSync(packagesDir).sort()) {
    const dir = path.join(packagesDir, name)
    const manifest = path.join(dir, 'package.json')
    if (!fs.existsSync(manifest)) continue
    const targets = exportTargets(
      JSON.parse(fs.readFileSync(manifest, 'utf8')).exports
    )
    const explicit = new Set()
    const natives = []
    walk(path.join(dir, 'src'), (file) => {
      if (NATIVE_FILE.test(file)) natives.push(file)
      if (!SOURCE.test(file)) return
      for (const match of fs
        .readFileSync(file, 'utf8')
        .matchAll(EXPLICIT_NATIVE)) {
        const base = path.resolve(path.dirname(file), match[1])
        explicit.add(`${base}.ts`)
        explicit.add(`${base}.tsx`)
      }
    })
    for (const file of natives) {
      const stem = file.replace(NATIVE_FILE, '')
      if (targets.has(toPosix(path.relative(dir, file)))) continue
      if (explicit.has(path.resolve(file))) continue
      if (SIBLING_SUFFIXES.some((suffix) => fs.existsSync(stem + suffix)))
        continue
      findings.push({
        type: 'native-orphan',
        file: toPosix(path.relative(root, file)),
      })
    }
  }
  return findings
}

let typescriptModule
/** O TypeScript do projeto (API clássica, createSourceFile); só carrega quando uma .native precisa da irmã. */
function loadTypeScript(root) {
  if (typescriptModule) return typescriptModule
  for (const base of [
    path.join(root, 'package.json'),
    path.join(REPO_ROOT, 'package.json'),
  ])
    for (const id of ['typescript', '@typescript/typescript6']) {
      try {
        const ts = createRequire(base)(id)
        if (typeof ts.createSourceFile === 'function') {
          typescriptModule = ts
          return ts
        }
      } catch {
        // próximo candidato
      }
    }
  throw new Error(
    'TypeScript (API clássica) não encontrado para ler os exports das irmãs das variantes .native (rode pnpm install)'
  )
}

/**
 * Nomes que um módulo exporta (declaração exportada, `export { }`, `export * as`, `export default`). `null` quando há
 * `export * from`, que esta leitura não segue: aí o nome pode existir e o achado da .native não sai do relatório.
 */
export function exportedNames(file, ts = loadTypeScript(REPO_ROOT)) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    false,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const names = new Set()
  const bind = (node) => {
    if (!node) return
    if (ts.isIdentifier(node)) names.add(node.text)
    else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node))
      for (const element of node.elements)
        if (!ts.isOmittedExpression(element)) bind(element.name)
  }
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      names.add('default')
      continue
    }
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) return null
      if (ts.isNamespaceExport(statement.exportClause))
        names.add(statement.exportClause.name.text)
      else
        for (const element of statement.exportClause.elements)
          names.add(element.name.text)
      continue
    }
    const modifiers = ts.canHaveModifiers(statement)
      ? (ts.getModifiers(statement) ?? [])
      : []
    if (!modifiers.some((item) => item.kind === ts.SyntaxKind.ExportKeyword))
      continue
    if (modifiers.some((item) => item.kind === ts.SyntaxKind.DefaultKeyword))
      names.add('default')
    else if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        bind(declaration.name)
    else if (statement.name && ts.isIdentifier(statement.name))
      names.add(statement.name.text)
  }
  return names
}

const SYMBOL_TYPES = new Set(['exports', 'types', 'nsExports', 'nsTypes'])

/**
 * Export de variante .native que a irmã também exporta: o Metro troca o import da irmã pela .native, então o uso
 * dele é o da irmã (que o knip cobra). Sai do relatório; o export que só a .native tem fica (ninguém o alcança).
 */
export function dropNativeSiblingExports(
  root,
  findings,
  namesOf = (file) => exportedNames(file, loadTypeScript(root))
) {
  const cache = new Map()
  const cached = (file) => {
    if (!cache.has(file)) cache.set(file, namesOf(file))
    return cache.get(file)
  }
  return findings.filter((finding) => {
    if (!SYMBOL_TYPES.has(finding.type) || !NATIVE_FILE.test(finding.file))
      return true
    const stem = path.join(root, finding.file.replace(NATIVE_FILE, ''))
    const siblings = SIBLING_SUFFIXES.map((suffix) => stem + suffix).filter(
      (file) => fs.existsSync(file)
    )
    return !siblings.some((sibling) => {
      const names = cached(sibling)
      return names === null || names.has(finding.name)
    })
  })
}

function gitTopLevel(root) {
  try {
    return path.resolve(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    )
  } catch {
    return null
  }
}

const ownRepository = (root) => {
  const top = gitTopLevel(root)
  return !!top && path.relative(top, path.resolve(root)) === ''
}

/** Arquivos do repositório que existem no disco: versionados e novos fora do .gitignore (sem git: a árvore toda). */
export function repositoryFiles(root) {
  if (ownRepository(root))
    return execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }
    )
      .split('\0')
      .filter(Boolean)
      .filter((file) => fs.existsSync(path.join(root, file)))
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else files.push(toPosix(path.relative(root, absolute)))
    }
  }
  visit(root)
  return files
}

/** Saídas de ferramenta fora do .gitignore da raiz ou com arquivo versionado dentro. */
export function toolOutputFindings(root, { tracked = null } = {}) {
  const gitignore = path.join(root, '.gitignore')
  const text = fs.existsSync(gitignore)
    ? fs.readFileSync(gitignore, 'utf8')
    : ''
  const findings = []
  for (const output of TOOL_OUTPUTS)
    for (const sample of output.samples)
      if (!gitignoreCovers(text, sample))
        findings.push({
          type: 'tool-output-not-ignored',
          file: '.gitignore',
          name: sample,
        })
  const files =
    tracked ??
    (ownRepository(root)
      ? execFileSync('git', ['ls-files', '-z'], {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 1 << 28,
        })
          .split('\0')
          .filter(Boolean)
      : [])
  for (const file of files) {
    const output = TOOL_OUTPUTS.find((candidate) =>
      gitignoreCovers(candidate.rule, toPosix(file))
    )
    if (output)
      findings.push({
        type: 'tool-output-tracked',
        file: toPosix(file),
        name: output.rule,
      })
  }
  return findings
}

/** JSON com comentários // e /* e vírgula final (knip.jsonc) lido como JSON; strings ficam intactas. */
export function parseJsonc(text) {
  let out = ''
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      let end = index + 1
      while (end < text.length && text[end] !== '"')
        end += text[end] === '\\' ? 2 : 1
      out += text.slice(index, end + 1)
      index = end
    } else if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1
      out += '\n'
    } else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 1
    } else out += char
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

const readKnipConfig = (root) =>
  parseJsonc(fs.readFileSync(path.join(root, KNIP_CONFIG), 'utf8'))

/** Os `ignore` do knip.jsonc (o de cima e o de cada workspace, prefixado pela pasta dele) como um teste de caminho. */
function knipIgnores(config) {
  const patterns = asList(config.ignore).map((pattern) => globToRegExp(pattern))
  for (const [name, settings] of Object.entries(config.workspaces ?? {}))
    for (const pattern of asList(settings?.ignore))
      patterns.push(globToRegExp(name === '.' ? pattern : `${name}/${pattern}`))
  return (file) => patterns.some((regex) => regex.test(file))
}

/** Padrões de entrada que só existem por causa dos testes e as negações que tiram os testes do passe sem testes. */
const TEST_PATTERN =
  /(?:^|\/)(?:tests?|__tests__|__mocks__)\/|\.(?:test|spec)\.|\{test,spec\}/
export const TEST_EXCLUSIONS = [
  '!**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}',
  '!**/{tests,test,__tests__,__mocks__}/**',
]
const DEFAULT_PROJECT = ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}']

/**
 * A configuração do knip sem os testes: entradas de teste saem, o project e as entradas negam arquivos e pastas de
 * teste e os plugins vitest e playwright (que declaram suítes e setups como entrada) ficam desligados. O que o
 * knip acha a mais neste passe só existe por causa de um teste.
 */
export function withoutTests(config) {
  const copy = structuredClone(config)
  const strip = (settings) => {
    settings.entry = [
      ...asList(settings.entry).filter(
        (pattern) => !TEST_PATTERN.test(pattern)
      ),
      ...TEST_EXCLUSIONS,
    ]
    settings.project = [
      ...(settings.project === undefined
        ? DEFAULT_PROJECT
        : asList(settings.project)),
      ...TEST_EXCLUSIONS,
    ]
    settings.vitest = false
    settings.playwright = false
  }
  if (isRecord(copy.workspaces))
    for (const settings of Object.values(copy.workspaces))
      if (isRecord(settings)) strip(settings)
  if (
    !isRecord(copy.workspaces) ||
    copy.entry !== undefined ||
    copy.project !== undefined
  )
    strip(copy)
  return copy
}

/** Achados do passe sem testes que viram "só por teste" quando o passe com testes não os tem. */
const TEST_ONLY_TYPES = {
  files: 'test-only-file',
  exports: 'test-only-export',
  types: 'test-only-export',
  nsExports: 'test-only-export',
  nsTypes: 'test-only-export',
  enumMembers: 'test-only-export',
}
const findingKey = (finding) =>
  `${finding.type} ${finding.file} ${finding.name ?? ''}`

/** Arquivo e export que só um teste alcança: achados do passe sem testes que o passe com testes não tem. */
export function testOnlyFindings(withTests, withoutTestsFindings) {
  const known = new Set(withTests.map(findingKey))
  const seen = new Set()
  const findings = []
  for (const finding of withoutTestsFindings) {
    const type = TEST_ONLY_TYPES[finding.type]
    if (!type || known.has(findingKey(finding))) continue
    const item =
      type === 'test-only-file'
        ? { type, file: finding.file }
        : { type, file: finding.file, name: finding.name }
    if (seen.has(findingKey(item))) continue
    seen.add(findingKey(item))
    findings.push(item)
  }
  return findings
}

/** Especificadores de import de um arquivo: import/export from, import(), require() e, em CSS, @import/@reference. */
function specifiersOf(file, text) {
  const pattern = file.endsWith('.css')
    ? /@(?:import|reference)\s+(?:url\(\s*)?['"]?([^'")\s;]+)/g
    : /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g
  return [...text.matchAll(pattern)].map((match) => match[1])
}

/** Pacotes do monorepo por nome, com a pasta e o "exports". */
function workspacePackages(root, files) {
  const packages = new Map()
  for (const file of files) {
    if (!file.endsWith('package.json') || file.includes('node_modules'))
      continue
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(root, file), 'utf8')
      )
      if (typeof manifest.name === 'string')
        packages.set(manifest.name, {
          dir: path.posix.dirname(file),
          exports: manifest.exports,
        })
    } catch {
      // manifesto inválido: outro gate reclama
    }
  }
  return packages
}

/** Arquivos do repositório que um especificador alcança: relativo ao arquivo ou pelo "exports" de um pacote do monorepo. */
function resolveSpecifier(file, specifier, packages) {
  const join = (dir, target) =>
    path.posix.normalize(path.posix.join(dir, target)).replace(/^\.\//, '')
  if (specifier.startsWith('.'))
    return [join(path.posix.dirname(file), specifier.split('?')[0])]
  for (const [name, manifest] of packages) {
    if (specifier !== name && !specifier.startsWith(`${name}/`)) continue
    const subpath = `.${specifier.slice(name.length)}`
    const exportsMap =
      typeof manifest.exports === 'string' || Array.isArray(manifest.exports)
        ? { '.': manifest.exports }
        : isRecord(manifest.exports)
          ? manifest.exports
          : {}
    const targets = []
    for (const [key, value] of Object.entries(exportsMap)) {
      if (key === subpath)
        for (const target of exportTargets(value))
          targets.push(join(manifest.dir, target))
      else if (key.includes('*')) {
        const [head, tail] = key.split('*')
        if (subpath.startsWith(head) && subpath.endsWith(tail)) {
          const middle = subpath.slice(
            head.length,
            subpath.length - tail.length
          )
          for (const target of exportTargets(value))
            targets.push(join(manifest.dir, target.replace('*', middle)))
        }
      }
    }
    return targets
  }
  return []
}

/**
 * CSS sem importador nos workspaces em que o knip não lê CSS (a dica project-extension-unregistered ".css"): nenhum
 * import/@import do repositório o alcança, nem direto nem pelo "exports" de um pacote.
 */
export function cssOrphans(
  root,
  { workspaces, configured = [], files, ignored = () => false }
) {
  if (!workspaces.length) return []
  // O workspace dono do arquivo é o de pasta mais longa que o contém; o resto é da raiz (".").
  const owners = configured
    .filter((name) => name !== '.')
    .sort((a, b) => b.length - a.length)
  const ownerOf = (file) =>
    owners.find((name) => file.startsWith(`${name}/`)) ?? '.'
  const inScope = (file) => workspaces.includes(ownerOf(file))
  const candidates = files.filter(
    (file) => file.endsWith('.css') && inScope(file) && !ignored(file)
  )
  if (!candidates.length) return []
  const packages = workspacePackages(root, files)
  const referenced = new Set()
  for (const file of files) {
    if (!/\.(?:[cm]?[jt]sx?|css|mdx)$/.test(file)) continue
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    for (const specifier of specifiersOf(file, text))
      for (const target of resolveSpecifier(file, specifier, packages))
        if (target !== file) referenced.add(target)
  }
  return candidates
    .filter((file) => !referenced.has(file))
    .map((file) => ({ type: 'css-orphan', file }))
}

/** Tags JSDoc que o knip trata como "nunca reportar" (knip/dist/util/tag.js, isAlwaysIgnored). */
export const HIDING_TAGS = ['public', 'beta', 'alias']
const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g
const HIDING_TAG = new RegExp(
  `(?:^|[\\s*{])@(${HIDING_TAGS.join('|')})(?![\\w-])`,
  'g'
)

/** Blocos JSDoc com tag que esconde export do knip, um achado por arquivo e tag. */
export function hidingTags(root, { files, ignored = () => false }) {
  const findings = []
  for (const file of files) {
    if (!SOURCE.test(file) || ignored(file)) continue
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    if (!text.includes('/**')) continue
    const tags = new Set()
    for (const block of text.match(JSDOC_BLOCK) ?? [])
      for (const match of block.matchAll(HIDING_TAG)) tags.add(`@${match[1]}`)
    for (const tag of [...tags].sort())
      findings.push({ type: 'export-tag', file, name: tag })
  }
  return findings
}

/**
 * Globs das pastas de workspace: `packages:` do pnpm-workspace.yaml (um item por linha, como o do repositório) ou,
 * sem ele, `workspaces` do package.json da raiz. Negação ("!") não entra.
 */
export function workspaceGlobs(root) {
  const yaml = path.join(root, 'pnpm-workspace.yaml')
  if (fs.existsSync(yaml)) {
    const globs = []
    let inPackages = false
    for (const raw of fs.readFileSync(yaml, 'utf8').split(/\r?\n/)) {
      const line = raw.replace(/\s+#.*$/, '')
      if (/^\S/.test(line)) inPackages = /^packages\s*:\s*$/.test(line)
      else if (inPackages) {
        const item = /^\s+-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(line)
        if (item && !item[1].startsWith('!')) globs.push(item[1])
      }
    }
    return globs
  }
  const manifest = path.join(root, 'package.json')
  if (!fs.existsSync(manifest)) return []
  const declared = JSON.parse(fs.readFileSync(manifest, 'utf8')).workspaces
  const list = Array.isArray(declared) ? declared : declared?.packages
  return asList(list).filter(
    (glob) => typeof glob === 'string' && !glob.startsWith('!')
  )
}

const BUILTINS = new Set(builtinModules)

/**
 * O pacote que um especificador importa: `@a/b/c` → `@a/b`, `a/b` → `a`. Relativo, absoluto, import de subcaminho
 * (`#x`), protocolo (`node:`, `https:`), alias de caminho (`@/`, `~/`) e módulo nativo do Node: `null`.
 */
export function packageNameOf(specifier) {
  if (/^(?:[./#~]|@\/|[a-z][a-z0-9+.-]*:)/i.test(specifier)) return null
  const parts = specifier.split('/')
  const name = specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0]
  if (!name || (specifier.startsWith('@') && parts.length < 2)) return null
  return BUILTINS.has(name) ? null : name
}

/** Arquivo que não é código de produção do workspace: teste, story e config/setup do ferramental de teste. */
const TOOLING_SOURCE =
  /\.stories\.[cm]?[jt]sx?$|(?:^|\/)(?:vitest|playwright|jest)(?:\.[\w-]+)*\.(?:config|setup)\.[cm]?[jt]s$/
/**
 * Ferramental de teste e de tipos que fica na raiz por desenho (plano da onda 135, E24): o dublê de teste que mora
 * ao lado do código (ex.: `native-test-host.tsx`, carregado por `vi.mock`) importa o executor da raiz.
 */
export const ROOT_TOOLING_PACKAGES =
  /^(?:vitest|@vitest\/[^/]+|@testing-library\/[^/]+|@playwright\/test|typescript)$/
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

/** Especificadores de import de um módulo (import, export from, import(), require()), sem comentários nem strings. */
function importSpecifiers(text, ts) {
  return ts
    .preProcessFile(text, true, true)
    .importedFiles.map((entry) => entry.fileName)
}

/**
 * Pacotes que o código de produção de um workspace importa sem declarar no package.json dele (dependencies,
 * devDependencies, peerDependencies ou optionalDependencies). O knip aceita a dependência declarada só na raiz, e
 * o workspace quebra quando a raiz sai ou tem as dependências podadas. Teste, story e config/setup de ferramenta de
 * teste ficam de fora: o ferramental de teste mora na raiz, por desenho. O próprio nome do workspace conta como
 * declarado. `knipUnlisted` são os `unlisted` do knip (pacote que ninguém declara): o mesmo par não se repete aqui.
 */
export function workspaceUnlisted(
  root,
  { files, ignored = () => false, knipUnlisted = [], ts = loadTypeScript(root) }
) {
  const patterns = workspaceGlobs(root).map((glob) =>
    globToRegExp(glob.replace(/\/+$/, ''))
  )
  if (!patterns.length) return []
  const workspaces = []
  for (const file of files) {
    if (!file.endsWith('package.json') || file === 'package.json') continue
    const dir = path.posix.dirname(file)
    if (dir.split('/').includes('node_modules')) continue
    if (!patterns.some((pattern) => pattern.test(dir))) continue
    let manifest
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
    } catch {
      continue // manifesto inválido: outro gate reclama
    }
    const declared = new Set(
      DEPENDENCY_FIELDS.flatMap((field) =>
        isRecord(manifest[field]) ? Object.keys(manifest[field]) : []
      )
    )
    if (typeof manifest.name === 'string') declared.add(manifest.name)
    workspaces.push({ dir, declared })
  }
  // O dono do arquivo é o workspace de pasta mais longa que o contém.
  workspaces.sort((a, b) => b.dir.length - a.dir.length)
  const reported = new Set(
    knipUnlisted.map((finding) => `${finding.file} ${finding.name}`)
  )
  const findings = []
  for (const file of files) {
    if (!SOURCE.test(file) || ignored(file)) continue
    if (TEST_PATTERN.test(file) || TOOLING_SOURCE.test(file)) continue
    const owner = workspaces.find(({ dir }) => file.startsWith(`${dir}/`))
    if (!owner) continue
    const text = fs.readFileSync(path.join(root, file), 'utf8')
    const names = new Set()
    for (const specifier of importSpecifiers(text, ts)) {
      const name = packageNameOf(specifier)
      if (
        name &&
        !owner.declared.has(name) &&
        !ROOT_TOOLING_PACKAGES.test(name)
      )
        names.add(name)
    }
    for (const name of [...names].sort())
      if (!reported.has(`${file} ${name}`))
        findings.push({ type: 'workspace-unlisted', file, name })
  }
  return findings
}

/** O executável do knip instalado. */
function knipBin() {
  // O "exports" do knip não expõe package.json: sobe do ponto de entrada até o manifesto do pacote.
  let directory = path.dirname(createRequire(import.meta.url).resolve('knip'))
  const manifestOf = (dir) => {
    const file = path.join(dir, 'package.json')
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : null
  }
  while (manifestOf(directory)?.name !== 'knip') {
    const parent = path.dirname(directory)
    if (parent === directory)
      throw new Error('pacote knip não encontrado (rode pnpm install)')
    directory = parent
  }
  const manifest = manifestOf(directory)
  return path.join(
    directory,
    typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.knip
  )
}

/** Roda o knip com o reporter do gate e devolve { findings, hints }; `config` troca o knip.jsonc por outro arquivo. */
export function runKnip(root, config = path.join(root, KNIP_CONFIG)) {
  const result = spawnSync(
    process.execPath,
    [
      knipBin(),
      '--no-progress',
      '--no-exit-code',
      '--config',
      config,
      '--directory',
      root,
      '--reporter',
      REPORTER,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      // O plugin prisma do knip carrega prisma.config.ts, que exige DATABASE_URL ao carregar (env('DATABASE_URL')); o
      // knip só lê a configuração e nunca conecta. Sem a variável (job architecture do CI), vai uma URL que não abre nada.
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://hygiene:unused@127.0.0.1:1/unused',
      },
    }
  )
  const line = (result.stdout ?? '')
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith('{"findings"'))
  if (result.status !== 0 || !line) {
    throw new Error(
      `knip falhou (status ${result.status}):\n${(result.stderr || result.stdout || String(result.error ?? '')).trim()}`
    )
  }
  return JSON.parse(line)
}

/** O passe do knip sem os testes, com a configuração derivada num arquivo temporário fora do repositório. */
export function runKnipWithoutTests(root) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hygiene-sem-testes-')
  )
  const file = path.join(directory, 'knip.json')
  try {
    fs.writeFileSync(file, JSON.stringify(withoutTests(readKnipConfig(root))))
    return runKnip(root, file)
  } finally {
    fs.rmSync(file, { force: true })
    fs.rmdirSync(directory)
  }
}

const describe = (finding) =>
  `${finding.type} ${finding.file}${finding.name ? ` :: ${finding.name}` : ''}`

/**
 * O gate inteiro sobre `root`. `knip` (passe com testes), `knipWithoutTests`, `tracked` e `files` podem vir prontos
 * (testes).
 */
export function checkHygiene(
  root,
  { knip = null, knipWithoutTests = null, tracked = null, files = null } = {}
) {
  const baselinePath = path.join(root, BASELINE_FILE)
  const { entries, problems } = readBaseline(
    fs.existsSync(baselinePath) ? fs.readFileSync(baselinePath, 'utf8') : null
  )
  const config = fs.existsSync(path.join(root, KNIP_CONFIG))
    ? readKnipConfig(root)
    : {}
  const knipIgnored = knipIgnores(config)
  const ignored = (file) =>
    file.split('/').includes('node_modules') || knipIgnored(file)
  const report = knip ?? runKnip(root)
  const withTests = dropNativeSiblingExports(root, report.findings)
  const reportWithoutTests = knipWithoutTests ?? runKnipWithoutTests(root)
  const repository = files ?? repositoryFiles(root)
  const cssWorkspaces = report.hints
    .filter(
      (hint) =>
        hint.type === 'project-extension-unregistered' &&
        hint.identifier === '.css'
    )
    .map((hint) => hint.workspace)
  const unusedFiles = new Set(
    withTests
      .filter((finding) => finding.type === 'files')
      .map((finding) => finding.file)
  )
  const findings = [
    ...withTests,
    ...testOnlyFindings(
      withTests,
      dropNativeSiblingExports(root, reportWithoutTests.findings)
    ),
    ...nativeOrphans(root),
    // O CSS que o knip já reporta como arquivo sem uso não se repete como css-orphan.
    ...cssOrphans(root, {
      workspaces: cssWorkspaces,
      configured: Object.keys(config.workspaces ?? {}),
      files: repository,
      ignored,
    }).filter((finding) => !unusedFiles.has(finding.file)),
    ...hidingTags(root, { files: repository, ignored }),
    ...toolOutputFindings(root, { tracked }),
    // O knip aceita a dependência declarada só na raiz; o pacote que ninguém declara já sai como `unlisted` dele.
    ...workspaceUnlisted(root, {
      files: repository,
      ignored,
      knipUnlisted: withTests.filter((finding) => finding.type === 'unlisted'),
    }),
  ]
  const { failing, stale } = applyBaseline(findings, entries)
  const hints = report.hints.filter((hint) => FAILING_HINTS.has(hint.type))
  return {
    findings,
    failing,
    stale,
    problems,
    hints,
    entries,
    ok:
      failing.length === 0 &&
      stale.length === 0 &&
      problems.length === 0 &&
      hints.length === 0,
  }
}

function main() {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf('--root')
  const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : REPO_ROOT)
  let result
  try {
    result = checkHygiene(root)
  } catch (error) {
    console.error(`hygiene: ${error.message}`)
    process.exit(2)
  }
  if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          failing: result.failing,
          stale: result.stale,
          problems: result.problems,
          hints: result.hints,
        },
        null,
        2
      )
    )
    process.exit(result.ok ? 0 : 1)
  }
  const lines = []
  for (const problem of result.problems) lines.push(`  baseline  ${problem}`)
  for (const finding of result.failing)
    lines.push(`  sobra     ${describe(finding)}`)
  for (const { entry, name } of result.stale)
    lines.push(
      `  velho     ${BASELINE_FILE}: ${entry.type} ${entry.path}${name ? ` :: ${name}` : ''} não acontece mais; tire da linha de base`
    )
  for (const hint of result.hints)
    lines.push(
      `  knip      ${KNIP_CONFIG} (${hint.workspace}): ${hint.type} ${hint.identifier} não serve mais; tire da configuração`
    )
  const accepted = result.findings.length - result.failing.length
  if (result.ok) {
    console.log(
      `hygiene: ok (${accepted} achado(s) aceito(s) por ${result.entries.length} item(ns) de ${BASELINE_FILE}, cada um com motivo)`
    )
    return
  }
  console.error(`hygiene: ${lines.length} problema(s)`)
  console.error(lines.join('\n'))
  console.error(
    [
      '',
      'Sobra: apague o arquivo/export/dependência (ou ligue-o de verdade). Só teste o mantém (test-only-*): apague o',
      'código com o teste dele, ou ligue-o ao produto. Se ela depende de uma decisão do dono, o item entra em',
      `${BASELINE_FILE} com o motivo, mas a linha de base só encolhe (o ratchet-guard barra item novo).`,
      'Tag JSDoc que esconde export (export-tag): tire a tag; o knip nunca reporta o export marcado.',
      'Pacote importado sem declaração no workspace (workspace-unlisted): declare-o no package.json do workspace, na',
      'faixa que a raiz já usa (docs/references/dependencies.md); a raiz não vale pelo workspace.',
      'Saída de ferramenta: mova a pasta para fora do repositório e cubra-a no .gitignore.',
    ].join('\n')
  )
  process.exit(1)
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invoked === fileURLToPath(import.meta.url)) main()
