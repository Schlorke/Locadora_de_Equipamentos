#!/usr/bin/env node
// Anchors the ratchet baselines to the base of the change.
//
// `pnpm arch` and `pnpm tokens` compare the tree with the baseline stored in the same tree, so a change could
// raise the baseline itself (edit a count, or delete the file and run --init-baseline) and stay green. This guard
// reads each baseline at the base commit (git show <base>:<file>) and fails when, in the tree:
//   - a count per file and rule is higher than at the base, or a file/rule pair the base does not have appears;
//   - a baseline file, or a rule listed in its "rules", that exists at the base is gone;
//   - the baseline is not valid for its own tool;
//   - arch.config.json or a workspace package manifest narrows what a gate checks, measured or declared (below).
// What is counted comes from the BASE, never from the change: the base baseline is found through the
// arch.config.json of the base commit (a change that points "ratchetBaseline" or "tokens.baseline" elsewhere is
// still compared with the base file). The configuration may widen what the gates check, never narrow it, in two
// ways checked on every run:
//   - declared (CONFIG_POLICY): each setting of the tree covers the base one: a scope (universalSourceRoots,
//     legacyRoots, tokens.scope/legacyScope/canonical, serverOnlyPackages) keeps every base entry, an exemption
//     (ignoreFiles, ignoreDirs, allow, nonRuntimeRoots, clientEntrypoints) gains none, a list stays a list, any
//     other setting stays equal. The workspace manifests the gates read are settings too: a package server-only
//     at the base (contextWindow.runtime "server" or serverOnlyPackages) stays server-only, and so does every
//     package inside it, with its name or holding its code (git diff -M); the rest of contextWindow stays equal; an existing package gains no
//     entry point in "exports" (nor does a package created inside one). This holds where no debt exists today:
//     a scope narrowed now would hide the debt of the next change.
//   - measured: when the configuration differs, the tree code is checked with both. A file the base configuration
//     counts more than the tree configuration fails, and so does a file/rule the base configuration fails
//     (zero-tolerance and absolute rules, not only the ratcheted ones) more often than the tree one. Findings about
//     the configuration itself (CONFIG_RULES: a root to classify, an exclusion without a reason) are left to the
//     declared check: classifying a new root answers them, it hides nothing.
// A base without any gate configuration (no arch.config.json, baseline or gate tool) has nothing to narrow: the
// change introduces the configuration, and only its baselines are validated.
// A narrowing the product decides on is recorded in the same change, with its reason, as an approval in
// tools/ratchet-transfers.json: { approve: "<setting>", entry, reason } (the gained exemption, or the dropped
// scope entry; "package.serverOnly" / "package.contextWindow" take the package directory, "package.exports"
// "<name>#<subpath>"). An approval only counts in the change that adds it (one already at the base approves
// nothing), it is printed with its reason, and it never covers a zero-tolerance rule (css-important).
// Zero tolerance, on every run: css-important is also measured with the tree configuration stripped of every
// exemption a configuration can add (only the token gate's own default ignore lists stay) and over every scope
// the base, the tree or the gate's defaults check (zeroToleranceConfig). A finding there that the tree
// configuration does not see fails, whether the exemption hiding it is new, approved now or already at the base:
// an approval never covers a zero-tolerance rule, not even in the changes after the one that records it.
// Three more exceptions, all measured against the base and never granted by the change itself:
//   - moved path: tools/ratchet-transfers.json records { config: "tokens.scope", from, to, reason } when a path
//     named by a path setting moved; the base entry `from` is then covered by `to`. Accepted only when `from` no
//     longer exists in the tree, `to` did not exist at the base and git detects every file of base:`from` as
//     renamed to the same path under `to` (git diff -M). A transfer whose `from` the base configuration no longer
//     names (the move is already at the base) is stale: ignored, and it covers nothing.
//   - rename: tools/ratchet-transfers.json records { baseline, from, to, reason, counts }. The base allowance of
//     `from` (capped by `counts`) moves to `to`, so the total never grows. A transfer is only accepted when `from`
//     no longer exists in the tree, `to` did not exist at the base and git detects base:`from` -> tree:`to` as a
//     rename (git diff -M); anything else fails. Record one with --rename <from> <to> --reason "<why>", which also
//     moves the entry in the tree baseline. A transfer whose `from` has no entry at the base is stale and ignored.
//   - new coverage: when the current rules (a new rule, a wider pattern, a wider scope) find more debt in the BASE
//     code than the base baseline records, that much is allowed. It is measured by running the current tools on a
//     read-only extraction of the base commit (git ls-tree + git cat-file into a temporary directory), so debt the
//     change itself adds is never covered. --adopt-coverage writes exactly that into the tree baselines, capped by
//     the current count and by the tree entry plus the new coverage (a locked reduction is never reopened).
// The hygiene gate (pnpm hygiene, tools/hygiene-check.mjs) is anchored the same way (hygieneNarrowing): its
// baseline (tools/hygiene-baseline.json) gains no item the base does not accept, and its knip configuration
// (knip.jsonc) gains no exemption (entry, ignore*), drops no scope (a project value, a negated "!glob" added to
// project, a workspace) and changes no other
// setting, unless the change approves each one as "hygiene.baseline" / "hygiene.knip" with its reason.
//
// Base: --base <ref> | RATCHET_BASE_REF | origin/main | HEAD~1, then the merge base of that ref with HEAD.
// Usage: node tools/ratchet-guard.mjs [--base <ref>] [--adopt-coverage] [--rename <from> <to> --reason <text>]
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as arch from './arch-check.mjs'
import * as tokens from './token-check.mjs'
// knip.jsonc is read with the hygiene gate's own parser (one reader for the file both tools read).
import { parseJsonc } from './hygiene-check.mjs'

export const TRANSFERS_FILE = 'tools/ratchet-transfers.json'
export const CONFIG_FILE = 'arch.config.json'
/** Where the baselines have always lived; consulted at the base only when its configuration names no existing file. */
const KNOWN_BASELINES = {
  arch: 'tools/arch-baseline.json',
  tokens: 'tools/token-baseline.json',
}
const TREE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json|css)$/
/** Findings about the configuration itself: answered by classifying or explaining, governed by the declared check. */
export const CONFIG_RULES = new Set([
  'UNCLASSIFIED-ROOT',
  'SCOPE-EXCLUSION',
  'TOPOLOGY',
  'exception-without-reason',
])
/** The gate tools: a base with none of them, no configuration and no baseline has no gates to narrow. */
const GATE_TOOLS = ['tools/arch-check.mjs', 'tools/token-check.mjs']
const toPosix = (value) => value.split(path.sep).join('/')
const clone = (files) =>
  Object.fromEntries(
    Object.entries(files ?? {}).map(([file, rules]) => [file, { ...rules }])
  )
const sum = (files) => {
  const byRule = {}
  for (const rules of Object.values(files ?? {}))
    for (const [rule, count] of Object.entries(rules))
      byRule[rule] = (byRule[rule] ?? 0) + count
  return byRule
}
const total = (rules) =>
  Object.values(rules ?? {}).reduce((acc, count) => acc + count, 0)
/** JSON with sorted object keys, to compare configurations by content. */
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  )

/** The configurations of both gates read from the arch.config.json in `root` (defaults when it is absent). */
export function loadConfigs(root) {
  return { arch: arch.loadConfig(root), tokens: tokens.loadTokenConfig(root) }
}

