/**
 * Ambiente do servidor de teste da suíte de integração (tests/global-setup.ts, onda 132, achado 145). O next dev herda
 * o ambiente do processo e ainda lê os arquivos .env, que só preenchem variáveis indefinidas (@next/env): uma URL real
 * de banco, armazenamento ou conta raiz precisa chegar vazia, nunca ausente, para não ser herdada nem relida.
 */
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'dotenv'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import setup, { testServerEnvironment } from '../global-setup'

// O setup sobe o Prisma e o next dev por spawn: aqui o spawn é um dublê que só registra o ambiente recebido.
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  spawn: vi.fn(),
}))

const disposable =
  'postgresql://runner:secret@127.0.0.1:55441/w_integration_test'
const target = {
  databaseUrl: disposable,
  port: 3101,
  baseUrl: 'http://localhost:3101',
}
const real = 'postgresql://app:secret@db.example.com:5432/gb'

describe('integration test server environment', () => {
  it('blanks every real database URL inherited from the shell, never only the business one', () => {
    const env = testServerEnvironment(
      {
        DATABASE_URL: real,
        DIRECT_URL: real,
        TEST_DATABASE_URL: disposable,
        PLATFORM_DATABASE_URL: 'postgresql://platform:secret@db.example.com/gb',
        PLATFORM_RUNTIME_DATABASE_URL:
          'postgresql://runtime:secret@db.example.com/gb',
        TENANT_RUNTIME_DATABASE_URL:
          'postgresql://tenant:secret@db.example.com/gb',
        SHADOW_DATABASE_URL: 'postgresql://shadow:secret@db.example.com/gb',
      },
      target
    )
    expect(env).toMatchObject({
      DATABASE_URL: disposable,
      DIRECT_URL: disposable,
      TEST_DATABASE_URL: disposable,
      PLATFORM_DATABASE_URL: '',
      PLATFORM_RUNTIME_DATABASE_URL: '',
      TENANT_RUNTIME_DATABASE_URL: '',
      SHADOW_DATABASE_URL: '',
    })
  })

  it('sets the platform databases to empty even when the shell does not define them, so .env files cannot fill them', () => {
    const env = testServerEnvironment({}, target)
    for (const key of [
      'PLATFORM_DATABASE_URL',
      'PLATFORM_RUNTIME_DATABASE_URL',
      'TENANT_RUNTIME_DATABASE_URL',
    ]) {
      expect(env).toHaveProperty(key, '')
    }
  })

  it('cuts real storage and the platform Asaas root account, which the integration suite never uses', () => {
    const env = testServerEnvironment(
      {
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        PLATFORM_ASAAS_ROOT_API_KEY: 'root-api-key',
        PLATFORM_ASAAS_EGRESS_PROXY_URL: 'http://proxy.example.com:3128',
        PLATFORM_ASAAS_OUTBOUND_DISABLED: 'false',
        ASAAS_API_KEY: 'tenant-api-key',
        RESEND_API_KEY: 'resend-key',
      },
      target
    )
    expect(env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      PLATFORM_ASAAS_ROOT_API_KEY: '',
      PLATFORM_ASAAS_EGRESS_PROXY_URL: '',
      PLATFORM_ASAAS_OUTBOUND_DISABLED: 'true',
      ASAAS_API_KEY: '',
      RESEND_API_KEY: '',
    })
  })

  it('keeps the rest of the environment and the test server target, without touching the parent environment', () => {
    const parent = {
      PATH: '/usr/bin',
      NODE_OPTIONS: '--max-old-space-size=4096',
      NEXTAUTH_SECRET: 'fixture-secret',
      PLATFORM_DATABASE_URL: 'postgresql://platform:secret@db.example.com/gb',
    }
    const snapshot = { ...parent }
    const env = testServerEnvironment(parent, target)
    expect(parent).toEqual(snapshot)
    expect(env).toMatchObject({
      PATH: '/usr/bin',
      NODE_OPTIONS: '--max-old-space-size=4096',
      NEXTAUTH_SECRET: 'fixture-secret',
      PORT: '3101',
      TEST_PORT: '3101',
      TEST_BASE_URL: 'http://localhost:3101',
      TEST_MODE: 'true',
      AUTO_GENERATE_BOLETO_ON_QUOTE: 'true',
    })
  })
})

