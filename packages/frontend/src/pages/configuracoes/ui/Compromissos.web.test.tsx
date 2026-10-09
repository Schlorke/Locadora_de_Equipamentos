// @vitest-environment jsdom
// "O que você garante aos clientes" (onda 134, B10; D-E): os 11 compromissos desligados por padrão, cada um com as
// frases exatas que publica, e a prévia do que o site promete hoje.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { COMPROMISSOS } from '../../../entities/configuracao'
import { conteudoDoFormulario } from '../model/conteudo-do-site'
import { Compromissos, PreviaDosCompromissos } from './Compromissos.web'

afterEach(cleanup)

it('11 interruptores desligados, cada um com as frases que publica; ligar avisa o formulário', () => {
  const onChange = vi.fn()
  const conteudo = conteudoDoFormulario({})
  render(
    <Compromissos conteudo={conteudo} cidade="Curitiba" onChange={onChange} />
  )
  const interruptores = screen.getAllByRole('switch')
  expect(interruptores).toHaveLength(11)
  for (const interruptor of interruptores)
    expect(interruptor.getAttribute('aria-checked')).toBe('false')
  expect(
    screen.getByText(/Código de Defesa do Consumidor \(art\. 30\)/)
  ).toBeTruthy()
  // O rótulo de cada interruptor é o texto do compromisso (alguns também são a própria frase publicada).
  for (const [chave, texto] of Object.entries(COMPROMISSOS))
    expect(
      document.querySelector(`label[for="compromisso-${chave}"]`)?.textContent,
      chave
    ).toBe(texto)
  // A frase que exige dois compromissos (regra E) aparece nos dois: entrega rápida e entrega no mesmo dia.
  expect(
    screen.getAllByText(
      'Entrega Rápida: Entrega no mesmo dia para região metropolitana de Curitiba'
    )
  ).toHaveLength(2)
  fireEvent.click(screen.getByLabelText(COMPROMISSOS.freeDelivery))
  expect(onChange.mock.calls[0]![0].commitments).toMatchObject({
    freeDelivery: true,
    support24h: false,
  })
})

it('prévia: sem compromisso, nenhuma promessa; com a entrega gratuita, as frases dela', () => {
  const vazio = conteudoDoFormulario({})
  const { rerender } = render(<PreviaDosCompromissos conteudo={vazio} />)
  expect(screen.getByText(/Nenhum compromisso ligado/)).toBeTruthy()
  rerender(
    <PreviaDosCompromissos
      conteudo={{
        ...vazio,
        commitments: { ...vazio.commitments, freeDelivery: true },
      }}
    />
  )
  expect(
    screen.getAllByRole('listitem').map((item) => item.textContent)
  ).toEqual(['Entrega Gratuita', 'Entrega e retirada'])
})
