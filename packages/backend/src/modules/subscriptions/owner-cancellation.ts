import { derivarEstado } from '@gb-locacoes/domain/assinatura'
import type { TenantPrincipal } from '../identity/index'
import { subscriptionCurrentPeriod, subscriptionFacts } from './facts'
import { recomputeSubscription } from './projection'
import {
  createOwnerCommand,
  OwnerSubscriptionCommandError,
  type OwnerCommandPorts,
} from './owner-command'
export { OwnerSubscriptionCommandError } from './owner-command'

/** Cancellation changes facts; the existing pure domain protects paid/courtesy periods. */
export function createOwnerSubscriptionCancellation(ports: OwnerCommandPorts) {
  return async (
    principal: TenantPrincipal,
    input: {
      action: 'cancel' | 'undo-cancel'
      key: string
      authenticatedAt: number
    }
  ) =>
    createOwnerCommand(
      ports,
      input.action === 'cancel' ? 'CANCEL_REQUESTED' : 'CANCEL_UNDONE',
      async (tx, sub, now, key) => {
        const state = derivarEstado(
          subscriptionFacts(sub, subscriptionCurrentPeriod(sub).currentEnd),
          now,
          {
            graceDays: sub.planVersion.graceDays,
            suspendDays: sub.planVersion.suspendDays,
            incompleteDays: sub.planVersion.incompleteDays,
          }
        )
        if (
          input.action === 'undo-cancel' &&
          sub.cancelAtPeriodEnd &&
          state.encerramentoDevido === 'OWNER_REQUEST'
        )
          throw new OwnerSubscriptionCommandError(
            409,
            'CANCELLATION_ALREADY_DUE'
          )
        const flag = input.action === 'cancel'
        if (sub.cancelAtPeriodEnd !== flag) {
          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              cancelAtPeriodEnd: flag,
              cancelRequestedAt: flag ? now : null,
              revision: { increment: 1 },
            },
          })
          await recomputeSubscription(
            tx,
            sub.id,
            'projection:' + key,
            now,
            'OWNER'
          )
        }
      }
    )(principal, input)
}
