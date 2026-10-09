// Modo de autenticação do host web (achado 113 da revisão adversarial): a lista de modos e a validação vêm da regra
// única de @gb-locacoes/contracts/platform, a mesma do app mobile e do backend.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_MODES } from '@gb-locacoes/contracts/platform'

const rule = vi.hoisted(() => ({ parseAuthMode: vi.fn() }))

vi.mock('@gb-locacoes/contracts/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@gb-locacoes/contracts/platform')>()
  rule.parseAuthMode.mockImplementation(actual.parseAuthMode)
  return { ...actual, parseAuthMode: rule.parseAuthMode }
})

import { hostAuthMode, tenantAccountEnabled } from './mode'

beforeEach(() => {
  rule.parseAuthMode.mockClear()
})

describe('modo de autenticação do host web', () => {
  it('lê NEXT_PUBLIC_AUTH_MODE pelos modos do contrato; sem valor vale o legacy; valor desconhecido é recusado', () => {
    for (const mode of AUTH_MODES) expect(hostAuthMode({ NEXT_PUBLIC_AUTH_MODE: mode })).toBe(mode)
    expect(hostAuthMode({})).toBe('legacy')
    expect(hostAuthMode({ NEXT_PUBLIC_AUTH_MODE: '' })).toBe('legacy')
    expect(() => hostAuthMode({ NEXT_PUBLIC_AUTH_MODE: 'magic-link' })).toThrow('NEXT_PUBLIC_AUTH_MODE inválido.')
    // Só a variável do host web decide: a do app mobile não entra.
    expect(hostAuthMode({ EXPO_PUBLIC_AUTH_MODE: 'better-auth' })).toBe('legacy')
  })

  it('a validação é a do contrato, consultada com a variável do host web, não uma cópia', () => {
    // Resposta que uma validação repetida aqui não daria para esse valor.
    rule.parseAuthMode.mockReturnValueOnce('better-auth')
    expect(hostAuthMode({ NEXT_PUBLIC_AUTH_MODE: 'valor-que-so-o-contrato-conhece' })).toBe('better-auth')
    expect(rule.parseAuthMode).toHaveBeenCalledWith('valor-que-so-o-contrato-conhece', 'NEXT_PUBLIC_AUTH_MODE')
  })

  it('login e área do cliente no host de locadora só fora do legacy', () => {
    expect(tenantAccountEnabled({ NEXT_PUBLIC_AUTH_MODE: 'legacy' })).toBe(false)
    expect(tenantAccountEnabled({ NEXT_PUBLIC_AUTH_MODE: 'better-auth' })).toBe(true)
    expect(tenantAccountEnabled({ NEXT_PUBLIC_AUTH_MODE: 'better-auth-v2' })).toBe(true)
  })
})
