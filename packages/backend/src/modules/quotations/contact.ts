import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { z } from 'zod'
import type { ContactSchema } from '@gb-locacoes/contracts/quotations'
import type { TenantTransactionRunner } from '../rentals'
import { generateNextQuoteCode } from './quote-code'
import { enqueueOutbox } from '../outbox'

export function createContactRequests(dependencies: {
  withRentalTransaction: TenantTransactionRunner
}) {
  const { withRentalTransaction } = dependencies
  return async function createContactRequest(
    context: TenantContext,
    input: z.infer<typeof ContactSchema>
  ) {
    return withRentalTransaction(context, async (tx) => {
      const quoteCode = await generateNextQuoteCode(context, tx)
      const quote = await tx.quote.create({
        data: {
          tenantId: context.tenantId,
          quoteCode,
          name: input.name,
          email: input.email,
          phone: input.phone || '',
          cpf: input.cpf,
          cnpj: input.cnpj,
          cep: input.cep,
          company: input.company,
          message: input.message,
          total: 0,
          status: 'PENDING',
        },
      })
      await enqueueOutbox(tx, {
        tenantId: context.tenantId,
        topic: 'quote.created.notify',
        aggregateId: quote.id,
        payload: { quoteId: quote.id, kind: 'contact' },
        dedupeKey: `quote-created:${quote.id}`,
      })
      return quote
    })
  }
}
