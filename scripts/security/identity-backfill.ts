import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { migrateLegacyIdentities } from '@gb-locacoes/backend/identity'

async function main() {
  if (process.env.AUTH_MODE === 'better-auth')
    throw new Error('Backfill is forbidden after cutover')
  const args = new Set(process.argv.slice(2))
  if (
    [...args].some(
      (arg) =>
        !['--apply', '--confirm=identity-backfill', '--allow-remote'].includes(
          arg
        )
    )
  )
    throw new Error('Unknown argument')
  const apply = args.has('--apply')
  if (apply && !args.has('--confirm=identity-backfill'))
    throw new Error('Explicit operation confirmation is required')
  if (apply && process.env.AUTH_CREDENTIAL_WRITES_PAUSED !== 'true')
    throw new Error('Credential writers must be paused for backfill')
  const target = new URL(process.env.DATABASE_URL || '')
  if (!['postgres:', 'postgresql:'].includes(target.protocol))
    throw new Error('Invalid database target')
  const remote = !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  if (remote && !args.has('--allow-remote'))
    throw new Error('Remote inspection requires --allow-remote')
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    const report = await migrateLegacyIdentities(prisma, apply)
    console.log(
      JSON.stringify({ ...report, target: remote ? 'remote' : 'loopback' })
    )
    if (!report.canApply) process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(() => {
  console.error(
    'Identity preflight/backfill failed. Check the target, schema, confirmation and credential conflicts. No credentials are logged.'
  )
  process.exitCode = 1
})
