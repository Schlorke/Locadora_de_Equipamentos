/**
 * Prazos comerciais da versão do plano (`PlanVersion`), em dias civis.
 *
 * - `graceDays`: dias de tolerância em atraso com tudo funcionando (PAST_DUE).
 * - `suspendDays`: dias entre o fim da tolerância e o encerramento; o painel e
 *   o site ficam em pausa (SUSPENDED) nesse intervalo.
 * - `incompleteDays`: dias que uma assinatura que nunca foi paga nem teve teste
 *   fica em INCOMPLETE antes do encerramento por abandono.
 */
export interface PoliticaDeCobranca {
  readonly graceDays: number
  readonly suspendDays: number
  readonly incompleteDays: number
}

/**
 * Regras comerciais padrão (ADR de assinatura, B.18): 7 dias de tolerância,
 * pausa no 8º dia de atraso e encerramento no 37º (7 + 30); abandono depois de
 * 30 dias sem pagar. São os padrões de `PlanVersion`.
 */
export const POLITICA_COMERCIAL_PADRAO: PoliticaDeCobranca = Object.freeze({
  graceDays: 7,
  suspendDays: 30,
  incompleteDays: 30,
})

function inteiroEntre(
  nome: string,
  valor: number,
  minimo: number,
  maximo: number
): void {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(
      `${nome} precisa ser inteiro entre ${minimo} e ${maximo}; recebido ${valor}.`
    )
  }
}

/**
 * Confere os limites das CHECK de `plan_versions` (graceDays 0..15,
 * suspendDays 7..90) e `incompleteDays` inteiro positivo. Lança `RangeError`.
 */
export function validarPolitica(
  politica: PoliticaDeCobranca
): PoliticaDeCobranca {
  inteiroEntre('graceDays', politica.graceDays, 0, 15)
  inteiroEntre('suspendDays', politica.suspendDays, 7, 90)
  inteiroEntre(
    'incompleteDays',
    politica.incompleteDays,
    1,
    Number.MAX_SAFE_INTEGER
  )
  return politica
}
