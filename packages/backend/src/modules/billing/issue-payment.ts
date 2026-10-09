import { sameAmount } from './asaas-amount'
import type { BillingGateway, ChargeRequest, ProviderCharge } from './asaas'
import { assertChargeRequest, chargeAmount, isChargePaid } from './asaas'
import { BillingProviderError } from './asaas-http'
export class ReconciliationRequired extends Error {
  constructor() { super('PAYMENT_RECONCILIATION_REQUIRED') }
}
/**
 * Só uma falha que prova que o Asaas não aplicou a escrita devolve a operação à fila: erro do
 * provedor com `maybeApplied=false` (429, 401, 400, interruptor, leitura GET que falhou ou veio
 * ilegível/com forma inesperada, qualquer falha na busca ou no cadastro do cliente antes do
 * POST /payments…). Na emissão, a recusa do próprio pedido na criação (`ChargeRequestRejected`)
 * encerra a tentativa em vez de voltar à fila. Quem decide é só `maybeApplied`, nunca o código: o
 * cliente HTTP e o gateway marcam `maybeApplied=true` em qualquer resposta inutilizável do
 * POST /payments ou do DELETE, que pode ter sido aplicado. Qualquer outro erro (timeout, rede ou 5xx numa escrita, erro
 * desconhecido) fica UNKNOWN e exige conciliação.
 */
export function provenNotApplied(error: unknown): boolean {
  return error instanceof BillingProviderError && !error.maybeApplied
}
/**
 * Erro com a forma de uma recusa, provada sem efeito: o Asaas respondeu 400 (validação) ou a
 * validação local recusou (`INVALID_REQUEST`). 401, 403, 404, 429, 5xx, o interruptor e a
 * ambiguidade continuam passageiros (chave trocada, permissão, limite, indisponibilidade).
 * A forma sozinha não diz de qual chamada veio: um 400 numa LEITURA (busca pela referência, dados do
 * PIX/boleto de uma cobrança que já existe) não é recusa do pedido. Só `issuePayment` sabe onde a
 * recusa aconteceu, e só ela a promove a `ChargeRequestRejected`.
 */
export function isRejectedRequest(error: unknown): error is BillingProviderError {
  return provenNotApplied(error) && (error as BillingProviderError).code === 'REJECTED' &&
    ((error as BillingProviderError).reason === 'VALIDATION' || (error as BillingProviderError).reason === 'INVALID_REQUEST')
}
/**
 * Recusa definitiva do PEDIDO de cobrança, antes de o Asaas aceitar o POST /payments: a validação
 * local do pedido (valor, CPF/CNPJ, vencimento…) ou a recusa 400 da criação (cadastro do cliente ou o
 * próprio POST /payments). Repetir o mesmo pedido dá sempre a mesma recusa: recusada depois da
 * reserva, a tentativa já encerrou em FAILED (`reject`), e só uma revisão a destrava. Só
 * `issuePayment` lança este erro, e só nesses pontos; é o único que a aplicação trata como definitivo.
 * Um 400 depois do POST aceito (a cobrança existe) ou na busca pela referência sai como o
 * `BillingProviderError` original, passageiro: a rodada seguinte concilia pela referência.
 * Guarda só os códigos da recusa original (nunca corpo nem descrição).
 */
export class ChargeRequestRejected extends BillingProviderError {
  constructor(rejection: BillingProviderError) {
    super(rejection.code, {
      ...(rejection.reason ? { reason: rejection.reason } : {}),
      ...(rejection.status !== null ? { status: rejection.status } : {}),
      providerCodes: rejection.providerCodes,
      maybeApplied: false,
    })
    this.name = 'ChargeRequestRejected'
  }
}
/** Validação local do pedido: a recusa sai como `ChargeRequestRejected`; qualquer outro erro, como veio. */
function validated<T>(check: () => T): T {
  try {
    return check()
  } catch (error) {
    throw isRejectedRequest(error) ? new ChargeRequestRejected(error) : error
  }
}
/**
 * Janela da conciliação de uma tentativa de desfecho incerto: passado esse tempo, qualquer cobrança
 * que o POST /payments incerto tenha criado já aparece na busca por `externalReference` (o POST mais
 * lento terminou há muito no Asaas). Busca vazia depois da janela prova que nada foi criado.
 * Vale também para a reserva abandonada (PROCESSING): depois de reservar, quem emite faz no máximo
 * três chamadas ao Asaas (busca e cadastro do cliente, POST /payments), cada uma limitada por
 * `ASAAS_MAX_TIMEOUT_MS` (2 min) e sem repetição, e a função do cron vive no máximo 5 min. Passada a
 * janela, nenhum POST dessa reserva ainda está no ar (premissa: nenhum processo fica congelado por
 * mais que a janela entre a reserva e o POST).
 */
