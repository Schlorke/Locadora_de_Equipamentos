import { describe, expect, it } from 'vitest'
import { somarDias } from './dia-civil'
import { derivarEstado } from './estado'
import type {
  AcessoDaOrganizacao,
  EstadoDaAssinatura,
  FatosDaAssinatura,
  FaturaDaAssinatura,
  MotivoDoEncerramento,
} from './estado'
import { POLITICA_COMERCIAL_PADRAO } from './politica'
import { planejarReativacao } from './reativacao'
import { planejarTrocaDePlano } from './troca-de-plano'

/**
 * Regras comerciais padrão do ADR de assinatura (B.18), provadas como tabela:
 * 7 dias de tolerância, pausa no 8º dia, encerramento no 37º, troca de plano
 * sem pró-rata e atraso perdoado ao reativar.
 */

function emSaoPaulo(dia: string, hora = '12:00:00'): Date {
  return new Date(`${dia}T${hora}-03:00`)
}

function fatura(
  parcial: Partial<FaturaDaAssinatura> & { id: string }
): FaturaDaAssinatura {
  return {
    kind: 'CYCLE',
    status: 'PENDING',
    amount: '149.90',
    dueDate: '2026-10-05',
    periodEnd: null,
    paidAt: null,
    chargebackAt: null,
    voluntaryRefund: false,
    settlesInvoiceId: null,
    debtWaivedAt: null,
    ...parcial,
  }
}

function fatos(parcial: Partial<FatosDaAssinatura> = {}): FatosDaAssinatura {
  return {
    billingMode: 'ASAAS',
    createdAt: emSaoPaulo('2026-08-01'),
    complimentaryUntil: null,
    trialEndsAt: null,
    currentPeriodEnd: '2026-11-04',
    cancelAtPeriodEnd: false,
    canceledAt: null,
    invoices: [],
    ...parcial,
  }
}

const VENCIMENTO = '2026-10-05'
const setembroPaga = fatura({
  id: 'set',
  status: 'PAID',
  dueDate: '2026-09-05',
  paidAt: emSaoPaulo('2026-09-05'),
})
const outubro = fatura({ id: 'out', status: 'OVERDUE', dueDate: VENCIMENTO })
const inadimplente = fatos({ invoices: [setembroPaga, outubro] })

type Linha = [
  rotulo: string,
  diasAposVencimento: number,
  estado: EstadoDaAssinatura,
  acesso: AcessoDaOrganizacao,
  diasEmAtraso: number | null,
  encerramento: MotivoDoEncerramento | null,
]

const LINHA_DO_TEMPO: Linha[] = [
  ['D0: vence hoje', 0, 'ACTIVE', 'FULL', null, null],
  ['D+1: 1º dia de atraso, faixa amarela', 1, 'PAST_DUE', 'FULL', 1, null],
  ['D+6: tudo funciona', 6, 'PAST_DUE', 'FULL', 6, null],
  ['D+7: último dia de tolerância', 7, 'PAST_DUE', 'FULL', 7, null],
  ['D+8: pausa no 8º dia', 8, 'SUSPENDED', 'RESTRICTED', 8, null],
  ['D+30: em pausa', 30, 'SUSPENDED', 'RESTRICTED', 30, null],
  ['D+36: véspera do encerramento', 36, 'SUSPENDED', 'RESTRICTED', 36, null],
  [
    'D+37: encerramento no 37º dia',
    37,
    'SUSPENDED',
    'RESTRICTED',
    37,
    'NON_PAYMENT',
  ],
  [
    'D+38: job ainda não encerrou',
    38,
    'SUSPENDED',
    'RESTRICTED',
    38,
    'NON_PAYMENT',
  ],
]

