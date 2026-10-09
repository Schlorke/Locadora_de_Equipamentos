#!/usr/bin/env node
// Compara uma captura visual (tests/visual/visual-baseline.spec.ts) com a linha de base versionada e lista cada
// diferença por rota, captura (base, estado, receita), elemento e propriedade. Sai 1 se houver diferença que não
// esteja em tests/visual/approved-changes.json (ou captura faltando, ou arquivo de aprovações inválido).
//
//   node tools/visual-baseline/compare.mjs [--baseline <pasta>] [--current <pasta>] [--approved <arquivo>] [--json]
//   node tools/visual-baseline/compare.mjs --write-baseline --current <pasta>   grava a captura como linha de base
//
// Aprovação: { "capture": "390/vitrine/home" | "*", "section": "base" | "estado:<nome>" | "receita:<id>" | "*",
//   "element": "<chave>" | "<prefixo>*" | "*", "property": "<propriedade>" | "*", "baseline"?: <valor>,
//   "current"?: <valor>, "reason": "<motivo com 8+ caracteres>" }. `baseline`/`current` presentes precisam bater
//   exatamente; sem eles, qualquer valor naquele ponto é aceito. Aprovação que não casa nada é avisada.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listCaptureFiles, readCaptureFile } from './format.mjs'

const ABSENT = '(ausente)'

/** Mapa chave → { label, style } de uma lista de elementos capturados. */
const byKey = (elements) =>
  new Map(elements.map(([key, label, style]) => [key, { label, style }]))

/** Diferenças entre dois conjuntos de elementos (mesma captura). */
function diffElements(baseline, current, where) {
  const out = []
  const before = byKey(baseline)
  const after = byKey(current)
  for (const [key, { label, style }] of before) {
    const now = after.get(key)
    if (!now) {
      out.push({
        ...where,
        element: key,
        label,
        property: '*',
        baseline: 'elemento presente',
        current: 'elemento ausente',
      })
      continue
    }
    for (const property of [
      ...new Set([...Object.keys(style), ...Object.keys(now.style)]),
    ].sort()) {
      const a = style[property] ?? ABSENT
      const b = now.style[property] ?? ABSENT
      if (a !== b)
        out.push({
          ...where,
          element: key,
          label,
          property,
          baseline: a,
          current: b,
        })
    }
  }
  for (const [key, { label }] of after) {
    if (!before.has(key))
      out.push({
        ...where,
        element: key,
        label,
        property: '*',
        baseline: 'elemento ausente',
        current: 'elemento presente',
      })
  }
  return out
}

/** Diferenças entre duas versões de um arquivo de captura (`<viewport>/<cenário>`). */
export function diffCaptureFiles(name, baseline, current) {
  const out = []
  const sections = [
    ...new Set([
      ...Object.keys(baseline.captures),
      ...Object.keys(current.captures),
    ]),
  ].sort()
  for (const section of sections) {
    const where = { capture: name, section }
    const a = baseline.captures[section]
    const b = current.captures[section]
    if (!a || !b) {
      out.push({
        ...where,
        element: '*',
        label: '',
        property: '*',
        baseline: a ? 'captura presente' : 'captura ausente',
        current: b ? 'captura presente' : 'captura ausente',
      })
      continue
    }
    if (a.kind !== b.kind) {
      out.push({
        ...where,
        element: '*',
        label: '',
        property: 'kind',
        baseline: a.kind,
        current: b.kind,
      })
      continue
    }
    if (a.kind === 'delta') {
      out.push(...diffElements(a.changed, b.changed, where))
      const removedA = new Set(a.removed)
      const removedB = new Set(b.removed)
      for (const key of removedA)
        if (!removedB.has(key))
          out.push({
            ...where,
            element: key,
            label: '',
            property: '*',
            baseline: 'some no estado',
            current: 'permanece no estado',
          })
      for (const key of removedB)
        if (!removedA.has(key))
          out.push({
            ...where,
            element: key,
            label: '',
            property: '*',
            baseline: 'permanece no estado',
            current: 'some no estado',
          })
    } else {
      out.push(...diffElements(a.elements, b.elements, where))
    }
  }
  return out
}

