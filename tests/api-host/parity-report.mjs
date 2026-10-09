#!/usr/bin/env node
/**
 * Registro e relatório da bateria de paridade (onda 135, B3 e B11).
 *
 * Cada `pnpm test:api` grava, fora do repositório, em `%TEMP%/locadora-api-parity/<raiz>-<motor>/`
 * (ou em `API_PARITY_RECORD_DIR`):
 * - `hits.jsonl`: uma linha por requisição a um host da rodada (alvo `api` ou `legacy`, método, caminho e status);
 * - `cases.jsonl`: uma linha por caso (arquivo, nome completo, estado e `expect.getState().assertionCalls`);
 * - `files.jsonl`: os arquivos de teste que rodaram.
 *
 * Relatórios:
 * - cobertura (B3): cada método da superfície da API (`tests/security/fixtures/api-surface.json`, 173 rotas e 221
 *   métodos) precisa de ao menos um desfecho de sucesso na API: 2xx, ou 410/503 escrito na própria `route.ts`
 *   (`status: 410`/`status: 503`). Negações (401/403/404/409...) não contam. O que não tem sucesso fica em
 *   `tests/api-host/route-coverage-exceptions.json`, cada um com motivo; a lista só encolhe (entrada coberta, sem
 *   motivo ou fora da superfície reprova).
 * - asserções (B11): por caso, a rodada sem a raiz (`absent`) precisa de ≥ 1 asserção e de ≥ metade das asserções da
 *   rodada com a raiz. Caso só da rodada com a raiz precisa ser um braço da raiz (nome com legado/legacy/raiz).
 *
 * Uso: `node tests/api-host/parity-report.mjs coverage <pasta>` e
 *      `node tests/api-host/parity-report.mjs assertions <pasta com a raiz> <pasta sem a raiz>`.
 */
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SURFACE_FIXTURE = 'tests/security/fixtures/api-surface.json'
export const COVERAGE_EXCEPTIONS =
  'tests/api-host/route-coverage-exceptions.json'
export const API_APP = 'apps/services/api/src/app'
const RECORD_FILES = ['hits.jsonl', 'cases.jsonl', 'files.jsonl']
const MIN_REASON = 8
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
/** Nome de caso que só existe com a raiz: o braço da própria raiz (some no Bloco F). */
const LEGACY_ARM = /legacy|legado|raiz/i

/** Pasta do registro de uma rodada: `API_PARITY_RECORD_DIR` ou `%TEMP%/locadora-api-parity/<raiz>-<motor>`. */
export function recordDirectory(env, profile) {
  const explicit = env.API_PARITY_RECORD_DIR?.trim()
  return explicit
    ? path.resolve(explicit)
    : path.join(tmpdir(), 'locadora-api-parity', profile)
}

/** Começa um registro novo: só os três arquivos conhecidos são zerados (nada recursivo, nada fora da pasta). */
export function startRecord(directory, meta, root = ROOT) {
  mkdirSync(directory, { recursive: true })
  rmSync(path.join(directory, 'completion.json'), { force: true })
  for (const name of RECORD_FILES) writeFileSync(path.join(directory, name), '')
  writeFileSync(
    path.join(directory, 'meta.json'),
    JSON.stringify({ ...meta, surface: recordSurface(root) }, null, 2) + '\n'
  )
}

/** A mesma superfície e a mesma fixture (incluindo helpers/configuração) precisam estar em ambas as rodadas. */
function recordSurface(root) {
  const testRoot = path.join(root, 'tests/api-host')
  const files = readdirSync(testRoot, { recursive: true })
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => name.replaceAll('\\', '/'))
    .sort()
  const inputs = [SURFACE_FIXTURE]
  for (const directory of [
    'tests/api-host',
    'tests/helpers',
    'prisma/sql/roles',
    'prisma/migrations',
  ]) {
    const absolute = path.join(root, directory)
    if (!existsSync(absolute)) continue
    for (const name of readdirSync(absolute, { recursive: true }))
      if (/\.(?:[cm]?[jt]sx?|json|sql)$/.test(name))
        inputs.push(`${directory}/${name.replaceAll('\\', '/')}`)
  }
  if (existsSync(path.join(root, 'vitest.api.config.ts')))
    inputs.push('vitest.api.config.ts')
  const hash = createHash('sha256')
  for (const file of inputs.sort())
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(path.join(root, file)))
      .update('\0')
  return { files, hash: hash.digest('hex') }
}

