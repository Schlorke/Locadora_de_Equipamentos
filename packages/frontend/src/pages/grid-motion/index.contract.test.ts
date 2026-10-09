import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato grid-motion', () => {
  it('exporta GridMotionPage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain(
      "export { GridMotionPage } from './ui/GridMotionPage'"
    )
  })
})
