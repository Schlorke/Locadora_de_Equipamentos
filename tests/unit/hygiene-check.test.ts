import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyBaseline,
  BASELINE_FILE,
  cssOrphans,
  dropNativeSiblingExports,
  exportedNames,
  gitignoreCovers,
  globBase,
  globToRegExp,
  hidingTags,
  nativeOrphans,
  packageNameOf,
  parseJsonc,
  readBaseline,
  testOnlyFindings,
  TOOL_OUTPUTS,
  toolOutputFindings,
  withoutTests,
  workspaceGlobs,
  workspaceUnlisted,
} from '../../tools/hygiene-check.mjs'

/**
 * tools/hygiene-check.mjs (pnpm hygiene). Os casos de ponta a ponta rodam o knip de verdade num repositório
 * descartável: um arquivo morto sintético reprova, um item com motivo na linha de base o aceita e o item que
 * sobra depois que o arquivo sai reprova de novo (a linha de base só encolhe); o código que só um teste mantém
 * vivo, o CSS sem importador e a tag JSDoc que esconde export também reprovam.
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const tool = path.join(repoRoot, 'tools', 'hygiene-check.mjs')
const roots: string[] = []
const GITIGNORE = TOOL_OUTPUTS.map((output) => output.rule).join('\n') + '\n'
// Montada em pedaços: este arquivo também passa pelo gate, e a tag literal num bloco JSDoc seria achado dele.
const TAG = (name: string) => `@${name}`

function fixture(files: Record<string, string | object>) {
  const root = fs.mkdtempSync(
    path.join(path.resolve(os.tmpdir()), 'locadora-hygiene-')
  )
  roots.push(root)
  const write = (file: string, body: string | object) => {
    const target = path.resolve(root, file)
    if (!target.startsWith(root + path.sep))
      throw new Error('Fixture escaped temporary root')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(
      target,
      typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    )
  }
  for (const [file, body] of Object.entries(files)) write(file, body)
  // Repositório próprio: o git e o knip não sobem até um repositório acima da pasta temporária.
  const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(root) }
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-c',
        'core.autocrlf=false',
        ...args,
      ],
      { cwd: root, env, encoding: 'utf8' }
    ).trim()
  git('init', '-q')
  if (path.resolve(git('rev-parse', '--show-toplevel')) !== path.resolve(root))
    throw new Error('Fixture is not its own repository')
  const run = () =>
    spawnSync(process.execPath, [tool, '--root', root], {
      cwd: root,
      env,
      encoding: 'utf8',
    })
  return { root, git, run, write }
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

const project = {
  'package.json': { name: 'hygiene-fixture', private: true, type: 'module' },
  'knip.jsonc':
    '{\n  // entrada real do fixture\n  "entry": ["src/index.ts"],\n  "project": ["src/**/*.ts"]\n}\n',
  '.gitignore': GITIGNORE,
  'src/index.ts': "import { used } from './used'\nconsole.log(used)\n",
  'src/used.ts': 'export const used = 1\n',
}

// Cada caso roda git e knip reais: isolado leva até 9,1 s (medido em 2026-10-06);
// sob a carga do pnpm test:unit completo passava dos 20 s do padrão.
const KNIP_REAL = { timeout: 60_000 }