/** The same configurations from the text of an arch.config.json (null: the file does not exist). */
export function configsFromText(text) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-config-'))
  try {
    if (text !== null) fs.writeFileSync(path.join(directory, CONFIG_FILE), text)
    return loadConfigs(directory)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * The two ratcheted gates: where their baseline lives, how to validate/serialize it and how to count a tree,
 * all for one configuration (the tree's by default).
 */
export function baselineSpecs(root, configs = loadConfigs(root)) {
  return [
    {
      name: 'arch',
      config: configs.arch,
      file: toPosix(path.relative(root, arch.baselinePath(root, configs.arch))),
      validate: (file) => arch.readBaseline(file).errors,
      serialize: (files) => arch.serializeBaseline(files),
      count: (tree) =>
        arch.check(tree, { config: configs.arch }).ratchet.counts,
      findings: (tree) => {
        const report = arch.check(tree, { config: configs.arch })
        // Every finding, tolerated or not; `failing` only the rules that fail on any occurrence.
        return findingsOf(
          [...report.violations, ...report.ratchet.tolerated].filter(
            (v) => v.rule !== 'RATCHET-BASELINE' && !CONFIG_RULES.has(v.rule)
          ),
          (v) => !arch.RATCHET_RULES.includes(v.rule)
        )
      },
    },
    {
      name: 'tokens',
      zeroTolerance: tokens.ZERO_TOLERANCE_RULES,
      config: configs.tokens,
      file: toPosix(
        path.relative(root, tokens.baselinePath(root, configs.tokens))
      ),
      validate: (file) => {
        try {
          tokens.readBaseline(file, configs.tokens)
          return []
        } catch (error) {
          return [error.message]
        }
      },
      serialize: (files) => tokens.serializeBaseline(files),
      count: (tree) =>
        tokens.checkTokens(tree, configs.tokens, null).ratchet.counts,
      findings: (tree) => {
        // Without a baseline every ratcheted finding is also copied into `violations` (marked `ratchet`).
        const report = tokens.checkTokens(tree, configs.tokens, null)
        const failing = report.violations.filter(
          (v) => !v.ratchet && !CONFIG_RULES.has(v.rule)
        )
        return findingsOf([...report.ratcheted, ...failing], (v) =>
          failing.includes(v)
        )
      },
    },
  ]
}

/** Findings per file and rule: `all` of them, and those that `fail` whatever the baseline says. */
function findingsOf(violations, fails) {
  const all = {}
  const failing = {}
  for (const v of violations) {
    for (const target of fails(v) ? [all, failing] : [all]) {
      target[v.file] ??= {}
      target[v.file][v.rule] = (target[v.file][v.rule] ?? 0) + 1
    }
  }
  return { all, failing }
}

const isRecord = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Validates tools/ratchet-transfers.json; returns the transfers and the problems found. */
export function readTransfers(text, names) {
  if (text === null) return { transfers: [], problems: [] }
  let data
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      transfers: [],
      problems: [`${TRANSFERS_FILE} is not valid JSON: ${error.message}`],
    }
  }
  const problems = []
  const transfers = []
  for (const [index, entry] of (Array.isArray(data?.transfers)
    ? data.transfers
    : []
  ).entries()) {
    const where = `${TRANSFERS_FILE} transfers[${index}]`
    // A moved path of a configuration setting (readConfigTransfers) or an approval (readApprovals).
    if (isRecord(entry) && ('config' in entry || 'approve' in entry)) continue
    if (!names.includes(entry?.baseline))
      problems.push(`${where}: "baseline" must be one of ${names.join(', ')}`)
    else if (
      typeof entry.from !== 'string' ||
      typeof entry.to !== 'string' ||
      !entry.from ||
      !entry.to ||
      entry.from === entry.to
    )
      problems.push(`${where}: "from" and "to" must be two different paths`)
    else if (typeof entry.reason !== 'string' || entry.reason.trim().length < 8)
      problems.push(`${where}: a transfer needs a "reason" (8+ characters)`)
    else if (
      entry.counts !== undefined &&
      (!isRecord(entry.counts) ||
        !Object.values(entry.counts).every(
          (count) => Number.isInteger(count) && count > 0
        ))
    )
      problems.push(`${where}: "counts" must map rules to positive integers`)
    else
      transfers.push({
        baseline: entry.baseline,
        from: entry.from,
        to: entry.to,
        reason: entry.reason,
        ...(entry.counts === undefined ? {} : { counts: { ...entry.counts } }),
      })
  }
  if (data !== undefined && !Array.isArray(data?.transfers))
    problems.push(`${TRANSFERS_FILE}: expected { "transfers": [ ... ] }`)
  return { transfers, problems }
}

/**
 * Moves the allowance of each transfer's `from` to its `to`, in order; never creates allowance. With `counts`,
 * only up to the recorded count per rule moves (the rest of the base allowance is dropped).
 */
export function applyTransfers(files, transfers, name) {
  const next = clone(files)
  const applied = []
  for (const transfer of transfers.filter((entry) => entry.baseline === name)) {
    if (!next[transfer.from]) {
      applied.push({ ...transfer, status: 'stale' })
      continue
    }
    next[transfer.to] ??= {}
    for (const [rule, count] of Object.entries(next[transfer.from])) {
      const moved = transfer.counts
        ? Math.min(count, transfer.counts[rule] ?? 0)
        : count
      if (moved > 0)
        next[transfer.to][rule] = (next[transfer.to][rule] ?? 0) + moved
    }
    if (!Object.keys(next[transfer.to]).length) delete next[transfer.to]
    delete next[transfer.from]
    applied.push({ ...transfer, status: 'applied' })
  }
  return { files: next, applied }
}

/**
 * Splits the transfers of one baseline into those that may move allowance and the rejected ones. A transfer
 * needs `counts` and a positive answer from `verify(transfer)` (the evidence in git); one whose `from` has no base
 * entry is stale and ignored.
 */
export function checkTransfers(baseFiles, transfers, name, verify) {
  const accepted = []
  const results = []
  for (const transfer of transfers.filter((entry) => entry.baseline === name)) {
    if (!baseFiles?.[transfer.from]) {
      results.push({ ...transfer, status: 'stale' })
      continue
    }
    const problem = !transfer.counts
      ? `"counts" is required (record the transfer with --rename)`
      : typeof verify === 'function'
        ? verify(transfer)
        : 'no evidence of the rename is available'
    if (problem) results.push({ ...transfer, status: 'rejected', problem })
    else accepted.push(transfer)
  }
  return {
    accepted,
    rejected: results.filter((entry) => entry.status === 'rejected'),
    stale: results.filter((entry) => entry.status === 'stale'),
  }
}

/**
 * Tree entries above the base allowance. With `coverage` (current tools on the base code), an increase up to what
 * the base code measures is new coverage; anything above it is a problem.
 */
export function compareBaselines(allowance, tree, coverage = null) {
  const increases = []
  const covered = []
  for (const file of Object.keys(tree).sort()) {
    for (const [rule, count] of Object.entries(tree[file])) {
      const allowed = allowance[file]?.[rule] ?? 0
      if (count <= allowed) continue
      const measured = coverage ? (coverage[file]?.[rule] ?? 0) : null
      const entry = {
        file,
        rule,
        base: allowed,
        tree: count,
        measured,
        newPair: !(file in allowance) || !(rule in allowance[file]),
      }
      if (coverage && count <= measured) covered.push(entry)
      else increases.push(entry)
    }
  }
  return { increases, covered }
}

/** Files the base configuration counts more than the tree configuration, in the same (tree) code. */
export function narrowedFiles(baseCounts, treeCounts) {
  const narrowed = []
  for (const file of Object.keys(baseCounts ?? {}).sort()) {
    const base = total(baseCounts[file])
    const tree = total(treeCounts?.[file])
    if (tree < base) narrowed.push({ file, base, tree })
  }
  return narrowed
}

/** File/rule pairs the base configuration fails more often than the tree configuration, in the same code. */
export function narrowedFailures(baseFailing, treeFailing) {
  const narrowed = []
  for (const file of Object.keys(baseFailing ?? {}).sort()) {
    for (const rule of Object.keys(baseFailing[file]).sort()) {
      const base = baseFailing[file][rule]
      const tree = treeFailing?.[file]?.[rule] ?? 0
      if (tree < base) narrowed.push({ file, rule, base, tree })
    }
  }
  return narrowed
}

const WIDEN = '(a change may widen what the gates check, never narrow it)'

/**
 * The token configuration zero-tolerance rules are measured with: the tree's, with every exemption a configuration
 * can add removed (ignoreFiles and ignoreDirs are the token gate's own defaults, `allow` never applies to them)
 * and every scope checked by the base, the tree or the gate's defaults. No approval, in this change or already at
 * the base, reaches it.
 */
export function zeroToleranceConfig(tree, base = null) {
  const defaults = tokens.DEFAULT_TOKEN_CONFIG
  const list = (value) =>
    Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
  const union = (...lists) => [...new Set(lists.flatMap(list))]
  return {
    ...tree,
    scope: union(tree.scope, base?.scope, defaults.scope),
    legacyScope: union(
      tree.legacyScope,
      base?.legacyScope,
      defaults.legacyScope
    ),
    canonical: union(tree.canonical, base?.canonical, defaults.canonical),
    ignoreDirs: [...defaults.ignoreDirs],
    ignoreFiles: [...defaults.ignoreFiles],
    allow: [],
  }
}

/** Zero-tolerance findings per file and rule of the token gate run on `root` with `config`. */
function zeroToleranceFindings(root, config) {
  const zero = new Set(tokens.ZERO_TOLERANCE_RULES)
  const found = {}
  for (const v of tokens.checkTokens(root, config, null).violations) {
    if (!zero.has(v.rule)) continue
    found[v.file] ??= {}
    found[v.file][v.rule] = (found[v.file][v.rule] ?? 0) + 1
  }
  return found
}

/**
 * Zero-tolerance findings the configuration hides in the tree code: every file/rule zeroToleranceConfig finds more
 * often than the tree configuration ({ file, rule, base: without exemptions, tree }).
 */
export function hiddenZeroTolerance(root, treeConfig, baseConfig = null) {
  return narrowedFailures(
    zeroToleranceFindings(root, zeroToleranceConfig(treeConfig, baseConfig)),
    zeroToleranceFindings(root, treeConfig)
  )
}

/**
 * How each setting of the gates may differ from the base (declared narrowing). `cover`: every base entry stays
 * covered by a tree entry (a scope); `subset`: the tree adds no entry (an exemption); `free`: compared elsewhere
 * (the baseline location, the tokens section of the arch gate). `path` names the part of an entry that is a
 * repository path (it covers itself and everything below it, and may move through a configuration transfer);
 * `identity` the fields that tell two exemptions apart; `exclusive` the scopes a new entry must stay out of
 * (a canonical source only answers for css-important). A setting not listed must equal the base.
 */
export const CONFIG_POLICY = {
  arch: {
    universalSourceRoots: { rule: 'cover', path: '' },
    legacyRoots: { rule: 'cover', path: 'path' },
    serverOnlyPackages: { rule: 'cover' },
    clientEntrypoints: { rule: 'subset' },
    nonRuntimeRoots: { rule: 'subset', path: 'path', identity: ['path'] },
    ratchetBaseline: { rule: 'free' },
    tokens: { rule: 'free' },
  },
  tokens: {
    scope: { rule: 'cover', path: '' },
    legacyScope: { rule: 'cover', path: '' },
    canonical: { rule: 'cover', path: '', exclusive: ['scope', 'legacyScope'] },
    ignoreDirs: { rule: 'subset' },
    ignoreFiles: { rule: 'subset' },
    allow: { rule: 'subset', path: 'file', identity: ['file', 'value'] },
    baseline: { rule: 'free' },
  },
}
/** The settings a configuration transfer may name (they hold repository paths). */
export const PATH_SETTINGS = Object.entries(CONFIG_POLICY).flatMap(
  ([name, keys]) =>
    Object.entries(keys)
      .filter(([, policy]) => policy.path !== undefined)
      .map(([key]) => `${name}.${key}`)
)

