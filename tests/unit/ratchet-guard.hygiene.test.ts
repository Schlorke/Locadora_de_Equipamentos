import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseJsonc } from '../../tools/hygiene-check.mjs'
import {
  HYGIENE_BASELINE,
  HYGIENE_CONFIG,
  hygieneNarrowing,
  runGuard,
} from '../../tools/ratchet-guard.mjs'

/**
 * O gate de higiene (pnpm hygiene) ancorado na base pelo ratchet-guard: a linha de base (tools/hygiene-baseline.json)
 * não ganha item e o knip.jsonc não ganha exceção nem perde escopo sem aprovação com motivo.
 */
const baseline = (entries: object[]) => JSON.stringify({ entries })
const knip = (body: string) =>
  `{\n  // comentário com "aspas" e // barras\n${body}\n}\n`
const BASE_CONFIG = knip(
  '  "ignore": ["tests/fixtures/**"],\n  "workspaces": {\n    ".": { "entry": ["tools/**/*.mjs"], "project": ["**/*.ts"], "ignoreDependencies": ["a"] },\n  },'
)
const BASE_BASELINE = baseline([
  { type: 'files', path: 'lib/velho.ts', reason: 'espera decisão do dono' },
  {
    type: 'exports',
    path: 'lib/api.ts',
    names: ['x', 'y'],
    reason: 'espera decisão do dono',
  },
])
const texts = (tree: { config?: string; baseline?: string }) => ({
  baseConfigText: BASE_CONFIG,
  baseBaselineText: BASE_BASELINE,
  treeConfigText: tree.config ?? BASE_CONFIG,
  treeBaselineText: tree.baseline ?? BASE_BASELINE,
})

