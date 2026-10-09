import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import net from 'node:net'
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import {
  cleanupOwnedResources,
  stopOwnedProcess,
} from '../helpers/owned-process'
import { calcularDigitosCnpj } from '../../packages/domain/src/documento/cnpj'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import type { ApiParityContext } from './global-setup'
import { legacyRunning } from './targets'
import { markParityHost } from './parity-record'

async function availablePort() {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No fixture port')
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return address.port
}

/** Fresh isolated database, canonical role scripts and real HTTP engines; never a production credential. */
export async function startReceivingAccountFixture(
  source: ApiParityContext,
  options: {
    /** Extra environment of both API hosts; the default keeps today's deployment (creation off, no root key). */
    env?: Record<string, string | undefined>
    /** Replaces the read-only double with another one (e.g. the Asaas contract double) behind the same loopback. */
    provider?: (url: string, init: RequestInit) => Promise<Response>
    /**
     * Extra external hosts the API children reach only through `provider` (e.g. the captcha Siteverify and the
     * password range check of the owner signup, wave 135 B10). The original URL reaches `provider` unchanged.
     */
    interceptHosts?: string[]
  } = {}
) {
  const sourceUrl = requireTestDatabase(process.env)
  const run = randomUUID().replaceAll('-', '')
  const database = `receiving_${run}_test`
  const businessRole = `receiving_business_${run}`
  const platformRole = `receiving_platform_${run}`
  const temp = mkdtempSync(path.join(tmpdir(), 'locadora-receiving-http-'))
  const preload = path.join(temp, 'asaas-preload.cjs')
  const admin = new Pool({ connectionString: sourceUrl, max: 1 })
  const databaseUrl = new URL(sourceUrl)
  databaseUrl.pathname = '/' + database
  const db = new Pool({ connectionString: databaseUrl.href, max: 1 })
  const prisma = new PrismaClient({ adapter: new PrismaPg(db) })
  const children: ChildProcess[] = []
  const logs: number[] = []
  const roles: string[] = []
  let created = false
  let businessPool: Pool | undefined, platformPool: Pool | undefined
  let business: PrismaClient | undefined, platform: PrismaClient | undefined
  const owners = Array.from({ length: 4 }, (_, index) => {
    const base = '8500000000' + String(index + 1).padStart(2, '0')
    return {
      tenantId: `receiving-${run}-${index}`,
      membershipId: randomUUID(),
      document: base + calcularDigitosCnpj(base),
      apiKey: '$aact_hmlg_' + `synthetic-${run}-${index}`.repeat(3),
      user: {
        id: randomUUID(),
        email: `receiving-${run}-${index}@example.test`,
        password: `fixture-password-${run}-${index}`,
      },
    }
  })
  const requests: Array<{ owner: number; method: string; path: string }> = []
  const provider = createServer((request, response) => {
    const replacement = options.provider
    if (replacement) {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.once('end', () => {
        const headers = new Headers()
        for (const [name, value] of Object.entries(request.headers))
          if (typeof value === 'string' && name !== 'x-fixture-host')
            headers.set(name, value)
        const host = request.headers['x-fixture-host']
        void replacement(
          'https://' +
            (typeof host === 'string' ? host : 'api-sandbox.asaas.com') +
            (request.url ?? ''),
          {
            method: request.method,
            headers,
            ...(chunks.length
              ? { body: Buffer.concat(chunks).toString() }
              : {}),
          }
        ).then(
          async (result) => {
            response.statusCode = result.status
            response.setHeader(
              'Content-Type',
              result.headers.get('Content-Type') ?? 'application/json'
            )
            response.end(Buffer.from(await result.arrayBuffer()))
          },
          () => {
            response.statusCode = 500
            response.end('{}')
          }
        )
      })
      return
    }
    const owner = owners.findIndex(
      (entry) => request.headers.access_token === entry.apiKey
    )
    response.setHeader('Content-Type', 'application/json')
    if (owner < 0 || request.method !== 'GET') {
      response.statusCode = 401
      response.end('{}')
      return
    }
    requests.push({ owner, method: request.method, path: request.url ?? '' })
    if (request.url === '/v3/myAccount/commercialInfo/')
      response.end(JSON.stringify({ cpfCnpj: owners[owner]!.document }))
    else if (request.url === '/v3/myAccount/status/')
      response.end(
        JSON.stringify({
          id: `synthetic-status-${owner}`,
          general: 'APPROVED',
          commercialInfo: 'APPROVED',
          bankAccountInfo: 'APPROVED',
          documentation: 'APPROVED',
        })
      )
    else {
      response.statusCode = 404
      response.end('{}')
    }
  })

  async function stop() {
    const cleanupLabel = `Owned receiving-account cleanup failed (child PIDs: ${children.map((child) => child.pid).join(', ')})`
    try {
      await cleanupOwnedResources(
        [
          ...[...children]
            .reverse()
            .map((child) => () => stopOwnedProcess(child)),
          () => provider.closeAllConnections(),
          async () => {
            if (provider.listening)
              await new Promise<void>((resolve, reject) =>
                provider.close((error) => (error ? reject(error) : resolve()))
              )
          },
          ...logs.map((log) => () => closeSync(log)),
          ...owners.map(
            (owner) => () =>
              rmSync(path.join(temp, `${owner.user.id}.cookie`), {
                force: true,
              })
          ),
          () => rmSync(preload, { force: true }),
          () => business?.$disconnect(),
          () => platform?.$disconnect(),
          () => prisma.$disconnect(),
          () => businessPool?.end(),
          () => platformPool?.end(),
          () => db.end(),
        ],
        cleanupLabel
      )
    } catch (error) {
      // Close our administrative connection, but never drop a DB/role still usable by an un-stopped child.
      await cleanupOwnedResources(
        [
          () => {
            throw error
          },
          () => admin.end(),
        ],
        cleanupLabel
      )
    }
    if (created) await admin.query(`DROP DATABASE "${database}"`)
    for (const role of roles) await admin.query(`DROP ROLE "${role}"`)
    await admin.end()
  }

  try {
    await admin.query(`CREATE DATABASE "${database}"`)
    created = true
    // Real deploy to the generated disposable URL. No reset/db push or inherited datasource.
    const migration = await promisify(execFile)(
      process.execPath,
      [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl.href,
          DIRECT_URL: databaseUrl.href,
        },
        timeout: 120000,
        maxBuffer: 2_000_000,
      }
    )
    writeFileSync(path.join(temp, 'migrations.log'), migration.stdout)
    const urls: string[] = []
    for (const [script, role] of [
      ['app_runtime', businessRole],
      ['platform_runtime', platformRole],
    ] as const) {
      urls.push(
        await createLoginRole(
          db,
          databaseUrl.href,
          role,
          'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
        )
      )
      roles.push(role)
      await db.query(
        readFileSync(`prisma/sql/roles/${script}.sql`, 'utf8').replaceAll(
          script,
          role
        )
      )
    }
    businessPool = new Pool({ connectionString: urls[0]!, max: 1 })
    platformPool = new Pool({ connectionString: urls[1]!, max: 1 })
    business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
    platform = new PrismaClient({ adapter: new PrismaPg(platformPool) })
    const scope = createPlatformScope(platform)
    for (const owner of owners) {
      const password = await bcrypt.hash(owner.user.password, 12)
      await prisma.user.create({
        data: {
          ...owner.user,
          password,
          role: 'ADMIN',
          authEmailVerified: true,
        },
      })
      if (source.identity.mode === 'better-auth')
        await prisma.authAccount.create({
          data: {
            userId: owner.user.id,
            accountId: owner.user.id,
            providerId: 'credential',
            password,
          },
        })
      await scope.withPlatformTransaction((tx) =>
        tx.organization.create({
          data: {
            id: owner.tenantId,
            slug: owner.tenantId,
            name: 'Synthetic receiving owner',
            document: owner.document,
            documentNormalized: owner.document,
          },
        })
      )
      await prisma.membership.create({
        data: {
          id: owner.membershipId,
          tenantId: owner.tenantId,
          userId: owner.user.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })
      await scope.withProvisioningTransaction(owner.tenantId, (tx) =>
        tx.organization.update({
          where: { id: owner.tenantId },
          data: { ownerUserId: owner.user.id },
        })
      )
    }
    // An ADMIN membership is necessary but not sufficient for an owner action.
    for (const index of [0, 2])
      await prisma.membership.create({
        data: {
          tenantId: owners[index + 1]!.tenantId,
          userId: owners[index]!.user.id,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      })

    await new Promise<void>((resolve) =>
      provider.listen(0, '127.0.0.1', resolve)
    )
    const providerAddress = provider.address()
    if (!providerAddress || typeof providerAddress === 'string')
      throw new Error('No receiving provider port')
    writeFileSync(
      preload,
      `require(${JSON.stringify(path.resolve('tests/helpers/no-network.ts'))});
const original = globalThis.fetch;
const intercepted = new Set(${JSON.stringify([
        'api-sandbox.asaas.com',
        ...(options.interceptHosts ?? []),
      ])});
globalThis.fetch = function(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (intercepted.has(url.hostname)) {
    const target = 'http://127.0.0.1:${providerAddress.port}' + url.pathname + url.search;
    if (input instanceof Request) {
      const request = new Request(target, input);
      request.headers.set('x-fixture-host', url.hostname);
      return original(request, init);
    }
    const headers = new Headers(init && init.headers);
    headers.set('x-fixture-host', url.hostname);
    return original(target, { ...init, headers });
  }
  return original(input, init);
};
`
    )
    const ports = [await availablePort(), await availablePort()]
    // A raiz legada sobe aqui só quando a rodada global a tem (API_LEGACY_MODE=absent: só a API; onda 135, E1).
    const withLegacy = legacyRunning(source)
    const context: ApiParityContext = {
      ...source,
      legacy: withLegacy ? `http://127.0.0.1:${ports[0]}` : null,
      api: `http://127.0.0.1:${ports[1]}`,
      sessionCacheDirectory: temp,
      runtimeUrl: urls[0]!,
      identity: {
        ...source.identity,
        users: owners.map((entry) => entry.user),
      },
    }
    for (const [index, name] of ['legacy', 'api'].entries()) {
      if (name === 'legacy' && !withLegacy) continue
      const log = openSync(path.join(temp, `${name}.log`), 'w')
      logs.push(log)
      const service = name === 'api'
      const child = spawn(
        process.execPath,
        service
          ? [
              path.resolve(
                'apps/services/api/.next/standalone/apps/services/api/server.js'
              ),
            ]
          : [
              path.resolve('node_modules/next/dist/bin/next'),
              'start',
              '--hostname',
              '127.0.0.1',
              '--port',
              String(ports[index]),
            ],
        {
          cwd:
            name === 'api' ? path.resolve('apps/services/api') : process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: urls[0]!,
            DIRECT_URL: urls[0]!,
            PLATFORM_DATABASE_URL: urls[1]!,
            PLATFORM_ENV: 'production',
            PLATFORM_ROOT_DOMAIN: 'platform.test',
            PLATFORM_EDGE_SECRET: context.secret,
            PLATFORM_RATE_LIMIT_SECRET: context.directory.secret,
            PLATFORM_SELF_SERVICE_SIGNUP: 'off',
            PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'off',
            PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
            PLATFORM_ASAAS_OUTBOUND_DISABLED: 'false',
            PLATFORM_ASAAS_EGRESS_PROXY_URL: '',
            PLATFORM_ASAAS_ROOT_API_KEY: '',
            PLATFORM_WEBHOOK_ORIGIN: 'https://api.platform.test',
            PLATFORM_OPS_EMAIL: 'fixture-ops@example.test',
            PLATFORM_SECRETS_KEK_PROVIDER: 'env',
            PLATFORM_SECRETS_KEK_CURRENT: 'K1',
            PLATFORM_SECRETS_KEK_K1: Buffer.alloc(32, 17).toString('base64'),
            PLATFORM_SECRETS_KMS_KEY_ARN: '',
            PLATFORM_SECRET_FINGERPRINT_KEY:
              'synthetic-receiving-fingerprint-over32',
            AWS_ROLE_ARN: '',
            AWS_WEB_IDENTITY_TOKEN_FILE: '',
            WEB_API_ORIGIN: '',
            WEB_PUBLIC_ORIGIN: '',
            NODE_ENV: 'production',
            PORT: String(ports[index]),
            HOSTNAME: '127.0.0.1',
            NODE_OPTIONS: `--require ${JSON.stringify(preload.replaceAll('\\', '/'))}`,
            NEXT_TELEMETRY_DISABLED: '1',
            AUTH_MODE: context.identity.mode,
            NEXT_PUBLIC_AUTH_MODE: context.identity.mode,
            AUTH_V2_ENABLED: 'true',
            // Como o global-setup: o NextAuth na origem HTTP da API em toda rodada.
            NEXTAUTH_URL: context.api,
            NEXTAUTH_SECRET: 'synthetic-receiving-http-session-only',
            BETTER_AUTH_URL: 'https://app.platform.test',
            BETTER_AUTH_SECRET: 'synthetic-receiving-identity-secret-over32',
            AUTH_TRUSTED_ORIGINS: '',
            AUTH_CREDENTIAL_WRITES_PAUSED: '',
            RESEND_API_KEY: '',
            VERCEL: undefined,
            ...options.env,
          },
          stdio: ['ignore', log, log],
        }
      )
      children.push(child)
      const deadline = Date.now() + 60000
      let ready = false
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(`Fixture ${name} exited; inspect ${temp}`)
        try {
          const response = await fetch(
            (index ? context.api : context.legacy!) + '/api/health',
            { signal: AbortSignal.timeout(4000) }
          )
          if (response.ok) {
            ready = true
            break
          }
        } catch {
          /* Owned child is starting. */
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!ready)
        throw new Error(`Fixture ${name} did not start; inspect ${temp}`)
    }
    // Os hosts isolados desta fixture também são a API (e a raiz) da rodada para o registro de cobertura (B3).
    markParityHost(context.api, 'api')
    if (context.legacy) markParityHost(context.legacy, 'legacy')
    console.info(
      `Receiving account: isolated database, roles and provider; logs ${temp}`
    )
    return { context, owners, requests, prisma, business, platform, stop }
  } catch (error) {
    await stop()
    throw error
  }
}
