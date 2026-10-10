#!/usr/bin/env node
// Test colocation guard: every test kept next to the code must show up in the VS Code explorer
// nested under the file it tests. A test file is named after its subject —
// `<subject>.test.ts(x)` or `<subject>.<aspect>.test.ts(x)` — and the nesting rules that decide
// what "after its subject" means live in one place only: `explorer.fileNesting.patterns` in
// .vscode/settings.json. This tool reads those patterns and applies the algorithm VS Code itself
// uses (ExplorerFileNestingTrie): a parent pattern holds at most one `*`, the text it captures
// replaces `${capture}` in the child patterns, children are matched per folder and resolved to
// their root ancestors. A test is an ORPHAN when none of its root ancestors is a non-test file,
// i.e. it would sit loose in the explorer instead of under a subject.
//
// Scope: every test file (`*.test.*` / `*.spec.*`, js/ts/jsx/tsx/mjs/cjs/mts/cts) in the
// repository, except the root `tests/` folder (suites that are not colocated by design), any
// `__fixtures__` folder, dot-folders (.git, .next, .tmp, vendored agent skills…), node_modules,
// build outputs and symbolic links/junctions (never followed).
// The former root .next was retired in F; the basename above still describes generated host outputs excluded from colocation.
//
// Case: names are compared case-sensitively, like VS Code does on case-sensitive file systems
// (Linux CI, macOS with case-sensitive volumes). On Windows VS Code lowercases both sides, so
// whatever passes here nests there too; the opposite is not true.
//
// Exceptions: tools/test-colocation-allowlist.json maps a repo-relative test path to the reason it
// cannot sit under a subject (e.g. a cross-cutting architecture test). The list may only shrink
// honestly: an entry without a reason, an entry whose file does not exist and an entry that is no
// longer an orphan all fail the check.
//
// Usage: node tools/test-colocation-check.mjs [--root <dir>] [--settings <file>] [--allowlist <file>] [--json]
// Exit code: 0 when there is no orphan outside the allowlist and the allowlist is valid; 1 otherwise.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SETTINGS_FILE = '.vscode/settings.json'
export const ALLOWLIST_FILE = 'tools/test-colocation-allowlist.json'
export const MIN_REASON_LENGTH = 8

const ZERO_WIDTH_SPACE = new RegExp(String.fromCharCode(0x200b), 'g')
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/
/** Folder names never walked, wherever they are. Dot-folders are skipped separately. */
const SKIPPED_FOLDERS = new Set([
  'node_modules',
  '__fixtures__',
  'dist',
  'dist-export',
  'build',
  'out',
  'coverage',
  'storybook-static',
])
/** Top-level folders that hold suites which are not colocated by design. */
const SKIPPED_ROOT_FOLDERS = new Set(['tests'])

export function isTestFile(name) {
  return TEST_FILE.test(name)
}

/** Index of the next character that is not whitespace or inside a comment, from `i` on. */
function nextSignificant(text, i) {
  while (i < text.length) {
    if (/\s/.test(text[i])) i++
    else if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i)
      i = end === -1 ? text.length : end
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
    } else return i
  }
  return i
}

/** Parses JSON with comments and trailing commas, as VS Code accepts in settings.json. Strings are kept intact. */
export function parseJsonc(text) {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (ch === '\\') out += text[++i] ?? ''
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
      out += ch
    } else if (text.startsWith('//', i) || text.startsWith('/*', i)) {
      i = nextSignificant(text, i) - 1
      out += ' '
    } else if (
      ch === ',' &&
      '}]'.includes(text[nextSignificant(text, i + 1)] ?? '')
    ) {
      // trailing comma: dropped
    } else out += ch
  }
  return JSON.parse(out)
}

/**
 * Extracts `explorer.fileNesting` from a settings object (flat dotted keys or nested objects) and
 * normalizes the patterns exactly like the explorer does: keys trimmed; values split on commas,
 * trimmed, zero-width spaces removed, empty items dropped; non-string entries ignored.
 */
