import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('contrato migração pages/enderecos', () => {
  it('exporta EnderecosPage pelo index público do slice', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(index).toContain('export { EnderecosPage }')
    expect(index).toMatch(/from ['"]\.\/ui\/EnderecosPage['"]/)
  })
})
