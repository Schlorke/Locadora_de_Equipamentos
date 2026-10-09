// @vitest-environment jsdom
// Erro de validação do formulário de orçamento: o campo com erro é marcado com aria-invalid, o estado de erro da
// moldura dos campos (borda e halo vermelhos dos tokens). Uma classe solta (border-red-500) era apagada pela moldura.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import QuoteForm from './QuoteForm.web'

afterEach(cleanup)

describe('QuoteForm (web): campo em erro de validação', () => {
  it('ao avançar com a etapa 1 inválida, nome, telefone e e-mail ficam aria-invalid; campo válido não', async () => {
    render(<QuoteForm />)
    const name = screen.getByPlaceholderText('Seu nome completo')
    const phone = screen.getByPlaceholderText('(51) 99999-9999')
    const email = screen.getByPlaceholderText('seu@email.com')
    const company = screen.getByPlaceholderText('Nome da sua empresa')
    for (const field of [name, phone, email])
      expect(field.getAttribute('aria-invalid'), field.id).not.toBe('true')

    fireEvent.change(email, { target: { value: 'sem-arroba' } })
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))

    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    for (const field of [name, phone, email]) {
      expect(field.getAttribute('aria-invalid'), field.id).toBe('true')
      // O estado de erro é o da moldura (aria-invalid:border-field-invalid), nunca a classe solta que ela apagava.
      expect(field.className, field.id).toContain(
        'aria-invalid:border-field-invalid'
      )
      expect(field.className, field.id).not.toContain('border-red-500')
    }
    expect(company.getAttribute('aria-invalid')).not.toBe('true')
    expect(screen.getByText('Digite um email válido')).toBeTruthy()
  })
})

// Veio de app/providers/orfaos-295b.web.test.tsx quando os órfãos daquela fatia saíram do pacote.
describe('QuoteForm (web): WhatsApp', () => {
  // Achado 143: o WhatsApp é o da própria locadora (comportamento em use-quote-form.whatsapp.test.tsx); o teste
  // anterior afirmava o número fixo da GB.
  it('usa o WhatsApp da locadora e a conversão do formulário', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../model/use-quote-form.ts'
      ),
      'utf8'
    )
    expect(source).toContain('openWhatsAppQuote(whatsappData, whatsapp)')
    expect(source).not.toMatch(/555198205163|5551998205163|GB Loca/)
    expect(source).toContain('convertFormDataToWhatsApp')
  })

  // Segunda rodada do achado 143: no navegador o WhatsApp precisa estar lido antes do clique (o bloqueador de pop-ups
  // descarta a janela aberta depois de esperar a rede); o app lê no clique.
  it('o formulário web lê o WhatsApp ao montar; o do app, no clique', () => {
    const ler = (arquivo: string) =>
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), arquivo),
        'utf8'
      )
    expect(ler('./QuoteForm.web.tsx')).toContain('useWhatsAppCarregado()')
    expect(ler('./QuoteForm.web.tsx')).not.toContain('useWhatsAppNoClique')
    expect(ler('./QuoteForm.native.tsx')).toContain(
      'useQuoteForm(props, useWhatsAppNoClique())'
    )
  })
})
