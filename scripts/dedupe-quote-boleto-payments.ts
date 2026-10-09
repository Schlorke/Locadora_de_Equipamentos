import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

async function main() {
  const { getDatabaseRuntime } = await import('@gb-locacoes/backend/runtime')
  const { prisma } = getDatabaseRuntime()

  const duplicates = await prisma.payment.groupBy({
    by: ['quoteId', 'method', 'type'],
    where: {
      quoteId: { not: null },
      method: 'BOLETO',
      type: 'RENTAL',
    },
    _count: {
      _all: true,
    },
    having: {
      quoteId: { _count: { gt: 1 } },
    },
  })

  if (duplicates.length === 0) {
    console.log('Nenhuma duplicidade encontrada para boletos de orçamento.')
    return
  }

  let removed = 0

  for (const duplicate of duplicates) {
    if (!duplicate.quoteId) continue

    const payments = await prisma.payment.findMany({
      where: {
        quoteId: duplicate.quoteId,
        method: duplicate.method,
        type: duplicate.type,
      },
      orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    })

    const paid = payments.filter((payment) => payment.status === 'PAID')
    const keeper = (paid.length > 0 ? paid : payments)[0]
    if (!keeper) continue

    const toDelete = payments
      .filter((payment) => payment.id !== keeper.id)
      .map((payment) => payment.id)

    if (toDelete.length === 0) continue

    const result = await prisma.payment.deleteMany({
      where: {
        id: { in: toDelete },
      },
    })
    removed += result.count

    console.log(
      `Quote ${duplicate.quoteId}: mantido ${keeper.id}, removidos ${result.count}.`
    )
  }

  console.log(`Deduplicação concluída. Pagamentos removidos: ${removed}.`)
}

main()
  .catch((error) => {
    console.error('Erro ao deduplicar pagamentos de boleto:', error)
    process.exit(1)
  })
  .finally(async () => {
    try {
      const { getDatabaseRuntime } =
        await import('@gb-locacoes/backend/runtime')
      await getDatabaseRuntime().prisma.$disconnect()
    } catch {
      // noop
    }
  })