/**
 * O next dev do servidor de integração roda na raiz e completa pelos arquivos .env do desenvolvedor toda variável que o
 * ambiente recebido não define: segredos reais (Google Merchant, Zoho, cron, webhook do Asaas, NextAuth) chegavam ao
 * servidor de teste (onda 132, achado 145, segunda rodada). Toda chave desses arquivos que o shell não define chega
 * vazia; o NextAuth recebe um segredo de fixture e a URL do próprio servidor, como na CI.
 */
const temporaryDirs: string[] = []

function projectWith(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locadora-global-setup-'))
  temporaryDirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0))
    fs.rmSync(dir, { recursive: true, force: true })
})

const developerEnvFiles = {
  '.env': [
    '# credenciais reais do desenvolvedor',
    'CRON_SECRET=real-cron-secret',
    'export ZOHO_CLIENT_SECRET="real-zoho-secret"',
    "ASAAS_WEBHOOK_SECRET: 'real-webhook-secret'",
    'GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY="{',
    '  "type": "service_account",',
    '  "private_key": "-----BEGIN PRIVATE KEY-----\\nreal\\n-----END PRIVATE KEY-----"',
    '}"',
    'NEXTAUTH_SECRET=real-nextauth-secret',
    'NEXTAUTH_URL=http://localhost:3000',
    'PLATFORM_DATABASE_URL=postgresql://platform:real@db.example.com/gb',
    '  SPACED.KEY-NAME = real-spaced',
    'COLON_AT_END:',
    'real-value-on-next-line',
  ].join('\r\n'),
  '.env.local': 'LOCAL_ONLY_SECRET=real-local\n',
  '.env.development': 'DEVELOPMENT_SECRET=real-development\n',
  '.env.development.local': 'DEVELOPMENT_LOCAL_SECRET=real-development-local\n',
  '.env.test': 'TEST_FILE_SECRET=real-test\n',
  '.env.test.local': 'TEST_LOCAL_SECRET=real-test-local\n',
}

/** Chaves que o dotenv (o mesmo leitor do @next/env) encontra nos arquivos do projeto. */
const fileKeys = Object.values(developerEnvFiles).flatMap((content) =>
  Object.keys(parse(content))
)

