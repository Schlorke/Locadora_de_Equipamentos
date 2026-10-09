import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { renameEntry, runGuard } from '../../tools/ratchet-guard.mjs'

/**
 * tools/ratchet-guard.mjs end to end: each case is a throwaway git repository with a base commit and a change
 * commit, and the guard runs on it exactly as in CI (base ref -> merge base, baselines read with git show).
 * The attacks come from the adversarial review: a change must not decide where its own allowance is read
 * (baseline path, counting scope) nor move allowance to a file that is not a proven rename.
 */
const temporaryBase = path.resolve(os.tmpdir())
const PREFIX = 'locadora-ratchet-guard-'
const roots: string[] = []
const HOME = 'packages/frontend/src/pages/home/ui/Home.tsx'
const OTHER = 'packages/frontend/src/pages/home/ui/Other.tsx'
const MOVED = 'packages/frontend/src/pages/catalog/ui/Home.tsx'

/** A universal component with `count` intrinsic DOM elements (UNIVERSAL-DOM-JSX `count`). */
const markup = (count: number, name = 'Home') =>
  `export const ${name} = () => (\n  <section>\n${Array.from({ length: count - 1 }, (_, index) => `    <p>item ${index}</p>\n`).join('')}  </section>\n);\n`
const baseline = (files: Record<string, Record<string, number>>) => ({
  total: Object.values(files).reduce((sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0), 0),
  files,
})

function repository() {
  const root = fs.mkdtempSync(path.join(temporaryBase, PREFIX))
  roots.push(root)
  // Never let git discover a repository above the fixture (the temporary folder may live inside one).
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(root) }
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env, encoding: 'utf8' }).trim()
  const write = (file: string, body: string | object) => {
    const target = path.resolve(root, file)
    if (!target.startsWith(root + path.sep)) throw new Error('Fixture escaped temporary root')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  }
  const remove = (file: string) => fs.rmSync(path.join(root, file))
  write('package.json', { name: 'fixture', dependencies: { react: '*', 'react-native': '*' } })
  write('tsconfig.json', { compilerOptions: { paths: { '@/*': ['./*'] } } })
  write('packages/frontend/package.json', { name: '@fixture/frontend', exports: { './app': './src/app/index.ts', './pages/*': './src/pages/*/index.ts' } })
  write('packages/frontend/tsconfig.json', { compilerOptions: {} })
  write('packages/frontend/src/app/index.ts', 'export const app = 1;')
  write('packages/frontend/src/pages/home/index.ts', 'export { Home } from "./ui/Home";')
  write('packages/ui/package.json', { name: '@fixture/ui', exports: { '.': { 'react-native': './src/index.native.ts', default: './src/index.web.ts' } } })
  write('packages/ui/src/index.native.ts', 'export const native = true;')
  write('packages/ui/src/index.web.ts', 'export const web = true;')
  write('packages/design-tokens/package.json', { name: '@fixture/design-tokens', exports: { '.': './src/index.ts' } })
  write('packages/design-tokens/src/index.ts', 'export const space = 8;')
  write('apps/clients/web/package.json', { name: '@fixture/web' })
  write('apps/clients/mobile/package.json', { name: '@fixture/mobile' })
  write('arch.config.json', { tokens: { scope: [] } })
  write(HOME, markup(2))
  write('tools/arch-baseline.json', baseline({ [HOME]: { 'UNIVERSAL-DOM-JSX': 2 } }))
  git('init', '-q', '-b', 'main')
  if (path.resolve(git('rev-parse', '--show-toplevel')) !== path.resolve(root)) throw new Error('Fixture is not its own repository')
  const commit = (message: string) => {
    git('add', '-A')
    // Nothing changed (a case whose base is the fixture itself): the current commit is the base.
    if (git('status', '--porcelain')) git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const base = commit('base')
  const guard = () => runGuard(root, { baseRef: base })
  const problems = () => guard().lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))
  return { root, write, remove, commit, guard, problems }
}

// Each case builds a real git repository and runs the whole guard: up to 11.5 s
// in isolation (measured 2026-10-06), past the default 20 s under the load of the
// full pnpm test:unit run.
const REAL_GIT = { timeout: 60_000 }

afterEach(() => {
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root)
    if (path.dirname(resolved) !== temporaryBase || !path.basename(resolved).startsWith(PREFIX)) throw new Error('Unsafe fixture cleanup')
    fs.rmSync(resolved, { recursive: true, force: true })
  }
})

