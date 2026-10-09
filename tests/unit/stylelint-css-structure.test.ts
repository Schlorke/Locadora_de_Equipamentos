import fs from 'node:fs'
import path from 'node:path'
import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'
import { layerNames, lineCount } from '../../tools/stylelint-css-structure.mjs'

/**
 * Trava do CSS do produto: .stylelintrc.json estrito (sem !important, sem propriedade desconhecida, desligamentos só
 * com motivo) e as regras do plugin tools/stylelint-css-structure.mjs (arquivo de estilo com até 300 linhas e sem a
 * camada overrides). `pnpm lint:css` roda no CI sobre todo .css de packages/ e apps/.
 */
const ROOT = path.resolve(import.meta.dirname, '../..')
const CONFIG_FILE = path.join(ROOT, '.stylelintrc.json')
const PLUGIN = path.join(ROOT, 'tools/stylelint-css-structure.mjs')
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))

/** Problemas (regra e linha) de um CSS lido como se estivesse em `file`, com a configuração do repositório. */
async function lintWithRepoConfig(code: string, file = 'packages/frontend/src/app/styles/probe.web.css') {
  const { results } = await stylelint.lint({ code, codeFilename: path.join(ROOT, file), configFile: CONFIG_FILE })
  const [result] = results
  return [...result!.warnings.map((w) => ({ rule: w.rule, line: w.line })), ...result!.invalidOptionWarnings.map((w) => ({ rule: 'invalid-option', line: 0, text: w.text }))]
}

/** Problemas de um CSS só com as regras do plugin. */
async function lintStructure(code: string, rules: Record<string, unknown>) {
  const { results } = await stylelint.lint({ code, config: { plugins: [PLUGIN], rules } })
  return results[0]!.warnings.map((w) => ({ rule: w.rule, line: w.line, text: w.text }))
}

const lines = (count: number) => Array.from({ length: count }, (_, i) => `.l${i} {}`).join('\n') + '\n'

describe('lineCount', () => {
  it('conta as linhas como o editor, sem a quebra final', () => {
    expect(lineCount('')).toBe(0)
    expect(lineCount('a')).toBe(1)
    expect(lineCount('a\n')).toBe(1)
    expect(lineCount('a\nb')).toBe(2)
    expect(lineCount('a\r\nb\r\n')).toBe(2)
    expect(lineCount('a\n\n')).toBe(2)
  })
})

describe('css-structure/max-lines', () => {
  it('300 linhas passam; a 301ª reprova, apontada na linha 301', async () => {
    expect(await lintStructure(lines(300), { 'css-structure/max-lines': 300 })).toEqual([])
    const problems = await lintStructure(lines(301), { 'css-structure/max-lines': 300 })
    expect(problems).toEqual([
      { rule: 'css-structure/max-lines', line: 301, text: 'Arquivo com 301 linhas (máximo 300): divida por responsabilidade (css-structure/max-lines)' },
    ])
  })
})

describe('css-structure/no-layer-names', () => {
  it('lê os nomes de @layer (lista e bloco) e do layer() de um @import', () => {
    const atRules = [
      { name: 'layer', params: 'a, b.c' },
      { name: 'layer', params: 'd' },
      { name: 'import', params: "'x.css' layer(e.f)" },
      { name: 'import', params: "'y.css'" },
      { name: 'media', params: 'print' },
    ]
    expect(atRules.map((atRule) => layerNames(atRule as never))).toEqual([['a', 'b.c'], ['d'], ['e.f'], [], []])
  })

  it('reprova overrides e suas sub-camadas em qualquer forma; as camadas do produto passam', async () => {
    const rules = { 'css-structure/no-layer-names': ['overrides'] }
    const code = [
      '@layer theme, base, components, utilities, legacy;',
      '@layer theme, base, components, utilities, overrides;',
      '@layer overrides.normal, overrides.forced;',
      '@layer overrides { .a { color: red; } }',
      '@layer overrides.forced { .b { color: red; } }',
      "@import 'x.css' layer(overrides);",
      '@layer components { .c { color: red; } }',
      '@layer base.overridesish { .d { color: red; } }',
    ].join('\n')
    const problems = await lintStructure(code, rules)
    expect(problems.map((p) => [p.line, p.text.match(/"([^"]+)"/)?.[1]])).toEqual([
      [2, 'overrides'],
      [3, 'overrides.normal'],
      [3, 'overrides.forced'],
      [4, 'overrides'],
      [5, 'overrides.forced'],
      [6, 'overrides'],
    ])
  })
})