/**
 * Campos do runner consumidos pelo registro. O estado também aceita valores desconhecidos para que o relatório
 * os recuse em runtime, em vez de pressupor uma conclusão válida.
 * @typedef {{ type: string, mode?: string, result?: { state?: string }, tasks?: readonly ParityRunnerTask[] }} ParityRunnerTask
 * @typedef {Pick<import('vitest/node').RunnerTestFile, 'filepath'> & { result?: { state?: string }, tasks: readonly ParityRunnerTask[] }} ParityRunnerFile
 */

/**
 * Síncrono. Chamar no teardown global DEPOIS da limpeza e da cobertura, usando o estado final do Vitest:
 * finishRecord(directory, { files: project.vitest.state.getFiles(),
 *   unhandledErrors: project.vitest.state.getUnhandledErrors() }).
 * Registra falhas de teste/hooks/cleanup e lança se a rodada falhou. Uma rodada filtrada pode terminar, mas não
 * serve para o relatório B11, que exige a superfície inteira. afterAll de setupFile ainda precede fixture cleanup.
 * @param {string} directory
 * @param {{ files: readonly ParityRunnerFile[], unhandledErrors?: readonly unknown[] }} state
 * @param {string} [root]
 */
export function finishRecord(
  directory,
  { files, unhandledErrors = [] },
  root = ROOT
) {
  const meta = requiredJson(path.join(directory, 'meta.json'))
  const summaries = files.map((file) => {
    const states = { pass: 0, fail: 0, skip: 0, todo: 0, unknown: 0 }
    const visit = (task) => {
      if (task.type === 'test') {
        const state =
          task.result?.state ??
          (['skip', 'todo'].includes(task.mode) ? task.mode : 'unknown')
        states[Object.hasOwn(states, state) ? state : 'unknown']++
      } else for (const child of task.tasks ?? []) visit(child)
    }
    visit(file)
    return {
      file: path
        .relative(path.join(root, 'tests/api-host'), file.filepath)
        .replaceAll('\\', '/'),
      state: file.result?.state ?? 'unknown',
      total: Object.values(states).reduce((sum, count) => sum + count, 0),
      states,
    }
  })
  const ok =
    summaries.length > 0 &&
    unhandledErrors.length === 0 &&
    summaries.every(
      (file) =>
        ['pass', 'skip', 'todo'].includes(file.state) &&
        file.total > 0 &&
        !file.states.fail &&
        !file.states.unknown
    )
  const completion = {
    startedAt: meta.startedAt,
    completedAt: new Date().toISOString(),
    files: summaries,
    unhandledErrors: unhandledErrors.length,
    ok,
  }
  writeFileSync(
    path.join(directory, 'completion.json'),
    JSON.stringify(completion, null, 2) + '\n'
  )
  if (!ok)
    throw new Error(
      'API parity record did not finish successfully (tests, hooks, cleanup or unhandled errors)'
    )
  return completion
}

export function appendRecord(directory, name, row) {
  appendFileSync(path.join(directory, name), JSON.stringify(row) + '\n')
}

export function readRecord(directory, name) {
  const file = path.join(directory, name)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/** Árvore de rotas do App Router: estático antes de `[x]`, que vem antes de `[...x]` (como o Next resolve). */
export function createRouteMatcher(endpoints) {
  const root = { static: new Map(), dynamic: null, catchAll: null, route: null }
  for (const route of new Set(endpoints.map((entry) => entry.split(' ')[1]))) {
    let node = root
    const segments = route.split('/').filter(Boolean)
    for (const [index, segment] of segments.entries()) {
      if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
        if (index !== segments.length - 1)
          throw new Error(`catch-all must be last: ${route}`)
        node.catchAll = route
        node = null
        break
      }
      const key = /^\[[^\]]+\]$/.test(segment) ? 'dynamic' : null
      if (key) {
        node.dynamic ??= {
          static: new Map(),
          dynamic: null,
          catchAll: null,
          route: null,
        }
        node = node.dynamic
      } else {
        if (!node.static.has(segment))
          node.static.set(segment, {
            static: new Map(),
            dynamic: null,
            catchAll: null,
            route: null,
          })
        node = node.static.get(segment)
      }
    }
    if (node) node.route = route
  }
  const walk = (node, segments) => {
    if (!segments.length) return node.route
    const [head, ...rest] = segments
    const exact = node.static.get(head)
    const fromStatic = exact && walk(exact, rest)
    if (fromStatic) return fromStatic
    const fromDynamic = node.dynamic && walk(node.dynamic, rest)
    if (fromDynamic) return fromDynamic
    return node.catchAll ?? null
  }
  return (pathname) => {
    let decoded
    try {
      decoded = pathname
        .split('/')
        .filter(Boolean)
        .map((part) => decodeURIComponent(part))
    } catch {
      decoded = pathname.split('/').filter(Boolean)
    }
    return walk(root, decoded)
  }
}