describe('regra comercial: 7 dias de tolerância, pausa no 8º, encerramento no 37º', () => {
  it.each(LINHA_DO_TEMPO)(
    '%s',
    (_rotulo, dias, estado, acesso, diasEmAtraso, encerramento) => {
      // Como no provedor: PENDING até o vencimento, OVERDUE a partir do dia seguinte.
      const outubroNoDia = {
        ...outubro,
        status: dias >= 1 ? ('OVERDUE' as const) : ('PENDING' as const),
      }
      const noDia = fatos({ invoices: [setembroPaga, outubroNoDia] })
      const resultado = derivarEstado(
        noDia,
        emSaoPaulo(somarDias(VENCIMENTO, dias))
      )
      expect(resultado.estado).toBe(estado)
      expect(resultado.acesso).toBe(acesso)
      expect(resultado.divida?.diasEmAtraso ?? null).toBe(diasEmAtraso)
      expect(resultado.encerramentoDevido).toBe(encerramento)
    }
  )

  it('publica as datas da régua: tolerância até D+7, pausa em D+8, encerramento em D+37', () => {
    const resultado = derivarEstado(inadimplente, emSaoPaulo('2026-10-06'))
    expect(resultado.divida).toMatchObject({
      desde: '2026-10-06',
      toleranciaAte: '2026-10-12',
      pausaEm: '2026-10-13',
      encerramentoEm: '2026-11-11',
    })
  })

  it('o padrão é 7 + 30 e o encerramento só é aplicado quando o job grava canceledAt', () => {
    expect(POLITICA_COMERCIAL_PADRAO).toEqual({
      graceDays: 7,
      suspendDays: 30,
      incompleteDays: 30,
    })
    const encerrada = fatos({
      invoices: [setembroPaga, outubro],
      canceledAt: emSaoPaulo('2026-11-11', '00:05:00'),
    })
    expect(derivarEstado(encerrada, emSaoPaulo('2026-11-11'))).toMatchObject({
      estado: 'CANCELED',
      acesso: 'ARCHIVED',
    })
  })

  it('pagar em qualquer dia antes do encerramento volta para ACTIVE', () => {
    const paga = {
      ...outubro,
      status: 'PAID' as const,
      paidAt: emSaoPaulo('2026-11-10'),
    }
    const resultado = derivarEstado(
      fatos({ invoices: [setembroPaga, paga] }),
      emSaoPaulo('2026-11-10')
    )
    expect(resultado).toMatchObject({
      estado: 'ACTIVE',
      acesso: 'FULL',
      divida: null,
    })
  })

  it('teste sem pagamento segue a mesma régua a partir do dia seguinte ao fim do teste', () => {
    const teste = fatos({ trialEndsAt: '2026-10-14', currentPeriodEnd: null })
    expect(derivarEstado(teste, emSaoPaulo('2026-10-15'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { diasEmAtraso: 1 },
    })
    expect(derivarEstado(teste, emSaoPaulo('2026-10-21'))).toMatchObject({
      estado: 'PAST_DUE',
      divida: { diasEmAtraso: 7 },
    })
    expect(derivarEstado(teste, emSaoPaulo('2026-10-22'))).toMatchObject({
      estado: 'SUSPENDED',
      divida: { diasEmAtraso: 8 },
    })
    expect(
      derivarEstado(teste, emSaoPaulo('2026-11-19')).encerramentoDevido
    ).toBeNull()
    expect(derivarEstado(teste, emSaoPaulo('2026-11-20'))).toMatchObject({
      estado: 'SUSPENDED',
      encerramentoDevido: 'TRIAL_EXPIRED',
    })
  })

  it('os prazos vêm da versão do plano e podem ser revistos sem mudar código', () => {
    const politica = { graceDays: 3, suspendDays: 10, incompleteDays: 30 }
    const noDia = (dias: number) =>
      derivarEstado(
        inadimplente,
        emSaoPaulo(somarDias(VENCIMENTO, dias)),
        politica
      )
    expect(noDia(3).estado).toBe('PAST_DUE')
    expect(noDia(4).estado).toBe('SUSPENDED')
    expect(noDia(12).encerramentoDevido).toBeNull()
    expect(noDia(13).encerramentoDevido).toBe('NON_PAYMENT')
    const semTolerancia = { graceDays: 0, suspendDays: 7, incompleteDays: 30 }
    expect(
      derivarEstado(inadimplente, emSaoPaulo('2026-10-06'), semTolerancia)
    ).toMatchObject({
      estado: 'SUSPENDED',
      divida: {
        toleranciaAte: '2026-10-05',
        pausaEm: '2026-10-06',
        encerramentoEm: '2026-10-12',
      },
    })
  })
})

describe('regra comercial: troca de plano sem pró-rata', () => {
  it('upgrade no meio do período: limites na hora, próxima fatura com o preço cheio e nenhum ajuste proporcional', () => {
    const troca = planejarTrocaDePlano(
      {
        estado: 'ACTIVE',
        sentido: 'UPGRADE',
        valorNovo: '299.90',
        currentPeriodEnd: '2026-11-04',
      },
      emSaoPaulo('2026-10-20')
    )
    expect(troca).toMatchObject({
      permitida: true,
      limitesNovosValemEm: '2026-10-20',
      agendada: false,
    })
    if (!troca.permitida) throw new Error('troca recusada')
    expect(troca.valorDaProximaFatura.toFixed(2)).toBe('299.90')
    expect(troca.ajusteProporcional.isZero()).toBe(true)
  })

  it('downgrade vale no fim do período, também sem ajuste proporcional', () => {
    const troca = planejarTrocaDePlano(
      {
        estado: 'ACTIVE',
        sentido: 'DOWNGRADE',
        valorNovo: '99.90',
        currentPeriodEnd: '2026-11-04',
      },
      emSaoPaulo('2026-10-20')
    )
    expect(troca).toMatchObject({
      permitida: true,
      limitesNovosValemEm: '2026-11-04',
      agendada: true,
    })
    if (!troca.permitida) throw new Error('troca recusada')
    expect(troca.valorDaProximaFatura.toFixed(2)).toBe('99.90')
    expect(troca.ajusteProporcional.isZero()).toBe(true)
  })
})

describe('regra comercial: atraso perdoado ao reativar', () => {
  it('a reativação perdoa as vencidas da assinatura encerrada e a nova começa sem dívida e sem teste', () => {
    const novembro = fatura({
      id: 'nov',
      status: 'OVERDUE',
      dueDate: '2026-11-05',
    })
    const reativacao = planejarReativacao(
      { estado: 'CANCELED', invoices: [setembroPaga, outubro, novembro] },
      emSaoPaulo('2026-12-01')
    )
    expect(reativacao).toMatchObject({
      reativavel: true,
      estadoInicial: 'INCOMPLETE',
      faturasPerdoadas: ['out', 'nov'],
    })
    if (!reativacao.reativavel) throw new Error('não reativável')
    expect(reativacao.valorPerdoado.toFixed(2)).toBe('299.80')

    const nova = fatos({
      createdAt: emSaoPaulo('2026-12-01'),
      currentPeriodEnd: null,
    })
    expect(derivarEstado(nova, emSaoPaulo('2026-12-01'))).toMatchObject({
      estado: 'INCOMPLETE',
      divida: null,
    })
    const primeira = fatura({
      id: 'nova-1',
      status: 'PAID',
      dueDate: '2026-12-01',
      paidAt: emSaoPaulo('2026-12-01'),
    })
    expect(
      derivarEstado({ ...nova, invoices: [primeira] }, emSaoPaulo('2026-12-02'))
    ).toMatchObject({
      estado: 'ACTIVE',
      acesso: 'FULL',
      divida: null,
    })
  })

  it('faturas perdoadas (CANCELED) não voltam a contar como dívida', () => {
    const perdoada = { ...outubro, status: 'CANCELED' as const }
    const resultado = derivarEstado(
      fatos({ invoices: [setembroPaga, perdoada] }),
      emSaoPaulo('2026-12-01')
    )
    expect(resultado).toMatchObject({ estado: 'ACTIVE', divida: null })
  })
})
