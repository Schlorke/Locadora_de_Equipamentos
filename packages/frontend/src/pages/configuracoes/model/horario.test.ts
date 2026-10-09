// Formulário do horário de funcionamento no painel (onda 134, B10): HH:MM, dia sem horário fica ausente, horário legado
// fora do formato é descartado ao carregar. O PUT continua aceitando o formato antigo (o app instalado salva igual).
import { describe, expect, it } from 'vitest'
import {
  DIAS_DO_HORARIO,
  copiarParaDiasUteis,
  horarioDoFormulario,
  horarioParaSalvar,
} from './horario'

// Locadora de teste com dias úteis, sábado reduzido e domingo fechado. A ida e volta do horário da GB está em
// tests/unit/gb-site-content.painel.test.ts.
const HORARIO = {
  monday: { open: '07:30', close: '17:30', closed: false },
  tuesday: { open: '07:30', close: '17:30', closed: false },
  wednesday: { open: '07:30', close: '17:30', closed: false },
  thursday: { open: '07:30', close: '17:30', closed: false },
  friday: { open: '07:30', close: '16:30', closed: false },
  saturday: { open: '08:00', close: '11:00', closed: false },
  sunday: { closed: true },
}

describe('horário de funcionamento', () => {
  it('ida e volta sem perda: o horário salvo volta igual', () => {
    const form = horarioDoFormulario(HORARIO)
    expect(form.monday).toEqual({
      fechado: false,
      abre: '07:30',
      fecha: '17:30',
    })
    expect(form.sunday).toEqual({ fechado: true, abre: '', fecha: '' })
    expect(horarioParaSalvar(form)).toEqual({ horario: HORARIO, erros: {} })
  })

  it('dia sem horário fica ausente; legado fora do formato é descartado ao carregar', () => {
    const form = horarioDoFormulario({
      monday: { closed: false, open: '8h', close: '18h' },
      tuesday: { closed: false, open: '09:00', close: '17:00' },
      friday: 'x',
    })
    expect(form.monday).toEqual({ fechado: false, abre: '', fecha: '' })
    expect(horarioParaSalvar(form).horario).toEqual({
      tuesday: { closed: false, open: '09:00', close: '17:00' },
    })
    expect(horarioParaSalvar(horarioDoFormulario(null)).horario).toEqual({})
  })

  it('valida HH:MM, abertura e fechamento juntos e o fechamento depois da abertura', () => {
    const form = horarioDoFormulario({})
    form.monday = { fechado: false, abre: '08:00', fecha: '' }
    form.tuesday = { fechado: false, abre: '25:00', fecha: '26:00' }
    form.wednesday = { fechado: false, abre: '18:00', fecha: '08:00' }
    // Abertura e fechamento iguais não são um horário: o fechamento precisa ser depois.
    form.thursday = { fechado: false, abre: '08:00', fecha: '08:00' }
    expect(horarioParaSalvar(form).erros).toEqual({
      monday: 'Informe a abertura e o fechamento.',
      tuesday: 'Use o formato HH:MM (00:00 a 23:59).',
      wednesday: 'O fechamento precisa ser depois da abertura.',
      thursday: 'O fechamento precisa ser depois da abertura.',
    })
  })

  it('copia um dia para os dias úteis, sem mexer no fim de semana', () => {
    const form = horarioDoFormulario({
      monday: { closed: false, open: '07:30', close: '17:30' },
      saturday: { closed: false, open: '08:00', close: '12:00' },
    })
    const copiado = copiarParaDiasUteis(form, 'monday')
    for (const dia of ['tuesday', 'wednesday', 'thursday', 'friday'] as const)
      expect(copiado[dia]).toEqual({
        fechado: false,
        abre: '07:30',
        fecha: '17:30',
      })
    expect(copiado.saturday).toEqual(form.saturday)
    expect(DIAS_DO_HORARIO.map((dia) => dia.rotulo)).toEqual([
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo',
    ])
  })
})
