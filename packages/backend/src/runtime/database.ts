import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

declare global {
  var __prisma: PrismaClient | undefined
  var __pool: Pool | undefined
}

/** Um pool/client por processo, inclusive quando o Next recompila um módulo. Sem conexão no import. */
export function getDatabaseRuntime() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const isTransactionPooler = connectionString.includes(':6543/')
  const pool =
    global.__pool ||
    new Pool({
      connectionString,
      max: isTransactionPooler ? 2 : 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: isTransactionPooler ? 0 : undefined,
    })
  global.__pool = pool
  const prisma =
    global.__prisma || new PrismaClient({ adapter: new PrismaPg(pool) })
  global.__prisma = prisma
  return { prisma, pool }
}