const normalizePath = (value) =>
  String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
const within = (child, ancestor) =>
  ancestor === '' ||
  ancestor === '.' ||
  child === ancestor ||
  child.startsWith(`${ancestor}/`)

/** The settings as the tools read them, defaults included (arch-runtime's universal root and legacy string form). */
function effectiveSettings(name, config) {
  if (name !== 'arch') return config
  return {
    ...config,
    universalSourceRoots: config.universalSourceRoots ?? [
      path.posix.join(config.frontend, 'src'),
    ],
    legacyRoots: Array.isArray(config.legacyRoots ?? [])
      ? (config.legacyRoots ?? []).map((entry) =>
          typeof entry === 'string' ? { path: entry, runtime: 'mixed' } : entry
        )
      : config.legacyRoots,
    nonRuntimeRoots: config.nonRuntimeRoots ?? [],
    serverOnlyPackages: config.serverOnlyPackages ?? [],
  }
}

const entryPath = (entry, policy) =>
  normalizePath(policy.path === '' ? entry : entry?.[policy.path])
/** The fields besides the path that must match: all of them for a scope, the identity for an exemption. */
const entryRest = (entry, policy) =>
  policy.path === '' || !isRecord(entry)
    ? ''
    : canonical(
        Object.fromEntries(
          Object.entries(entry).filter(
            ([key]) =>
              key !== policy.path &&
              (!policy.identity || policy.identity.includes(key))
          )
        )
      )
const withPath = (entry, policy, value) =>
  policy.path === '' ? value : { ...entry, [policy.path]: value }
/** `outer` covers `inner`: the same entry, or (path settings) the same other fields and a path at or above it. */
function coversEntry(outer, inner, policy) {
  if (policy.path === undefined) return canonical(outer) === canonical(inner)
  return (
    entryRest(outer, policy) === entryRest(inner, policy) &&
    within(entryPath(inner, policy), entryPath(outer, policy))
  )
}

/** The approval of `label` for `entry`, if the change records one. */
const approvalFor = (approvals, label, entry) =>
  approvals.find(
    (approval) =>
      approval.approve === label &&
      canonical(approval.entry) === canonical(entry)
  )

/**
 * Declared narrowing: the settings of the tree against those of the base (see CONFIG_POLICY). `moved` are the
 * accepted configuration transfers ({ config, from, to }); `approvals` the approvals the change records, each
 * narrowing they cover is pushed to `approved` ({ label, entry, verb, reason }) instead of failing. Returns the
 * problems, one per entry.
 */
export function configNarrowing(
  baseConfigs,
  treeConfigs,
  moved = [],
  approvals = [],
  approved = []
) {
  const problems = []
  const narrowing = (label, entry, verb, problem) => {
    const approval = approvalFor(approvals, label, entry)
    if (approval) approved.push({ label, entry, verb, reason: approval.reason })
    else problems.push(problem)
  }
  for (const name of Object.keys(CONFIG_POLICY)) {
    const base = effectiveSettings(name, baseConfigs[name])
    const tree = effectiveSettings(name, treeConfigs[name])
    for (const key of [
      ...new Set([...Object.keys(base), ...Object.keys(tree)]),
    ].sort()) {
      if (key.startsWith('$')) continue
      const policy = CONFIG_POLICY[name][key]
      const label = `${name}.${key}`
      if (!policy) {
        if (canonical(base[key]) !== canonical(tree[key]))
          problems.push(
            `${label} differs from the base (${JSON.stringify(base[key])} -> ${JSON.stringify(tree[key])}); the guard cannot tell it does not narrow the gates`
          )
        continue
      }
      if (policy.rule === 'free') continue
      // The tools read a string or an object where a list belongs as something else (`includes` searches text).
      if (
        tree[key] !== undefined &&
        !Array.isArray(tree[key]) &&
        canonical(tree[key]) !== canonical(base[key])
      ) {
        problems.push(
          `${label} must be a list (the base has ${JSON.stringify(base[key])}); the tools read another type as something else`
        )
        continue
      }
      const baseEntries = Array.isArray(base[key]) ? base[key] : []
      const treeEntries = Array.isArray(tree[key]) ? tree[key] : []
      const transfers = moved.filter((transfer) => transfer.config === label)
      if (policy.rule === 'cover') {
        for (const entry of baseEntries) {
          const kept =
            treeEntries.some((candidate) =>
              coversEntry(candidate, entry, policy)
            ) ||
            transfers.some(
              (transfer) =>
                transfer.from === entryPath(entry, policy) &&
                treeEntries.some((candidate) =>
                  coversEntry(
                    candidate,
                    withPath(entry, policy, transfer.to),
                    policy
                  )
                )
            )
          if (!kept)
            narrowing(
              label,
              entry,
              'drops',
              `${label} no longer covers ${JSON.stringify(entry)}, checked by the base configuration ${WIDEN}`
            )
        }
        for (const entry of policy.exclusive ? treeEntries : []) {
          if (
            baseEntries.some((candidate) =>
              coversEntry(candidate, entry, policy)
            )
          )
            continue
          for (const scopeKey of policy.exclusive) {
            const inside = (
              Array.isArray(tree[scopeKey]) ? tree[scopeKey] : []
            ).find(
              (scope) =>
                within(entryPath(entry, policy), normalizePath(scope)) ||
                within(normalizePath(scope), entryPath(entry, policy))
            )
            if (inside !== undefined)
              narrowing(
                label,
                entry,
                'gains',
                `${label} gains ${JSON.stringify(entry)}, which overlaps ${name}.${scopeKey} ${JSON.stringify(inside)} (only css-important applies to a canonical source) ${WIDEN}`
              )
          }
        }
      } else {
        for (const entry of treeEntries) {
          const known =
            baseEntries.some((candidate) =>
              coversEntry(candidate, entry, policy)
            ) ||
            transfers.some(
              (transfer) =>
                transfer.to === entryPath(entry, policy) &&
                baseEntries.some((candidate) =>
                  coversEntry(
                    candidate,
                    withPath(entry, policy, transfer.from),
                    policy
                  )
                )
            )
          if (!known)
            narrowing(
              label,
              entry,
              'gains',
              `${label} gains ${JSON.stringify(entry)}, an exemption the base does not have ${WIDEN}`
            )
        }
      }
    }
  }
  return problems
}

/** Whether the configuration `configs` names the transfer's `from` in its setting (the move is still to be made). */
export function namesPath(configs, transfer) {
  const [name, key] = transfer.config.split('.')
  const policy = CONFIG_POLICY[name]?.[key]
  const entries = policy && effectiveSettings(name, configs[name] ?? {})[key]
  return (
    Array.isArray(entries) &&
    entries.some((entry) => entryPath(entry, policy) === transfer.from)
  )
}

/** The configuration transfers of tools/ratchet-transfers.json ({ config, from, to, reason }) and their problems. */
export function readConfigTransfers(text) {
  if (text === null) return { moved: [], problems: [] }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { moved: [], problems: [] } // reported by readTransfers
  }
  const moved = []
  const problems = []
  for (const [index, entry] of (Array.isArray(data?.transfers)
    ? data.transfers
    : []
  ).entries()) {
    if (!isRecord(entry) || !('config' in entry)) continue
    const where = `${TRANSFERS_FILE} transfers[${index}]`
    if (!PATH_SETTINGS.includes(entry.config))
      problems.push(
        `${where}: "config" must be a path setting (${PATH_SETTINGS.join(', ')})`
      )
    else if (
      typeof entry.from !== 'string' ||
      typeof entry.to !== 'string' ||
      !normalizePath(entry.from) ||
      !normalizePath(entry.to) ||
      normalizePath(entry.from) === normalizePath(entry.to)
    )
      problems.push(`${where}: "from" and "to" must be two different paths`)
    else if (typeof entry.reason !== 'string' || entry.reason.trim().length < 8)
      problems.push(`${where}: a transfer needs a "reason" (8+ characters)`)
    else
      moved.push({
        config: entry.config,
        from: normalizePath(entry.from),
        to: normalizePath(entry.to),
        reason: entry.reason,
      })
  }
  return { moved, problems }
}

/** The settings an approval may name: every CONFIG_POLICY setting that is compared, and the package declarations. */
export const APPROVABLE = [
  ...Object.entries(CONFIG_POLICY).flatMap(([name, keys]) =>
    Object.entries(keys)
      .filter(([, policy]) => policy.rule !== 'free')
      .map(([key]) => `${name}.${key}`)
  ),
  'package.serverOnly',
  'package.contextWindow',
  'package.exports',
  'hygiene.baseline',
  'hygiene.knip',
]

/** The hygiene gate (pnpm hygiene): its baseline and its knip configuration, both anchored to the base below. */
export const HYGIENE_BASELINE = 'tools/hygiene-baseline.json'
export const HYGIENE_CONFIG = 'knip.jsonc'
/** knip settings that exempt code (a new entry hides a finding): the tree keeps a subset of the base. */
const KNIP_EXEMPTIONS = [
  'entry',
  'ignore',
  'ignoreFiles',
  'ignoreDependencies',
  'ignoreBinaries',
  'ignoreUnresolved',
  'ignoreMembers',
  'ignoreWorkspaces',
]
/** knip settings that scope the analysis (a dropped entry hides a finding): the tree keeps every base entry. */
const KNIP_SCOPES = ['project']

