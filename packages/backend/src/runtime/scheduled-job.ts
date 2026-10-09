import type { Prisma } from '@prisma/client'
export type CronBudget = { deadline: number; minRemainingMs: number }
export type ScheduledJobResult = { body: unknown; status: number }
export type ScheduledTransaction = <T>(
  context: { tenantId: string },
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number }
) => Promise<T>
export function scheduledJobResult(
  body: unknown,
  init?: { status?: number }
): ScheduledJobResult {
  return { body, status: init?.status ?? 200 }
}
