import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Carregamento das rotas de orçamento', () => {
  it('mantém o spinner da listagem separado do texto do detalhe', () => {
    const lista = readFileSync(
      new URL('./CarregandoLista.web.tsx', import.meta.url),
      'utf8'
    )
    const detalhe = readFileSync(
      new URL('./CarregandoDetalhe.web.tsx', import.meta.url),
      'utf8'
    )
    expect(lista.startsWith("'use client'")).toBe(true)
    expect(lista).toContain('h-screen w-full overflow-hidden')
    expect(lista).toContain('border-2 border-blue-600 border-t-transparent')
    expect(lista).toContain('duration: 1')
    expect(lista).toContain("ease: 'linear'")
    expect(lista).toContain('repeat: Number.POSITIVE_INFINITY')
    expect(lista).toContain("from 'framer-motion'")
    expect(detalhe).not.toContain("'use client'")
    expect(detalhe).not.toContain('framer-motion')
    expect(detalhe).toContain('Carregando orçamento...')
    expect(detalhe).toContain('w-12 h-12 text-blue-600 animate-spin')
    expect(detalhe).not.toContain('border-blue-600')
  })
})