/** The knip configuration as scopes: the root settings under "." plus one record per configured workspace. */
function knipScopes(config) {
  const { workspaces = {}, ...top } = isRecord(config) ? config : {}
  return {
    '(top-level)': top,
    ...Object.fromEntries(
      Object.entries(isRecord(workspaces) ? workspaces : {}).map(
        ([name, settings]) => [name, isRecord(settings) ? settings : {}]
      )
    ),
  }
}

/** Each (type, path, name) the hygiene baseline accepts: an entry with names accepts each name on its own. */
function hygieneKeys(text) {
  if (text === null) return new Map()
  const data = JSON.parse(text)
  const keys = new Map()
  for (const entry of Array.isArray(data?.entries) ? data.entries : []) {
    if (!isRecord(entry)) continue
    const names = Array.isArray(entry.names) ? entry.names : [undefined]
    for (const name of names) {
      const item = {
        type: entry.type,
        path: entry.path,
        ...(name === undefined ? {} : { name }),
      }
      keys.set(canonical(item), item)
    }
  }
  return keys
}

/**
 * The hygiene gate may only get stricter: an item the base baseline does not accept, an exemption the base knip
 * configuration does not have (entry, ignore*), a scope entry it drops (project, a whole workspace), a negated
 * glob it adds to project ("!src/**" keeps every base value and still takes files out) or any other
 * knip setting that differs is a narrowing, approved per item as "hygiene.baseline" ({ type, path, name? }) or
 * "hygiene.knip" ("<scope> <setting> <value>"). A base without the gate (neither file) has nothing to narrow.
 */
export function hygieneNarrowing(
  { baseConfigText, treeConfigText, baseBaselineText, treeBaselineText },
  approvals = [],
  approved = []
) {
  if (baseConfigText === null && baseBaselineText === null) return []
  const problems = []
  const narrowing = (label, entry, verb, problem) => {
    const approval = approvalFor(approvals, label, entry)
    if (approval) approved.push({ label, entry, verb, reason: approval.reason })
    else problems.push(problem)
  }
  let baseKeys
  let treeKeys
  try {
    baseKeys = hygieneKeys(baseBaselineText)
    treeKeys = hygieneKeys(treeBaselineText)
  } catch (error) {
    return [`${HYGIENE_BASELINE}: not valid JSON (${error.message})`]
  }
  for (const [key, item] of treeKeys) {
    if (!baseKeys.has(key))
      narrowing(
        'hygiene.baseline',
        item,
        'gains',
        `${HYGIENE_BASELINE} gains ${JSON.stringify(item)}, an item the base does not accept (the hygiene baseline only shrinks)`
      )
  }
  let base
  let tree
  try {
    base = knipScopes(baseConfigText === null ? {} : parseJsonc(baseConfigText))
    tree = knipScopes(treeConfigText === null ? {} : parseJsonc(treeConfigText))
  } catch (error) {
    return [
      ...problems,
      `${HYGIENE_CONFIG}: not valid JSONC (${error.message})`,
    ]
  }
  if (baseConfigText === null) return problems
  for (const scope of [
    ...new Set([...Object.keys(base), ...Object.keys(tree)]),
  ].sort()) {
    if (!(scope in tree)) {
      narrowing(
        'hygiene.knip',
        `${scope} workspace`,
        'drops',
        `${HYGIENE_CONFIG} no longer configures the workspace ${scope} ${WIDEN}`
      )
      continue
    }
    const baseSettings = base[scope] ?? {}
    const treeSettings = tree[scope]
    for (const key of [
      ...new Set([...Object.keys(baseSettings), ...Object.keys(treeSettings)]),
    ].sort()) {
      if (key.startsWith('$')) continue
      const list = (value) =>
        (value === undefined ? [] : Array.isArray(value) ? value : [value]).map(
          (item) => canonical(item)
        )
      if (KNIP_EXEMPTIONS.includes(key)) {
        const known = new Set(list(baseSettings[key]))
        for (const value of list(treeSettings[key]))
          if (!known.has(value))
            narrowing(
              'hygiene.knip',
              `${scope} ${key} ${value}`,
              'gains',
              `${HYGIENE_CONFIG} ${scope} ${key} gains ${value}, an exemption the base does not have ${WIDEN}`
            )
      } else if (KNIP_SCOPES.includes(key)) {
        const kept = new Set(list(treeSettings[key]))
        for (const value of list(baseSettings[key]))
          if (!kept.has(value))
            narrowing(
              'hygiene.knip',
              `${scope} ${key} ${value}`,
              'drops',
              `${HYGIENE_CONFIG} ${scope} ${key} no longer covers ${value}, checked by the base configuration ${WIDEN}`
            )
        // A negated glob ("!src/**") keeps every base value and still takes files out of the analysis: a narrowing.
        const known = new Set(list(baseSettings[key]))
        const raw =
          treeSettings[key] === undefined
            ? []
            : Array.isArray(treeSettings[key])
              ? treeSettings[key]
              : [treeSettings[key]]
        for (const item of raw) {
          const value = canonical(item)
          if (
            typeof item === 'string' &&
            item.trim().startsWith('!') &&
            !known.has(value)
          )
            narrowing(
              'hygiene.knip',
              `${scope} ${key} ${value}`,
              'gains',
              `${HYGIENE_CONFIG} ${scope} ${key} gains ${value}, a negation that takes files out of the analysis ${WIDEN}`
            )
        }
      } else if (
        canonical(baseSettings[key]) !== canonical(treeSettings[key])
      ) {
        narrowing(
          'hygiene.knip',
          `${scope} ${key}`,
          'changes',
          `${HYGIENE_CONFIG} ${scope} ${key} differs from the base (${JSON.stringify(baseSettings[key])} -> ${JSON.stringify(treeSettings[key])}); the guard cannot tell it does not narrow the gate`
        )
      }
    }
  }
  return problems
}

/**
 * The approvals of tools/ratchet-transfers.json ({ approve, entry, reason }) that this change adds: one already in
 * the base file approves nothing, so each narrowing carries its own approval in the diff that makes it.
 */
export function readApprovals(text, baseText = null) {
  const entriesOf = (source) => {
    if (source === null) return []
    try {
      const data = JSON.parse(source)
      return (Array.isArray(data?.transfers) ? data.transfers : [])
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => isRecord(entry) && 'approve' in entry)
    } catch {
      return [] // reported by readTransfers
    }
  }
  const atBase = new Set(
    entriesOf(baseText).map(({ entry }) =>
      canonical({ approve: entry.approve, entry: entry.entry })
    )
  )
  const approvals = []
  const problems = []
  for (const { entry, index } of entriesOf(text)) {
    const where = `${TRANSFERS_FILE} transfers[${index}]`
    if (!APPROVABLE.includes(entry.approve))
      problems.push(
        `${where}: "approve" must be one of ${APPROVABLE.join(', ')}`
      )
    else if (entry.entry === undefined)
      problems.push(`${where}: an approval names the "entry" it approves`)
    else if (typeof entry.reason !== 'string' || entry.reason.trim().length < 8)
      problems.push(`${where}: an approval needs a "reason" (8+ characters)`)
    else if (
      !atBase.has(canonical({ approve: entry.approve, entry: entry.entry }))
    )
      approvals.push({
        approve: entry.approve,
        entry: entry.entry,
        reason: entry.reason.trim(),
      })
  }
  return { approvals, problems }
}