export function readNestingSettings(settings) {
  const nested = settings?.explorer?.fileNesting ?? {}
  const enabled =
    settings?.['explorer.fileNesting.enabled'] ?? nested.enabled ?? false
  const raw = settings?.['explorer.fileNesting.patterns'] ?? nested.patterns
  const problems = []
  if (enabled !== true)
    problems.push(
      `${SETTINGS_FILE}: "explorer.fileNesting.enabled" must be true, otherwise VS Code nests nothing`
    )
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push(
      `${SETTINGS_FILE}: "explorer.fileNesting.patterns" must be an object { "<parent>": "<child>, <child>" }`
    )
    return { patterns: [], problems }
  }
  const patterns = Object.entries(raw)
    .filter(
      ([parent, children]) =>
        typeof parent === 'string' &&
        typeof children === 'string' &&
        parent &&
        children
    )
    .map(([parent, children]) => [
      parent.trim(),
      children
        .split(',')
        .map((child) => child.trim().replace(ZERO_WIDTH_SPACE, '').trim())
        .filter((child) => child !== ''),
    ])
  return { patterns, problems }
}

// ---------------------------------------------------------------------------------------------
// Port of VS Code's ExplorerFileNestingTrie (src/vs/workbench/contrib/files/common/
// explorerFileNestingTrie.ts). Kept structurally identical on purpose so that edge cases (a `*`
// matching the empty string, several parents, chains resolved to root ancestors, cycles) behave
// the same as in the editor.

const SUBSTITUTION = /\$[({](capture|basename|dirname|extname)[)}]/g

class SubstitutionString {
  constructor(pattern) {
    this.tokens = []
    SUBSTITUTION.lastIndex = 0
    let token
    let lastIndex = 0
    while ((token = SUBSTITUTION.exec(pattern))) {
      this.tokens.push(pattern.slice(lastIndex, token.index))
      this.tokens.push({ capture: token[1] })
      lastIndex = token.index + token[0].length
    }
    if (lastIndex !== pattern.length) this.tokens.push(pattern.slice(lastIndex))
  }

  substitute(attributes, capture) {
    return this.tokens
      .map((token) => {
        if (typeof token === 'string') return token
        if (token.capture === 'capture') return capture ?? ''
        return attributes[token.capture]
      })
      .join('')
  }
}

class SufTrie {
  constructor() {
    this.star = []
    this.epsilon = []
    this.map = new Map()
    this.hasItems = false
  }

  add(key, value) {
    this.hasItems = true
    if (key === '*') this.star.push(new SubstitutionString(value))
    else if (key === '') this.epsilon.push(new SubstitutionString(value))
    else {
      const tail = key[key.length - 1]
      const rest = key.slice(0, -1)
      if (tail === '*')
        throw new Error(`Unexpected star in SufTrie key: ${key}`)
      let next = this.map.get(tail)
      if (!next) this.map.set(tail, (next = new SufTrie()))
      next.add(rest, value)
    }
  }

  get(key, attributes) {
    const results = []
    if (key === '')
      results.push(...this.epsilon.map((s) => s.substitute(attributes)))
    if (this.star.length)
      results.push(...this.star.map((s) => s.substitute(attributes, key)))
    const next = this.map.get(key[key.length - 1])
    if (next) results.push(...next.get(key.slice(0, -1), attributes))
    return results
  }
}

class PreTrie {
  constructor() {
    this.value = new SufTrie()
    this.map = new Map()
  }

  add(key, value) {
    if (key === '' || key[0] === '*') this.value.add(key, value)
    else {
      let next = this.map.get(key[0])
      if (!next) this.map.set(key[0], (next = new PreTrie()))
      next.add(key.slice(1), value)
    }
  }

  get(key, attributes) {
    const results = [...this.value.get(key, attributes)]
    const next = this.map.get(key[0])
    if (next) results.push(...next.get(key.slice(1), attributes))
    return results
  }
}