describe('hygieneNarrowing', () => {
  it('lê JSONC com comentários, aspas e vírgula final', () => {
    expect(parseJsonc(BASE_CONFIG).workspaces['.'].ignoreDependencies).toEqual([
      'a',
    ])
  })

  it('aceita a linha de base que encolhe e a configuração igual', () => {
    expect(
      hygieneNarrowing(
        texts({
          baseline: baseline([
            {
              type: 'exports',
              path: 'lib/api.ts',
              names: ['x'],
              reason: 'espera decisão do dono',
            },
          ]),
        })
      )
    ).toEqual([])
  })

  it('barra item novo na linha de base, também um nome novo num item que já existe', () => {
    const problems = hygieneNarrowing(
      texts({
        baseline: baseline([
          {
            type: 'files',
            path: 'lib/velho.ts',
            reason: 'espera decisão do dono',
          },
          {
            type: 'files',
            path: 'lib/novo.ts',
            reason: 'espera decisão do dono',
          },
          {
            type: 'exports',
            path: 'lib/api.ts',
            names: ['x', 'y', 'z'],
            reason: 'espera decisão do dono',
          },
        ]),
      })
    )
    expect(problems).toHaveLength(2)
    expect(problems.join('\n')).toContain('"path":"lib/novo.ts"')
    expect(problems.join('\n')).toContain('"name":"z"')
  })

  it('barra exceção nova, escopo a menos e regra mudada no knip.jsonc', () => {
    const problems = hygieneNarrowing(
      texts({
        config: knip(
          '  "ignore": ["tests/fixtures/**", "lib/**"],\n  "ignoreExportsUsedInFile": true,\n  "workspaces": {\n    ".": { "entry": ["tools/**/*.mjs", "lib/morto.ts"], "project": [], "ignoreDependencies": ["a", "b"] }\n  }'
        ),
      })
    )
    expect(problems.join('\n')).toMatch(
      /\(top-level\) ignore gains "lib\/\*\*"/
    )
    expect(problems.join('\n')).toMatch(/\. entry gains "lib\/morto\.ts"/)
    expect(problems.join('\n')).toMatch(/\. ignoreDependencies gains "b"/)
    expect(problems.join('\n')).toMatch(
      /\. project no longer covers "\*\*\/\*\.ts"/
    )
    expect(problems.join('\n')).toMatch(
      /ignoreExportsUsedInFile differs from the base/
    )
    expect(problems).toHaveLength(5)
  })

  it('barra negação nova em project, que mantém os valores da base e ainda tira pastas da análise', () => {
    const problems = hygieneNarrowing(
      texts({
        config: knip(
          '  "ignore": ["tests/fixtures/**"],\n  "workspaces": {\n    ".": { "entry": ["tools/**/*.mjs"], "project": ["**/*.ts", "!lib/**", "!packages/**", "src/**/*.css"], "ignoreDependencies": ["a"] },\n    "packages/frontend": { "project": ["src/**/*.{ts,tsx}", "!src/shared/**"] }\n  }'
        ),
      })
    )
    expect(problems.join('\n')).toMatch(/\. project gains "!lib\/\*\*"/)
    expect(problems.join('\n')).toMatch(/\. project gains "!packages\/\*\*"/)
    expect(problems.join('\n')).toMatch(
      /packages\/frontend project gains "!src\/shared\/\*\*"/
    )
    // Valor positivo novo só amplia a análise: não é estreitamento.
    expect(problems.join('\n')).not.toContain('src/**/*.css')
    expect(problems).toHaveLength(3)
  })

  it('negação que a base já tinha em project não é estreitamento', () => {
    const base = knip(
      '  "workspaces": {\n    ".": { "project": ["**/*.ts", "!lib/**"] }\n  }'
    )
    expect(
      hygieneNarrowing({
        baseConfigText: base,
        treeConfigText: base,
        baseBaselineText: BASE_BASELINE,
        treeBaselineText: BASE_BASELINE,
      })
    ).toEqual([])
  })

  it('barra workspace que deixa de ser configurado', () => {
    expect(
      hygieneNarrowing(
        texts({ config: knip('  "ignore": ["tests/fixtures/**"]') })
      )
    ).toEqual([expect.stringContaining('no longer configures the workspace .')])
  })

  it('aprovação com motivo cobre o item e fica registrada', () => {
    const approved: object[] = []
    const item = { type: 'files', path: 'lib/novo.ts' }
    const problems = hygieneNarrowing(
      texts({
        baseline: baseline([
          {
            type: 'files',
            path: 'lib/velho.ts',
            reason: 'espera decisão do dono',
          },
          { ...item, reason: 'espera decisão do dono' },
        ]),
      }),
      [
        {
          approve: 'hygiene.baseline',
          entry: item,
          reason: 'decisão registrada no ADR',
        },
      ],
      approved
    )
    expect(problems).toEqual([])
    expect(approved).toEqual([
      {
        label: 'hygiene.baseline',
        entry: item,
        verb: 'gains',
        reason: 'decisão registrada no ADR',
      },
    ])
  })

  it('base sem o gate: a mudança o introduz sem comparação', () => {
    expect(
      hygieneNarrowing({
        baseConfigText: null,
        baseBaselineText: null,
        treeConfigText: BASE_CONFIG,
        treeBaselineText: BASE_BASELINE,
      })
    ).toEqual([])
  })
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

describe('runGuard com o gate de higiene', () => {
  it('reprova a mudança que aumenta a linha de base de higiene e passa quando ela encolhe', () => {
    const root = fs.mkdtempSync(
      path.join(path.resolve(os.tmpdir()), 'locadora-ratchet-hygiene-')
    )
    roots.push(root)
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
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { cwd: root, env, encoding: 'utf8' }
      ).trim()
    const write = (file: string, body: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), body)
    }
    write('package.json', '{ "name": "fixture" }\n')
    write(HYGIENE_CONFIG, BASE_CONFIG)
    write(HYGIENE_BASELINE, BASE_BASELINE)
    git('init', '-q', '-b', 'main')
    if (
      path.resolve(git('rev-parse', '--show-toplevel')) !== path.resolve(root)
    )
      throw new Error('Fixture is not its own repository')
    git('add', '-A')
    git('commit', '-q', '-m', 'base')

    write(
      HYGIENE_BASELINE,
      baseline([
        ...JSON.parse(BASE_BASELINE).entries,
        {
          type: 'files',
          path: 'lib/novo.ts',
          reason: 'espera decisão do dono',
        },
      ])
    )
    const raised = runGuard(root, { baseRef: 'HEAD' })
    expect(raised.ok, raised.lines.join('\n')).toBe(false)
    expect(raised.lines.join('\n')).toContain(`${HYGIENE_BASELINE} gains`)

    write(
      HYGIENE_BASELINE,
      baseline([
        {
          type: 'files',
          path: 'lib/velho.ts',
          reason: 'espera decisão do dono',
        },
      ])
    )
    const shrunk = runGuard(root, { baseRef: 'HEAD' })
    expect(shrunk.ok, shrunk.lines.join('\n')).toBe(true)
  })
})