/** Directories arch-check never reads packages from; the former root .next was retired, while host outputs still use this name. */
const PACKAGE_SKIP = new Set([
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
/** A workspace manifest arch-check reads: apps/ or packages/, at most three directories deep, no skipped or hidden directory. */
const isManifestPath = (file) => {
  if (!file.endsWith('/package.json')) return false
  const segments = file.split('/').slice(0, -1)
  return (
    ['apps', 'packages'].includes(segments[0]) &&
    segments.length <= 3 &&
    !segments.some(
      (segment) => PACKAGE_SKIP.has(segment) || segment.startsWith('.')
    )
  )
}
function manifestRecord(file, text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return null // arch-check itself refuses an invalid manifest
  }
  if (!isRecord(data)) return null
  return {
    file,
    dir: file.slice(0, -'/package.json'.length),
    name: data.name ?? null,
    runtime: data.contextWindow?.runtime ?? null,
    contextWindow: data.contextWindow ?? null,
    exports: data.exports ?? null,
  }
}
/** The workspace manifests of the tree, as arch-check reads them. */
export function treeManifests(root) {
  const found = []
  const visit = (directory, depth) => {
    if (depth > 3) return
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    if (
      entries.some((entry) => entry.isFile() && entry.name === 'package.json')
    ) {
      const file = toPosix(
        path.relative(root, path.join(directory, 'package.json'))
      )
      const record =
        isManifestPath(file) &&
        manifestRecord(file, fs.readFileSync(path.join(root, file), 'utf8'))
      if (record) found.push(record)
    }
    for (const entry of entries)
      if (
        entry.isDirectory() &&
        !PACKAGE_SKIP.has(entry.name) &&
        !entry.name.startsWith('.')
      )
        visit(path.join(directory, entry.name), depth + 1)
  }
  for (const top of ['apps', 'packages']) visit(path.join(root, top), 1)
  return found
}
/** The same manifests at the base commit. */
function baseManifests(root, commit) {
  const listing = git(root, [
    'ls-tree',
    '-r',
    '-z',
    '--name-only',
    '--full-tree',
    commit,
    '--',
    'apps',
    'packages',
  ])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
  return listing
    .filter(isManifestPath)
    .map((file) => manifestRecord(file, showAtCommit(root, commit, file) ?? ''))
    .filter(Boolean)
}
/** exports as arch-runtime reads them: a string, a list or a conditional object is the "." entry point. */
const exportsOf = (value) =>
  value === null || value === undefined
    ? {}
    : typeof value === 'string' ||
        Array.isArray(value) ||
        !isRecord(value) ||
        !Object.keys(value).some((key) => key.startsWith('.'))
      ? { '.': value }
      : value
const withinDirectory = (child, ancestor) =>
  child === ancestor || child.startsWith(`${ancestor}/`)

/**
 * Declared narrowing of the workspace manifests the gates read: a package server-only at the base (its
 * contextWindow.runtime, or serverOnlyPackages by name) stays server-only, and so does every package inside it or
 * with its name; the rest of contextWindow stays equal; an existing package, or one created inside it, gains no
 * entry point. Approved narrowing goes to `approved`.
 */
export function packageNarrowing(
  basePackages,
  treePackages,
  baseServerNames = [],
  treeServerNames = [],
  approvals = [],
  approved = [],
  movedInto = null
) {
  const problems = []
  const narrowing = (label, entry, verb, problem) => {
    const approval = approvalFor(approvals, label, entry)
    if (approval) approved.push({ label, entry, verb, reason: approval.reason })
    else problems.push(problem)
  }
  const serverAtBase = basePackages.filter(
    (pkg) =>
      pkg.runtime === 'server' ||
      (pkg.name !== null && baseServerNames.includes(pkg.name))
  )
  const serverInTree = (pkg) =>
    pkg.runtime === 'server' ||
    (pkg.name !== null && treeServerNames.includes(pkg.name))
  const withoutRuntime = (value) =>
    canonical(
      isRecord(value)
        ? Object.fromEntries(
            Object.entries(value).filter(([key]) => key !== 'runtime')
          )
        : (value ?? {})
    )
  for (const pkg of treePackages) {
    if (
      serverAtBase.some(
        (server) =>
          withinDirectory(pkg.dir, server.dir) ||
          (pkg.name !== null && server.name === pkg.name)
      ) &&
      !serverInTree(pkg)
    )
      narrowing(
        'package.serverOnly',
        pkg.dir,
        'drops',
        `${pkg.file}: ${pkg.name} (${pkg.dir}) is no longer server-only, as it is at the base ${WIDEN}`
      )
    const before = basePackages.find((candidate) => candidate.dir === pkg.dir)
    if (
      before &&
      withoutRuntime(before.contextWindow) !== withoutRuntime(pkg.contextWindow)
    )
      narrowing(
        'package.contextWindow',
        pkg.dir,
        'changes',
        `${pkg.file}: ${pkg.name} contextWindow differs from the base (${JSON.stringify(before.contextWindow)} -> ${JSON.stringify(pkg.contextWindow)}); the guard cannot tell it does not narrow the gates`
      )
    // A new package created inside an existing one takes over part of its files, entry points included.
    const inside =
      before ??
      basePackages.find((candidate) => withinDirectory(pkg.dir, candidate.dir))
    if (!inside) continue
    const baseExports = before ? exportsOf(before.exports) : {}
    for (const [key, target] of Object.entries(exportsOf(pkg.exports))) {
      if (
        Object.hasOwn(baseExports, key) &&
        canonical(baseExports[key]) === canonical(target)
      )
        continue
      narrowing(
        'package.exports',
        `${pkg.name}#${key}`,
        'gains',
        `${pkg.file}: ${pkg.name} exports gain "${key}" (${JSON.stringify(target)}), an entry point the base does not have ${WIDEN}`
      )
    }
  }
  // A new package holding code of a server package (moved, renamed or copied: git diff -M) stays server-only.
  const created = treePackages.filter(
    (pkg) =>
      !basePackages.some((candidate) => candidate.dir === pkg.dir) &&
      !serverInTree(pkg)
  )
  for (const server of serverAtBase) {
    if (!created.length || typeof movedInto !== 'function') continue
    const holders = movedInto(server, created)
    for (const pkg of created.filter((candidate) => holders.has(candidate.dir)))
      narrowing(
        'package.serverOnly',
        pkg.dir,
        'drops',
        `${pkg.file}: ${pkg.name} (${pkg.dir}) holds code moved from the server package ${server.name} (${server.dir}) and is not server-only ${WIDEN}`
      )
  }
  return problems
}

/**
 * The directories of `candidates` holding a file git detects (git diff -M) as moved from `server.dir` at the base:
 * both sides written to a temporary directory outside the repository.
 */
export function movedFromBase(root, commit, server, candidates) {
  const code = (file) => TREE_EXTENSIONS.test(file)
  const listing = git(root, [
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    commit,
    '--',
    `${server.dir}/`,
  ])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
  const before = listing
    .map((line) => ({
      mode: line.slice(0, line.indexOf(' ')),
      file: line.slice(line.indexOf('\t') + 1),
    }))
    .filter((entry) => entry.mode !== '120000' && code(entry.file))
    .map((entry) => entry.file)
  const after = []
  const walk = (directory) => {
    for (const entry of fs.readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = `${directory}/${entry.name}`
      if (
        entry.isDirectory() &&
        !PACKAGE_SKIP.has(entry.name) &&
        !entry.name.startsWith('.')
      )
        walk(file)
      else if (entry.isFile() && code(file)) after.push(file)
    }
  }
  for (const pkg of candidates) walk(pkg.dir)
  if (!before.length || !after.length) return new Set()
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-moved-'))
  try {
    for (const file of before) {
      const target = path.join(directory, 'a', ...file.split('/'))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, blobAtCommit(root, commit, file))
    }
    for (const file of after) {
      const target = path.join(directory, 'b', ...file.split('/'))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, fs.readFileSync(path.join(root, file)))
    }
    const result = spawnSync(
      'git',
      [
        '-c',
        'core.autocrlf=false',
        '-c',
        'core.safecrlf=false',
        'diff',
        '--no-index',
        '--find-renames',
        '--name-status',
        '-z',
        '--',
        'a',
        'b',
      ],
      { cwd: directory, encoding: 'utf8', maxBuffer: 1 << 28 }
    )
    if (result.status !== 0 && result.status !== 1)
      throw new Error(`git diff --no-index failed: ${result.stderr}`)
    const holders = new Set()
    const fields = result.stdout.split('\0')
    for (let index = 0; index < fields.length; index += 1) {
      if (!fields[index].startsWith('R')) continue
      const moved = fields[index + 2].slice(2)
      for (const pkg of candidates)
        if (withinDirectory(moved, pkg.dir)) holders.add(pkg.dir)
      index += 2
    }
    return holders
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * The base arch.config.json with the approved narrowing applied (gained exemptions added, dropped scope entries
 * removed): measured against it, the change only fails what nobody approved.
 */
export function approvedBaseText(baseText, baseConfigs, approved) {
  const settings = approved.filter(({ label }) => {
    const [name, key] = label.split('.')
    return !!CONFIG_POLICY[name]?.[key]
  })
  if (!settings.length) return baseText
  const raw = baseText === null ? {} : JSON.parse(baseText)
  for (const { label, entry, verb } of settings) {
    const [name, key] = label.split('.')
    const holder =
      name === 'arch'
        ? raw
        : (raw.tokens = isRecord(raw.tokens) ? raw.tokens : {})
    const effective = effectiveSettings(name, baseConfigs[name])[key]
    const current = Array.isArray(holder[key])
      ? holder[key]
      : Array.isArray(effective)
        ? [...effective]
        : []
    holder[key] =
      verb === 'drops'
        ? current.filter((item) => canonical(item) !== canonical(entry))
        : [...current, entry]
  }
  return JSON.stringify(raw)
}

/**
 * Raises tree entries only for new coverage: for each pair the base code measures above the base allowance
 * (delta = measured - allowance), the entry becomes min(current, tree + delta), never lower than it was.
 */
export function adoptCoverage(allowance, tree, coverage, current) {
  const next = clone(tree)
  const adopted = []
  for (const [file, rules] of Object.entries(coverage)) {
    for (const [rule, measured] of Object.entries(rules)) {
      const delta = measured - (allowance[file]?.[rule] ?? 0)
      if (delta <= 0) continue
      const before = next[file]?.[rule] ?? 0
      const target = Math.max(
        before,
        Math.min(current[file]?.[rule] ?? 0, before + delta)
      )
      if (target === before) continue
      next[file] ??= {}
      next[file][rule] = target
      adopted.push({ file, rule, from: before, to: target, measured })
    }
  }
  return { files: next, adopted }
}

/**
 * Pure core: compares every baseline with its base version.
 * - `baselines`: { name, file (tree configuration), baseFile? (base configuration, defaults to file), baseText,
 *   treeText, treeErrors, configChanged? };
 * - `measureBase()` runs the current tools on the base code; called only when some entry rose (it is expensive);
 * - `verifyTransfer(transfer)` returns why a transfer is not a proven rename (null when it is);
 * - `measureConfigs()` checks the tree code with the base and with the tree configuration ({ base, tree } per
 *   baseline, each { all, failing } findings per file and rule); called only for a baseline whose configuration
 *   changed.
 * - `measureHidden()` returns, per baseline with zero-tolerance rules, the findings its configuration hides
 *   (hiddenZeroTolerance, or { error }); called on every run.
 */
export function guardBaselines({
  baselines,
  transfers,
  measureBase,
  verifyTransfer = null,
  measureConfigs = null,
  measureHidden = null,
}) {
  const results = []
  let coverage = null
  let configured = null
  let hiddenFindings = null
  const measured = () => (coverage ??= measureBase())
  const configCounts = () => (configured ??= measureConfigs())
  const hiddenCounts = () => (hiddenFindings ??= measureHidden())
  for (const spec of baselines) {
    const baseFile = spec.baseFile ?? spec.file
    const result = {
      name: spec.name,
      file: spec.file,
      baseFile,
      status: 'compared',
      problems: [],
      covered: [],
      transfers: [],
      narrowed: [],
      totals: null,
    }
    results.push(result)
    // File/rule pairs already reported as narrowed by a configuration change (not repeated below).
    const reported = new Set()
    if (spec.configChanged) {
      if (typeof measureConfigs !== 'function')
        result.problems.push(
          `${CONFIG_FILE}: the ${spec.name} configuration differs from the base and cannot be measured`
        )
      else {
        // { all, failing } per configuration (plain counts are read as `all`); `base` has the approved narrowing
        // applied, `raw` (when approvals changed it) is the base configuration as it is.
        const measured = configCounts()[spec.name]
        // A configuration the tools refuse cannot hide anything, but the change cannot be measured either.
        if (measured.error)
          result.problems.push(
            `${CONFIG_FILE}: the ${spec.name} configuration of the change cannot be measured (${measured.error})`
          )
        const { base, tree, raw } = measured.error
          ? { base: null, tree: null, raw: null }
          : measured
        const all = (findings) =>
          findings && 'all' in findings ? findings.all : findings
        result.narrowed = narrowedFiles(all(base), all(tree))
        for (const entry of result.narrowed)
          result.problems.push(
            `${CONFIG_FILE}: the ${spec.name} configuration of the change counts ${entry.file} ${entry.tree}, the base configuration counts ${entry.base} in the same code (a change may widen what the ratchet counts, never narrow it)`
          )
        const failures = narrowedFailures(base?.failing, tree?.failing)
        // No approval covers a zero-tolerance rule.
        const zero = new Set(spec.zeroTolerance ?? [])
        const unapprovable = raw
          ? narrowedFailures(
              Object.fromEntries(
                Object.entries(raw.failing ?? {}).map(([file, rules]) => [
                  file,
                  Object.fromEntries(
                    Object.entries(rules).filter(([rule]) => zero.has(rule))
                  ),
                ])
              ),
              tree?.failing
            )
          : []
        for (const entry of unapprovable)
          if (
            !failures.some(
              (known) => known.file === entry.file && known.rule === entry.rule
            )
          )
            failures.push(entry)
        for (const entry of failures) {
          reported.add(`${entry.file}\0${entry.rule}`)
          result.problems.push(
            `${CONFIG_FILE}: the ${spec.name} configuration of the change fails ${entry.file} ${entry.rule} ${entry.tree} time(s), the base configuration ${entry.base} in the same code ${WIDEN}`
          )
        }
      }
    }
    // Zero tolerance whatever the configuration exempts, on every run (an approval at the base included).
    if (spec.zeroTolerance?.length && typeof measureHidden === 'function') {
      const hidden = hiddenCounts()[spec.name]
      if (hidden?.error)
        result.problems.push(
          `${CONFIG_FILE}: the zero-tolerance rules of ${spec.name} cannot be measured without the exemptions of the configuration (${hidden.error})`
        )
      else
        for (const entry of hidden ?? []) {
          if (reported.has(`${entry.file}\0${entry.rule}`)) continue
          result.problems.push(
            `${CONFIG_FILE}: ${entry.file} has ${entry.rule} ${entry.base - entry.tree} time(s) that the ${spec.name} configuration does not check (ignoreFiles, ignoreDirs or scope); a zero-tolerance rule is checked whatever the configuration or an approval exempts`
          )
        }
    }
    if (spec.baseText === null) {
      result.status = 'introduced'
      if (spec.treeText === null) result.status = 'absent'
      else
        result.problems.push(
          ...spec.treeErrors.map((error) => `${spec.file}: ${error}`)
        )
      continue
    }
    if (spec.treeText === null) {
      result.problems.push(
        baseFile === spec.file
          ? `${spec.file} exists at the base but was removed`
          : `${baseFile} exists at the base but the baseline the change configures (${spec.file}) does not`
      )
      continue
    }
    const base = JSON.parse(spec.baseText)
    let tree
    try {
      tree = JSON.parse(spec.treeText)
    } catch (error) {
      result.problems.push(`${spec.file} is not valid JSON: ${error.message}`)
      continue
    }
    result.problems.push(
      ...spec.treeErrors.map((error) => `${spec.file}: ${error}`)
    )
    for (const rule of Array.isArray(base.rules) ? base.rules : []) {
      if (!(tree.rules ?? []).includes(rule))
        result.problems.push(
          `${spec.file}: rule ${rule} is ratcheted at the base but missing from "rules" in the tree`
        )
    }
    const checked = checkTransfers(
      base.files,
      transfers,
      spec.name,
      verifyTransfer
    )
    for (const entry of checked.rejected)
      result.problems.push(
        `${TRANSFERS_FILE}: transfer ${entry.from} -> ${entry.to} rejected: ${entry.problem}`
      )
    const { files: allowance, applied } = applyTransfers(
      base.files,
      checked.accepted,
      spec.name
    )
    result.transfers = [...applied, ...checked.rejected, ...checked.stale]
    const treeFiles = tree.files ?? {}
    let comparison = compareBaselines(allowance, treeFiles)
    if (comparison.increases.length) {
      const { files: coverageFiles } = applyTransfers(
        measured()[spec.name],
        checked.accepted,
        spec.name
      )
      comparison = compareBaselines(allowance, treeFiles, coverageFiles)
    }
    result.covered = comparison.covered
    for (const entry of comparison.increases) {
      const detail =
        entry.measured === null
          ? ''
          : `; the base code measures ${entry.measured} with the current rules`
      result.problems.push(
        `${spec.file}: ${entry.newPair ? 'new entry' : 'increase'} ${entry.file} ${entry.rule}: base ${entry.base}, tree ${entry.tree}${detail}`
      )
    }
    result.totals = { base: sum(allowance), tree: sum(treeFiles) }
  }
  return {
    results,
    ok: results.every((result) => result.problems.length === 0),
  }
}

// --- git plumbing (read-only) ---

const git = (root, args, options = {}) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 1 << 30, ...options })