function filenameAttributes(name, dirname) {
  const lastDot = name.lastIndexOf('.')
  return lastDot < 1
    ? { dirname, basename: name, extname: '' }
    : {
        dirname,
        basename: name.slice(0, lastDot),
        extname: name.slice(lastDot + 1),
      }
}

/** Builds the nester for normalized `[parentPattern, childPatterns[]]` pairs. */
export function createFileNester(patterns) {
  const root = new PreTrie()
  for (const [parent, children] of patterns)
    for (const child of children) root.add(parent, child)
  return {
    /** Files of one folder → Map(root ancestor → Set(nested files)), as the explorer computes it. */
    nest(files, dirname) {
      const parentFinder = new PreTrie()
      for (const potentialParent of files) {
        for (const child of root.get(
          potentialParent,
          filenameAttributes(potentialParent, dirname)
        ))
          parentFinder.add(child, potentialParent)
      }
      const rootAncestors = (file, seen = new Set()) => {
        if (seen.has(file)) return []
        seen.add(file)
        const parents = parentFinder.get(
          file,
          filenameAttributes(file, dirname)
        )
        if (parents.length === 0) return [file]
        if (parents.length === 1 && parents[0] === file) return [file]
        return parents.flatMap((parent) => rootAncestors(parent, seen))
      }
      const result = new Map()
      for (const file of files) {
        let ancestors = rootAncestors(file)
        if (ancestors.length === 0) ancestors = [file]
        for (const ancestor of ancestors) {
          let nested = result.get(ancestor)
          if (!nested) result.set(ancestor, (nested = new Set()))
          if (file !== ancestor) nested.add(file)
        }
      }
      return result
    },
  }
}

/** Test files of one folder that no non-test file nests. `files` are the folder's file names. */
export function orphanTestsIn(nester, files, dirname) {
  const shownUnderSubject = new Set()
  for (const [ancestor, nested] of nester.nest(files, dirname)) {
    if (isTestFile(ancestor)) continue
    for (const file of nested) shownUnderSubject.add(file)
  }
  return files.filter(
    (file) => isTestFile(file) && !shownUnderSubject.has(file)
  )
}

/** Yields [repo-relative posix folder, file names] for every walked folder that holds a test file. */
export function* foldersWithTests(root) {
  const pending = ['']
  while (pending.length) {
    const relative = pending.pop()
    const entries = fs.readdirSync(path.join(root, relative), {
      withFileTypes: true,
    })
    const files = []
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        const skip =
          entry.name.startsWith('.') ||
          SKIPPED_FOLDERS.has(entry.name) ||
          (relative === '' && SKIPPED_ROOT_FOLDERS.has(entry.name))
        if (!skip)
          pending.push(relative ? `${relative}/${entry.name}` : entry.name)
      } else if (entry.isFile()) files.push(entry.name)
    }
    if (files.some(isTestFile)) yield [relative, files.sort()]
  }
}

/** Colocated tests under `root`: how many were examined and the orphans, as sorted repo-relative posix paths. */
export function findOrphanTests(root, patterns) {
  const nester = createFileNester(patterns)
  const orphans = []
  let examined = 0
  for (const [folder, files] of foldersWithTests(root)) {
    const dirname = folder
      ? folder.slice(folder.lastIndexOf('/') + 1)
      : path.basename(root)
    examined += files.filter(isTestFile).length
    for (const file of orphanTestsIn(nester, files, dirname))
      orphans.push(folder ? `${folder}/${file}` : file)
  }
  return { examined, orphans: orphans.sort() }
}

/** Validates the allowlist body: { "orphans": { "<repo-relative test path>": "<reason>" } }. */
export function readAllowlist(text) {
  const problems = []
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      allowed: new Map(),
      problems: [`${ALLOWLIST_FILE} is not valid JSON: ${error.message}`],
    }
  }
  const listed = data?.orphans
  if (!listed || typeof listed !== 'object' || Array.isArray(listed)) {
    return {
      allowed: new Map(),
      problems: [
        `${ALLOWLIST_FILE}: expected an object "orphans": { "<test path>": "<reason>" }`,
      ],
    }
  }
  const allowed = new Map()
  for (const [file, reason] of Object.entries(listed)) {
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH)
      problems.push(
        `${ALLOWLIST_FILE}: "${file}" needs a reason (${MIN_REASON_LENGTH}+ characters)`
      )
    else allowed.set(file, reason.trim())
  }
  return { allowed, problems }
}