/** Lê e valida o arquivo de aprovações; devolve as entradas e os problemas. */
export function readApprovals(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      approvals: [],
      problems: [`aprovações: JSON inválido (${error.message})`],
    }
  }
  const problems = []
  const approvals = []
  if (!Array.isArray(data?.changes))
    return {
      approvals,
      problems: ['aprovações: esperado { "changes": [ ... ] }'],
    }
  data.changes.forEach((entry, index) => {
    const where = `aprovações changes[${index}]`
    if (typeof entry?.reason !== 'string' || entry.reason.trim().length < 8)
      problems.push(`${where}: "reason" precisa de 8+ caracteres`)
    else if (
      !['capture', 'section', 'element', 'property'].every(
        (field) => typeof entry[field] === 'string' && entry[field] !== ''
      )
    )
      problems.push(
        `${where}: "capture", "section", "element" e "property" são obrigatórios`
      )
    else approvals.push(entry)
  })
  return { approvals, problems }
}

const matches = (pattern, value) =>
  pattern === '*' ||
  pattern === value ||
  (pattern.endsWith('*') && value.startsWith(pattern.slice(0, -1)))

/** Separa as diferenças aprovadas das pendentes e aponta as aprovações que não casaram com nada. */
export function applyApprovals(diffs, approvals) {
  const used = new Set()
  const pending = []
  const approved = []
  for (const diff of diffs) {
    const index = approvals.findIndex(
      (entry) =>
        matches(entry.capture, diff.capture) &&
        matches(entry.section, diff.section) &&
        matches(entry.element, diff.element) &&
        matches(entry.property, diff.property) &&
        (entry.baseline === undefined || entry.baseline === diff.baseline) &&
        (entry.current === undefined || entry.current === diff.current)
    )
    if (index === -1) pending.push(diff)
    else {
      used.add(index)
      approved.push({ ...diff, reason: approvals[index].reason })
    }
  }
  return {
    pending,
    approved,
    unused: approvals.filter((_, index) => !used.has(index)),
  }
}

/** Compara duas pastas de captura. */
export function compareDirectories(baselineDir, currentDir) {
  const baseline = listCaptureFiles(baselineDir)
  const current = listCaptureFiles(currentDir)
  if (!Object.keys(baseline).length)
    throw new Error(`${baselineDir}: linha de base sem capturas`)
  if (!Object.keys(current).length)
    throw new Error(`${currentDir}: captura atual sem capturas`)
  const diffs = []
  let elements = 0
  let captures = 0
  for (const name of [
    ...new Set([...Object.keys(baseline), ...Object.keys(current)]),
  ].sort()) {
    if (!baseline[name] || !current[name]) {
      diffs.push({
        capture: name,
        section: '*',
        element: '*',
        label: '',
        property: '*',
        baseline: baseline[name] ? 'arquivo presente' : 'arquivo ausente',
        current: current[name] ? 'arquivo presente' : 'arquivo ausente',
      })
      continue
    }
    const a = readCaptureFile(baseline[name])
    const b = readCaptureFile(current[name])
    for (const capture of Object.values(a.captures)) {
      captures += 1
      elements +=
        capture.kind === 'delta'
          ? capture.changed.length
          : capture.elements.length
    }
    diffs.push(...diffCaptureFiles(name, a, b))
  }
  return { diffs, files: Object.keys(baseline).length, captures, elements }
}

