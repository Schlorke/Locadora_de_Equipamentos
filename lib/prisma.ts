import { getDatabaseRuntime } from '@gb-locacoes/backend/runtime'

const { prisma } = getDatabaseRuntime()

// Função de verificação de conexão
export async function checkDatabaseConnection(): Promise<{
  connected: boolean
  error?: string
}> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { connected: true }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export { prisma }
