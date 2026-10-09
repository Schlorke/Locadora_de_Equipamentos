import type { Prisma } from '@prisma/client'

/** Retain consumer fields only. Provider credentials, customer PII and arbitrary extras are discarded. */
export function asaasReceiptPayload(body: unknown): Prisma.InputJsonObject {
  const record = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  const pick = (row: Record<string, unknown>, fields: readonly string[]) => {
    const result: Record<string, Prisma.InputJsonValue | null> = {}
    for (const field of fields) {
      const value = row[field]
      if (
        value === null ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 512)
      )
        result[field] = value
    }
    return result
  }
  const row = record(body)
  if (!row) return {}
  const result = pick(row, ['id', 'event', 'dateCreated'])
  for (const [key, fields] of [
    ['account', ['id']],
    [
      'payment',
      [
        'id',
        'status',
        'value',
        'netValue',
        'billingType',
        'customer',
        'subscription',
        'externalReference',
        'dueDate',
        'paymentDate',
        'clientPaymentDate',
        'deleted',
      ],
    ],
    [
      'subscription',
      [
        'id',
        'status',
        'value',
        'cycle',
        'billingType',
        'customer',
        'nextDueDate',
        'externalReference',
        'deleted',
      ],
    ],
    [
      'accountStatus',
      ['id', 'commercialInfo', 'bankAccountInfo', 'documentation', 'general'],
    ],
    ['accessToken', ['id', 'enabled', 'expirationDate']],
  ] as const) {
    const resource = record(row[key])
    if (resource) result[key] = pick(resource, fields)
  }
  return result
}
