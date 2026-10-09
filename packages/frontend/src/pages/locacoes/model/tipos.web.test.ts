import { describe, expect, it } from 'vitest'
import { statusConfig } from './tipos.web'

describe('Configuração web de locação', () => {
  it('mantém Ativa e Aguardando Devolução', () => {
    expect(Object.values(statusConfig).map((status) => status.label)).toEqual([
      'Pendente',
      'Ativa',
      'Concluída',
      'Cancelada',
      'Atrasada',
      'Aguardando Devolução',
    ])
    expect(statusConfig.PENDING?.gradient).toBe('from-orange-400 to-orange-500')
    expect(statusConfig.PENDING_RETURN?.gradient).toBe(
      'from-purple-400 to-pink-500'
    )
  })
})
