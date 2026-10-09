import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import { Prisma, type PrismaClient } from '@prisma/client'
import {
  formatQuoteCode,
  parseQuoteCodeSequence,
} from '@gb-locacoes/domain/orcamento'

/** Conexão explícita da composição (transação da locadora ou cliente Prisma). */
export type QuoteCodeDbClient = PrismaClient | Prisma.TransactionClient

export async function generateNextQuoteCode(
  context: TenantContext,
  db: QuoteCodeDbClient,
  referenceDate = new Date()
): Promise<string> {
  const year = referenceDate.getFullYear()
  const prefix = `Q-${year}-`

  const latestCode = await db.quote.findFirst({
    where: {
      tenantId: context.tenantId,
      quoteCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quoteCode: 'desc',
    },
    select: {
      quoteCode: true,
    },
  })

  const nextSequence = parseQuoteCodeSequence(latestCode?.quoteCode) + 1
  return formatQuoteCode(year, nextSequence)
}

export async function assignQuoteCode(
  context: TenantContext,
  db: QuoteCodeDbClient,
  quoteId: string,
  referenceDate = new Date()
): Promise<string> {
  let attempts = 0
  while (attempts < 5) {
    attempts += 1
    const candidate = await generateNextQuoteCode(context, db, referenceDate)
    try {
      await db.quote.update({
        where: { id: quoteId, tenantId: context.tenantId },
        data: { quoteCode: candidate },
      })
      return candidate
    } catch (error) {
      // Retry on unique conflict only.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error(
    'Não foi possível gerar quoteCode único após múltiplas tentativas'
  )
}
