import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carga de logística', () => {
  it('mantém as APIs e as mensagens de entrega e status', () => {
    const source = readFileSync(new URL('./carga.ts', import.meta.url), 'utf8')
    expect(source).toContain('api.deliveries()')
    expect(source).toContain('api.vehicles()')
    expect(source).toContain('api.drivers()')
    expect(source).toContain('saveApi.update(')
    expect(source).toContain('Entrega/coleta atualizada com sucesso')
    expect(source).toContain('Erro ao atualizar entrega/coleta')
    expect(source).toContain('Status atualizado com sucesso')
    expect(source).toContain('Erro ao atualizar status')
  })
})
