import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Selo da área do cliente', () => {
  it('troca a variante só quando a rota começa com /area-cliente', () => {
    const hook = readFileSync(new URL('./variante.web.ts', import.meta.url), 'utf8')
    const badge = readFileSync(new URL('../ui/Selo.web.tsx', import.meta.url), 'utf8')
    expect(hook).toContain("pathname.startsWith('/area-cliente')")
    expect(hook).toContain("default: 'no-hover-default'")
    expect(hook).toContain("secondary: 'no-hover-secondary'")
    expect(hook).toContain("destructive: 'no-hover-destructive'")
    expect(hook).toContain("outline: 'no-hover-outline'")
    expect(hook).toContain('if (!isInClientArea)')
    expect(hook).toContain('return originalVariant')
    expect(badge).toContain("variant = 'default'")
    expect(badge).toContain('getBadgeVariant(variant)')
  })
})