/**
 * Runs the whole check. Returns the orphans split into allowed and unlisted, the allowlist entries
 * that are stale (file missing, or no longer an orphan) and configuration problems.
 */
export function checkTestColocation(
  root,
  { settingsFile, allowlistFile } = {}
) {
  const settingsPath = path.resolve(root, settingsFile ?? SETTINGS_FILE)
  const allowlistPath = path.resolve(root, allowlistFile ?? ALLOWLIST_FILE)
  const problems = []
  let patterns = []
  if (!fs.existsSync(settingsPath))
    problems.push(`${SETTINGS_FILE} not found at ${settingsPath}`)
  else {
    try {
      const nesting = readNestingSettings(
        parseJsonc(fs.readFileSync(settingsPath, 'utf8'))
      )
      patterns = nesting.patterns
      problems.push(...nesting.problems)
    } catch (error) {
      problems.push(`${SETTINGS_FILE} could not be parsed: ${error.message}`)
    }
  }
  let allowed = new Map()
  if (fs.existsSync(allowlistPath)) {
    const list = readAllowlist(fs.readFileSync(allowlistPath, 'utf8'))
    allowed = list.allowed
    problems.push(...list.problems)
  }
  const { examined, orphans } = problems.length
    ? { examined: 0, orphans: [] }
    : findOrphanTests(root, patterns)
  const orphanSet = new Set(orphans)
  const stale = []
  for (const file of allowed.keys()) {
    if (!fs.existsSync(path.join(root, file)))
      stale.push({ file, why: 'file does not exist' })
    else if (!orphanSet.has(file))
      stale.push({
        file,
        why: 'no longer an orphan (it nests under a subject or is out of scope)',
      })
  }
  return {
    examined,
    orphans,
    allowed: orphans
      .filter((file) => allowed.has(file))
      .map((file) => ({ file, reason: allowed.get(file) })),
    unlisted: orphans.filter((file) => !allowed.has(file)),
    stale,
    problems,
    ok:
      problems.length === 0 &&
      stale.length === 0 &&
      orphans.every((file) => allowed.has(file)),
  }
}

function option(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
const self = fileURLToPath(import.meta.url)
if (
  process.platform === 'win32'
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self
) {
  const args = process.argv.slice(2)
  const root = path.resolve(
    option(args, '--root') ?? path.join(path.dirname(self), '..')
  )
  const report = checkTestColocation(root, {
    settingsFile: option(args, '--settings'),
    allowlistFile: option(args, '--allowlist'),
  })
  if (args.includes('--json'))
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else {
    for (const problem of report.problems)
      process.stdout.write(`CONFIG ${problem}\n`)
    for (const file of report.unlisted)
      process.stdout.write(
        `ORPHAN ${file} — rename it to <subject>.test.ts(x) or <subject>.<aspect>.test.ts(x) next to the file it tests (${SETTINGS_FILE} explorer.fileNesting.patterns)\n`
      )
    for (const { file, why } of report.stale)
      process.stdout.write(
        `STALE ${ALLOWLIST_FILE}: ${file} — ${why}; remove the entry\n`
      )
    for (const { file, reason } of report.allowed)
      process.stdout.write(`allowed ${file} (${reason})\n`)
    const summary = `${report.examined} colocated test file(s), ${report.orphans.length} orphan(s): ${report.allowed.length} allowed, ${report.unlisted.length} unlisted; ${report.stale.length} stale allowlist entr${report.stale.length === 1 ? 'y' : 'ies'}`
    process.stdout.write(
      `${report.ok ? 'test colocation check passed' : 'test colocation check FAILED'} — ${summary}\n`
    )
  }
  process.exitCode = report.ok ? 0 : 1
}
