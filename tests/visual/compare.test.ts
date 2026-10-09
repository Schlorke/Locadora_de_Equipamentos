import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyApprovals,
  compareDirectories,
  diffCaptureFiles,
  readApprovals,
} from '../../tools/visual-baseline/compare.mjs'
import {
  listCaptureFiles,
  readCaptureFile,
  writeCaptureFile,
} from '../../tools/visual-baseline/format.mjs'

type Style = Record<string, string>
type Element = [string, string, Style]

const here = path.dirname(fileURLToPath(import.meta.url))
const tool = path.resolve(
  here,
  '..',
  '..',
  'tools',
  'visual-baseline',
  'compare.mjs'
)
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-compare-'))
  roots.push(dir)
  return dir
}

const button: Element = [
  'body:1>button:1',
  'Salvar',
  { color: 'rgb(255, 255, 255)', 'background-color': 'rgb(51, 65, 85)' },
]
const title: Element = ['body:1>h1:1', 'Título', { 'font-size': '24px' }]
const file = (captures: Record<string, unknown>) => ({
  version: 1,
  scenario: 'vitrine/home',
  viewport: '390',
  url: 'http://loc-a.localhost:3100/',
  unmappedApis: [],
  unstableWaits: 0,
  captures,
})
const baseline = () =>
  file({
    base: { kind: 'full', elements: [button, title] },
    'estado:hover': {
      kind: 'delta',
      of: 'base',
      changed: [
        [
          button[0],
          button[1],
          { ...button[2], 'background-color': 'rgb(30, 41, 59)' },
        ],
      ],
      removed: [],
    },
  })

describe('diffCaptureFiles', () => {
  it('equal captures have no difference', () => {
    expect(
      diffCaptureFiles('390/vitrine/home', baseline(), baseline())
    ).toEqual([])
  })

  it('names the capture, element, property and both values', () => {
    const current = baseline()
    ;(current.captures.base as { elements: Element[] }).elements = [
      [button[0], button[1], { ...button[2], color: 'rgb(0, 0, 0)' }],
      title,
    ]
    expect(diffCaptureFiles('390/vitrine/home', baseline(), current)).toEqual([
      {
        capture: '390/vitrine/home',
        section: 'base',
        element: 'body:1>button:1',
        label: 'Salvar',
        property: 'color',
        baseline: 'rgb(255, 255, 255)',
        current: 'rgb(0, 0, 0)',
      },
    ])
  })

  it('a property that appears or disappears, and elements added or removed, are differences', () => {
    const current = baseline()
    ;(current.captures.base as { elements: Element[] }).elements = [
      [button[0], button[1], { color: button[2].color! }],
      ['body:1>p:1', 'Novo', { color: 'rgb(0, 0, 0)' }],
    ]
    const diffs = diffCaptureFiles('390/vitrine/home', baseline(), current).map(
      (d) => `${d.element} ${d.property}: ${d.baseline} → ${d.current}`
    )
    expect(diffs).toEqual([
      'body:1>button:1 background-color: rgb(51, 65, 85) → (ausente)',
      'body:1>h1:1 *: elemento presente → elemento ausente',
      'body:1>p:1 *: elemento ausente → elemento presente',
    ])
  })

  it('states compare their changes, their removals and their presence', () => {
    const current = baseline()
    current.captures['estado:hover'] = {
      kind: 'delta',
      of: 'base',
      changed: [],
      removed: ['body:1>h1:1'],
    }
    current.captures['estado:foco'] = {
      kind: 'delta',
      of: 'base',
      changed: [],
      removed: [],
    }
    const diffs = diffCaptureFiles('390/vitrine/home', baseline(), current).map(
      (d) =>
        `${d.section} ${d.element} ${d.property}: ${d.baseline} → ${d.current}`
    )
    expect(diffs).toEqual([
      'estado:foco * *: captura ausente → captura presente',
      'estado:hover body:1>button:1 *: elemento presente → elemento ausente',
      'estado:hover body:1>h1:1 *: permanece no estado → some no estado',
    ])
  })
})

