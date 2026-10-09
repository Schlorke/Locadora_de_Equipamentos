import type { NextRequest } from 'next/server'
import { createMemoryRateLimiters } from '@gb-locacoes/backend/http'
import { clientIpFromHeaders } from '@gb-locacoes/backend/identity'

const memoryLimiters = createMemoryRateLimiters<NextRequest>({
  clientIp: clientIpFromHeaders,
})
export const adminApiRateLimit = memoryLimiters.adminApiRateLimit
export const checkRateLimit = memoryLimiters.checkRateLimit
export const strictRateLimit = memoryLimiters.strictRateLimit
