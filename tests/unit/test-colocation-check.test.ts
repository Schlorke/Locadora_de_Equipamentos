import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkTestColocation,
  createFileNester,
  parseJsonc,
  readAllowlist,
  readNestingSettings,
} from '../../tools/test-colocation-check.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const fixtures = path.join(here, '__fixtures__', 'test-colocation')
const tool = path.join(repoRoot, 'tools', 'test-colocation-check.mjs')
const repoSettings = path.join(repoRoot, '.vscode', 'settings.json')

const created: string[] = []
afterEach(() => {
  // Diretórios temporários só com arquivos regulares criados por materialize().
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

/** Lines of a fixture tree.txt: one repo-relative path per line; `#` starts a comment. */
function treeOf(fixture: string): string[] {
  return fs
    .readFileSync(path.join(fixtures, fixture, 'tree.txt'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|\s+)#.*$/, '').trim())
    .filter(Boolean)
}

/** Paths marked `# órfão` in a fixture tree.txt. */
function markedOrphans(fixture: string): string[] {
  return fs
    .readFileSync(path.join(fixtures, fixture, 'tree.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /#\s*órfão/.test(line) && !line.trimStart().startsWith('#'))
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .sort()
}

/** Writes the fixture tree (empty files) and the repository's real .vscode/settings.json into a temp root. */
function materialize(fixture: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `test-colocation-${fixture}-`))
  created.push(root)
  for (const file of treeOf(fixture)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), '')
  }
  fs.mkdirSync(path.join(root, '.vscode'), { recursive: true })
  fs.copyFileSync(repoSettings, path.join(root, '.vscode', 'settings.json'))
  return root
}

function cli(root: string, ...args: string[]) {
  const run = spawnSync(process.execPath, [tool, '--root', root, ...args], { encoding: 'utf8' })
  return { status: run.status, out: run.stdout, err: run.stderr }
}

describe('test-colocation-check: regras do .vscode/settings.json (fixtures)', () => {
  it('acusa exatamente os testes que o explorer do VS Code deixaria soltos', () => {
    const root = materialize('nesting')
    const report = checkTestColocation(root)
    expect(report.problems).toEqual([])
    expect(report.orphans).toEqual(markedOrphans('nesting'))
    expect(report.orphans).toEqual([
      'apps/web/next.config.redirects.test.ts',
      'packages/demo/src/lib/helper.test.extra.test.ts',
      'packages/demo/src/lib/helper.test.ts',
      'packages/demo/src/lib/other.spec.ts',
      'packages/demo/src/native/overlay.focus.native.test.tsx',
      'packages/demo/src/pages/home/contrato.migracao.test.ts',
      'packages/demo/src/routing/tenant-api-allowlist.test.ts',
      'packages/demo/src/web-case/form.web.test.tsx',
      'packages/demo/tests/loose.test.ts',
      'root.test.ts',
    ])
    expect(report.ok).toBe(false)
  })

  it('ignora tests/ da raiz, __fixtures__, node_modules, saídas de build e pastas com ponto', () => {
    const report = checkTestColocation(materialize('nesting'))
    // 33 arquivos de teste na árvore; os 5 fora do escopo não entram na conta nem na lista.
    expect(treeOf('nesting').filter((file) => /\.(test|spec)\./.test(file))).toHaveLength(33)
    expect(report.examined).toBe(28)
    expect(report.orphans.filter((file: string) => file.endsWith('/loose.test.ts'))).toEqual(['packages/demo/tests/loose.test.ts'])
  })

  it('segue as regras que o settings declara, em JSONC aninhado com comentários e vírgulas finais', () => {
    const root = materialize('settings')
    const nested = checkTestColocation(root, { settingsFile: path.join(fixtures, 'settings', 'nested.jsonc') })
    expect(nested.problems).toEqual([])
    expect(nested.orphans).toEqual(['src/a.aspect.test.ts'])
    // Com o settings real do repositório, <assunto>.<aspecto>.test.ts aninha.
    expect(checkTestColocation(root).orphans).toEqual([])
  })

  it('recusa settings com o aninhamento desligado', () => {
    const root = materialize('settings')
    const run = cli(root, '--settings', path.join(fixtures, 'settings', 'disabled.jsonc'))
    expect(run.status).toBe(1)
    expect(run.out).toContain('CONFIG .vscode/settings.json: "explorer.fileNesting.enabled" must be true')
  })
})

describe('test-colocation-check: allowlist', () => {
  const allowlist = (name: string) => path.join(fixtures, 'allowlist', `${name}.json`)

  it('sai 1 e lista o órfão fora da allowlist', () => {
    const run = cli(materialize('allowlist'), '--allowlist', allowlist('partial'))
    expect(run.status).toBe(1)
    expect(run.out).toMatch(/^ORPHAN src\/legacy\.test\.ts /m)
    expect(run.out).not.toMatch(/^ORPHAN src\/cross-cutting\.test\.ts/m)
    expect(run.out).toContain('allowed src/cross-cutting.test.ts (teste de arquitetura sem arquivo-assunto)')
  })

  it('sai 0 quando todo órfão tem entrada com motivo', () => {
    const run = cli(materialize('allowlist'), '--allowlist', allowlist('complete'))
    expect(run.err).toBe('')
    expect(run.status).toBe(0)
    expect(run.out).toContain('test colocation check passed — 3 colocated test file(s), 2 orphan(s): 2 allowed, 0 unlisted; 0 stale allowlist entries')
  })

  it('a allowlist só encolhe: entrada de arquivo aninhado ou inexistente falha', () => {
    const root = materialize('allowlist')
    const report = checkTestColocation(root, { allowlistFile: allowlist('stale') })
    expect(report.unlisted).toEqual([])
    expect(report.stale).toEqual([
      { file: 'src/a.test.ts', why: 'no longer an orphan (it nests under a subject or is out of scope)' },
      { file: 'src/removed.test.ts', why: 'file does not exist' },
    ])
    expect(report.ok).toBe(false)
    expect(cli(root, '--allowlist', allowlist('stale')).status).toBe(1)
  })

  it('entrada sem motivo falha e não libera o órfão', () => {
    const root = materialize('allowlist')
    const report = checkTestColocation(root, { allowlistFile: allowlist('no-reason') })
    expect(report.problems).toEqual(['tools/test-colocation-allowlist.json: "src/legacy.test.ts" needs a reason (8+ characters)'])
    expect(report.ok).toBe(false)
    expect(readAllowlist('{"orphans": []}').problems).toEqual(['tools/test-colocation-allowlist.json: expected an object "orphans": { "<test path>": "<reason>" }'])
  })
})

describe('test-colocation-check: algoritmo do VS Code', () => {
  it('normaliza os padrões como o explorer (trim, vírgulas vazias, espaço de largura zero)', () => {
    const settings = parseJsonc(fs.readFileSync(path.join(fixtures, 'settings', 'nested.jsonc'), 'utf8'))
    expect(settings['search.exclude']).toEqual({ 'http://example.test/,}': true })
    expect(readNestingSettings(settings)).toEqual({ patterns: [['*.ts', ['${capture}.test.ts']]], problems: [] })
  })

  it('resolve cadeias até o ancestral raiz e não entra em laço com padrões cíclicos', () => {
    const { patterns } = readNestingSettings(parseJsonc(fs.readFileSync(repoSettings, 'utf8')))
    const nested = createFileNester(patterns).nest(['a.ts', 'a.web.ts', 'a.native.ts', 'a.web.test.ts', 'b.test.ts'], 'src')
    expect(Object.fromEntries([...nested].map(([parent, children]) => [parent, [...children].sort()]))).toEqual({
      'a.ts': ['a.native.ts', 'a.web.test.ts', 'a.web.ts'],
      'b.test.ts': [],
    })
    const cyclic = createFileNester([['*.a', ['${capture}.b']], ['*.b', ['${capture}.a']]]).nest(['x.a', 'x.b'], 'src')
    expect([...cyclic.keys()].sort()).toEqual(['x.a', 'x.b'])
  })

  it('o `*` de um padrão filho casa também o texto vazio, como no VS Code', () => {
    const nested = createFileNester([['*.ts', ['${capture}.*.test.ts']]]).nest(['a.ts', 'a..test.ts', 'a.test.ts'], 'src')
    expect([...nested.get('a.ts')!].sort()).toEqual(['a..test.ts'])
    expect(nested.get('a.test.ts')).toEqual(new Set())
  })
})
