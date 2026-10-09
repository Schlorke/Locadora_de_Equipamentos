import { sameAmount, type MoneyInput } from './asaas-amount'
import { isChargePaid, type ProviderCharge } from './asaas'
import { provenNotApplied, ReconciliationRequired } from './issue-payment'

export type CancellationState = 'NONE' | 'REQUESTED' | 'PROCESSING' | 'UNKNOWN' | 'CONFIRMED'
export interface CancellationGateway {
  get(id: string): Promise<ProviderCharge>
  cancel(id: string): Promise<void>
}
export interface CancellationRepository {
  /** `amount`: Decimal (preferido) ou string decimal; `number` só por compatibilidade. */
  load(): Promise<{ id: string; externalId: string; reference: string; amount: MoneyInput; state: CancellationState } | null>
  claim(id: string): Promise<boolean>
  unknown(id: string): Promise<void>
  /**
   * Devolve o cancelamento reservado (PROCESSING) a REQUESTED quando a falha provou que o DELETE
   * não foi aplicado. Obrigatório: sem ele um 429/401 deixaria o cancelamento UNKNOWN para sempre.
   */
  release(id: string): Promise<void>
  confirmed(id: string): Promise<void>
  paid(id: string, charge: ProviderCharge): Promise<void>
}

/** An uncertain cancellation only reconciles; a 404 is never evidence of cancellation. */
export async function cancelAttempt(repository: CancellationRepository, gateway: CancellationGateway) {
  const attempt = await repository.load()
  if (!attempt) return
  if (attempt.state === 'CONFIRMED') { await repository.confirmed(attempt.id); return }
  const charge = await gateway.get(attempt.externalId)
  if (charge.id !== attempt.externalId || charge.externalReference !== attempt.reference ||
      !sameAmount(charge.value, attempt.amount) || charge.billingType !== 'BOLETO') throw new ReconciliationRequired()
  if (isChargePaid(charge.status)) { await repository.paid(attempt.id, charge); return }
  if (charge.deleted === true) { await repository.confirmed(attempt.id); return }
  if (!['PENDING', 'OVERDUE'].includes(charge.status)) throw new ReconciliationRequired()
  if (attempt.state !== 'REQUESTED' || !await repository.claim(attempt.id)) throw new ReconciliationRequired()
  try { await gateway.cancel(attempt.externalId) }
  catch (error) {
    // Sem efeito provado: volta a REQUESTED e a outbox tenta de novo; na dúvida, UNKNOWN (nunca outro DELETE às cegas).
    if (provenNotApplied(error)) await repository.release(attempt.id)
    else await repository.unknown(attempt.id)
    throw error
  }
  await repository.confirmed(attempt.id)
}