/** Sucesso esperado de um método: 2xx, ou 410/503 que a própria `route.ts` escreve. */
export function isSuccess(status, routeSource) {
  if (status >= 200 && status < 300) return true
  return (
    (status === 410 || status === 503) &&
    new RegExp(`status:\\s*${status}\\b`).test(routeSource ?? '')
  )
}

function readRouteSource(root, route) {
  const directory = path.join(
    root,
    API_APP,
    ...route.split('/').filter(Boolean)
  )
  for (const extension of ['ts', 'tsx', 'js', 'mjs'])
    if (existsSync(path.join(directory, `route.${extension}`)))
      return readFileSync(path.join(directory, `route.${extension}`), 'utf8')
  return ''
}

/**
 * Cobertura por método da API (B3). `hits` são as linhas do registro; só contam as do alvo `api`.
 * Devolve os métodos cobertos, os sem sucesso, as exceções aceitas e os problemas da lista de exceções.
 */
/**
 * Exceção de cobertura: o motivo (texto) ou `{ reason, authModes }`, quando o sucesso do método só existe num motor de
 * identidade (ex.: o cadastro de locadora exige Better Auth) e a exceção vale só nos outros.
 */
function exceptionReason(entry, authMode) {
  if (typeof entry === 'string') return { reason: entry, applies: true }
  if (entry && typeof entry === 'object' && typeof entry.reason === 'string') {
    const modes = Array.isArray(entry.authModes) ? entry.authModes : null
    return {
      reason: entry.reason,
      applies: !modes || (authMode !== undefined && modes.includes(authMode)),
    }
  }
  return { reason: '', applies: true }
}

export function routeCoverage({
  hits,
  endpoints,
  exceptions = {},
  routeSource,
  authMode = /** @type {string | undefined} */ (undefined),
}) {
  const match = createRouteMatcher(endpoints)
  const listed = new Set(endpoints)
  const statuses = new Map(endpoints.map((entry) => [entry, new Map()]))
  const unmatched = new Map()
  for (const hit of hits) {
    if (hit.target !== 'api') continue
    const route = match(hit.path)
    const endpoint = route && `${hit.method} ${route}`
    if (!endpoint || !listed.has(endpoint)) {
      const key = `${hit.method} ${hit.path}`
      unmatched.set(key, (unmatched.get(key) ?? 0) + 1)
      continue
    }
    const counts = statuses.get(endpoint)
    counts.set(hit.status, (counts.get(hit.status) ?? 0) + 1)
  }
  const covered = []
  const uncovered = []
  for (const endpoint of endpoints) {
    const route = endpoint.split(' ')[1]
    const source = routeSource(route)
    const seen = [...statuses.get(endpoint).keys()].sort((a, b) => a - b)
    if (seen.some((status) => isSuccess(status, source))) covered.push(endpoint)
    else uncovered.push({ endpoint, statuses: seen })
  }
  const problems = []
  const active = new Set()
  for (const [endpoint, entry] of Object.entries(exceptions)) {
    const { reason, applies } = exceptionReason(entry, authMode)
    if (!listed.has(endpoint))
      problems.push(`${endpoint}: exceção fora da superfície da API`)
    else if (reason.trim().length < MIN_REASON)
      problems.push(`${endpoint}: exceção sem motivo`)
    else if (!applies) continue
    else if (covered.includes(endpoint))
      problems.push(`${endpoint}: já tem sucesso na rodada; tire a exceção`)
    else active.add(endpoint)
  }
  const missing = uncovered.filter((entry) => !active.has(entry.endpoint))
  const routes = new Set(endpoints.map((entry) => entry.split(' ')[1]))
  const coveredRoutes = new Set(covered.map((entry) => entry.split(' ')[1]))
  return {
    methods: { total: endpoints.length, covered: covered.length },
    routes: { total: routes.size, covered: coveredRoutes.size },
    covered,
    uncovered,
    excepted: uncovered.filter((entry) => active.has(entry.endpoint)),
    missing,
    problems,
    unmatched: [...unmatched].map(([request, count]) => ({ request, count })),
    statuses: Object.fromEntries(
      [...statuses].map(([endpoint, counts]) => [
        endpoint,
        Object.fromEntries(counts),
      ])
    ),
    ok: missing.length === 0 && problems.length === 0,
  }
}

const caseKey = (row) => `${row.file} > ${row.name}`

