import { planTenantMaintenance } from './security/tenant-maintenance'
import { pathToFileURL } from 'node:url'

export function planBackfill(args: string[], env: NodeJS.ProcessEnv) {
  return planTenantMaintenance(args, env, 'backfill-quote-codes')
}

export async function runBackfill(args: string[], env: NodeJS.ProcessEnv) {
  const plan = planBackfill(args, env)
  const [{ PrismaClient }, { PrismaPg }, { assignQuoteCode }] =
    await Promise.all([
      import('@prisma/client'),
      import('@prisma/adapter-pg'),
      import('@gb-locacoes/backend/quotations'),
    ])
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: plan.connectionString }),
  })
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${plan.tenantId}, true)`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(${plan.tenantId}))`
        const organization = await tx.organization.findUnique({
          where: { id: plan.tenantId },
          select: { status: true },
        })
        if (!organization || organization.status !== 'ACTIVE')
          throw new Error('Locadora ativa não encontrada')
        const quotes = await tx.quote.findMany({
          where: { tenantId: plan.tenantId, quoteCode: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, createdAt: true },
        })
        if (plan.apply)
          for (const quote of quotes)
            await assignQuoteCode(
              { tenantId: plan.tenantId },
              tx,
              quote.id,
              quote.createdAt
            )
        return {
          tenantId: plan.tenantId,
          mode: plan.apply ? 'applied' : 'dry-run',
          count: quotes.length,
        }
      },
      { timeout: 60000, maxWait: 15000 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runBackfill(process.argv.slice(2), process.env)
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        'Backfill não executado ou revertido. Verifique tenant, banco local descartável e confirmações explícitas. Credenciais não são registradas.'
      )
      process.exitCode = 1
    })
}
