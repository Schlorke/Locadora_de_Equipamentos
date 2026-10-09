// @vitest-environment jsdom
// Horário de funcionamento no painel web (onda 134, B10): campos por dia, "Fechado", copiar para os dias úteis, o erro
// de cada dia e a prévia nas linhas que o site mostra.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { horarioDoFormulario } from '../model/horario'
import {
  HorarioDeFuncionamento,
  PreviaDoHorario,
} from './HorarioDeFuncionamento.web'

afterEach(cleanup)

it('edita a abertura, copia a segunda para os dias úteis e mostra o erro do dia', () => {
  const onChange = vi.fn()
  const horario = horarioDoFormulario({
    monday: { closed: false, open: '08:00', close: '18:00' },
  })
  render(
    <HorarioDeFuncionamento
      horario={horario}
      erros={{ tuesday: 'Informe a abertura e o fechamento.' }}
      onChange={onChange}
    />
  )
  fireEvent.change(screen.getByLabelText('Segunda-feira: abertura'), {
    target: { value: '07:00' },
  })
  expect(onChange.mock.calls[0]![0].monday).toEqual({
    fechado: false,
    abre: '07:00',
    fecha: '18:00',
  })
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Copiar segunda-feira para os dias úteis',
    })
  )
  expect(onChange.mock.calls[1]![0].friday).toEqual({
    fechado: false,
    abre: '08:00',
    fecha: '18:00',
  })
  expect(screen.getByRole('alert').textContent).toBe(
    'Informe a abertura e o fechamento.'
  )
})

it('prévia nas linhas do site; sem horário, o aviso de que o site não mostra horário', () => {
  const { rerender } = render(
    <PreviaDoHorario
      horario={horarioDoFormulario({
        monday: { closed: false, open: '08:00', close: '18:00' },
        tuesday: { closed: false, open: '08:00', close: '18:00' },
        wednesday: { closed: false, open: '08:00', close: '18:00' },
        thursday: { closed: false, open: '08:00', close: '18:00' },
        friday: { closed: false, open: '08:00', close: '18:00' },
        sunday: { closed: true },
      })}
    />
  )
  expect(screen.getByText('Segunda a Sexta: 8h às 18h')).toBeTruthy()
  rerender(<PreviaDoHorario horario={horarioDoFormulario({})} />)
  expect(
    screen.getByText('Sem horário informado: o site não mostra o horário.')
  ).toBeTruthy()
})
