import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato migração pages/area-cliente', () => {
  it('exporta AreaClientePage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain('export { AreaClientePage }')
    expect(index).toContain("from './ui/AreaClientePage'")
  })
})
