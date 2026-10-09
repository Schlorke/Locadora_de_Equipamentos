import { requireTestDatabase } from './helpers/test-database'
import { stopOwnedProcess } from './helpers/owned-process'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const DEFAULT_TEST_PORT = 3101
const HEALTH_TIMEOUT_MS = 2000
const STARTUP_TIMEOUT_MS = 60000
const DB_SYNC_TIMEOUT_MS = 120000

function assertSafeTestDatabase() {
  return requireTestDatabase(process.env)
}

function resolveTestTarget() {
  const baseUrlEnv = process.env.TEST_BASE_URL
  const portEnv = process.env.TEST_PORT
  const parsedPort = baseUrlEnv ? new URL(baseUrlEnv).port : null
  const portFromBase = parsedPort ? Number(parsedPort) : null
  const port = portEnv ? Number(portEnv) : (portFromBase ?? DEFAULT_TEST_PORT)
  const baseUrl = baseUrlEnv || `http://localhost:${port}`

  if (baseUrlEnv && !parsedPort) {
    throw new Error('TEST_BASE_URL must include an explicit port')
  }

  if (Number.isNaN(port)) {
    throw new Error('TEST_PORT must be a valid number')
  }

  if (baseUrlEnv && parsedPort && Number(parsedPort) !== port) {
    throw new Error('TEST_PORT does not match TEST_BASE_URL')
  }

  const target = new URL(baseUrl)
  if (
    target.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.username ||
    target.password
  ) {
    throw new Error(
      'HTTP integration tests only run against a local test server'
    )
  }
  return { baseUrl, port }
}

async function isHealthOk(baseUrl: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: controller.signal,
    })
    if (!response.ok) return false
    const data = (await response.json().catch(() => null)) as {
      status?: string
    } | null
    return data?.status === 'healthy'
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForHealth(baseUrl: string, timeoutMs: number) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isHealthOk(baseUrl)) return true
    await delay(1000)
  }
  return false
}

async function syncTestDatabaseSchema(databaseUrl: string) {
  const prismaCliPath = join(
    process.cwd(),
    'node_modules',
    'prisma',
    'build',
    'index.js'
  )

  if (!existsSync(prismaCliPath)) {
    throw new Error(
      `Prisma CLI not found at ${prismaCliPath}. Please run 'pnpm install' first.`
    )
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [prismaCliPath, 'migrate', 'deploy'],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DIRECT_URL: databaseUrl,
        },
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    )

    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGTERM')
      }
      reject(
        new Error(
          `Prisma test schema sync timed out after ${DB_SYNC_TIMEOUT_MS}ms`
        )
      )
    }, DB_SYNC_TIMEOUT_MS)

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(`Failed to sync test database schema (exit code: ${code})`)
      )
    })
  })
}

/**
 * Bancos reais que o servidor de teste nunca alcança: o papel de plataforma e as URLs das checagens de papel. Ficam
 * vazios mesmo quando o shell não os define, porque o next dev completa pelos arquivos .env só o que está indefinido
 * (@next/env); vazio não é indefinido. tests/api-host/global-setup.ts faz o mesmo nos hosts de paridade.
 */
const REAL_DATABASE_URLS = [
  'PLATFORM_DATABASE_URL',
  'PLATFORM_RUNTIME_DATABASE_URL',
  'TENANT_RUNTIME_DATABASE_URL',
]

/**
 * Arquivos de ambiente que o @next/env lê na pasta do servidor, em qualquer modo (development, test ou production).
 */
const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
  '.env.production',
  '.env.production.local',
]

/**
 * Chaves definidas nos arquivos de ambiente de `projectDir`. Lê todo início de linha no formato do dotenv
 * (`KEY=`, `export KEY=`, `KEY: `), inclusive dentro de um valor de várias linhas: sobra chave, nunca falta.
 */
function envFileKeys(projectDir: string): string[] {
  const keys = new Set<string>()
  for (const file of ENV_FILES) {
    let content: string
    try {
      content = readFileSync(join(projectDir, file), 'utf8')
    } catch {
      continue
    }
    for (const match of content.matchAll(
      /^[^\S\r\n]*(?:export[^\S\r\n]+)?([\w.-]+)[^\S\r\n]*(?:=|:(?:\s|$))/gm
    ))
      keys.add(match[1]!)
  }
  return [...keys]
}

/** NODE_ENV escolhe o modo do próprio Next: não é segredo e não se esvazia. */
const MODE_KEYS = new Set(['NODE_ENV'])

/**
 * Servidor da suíte de integração (onda 135, E4): a API compartilhada compilada (`pnpm build:api`), pelo servidor
 * standalone do Next, nunca o `next dev` da raiz legada. O servidor muda o diretório para a pasta do standalone e o
 * @next/env lê os .env de lá; as pastas de projeto abaixo têm as chaves neutralizadas (raiz, fonte e standalone).
 */
