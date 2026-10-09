import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carga de manutenção', () => {
  it('busca a agenda com atraso, pagina de 10 e começa na lista', () => {
    const source = readFileSync(new URL('./carga.ts', import.meta.url), 'utf8')
    expect(source).toContain('api.list()')
    expect(source).toContain('api.scheduled()')
    expect(source).toContain('Erro ao carregar manutenções')
    expect(source).toContain('Erro ao carregar manutenções agendadas')
    expect(source).toContain('Erro ao carregar manutenções. Tente novamente.')
    expect(source).toContain('const TABLE_PAGE_SIZE = 10')
    expect(source).toContain("useState<'list' | 'calendar'>('list')")
    expect(source).toContain("statusFilter === 'all'")
    expect(source).toContain("typeFilter === 'all'")
  })
})
