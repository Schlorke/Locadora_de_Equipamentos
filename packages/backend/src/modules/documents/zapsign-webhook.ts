import { ZapSignWebhookEventSchema as ContractEvent } from '@gb-locacoes/contracts/rental-contracts'
import { enqueueOutbox } from '../outbox/index'
import type {
  AuthenticatedTenantWebhook,
  createTenantWebhookAuthentication,
} from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
export function createZapSignWebhookConsumer({
  withTenantTransaction,
  resolveWebhookResource,
}: {
  withTenantTransaction: TenantTransactionRunner
  resolveWebhookResource: ReturnType<
    typeof createTenantWebhookAuthentication
  >['resolveWebhookResource']
}) {
  async function consumeWebhook(authenticated: AuthenticatedTenantWebhook) {
    try {
      const raw = authenticated.body as Record<string, unknown>
      const parsed = ContractEvent.safeParse({
        ...raw,
        doc_token: raw.doc_token ?? raw.token,
        status:
          typeof raw.status === 'string'
            ? raw.status.toUpperCase()
            : raw.status,
      })
      if (!parsed.success) {
        return Response.json({ error: 'Invalid payload' }, { status: 400 })
      }
      const { doc_token, status, signed_at, signers } = parsed.data
      const { context, integration } = authenticated
      const resourceId = await resolveWebhookResource(
        integration,
        'CONTRACT',
        doc_token
      )
      if (!resourceId)
        return Response.json({ error: 'Contract not found' }, { status: 404 })
      const contract = await withTenantTransaction(context, (tx) =>
        tx.contract.findFirst({
          where: {
            id: resourceId,
            tenantId: context.tenantId,
            zapSignId: doc_token,
          },
          include: {
            rental: { include: { users: { select: { name: true } } } },
          },
        })
      )
      if (!contract) {
        return Response.json({ error: 'Contract not found' }, { status: 404 })
      }

      if (status === 'SIGNED') {
        await withTenantTransaction(context, async (tx) => {
          await tx.contract.updateMany({
            where: {
              id: contract.id,
              tenantId: context.tenantId,
              status: { in: ['DRAFT', 'SENT'] },
            },
            data: {
              status: 'SIGNED',
              signedAt: signed_at ? new Date(signed_at) : new Date(),
              signedBy:
                signers?.[0]?.name || contract.rental.users.name || null,
            },
          })
          await enqueueOutbox(tx, {
            tenantId: context.tenantId,
            topic: 'contract.signed.archive',
            aggregateId: contract.id,
            payload: { contractId: contract.id },
            dedupeKey: `contract-archive:${contract.id}`,
          })
        })
      }

      return Response.json({
        success: true,
        message: 'Webhook processed successfully',
      })
    } catch (error) {
      console.error('Error processing ZapSign webhook:', error)
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return { consumeWebhook }
}