describe('pnpm hygiene de ponta a ponta (knip real)', KNIP_REAL, () => {
  it('reprova um arquivo morto sintético, aceita-o com motivo na linha de base e reprova o item velho', () => {
    const { root, run } = fixture({
      ...project,
      'src/sobra-sintetica.ts': 'export const sobra = 2\n',
    })

    const dead = run()
    expect(dead.status, dead.stdout + dead.stderr).toBe(1)
    expect(dead.stderr).toContain('files src/sobra-sintetica.ts')

    fs.mkdirSync(path.join(root, 'tools'), { recursive: true })
    fs.writeFileSync(
      path.join(root, BASELINE_FILE),
      JSON.stringify({
        entries: [
          {
            type: 'files',
            path: 'src/sobra-sintetica.ts',
            reason: 'espera decisão do dono no fixture',
          },
        ],
      })
    )
    const accepted = run()
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0)
    expect(accepted.stdout).toContain('hygiene: ok')

    fs.rmSync(path.join(root, 'src/sobra-sintetica.ts'))
    const stale = run()
    expect(stale.status, stale.stdout + stale.stderr).toBe(1)
    expect(stale.stderr).toContain(
      'files src/sobra-sintetica.ts não acontece mais'
    )
  })

  it('reprova export e dependência sem uso', () => {
    const { run } = fixture({
      ...project,
      'package.json': {
        name: 'hygiene-fixture',
        private: true,
        type: 'module',
        dependencies: { 'left-pad': '1.3.0' },
      },
      'src/used.ts': 'export const used = 1\nexport const semConsumidor = 2\n',
    })
    const result = run()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stderr).toContain('exports src/used.ts :: semConsumidor')
    expect(result.stderr).toContain('dependencies package.json :: left-pad')
  })

  it('reprova o módulo e o export que só o teste colocado mantém vivos (passe sem testes)', () => {
    const { run, root } = fixture({
      ...project,
      // O teste colocado é entrada, como no repositório (knip.jsonc: src/**/*.test.{ts,tsx}).
      'knip.jsonc':
        '{\n  "entry": ["src/index.ts", "src/**/*.test.ts"],\n  "project": ["src/**/*.ts"]\n}\n',
      'src/used.ts': 'export const used = 1\nexport const soTeste = 2\n',
      'src/morto.ts': 'export function morto() {\n  return 3\n}\n',
      'src/morto.test.ts':
        "import { morto } from './morto'\nimport { soTeste } from './used'\nconsole.log(morto(), soTeste)\n",
    })
    const result = run()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stderr).toContain('test-only-file src/morto.ts')
    expect(result.stderr).toContain('test-only-export src/used.ts :: soTeste')
    // O passe com testes sozinho não vê nada: é o passe sem testes que acha a sobra.
    expect(result.stderr).not.toContain('files src/morto.ts')

    // Sem o teste, o knip normal passa a ver o módulo morto (o mesmo defeito, agora sem disfarce).
    fs.rmSync(path.join(root, 'src/morto.test.ts'))
    const withoutTest = run()
    expect(withoutTest.stderr).toContain('files src/morto.ts')
    expect(withoutTest.stderr).toContain('exports src/used.ts :: soTeste')
  })

  it('reprova tag JSDoc que esconde export do knip', () => {
    const { run } = fixture({
      ...project,
      'src/used.ts': `export const used = 1\n/** ${TAG('public')} */\nexport const escondido = 2\n`,
    })
    const result = run()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stderr).toContain(
      `export-tag src/used.ts :: ${TAG('public')}`
    )
    // O knip, sozinho, não reportaria o export marcado.
    expect(result.stderr).not.toContain('exports src/used.ts :: escondido')
  })

  it('reprova CSS sem importador num workspace em que o knip não lê CSS', () => {
    const { run } = fixture({
      'package.json': {
        name: 'hygiene-fixture',
        private: true,
        type: 'module',
        workspaces: ['packages/*'],
        dependencies: { '@fixture/p': 'workspace:*' },
      },
      'knip.jsonc': JSON.stringify({
        workspaces: {
          '.': { entry: ['src/index.ts'], project: ['src/**/*.ts'] },
          'packages/p': { project: ['**/*.{ts,css}'] },
        },
      }),
      '.gitignore': GITIGNORE,
      'src/index.ts':
        "import { valor } from '@fixture/p'\nimport '@fixture/p/estilo.css'\nconsole.log(valor)\n",
      'packages/p/package.json': {
        name: '@fixture/p',
        type: 'module',
        exports: { '.': './src/index.ts', './estilo.css': './src/estilo.css' },
      },
      'packages/p/src/index.ts': 'export const valor = 1\n',
      'packages/p/src/estilo.css':
        "@import './base.css';\n.a {\n  color: inherit;\n}\n",
      'packages/p/src/base.css': '.b {\n  color: inherit;\n}\n',
      'packages/p/src/sobra.css': '.c {\n  color: inherit;\n}\n',
    })
    const result = run()
    expect(result.stderr).toContain('css-orphan packages/p/src/sobra.css')
    expect(result.stderr).not.toContain('packages/p/src/estilo.css')
    expect(result.stderr).not.toContain('packages/p/src/base.css')
  })

  it('reprova arquivo morto novo numa pasta que a linha de base aceita por glob', () => {
    const { root, run } = fixture({
      ...project,
      'src/gerado/a.ts': 'export const a = 1\n',
      [BASELINE_FILE]: {
        entries: [
          {
            type: 'files',
            path: 'src/gerado/**',
            names: ['a.ts'],
            reason: 'saída de gerador que espera decisão do dono',
          },
        ],
      },
    })
    const accepted = run()
    expect(accepted.status, accepted.stdout + accepted.stderr).toBe(0)

    fs.writeFileSync(path.join(root, 'src/gerado/b.ts'), 'export const b = 2\n')
    const grown = run()
    expect(grown.status, grown.stdout + grown.stderr).toBe(1)
    expect(grown.stderr).toContain('files src/gerado/b.ts')
  })

  it('reprova pacote que o workspace importa sem declarar, mesmo com a raiz declarando (workspace-unlisted)', () => {
    // E24 da onda 135: o knip aceita a dependência da raiz; o workspace quebra quando a raiz sai ou é podada.
    const { root, run, write } = fixture({
      'package.json': {
        name: 'hygiene-fixture',
        private: true,
        type: 'module',
        dependencies: { 'left-pad': '1.3.0' },
      },
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
      'knip.jsonc': JSON.stringify({
        workspaces: {
          'packages/a': {
            entry: ['src/index.ts', 'src/**/*.test.ts'],
            project: ['src/**/*.ts'],
          },
        },
      }),
      '.gitignore': GITIGNORE,
      'packages/a/package.json': { name: '@fixture/a', type: 'module' },
      'packages/a/src/index.ts':
        "import pad from 'left-pad'\nimport { readFileSync } from 'node:fs'\nconsole.log(pad, readFileSync)\n",
      // O teste colocado usa o ferramental da raiz por desenho: não conta.
      'packages/a/src/index.test.ts':
        "import pad from 'left-pad'\nconsole.log(pad)\n",
    })
    const unlisted = run()
    expect(unlisted.status, unlisted.stdout + unlisted.stderr).toBe(1)
    expect(unlisted.stderr).toContain(
      'workspace-unlisted packages/a/src/index.ts :: left-pad'
    )
    expect(unlisted.stderr).not.toContain('index.test.ts :: left-pad')
    // O knip sozinho aceitava: a raiz declara e o workspace usa.
    expect(unlisted.stderr).not.toContain('dependencies package.json')

    // Declarado no workspace (e fora da raiz, que não o usa mais): verde.
    write('package.json', {
      name: 'hygiene-fixture',
      private: true,
      type: 'module',
    })
    write('packages/a/package.json', {
      name: '@fixture/a',
      type: 'module',
      dependencies: { 'left-pad': '1.3.0' },
    })
    const declared = run()
    expect(declared.status, declared.stdout + declared.stderr).toBe(0)
    expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(false)
  })

  it('reprova saída de ferramenta versionada e fora do .gitignore', () => {
    const { git, run } = fixture({
      ...project,
      '.gitignore': '',
      'coverage/index.html': '<html></html>\n',
      'apps/clients/web/next-dev.log': 'log\n',
    })
    git('add', '--', 'coverage/index.html', 'apps/clients/web/next-dev.log')
    const result = run()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stderr).toContain(
      'tool-output-not-ignored .gitignore :: test-results/'
    )
    expect(result.stderr).toContain(
      'tool-output-not-ignored .gitignore :: eslint-output.txt'
    )
    expect(result.stderr).toContain(
      'tool-output-tracked coverage/index.html :: coverage/'
    )
    expect(result.stderr).toContain(
      'tool-output-tracked apps/clients/web/next-dev.log :: *.log'
    )
  })
})

