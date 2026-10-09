// Painel com os dados da GB (onda 134, lote vitrine-conteudo, B10): o que o script grava (tools/gb-site-content.mjs e
// tools/gb-site-settings.mjs) abre no formulário do painel e volta igual ao salvar, sem perda: horário, conteúdo do
// site (com a frota que o dono preencher; D-B) e os três textos legais. Os testes colocados do painel usam uma locadora
// de teste; aqui fica a GB, porque os dados da GB moram em tools/ (fora dos pacotes).
import { describe, expect, it } from 'vitest'
import {
  GB_LEGAL_DOCUMENTS,
  GB_SITE_CONTENT,
} from '../../tools/gb-site-content.mjs'
import { GB_BUSINESS_HOURS } from '../../tools/gb-site-settings.mjs'
import {
  horarioDoFormulario,
  horarioParaSalvar,
} from '../../packages/frontend/src/pages/configuracoes/model/horario'
import {
  conteudoDoFormulario,
  conteudoParaSalvar,
} from '../../packages/frontend/src/pages/configuracoes/model/conteudo-do-site'
import {
  documentoDoFormulario,
  formularioDoDocumento,
} from '../../packages/frontend/src/pages/configuracoes/model/textos-legais'

const copia = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T

describe('painel com os dados da GB', () => {
  it('horário: segunda a sexta 08:00–18:00, sábado 08:00–12:00 e domingo fechado voltam iguais', () => {
    const form = horarioDoFormulario(copia(GB_BUSINESS_HOURS))
    expect(form.monday).toEqual({
      fechado: false,
      abre: '08:00',
      fecha: '18:00',
    })
    expect(form.sunday).toEqual({ fechado: true, abre: '', fecha: '' })
    expect(horarioParaSalvar(form)).toEqual({
      horario: copia(GB_BUSINESS_HOURS),
      erros: {},
    })
  })

  it('conteúdo do site: o que o script grava, mais a frota do dono, volta igual', () => {
    const conteudo = copia({ ...GB_SITE_CONTENT, fleetSize: 200 })
    const form = conteudoDoFormulario(conteudo)
    expect(form.experienceYears).toBe('10')
    expect(form.featuredClients.split('\n')).toEqual([
      'Melnick',
      'Cyrela',
      'Joal Teitelbaum',
      'UMA Incorporadora',
      'ABF Developments',
    ])
    expect(Object.values(form.commitments).every(Boolean)).toBe(true)
    expect(conteudoParaSalvar(form)).toEqual({ conteudo, erros: {} })
  })

  it.each(['terms', 'privacy', 'returnPolicy'] as const)(
    'texto legal da GB (%s): ida e volta sem perda pelo editor do painel',
    (kind) => {
      const documento = copia(GB_LEGAL_DOCUMENTS[kind])
      const form = formularioDoDocumento(documento)
      expect(documentoDoFormulario(form)).toEqual({ documento, erro: null })
    }
  )
})
