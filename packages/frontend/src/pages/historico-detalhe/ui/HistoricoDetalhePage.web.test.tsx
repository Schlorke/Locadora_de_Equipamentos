import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Detalhe do histórico', () => {
  it('mantém a carga do orçamento, da locação e a extensão de 1 a 30 dias', () => {
    const source = readFileSync(
      new URL('./HistoricoDetalhePage.web.tsx', import.meta.url),
      'utf8'
    )
    const model = readFileSync(
      new URL('../model/use-rental-detail.ts', import.meta.url),
      'utf8'
    )
    expect(model).toContain('quoteApi.read(actualId)')
    expect(model).toContain('rentalApi.read(actualId)')
    expect(source.replace(/\s+/g, '')).toContain(
      'rentalApi.extend(rental.id,extensionDays)'
    )
    expect(source).toContain('Por favor, insira um número válido entre 1 e 30')
    expect(source).not.toContain('await fetch(')
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/historico/[id]/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/historico-detalhe["']/
    )
    expect(webRoute).toContain('return <RentalDetailsPage />')
  })
})
