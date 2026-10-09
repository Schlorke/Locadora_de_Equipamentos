import { createMemoryIdempotencyCache } from '@gb-locacoes/backend/http'
export const { checkIdempotency, storeIdempotency } =
  createMemoryIdempotencyCache()