describe('regras do gate', () => {
  it('glob de caminho: ** atravessa pastas, * fica no segmento; a parte literal é a pasta antes do curinga', () => {
    expect(
      globToRegExp('lib/validations/schemas/**').test(
        'lib/validations/schemas/a/b.ts'
      )
    ).toBe(true)
    expect(globToRegExp('scripts/*.js').test('scripts/a/b.js')).toBe(false)
    expect(globToRegExp('**/x.ts').test('x.ts')).toBe(true)
    expect(globBase('lib/validations/schemas/**')).toBe(
      'lib/validations/schemas/'
    )
    expect(globBase('scripts/*.js')).toBe('scripts/')
    expect(globBase('**/x.ts')).toBe('')
  })

  it('linha de base: todo item tem motivo, "names" fora de files e nenhum item repetido', () => {
    const { problems } = readBaseline(
      JSON.stringify({
        entries: [
          { type: 'files', path: 'a.ts' },
          { type: 'exports', path: 'b.ts', reason: 'motivo suficiente aqui' },
          {
            type: 'files',
            path: 'c.ts',
            names: ['x'],
            reason: 'motivo suficiente aqui',
          },
          {
            type: 'exports',
            path: 'd.ts',
            names: ['x'],
            reason: 'motivo suficiente aqui',
          },
          {
            type: 'exports',
            path: 'd.ts',
            names: ['y'],
            reason: 'motivo suficiente aqui',
          },
          {
            type: 'desconhecido',
            path: 'e.ts',
            reason: 'motivo suficiente aqui',
          },
          { type: 'files', path: 'f.ts', reason: 'curto' },
        ],
      })
    )
    expect(problems).toHaveLength(6)
    expect(problems.join('\n')).toMatch(
      /falta o motivo[\s\S]*precisa de "names"[\s\S]*não leva "names"[\s\S]*repetido[\s\S]*desconhecido[\s\S]*\(f\.ts\): falta o motivo/
    )
  })

  it('linha de base: glob só em item de arquivo, e com cada arquivo aceito listado', () => {
    const { problems } = readBaseline(
      JSON.stringify({
        entries: [
          { type: 'files', path: 'gen/**', reason: 'motivo suficiente aqui' },
          {
            type: 'exports',
            path: 'lib/*.ts',
            names: ['x'],
            reason: 'motivo suficiente aqui',
          },
          {
            type: 'test-only-file',
            path: 'gen/**',
            names: ['a.ts'],
            reason: 'motivo suficiente aqui',
          },
        ],
      })
    )
    expect(problems).toEqual([
      expect.stringContaining(
        '(gen/**): glob precisa listar em "names" cada arquivo que aceita, relativo a "gen/"'
      ),
      expect.stringContaining('(lib/*.ts): glob só vale em item de arquivo'),
    ])
  })

  it('aplica a linha de base por nome e aponta o nome que sobrou', () => {
    const { entries } = readBaseline(
      JSON.stringify({
        entries: [
          {
            type: 'exports',
            path: 'a.ts',
            names: ['x', 'y'],
            reason: 'motivo suficiente aqui',
          },
        ],
      })
    )
    const { failing, stale } = applyBaseline(
      [
        { type: 'exports', file: 'a.ts', name: 'x' },
        { type: 'exports', file: 'a.ts', name: 'z' },
      ],
      entries
    )
    expect(failing).toEqual([{ type: 'exports', file: 'a.ts', name: 'z' }])
    expect(stale.map((item) => item.name)).toEqual(['y'])
  })

  it('glob de arquivo aceita só os arquivos listados: arquivo novo na pasta reprova, arquivo que saiu fica velho', () => {
    const { entries } = readBaseline(
      JSON.stringify({
        entries: [
          {
            type: 'files',
            path: 'lib/gerado/**',
            names: ['a.ts', 'sub/b.ts', 'c.ts'],
            reason: 'motivo suficiente aqui',
          },
        ],
      })
    )
    const { failing, stale } = applyBaseline(
      [
        { type: 'files', file: 'lib/gerado/a.ts' },
        { type: 'files', file: 'lib/gerado/sub/b.ts' },
        { type: 'files', file: 'lib/gerado/novo.ts' },
      ],
      entries
    )
    expect(failing).toEqual([{ type: 'files', file: 'lib/gerado/novo.ts' }])
    expect(stale.map((item) => item.name)).toEqual(['c.ts'])
  })

  it('.gitignore: pasta acima cobre, "!" posterior descobre, regra sem "/" vale em qualquer nível', () => {
    expect(gitignoreCovers('.tmp/\n', '.tmp/visual/current')).toBe(true)
    expect(gitignoreCovers('/coverage\n', 'coverage')).toBe(true)
    expect(gitignoreCovers('coverage/\n!coverage/\n', 'coverage')).toBe(false)
    expect(gitignoreCovers('*.log\n', 'test-results')).toBe(false)
    // Regra sem "/" no meio: qualquer nível; com "/": só a partir da raiz.
    expect(gitignoreCovers('.next/\n', 'apps/clients/web/.next/')).toBe(true)
    expect(gitignoreCovers('*.log\n', 'apps/clients/web/next-dev.log')).toBe(
      true
    )
    expect(
      gitignoreCovers('apps/clients/mobile/dist-export/\n', 'dist-export/')
    ).toBe(false)
    // "/" no fim só casa pasta; o que está dentro de pasta ignorada não volta com "!".
    expect(gitignoreCovers('eslint-output.txt/\n', 'eslint-output.txt')).toBe(
      false
    )
    expect(gitignoreCovers('out/\n!out/a.txt\n', 'out/a.txt')).toBe(true)
  })

  it('o .gitignore do repositório cobre toda saída de ferramenta (inclusive as saídas redirecionadas de lint/build/teste)', () => {
    expect(toolOutputFindings(repoRoot, { tracked: [] })).toEqual([])
    const samples = TOOL_OUTPUTS.flatMap((output) => output.samples)
    expect(samples).toEqual(
      expect.arrayContaining([
        'eslint-output.txt',
        'build-output.txt',
        'test-output.txt',
        'apps/clients/web/.next/',
        'apps/clients/mobile/dist-export/',
        'apps/clients/mobile/.expo/',
        'build-web.log',
        'tsconfig.tsbuildinfo',
      ])
    )
  })

  it('saída versionada é achada mesmo com o .gitignore certo, em qualquer nível', () => {
    const root = fs.mkdtempSync(
      path.join(path.resolve(os.tmpdir()), 'locadora-hygiene-')
    )
    roots.push(root)
    fs.writeFileSync(path.join(root, '.gitignore'), GITIGNORE)
    expect(
      toolOutputFindings(root, {
        tracked: [
          'playwright-report/index.html',
          'src/a.ts',
          'apps/clients/web/.next/server/app.js',
          'packages/ui/tsconfig.tsbuildinfo',
        ],
      })
    ).toEqual([
      {
        type: 'tool-output-tracked',
        file: 'playwright-report/index.html',
        name: 'playwright-report/',
      },
      {
        type: 'tool-output-tracked',
        file: 'apps/clients/web/.next/server/app.js',
        name: '.next/',
      },
      {
        type: 'tool-output-tracked',
        file: 'packages/ui/tsconfig.tsbuildinfo',
        name: '*.tsbuildinfo',
      },
    ])
  })

  it('variante .native sem irmã, fora de exports e sem import explícito é sobra', () => {
    const { root } = fixture({
      'packages/p/package.json': {
        name: 'p',
        exports: {
          '.': {
            'react-native': './src/index.native.ts',
            default: './src/index.ts',
          },
        },
      },
      'packages/p/src/index.ts': 'export {}\n',
      'packages/p/src/index.native.ts':
        "export { B } from './native/B.native'\n",
      'packages/p/src/native/B.native.tsx': 'export const B = 1\n',
      'packages/p/src/A.tsx': 'export const A = 1\n',
      'packages/p/src/A.native.tsx': 'export const A = 1\n',
      'packages/p/src/Solta.native.tsx': 'export const S = 1\n',
    })
    expect(nativeOrphans(root)).toEqual([
      { type: 'native-orphan', file: 'packages/p/src/Solta.native.tsx' },
    ])
  })

  it('export de .native vale o da irmã: sai quando a irmã exporta o nome, fica quando só a .native o tem', () => {
    const { root } = fixture({
      'packages/p/src/A.web.tsx':
        "export const A = 1\nexport default A\nexport type { T } from './t'\nexport { x as y } from './x'\n",
      'packages/p/src/A.native.tsx':
        'export const A = 1\nexport const SoNative = 2\nexport type T = number\nexport const y = 3\n',
      'packages/p/src/B.native.tsx': 'export const B = 1\n',
    })
    expect([
      ...exportedNames(path.join(root, 'packages/p/src/A.web.tsx'))!,
    ]).toEqual(['A', 'default', 'T', 'y'])
    const findings = [
      { type: 'exports', file: 'packages/p/src/A.native.tsx', name: 'A' },
      {
        type: 'exports',
        file: 'packages/p/src/A.native.tsx',
        name: 'SoNative',
      },
      { type: 'types', file: 'packages/p/src/A.native.tsx', name: 'T' },
      { type: 'exports', file: 'packages/p/src/A.native.tsx', name: 'y' },
      { type: 'exports', file: 'packages/p/src/B.native.tsx', name: 'B' },
      { type: 'exports', file: 'packages/p/src/A.web.tsx', name: 'A' },
    ]
    expect(dropNativeSiblingExports(root, findings)).toEqual([
      {
        type: 'exports',
        file: 'packages/p/src/A.native.tsx',
        name: 'SoNative',
      },
      { type: 'exports', file: 'packages/p/src/B.native.tsx', name: 'B' },
      { type: 'exports', file: 'packages/p/src/A.web.tsx', name: 'A' },
    ])
  })

  it('passe sem testes: tira entradas e arquivos de teste e desliga vitest e playwright; só o que ele acha a mais conta', () => {
    const config = withoutTests({
      workspaces: {
        '.': {
          entry: [
            'tools/x.mjs',
            'tests/**/*.{test,spec}.{ts,tsx}',
            'stories/**/*.mdx',
          ],
          project: ['**/*.ts'],
        },
        'packages/p': { entry: ['src/**/*.test.ts'] },
      },
    })
    const root = config.workspaces['.']
    expect(root.entry.filter((item: string) => !item.startsWith('!'))).toEqual([
      'tools/x.mjs',
      'stories/**/*.mdx',
    ])
    expect(root.project[0]).toBe('**/*.ts')
    expect(root.project.slice(1)).toEqual(
      root.entry.filter((item: string) => item.startsWith('!'))
    )
    expect([root.vitest, root.playwright]).toEqual([false, false])
    expect(config.workspaces['packages/p'].project[0]).toMatch(/^\*\*\/\*\./)
    expect(
      testOnlyFindings(
        [{ type: 'exports', file: 'a.ts', name: 'x' }],
        [
          { type: 'exports', file: 'a.ts', name: 'x' },
          { type: 'exports', file: 'a.ts', name: 'y' },
          { type: 'types', file: 'a.ts', name: 'T' },
          { type: 'files', file: 'b.ts' },
          { type: 'devDependencies', file: 'package.json', name: 'vitest' },
        ]
      )
    ).toEqual([
      { type: 'test-only-export', file: 'a.ts', name: 'y' },
      { type: 'test-only-export', file: 'a.ts', name: 'T' },
      { type: 'test-only-file', file: 'b.ts' },
    ])
  })

  it('tag JSDoc que esconde export: só em bloco /** */, qualquer uma das três', () => {
    const { root } = fixture({
      'src/a.ts': `/** Documentação. ${TAG('beta')} */\nexport const a = 1\n`,
      'src/b.ts': `// ${TAG('public')} em comentário de linha não é JSDoc\nexport const b = 1\n`,
      'src/c.ts': `export const c = '${TAG('alias')}'\n/**\n * ${TAG('alias')} outro\n * ${TAG('public')}\n */\nexport const d = 1\n`,
      'src/d.ts': `/** ${TAG('internal')} não esconde (o knip reporta) */\nexport const e = 1\n`,
    })
    expect(
      hidingTags(root, {
        files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'],
      })
    ).toEqual([
      { type: 'export-tag', file: 'src/a.ts', name: TAG('beta') },
      { type: 'export-tag', file: 'src/c.ts', name: TAG('alias') },
      { type: 'export-tag', file: 'src/c.ts', name: TAG('public') },
    ])
  })

  it('CSS sem importador: import relativo, @import e "exports" de pacote contam; dono do arquivo pelo workspace mais longo', () => {
    const { root } = fixture({
      'packages/p/package.json': {
        name: '@f/p',
        exports: { './tema.css': './src/tema.css', './*': './src/*' },
      },
      'packages/p/src/tema.css': "@import url('./paleta.css');\n",
      'packages/p/src/paleta.css': '.a {}\n',
      'packages/p/src/solto.css': '.b {}\n',
      'packages/p/src/extra/uso.css': '.c {}\n',
      'packages/p/src/sozinho/nada.css': '.d {}\n',
      'app/page.ts':
        "import '@f/p/tema.css'\nimport '@f/p/extra/uso.css'\nexport const p = 1\n",
      'app/root.css': '.e {}\n',
    })
    const files = [
      'packages/p/package.json',
      'packages/p/src/tema.css',
      'packages/p/src/paleta.css',
      'packages/p/src/solto.css',
      'packages/p/src/extra/uso.css',
      'packages/p/src/sozinho/nada.css',
      'app/page.ts',
      'app/root.css',
    ]
    expect(
      cssOrphans(root, {
        workspaces: ['packages/p'],
        configured: ['.', 'packages/p'],
        files,
      })
    ).toEqual([
      { type: 'css-orphan', file: 'packages/p/src/solto.css' },
      { type: 'css-orphan', file: 'packages/p/src/sozinho/nada.css' },
    ])
  })

  it('workspace-unlisted: nome do pacote pelo especificador; relativo, alias, protocolo e módulo do Node não contam', () => {
    expect(packageNameOf('three')).toBe('three')
    expect(packageNameOf('three/examples/jsm/x.js')).toBe('three')
    expect(packageNameOf('@react-three/fiber')).toBe('@react-three/fiber')
    expect(packageNameOf('@gb-locacoes/backend/identity')).toBe(
      '@gb-locacoes/backend'
    )
    for (const specifier of [
      './x',
      '../y',
      '/abs',
      '#interno',
      '@/lib/x',
      '~/x',
      'node:fs',
      'fs',
      'path/posix',
      'https://exemplo.test/x.js',
      'virtual:modulo',
      '@escopo-sem-nome',
    ])
      expect(packageNameOf(specifier), specifier).toBeNull()
  })

  it('workspace-unlisted: workspaces pelo pnpm-workspace.yaml (ou pelo package.json da raiz)', () => {
    const { root } = fixture({
      'pnpm-workspace.yaml':
        "packages:\n  - 'apps/*'\n  - \"packages/*\" # comentário\n  - '!packages/fora'\nonlyBuiltDependencies:\n  - esbuild\n",
    })
    expect(workspaceGlobs(root)).toEqual(['apps/*', 'packages/*'])
    const npm = fixture({
      'package.json': { name: 'r', workspaces: ['libs/*', '!libs/x'] },
    })
    expect(workspaceGlobs(npm.root)).toEqual(['libs/*'])
    expect(workspaceGlobs(fixture({ 'a.txt': '' }).root)).toEqual([])
  })

  it('workspace-unlisted: só o código de produção do workspace; declarado em qualquer campo, nome próprio e ferramental de teste não contam', () => {
    const files: Record<string, string | object> = {
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/*'\n",
      'package.json': { name: 'raiz', dependencies: { zod: '4', three: '1' } },
      'packages/p/package.json': {
        name: '@f/p',
        dependencies: { decimal: '1' },
        devDependencies: { tipos: '1' },
        peerDependencies: { react: '*' },
        optionalDependencies: { opcional: '1' },
      },
      'packages/p/src/a.ts': [
        "import { z } from 'zod'",
        "import type { T } from 'tipos'",
        "import React from 'react'",
        "import D from 'decimal'",
        "import O from 'opcional'",
        "import { self } from '@f/p/interno'",
        "import { join } from 'node:path'",
        "import { local } from './b'",
        "import { alias } from '@/x'",
        "export { y } from 'reexportado'",
        "const dinamico = () => import('three')",
        "const cjs = require('commonjs')",
        "// import 'em-comentario'",
        'const texto = "from \'em-string\'"',
        "import { vi } from 'vitest'",
        'console.log(z, React, D, O, self, join, local, alias, dinamico, cjs, texto, vi)',
        'export type { T }',
      ].join('\n'),
      'packages/p/src/b.ts': 'export const local = 1\n',
      'packages/p/src/a.test.ts': "import 'nao-vale-em-teste'\n",
      'packages/p/src/a.stories.tsx': "import 'nao-vale-em-story'\n",
      'packages/p/vitest.config.ts': "import 'nao-vale-em-config'\n",
      'packages/p/tests/apoio.ts': "import 'nao-vale-em-pasta-de-teste'\n",
      // Pasta com package.json fora dos globs: o dono continua sendo packages/p, que declara `decimal`.
      'packages/p/sub/package.json': { name: '@f/sub' },
      'packages/p/sub/c.ts': "import 'decimal'\n",
      'apps/w/package.json': { name: '@f/w' },
      'apps/w/src/page.tsx': "import 'nunca-declarado'\nimport 'zod'\n",
      'fora/solto.ts': "import 'fora-de-workspace'\n",
    }
    const { root } = fixture(files)
    const list = Object.keys(files)
    const findings = workspaceUnlisted(root, {
      files: list,
      knipUnlisted: [
        // O knip já reporta o pacote que ninguém declara: o par não se repete.
        {
          type: 'unlisted',
          file: 'apps/w/src/page.tsx',
          name: 'nunca-declarado',
        },
      ],
    })
    expect(findings).toEqual([
      {
        type: 'workspace-unlisted',
        file: 'packages/p/src/a.ts',
        name: 'commonjs',
      },
      {
        type: 'workspace-unlisted',
        file: 'packages/p/src/a.ts',
        name: 'reexportado',
      },
      {
        type: 'workspace-unlisted',
        file: 'packages/p/src/a.ts',
        name: 'three',
      },
      { type: 'workspace-unlisted', file: 'packages/p/src/a.ts', name: 'zod' },
      { type: 'workspace-unlisted', file: 'apps/w/src/page.tsx', name: 'zod' },
    ])
    // Arquivo que o knip ignora não entra.
    expect(
      workspaceUnlisted(root, {
        files: list,
        ignored: (file) => file.startsWith('apps/'),
        knipUnlisted: [],
      }).map((finding) => finding.file)
    ).not.toContain('apps/w/src/page.tsx')
  })

  it('knip.jsonc: entrada por glob só para suíte de teste, story, variante .native e rota do expo-router', () => {
    const config = parseJsonc(
      fs.readFileSync(path.join(repoRoot, 'knip.jsonc'), 'utf8')
    )
    const allowed =
      /\.\{?test|\{test,spec\}|stories|\.native\.|^src\/app\/\*\*\/\*\.\{ts,tsx\}$/
    const globs = Object.entries(
      config.workspaces as Record<string, { entry?: string[] }>
    ).flatMap(([name, settings]) =>
      (settings.entry ?? [])
        .filter((pattern) => /[*?]/.test(pattern) && !allowed.test(pattern))
        .map((pattern) => `${name}: ${pattern}`)
    )
    expect(globs).toEqual([])
  })

  it('knip.jsonc: cada pacote cobra o export do próprio ponto de entrada e o project cobre o pacote inteiro, CSS inclusive', () => {
    const config = parseJsonc(
      fs.readFileSync(path.join(repoRoot, 'knip.jsonc'), 'utf8')
    )
    const packages = fs
      .readdirSync(path.join(repoRoot, 'packages'))
      .filter((name) =>
        fs.existsSync(path.join(repoRoot, 'packages', name, 'package.json'))
      )
    expect(packages.length).toBeGreaterThan(0)
    for (const name of packages) {
      const settings = config.workspaces[`packages/${name}`]
      expect(settings, name).toBeDefined()
      expect(settings.includeEntryExports, name).toBe(true)
      expect(settings.project, name).toEqual([
        '**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,css}',
      ])
    }
    for (const host of ['apps/clients/web', 'apps/clients/mobile'])
      expect(config.workspaces[host].project, host).toEqual([
        '**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,css}',
      ])
  })

  it('o gate roda no CI e pelo script pnpm hygiene', () => {
    const scripts: Record<string, string> = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ).scripts
    expect(scripts.hygiene).toBe('node tools/hygiene-check.mjs')
    const workflow = fs
      .readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8')
      .replace(/\r\n/g, '\n')
    expect(workflow).toMatch(/^\s+run: pnpm hygiene$/m)
  })

  it('a linha de base do repositório é válida e cada item traz motivo', () => {
    const { entries, problems } = readBaseline(
      fs.readFileSync(path.join(repoRoot, BASELINE_FILE), 'utf8')
    )
    expect(problems).toEqual([])
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries)
      expect(entry.reason.length).toBeGreaterThanOrEqual(12)
  })
})