function verifyCommit(root, ref) {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
    { cwd: root, encoding: 'utf8' }
  )
  return result.status === 0 ? result.stdout.trim() : null
}

/** Base commit: explicit ref, RATCHET_BASE_REF, origin/main or HEAD~1; then its merge base with HEAD. */
export function resolveBase(root, explicit) {
  const candidates = explicit
    ? [explicit]
    : process.env.RATCHET_BASE_REF
      ? [process.env.RATCHET_BASE_REF]
      : ['origin/main', 'HEAD~1']
  for (const ref of candidates) {
    const commit = verifyCommit(root, ref)
    if (!commit) continue
    const mergeBase = spawnSync('git', ['merge-base', commit, 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    })
    return {
      ref,
      commit: mergeBase.status === 0 ? mergeBase.stdout.trim() : commit,
    }
  }
  throw new Error(
    `cannot resolve a base commit (${candidates.join(', ')}); pass --base <ref> or set RATCHET_BASE_REF`
  )
}

function blobAtCommit(root, commit, file) {
  const result = spawnSync('git', ['show', `${commit}:${file}`], {
    cwd: root,
    maxBuffer: 1 << 28,
  })
  return result.status === 0 ? result.stdout : null
}

function showAtCommit(root, commit, file) {
  const blob = blobAtCommit(root, commit, file)
  return blob === null ? null : blob.toString('utf8')
}

function existsAtCommit(root, commit, file) {
  return (
    spawnSync('git', ['cat-file', '-e', `${commit}:${file}`], { cwd: root })
      .status === 0
  )
}

/** Writes the base commit's code, manifests and styles (no symlinks) into `directory`. */
export function extractCommit(root, commit, directory) {
  const listing = git(root, ['ls-tree', '-r', '-z', '--full-tree', commit])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
  const blobs = []
  for (const line of listing) {
    const tab = line.indexOf('\t')
    const [mode, type, sha] = line.slice(0, tab).split(' ')
    const file = line.slice(tab + 1)
    if (type === 'blob' && mode !== '120000' && TREE_EXTENSIONS.test(file))
      blobs.push({ sha, file })
  }
  const output = git(root, ['cat-file', '--batch'], {
    input: blobs.map((blob) => blob.sha).join('\n') + '\n',
  })
  let offset = 0
  for (const blob of blobs) {
    const newline = output.indexOf(10, offset)
    const [, kind, size] = output
      .subarray(offset, newline)
      .toString('utf8')
      .split(' ')
    if (kind !== 'blob')
      throw new Error(`git cat-file could not read ${blob.file}`)
    const start = newline + 1
    const end = start + Number(size)
    const target = path.join(directory, ...blob.file.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, output.subarray(start, end))
    offset = end + 1
  }
  return blobs.length
}

