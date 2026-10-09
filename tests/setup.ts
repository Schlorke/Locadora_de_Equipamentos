import '@testing-library/jest-dom'
import { afterAll } from 'vitest'
import { applyTestDatabase } from './helpers/test-database'

// Valida o banco descartável e aponta DATABASE_URL/DIRECT_URL para ele, lembrando o banco real substituído: as
// fixtures (requireTestDatabase) e a reentrada deste setup aceitam o valor gravado e seguem recusando o banco real.
applyTestDatabase(process.env)

const testPort = process.env.TEST_PORT || '3101'
process.env.TEST_BASE_URL =
  process.env.TEST_BASE_URL || `http://localhost:${testPort}`
process.env.REQUIRE_SERVER_TESTS = process.env.REQUIRE_SERVER_TESTS || 'true'
process.env.ASAAS_API_KEY = ''
process.env.RESEND_API_KEY = ''
process.env.FROM_EMAIL = ''
process.env.CONTACT_EMAIL = ''
process.env.AUTO_GENERATE_BOLETO_ON_QUOTE =
  process.env.AUTO_GENERATE_BOLETO_ON_QUOTE || 'true'
process.env.TEST_MODE = process.env.TEST_MODE || 'true'
process.env.TZ = process.env.TZ || 'UTC'
process.env.TEST_RUN_ID =
  process.env.TEST_RUN_ID ||
  `test-${Date.now()}-${Math.random().toString(16).slice(2)}`

afterAll(async () => {
  // O runtime do backend (o mesmo singleton da API compartilhada e das fixtures), não a fachada da raiz legada.
  const { getDatabaseRuntime } = await import('@gb-locacoes/backend/runtime')
  await getDatabaseRuntime().prisma.$disconnect()
})