describe('approvals', () => {
  const diff = {
    capture: '390/vitrine/home',
    section: 'base',
    element: 'body:1>button:1',
    label: 'Salvar',
    property: 'color',
    baseline: 'rgb(255, 255, 255)',
    current: 'rgb(0, 0, 0)',
  }

  it('an approval matches exactly or by wildcard/prefix, and its values must match when given', () => {
    const exact = {
      capture: '390/vitrine/home',
      section: 'base',
      element: 'body:1>button:1',
      property: 'color',
      current: 'rgb(0, 0, 0)',
      reason: 'botão escurecido pelo token novo',
    }
    expect(applyApprovals([diff], [exact]).pending).toEqual([])
    const prefix = {
      capture: '*',
      section: '*',
      element: 'body:1>*',
      property: 'color',
      reason: 'cor de texto do corpo aprovada',
    }
    expect(applyApprovals([diff], [prefix]).approved).toHaveLength(1)
    const otherValue = { ...exact, current: 'rgb(1, 1, 1)' }
    const result = applyApprovals([diff], [otherValue])
    expect(result.pending).toEqual([diff])
    expect(result.unused).toEqual([otherValue])
  })

  it('entries without a reason or without the four targets are rejected', () => {
    const { approvals, problems } = readApprovals(
      JSON.stringify({
        changes: [
          {
            capture: '*',
            section: '*',
            element: '*',
            property: '*',
            reason: 'curto',
          },
          { capture: '*', reason: 'motivo suficiente' },
        ],
      })
    )
    expect(approvals).toEqual([])
    expect(problems).toHaveLength(2)
    expect(readApprovals('{').problems[0]).toMatch(/JSON inválido/)
  })

  it('the versioned approval file is valid and every approval pins exact values', () => {
    const { approvals, problems } = readApprovals(
      fs.readFileSync(path.join(here, 'approved-changes.json'), 'utf8')
    )
    expect(problems).toEqual([])
    for (const approval of approvals) {
      expect(approval.baseline, JSON.stringify(approval)).toBeTypeOf('string')
      expect(approval.current, JSON.stringify(approval)).toBeTypeOf('string')
    }
  })
})

