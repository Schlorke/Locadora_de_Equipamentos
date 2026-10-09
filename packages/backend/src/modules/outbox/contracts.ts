export type OutboxMessage<Tenant extends string | null = string> = {
  id: string
  tenantId: Tenant
  topic: string
  aggregateId: string
  payload: unknown
  dedupeKey: string
  attempts: number
  lockedBy: string
}

export interface OutboxRepository<Tenant extends string | null = string> {
  claim(
    workerId: string,
    now: Date,
    leaseMs: number
  ): Promise<OutboxMessage<Tenant> | null>
  complete(message: OutboxMessage<Tenant>, now: Date): Promise<boolean>
  fail(
    message: OutboxMessage<Tenant>,
    code: string,
    availableAt: Date,
    terminal: boolean
  ): Promise<boolean>
}

export type OutboxHandler<Tenant extends string | null = string> = (
  message: OutboxMessage<Tenant>
) => Promise<void>