export const UNKNOWN_ISSUANCE_SETTLE_MS = 15 * 60_000
export type IssuanceAttempt = {
  id: string
  state: 'QUEUED' | 'PROCESSING' | 'UNKNOWN' | 'ISSUED'
  request: ChargeRequest
  /**
   * Desde quando o desfecho da tentativa é incerto: a entrada em UNKNOWN ou, em PROCESSING, a
   * reserva (o processo pode ter morrido antes ou depois do POST). Só a conciliação usa; ausente
   * fora desses estados.
   */
  unknownSince?: Date | null
}
/**
 * UNKNOWN, ou PROCESSING abandonada, há pelo menos `UNKNOWN_ISSUANCE_SETTLE_MS`: pronta para a
 * conciliação pela referência (cobrança achada → vincula; nada → volta à fila e emite).
 */
export function isSettledUnknown(attempt: Pick<IssuanceAttempt, 'state' | 'unknownSince'>, now: Date): boolean {
  return (attempt.state === 'UNKNOWN' || attempt.state === 'PROCESSING') && attempt.unknownSince instanceof Date &&
    now.getTime() - attempt.unknownSince.getTime() >= UNKNOWN_ISSUANCE_SETTLE_MS
}
export interface IssuanceRepository {
  load(): Promise<IssuanceAttempt | null>
  claim(attemptId: string): Promise<boolean>
  unknown(attemptId: string): Promise<void>
  /** Devolve a tentativa reservada (PROCESSING) a QUEUED: a falha provou que nada foi criado. */
  release(attemptId: string): Promise<void>
  /**
   * Encerra a tentativa reservada (PROCESSING) que o pedido recusado deixou sem cobrança
   * (`ChargeRequestRejected`): FAILED, com os códigos da recusa. Nunca volta à fila nem é religada.
   */
  reject(attemptId: string, rejection: ChargeRequestRejected): Promise<void>
  /**
   * Conciliação: devolve a QUEUED a tentativa UNKNOWN ou PROCESSING abandonada (a mesma que `load`
   * leu, sem cobrança vinculada) cuja referência não tem cobrança no Asaas depois da janela. `false`
   * se ela mudou desde a leitura.
   */
  requeue(attemptId: string): Promise<boolean>
  issued(attemptId: string, charge: ProviderCharge, details: Awaited<ReturnType<BillingGateway['details']>>): Promise<void>
}
/**
 * A retry after an uncertain POST reconciles by the attempt reference and never blindly issues
 * again: a charge found is attached; nothing found issues again only after the settle window.
 */
export async function issuePayment(repository: IssuanceRepository, gateway: BillingGateway, now: () => Date = () => new Date()) {
  const attempt = await repository.load()
  if (!attempt || attempt.state === 'ISSUED') return
  // Valor inválido não permite nem conciliar: recusado antes de qualquer rede.
  const expected = validated(() => chargeAmount(attempt.request))
  // Falha da busca (inclusive 400) é passageira: nada foi decidido, e a rodada seguinte busca de novo.
  let remote = await gateway.find(attempt.request.reference)
  if (!remote) {
    // UNKNOWN (ou PROCESSING abandonada) além da janela e nenhuma cobrança com a referência: o POST
    // incerto não criou nada. Dentro da janela a busca vazia não prova nada.
    const reconciled = isSettledUnknown(attempt, now())
    if (attempt.state !== 'QUEUED' && !reconciled) throw new ReconciliationRequired()
    // Pedido inválido (CPF/CNPJ, vencimento, valor) é recusado antes da reserva: a tentativa não muda.
    validated(() => assertChargeRequest(attempt.request))
    if (reconciled && !await repository.requeue(attempt.id)) throw new ReconciliationRequired()
    if (!await repository.claim(attempt.id)) throw new ReconciliationRequired()
    try { remote = await gateway.create(attempt.request) }
    catch (error) {
      // Pedido recusado (cadastro do cliente ou o próprio POST /payments, antes de a cobrança existir):
      // encerra. Sem efeito provado: volta à fila e a outbox tenta de novo; na dúvida, UNKNOWN (nunca
      // outro POST às cegas).
      if (isRejectedRequest(error)) {
        const rejection = new ChargeRequestRejected(error)
        await repository.reject(attempt.id, rejection)
        throw rejection
      }
      if (provenNotApplied(error)) await repository.release(attempt.id)
      else await repository.unknown(attempt.id)
      throw error
    }
  }
  if (remote.externalReference !== attempt.request.reference || !sameAmount(remote.value, expected) ||
      remote.billingType !== attempt.request.method || remote.deleted === true || ['DELETED', 'REFUNDED', 'CANCELLED'].includes(remote.status)) {
    await repository.unknown(attempt.id)
    throw new ReconciliationRequired()
  }
  // A cobrança existe no Asaas: falha dos dados (inclusive 400) é passageira e não mexe na tentativa;
  // a rodada seguinte acha a cobrança pela referência e vincula, sem outro POST.
  const details = isChargePaid(remote.status) ? {} : await gateway.details(remote)
  await repository.issued(attempt.id, remote, details)
}
