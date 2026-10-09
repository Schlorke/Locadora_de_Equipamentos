// Marca da locadora (achados 142 e 143): sigla e rodapé das telas de acesso só com o nome do cartão da própria
// locadora. O módulo é de servidor (sem 'use client'): a página de pausa do host web é Server Component e chama a
// sigla no servidor; uma função de módulo de cliente chamada ali quebra a página com 500 (visto na prova HTTP).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  copyrightDaLocadora,
  marcaDoAcesso,
  siglaDaLocadora,
  type IdentidadePublica,
} from './marca'

const here = dirname(fileURLToPath(import.meta.url))
const LOCADORA: IdentidadePublica = {
  nome: 'Locadora Alfa',
  cidade: 'Curitiba',
  uf: 'PR',
  logoUrl: null,
}

describe('marca da locadora', () => {
  it.each([
    ['GB Locações', 'GB'],
    ['Locadora Alfa', 'LA'],
    ['abc', 'ABC'],
    ['Construtora', 'C'],
    ['  ', ''],
  ])('sigla de %s: %s', (nome, sigla) => {
    expect(siglaDaLocadora(nome)).toBe(sigla)
  })

  it('marca das telas de acesso: sigla e rodapé da locadora; sem ela, só o nome do sistema', () => {
    expect(marcaDoAcesso(LOCADORA)).toEqual({
      sigla: 'LA',
      rodape: '© 2024 Locadora Alfa - Sistema de Acesso',
    })
    expect(marcaDoAcesso(null)).toEqual({
      sigla: '',
      rodape: 'Sistema de Acesso',
    })
  })

  it('a sigla que o índice da entidade exporta vem deste módulo, que não é de cliente', () => {
    const source = readFileSync(join(here, 'marca.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*['"]use client['"]/m)
    const index = readFileSync(join(here, '..', 'index.ts'), 'utf8')
    expect(index).toMatch(
      /export \{ copyrightDaLocadora, siglaDaLocadora \} from "\.\/model\/marca"/
    )
  })

  it('copyright do rodapé: o ano do modelo de site e o nome da própria locadora; sem nome, sem marca', () => {
    expect(copyrightDaLocadora('Locadora Alfa')).toBe(
      '© 2024 Locadora Alfa. Todos os direitos reservados.'
    )
    // A GB vê o mesmo texto que o rodapé mostrava antes (o nome vem do cartão dela, não do código).
    expect(copyrightDaLocadora(' GB Locações ')).toBe(
      '© 2024 GB Locações. Todos os direitos reservados.'
    )
    for (const vazio of [null, undefined, '', '  '])
      expect(copyrightDaLocadora(vazio)).toBe('Todos os direitos reservados.')
  })
})