describe('capture files and directories', () => {
  it.each(['baseline', 'current'] as const)(
    'rejects an empty or missing %s directory',
    (emptySide) => {
      const base = tempDir()
      const current = tempDir()
      const populated = emptySide === 'baseline' ? current : base
      writeCaptureFile(
        path.join(populated, '390', 'vitrine', 'home.json'),
        baseline()
      )
      const empty = emptySide === 'baseline' ? base : current
      expect(() => compareDirectories(base, current)).toThrow(/sem capturas/)
      fs.rmdirSync(empty)
      expect(() => compareDirectories(base, current)).toThrow(/sem capturas/)
    }
  )

  it('rejects two empty or missing directories through the CLI', () => {
    const base = tempDir()
    const current = tempDir()
    const approved = path.join(tempDir(), 'approved.json')
    fs.writeFileSync(approved, JSON.stringify({ changes: [] }))
    const run = () =>
      spawnSync(
        process.execPath,
        [
          tool,
          '--baseline',
          base,
          '--current',
          current,
          '--approved',
          approved,
        ],
        { encoding: 'utf8' }
      )
    expect(() => compareDirectories(base, current)).toThrow(/sem capturas/)
    const empty = run()
    expect(empty.status).toBe(1)
    expect(empty.stderr).toContain('sem capturas')
    fs.rmdirSync(base)
    fs.rmdirSync(current)
    const missing = run()
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('sem capturas')
  })

  it('round-trips through the style table, one line per element', () => {
    const dir = tempDir()
    const target = path.join(dir, '390', 'vitrine', 'home.json')
    const data = baseline()
    const subtitle: Element = [
      'body:1>h2:1',
      'Subtítulo',
      { 'font-size': '24px' },
    ]
    ;(data.captures.base as { elements: Element[] }).elements.push(subtitle)
    writeCaptureFile(target, data)
    const text = fs.readFileSync(target, 'utf8')
    // Estilos repetidos (título e subtítulo) viram uma entrada só da tabela.
    expect(text.match(/"font-size":"24px"/g)).toHaveLength(1)
    expect(text).toContain('        ["body:1>button:1","Salvar",0]')
    expect(text).toContain('        ["body:1>h1:1","Título",1],')
    expect(text).toContain('        ["body:1>h2:1","Subtítulo",1]')
    expect(readCaptureFile(target)).toEqual(data)
    expect(listCaptureFiles(dir)).toEqual({ '390/vitrine/home': target })
  })

  it('a missing file is a difference; the CLI exits 1 on differences and 0 when equal', () => {
    const base = tempDir()
    const current = tempDir()
    const approved = path.join(tempDir(), 'approved.json')
    fs.writeFileSync(approved, JSON.stringify({ changes: [] }))
    writeCaptureFile(path.join(base, '390', 'vitrine', 'home.json'), baseline())
    writeCaptureFile(
      path.join(base, '1440', 'vitrine', 'home.json'),
      baseline()
    )
    writeCaptureFile(
      path.join(current, '390', 'vitrine', 'home.json'),
      baseline()
    )
    expect(
      compareDirectories(base, current).diffs.map(
        (d: { capture: string; current: string }) => `${d.capture} ${d.current}`
      )
    ).toEqual(['1440/vitrine/home arquivo ausente'])
    const run = (...args: string[]) =>
      spawnSync(
        process.execPath,
        [
          tool,
          '--baseline',
          base,
          '--current',
          current,
          '--approved',
          approved,
          ...args,
        ],
        { encoding: 'utf8' }
      )
    const failing = run()
    expect(failing.status).toBe(1)
    expect(failing.stdout).toContain('1 diferença(s) não aprovada(s)')
    writeCaptureFile(
      path.join(current, '1440', 'vitrine', 'home.json'),
      baseline()
    )
    const passing = run()
    expect(passing.status).toBe(0)
    expect(passing.stdout).toContain('nenhuma diferença não aprovada')
  })

  it('--write-baseline rejects a partial capture before changing any baseline bytes', () => {
    const base = tempDir()
    const current = tempDir()
    const existing = path.join(base, '390', 'labs', 'antigo.json')
    writeCaptureFile(existing, baseline())
    const original = fs.readFileSync(existing)
    writeCaptureFile(
      path.join(current, '390', 'vitrine', 'home.json'),
      baseline()
    )
    const result = spawnSync(
      process.execPath,
      [tool, '--baseline', base, '--current', current, '--write-baseline'],
      { encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('captura parcial')
    expect(result.stderr).toContain('390/labs/antigo')
    expect(Object.keys(listCaptureFiles(base))).toEqual(['390/labs/antigo'])
    expect(fs.readFileSync(existing)).toEqual(original)
  })

  it('--write-baseline rejects an empty capture and leaves the reference intact', () => {
    const base = tempDir()
    const current = tempDir()
    const existing = path.join(base, '390', 'vitrine', 'home.json')
    writeCaptureFile(existing, baseline())
    const original = fs.readFileSync(existing)
    const result = spawnSync(
      process.execPath,
      [tool, '--baseline', base, '--current', current, '--write-baseline'],
      { encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('não tem capturas')
    expect(fs.readFileSync(existing)).toEqual(original)
  })

  it('--write-baseline validates every current file before writing any file', () => {
    const base = tempDir()
    const current = tempDir()
    const existing = path.join(base, '390', 'vitrine', 'home.json')
    writeCaptureFile(existing, baseline())
    const original = fs.readFileSync(existing)
    const changed = baseline()
    ;(changed.captures.base as { elements: Element[] }).elements = [title]
    writeCaptureFile(path.join(current, '390', 'vitrine', 'home.json'), changed)
    fs.writeFileSync(path.join(current, 'invalid.json'), '{')
    const result = spawnSync(
      process.execPath,
      [tool, '--baseline', base, '--current', current, '--write-baseline'],
      { encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(fs.readFileSync(existing)).toEqual(original)
    expect(Object.keys(listCaptureFiles(base))).toEqual(['390/vitrine/home'])
  })

  it('rejects a JSON file without captured states rather than comparing zero elements', () => {
    const base = tempDir()
    const current = tempDir()
    for (const dir of [base, current])
      writeCaptureFile(path.join(dir, '390/home.json'), file({}))
    expect(() => compareDirectories(base, current)).toThrow(
      'arquivo sem capturas'
    )
  })

  it('--write-baseline rejects missing states in an existing file and preserves the old bytes', () => {
    const base = tempDir()
    const current = tempDir()
    const target = path.join(base, '390/home.json')
    writeCaptureFile(target, baseline())
    const before = fs.readFileSync(target)
    writeCaptureFile(
      path.join(current, '390/home.json'),
      file({ base: { kind: 'full', elements: [button, title] } })
    )
    const result = spawnSync(
      process.execPath,
      [tool, '--baseline', base, '--current', current, '--write-baseline'],
      { encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('faltam estados')
    expect(fs.readFileSync(target)).toEqual(before)
  })

  it('--write-baseline creates a nonempty reference and later preserves files while adding legitimate captures', () => {
    const base = path.join(tempDir(), 'baseline')
    const current = tempDir()
    const first = path.join(current, '390', 'vitrine', 'home.json')
    writeCaptureFile(first, baseline())
    const run = () =>
      spawnSync(
        process.execPath,
        [tool, '--baseline', base, '--current', current, '--write-baseline'],
        { encoding: 'utf8' }
      )
    expect(run().status).toBe(0)
    expect(
      fs.readFileSync(path.join(base, '390', 'vitrine', 'home.json'))
    ).toEqual(fs.readFileSync(first))
    const changed = baseline()
    changed.captures['estado:novo'] = {
      kind: 'delta',
      of: 'base',
      changed: [],
      removed: [],
    }
    writeCaptureFile(first, changed)
    const added = path.join(current, '1440', 'vitrine', 'home.json')
    writeCaptureFile(added, baseline())
    expect(run().status).toBe(0)
    expect(Object.keys(listCaptureFiles(base))).toEqual([
      '1440/vitrine/home',
      '390/vitrine/home',
    ])
    expect(
      fs.readFileSync(path.join(base, '390', 'vitrine', 'home.json'))
    ).toEqual(fs.readFileSync(first))
    expect(
      fs.readFileSync(path.join(base, '1440', 'vitrine', 'home.json'))
    ).toEqual(fs.readFileSync(added))
  })
})
