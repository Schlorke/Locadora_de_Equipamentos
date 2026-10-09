import { describe, expect, it } from 'vitest'
import { decidirAreaDoCliente } from './area-do-cliente'
import type { AcessoDaOrganizacao } from './estado'
import { decidirModoDoSite, type FiscalizacaoDaAssinatura } from './site'

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

describe('decidirAreaDoCliente: fiscalização on (matriz B.5, linha "Área do cliente final")', () => {
  it.each([
    ['FULL', true],
    ['RESTRICTED', true],
    ['SETUP', false],
    ['ARCHIVED', false],
  ] as const)('acesso %s → %s', (acesso, disponivel) => {
    expect(
      decidirAreaDoCliente({ bloqueioAdministrativo: false, acesso }, 'on')
    ).toEqual({ disponivel, calculado: disponivel })
  })
})

describe('decidirAreaDoCliente: off e shadow tratam o acesso como FULL (D23)', () => {
  it.each(
    ACESSOS.flatMap((acesso) =>
      (['off', 'shadow'] as const).map(
        (fiscalizacao) => [acesso, fiscalizacao] as const
      )
    )
  )(
    'acesso %s com %s: disponível; calculado é o de on',
    (acesso, fiscalizacao) => {
      expect(
        decidirAreaDoCliente(
          { bloqueioAdministrativo: false, acesso },
          fiscalizacao
        )
      ).toEqual({
        disponivel: true,
        calculado: acesso === 'FULL' || acesso === 'RESTRICTED',
      })
    }
  )
})

describe('decidirAreaDoCliente: bloqueio administrativo vale em toda fiscalização', () => {
  it.each(
    ACESSOS.flatMap((acesso) =>
      FISCALIZACOES.map((fiscalizacao) => [acesso, fiscalizacao] as const)
    )
  )('acesso %s com %s: indisponível', (acesso, fiscalizacao) => {
    expect(
      decidirAreaDoCliente(
        { bloqueioAdministrativo: true, acesso },
        fiscalizacao
      )
    ).toEqual({ disponivel: false, calculado: false })
  })
})

describe('separada da vitrine', () => {
  it.each(
    (['FULL', 'RESTRICTED'] as const).flatMap((acesso) =>
      FISCALIZACOES.map((fiscalizacao) => [acesso, fiscalizacao] as const)
    )
  )(
    'site desligado por falta de publicação não fecha a área do cliente (acesso %s, %s)',
    (acesso, fiscalizacao) => {
      const site = decidirModoDoSite(
        {
          bloqueioAdministrativo: false,
          acesso,
          publicadoEm: null,
          indexavel: true,
        },
        fiscalizacao
      )
      expect(site.modo).toBe('OFF')
      expect(
        decidirAreaDoCliente(
          { bloqueioAdministrativo: false, acesso },
          fiscalizacao
        ).disponivel
      ).toBe(true)
    }
  )

  it.each(
    ACESSOS.flatMap((acesso) =>
      FISCALIZACOES.flatMap((fiscalizacao) =>
        [false, true].flatMap((bloqueioAdministrativo) =>
          [null, new Date('2026-09-01T12:00:00.000Z')].map(
            (publicadoEm) =>
              [
                acesso,
                fiscalizacao,
                bloqueioAdministrativo,
                publicadoEm,
              ] as const
          )
        )
      )
    )
  )(
    'site no ar ou em pausa implica área do cliente disponível (%s, %s, bloqueio %s, publicado %s)',
    (acesso, fiscalizacao, bloqueioAdministrativo, publicadoEm) => {
      const site = decidirModoDoSite(
        { bloqueioAdministrativo, acesso, publicadoEm, indexavel: true },
        fiscalizacao
      )
      const area = decidirAreaDoCliente(
        { bloqueioAdministrativo, acesso },
        fiscalizacao
      )
      if (site.modo !== 'OFF') expect(area.disponivel).toBe(true)
      if (site.calculado !== 'OFF') expect(area.calculado).toBe(true)
    }
  )
})
