import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { statusConfig } from './tipos.web'

// Achado 148: os selos usam os tokens semânticos de estado do design-tokens (tokens.css), não a paleta escrita como
// classe (`bg-blue-100` ou `bg-[var(--color-blue-100)]`, que a catraca tailwind-palette-class conta). Os tokens têm os
// mesmos valores dos tons da produção (100/800/200), então nada muda na tela.
const read = (file: string) =>
  readFileSync(
    new URL('../../../../../design-tokens/src/' + file, import.meta.url),
    'utf8'
  )
const valueOf = (css: string, name: string) =>
  new RegExp('\\n\\s*' + name + ':\\s*([^;]+);').exec(css)?.[1]?.trim()

it('badges usam os tokens semânticos de estado com os mesmos tons da paleta de produção', () => {
  const tokens = read('tokens.css')
  const palette = read('palette.css')
  const expected: Record<string, [string, string]> = {
    SCHEDULED: ['info', 'blue'],
    IN_PROGRESS: ['warning', 'yellow'],
    COMPLETED: ['success', 'green'],
    CANCELLED: ['danger', 'red'],
  }
  expect(Object.keys(statusConfig).sort()).toEqual(Object.keys(expected).sort())
  for (const [status, [role, tone]] of Object.entries(expected)) {
    const classes = statusConfig[status]!.color
    expect(classes, status).toBe(
      `bg-[var(--status-${role}-surface)] text-[var(--status-${role}-text)] border-[var(--status-${role}-border)]`
    )
    expect(classes, status).not.toMatch(
      /--color-|\b(?:bg|text|border)-[a-z]+-\d/
    )
    for (const [part, shade] of [
      ['surface', '100'],
      ['text', '800'],
      ['border', '200'],
    ] as const) {
      const token = valueOf(tokens, `--status-${role}-${part}`)
      expect(token, `--status-${role}-${part}`).toBeTruthy()
      expect(token, `--status-${role}-${part}`).toBe(
        valueOf(palette, `--color-${tone}-${shade}`)
      )
    }
  }
})
