import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

class PlatformDatabaseUnavailable extends Error {
  constructor() {
    super('Platform database unavailable')
  }
}

type PlatformRuntime = { prisma: PrismaClient; pool: Pool }
// Module-owned state respects the server's prohibition on rewriting global runtime objects.
let platformRuntime:
  (PlatformRuntime & { connectionString: string }) | undefined

function parseConnection(value: string | undefined, allowOptions = false): URL {
  try {
    const url = new URL(value ?? '')
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2 ||
      (!allowOptions && url.searchParams.has('options'))
    )
      throw new PlatformDatabaseUnavailable()
    return url
  } catch {
    throw new PlatformDatabaseUnavailable()
  }
}

function platformConnection(
  env: Readonly<Record<string, string | undefined>>
): string {
  const connectionString = env.PLATFORM_DATABASE_URL
  const platform = parseConnection(connectionString)
  if (env.DATABASE_URL) {
    const business = parseConnection(env.DATABASE_URL, true)
    if (
      platform.hostname === business.hostname &&
      (platform.port || '5432') === (business.port || '5432') &&
      platform.pathname === business.pathname &&
      platform.username === business.username
    )
      throw new PlatformDatabaseUnavailable()
  }
  return connectionString!
}

/** Separate owned pool for operator commands. Never falls back to DATABASE_URL. */
export function createPlatformDatabaseRuntime(
  env: Readonly<Record<string, string | undefined>>
): PlatformRuntime {
  const connectionString = platformConnection(env)
  const pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  return { prisma, pool }
}

export function getPlatformDatabaseRuntime(): PlatformRuntime {
  const connectionString = platformConnection(process.env)
  const cached = platformRuntime
  // Rotation of a live pool requires a process restart, rather than mixing identities.
  if (cached) {
    if (cached.connectionString !== connectionString)
      throw new PlatformDatabaseUnavailable()
    return { prisma: cached.prisma, pool: cached.pool }
  }
  const runtime = createPlatformDatabaseRuntime(process.env)
  platformRuntime = { ...runtime, connectionString: connectionString! }
  return runtime
}
