import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Endereços do cliente', () => {
  it('mantém o CEP de 8 dígitos, as mensagens e a identidade visual', () => {
    const source = readFileSync(
      new URL('./EnderecosPage.web.tsx', import.meta.url),
      'utf8'
    )
    const model = readFileSync(
      new URL('../model/use-addresses.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('cleanCEP.length === 8')
    expect(model).toContain('Erro ao carregar endereços')
    expect(model).toContain('Endereço atualizado com sucesso!')
    expect(model).toContain('Endereço adicionado com sucesso!')
    expect(model).toContain('Endereço removido com sucesso!')
    expect(source).toContain('#f9fafb')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/enderecos/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/enderecos["']/
    )
    expect(webRoute).toContain('return <EnderecosPage />')
  })
})
