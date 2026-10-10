import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Perfil do cliente', () => {
  it('mantém o status pendente, a senha e a identidade visual', () => {
    const source = readFileSync(
      new URL('./PerfilPage.web.tsx', import.meta.url),
      'utf8'
    )
    const model = readFileSync(
      new URL('../model/use-profile.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('Perfil atualizado com sucesso!')
    expect(model).toContain('Erro ao atualizar perfil')
    expect(model).toContain(
      "useState<'pending' | 'verified' | 'error'>('pending')"
    )
    expect(source).toContain('Alterar Senha')
    expect(source).toContain('Atualize sua senha regularmente')
    expect(source).toContain('#f9fafb')
    expect(source).toContain('#1A2E4C')
    expect(source).toContain('#1a2e4c')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/perfil/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/perfil["']/
    )
    expect(webRoute).toContain('return <PerfilPage />')
  })
})
