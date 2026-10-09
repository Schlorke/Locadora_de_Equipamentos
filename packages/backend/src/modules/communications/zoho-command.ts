import { createHash, randomUUID } from 'node:crypto'
import { SubscriptionEnforcementSchema } from '@gb-locacoes/contracts/subscription'
import {
  createSubscriptionCommandAccess,
  SubscriptionCommandError,
} from '../entitlements/command-admission'
import type { TenantTransactionRunner } from '../rentals/index'

type Operation = 'SEND' | 'REPLY' | 'DRAFT' | 'UPDATE' | 'DELETE' | 'UPLOAD'
type Command = {
  userId: string
  operation: Operation
  accountId: string
  key?: string | null
  payload: unknown | (() => Promise<unknown>)
  audit?: { action: string; entity: string; entityId: string }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export class ZohoCommandError extends Error {
  constructor(
    public readonly status: 409 | 503,
    public readonly code: string,
    message: string
  ) {
    super(message)
  }
}

/** Synchronous provider execution with a committed, tenant-scoped admission record.
 * No mail body, file bytes or credential is persisted, and UNKNOWN is never retried.
 */
export function createZohoMailCommands({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  const mode = () =>
    SubscriptionEnforcementSchema.safeParse(
      process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT ?? 'off'
    )
  function usesLegacyIdempotency() {
    const parsed = mode()
    return parsed.success && parsed.data !== 'on'
  }
  async function execute(
    scope: { tenantId: string },
    command: Command,
    effect: () => Promise<Response>
  ): Promise<Response> {
    const parsed = mode()
    if (!parsed.success)
      throw new SubscriptionCommandError(503, {
        error: 'Não foi possível verificar o acesso da assinatura.',
      })
    if (parsed.data === 'off') return effect()
    if (parsed.data === 'shadow') {
      await withTenantTransaction(scope, (tx) =>
        createSubscriptionCommandAccess()(tx, scope, { feature: 'emailInbox' })
      )
      return effect()
    }
    const keyHash = hash(command.key || randomUUID())
    const payload =
      typeof command.payload === 'function'
        ? await command.payload()
        : command.payload
    const requestHash = hash(
      JSON.stringify({ accountId: command.accountId, payload })
    )
    const admission = await withTenantTransaction(scope, async (tx) => {
      await createSubscriptionCommandAccess()(tx, scope, {
        feature: 'emailInbox',
      })
      const membership = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM memberships
        WHERE "tenantId" = ${scope.tenantId} AND "userId" = ${command.userId}
          AND status::text = 'ACTIVE' AND role::text IN ('ADMIN', 'OPERATOR')
        FOR SHARE
      `
      if (!membership.length)
        throw new ZohoCommandError(
          409,
          'ZOHO_MEMBERSHIP_CHANGED',
          'Seu acesso à caixa de e-mail mudou. Entre novamente antes de tentar.'
        )
      const key = {
        tenantId: scope.tenantId,
        userId: command.userId,
        operation: command.operation,
        keyHash,
      }
      const existing = await tx.zohoMailCommand.findUnique({
        where: { tenantId_userId_operation_keyHash: key },
      })
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new ZohoCommandError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'A chave já foi usada para outro pedido.'
          )
        if (
          existing.status === 'RESOLVED' &&
          existing.responseBody !== null &&
          existing.httpStatus !== null
        )
          return {
            response: new Response(existing.responseBody, {
              status: existing.httpStatus,
              headers: { 'Content-Type': 'application/json' },
            }),
          }
        throw new ZohoCommandError(
          409,
          existing.status === 'UNKNOWN'
            ? 'ZOHO_RECONCILIATION_REQUIRED'
            : 'ZOHO_COMMAND_IN_PROGRESS',
          'Resultado não confirmado. Confira o histórico antes de reenviar.'
        )
      }
      const grant = await tx.zohoMailToken.findFirst({
        where: {
          tenantId: scope.tenantId,
          userId: command.userId,
          accountId: command.accountId,
        },
        select: { id: true },
      })
      if (!grant)
        throw new ZohoCommandError(
          503,
          'ZOHO_GRANT_CHANGED',
          'A conexão de e-mail mudou. Reconecte antes de tentar novamente.'
        )
      const row = await tx.zohoMailCommand.create({
        data: {
          ...key,
          accountId: command.accountId,
          grantId: grant.id,
          requestHash,
        },
      })
      return { id: row.id }
    })
    if ('response' in admission) return admission.response!
    try {
      const response = await effect()
      const responseBody = await response.clone().text()
      await withTenantTransaction(scope, async (tx) => {
        const completed = await tx.zohoMailCommand.updateMany({
          where: {
            id: admission.id,
            tenantId: scope.tenantId,
            status: 'PROCESSING',
          },
          data: {
            status: 'RESOLVED',
            responseBody,
            httpStatus: response.status,
            completedAt: new Date(),
          },
        })
        if (completed.count !== 1)
          throw new ZohoCommandError(
            503,
            'ZOHO_RESULT_UNCONFIRMED',
            'Não foi possível registrar o resultado do envio.'
          )
        if (command.audit)
          await tx.auditLog.create({
            data: {
              tenantId: scope.tenantId,
              userId: command.userId,
              ...command.audit,
            },
          })
      })
      return response
    } catch (error) {
      try {
        await withTenantTransaction(scope, (tx) =>
          tx.zohoMailCommand.updateMany({
            where: {
              id: admission.id,
              tenantId: scope.tenantId,
              status: 'PROCESSING',
            },
            data: { status: 'UNKNOWN', completedAt: new Date() },
          })
        )
      } catch {
        /* An unavailable database leaves PROCESSING; it still cannot be replayed. */
      }
      throw error
    }
  }
  return { execute, usesLegacyIdempotency }
}