function format(diffs) {
  const lines = []
  let lastCapture = ''
  let lastElement = ''
  for (const diff of diffs) {
    const capture = `${diff.capture} › ${diff.section}`
    if (capture !== lastCapture) {
      lines.push(`\n${capture}`)
      lastCapture = capture
      lastElement = ''
    }
    if (diff.element !== lastElement) {
      lines.push(`  ${diff.element}${diff.label ? `  (${diff.label})` : ''}`)
      lastElement = diff.element
    }
    lines.push(
      `    ${diff.property}: ${diff.baseline} → ${diff.current}${diff.reason ? `  [aprovado: ${diff.reason}]` : ''}`
    )
  }
  return lines.join('\n')
}

function copyCaptures(from, to) {
  const files = listCaptureFiles(from)
  if (!Object.keys(files).length) throw new Error(`${from} não tem capturas`)
  const previous = listCaptureFiles(to)
  const missing = Object.keys(previous).filter((name) => !files[name])
  if (missing.length)
    throw new Error(
      `${from}: captura parcial; faltam arquivos da linha de base: ${missing.join(', ')}`
    )
  // Valide todos os arquivos antes de alterar a referência: um JSON inválido não pode deixar uma baseline parcial.
  for (const [name, file] of Object.entries(files)) {
    const capture = readCaptureFile(file)
    if (previous[name]) {
      const oldCapture = readCaptureFile(previous[name])
      const lost = Object.keys(oldCapture.captures).filter(
        (section) => !Object.hasOwn(capture.captures, section)
      )
      if (lost.length)
        throw new Error(
          `${file}: captura parcial; faltam estados da linha de base: ${lost.join(', ')}`
        )
    }
  }
  for (const [name, file] of Object.entries(files)) {
    const target = path.join(to, ...name.split('/')) + '.json'
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(file, target)
  }
  return Object.keys(files).length
}

function main() {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
  )
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const index = args.indexOf(name)
    return index === -1 ? fallback : path.resolve(args[index + 1])
  }
  const baselineDir = option(
    '--baseline',
    path.join(root, 'tests', 'visual', 'baseline')
  )
  const currentDir = option(
    '--current',
    path.join(root, '.tmp', 'visual', 'current')
  )
  const approvedFile = option(
    '--approved',
    path.join(root, 'tests', 'visual', 'approved-changes.json')
  )
  if (args.includes('--write-baseline')) {
    const count = copyCaptures(currentDir, baselineDir)
    process.stdout.write(
      `linha de base gravada: ${count} arquivo(s) de ${path.relative(root, currentDir)} em ${path.relative(root, baselineDir)}\n`
    )
    return
  }
  const { approvals, problems } = fs.existsSync(approvedFile)
    ? readApprovals(fs.readFileSync(approvedFile, 'utf8'))
    : { approvals: [], problems: [`${approvedFile} não existe`] }
  const { diffs, files, captures, elements } = compareDirectories(
    baselineDir,
    currentDir
  )
  const { pending, approved, unused } = applyApprovals(diffs, approvals)
  if (args.includes('--json')) {
    process.stdout.write(
      `${JSON.stringify({ files, captures, elements, pending, approved, unused, problems }, null, 2)}\n`
    )
  } else {
    if (pending.length) process.stdout.write(`${format(pending)}\n`)
    if (approved.length)
      process.stdout.write(`\naprovadas:${format(approved)}\n`)
    for (const entry of unused)
      process.stdout.write(
        `aviso: aprovação sem diferença correspondente: ${JSON.stringify(entry)}\n`
      )
    for (const problem of problems) process.stdout.write(`ERRO ${problem}\n`)
    process.stdout.write(
      `\n${pending.length ? `${pending.length} diferença(s) não aprovada(s)` : 'nenhuma diferença não aprovada'} — ${files} arquivo(s), ${captures} captura(s), ${elements} elemento(s) na linha de base; ${approved.length} aprovada(s)\n`
    )
  }
  process.exitCode = pending.length || problems.length ? 1 : 0
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
const self = fileURLToPath(import.meta.url)
if (
  process.platform === 'win32'
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self
)
  main()