describe('.stylelintrc.json', () => {
  it('é estrito: sem !important, sem exceção de propriedade, desligamentos só com motivo e no escopo certo', () => {
    expect(config.reportNeedlessDisables).toBe(true)
    expect(config.reportInvalidScopeDisables).toBe(true)
    expect(config.reportDescriptionlessDisables).toBe(true)
    expect(config.rules['declaration-no-important']).toBe(true)
    expect(config.rules['property-no-unknown']).toBe(true)
    expect(config.rules['css-structure/max-lines']).toBe(300)
    expect(config.rules['css-structure/no-layer-names']).toEqual(['overrides'])
    expect(config.plugins).toEqual(['./tools/stylelint-css-structure.mjs'])
    const [enabled, { ignoreAtRules }] = config.rules['at-rule-no-unknown']
    expect(enabled).toBe(true)
    expect([...ignoreAtRules].sort()).toEqual(['apply', 'config', 'custom-variant', 'layer', 'reference', 'source', 'theme', 'utility', 'variant'])
  })

  it('reprova !important (também em regra de movimento reduzido), propriedade desconhecida e desligamento sem motivo', async () => {
    const code = [
      '.a {',
      '  color: red !important;',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  .b {',
      '    opacity: 1 !important;',
      '  }',
      '}',
      '',
      '.c {',
      '  colour: red;',
      '}',
      '',
      '/* stylelint-disable-next-line color-named */',
      '.d {',
      '  color: blue;',
      '}',
      '',
    ].join('\n')
    const rules = (await lintWithRepoConfig(code)).map((p) => `${p.line} ${p.rule}`)
    expect(rules).toContain('2 declaration-no-important')
    expect(rules).toContain('7 declaration-no-important')
    expect(rules).toContain('12 property-no-unknown')
    expect(rules).toContain('15 --report-descriptionless-disables')
  })

  it('aceita as at-rules do Tailwind 4 usadas pelo produto', async () => {
    const code = [
      '@layer theme, base, components, utilities, legacy;',
      '',
      "@import 'tailwindcss';",
      '',
      "@config '../tailwind.config.cjs';",
      '',
      "@source '../../';",
      '',
      '@theme inline {',
      '  --color-field: var(--color-gray-200);',
      '}',
      '',
      '@custom-variant controls (&:is(button)[aria-controls]);',
      '',
      '@utility scrollbar-hide {',
      '  scrollbar-width: none;',
      '',
      '  &::-webkit-scrollbar {',
      '    display: none;',
      '  }',
      '}',
      '',
      '@layer base {',
      '  :where(select) {',
      '    @apply border-field focus:outline-2;',
      '  }',
      '}',
      '',
    ].join('\n')
    expect(await lintWithRepoConfig(code)).toEqual([])
  })
})

describe('pnpm lint:css', () => {
  it('passa o stylelint em todo .css de packages/ e apps/, sem aviso, e roda no CI', () => {
    const scripts: Record<string, string> = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts
    expect(scripts['lint:css']).toBe('stylelint "packages/**/*.css" "apps/**/*.css" --max-warnings 0')
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
    expect(workflow).toMatch(/^\s+run: pnpm lint:css\s*$/m)
  })

  it('o CSS do produto passa hoje (0 problemas)', async () => {
    const { results } = await stylelint.lint({ files: ['packages/**/*.css', 'apps/**/*.css'], cwd: ROOT, configFile: CONFIG_FILE })
    expect(results.length).toBeGreaterThan(10)
    const problems = results.flatMap((r) => r.warnings.map((w) => `${path.relative(ROOT, r.source ?? '')}:${w.line} ${w.text}`))
    expect(problems).toEqual([])
  })
})
