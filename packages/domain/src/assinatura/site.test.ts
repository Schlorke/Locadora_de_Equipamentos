import { describe, expect, it } from 'vitest'
import type { AcessoDaOrganizacao } from './estado'
import {
  decidirModoDoSite,
  type FatosDoSite,
  type FiscalizacaoDaAssinatura,
} from './site'

const publicado = new Date('2026-09-01T12:00:00.000Z')
const fatos = (parcial: Partial<FatosDoSite> = {}): FatosDoSite => ({
  bloqueioAdministrativo: false,
  acesso: 'FULL',
  publicadoEm: publicado,
  indexavel: true,
  ...parcial,
})
const ACESSOS: readonly AcessoDaOrganizacao[] = [
  'SETUP',
  'FULL',
  'RESTRICTED',
  'ARCHIVED',
]
const FISCALIZACOES: readonly FiscalizacaoDaAssinatura[] = [
  'off',
  'shadow',
  'on',
]

describe('decidirModoDoSite: fiscalização on (matriz B.5, linha "Site público")', () => {
  it.each([
    ['FULL', 'LIVE'],
    ['RESTRICTED', 'PAUSED'],
    ['SETUP', 'OFF'],
    ['ARCHIVED', 'OFF'],
  ] as const)('publicado com acesso %s → %s', (acesso, modo) => {
    expect(decidirModoDoSite(fatos({ acesso }), 'on')).toEqual({
      modo,
      indexavel: modo === 'LIVE',
      calculado: modo,
    })
  })

  it('LIVE só é indexável com siteIndexable (noindex até a 1ª fatura paga)', () => {
    expect(decidirModoDoSite(fatos({ indexavel: false }), 'on')).toEqual({
      modo: 'LIVE',
      indexavel: false,
      calculado: 'LIVE',
    })
  })

  it('PAUSED nunca é indexável, mesmo com siteIndexable', () => {
    expect(
      decidirModoDoSite(fatos({ acesso: 'RESTRICTED', indexavel: true }), 'on')
        .indexavel
    ).toBe(false)
  })
})

describe('decidirModoDoSite: publicação e bloqueio administrativo valem em toda fiscalização', () => {
  it.each(
    FISCALIZACOES.flatMap((fiscalizacao) =>
      ACESSOS.map((acesso) => [fiscalizacao, acesso] as const)
    )
  )('%s, acesso %s, sem publicação → OFF', (fiscalizacao, acesso) => {
    expect(
      decidirModoDoSite(fatos({ acesso, publicadoEm: null }), fiscalizacao)
    ).toEqual({ modo: 'OFF', indexavel: false, calculado: 'OFF' })
  })

  it.each(
    FISCALIZACOES.flatMap((fiscalizacao) =>
      ACESSOS.map((acesso) => [fiscalizacao, acesso] as const)
    )
  )(
    '%s, acesso %s, bloqueio administrativo → OFF (404 do D10)',
    (fiscalizacao, acesso) => {
      expect(
        decidirModoDoSite(
          fatos({ acesso, bloqueioAdministrativo: true }),
          fiscalizacao
        )
      ).toEqual({ modo: 'OFF', indexavel: false, calculado: 'OFF' })
    }
  )
})

describe('decidirModoDoSite: off e shadow tratam o acesso como FULL (D23)', () => {
  it.each(
    (['off', 'shadow'] as const).flatMap((fiscalizacao) =>
      ACESSOS.map((acesso) => [fiscalizacao, acesso] as const)
    )
  )(
    '%s com acesso %s publicado → LIVE (nunca PAUSED)',
    (fiscalizacao, acesso) => {
      const decisao = decidirModoDoSite(fatos({ acesso }), fiscalizacao)
      expect(decisao.modo).toBe('LIVE')
      expect(decisao.indexavel).toBe(true)
    }
  )

  it('off e shadow conservam o noindex de siteIndexable', () => {
    for (const fiscalizacao of ['off', 'shadow'] as const)
      expect(
        decidirModoDoSite(fatos({ indexavel: false }), fiscalizacao).indexavel
      ).toBe(false)
  })

  it.each([
    ['RESTRICTED', 'PAUSED'],
    ['SETUP', 'OFF'],
    ['ARCHIVED', 'OFF'],
    ['FULL', 'LIVE'],
  ] as const)(
    'shadow registra em calculado o que on aplicaria (%s → %s) sem aplicar',
    (acesso, calculado) => {
      for (const fiscalizacao of ['off', 'shadow'] as const)
        expect(decidirModoDoSite(fatos({ acesso }), fiscalizacao)).toEqual({
          modo: 'LIVE',
          indexavel: true,
          calculado,
        })
    }
  )
})