describe('ratchet guard: the base decides where the allowance is and what is counted (finding 10)', REAL_GIT, () => {
  it('compares a redirected baseline with the base file instead of treating it as introduced', () => {
    const repo = repository()
    repo.write('arch.config.json', { tokens: { scope: [] }, ratchetBaseline: 'tools/arch-baseline.v2.json' })
    repo.write('tools/arch-baseline.v2.json', baseline({ [HOME]: { 'UNIVERSAL-DOM-JSX': 5 } }))
    repo.remove('tools/arch-baseline.json')
    repo.write(HOME, markup(5))
    repo.commit('attack: redirect the baseline')
    const report = repo.guard()
    expect(report.ok).toBe(false)
    expect(report.lines).toContain('  baseline moved by the change: compared with tools/arch-baseline.json at the base')
    expect(report.lines).toContain(`RATCHET-GUARD tools/arch-baseline.v2.json: increase ${HOME} UNIVERSAL-DOM-JSX: base 2, tree 5; the base code measures 2 with the current rules`)
    expect(report.lines.join('\n')).not.toContain('introduced by this change')
  })

  it('fails when the configured baseline is missing while the base has one, and accepts a move that keeps the counts', () => {
    const missing = repository()
    missing.write('arch.config.json', { tokens: { scope: [] }, ratchetBaseline: 'tools/nowhere.json' })
    missing.commit('attack: point the baseline to nothing')
    expect(missing.problems()).toEqual(['RATCHET-GUARD tools/arch-baseline.json exists at the base but the baseline the change configures (tools/nowhere.json) does not'])
    const moved = repository()
    moved.write('arch.config.json', { tokens: { scope: [] }, ratchetBaseline: 'tools/arch-baseline.v2.json' })
    moved.write('tools/arch-baseline.v2.json', baseline({ [HOME]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    moved.remove('tools/arch-baseline.json')
    moved.commit('move the baseline file')
    expect(moved.guard().ok).toBe(true)
  })

  it('fails a configuration that stops counting debt, new or existing, in the same code', () => {
    const narrowed = { tokens: { scope: [] }, universalSourceRoots: ['packages/frontend/src/app'] }
    const hidden = repository()
    hidden.write('arch.config.json', narrowed)
    hidden.write(HOME, markup(6))
    hidden.write('tools/arch-baseline.json', baseline({}))
    hidden.commit('attack: hide new debt')
    // The narrowed setting itself (finding 29) and the debt it hides in this code.
    const setting = 'RATCHET-GUARD arch.config.json: arch.universalSourceRoots no longer covers "packages/frontend/src", checked by the base configuration (a change may widen what the gates check, never narrow it)'
    expect(hidden.problems()).toEqual([
      setting,
      `RATCHET-GUARD arch.config.json: the arch configuration of the change counts ${HOME} 0, the base configuration counts 6 in the same code (a change may widen what the ratchet counts, never narrow it)`,
    ])
    const frozen = repository()
    frozen.write('arch.config.json', narrowed)
    frozen.write('tools/arch-baseline.json', baseline({}))
    frozen.commit('attack: stop counting existing debt')
    expect(frozen.problems()).toEqual([
      setting,
      `RATCHET-GUARD arch.config.json: the arch configuration of the change counts ${HOME} 0, the base configuration counts 2 in the same code (a change may widen what the ratchet counts, never narrow it)`,
    ])
  })

  it('accepts a configuration that counts more, adopting only the debt the base code already had', () => {
    const repo = repository()
    repo.write('arch.config.json', { tokens: { scope: [] }, universalSourceRoots: ['packages/frontend/src/app'] })
    repo.write('tools/arch-baseline.json', baseline({}))
    const base = repo.commit('narrow base configuration')
    repo.write('arch.config.json', { tokens: { scope: [] } })
    repo.write('tools/arch-baseline.json', baseline({ [HOME]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    repo.commit('widen: count the pages again')
    const report = runGuard(repo.root, { baseRef: base })
    expect(report.ok).toBe(true)
    expect(report.lines).toContain('  new coverage measured on the base code: 1 entry (UNIVERSAL-DOM-JSX +2)')
  })
})

describe('ratchet guard: a change never narrows what the gates check (findings 28 and 29)', REAL_GIT, () => {
  const DEFAULT_IGNORE = ['\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)__fixtures__/']
  const WIDEN = '(a change may widen what the gates check, never narrow it)'
  const PROMO = 'packages/ui/src/Promo.web.tsx'

  it('fails a file hidden by tokens.ignoreFiles even though its findings are zero-tolerance or absolute (finding 28)', () => {
    const repo = repository()
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'] } })
    const base = repo.commit('ui in the token scope')
    repo.write(PROMO, 'export const Promo = () => <p className="!mt-0" style={{ color: \'red\' }}>x</p>;\n')
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'], ignoreFiles: [...DEFAULT_IGNORE, 'Promo\\.web\\.tsx$'] } })
    repo.commit('attack: ignore the new file')
    const problems = runGuard(repo.root, { baseRef: base }).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))
    expect(problems).toContain(`RATCHET-GUARD arch.config.json: tokens.ignoreFiles gains "Promo\\\\.web\\\\.tsx$", an exemption the base does not have ${WIDEN}`)
    for (const rule of ['css-important', 'named-color'])
      expect(problems).toContain(`RATCHET-GUARD arch.config.json: the tokens configuration of the change fails ${PROMO} ${rule} 0 time(s), the base configuration 1 in the same code ${WIDEN}`)
  })

  it('fails a narrowed scope even where no debt exists today (finding 29)', () => {
    const narrowed: Array<[string, object, object, string]> = [
      [
        'universal roots',
        { tokens: { scope: [] } },
        { tokens: { scope: [] }, universalSourceRoots: ['packages/frontend/src/pages'] },
        `arch.universalSourceRoots no longer covers "packages/frontend/src", checked by the base configuration ${WIDEN}`,
      ],
      [
        'token scope',
        { tokens: { scope: ['packages/ui/src', 'packages/frontend/src'] } },
        { tokens: { scope: ['packages/ui/src'] } },
        `tokens.scope no longer covers "packages/frontend/src", checked by the base configuration ${WIDEN}`,
      ],
      [
        'legacy root',
        { tokens: { scope: [] }, legacyRoots: [{ path: 'app', runtime: 'web-host' }] },
        { tokens: { scope: [] } },
        `arch.legacyRoots no longer covers {"path":"app","runtime":"web-host"}, checked by the base configuration ${WIDEN}`,
      ],
      [
        'legacy root with another runtime',
        { tokens: { scope: [] }, legacyRoots: [{ path: 'app', runtime: 'web-host' }] },
        { tokens: { scope: [] }, legacyRoots: [{ path: 'app', runtime: 'types' }] },
        `arch.legacyRoots no longer covers {"path":"app","runtime":"web-host"}, checked by the base configuration ${WIDEN}`,
      ],
      [
        'non-runtime root',
        { tokens: { scope: [] } },
        { tokens: { scope: [] }, nonRuntimeRoots: [{ path: 'packages/frontend/src/widgets', reason: 'fora do runtime por enquanto' }] },
        `arch.nonRuntimeRoots gains {"path":"packages/frontend/src/widgets","reason":"fora do runtime por enquanto"}, an exemption the base does not have ${WIDEN}`,
      ],
      [
        'client entry point',
        { tokens: { scope: [] } },
        { tokens: { scope: [] }, clientEntrypoints: ['app', 'pages/*', 'widgets/*'] },
        `arch.clientEntrypoints gains "widgets/*", an exemption the base does not have ${WIDEN}`,
      ],
      [
        'token allow entry',
        { tokens: { scope: [] } },
        { tokens: { scope: [], allow: [{ file: PROMO, value: 'red', reason: 'cor da campanha' }] } },
        `tokens.allow gains {"file":"${PROMO}","value":"red","reason":"cor da campanha"}, an exemption the base does not have ${WIDEN}`,
      ],
      [
        'ignored directory name',
        { tokens: { scope: [] } },
        { tokens: { scope: [], ignoreDirs: ['node_modules', '.next', '.expo', 'dist', 'dist-export', 'build', 'coverage', 'android', 'ios', 'promo'] } },
        `tokens.ignoreDirs gains "promo", an exemption the base does not have ${WIDEN}`,
      ],
      [
        'canonical source inside the checked scope',
        { tokens: { scope: ['packages/ui/src'] } },
        { tokens: { scope: ['packages/ui/src'], canonical: ['packages/design-tokens/src', 'packages/ui/src/web'] } },
        `tokens.canonical gains "packages/ui/src/web", which overlaps tokens.scope "packages/ui/src" (only css-important applies to a canonical source) ${WIDEN}`,
      ],
      [
        'unknown setting',
        { tokens: { scope: [] } },
        { tokens: { scope: [] }, excludeFromChecks: ['packages/ui'] },
        'arch.excludeFromChecks differs from the base (undefined -> ["packages/ui"]); the guard cannot tell it does not narrow the gates',
      ],
    ]
    for (const [label, before, after, problem] of narrowed) {
      const repo = repository()
      repo.write('arch.config.json', before)
      const base = repo.commit(`base: ${label}`)
      repo.write('arch.config.json', after)
      repo.commit(`narrow: ${label}`)
      expect.soft(runGuard(repo.root, { baseRef: base }).lines.filter((line: string) => line.startsWith('RATCHET-GUARD ')), label).toEqual([`RATCHET-GUARD arch.config.json: ${problem}`])
    }
  })

  it('accepts a configuration that only widens: more scope, fewer exemptions', () => {
    const repo = repository()
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web'], ignoreFiles: [...DEFAULT_IGNORE, 'legacy\\.tsx$'] }, nonRuntimeRoots: [{ path: 'scripts', reason: 'scripts operacionais' }] })
    const base = repo.commit('narrow base')
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'], ignoreFiles: DEFAULT_IGNORE }, nonRuntimeRoots: [{ path: 'scripts/ops', reason: 'só os scripts operacionais' }], serverOnlyPackages: ['@fixture/server'] })
    repo.commit('widen')
    const report = runGuard(repo.root, { baseRef: base })
    expect(report.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('accepts a narrowed path only as a validated configuration transfer of a directory moved in git', () => {
    const from = 'packages/ui/src/promo'
    const to = 'packages/ui/src/oferta'
    const transfer = { config: 'tokens.scope', from, to, reason: 'pasta renomeada no design system' }
    const moved = (record: object[] | null, keepSource = false, rewritten = false) => {
      const repo = repository()
      repo.write(`${from}/Promo.web.tsx`, 'export const Promo = () => null;\n')
      repo.write(`${from}/index.ts`, "export { Promo } from './Promo.web';\n")
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web', from] } })
      const base = repo.commit('promo in the token scope')
      repo.write(`${to}/Promo.web.tsx`, rewritten ? 'export const Oferta = 1;\nexport const prazo = 2;\nexport const valor = 3;\n' : 'export const Promo = () => null;\n')
      repo.write(`${to}/index.ts`, "export { Promo } from './Promo.web';\n")
      if (!keepSource) {
        repo.remove(`${from}/Promo.web.tsx`)
        repo.remove(`${from}/index.ts`)
      }
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web', to] } })
      if (record) repo.write('tools/ratchet-transfers.json', { transfers: record })
      repo.commit('move promo')
      return runGuard(repo.root, { baseRef: base }).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))
    }
    expect(moved(null)).toEqual([`RATCHET-GUARD arch.config.json: tokens.scope no longer covers "${from}", checked by the base configuration ${WIDEN}`])
    expect(moved([transfer])).toEqual([])
    expect(moved([transfer], true)).toEqual([
      `RATCHET-GUARD tools/ratchet-transfers.json: configuration transfer tokens.scope ${from} -> ${to} rejected: ${from} still exists in the tree; a transfer only follows a file or directory that was moved`,
      `RATCHET-GUARD arch.config.json: tokens.scope no longer covers "${from}", checked by the base configuration ${WIDEN}`,
    ])
    // A "destination" git does not see as the same file is not a move.
    expect(moved([transfer], false, true)).toEqual([
      `RATCHET-GUARD tools/ratchet-transfers.json: configuration transfer tokens.scope ${from} -> ${to} rejected: git does not detect ${from}/Promo.web.tsx -> ${to}/Promo.web.tsx as a rename (git diff -M)`,
      `RATCHET-GUARD arch.config.json: tokens.scope no longer covers "${from}", checked by the base configuration ${WIDEN}`,
    ])
    expect(moved([{ ...transfer, config: 'tokens.ignoreFiles' }])).toEqual([
      'RATCHET-GUARD tools/ratchet-transfers.json transfers[0]: "config" must be a path setting (arch.universalSourceRoots, arch.legacyRoots, arch.nonRuntimeRoots, tokens.scope, tokens.legacyScope, tokens.canonical, tokens.allow)',
      `RATCHET-GUARD arch.config.json: tokens.scope no longer covers "${from}", checked by the base configuration ${WIDEN}`,
    ])
  })
})

describe('ratchet guard: configuration demands, package declarations and approvals (findings 28 and 29, second review)', REAL_GIT, () => {
  const WIDEN = '(a change may widen what the gates check, never narrow it)'
  const BACKEND = 'packages/backend'
  const guardProblems = (root: string, base: string) =>
    runGuard(root, { baseRef: base }).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))
  /** A server-only workspace package declared the way the repository does it (contextWindow.runtime). */
  const serverPackage = (repo: ReturnType<typeof repository>, manifest: object = {}) => {
    repo.write(`${BACKEND}/package.json`, { name: '@fixture/backend', contextWindow: { runtime: 'server' }, exports: { './identity': './src/identity.ts' }, ...manifest })
    repo.write(`${BACKEND}/src/identity.ts`, 'export const secret = 1;\n')
  }

  it('accepts classifying a new root: the finding it answers is a demand on the configuration, not debt (finding 28)', () => {
    const repo = repository()
    const base = repo.commit('base')
    repo.write('lib2/x.ts', 'export const x = 1;\n')
    repo.write('arch.config.json', { tokens: { scope: [] }, legacyRoots: [{ path: 'lib2', runtime: 'server' }] })
    repo.commit('classify lib2')
    const report = runGuard(repo.root, { baseRef: base })
    expect(report.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('treats the gate configuration as introduced when the base has none (the branch that brings the gates)', () => {
    const repo = repository()
    repo.remove('arch.config.json')
    repo.remove('tools/arch-baseline.json')
    const base = repo.commit('base without gates')
    repo.write('scripts/ops.ts', 'export const ops = 1;\n')
    repo.write('arch.config.json', { tokens: { scope: [] }, clientEntrypoints: ['app', 'pages/*', 'app/styles.css'], nonRuntimeRoots: [{ path: 'scripts', reason: 'scripts operacionais' }] })
    repo.write('tools/arch-baseline.json', baseline({ [HOME]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    repo.commit('introduce the gates')
    const report = runGuard(repo.root, { baseRef: base })
    expect(report.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(report.lines).toContain(`${'arch.config.json'}: not at the base; the gate configuration is introduced by this change`)
    expect(report.ok).toBe(true)
  })

  it('fails a server package that stops being server-only, even where nothing imports it yet (finding 29)', () => {
    const cases: Array<[string, (_repo: ReturnType<typeof repository>) => void, string]> = [
      [
        'contextWindow removed',
        (repo) => repo.write(`${BACKEND}/package.json`, { name: '@fixture/backend', exports: { './identity': './src/identity.ts' } }),
        `RATCHET-GUARD ${BACKEND}/package.json: @fixture/backend (${BACKEND}) is no longer server-only, as it is at the base ${WIDEN}`,
      ],
      [
        'runtime changed',
        (repo) => repo.write(`${BACKEND}/package.json`, { name: '@fixture/backend', contextWindow: { runtime: 'shared' }, exports: { './identity': './src/identity.ts' } }),
        `RATCHET-GUARD ${BACKEND}/package.json: @fixture/backend (${BACKEND}) is no longer server-only, as it is at the base ${WIDEN}`,
      ],
      [
        'another contextWindow setting',
        (repo) => repo.write(`${BACKEND}/package.json`, { name: '@fixture/backend', contextWindow: { runtime: 'server', tier: 'edge' }, exports: { './identity': './src/identity.ts' } }),
        `RATCHET-GUARD ${BACKEND}/package.json: @fixture/backend contextWindow differs from the base ({"runtime":"server"} -> {"runtime":"server","tier":"edge"}); the guard cannot tell it does not narrow the gates`,
      ],
      [
        'package renamed without the declaration',
        (repo) => repo.write(`${BACKEND}/package.json`, { name: '@fixture/server', exports: { './identity': './src/identity.ts' } }),
        `RATCHET-GUARD ${BACKEND}/package.json: @fixture/server (${BACKEND}) is no longer server-only, as it is at the base ${WIDEN}`,
      ],
      [
        'nested package inside the server package',
        (repo) => {
          // Three directories deep: arch-check reads it as a package of its own.
          repo.write(`${BACKEND}/inner/package.json`, { name: '@fixture/inner' })
          repo.write(`${BACKEND}/inner/index.ts`, 'export const inner = 1;\n')
        },
        `RATCHET-GUARD ${BACKEND}/inner/package.json: @fixture/inner (${BACKEND}/inner) is no longer server-only, as it is at the base ${WIDEN}`,
      ],
    ]
    for (const [label, change, problem] of cases) {
      const repo = repository()
      serverPackage(repo)
      const base = repo.commit(`base: ${label}`)
      change(repo)
      repo.commit(label)
      expect.soft(guardProblems(repo.root, base), label).toEqual([problem])
    }
    // The finding's second step: the import that the narrowed declaration no longer catches, in the same change.
    const repo = repository()
    serverPackage(repo)
    const base = repo.commit('base')
    repo.write(`${BACKEND}/package.json`, { name: '@fixture/backend', exports: { './identity': './src/identity.ts' } })
    repo.write('packages/frontend/src/pages/home/ui/Promo.ts', "export { secret } from '@fixture/backend/identity';\n")
    repo.commit('narrow and use')
    expect(guardProblems(repo.root, base)[0]).toBe(`RATCHET-GUARD ${BACKEND}/package.json: @fixture/backend (${BACKEND}) is no longer server-only, as it is at the base ${WIDEN}`)
    // Moved and renamed: the new package holding the server code (git diff -M) stays server-only.
    const renamed = repository()
    serverPackage(renamed)
    const renamedBase = renamed.commit('base')
    renamed.remove(`${BACKEND}/package.json`)
    renamed.remove(`${BACKEND}/src/identity.ts`)
    renamed.write('packages/api/package.json', { name: '@fixture/api', exports: { './identity': './src/identity.ts' } })
    renamed.write('packages/api/src/identity.ts', 'export const secret = 1;\n')
    renamed.write('packages/other/package.json', { name: '@fixture/other', exports: { '.': './src/index.ts' } })
    renamed.write('packages/other/src/index.ts', 'export const unrelated = "nothing moved here";\n')
    renamed.commit('move the server package')
    expect(guardProblems(renamed.root, renamedBase)).toEqual([
      `RATCHET-GUARD packages/api/package.json: @fixture/api (packages/api) holds code moved from the server package @fixture/backend (${BACKEND}) and is not server-only ${WIDEN}`,
    ])
    // The server package stays, empty, and its code leaves for a new package.
    const emptied = repository()
    serverPackage(emptied)
    const emptiedBase = emptied.commit('base')
    emptied.remove(`${BACKEND}/src/identity.ts`)
    emptied.write(`${BACKEND}/src/index.ts`, 'export {};\n')
    emptied.write('packages/api/package.json', { name: '@fixture/api', exports: { './identity': './src/identity.ts' } })
    emptied.write('packages/api/src/identity.ts', 'export const secret = 1;\n')
    emptied.commit('move the code out of the server package')
    expect(guardProblems(emptied.root, emptiedBase)).toEqual([
      `RATCHET-GUARD packages/api/package.json: @fixture/api (packages/api) holds code moved from the server package @fixture/backend (${BACKEND}) and is not server-only ${WIDEN}`,
    ])
    // Declaring the same package server-only through the configuration is equivalent.
    const moved = repository()
    serverPackage(moved)
    const movedBase = moved.commit('base')
    moved.write(`${BACKEND}/package.json`, { name: '@fixture/backend', exports: { './identity': './src/identity.ts' } })
    moved.write('arch.config.json', { tokens: { scope: [] }, serverOnlyPackages: ['@fixture/backend'] })
    moved.commit('declare it in the configuration')
    expect(guardProblems(moved.root, movedBase)).toEqual([])
  })

  it('fails a package that gains an entry point: exports decide what clients and packages may import (finding 29)', () => {
    const repo = repository()
    const base = repo.commit('base')
    repo.write('packages/ui/package.json', { name: '@fixture/ui', exports: { '.': { 'react-native': './src/index.native.ts', default: './src/index.web.ts' }, './internal/*': './src/*' } })
    repo.commit('export the internals')
    expect(guardProblems(repo.root, base)).toEqual([
      `RATCHET-GUARD packages/ui/package.json: @fixture/ui exports gain "./internal/*" ("./src/*"), an entry point the base does not have ${WIDEN}`,
    ])
    // A new entry point the product decides on is recorded with its approval.
    repo.write('tools/ratchet-transfers.json', { transfers: [{ approve: 'package.exports', entry: '@fixture/ui#./internal/*', reason: 'ponto de entrada interno para o catálogo' }] })
    repo.commit('approve the entry point')
    const report = runGuard(repo.root, { baseRef: base })
    expect(report.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(report.lines).toContain('approved package.exports gains "@fixture/ui#./internal/*": ponto de entrada interno para o catálogo')
  })

  it('fails a setting that is not a list, which the tools read as something else (finding 29)', () => {
    const repo = repository()
    const base = repo.commit('base')
    repo.write('arch.config.json', { tokens: { scope: [], ignoreDirs: 'node_modules .next .expo dist-export coverage android ios promo' } })
    repo.commit('ignoreDirs as a string')
    expect(guardProblems(repo.root, base)).toEqual([
      'RATCHET-GUARD arch.config.json: tokens.ignoreDirs must be a list (the base has ["node_modules",".next",".expo","dist","dist-export","build","coverage","android","ios"]); the tools read another type as something else',
    ])
    const scope = repository()
    const scopeBase = scope.commit('base')
    scope.write('arch.config.json', { tokens: { scope: [] }, legacyRoots: 'app', serverOnlyPackages: '@fixture/server' })
    scope.commit('lists as strings')
    const refused = guardProblems(scope.root, scopeBase)
    expect(refused.slice(0, 2)).toEqual([
      'RATCHET-GUARD arch.config.json: arch.legacyRoots must be a list (the base has []); the tools read another type as something else',
      'RATCHET-GUARD arch.config.json: arch.serverOnlyPackages must be a list (the base has []); the tools read another type as something else',
    ])
    // The tools themselves refuse it: reported, not a crash of the guard.
    expect(refused.slice(2)).toEqual([expect.stringMatching(/^RATCHET-GUARD arch\.config\.json: the arch configuration of the change cannot be measured \(/)])
  })

  it('accepts a narrowing only with an approval recorded in the same change, and never over zero tolerance', () => {
    const PROMO = 'packages/ui/src/Promo.web.tsx'
    const DEFAULT_IGNORE = ['\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)__fixtures__/']
    const gain = { path: 'scripts/ops', reason: 'scripts operacionais fora do runtime' }
    const approval = { approve: 'arch.nonRuntimeRoots', entry: gain, reason: 'scripts de operação não são runtime do produto' }
    const approved = (record: object[] | null, preexisting = false) => {
      const repo = repository()
      if (preexisting && record) repo.write('tools/ratchet-transfers.json', { transfers: record })
      const base = repo.commit('base')
      repo.write('scripts/ops/run.ts', 'export const run = 1;\n')
      repo.write('arch.config.json', { tokens: { scope: [] }, nonRuntimeRoots: [gain] })
      if (record && !preexisting) repo.write('tools/ratchet-transfers.json', { transfers: record })
      repo.commit('exempt scripts/ops')
      return runGuard(repo.root, { baseRef: base })
    }
    const unapproved = `RATCHET-GUARD arch.config.json: arch.nonRuntimeRoots gains ${JSON.stringify(gain)}, an exemption the base does not have ${WIDEN}`
    expect(approved(null).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([unapproved])
    const ok = approved([approval])
    expect(ok.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(ok.lines).toContain(`approved arch.nonRuntimeRoots gains ${JSON.stringify(gain)}: ${approval.reason}`)
    // An approval already at the base does not approve a new narrowing; one without a reason is refused.
    expect(approved([approval], true).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([unapproved])
    expect(approved([{ ...approval, reason: 'curto' }]).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([
      'RATCHET-GUARD tools/ratchet-transfers.json transfers[0]: an approval needs a "reason" (8+ characters)',
      unapproved,
    ])
    // An approved exemption may drop findings the gate measures, never a zero-tolerance one.
    const hidden = (rule: string, body: string) => {
      const repo = repository()
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'] } })
      const base = repo.commit('ui in the token scope')
      repo.write(PROMO, body)
      const pattern = 'Promo\\.web\\.tsx$'
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'], ignoreFiles: [...DEFAULT_IGNORE, pattern] } })
      repo.write('tools/ratchet-transfers.json', { transfers: [{ approve: 'tokens.ignoreFiles', entry: pattern, reason: `arquivo de campanha com ${rule}` }] })
      repo.commit('approved ignore')
      return guardProblems(repo.root, base)
    }
    expect(hidden('named-color', "export const Promo = () => <p style={{ color: 'red' }}>x</p>;\n")).toEqual([])
    expect(hidden('css-important', 'export const Promo = () => <p className="!mt-0">x</p>;\n')).toEqual([
      `RATCHET-GUARD arch.config.json: the tokens configuration of the change fails ${PROMO} css-important 0 time(s), the base configuration 1 in the same code ${WIDEN}`,
    ])
    // A scope entry may be dropped with an approval too.
    const repo = repository()
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src', 'packages/old'] } })
    const base = repo.commit('old scope')
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'] } })
    repo.write('tools/ratchet-transfers.json', { transfers: [{ approve: 'tokens.scope', entry: 'packages/old', reason: 'pacote antigo removido do produto' }] })
    repo.commit('drop the old package from the scope')
    expect(guardProblems(repo.root, base)).toEqual([])
  })
})

describe('ratchet guard: what an earlier change left at the base (findings 28 and 29, third review)', REAL_GIT, () => {
  const DEFAULT_IGNORE = ['\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)__fixtures__/']
  const DEFAULT_DIRS = ['node_modules', '.next', '.expo', 'dist', 'dist-export', 'build', 'coverage', 'android', 'ios']
  const guardProblems = (root: string, base: string) =>
    runGuard(root, { baseRef: base }).lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))
  const hidden = (file: string) =>
    `RATCHET-GUARD arch.config.json: ${file} has css-important 1 time(s) that the tokens configuration does not check (ignoreFiles, ignoreDirs or scope); a zero-tolerance rule is checked whatever the configuration or an approval exempts`

  it('fails !important added under an exemption approved in an earlier change (finding 28)', () => {
    const cases: Array<[string, string, object, object]> = [
      [
        'ignored file',
        'packages/ui/src/Promo.web.tsx',
        { ignoreFiles: [...DEFAULT_IGNORE, 'Promo\\.web\\.tsx$'] },
        { approve: 'tokens.ignoreFiles', entry: 'Promo\\.web\\.tsx$', reason: 'arquivo de campanha gerado' },
      ],
      [
        'ignored directory',
        'packages/ui/src/promo/Promo.web.tsx',
        { ignoreDirs: [...DEFAULT_DIRS, 'promo'] },
        { approve: 'tokens.ignoreDirs', entry: 'promo', reason: 'pasta de campanha gerada' },
      ],
      [
        'dropped scope',
        'packages/ui/src/Promo.web.tsx',
        { scope: [] },
        { approve: 'tokens.scope', entry: 'packages/ui/src', reason: 'design system fora do gate por enquanto' },
      ],
    ]
    for (const [label, file, exemption, approval] of cases) {
      const repo = repository()
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'] } })
      const base = repo.commit('ui in the token scope')
      repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src'], ...exemption } })
      repo.write('tools/ratchet-transfers.json', { transfers: [approval] })
      const approved = repo.commit(`approve: ${label}`)
      // The approval itself passes: nothing uses the exemption yet.
      expect.soft(guardProblems(repo.root, base), `${label}: approval`).toEqual([])
      repo.write(file, 'export const Promo = () => <p className="!mt-0" style={{ color: \'red\' }}>x</p>;\n')
      repo.commit(`use: ${label}`)
      // The approved exemption covers the absolute rule (named-color), never the zero-tolerance one.
      expect.soft(guardProblems(repo.root, approved), label).toEqual([hidden(file)])
    }
    // The same !important where the configuration checks it is left to the token gate itself.
    const checked = repository()
    checked.write('arch.config.json', { tokens: { scope: ['packages/ui/src'] } })
    const base = checked.commit('ui in the token scope')
    checked.write('packages/ui/src/Promo.web.tsx', 'export const Promo = () => <p className="!mt-0">x</p>;\n')
    checked.commit('important in the checked scope')
    expect(guardProblems(checked.root, base)).toEqual([])
  })

  it('ignores a configuration transfer already applied at the base, and it grants nothing there (finding 29)', () => {
    const from = 'packages/ui/src/promo'
    const to = 'packages/ui/src/oferta'
    const transfer = { config: 'tokens.scope', from, to, reason: 'pasta renomeada no design system' }
    const repo = repository()
    repo.write(`${from}/Promo.web.tsx`, 'export const Promo = () => null;\n')
    repo.write(`${from}/index.ts`, "export { Promo } from './Promo.web';\n")
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web', from] } })
    const base = repo.commit('promo in the token scope')
    repo.write(`${to}/Promo.web.tsx`, 'export const Promo = () => null;\n')
    repo.write(`${to}/index.ts`, "export { Promo } from './Promo.web';\n")
    repo.remove(`${from}/Promo.web.tsx`)
    repo.remove(`${from}/index.ts`)
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web', to] } })
    repo.write('tools/ratchet-transfers.json', { transfers: [transfer] })
    const moved = repo.commit('move promo')
    expect(guardProblems(repo.root, base)).toEqual([])
    // The next, unrelated change keeps the entry at its base: stale, ignored, reported as such.
    repo.write('packages/ui/src/web/Card.web.tsx', 'export const Card = () => null;\n')
    const unrelated = repo.commit('an unrelated change')
    const report = runGuard(repo.root, { baseRef: moved })
    expect(report.lines.filter((line: string) => line.startsWith('RATCHET-GUARD '))).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.lines).toContain(`configuration transfer tokens.scope ${from} -> ${to} stale and ignored: the base configuration does not name ${from}`)
    // Stale, it covers nothing: dropping the moved path later still fails.
    repo.write('arch.config.json', { tokens: { scope: ['packages/ui/src/web'] } })
    repo.commit('drop oferta')
    expect(guardProblems(repo.root, unrelated)).toEqual([
      'RATCHET-GUARD arch.config.json: tokens.scope no longer covers "packages/ui/src/oferta", checked by the base configuration (a change may widen what the gates check, never narrow it)',
    ])
  })
})

describe('ratchet guard: a transfer only follows a proven rename (finding 11)', REAL_GIT, () => {
  const transfer = (from: string, to: string, counts: Record<string, number> = { 'UNIVERSAL-DOM-JSX': 2 }) => ({
    transfers: [{ baseline: 'arch', from, to, reason: 'reorganizacao do slice', counts }],
  })

  it('rejects moving the allowance of a file that still exists to a new unrelated file', () => {
    const repo = repository()
    repo.write(HOME, 'export const Home = () => null;\n')
    repo.write(OTHER, 'export const Other = () => (\n  <div>\n    <span>novo</span>\n  </div>\n);\n')
    repo.write('packages/frontend/src/pages/home/index.ts', 'export { Home } from "./ui/Home";\nexport { Other } from "./ui/Other";')
    repo.write('tools/arch-baseline.json', baseline({ [OTHER]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    repo.write('tools/ratchet-transfers.json', transfer(HOME, OTHER))
    repo.commit('attack: consume the reduction of Home.tsx')
    expect(repo.problems()).toEqual([
      `RATCHET-GUARD tools/ratchet-transfers.json: transfer ${HOME} -> ${OTHER} rejected: ${HOME} still exists in the tree; a transfer only follows a file that was moved or renamed`,
      `RATCHET-GUARD tools/arch-baseline.json: new entry ${OTHER} UNIVERSAL-DOM-JSX: base 0, tree 2; the base code measures 0 with the current rules`,
    ])
  })

  it('rejects a deleted source whose "destination" git does not see as a rename, or one that existed at the base', () => {
    const unrelated = repository()
    unrelated.remove(HOME)
    unrelated.write(OTHER, 'export const Other = () => (\n  <div>\n    <span>novo</span>\n  </div>\n);\n')
    unrelated.write('packages/frontend/src/pages/home/index.ts', 'export { Other } from "./ui/Other";')
    unrelated.write('tools/arch-baseline.json', baseline({ [OTHER]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    unrelated.write('tools/ratchet-transfers.json', transfer(HOME, OTHER))
    unrelated.commit('attack: delete and create')
    expect(unrelated.problems()[0]).toBe(`RATCHET-GUARD tools/ratchet-transfers.json: transfer ${HOME} -> ${OTHER} rejected: git does not detect ${HOME} -> ${OTHER} as a rename (git diff -M)`)
    const existing = repository()
    existing.write(OTHER, 'export const Other = () => null;\n')
    const base = existing.commit('Other.tsx exists at the base')
    existing.remove(HOME)
    existing.write(OTHER, markup(2))
    existing.write('packages/frontend/src/pages/home/index.ts', 'export { Home } from "./ui/Other";')
    existing.write('tools/arch-baseline.json', baseline({ [OTHER]: { 'UNIVERSAL-DOM-JSX': 2 } }))
    existing.write('tools/ratchet-transfers.json', transfer(HOME, OTHER))
    existing.commit('attack: merge the debt into an existing file')
    expect(runGuard(existing.root, { baseRef: base }).lines).toContain(
      `RATCHET-GUARD tools/ratchet-transfers.json: transfer ${HOME} -> ${OTHER} rejected: ${OTHER} already exists at the base; debt is never moved into an existing file`
    )
  })

  it('accepts a real rename recorded with --rename and caps the moved allowance at the recorded counts', () => {
    const repo = repository()
    repo.remove(HOME)
    repo.write(MOVED, markup(2))
    repo.write('packages/frontend/src/pages/catalog/index.ts', 'export { Home } from "./ui/Home";')
    repo.write('packages/frontend/src/pages/home/index.ts', 'export const Home = () => null;')
    expect(renameEntry(repo.root, HOME, MOVED, 'movido para o slice de catálogo')).toEqual([
      { baseline: 'arch', from: HOME, to: MOVED, reason: 'movido para o slice de catálogo', counts: { 'UNIVERSAL-DOM-JSX': 2 } },
    ])
    repo.commit('rename Home.tsx')
    const report = repo.guard()
    expect(report.ok).toBe(true)
    expect(report.lines).toContain(`  transfer applied ${HOME} -> ${MOVED}`)
    // Counts lower than the base allowance move only what was recorded.
    repo.write('tools/ratchet-transfers.json', transfer(HOME, MOVED, { 'UNIVERSAL-DOM-JSX': 1 }))
    repo.commit('record a smaller transfer')
    expect(repo.problems()).toEqual([`RATCHET-GUARD tools/arch-baseline.json: increase ${MOVED} UNIVERSAL-DOM-JSX: base 1, tree 2; the base code measures 1 with the current rules`])
  })
})