export const INTEGRATION_API_PROJECT = join('apps', 'services', 'api')
export const INTEGRATION_API_SERVER = join(
  INTEGRATION_API_PROJECT,
  '.next',
  'standalone',
  'apps',
  'services',
  'api',
  'server.js'
)

/**
 * Ambiente do servidor da suíte de integração: o do processo, apontado para o banco descartável. Toda outra URL de
 * banco (as conhecidas e qualquer `*DATABASE_URL` herdada) chega vazia, assim como o armazenamento e a conta raiz do
 * Asaas reais, que a integração não usa (onda 132, achado 145). Com `projectDir` (a pasta do servidor), toda chave dos
 * arquivos .env que o processo não define também chega vazia, inclusive na recarga do next dev quando um .env muda:
 * o servidor de teste não recebe segredo do desenvolvedor. O NextAuth usa o segredo do shell ou um de fixture, e a
 * URL do próprio servidor, como o job de testes da CI.
 */
export function testServerEnvironment<
  Env extends Record<string, string | undefined>,
>(
  env: Env,
  target: { databaseUrl: string; port: number; baseUrl: string },
  projectDir?: string | string[]
): Env {
  const realDatabases = [
    ...new Set([
      ...REAL_DATABASE_URLS,
      ...Object.keys(env).filter((key) => key.endsWith('DATABASE_URL')),
    ]),
  ].filter((key) => key !== 'DATABASE_URL' && key !== 'TEST_DATABASE_URL')
  const projectDirs =
    projectDir === undefined
      ? []
      : Array.isArray(projectDir)
        ? projectDir
        : [projectDir]
  const developerFiles = [
    ...new Set(projectDirs.flatMap((dir) => envFileKeys(dir))),
  ].filter((key) => env[key] === undefined && !MODE_KEYS.has(key))
  return {
    ...env,
    ...Object.fromEntries(developerFiles.map((key) => [key, ''])),
    ...Object.fromEntries(realDatabases.map((key) => [key, ''])),
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET || 'local-integration-only-secret',
    NEXTAUTH_URL: env.NEXTAUTH_URL || target.baseUrl,
    DATABASE_URL: target.databaseUrl,
    DIRECT_URL: target.databaseUrl,
    NEXT_PUBLIC_SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    PLATFORM_ASAAS_ROOT_API_KEY: '',
    PLATFORM_ASAAS_EGRESS_PROXY_URL: '',
    PLATFORM_ASAAS_OUTBOUND_DISABLED: 'true',
    PORT: String(target.port),
    TEST_BASE_URL: target.baseUrl,
    TEST_PORT: String(target.port),
    TEST_MODE: 'true',
    ASAAS_API_KEY: '',
    RESEND_API_KEY: '',
    FROM_EMAIL: '',
    CONTACT_EMAIL: '',
    AUTO_GENERATE_BOLETO_ON_QUOTE: 'true',
  }
}

export default async function setup() {
  const databaseUrl = assertSafeTestDatabase()
  if (process.env.TEST_DATABASE_DISPOSABLE !== 'true') {
    throw new Error(
      'Set TEST_DATABASE_DISPOSABLE=true only for an isolated disposable database'
    )
  }
  await syncTestDatabaseSchema(databaseUrl)

  const { baseUrl, port } = resolveTestTarget()

  if (await isHealthOk(baseUrl)) {
    throw new Error(
      'Test port is occupied; refusing to reuse a server with an unknown database'
    )
  }

  // A API compartilhada compilada (standalone), nunca o next dev da raiz legada (onda 135, E4).
  const serverPath = join(process.cwd(), INTEGRATION_API_SERVER)
  if (!existsSync(serverPath)) {
    throw new Error(
      `Shared API build not found at ${serverPath}. Run 'pnpm build:api' before 'pnpm test:integration'.`
    )
  }
  const projectDir = join(process.cwd(), INTEGRATION_API_PROJECT)
  const serverEnv = {
    ...testServerEnvironment(process.env, { databaseUrl, port, baseUrl }, [
      process.cwd(),
      projectDir,
      dirname(serverPath),
    ]),
    // O standalone é o servidor de produção: NODE_ENV fixo e só a interface local do alvo.
    NODE_ENV: 'production',
    HOSTNAME: new URL(baseUrl).hostname.replace(/^[|]$/g, ''),
    NEXT_TELEMETRY_DISABLED: '1',
  }

  // Entrypoint Node (sem .cmd no Windows).
  const child = spawn(process.execPath, [serverPath], {
    env: serverEnv,
    stdio: 'inherit',
    cwd: projectDir,
  })

  const ready = await waitForHealth(baseUrl, STARTUP_TIMEOUT_MS)
  if (!ready) {
    await stopOwnedProcess(child)
    throw new Error(`Test server failed to start at ${baseUrl}`)
  }

  return async () => {
    await stopOwnedProcess(child)
  }
}