/** Runs the current tools on an extraction of `commit`; the temporary directory is removed afterwards. */
function measureCommit(root, commit, specs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-guard-'))
  try {
    extractCommit(root, commit, directory)
    return Object.fromEntries(
      specs.map((spec) => [spec.name, spec.count(directory)])
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

const readText = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
/** A repository-relative POSIX path that stays inside the repository. */
const safeRelative = (file) =>
  typeof file === 'string' &&
  !path.isAbsolute(file) &&
  !/^[A-Za-z]:/.test(file) &&
  !file.split(/[\\/]/).some((segment) => segment === '..' || segment === '')

/**
 * Whether git's rename detection (git diff -M, default similarity) pairs base:`from` with the tree's `to`.
 * Only this pair is compared, in a temporary directory outside the repository (`git diff --no-index`).
 */
export function detectsRename(fromBlob, toBlob, from, to) {
  return detectsRenames([{ fromBlob, toBlob, from, to }])[0]
}

/** `detectsRename` for several pairs in one `git diff --no-index` (a moved directory); one boolean per pair. */
export function detectsRenames(pairs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-rename-'))
  try {
    for (const { fromBlob, toBlob, from, to } of pairs) {
      const before = path.join(directory, 'a', ...from.split('/'))
      const after = path.join(directory, 'b', ...to.split('/'))
      fs.mkdirSync(path.dirname(before), { recursive: true })
      fs.mkdirSync(path.dirname(after), { recursive: true })
      fs.writeFileSync(before, fromBlob)
      fs.writeFileSync(after, toBlob)
    }
    const result = spawnSync(
      'git',
      [
        '-c',
        'core.autocrlf=false',
        '-c',
        'core.safecrlf=false',
        'diff',
        '--no-index',
        '--find-renames',
        '--name-status',
        '-z',
        '--',
        'a',
        'b',
      ],
      { cwd: directory, encoding: 'utf8', maxBuffer: 1 << 28 }
    )
    if (result.status !== 0 && result.status !== 1)
      throw new Error(`git diff --no-index failed: ${result.stderr}`)
    const renamed = new Set()
    const fields = result.stdout.split('\0')
    for (let index = 0; index < fields.length; index += 1) {
      if (!fields[index].startsWith('R')) continue
      renamed.add(`${fields[index + 1]}\0${fields[index + 2]}`)
      index += 2
    }
    return pairs.map(({ from, to }) => renamed.has(`a/${from}\0b/${to}`))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

/** A file, or a directory with a file somewhere below it (git has no empty directories); links are not followed. */
function holdsFiles(absolute) {
  let stat
  try {
    stat = fs.lstatSync(absolute)
  } catch {
    return false
  }
  if (stat.isFile()) return true
  if (!stat.isDirectory()) return false
  return fs
    .readdirSync(absolute)
    .some((name) => holdsFiles(path.join(absolute, name)))
}

/**
 * Why a configuration transfer is not a proven move of base:`from` (a file, or a directory whose every file
 * moved to the same path under `to`) into the tree's `to`; null when it is.
 */
export function verifyConfigTransferInGit(root, commit, transfer) {
  const { from, to } = transfer
  if (!safeRelative(from) || !safeRelative(to))
    return 'paths must be relative to the repository root'
  if (holdsFiles(path.join(root, from)))
    return `${from} still exists in the tree; a transfer only follows a file or directory that was moved`
  if (existsAtCommit(root, commit, to))
    return `${to} already exists at the base; a path is never moved onto an existing one`
  if (!holdsFiles(path.join(root, to)))
    return `${to} does not exist in the tree`
  const kind = spawnSync('git', ['cat-file', '-t', `${commit}:${from}`], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim()
  let files
  if (kind === 'blob') files = [{ from, to }]
  else if (kind === 'tree') {
    const listing = git(root, [
      'ls-tree',
      '-r',
      '-z',
      '--full-tree',
      commit,
      '--',
      `${from}/`,
    ])
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
    files = listing
      .map((line) => ({
        mode: line.slice(0, line.indexOf(' ')),
        file: line.slice(line.indexOf('\t') + 1),
      }))
      .filter((entry) => entry.mode !== '120000')
      .map((entry) => ({
        from: entry.file,
        to: `${to}${entry.file.slice(from.length)}`,
      }))
  } else return `${from} is not a file or directory at the base`
  for (const pair of files) {
    const target = path.join(root, pair.to)
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      return `${pair.to} does not exist in the tree (every file of ${from} moves to the same path under ${to})`
  }
  const detected = detectsRenames(
    files.map((pair) => ({
      ...pair,
      fromBlob: blobAtCommit(root, commit, pair.from),
      toBlob: fs.readFileSync(path.join(root, pair.to)),
    }))
  )
  const missed = files.find((_pair, index) => !detected[index])
  return missed
    ? `git does not detect ${missed.from} -> ${missed.to} as a rename (git diff -M)`
    : null
}

/** Why a transfer is not a proven rename of `from` (at the base) into `to` (in the tree); null when it is. */
export function verifyTransferInGit(root, commit, transfer) {
  const { from, to } = transfer
  if (!safeRelative(from) || !safeRelative(to))
    return 'paths must be relative to the repository root'
  if (fs.existsSync(path.join(root, from)))
    return `${from} still exists in the tree; a transfer only follows a file that was moved or renamed`
  if (existsAtCommit(root, commit, to))
    return `${to} already exists at the base; debt is never moved into an existing file`
  if (
    !fs.existsSync(path.join(root, to)) ||
    !fs.statSync(path.join(root, to)).isFile()
  )
    return `${to} does not exist in the tree`
  const fromBlob = blobAtCommit(root, commit, from)
  if (fromBlob === null) return `${from} is not a file at the base`
  if (!detectsRename(fromBlob, fs.readFileSync(path.join(root, to)), from, to))
    return `git does not detect ${from} -> ${to} as a rename (git diff -M)`
  return null
}

/**
 * The baselines at the base (found through the base arch.config.json) and in the tree (found through the tree's),
 * with whether the counting configuration changed.
 */
export function loadBaselines(
  root,
  commit,
  { approvedText, configured = true } = {}
) {
  const baseText = showAtCommit(root, commit, CONFIG_FILE)
  const baseConfigs = configsFromText(baseText)
  const treeConfigs = loadConfigs(root)
  const baseSpecs = baselineSpecs(root, baseConfigs)
  const approvedSpecs =
    approvedText !== undefined && approvedText !== baseText
      ? baselineSpecs(root, configsFromText(approvedText))
      : null
  return baselineSpecs(root, treeConfigs).map((spec, index) => {
    const absolute = path.join(root, spec.file)
    const treeText = readText(absolute)
    const baseSpec = baseSpecs[index]
    // The base configuration decides; the tree path and the historical location only matter when the base has no
    // file there (a default path changed by the tools of the change must not turn the base baseline into "absent").
    const baseFile =
      [baseSpec.file, spec.file, KNOWN_BASELINES[spec.name]].find(
        (file) => file && existsAtCommit(root, commit, file)
      ) ?? baseSpec.file
    return {
      ...spec,
      baseFile,
      baseText: showAtCommit(root, commit, baseFile),
      treeText,
      treeErrors: treeText === null ? [] : spec.validate(absolute),
      // A base that configures no gate has nothing to narrow (the change introduces the configuration).
      configChanged:
        configured && canonical(baseSpec.config) !== canonical(spec.config),
      countWithBase: baseSpec.count,
      findingsWithBase: baseSpec.findings,
      findingsWithApproved: approvedSpecs
        ? approvedSpecs[index].findings
        : null,
    }
  })
}

function writeTransfer(root, transfer) {
  const file = path.join(root, TRANSFERS_FILE)
  const data = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { $comment: '', transfers: [] }
  data.$comment =
    'Renomeações registradas para tools/ratchet-guard.mjs: a contagem da base em `from` (limitada por `counts`) passa para `to` (o total não aumenta). Só vale quando `from` sumiu da árvore, `to` não existia na base e o git reconhece a renomeação (git diff -M). Gere com `node tools/ratchet-guard.mjs --rename <de> <para> --reason <motivo>`. Entradas cuja origem já não existe na base são ignoradas e podem ser removidas.'
  data.transfers = [...(data.transfers ?? []), transfer]
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}

/** Moves the tree entry of a renamed file in every baseline that has it and records the transfer. */
export function renameEntry(root, from, to, reason) {
  if (!reason || reason.trim().length < 8)
    throw new Error('--rename needs --reason with 8+ characters')
  if (fs.existsSync(path.join(root, from)))
    throw new Error(
      `${from} still exists; a transfer only follows a file that was moved or renamed`
    )
  if (!fs.existsSync(path.join(root, to)))
    throw new Error(`${to} does not exist`)
  const moved = []
  for (const spec of baselineSpecs(root)) {
    const absolute = path.join(root, spec.file)
    if (!fs.existsSync(absolute)) continue
    const data = JSON.parse(fs.readFileSync(absolute, 'utf8'))
    if (!data.files?.[from]) continue
    const { files } = applyTransfers(
      data.files,
      [{ baseline: spec.name, from, to }],
      spec.name
    )
    fs.writeFileSync(absolute, spec.serialize(files))
    const transfer = {
      baseline: spec.name,
      from,
      to,
      reason: reason.trim(),
      counts: data.files[from],
    }
    writeTransfer(root, transfer)
    moved.push(transfer)
  }
  if (!moved.length) throw new Error(`no baseline has an entry for ${from}`)
  return moved
}

function formatTotals(totals) {
  const rules = [
    ...new Set([...Object.keys(totals.base), ...Object.keys(totals.tree)]),
  ]
  return rules
    .map(
      (rule) => `${rule} ${totals.tree[rule] ?? 0}/${totals.base[rule] ?? 0}`
    )
    .join(', ')
}

/**
 * Runs the guard on the repository at `root`; returns the report lines and whether it passed.
 * @param {string} root
 * @param {{ baseRef?: string | null, adopt?: boolean }} [options]
 */
export function runGuard(root, { baseRef = null, adopt = false } = {}) {
  const lines = []
  const base = resolveBase(root, baseRef)
  lines.push(`ratchet guard: base ${base.ref} -> ${base.commit.slice(0, 12)}`)
  const transfersText = readText(path.join(root, TRANSFERS_FILE))
  const { transfers, problems: transferProblems } = readTransfers(
    transfersText,
    Object.keys(KNOWN_BASELINES)
  )
  // Declared narrowing of the settings and manifests, with the moved paths proven in git and the approvals the
  // change records.
  const { moved, problems: movedProblems } = readConfigTransfers(transfersText)
  const { approvals, problems: approvalProblems } = readApprovals(
    transfersText,
    showAtCommit(root, base.commit, TRANSFERS_FILE)
  )
  const baseConfigText = showAtCommit(root, base.commit, CONFIG_FILE)
  const configured =
    baseConfigText !== null ||
    [...Object.values(KNOWN_BASELINES), ...GATE_TOOLS].some((file) =>
      existsAtCommit(root, base.commit, file)
    )
  const approved = []
  let settingProblems = []
  let approvedText = baseConfigText
  if (configured) {
    const baseConfigs = configsFromText(baseConfigText)
    const treeConfigs = loadConfigs(root)
    const acceptedMoves = []
    for (const transfer of moved) {
      // Already applied at the base (the base configuration no longer names `from`): stale, ignored, covers nothing.
      if (!namesPath(baseConfigs, transfer)) {
        lines.push(
          `configuration transfer ${transfer.config} ${transfer.from} -> ${transfer.to} stale and ignored: the base configuration does not name ${transfer.from}`
        )
        continue
      }
      const problem = verifyConfigTransferInGit(root, base.commit, transfer)
      if (problem)
        movedProblems.push(
          `${TRANSFERS_FILE}: configuration transfer ${transfer.config} ${transfer.from} -> ${transfer.to} rejected: ${problem}`
        )
      else acceptedMoves.push(transfer)
    }
    const serverNames = (configs) => {
      const names = effectiveSettings('arch', configs.arch).serverOnlyPackages
      return (Array.isArray(names) ? names : []).filter(
        (name) => typeof name === 'string'
      )
    }
    settingProblems = [
      ...configNarrowing(
        baseConfigs,
        treeConfigs,
        acceptedMoves,
        approvals,
        approved
      ).map((problem) => `${CONFIG_FILE}: ${problem}`),
      ...packageNarrowing(
        baseManifests(root, base.commit),
        treeManifests(root),
        serverNames(baseConfigs),
        serverNames(treeConfigs),
        approvals,
        approved,
        (server, candidates) =>
          movedFromBase(root, base.commit, server, candidates)
      ),
    ]
    approvedText = approvedBaseText(baseConfigText, baseConfigs, approved)
  } else
    lines.push(
      `${CONFIG_FILE}: not at the base; the gate configuration is introduced by this change`
    )
  // The hygiene gate (pnpm hygiene) reads its baseline and knip configuration from the tree: both anchored here.
  const hygieneTexts = {
    baseConfigText: showAtCommit(root, base.commit, HYGIENE_CONFIG),
    treeConfigText: readText(path.join(root, HYGIENE_CONFIG)),
    baseBaselineText: showAtCommit(root, base.commit, HYGIENE_BASELINE),
    treeBaselineText: readText(path.join(root, HYGIENE_BASELINE)),
  }
  const hygieneAtBase =
    hygieneTexts.baseConfigText !== null ||
    hygieneTexts.baseBaselineText !== null
  const hygieneInTree =
    hygieneTexts.treeConfigText !== null ||
    hygieneTexts.treeBaselineText !== null
  if (!hygieneAtBase && hygieneInTree)
    lines.push(
      `${HYGIENE_CONFIG}, ${HYGIENE_BASELINE}: the hygiene gate is new in this change (nothing at the base to compare)`
    )
  settingProblems.push(...hygieneNarrowing(hygieneTexts, approvals, approved))
  for (const entry of approved)
    lines.push(
      `approved ${entry.label} ${entry.verb} ${JSON.stringify(entry.entry)}: ${entry.reason}`
    )
  const specs = loadBaselines(root, base.commit, { approvedText, configured })
  let measurement = null
  const measureBase = () =>
    (measurement ??= measureCommit(root, base.commit, specs))
  const verifyTransfer = (transfer) =>
    verifyTransferInGit(root, base.commit, transfer)
  const measureConfigs = () =>
    Object.fromEntries(
      specs.map((spec) => {
        if (!spec.configChanged)
          return [
            spec.name,
            { base: { all: {}, failing: {} }, tree: { all: {}, failing: {} } },
          ]
        try {
          return [
            spec.name,
            spec.findingsWithApproved
              ? {
                  base: spec.findingsWithApproved(root),
                  tree: spec.findings(root),
                  raw: spec.findingsWithBase(root),
                }
              : {
                  base: spec.findingsWithBase(root),
                  tree: spec.findings(root),
                },
          ]
        } catch (error) {
          return [spec.name, { error: error.message }]
        }
      })
    )
  if (adopt) {
    const current = Object.fromEntries(
      specs.map((spec) => [spec.name, spec.count(root)])
    )
    const measuredBase = measureBase()
    for (const spec of specs) {
      if (spec.baseText === null || spec.treeText === null) continue
      const baseData = JSON.parse(spec.baseText)
      const treeData = JSON.parse(spec.treeText)
      const { accepted } = checkTransfers(
        baseData.files,
        transfers,
        spec.name,
        verifyTransfer
      )
      const allowance = applyTransfers(
        baseData.files,
        accepted,
        spec.name
      ).files
      const coverage = applyTransfers(
        measuredBase[spec.name],
        accepted,
        spec.name
      ).files
      const { files, adopted } = adoptCoverage(
        allowance,
        treeData.files ?? {},
        coverage,
        current[spec.name]
      )
      if (!adopted.length) {
        lines.push(`${spec.file}: no new coverage to adopt`)
        continue
      }
      fs.writeFileSync(path.join(root, spec.file), spec.serialize(files))
      const byRule = {}
      for (const entry of adopted)
        byRule[entry.rule] = (byRule[entry.rule] ?? 0) + entry.to - entry.from
      lines.push(
        `${spec.file}: adopted new coverage in ${adopted.length} entr${adopted.length === 1 ? 'y' : 'ies'} (${Object.entries(
          byRule
        )
          .map(([rule, count]) => `${rule} +${count}`)
          .join(', ')})`
      )
    }
    specs.splice(
      0,
      specs.length,
      ...loadBaselines(root, base.commit, { approvedText, configured })
    )
  }
  const measureHidden = () => {
    try {
      return {
        tokens: hiddenZeroTolerance(
          root,
          loadConfigs(root).tokens,
          configsFromText(baseConfigText).tokens
        ),
      }
    } catch (error) {
      return { tokens: { error: error.message } }
    }
  }
  const { results, ok } = guardBaselines({
    baselines: specs,
    transfers,
    measureBase,
    verifyTransfer,
    measureConfigs,
    measureHidden,
  })
  for (const problem of [
    ...transferProblems,
    ...movedProblems,
    ...approvalProblems,
    ...settingProblems,
  ])
    lines.push(`RATCHET-GUARD ${problem}`)
  for (const result of results) {
    if (result.status !== 'compared') {
      lines.push(
        `${result.file}: ${result.status === 'introduced' ? 'not at the base; introduced by this change' : 'absent at the base and in the tree'}`
      )
    } else {
      lines.push(
        result.totals
          ? `${result.file}: tree/base ${formatTotals(result.totals)}`
          : `${result.file}: not compared`
      )
      if (result.baseFile !== result.file)
        lines.push(
          `  baseline moved by the change: compared with ${result.baseFile} at the base`
        )
      for (const transfer of result.transfers)
        lines.push(
          `  transfer ${transfer.status} ${transfer.from} -> ${transfer.to}`
        )
      if (result.covered.length) {
        const byRule = {}
        for (const entry of result.covered)
          byRule[entry.rule] =
            (byRule[entry.rule] ?? 0) + entry.tree - entry.base
        lines.push(
          `  new coverage measured on the base code: ${result.covered.length} entr${result.covered.length === 1 ? 'y' : 'ies'} (${Object.entries(
            byRule
          )
            .map(([rule, count]) => `${rule} +${count}`)
            .join(', ')})`
        )
      }
    }
    for (const problem of result.problems)
      lines.push(`RATCHET-GUARD ${problem}`)
  }
  const passed =
    ok &&
    transferProblems.length === 0 &&
    movedProblems.length === 0 &&
    approvalProblems.length === 0 &&
    settingProblems.length === 0
  lines.push(
    passed
      ? 'ratchet guard passed'
      : '\nratchet guard failed: the change raises or hides debt beyond the base (fix the code or the configuration, or record a rename with --rename)'
  )
  return { ok: passed, lines, results }
}

function main() {
  const root = path.resolve(import.meta.dirname, '..')
  const args = process.argv.slice(2)
  let baseRef = null
  let adopt = false
  let rename = null
  let reason = null
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--') continue
    else if (args[index] === '--base') baseRef = args[++index]
    else if (args[index] === '--adopt-coverage') adopt = true
    else if (args[index] === '--rename') rename = [args[++index], args[++index]]
    else if (args[index] === '--reason') reason = args[++index]
    else {
      process.stderr.write(`unknown argument ${args[index]}\n`)
      process.exit(64)
    }
  }
  if (rename) {
    try {
      for (const transfer of renameEntry(
        root,
        ...rename.map((file) => toPosix(file)),
        reason
      ))
        process.stdout.write(
          `transferred ${transfer.baseline} ${transfer.from} -> ${transfer.to} (${JSON.stringify(transfer.counts)})\n`
        )
    } catch (error) {
      process.stderr.write(`${error.message}\n`)
      process.exit(1)
    }
    return
  }
  const { ok, lines } = runGuard(root, { baseRef, adopt })
  for (const line of lines) process.stdout.write(`${line}\n`)
  process.exitCode = ok ? 0 : 1
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
const self = fileURLToPath(import.meta.url)
if (
  process.platform === 'win32'
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self
)
  main()