/** Casos aprovados entram na comparação; falhas ou evidência inválida reprovam a rodada inteira. */
export function compareAssertions({ present, absent, exceptions = {} }) {
  const problems = []
  const passed = (rows, label) => {
    const result = new Map()
    const seen = new Set()
    if (!Array.isArray(rows) || !rows.length) {
      problems.push(`${label}: no case evidence`)
      return result
    }
    for (const row of rows) {
      if (
        !row ||
        typeof row.file !== 'string' ||
        !row.file.trim() ||
        typeof row.name !== 'string' ||
        !row.name.trim() ||
        !Number.isSafeInteger(row.assertions) ||
        row.assertions < 0
      ) {
        problems.push(`${label}: invalid case evidence`)
        continue
      }
      const key = caseKey(row)
      if (seen.has(key)) problems.push(`${label}: duplicate case ${key}`)
      seen.add(key)
      if (!['pass', 'skip', 'todo'].includes(row.state))
        problems.push(`${label}: ${key} has state ${row.state}`)
      if (row.state === 'pass') result.set(key, row)
    }
    return result
  }
  const before = passed(present, 'with root')
  const after = passed(absent, 'without root')
  const violations = []
  for (const [key, row] of after) {
    const reference = before.get(key)
    if (row.assertions < 1)
      violations.push({
        key,
        present: reference?.assertions ?? null,
        absent: row.assertions,
        rule: '>=1',
      })
    else if (reference && row.assertions * 2 < reference.assertions)
      violations.push({
        key,
        present: reference.assertions,
        absent: row.assertions,
        rule: '>=half',
      })
  }
  const presentOnly = [...before.keys()].filter((key) => !after.has(key))
  for (const key of presentOnly)
    if (!LEGACY_ARM.test(key.split(' > ').slice(1).join(' > ')))
      violations.push({
        key,
        present: before.get(key).assertions,
        absent: null,
        rule: 'missing-without-root',
      })
  const absentOnly = [...after.keys()].filter((key) => !before.has(key))
  const compared = [...after.keys()].filter((key) => before.has(key)).length
  if (!compared) problems.push('no passing cases compared')
  const accepted = violations.filter(
    (entry) =>
      typeof exceptions[entry.key] === 'string' &&
      exceptions[entry.key].trim().length >= MIN_REASON
  )
  const open = violations.filter((entry) => !accepted.includes(entry))
  return {
    compared,
    present: before.size,
    absent: after.size,
    presentOnly,
    absentOnly,
    violations,
    accepted,
    open,
    problems,
    ok: open.length === 0 && problems.length === 0,
  }
}