describe('integration test server environment against the developer env files', () => {
  it('blanks every key the env files define and the shell does not, keeping what the shell defines', () => {
    const dir = projectWith(developerEnvFiles)
    const env = testServerEnvironment(
      { PATH: '/usr/bin', CRON_SECRET: 'shell-cron-secret' },
      target,
      dir
    )
    expect(fileKeys).toEqual(
      expect.arrayContaining([
        'ZOHO_CLIENT_SECRET',
        'ASAAS_WEBHOOK_SECRET',
        'GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY',
        'SPACED.KEY-NAME',
        'COLON_AT_END',
        'LOCAL_ONLY_SECRET',
        'TEST_LOCAL_SECRET',
      ])
    )
    for (const key of fileKeys) {
      if (['CRON_SECRET', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'].includes(key))
        continue
      expect(env, key).toHaveProperty([key], '')
    }
    expect(env).toMatchObject({
      PATH: '/usr/bin',
      CRON_SECRET: 'shell-cron-secret',
      NEXTAUTH_SECRET: 'local-integration-only-secret',
      NEXTAUTH_URL: 'http://localhost:3101',
    })
  })

  it('keeps NextAuth values the shell defines, as the CI job does', () => {
    const dir = projectWith(developerEnvFiles)
    const env = testServerEnvironment(
      {
        NEXTAUTH_SECRET: 'ci-only-not-a-production-secret',
        NEXTAUTH_URL: 'http://localhost:3101',
      },
      target,
      dir
    )
    expect(env).toMatchObject({
      NEXTAUTH_SECRET: 'ci-only-not-a-production-secret',
      NEXTAUTH_URL: 'http://localhost:3101',
    })
  })

  /**
   * Prova com o @next/env instalado (o carregador do next dev), num processo à parte: a primeira carga e a recarga
   * forçada que o next dev faz quando um .env muda não trazem nenhum valor dos arquivos. Sem a neutralização, os
   * mesmos arquivos chegam ao ambiente (controle).
   */
  it.each(['test', 'development'])(
    'the installed @next/env loads no developer value into the server (NODE_ENV=%s)',
    (nodeEnv) => {
      const dir = projectWith(developerEnvFiles)
      const require = createRequire(import.meta.url)
      const nextEnv = createRequire(
        require.resolve('next/package.json')
      ).resolve('@next/env')
      const keys = [...fileKeys, 'NEXTAUTH_SECRET', 'NEXTAUTH_URL']
      const probe = [
        'const { loadEnvConfig } = require(process.argv[1])',
        'const quiet = { info() {}, error() {} }',
        'const pick = () => Object.fromEntries(JSON.parse(process.argv[3]).map((key) => [key, process.env[key]]))',
        'loadEnvConfig(process.argv[2], true, quiet)',
        'const first = pick()',
        'loadEnvConfig(process.argv[2], true, quiet, true)',
        'console.log(JSON.stringify({ first, reloaded: pick() }))',
      ].join('\n')
      const run = (env: Record<string, string | undefined>) => {
        const result = spawnSync(
          process.execPath,
          ['-e', probe, nextEnv, dir, JSON.stringify(keys)],
          { env: env as NodeJS.ProcessEnv, encoding: 'utf8' }
        )
        expect(result.stderr).toBe('')
        return JSON.parse(result.stdout) as Record<
          'first' | 'reloaded',
          Record<string, string | undefined>
        >
      }
      const shell = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: nodeEnv,
      }
      const leaked = (values: Record<string, string | undefined>) =>
        Object.entries(values).filter(([, value]) => value?.startsWith('real'))
      // Controle: o ambiente do shell, sem neutralização, recebe os valores reais dos arquivos.
      expect(leaked(run(shell).first).length).toBeGreaterThan(3)
      const loaded = run(testServerEnvironment(shell, target, dir))
      for (const values of [loaded.first, loaded.reloaded]) {
        expect(leaked(values)).toEqual([])
        expect(values).toMatchObject({
          NEXTAUTH_SECRET: 'local-integration-only-secret',
          NEXTAUTH_URL: 'http://localhost:3101',
          ZOHO_CLIENT_SECRET: '',
          GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY: '',
        })
      }
    }
  )
})

/**
 * Montagem real do setup (tests/global-setup.ts): o ambiente que chega ao spawn do servidor é o neutralizado, com o
 * banco descartável, e o do Prisma aponta só para ele. Um setup que volte a espalhar process.env reprova aqui. O
 * servidor é a API compartilhada compilada (standalone), nunca o next dev da raiz legada (onda 135, E4).
 */
describe('integration global setup wiring', () => {
  const spawned = vi.mocked(spawn)

  beforeEach(() => {
    for (const key of [
      'PGHOST',
      'PGPORT',
      'PGDATABASE',
      'PGUSER',
      'TEST_BASE_URL',
    ])
      vi.stubEnv(key, undefined)
    vi.stubEnv('TEST_DATABASE_DISPOSABLE', 'true')
    vi.stubEnv('TEST_DATABASE_URL', disposable)
    vi.stubEnv('DATABASE_URL', real)
    vi.stubEnv('DIRECT_URL', real)
    vi.stubEnv('TEST_PORT', '3101')
    // O shell não define nenhuma chave dos arquivos: todas chegariam ao servidor pelo @next/env.
    for (const key of fileKeys) vi.stubEnv(key, undefined)
    vi.stubEnv(
      'PLATFORM_DATABASE_URL',
      'postgresql://platform:secret@db.example.com/gb'
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('refuses to start without the compiled shared API, instead of falling back to the legacy root', async () => {
    const dir = projectWith({
      'node_modules/prisma/build/index.js': '',
      'node_modules/next/dist/bin/next': '',
    })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    spawned.mockImplementation(((command: string, args: string[]) => {
      const child = Object.assign(new EventEmitter(), {
        pid: 4242,
        exitCode: null,
        kill: vi.fn(),
        command,
        args,
      })
      queueMicrotask(() => child.emit('close', 0))
      return child
    }) as unknown as typeof spawn)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      })
    )
    await expect(setup()).rejects.toThrow(
      "Run 'pnpm build:api' before 'pnpm test:integration'"
    )
    // Só o Prisma rodou: nenhum servidor (nem o next da raiz) foi iniciado.
    expect(spawned).toHaveBeenCalledTimes(1)
    expect(spawned.mock.calls[0]?.[1]).toContain('migrate')
  })

  it('hands the compiled shared API server the neutralized environment and Prisma only the disposable database', async () => {
    const dir = projectWith({
      ...developerEnvFiles,
      'apps/services/api/.env.local': 'API_ONLY_SECRET=real-api-local\n',
      'apps/services/api/.next/standalone/apps/services/api/.env.production':
        'STANDALONE_SECRET=real-standalone\n',
      'apps/services/api/.next/standalone/apps/services/api/server.js': '',
      'node_modules/prisma/build/index.js': '',
      'node_modules/next/dist/bin/next': '',
    })
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const children: EventEmitter[] = []
    spawned.mockImplementation(((command: string, args: string[]) => {
      const child = Object.assign(new EventEmitter(), {
        pid: 4242,
        exitCode: null as number | null,
        signalCode: null,
        kill: vi.fn(),
        command,
        args,
      })
      children.push(child)
      const exit = () => {
        child.exitCode = 0
        child.emit('exit', 0, null)
        child.emit('close', 0, null)
      }
      child.kill.mockImplementation(() => {
        queueMicrotask(exit)
        return true
      })
      // O Prisma e o taskkill terminam com sucesso; o servidor segue no ar até o teardown.
      if (!String(args[0]).endsWith('server.js'))
        queueMicrotask(() => {
          if (command === 'taskkill') {
            const server = children[1] as EventEmitter & {
              exitCode: number | null
            }
            server.exitCode = 0
            server.emit('exit', 0, null)
            server.emit('close', 0, null)
          }
          exit()
        })
      return child
    }) as unknown as typeof spawn)
    let healthChecks = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        healthChecks += 1
        // A porta está livre antes do spawn; depois o servidor responde saudável.
        if (healthChecks === 1) throw new Error('ECONNREFUSED')
        return Response.json({ status: 'healthy' })
      })
    )

    const teardown = await setup()

    const [prisma, server] = spawned.mock.calls
    expect(prisma?.[1]).toEqual([
      path.join(dir, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'deploy',
    ])
    expect(prisma?.[2]?.env).toMatchObject({
      DATABASE_URL: disposable,
      DIRECT_URL: disposable,
    })
    const standalone = path.join(
      dir,
      'apps',
      'services',
      'api',
      '.next',
      'standalone',
      'apps',
      'services',
      'api',
      'server.js'
    )
    expect(server?.[1]).toEqual([standalone])
    expect(server?.[2]?.cwd).toBe(path.join(dir, 'apps', 'services', 'api'))
    const serverEnv = server?.[2]?.env as Record<string, string | undefined>
    expect(serverEnv).toMatchObject({
      NODE_ENV: 'production',
      HOSTNAME: 'localhost',
      API_ONLY_SECRET: '',
      STANDALONE_SECRET: '',
      DATABASE_URL: disposable,
      DIRECT_URL: disposable,
      PLATFORM_DATABASE_URL: '',
      PLATFORM_RUNTIME_DATABASE_URL: '',
      TENANT_RUNTIME_DATABASE_URL: '',
      ZOHO_CLIENT_SECRET: '',
      GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY: '',
      LOCAL_ONLY_SECRET: '',
      NEXTAUTH_SECRET: 'local-integration-only-secret',
      NEXTAUTH_URL: 'http://localhost:3101',
      PORT: '3101',
    })
    for (const key of fileKeys)
      if (!key.startsWith('NEXTAUTH_') && key !== 'PLATFORM_DATABASE_URL')
        expect(serverEnv, key).toHaveProperty([key], '')

    await teardown()
    // No Windows o teardown derruba a árvore com taskkill (também um dublê aqui; o pid 4242 não existe no Windows).
    expect(spawned).toHaveBeenCalledTimes(process.platform === 'win32' ? 3 : 2)
  })
})