function requiredJson(file) {
  if (!existsSync(file)) throw new Error(`missing evidence: ${file}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

function requiredRecord(directory, name) {
  if (!existsSync(path.join(directory, name)))
    throw new Error(`missing evidence: ${path.join(directory, name)}`)
  return readRecord(directory, name)
}

/** A CLI exige rodada completa, perfis de produção compatíveis e estado final, inclusive hooks de limpeza. */
export function assertionReport(root, presentDirectory, absentDirectory) {
  const surface = recordSurface(root)
  const load = (directory, legacyMode) => {
    const meta = requiredJson(path.join(directory, 'meta.json'))
    if (
      meta.legacyMode !== legacyMode ||
      meta.hostMode !== 'production' ||
      !['legacy', 'better-auth'].includes(meta.authMode) ||
      meta.profile !== `${legacyMode}-${meta.authMode}`
    )
      throw new Error(`${directory}: incompatible production profile`)
    if (JSON.stringify(meta.surface) !== JSON.stringify(surface))
      throw new Error(
        `${directory}: test/API surface differs from the current repository`
      )
    const completion = requiredJson(path.join(directory, 'completion.json'))
    if (
      !meta.startedAt ||
      !Number.isFinite(Date.parse(meta.startedAt)) ||
      completion.startedAt !== meta.startedAt ||
      !Number.isFinite(Date.parse(completion.completedAt)) ||
      Date.parse(completion.completedAt) < Date.parse(meta.startedAt) ||
      completion.ok !== true ||
      completion.unhandledErrors !== 0
    )
      throw new Error(`${directory}: incomplete or failed run`)
    const cases = requiredRecord(directory, 'cases.jsonl')
    const ran = requiredRecord(directory, 'files.jsonl').map((row) => row.file)
    if (
      JSON.stringify([...ran].sort()) !== JSON.stringify(surface.files) ||
      !Array.isArray(completion.files) ||
      JSON.stringify(completion.files.map((row) => row.file).sort()) !==
        JSON.stringify(surface.files)
    )
      throw new Error(`${directory}: incomplete test file surface`)
    if (cases.some((row) => !row || !surface.files.includes(row.file)))
      throw new Error(`${directory}: case outside the test surface`)
    for (const file of completion.files) {
      const rows = cases.filter((row) => row.file === file.file)
      const counts = file.states
      if (
        !counts ||
        !['pass', 'skip', 'todo'].includes(file.state) ||
        !Number.isSafeInteger(file.total) ||
        file.total < 1 ||
        !['pass', 'fail', 'skip', 'todo', 'unknown'].every(
          (state) => Number.isSafeInteger(counts[state]) && counts[state] >= 0
        ) ||
        Object.values(counts).reduce((sum, count) => sum + count, 0) !==
          file.total ||
        counts.fail !== 0 ||
        counts.unknown !== 0 ||
        rows.filter((row) => row.state === 'pass').length !== counts.pass ||
        rows.filter((row) => row.state === 'skip').length > counts.skip ||
        rows.filter((row) => row.state === 'todo').length > counts.todo ||
        rows.some((row) => !['pass', 'skip', 'todo'].includes(row.state))
      )
        throw new Error(
          `${directory}: incomplete or failed case evidence in ${file.file}`
        )
    }
    return { meta, cases }
  }
  const present = load(presentDirectory, 'production')
  const absent = load(absentDirectory, 'absent')
  if (present.meta.authMode !== absent.meta.authMode)
    throw new Error('identity engines differ between assertion runs')
  const exceptions =
    readJson(path.join(root, 'tests/api-host/assertion-exceptions.json'), {
      exceptions: {},
    }).exceptions ?? {}
  return compareAssertions({
    present: present.cases,
    absent: absent.cases,
    exceptions,
  })
}

function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
}

/** Relatório de cobertura de uma pasta de registro, com a superfície e as exceções do repositório. */
export function coverageReport(root, directory) {
  const surface = readJson(path.join(root, SURFACE_FIXTURE), null)
  if (!surface) throw new Error(`${SURFACE_FIXTURE} not found`)
  const exceptions =
    readJson(path.join(root, COVERAGE_EXCEPTIONS), { exceptions: {} })
      .exceptions ?? {}
  const meta = readJson(path.join(directory, 'meta.json'), {})
  return routeCoverage({
    hits: readRecord(directory, 'hits.jsonl'),
    endpoints: surface.endpoints,
    exceptions,
    routeSource: (route) => readRouteSource(root, route),
    authMode: meta.authMode,
  })
}

export function formatCoverage(report) {
  const lines = [
    `API parity coverage: ${report.routes.covered}/${report.routes.total} routes and ${report.methods.covered}/${report.methods.total} methods with an expected success outcome; ${report.excepted.length} justified exceptions.`,
  ]
  for (const entry of report.missing)
    lines.push(
      `  without success: ${entry.endpoint} (seen ${entry.statuses.join(', ') || 'never'})`
    )
  for (const problem of report.problems)
    lines.push(`  exception list: ${problem}`)
  return lines.join('\n')
}

function main(argv) {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
  )
  const [command, ...args] = argv
  if (command === 'coverage' && args.length === 1) {
    const report = coverageReport(root, path.resolve(args[0]))
    console.log(formatCoverage(report))
    if (report.unmatched.length)
      console.log(
        `  requests outside the API surface: ${report.unmatched.map((entry) => entry.request).join(', ')}`
      )
    return report.ok ? 0 : 1
  }
  if (command === 'assertions' && args.length === 2) {
    const report = assertionReport(
      root,
      path.resolve(args[0]),
      path.resolve(args[1])
    )
    console.log(
      `API parity assertions: ${report.compared} cases compared (${report.present} with the root, ${report.absent} without it); ${report.presentOnly.length} only with the root (legacy arms), ${report.absentOnly.length} only without it; ${report.open.length} open violations, ${report.accepted.length} justified.`
    )
    for (const entry of report.open)
      console.log(
        `  ${entry.rule}: ${entry.key} (with root ${entry.present}, without ${entry.absent})`
      )
    for (const entry of report.accepted)
      console.log(
        `  justified ${entry.rule}: ${entry.key} (with root ${entry.present}, without ${entry.absent})`
      )
    for (const problem of report.problems)
      console.log(`  invalid evidence: ${problem}`)
    return report.ok ? 0 : 1
  }
  console.error(
    'usage: parity-report.mjs coverage <record dir> | assertions <with-root dir> <without-root dir>'
  )
  return 2
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`API parity report failed: ${error.message}`)
    process.exitCode = 1
  }
}
