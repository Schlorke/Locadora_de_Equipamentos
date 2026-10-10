/**
 * Jornadas J1–J7 no navegador, sem a raiz legada (onda 135, B7; matriz 5.5 do plano de aposentadoria): Chromium
 * (Playwright) no host web compilado (`next start -H localhost`) sobre a API compartilhada compilada (standalone), com
 * banco próprio descartável, papéis canônicos separados e dublês de loopback (Resend, captcha e faixa do HIBP).
 * HTTPS efêmero em *.journeys.test:443 (resolução só no Chromium), sem desativar os guards de produção. A porta
 * precisa estar livre; nenhum processo de terceiro é encerrado. O spec sobe e derruba os dois servidores
 * sozinho; exige os builds (`pnpm build:api` e `NEXT_PUBLIC_AUTH_MODE=<modo> pnpm build:web`).
 *
 *   JOURNEYS_E2E=1 JOURNEYS_AUTH_MODE=legacy|better-auth \
 *   TEST_DATABASE_URL=postgresql://.../<nome>_test TEST_DATABASE_DISPOSABLE=true \
 *   pnpm exec vitest run --config vitest.web.config.ts tests/e2e/journeys.spec.ts
 *
 * J1 vitrine no host da locadora; J2 painel no host app com ADMIN; J3 FINANCIAL e OPERATOR (destinos do
 * papel); J4 cliente na área do cliente (só `better-auth`: no `legacy` a vitrine não tem login, `decide.ts`);
 * J5 isolamento entre locadoras; J6 sair e voltar; J7 cadastro de locadora em `/comecar`: desligado no `legacy`
 * (a página informa a indisponibilidade) e ligado no `better-auth` (conta, confirmação do e-mail pelo link real,
 * empresa, endereço, plano, termos e criação). Chromium 1440x900; captura de cada página e atributos dos cookies
 * (sem valores) ficam em TEMP. O spec cria e apaga só o que é dele e preserva banco/papéis se o shutdown falhar.
 * Assets 3D externos usam Draco instalado e HDR sintético neutro: estas jornadas não validam iluminação/CDN.
 */
import { spawn, type ChildProcess, execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  Browser,
  Locator,
  Page,
  Response as PlaywrightResponse,
} from 'playwright'
import type { Cookie } from 'playwright'
import type { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { createLoginRole } from '../helpers/database-roles'
import { alterSharedAcl } from '../helpers/shared-acl'
import {
  cleanupOwnedResources,
  stopOwnedProcess,
} from '../helpers/owned-process'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { LIVE_SITE } from '../helpers/public-site'

const enabled = process.env.JOURNEYS_E2E === '1'
const mode: 'legacy' | 'better-auth' =
  process.env.JOURNEYS_AUTH_MODE === 'better-auth' ? 'better-auth' : 'legacy'
if (
  process.env.JOURNEYS_AUTH_MODE &&
  !['legacy', 'better-auth'].includes(process.env.JOURNEYS_AUTH_MODE)
)
  throw new Error('JOURNEYS_AUTH_MODE must be legacy or better-auth')
const signup = mode === 'better-auth'
const run = randomBytes(4).toString('hex')
const password = `journey-${run}-password`
const captchaToken = `journey-captcha-${run}`
const secret = `journey-edge-secret-${run}-0123456789`
const A = {
  id: `j-alfa-${run}`,
  slug: `j-alfa-${run}`,
  marker: `JORNADA-ALFA-${run}`,
  equipment: `Betoneira JORNADA ${run}`,
}
const B = {
  id: `j-beta-${run}`,
  slug: `j-beta-${run}`,
  marker: `JORNADA-BETA-${run}`,
  equipment: `Martelete JORNADA ${run}`,
}
const users = {
  admin: { role: 'ADMIN', email: `j-admin-${run}@example.test` },
  financial: { role: 'FINANCIAL', email: `j-financial-${run}@example.test` },
  operator: { role: 'OPERATOR', email: `j-operator-${run}@example.test` },
  client: { role: 'CLIENT', email: `j-client-${run}@example.test` },
} as const
const plan = { code: `j-plan-${run}`, name: `Plano Jornada ${run}` }
const owner = {
  name: 'Dona da Jornada',
  email: `j-owner-${run}@example.test`,
  password: `journey-owner-${run}-password`,
}

let prisma: PrismaClient
let platformPrisma: PrismaClient | undefined
let adminPool: Pool | undefined
let databasePool: Pool | undefined
let platformPool: Pool | undefined
let databaseCreated = false
const databaseName = `journeys_${run}_test`
const databaseRoles = [`journeys_business_${run}`, `journeys_platform_${run}`]
const createdRoles: string[] = []
let browser: Browser
let web = ''
let resend: { origin: string; close(): Promise<void> } | undefined
const children: ChildProcess[] = []
const closers: Array<() => Promise<void>> = []
const logs: number[] = []
const bridges: https.Server[] = []
const temp = mkdtempSync(path.join(tmpdir(), 'locadora-journeys-'))
const tempFiles: string[] = []
let screenshotNumber = 0
const sessionReadCounts: {
  total: number
  byHost: Record<'app' | 'tenant' | 'root', Record<number, number>>
} = { total: 0, byHost: { app: {}, tenant: {}, root: {} } }
const pageProblems = new WeakMap<Page, string[]>()
const pageAssetSubstitutions = new WeakMap<
  Page,
  Array<{ kind: string; url: string; source?: string; sha256: string }>
>()
const host = (label: string | null) =>
  `https://${label ? label + '.' : ''}journeys.test`

async function freePort() {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No port')
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return address.port
}

function writeTemp(name: string, text: string) {
  const file = path.join(temp, name)
  writeFileSync(file, text)
  tempFiles.push(file)
  return file
}

async function waitFor(url: string, child: ChildProcess, label: string) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited; see ${temp}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
      await response.arrayBuffer()
      if (response.status < 500) return
    } catch {
      /* still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`${label} did not start; see ${temp}`)
}

function start(
  label: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
) {
  const log = openSync(path.join(temp, `${label}.log`), 'w')
  logs.push(log)
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', log, log],
  })
  children.push(child)
  return child
}

/** Canonical production origins have no configurable port; reserve 443 before creating any database. */
async function requireHttpsPort() {
  const probe = net.createServer()
  await new Promise<void>((resolve, reject) => {
    probe.once('error', () =>
      reject(
        new Error(
          'Journey HTTPS port 443 is occupied; no existing process was touched.'
        )
      )
    )
    probe.listen(443, '127.0.0.1', resolve)
  })
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve()))
  )
}

/** Ignore inherited project credentials; explicit fixture values below also prevent Next from reading .env. */
function isolatedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const directory of [
    '.',
    'apps/clients/web',
    'apps/services/api',
    'apps/services/api/.next/standalone/apps/services/api',
  ]) {
    if (!existsSync(directory)) continue
    for (const file of readdirSync(directory, { withFileTypes: true }).filter(
      (entry) => entry.isFile() && /^\.env(?:\.|$)/.test(entry.name)
    )) {
      const filename = path.join(directory, file.name)
      for (const line of readFileSync(filename, 'utf8').split(/\r?\n/)) {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(
          line
        )
        if (match) env[match[1]!] = ''
      }
    }
  }
  for (const name of Object.keys(env))
    if (
      /^(?:ASAAS_|PLATFORM_|AWS_|BETTER_AUTH_|NEXTAUTH_|AUTH_|RESEND_|ZOHO_|WHATSAPP_|GOOGLE_|FACEBOOK_|NEXT_PUBLIC_)/.test(
        name
      )
    )
      env[name] = ''
  return env
}

/** A TLS transport only: real HTTP/auth responses pass unchanged; no endpoint is mocked. */
async function tlsBridge(
  target: string,
  certificate: string,
  key: string,
  port = 0
) {
  const upstream = new URL(target)
  const server = https.createServer(
    { cert: readFileSync(certificate), key: readFileSync(key) },
    (request, response) => {
      const forwarded = http.request(
        new URL(request.url ?? '/', upstream),
        {
          method: request.method,
          headers: { ...request.headers, 'x-forwarded-proto': 'https' },
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers)
          result.pipe(response)
        }
      )
      forwarded.setTimeout(10_000, () =>
        forwarded.destroy(new Error('Owned TLS upstream timed out'))
      )
      forwarded.once('error', () => {
        if (!response.headersSent) response.writeHead(502)
        response.end()
      })
      request.once('aborted', () => forwarded.destroy())
      request.pipe(forwarded)
    }
  )
  bridges.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No owned TLS bridge port')
  return `https://127.0.0.1:${address.port}`
}

/** Provedores externos do cadastro (Siteverify e faixa do HIBP) num dublê de loopback, só para a API desta rodada. */
async function startProviderDouble() {
  const compromised = createHash('sha1')
    .update('never-used', 'utf8')
    .digest('hex')
  const server = (await import('node:http')).createServer(
    (request, response) => {
      const original = String(request.headers['x-fixture-host'] ?? '')
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.once('end', () => {
        if (original === 'challenges.cloudflare.com') {
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          response.setHeader('content-type', 'application/json')
          response.end(
            JSON.stringify({
              success: body.response === captchaToken,
              hostname: 'app.journeys.test',
              action: 'onboarding',
            })
          )
          return
        }
        if (original === 'api.pwnedpasswords.com') {
          response.setHeader('content-type', 'text/plain')
          response.end(`${compromised.slice(5).toUpperCase()}:0`)
          return
        }
        response.statusCode = 404
        response.end('{}')
      })
    }
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('No provider port')
  return {
    port: address.port,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    },
  }
}

async function seed(databaseUrl: string) {
  const [{ PrismaClient }, { PrismaPg }, bcrypt] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-pg'),
    import('bcryptjs'),
  ])
  adminPool = new Pool({ connectionString: databaseUrl, max: 1 })
  const ownedUrl = new URL(databaseUrl)
  ownedUrl.pathname = '/' + databaseName
  await adminPool.query(`CREATE DATABASE "${databaseName}"`)
  databaseCreated = true
  const migration = await promisify(execFile)(
    process.execPath,
    [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: process.cwd(),
      env: {
        ...isolatedEnvironment(),
        DATABASE_URL: ownedUrl.href,
        DIRECT_URL: ownedUrl.href,
      },
      timeout: 120_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
    }
  )
  writeFileSync(path.join(temp, 'migrations.log'), migration.stdout)
  databasePool = new Pool({ connectionString: ownedUrl.href, max: 2 })
  prisma = new PrismaClient({
    adapter: new PrismaPg(databasePool),
  })
  const urls: string[] = []
  for (const [index, script] of ['app_runtime', 'platform_runtime'].entries()) {
    const role = databaseRoles[index]!
    urls.push(
      await createLoginRole(
        databasePool,
        ownedUrl.href,
        role,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
    )
    createdRoles.push(role)
    await alterSharedAcl(
      databasePool,
      readFileSync(`prisma/sql/roles/${script}.sql`, 'utf8').replaceAll(
        script,
        role
      )
    )
  }
  platformPool = new Pool({ connectionString: urls[1]!, max: 1 })
  platformPrisma = new PrismaClient({ adapter: new PrismaPg(platformPool) })
  const scope = createPlatformScope(platformPrisma)
  for (const tenant of [A, B]) {
    await prisma.organization.create({
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: `Locadora ${tenant.slug}`,
        status: 'ACTIVE',
        city: 'Porto Alegre',
        state: 'RS',
        ...(tenant.id === A.id ? { postalCode: '90000000' } : {}),
      },
    })
    const category = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: `Categoria ${tenant.marker}`,
        slug: `cat-${tenant.slug}`,
      },
    })
    await prisma.equipment.create({
      data: {
        id: `eq-${tenant.slug}`,
        tenantId: tenant.id,
        categoryId: category.id,
        name: tenant.equipment,
        description: tenant.marker,
        pricePerDay: '100',
        images: ['https://example.com/e2e.png'],
      },
    })
    await prisma.setting.create({
      data: {
        tenantId: tenant.id,
        aboutUsText: tenant.marker,
        companyPhone: '51 3000-0000',
      },
    })
  }
  for (const tenant of [A, B])
    await scope.withProvisioningTransaction(tenant.id, (tx) =>
      tx.organization.update({ where: { id: tenant.id }, data: LIVE_SITE })
    )
  if (signup) {
    // Plano público vendável para o assistente (o catálogo mensal vem de /api/public/plans).
    await scope.withPlatformTransaction(async (tx) => {
      const seed = await tx.planVersion.findFirstOrThrow()
      const row = await tx.plan.create({
        data: { code: plan.code, name: plan.name, isPublic: true },
      })
      await tx.planVersion.create({
        data: {
          planId: row.id,
          version: 1,
          amount: '99.90',
          trialDays: 14,
          sellableFrom: new Date(Date.now() - 86_400_000),
          entitlements: seed.entitlements as object,
        },
      })
    })
  }
  const hash = await bcrypt.hash(password, 10)
  for (const [key, user] of Object.entries(users)) {
    const row = await prisma.user.create({
      data: {
        email: user.email,
        name: `Jornada ${key}`,
        password: hash,
        authEmailVerified: true,
      },
    })
    if (mode === 'better-auth')
      await prisma.authAccount.create({
        data: {
          userId: row.id,
          accountId: row.id,
          providerId: 'credential',
          password: hash,
        },
      })
    await prisma.membership.create({
      data: {
        userId: row.id,
        tenantId: A.id,
        role: user.role,
        status: 'ACTIVE',
      },
    })
  }
  await prisma.permission.createMany({
    data: [
      {
        tenantId: A.id,
        role: 'FINANCIAL',
        module: 'FINANCIAL',
        action: 'READ',
      },
      {
        tenantId: A.id,
        role: 'OPERATOR',
        module: 'EQUIPMENTS',
        action: 'READ',
      },
    ],
  })
  return { businessUrl: urls[0]!, platformUrl: urls[1]! }
}

async function cleanup() {
  const errors: unknown[] = []
  const collect = async (actions: (() => unknown | Promise<unknown>)[]) => {
    try {
      await cleanupOwnedResources(
        actions,
        `Journey cleanup failed; inspect ${temp}`
      )
    } catch (error) {
      errors.push(error)
    }
  }
  await collect([
    () => browser?.close(),
    () =>
      writeFileSync(
        path.join(temp, 'session-read-status-counts.json'),
        JSON.stringify(sessionReadCounts, null, 2)
      ),
    ...[...children].reverse().map((child) => () => stopOwnedProcess(child)),
    ...bridges.map((server) => async () => {
      server.closeAllConnections()
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    }),
    ...closers,
    () => resend?.close(),
    ...logs.map((log) => () => closeSync(log)),
    () => prisma?.$disconnect(),
    () => platformPrisma?.$disconnect(),
    () => databasePool?.end(),
    () => platformPool?.end(),
  ])
  // Any shutdown failure preserves the owned database and its roles, even when another sibling stopped correctly.
  if (!errors.length && adminPool) {
    await collect([
      async () => {
        if (databaseCreated)
          await adminPool!.query(`DROP DATABASE "${databaseName}"`)
      },
    ])
    if (!errors.length)
      await collect(
        createdRoles.map(
          (role) => () => alterSharedAcl(adminPool!, `DROP ROLE "${role}"`)
        )
      )
  }
  await collect([() => adminPool?.end()])
  if (!errors.length)
    await collect(tempFiles.map((file) => () => rmSync(file, { force: true })))
  if (errors.length)
    throw new AggregateError(
      errors,
      `Journey resources preserved after cleanup failure; inspect ${temp}`
    )
}

/** Count only fixed get-session response statuses across owned pages; no body or identity. */
function observeSessionResponseCounts(page: Page) {
  const onResponse = (response: PlaywrightResponse) => {
    const target = new URL(response.url())
    if (
      target.protocol !== 'https:' ||
      (target.hostname !== 'journeys.test' &&
        !target.hostname.endsWith('.journeys.test')) ||
      target.pathname !== '/api/auth/get-session' ||
      response.request().method() !== 'GET'
    )
      return
    const kind =
      target.hostname === 'app.journeys.test'
        ? 'app'
        : target.hostname === 'journeys.test'
          ? 'root'
          : 'tenant'
    const statuses = sessionReadCounts.byHost[kind]
    const status = response.status()
    statuses[status] = (statuses[status] ?? 0) + 1
    sessionReadCounts.total++
  }
  page.on('response', onResponse)
  page.once('close', () => page.off('response', onResponse))
}

/** Observe real provider reads without adding requests or retaining payloads. */
function observeJ7SessionResponses(page: Page) {
  type Phase = 'register' | 'verification' | 'signin' | 'company'
  type Entry = {
    path: '/api/auth/get-session' | '/api/auth/owner-account'
    phase: Phase
    elapsedMs: number
    status: number
    hasUserId: boolean | null
    ownerMatches: boolean | null
    emailVerified: boolean | null
    errorCode: string | null
    retryAfterSeconds: number | null
    bodyReadFailed: boolean
  }
  const startedAt = Date.now()
  const aggregateBeforeJ7 = structuredClone(sessionReadCounts)
  let phase: Phase = 'register'
  const entries: Entry[] = []
  const pending = new Set<Promise<void>>()
  const counts = { getSession: 0, ownerAccount: 0, rateLimited: 0, omitted: 0 }
  const record = async (response: PlaywrightResponse, entry: Entry) => {
    try {
      const retry =
        response.headers()['retry-after'] ?? response.headers()['x-retry-after']
      entry.retryAfterSeconds = /^[0-9]{1,5}$/.test(retry ?? '')
        ? Number(retry)
        : null
      const body: unknown = await response.json()
      const data =
        body !== null && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : null
      const user =
        data?.user !== null && typeof data?.user === 'object'
          ? (data.user as Record<string, unknown>)
          : null
      const id =
        entry.path === '/api/auth/get-session' ? user?.id : data?.userId
      entry.hasUserId = typeof id === 'string' && id.length > 0
      entry.ownerMatches =
        entry.path === '/api/auth/get-session'
          ? user?.email === owner.email
          : null
      const verified =
        entry.path === '/api/auth/get-session'
          ? user?.emailVerified
          : data?.emailVerified
      entry.emailVerified = typeof verified === 'boolean' ? verified : null
      entry.errorCode =
        typeof data?.code === 'string'
          ? /^[A-Z][A-Z0-9_]{0,79}$/.test(data.code)
            ? data.code
            : 'UNRECOGNIZED_CODE'
          : null
    } catch {
      // A closed page or a non-JSON response is a diagnostic fact, not a success.
      entry.bodyReadFailed = true
    }
  }
  const onResponse = (response: PlaywrightResponse) => {
    const target = new URL(response.url())
    const endpoint = target.pathname
    if (
      target.origin !== host('app') ||
      response.request().method() !== 'GET' ||
      (endpoint !== '/api/auth/get-session' &&
        endpoint !== '/api/auth/owner-account')
    )
      return
    if (endpoint === '/api/auth/get-session') counts.getSession++
    else counts.ownerAccount++
    if (response.status() === 429) counts.rateLimited++
    if (entries.length >= 20) {
      counts.omitted++
      return
    }
    const entry: Entry = {
      path: endpoint,
      phase,
      elapsedMs: Date.now() - startedAt,
      status: response.status(),
      hasUserId: null,
      ownerMatches: null,
      emailVerified: null,
      errorCode: null,
      retryAfterSeconds: null,
      bodyReadFailed: false,
    }
    entries.push(entry)
    const reading = record(response, entry)
    pending.add(reading)
    void reading.then(() => pending.delete(reading))
  }
  page.on('response', onResponse)
  return {
    phase(next: Phase) {
      phase = next
    },
    stop() {
      page.off('response', onResponse)
      // Call this drain after finishPage closes the page, settling pending reads.
      return async () => {
        await Promise.all(pending)
        writeFileSync(
          path.join(temp, 'j7-session-responses-proof.json'),
          JSON.stringify(
            {
              aggregateBeforeJ7,
              aggregateAfterJ7: sessionReadCounts,
              counts,
              entries,
            },
            null,
            2
          )
        )
      }
    },
  }
}

async function waitForLoginSession(page: Page, email: string) {
  const deadline = Date.now() + 30_000
  for (let attempt = 0; attempt < 61; attempt++) {
    const remaining = Math.max(1, deadline - Date.now())
    const identity = await sessionIdentity(page, remaining)
    // This explicit loop stops on the first 429/non-200; expect.poll retries thrown errors.
    expect(identity.status, 'Login session read failed; no retry').toBe(200)
    if (identity.email === email) return
    if (Date.now() >= deadline) {
      expect(identity.email).toBe(email)
      return
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(500, deadline - Date.now()))
    )
  }
  throw new Error('Login session identity did not settle within 30 seconds')
}

/** Independent journeys share loopback IP; let the real rolling window expire, without resetting it. */
async function waitForPreviousAuthWindow() {
  // The actual Better Auth factory uses a 60-second rolling window and database storage.
  const previous = await prisma.authRateLimit.aggregate({
    _max: { lastRequest: true },
    _count: { _all: true },
    _sum: { count: true },
  })
  const lastRequest = previous._max.lastRequest
  if (lastRequest === null) return
  const lastRequestMs = Number(lastRequest)
  expect(Number.isSafeInteger(lastRequestMs)).toBe(true)
  const waitMs = Math.max(0, lastRequestMs + 60_000 + 1_000 - Date.now())
  expect(waitMs).toBeLessThanOrEqual(61_000)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  const after = await prisma.authRateLimit.aggregate({
    _max: { lastRequest: true },
    _count: { _all: true },
    _sum: { count: true },
  })
  expect(after).toEqual(previous)
  expect(Date.now() - lastRequestMs).toBeGreaterThanOrEqual(60_000)
  writeFileSync(
    path.join(temp, 'j7-auth-window-isolation.json'),
    JSON.stringify(
      {
        windowMs: 60_000,
        waitMs,
        countersUnchanged: true,
        previousRows: previous._count._all,
        previousCalls: previous._sum.count,
      },
      null,
      2
    )
  )
}

async function login(
  page: Page,
  origin: string,
  pathname: string,
  email: string
) {
  await page.goto(origin + pathname, { waitUntil: 'load' })
  await page
    .getByLabel(/e-?mail/i)
    .first()
    .fill(email)
  await page.getByLabel(/senha/i).first().fill(password)
  await page
    .getByRole('button', { name: /entrar/i })
    .first()
    .click()
  await waitForLoginSession(page, email)
  const expectedName =
    mode === 'better-auth'
      ? '__Host-locadora.session_token'
      : '__Secure-next-auth.session-token'
  const cookies = await page.context().cookies(origin)
  const session = cookies.find((cookie) => cookie.name === expectedName)
  expect(cookieAttributes(session)).toEqual({
    name: expectedName,
    domain: new URL(origin).hostname,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  })
  writeFileSync(
    path.join(
      temp,
      `cookies-${mode}-${new URL(origin).hostname}-${email.split('@')[0]}.json`
    ),
    JSON.stringify(cookies.map(cookieAttributes), null, 2)
  )
}

/** Never include token values in artifacts or assertion diffs. */
function cookieAttributes(cookie: Cookie | undefined) {
  if (!cookie) return null
  const { name, domain, path: cookiePath, secure, httpOnly, sameSite } = cookie
  return { name, domain, path: cookiePath, secure, httpOnly, sameSite }
}

async function sessionIdentity(page: Page, timeoutMs?: number) {
  return page.evaluate(
    async ({ endpoint, timeoutMs }) => {
      const response = await fetch(
        endpoint,
        timeoutMs === undefined
          ? undefined
          : { signal: AbortSignal.timeout(timeoutMs) }
      )
      const body = await response.json()
      return { status: response.status, email: body?.user?.email ?? null }
    },
    {
      endpoint:
        mode === 'better-auth' ? '/api/auth/get-session' : '/api/auth/session',
      timeoutMs,
    }
  )
}

async function selectTenant(page: Page) {
  await page.getByRole('combobox', { name: 'Locadora', exact: true }).click()
  const selected = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        '/api/auth/organizations/selection' &&
      response.request().method() === 'POST'
  )
  await page
    .getByRole('option', { name: `Locadora ${A.slug}`, exact: true })
    .click()
  expect((await selected).status()).toBe(200)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const response = await fetch('/api/auth/organizations/selection')
        const body = await response.json()
        return {
          status: response.status,
          tenantId: body.selection?.tenant?.id ?? null,
        }
      })
    )
    .toEqual({ status: 200, tenantId: A.id })
  const selectedCookie = (await page.context().cookies(host('app'))).find(
    (cookie) => cookie.name === 'selected-tenant-id'
  )
  expect(cookieAttributes(selectedCookie)).toEqual({
    name: 'selected-tenant-id',
    domain: 'app.journeys.test',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  })
}

async function newJourneyPage() {
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  observeSessionResponseCounts(page)
  const substitutions: Array<{
    kind: string
    url: string
    source?: string
    sha256: string
  }> = []
  pageAssetSubstitutions.set(page, substitutions)
  // Authentication stays real. Only 3D assets and the later captcha widget are local fixtures.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const decoder =
      /^https:\/\/www\.gstatic\.com\/draco\/versioned\/decoders\/1\.5\.5\/([a-z_]+\.(?:js|wasm))$/.exec(
        url.href
      )
    if (
      decoder &&
      [
        'draco_wasm_wrapper.js',
        'draco_decoder.wasm',
        'draco_decoder.js',
      ].includes(decoder[1]!)
    ) {
      const source = path.resolve(
        'node_modules/three/examples/jsm/libs/draco',
        decoder[1]!
      )
      const body = readFileSync(source)
      substitutions.push({
        kind: 'installed-draco',
        url: url.origin + url.pathname,
        source,
        sha256: createHash('sha256').update(body).digest('hex'),
      })
      return route.fulfill({
        status: 200,
        contentType: source.endsWith('.wasm')
          ? 'application/wasm'
          : 'text/javascript',
        body,
      })
    }
    const ownedHost =
      url.hostname === 'journeys.test' ||
      url.hostname.endsWith('.journeys.test')
    if (
      (['raw.githack.com', 'raw.githubusercontent.com'].includes(
        url.hostname
      ) &&
        /\/pmndrs\/drei-assets\/[^/]+\/hdri\/forest_slope_1k\.hdr$/.test(
          url.pathname
        )) ||
      (ownedHost && url.pathname === '/api/drei-proxy/hdri/forest_slope_1k.hdr')
    ) {
      const body = Buffer.concat([
        Buffer.from(
          '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 8 +X 16\n',
          'latin1'
        ),
        Buffer.alloc(16 * 8 * 4, Buffer.from([128, 128, 128, 129])),
      ])
      substitutions.push({
        kind: 'synthetic-neutral-hdr',
        url: url.origin + url.pathname,
        sha256: createHash('sha256').update(body).digest('hex'),
      })
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body,
      })
    }
    return ownedHost ? route.continue() : route.abort()
  })
  const problems: string[] = []
  pageProblems.set(page, problems)
  const safeError = (value: string) =>
    value
      .replace(/https?:\/\/\S+/g, (url) => {
        try {
          const parsed = new URL(url)
          return parsed.origin + parsed.pathname
        } catch {
          return '<url>'
        }
      })
      .slice(0, 500)
  page.on('pageerror', (error) => problems.push(safeError(error.message)))
  page.on('console', (message) => {
    if (/hydrat|did not match|server rendered HTML/i.test(message.text()))
      problems.push(safeError(message.text()))
  })
  return page
}

async function waitForJourneyPaint(page: Page) {
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      ),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error('Journey paint did not complete in 10s')),
          10_000
        )
      }),
    ])
  } finally {
    if (deadline) clearTimeout(deadline)
  }
}

async function finishPage(page: Page) {
  const label = (expect.getState().currentTestName ?? 'journey')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .slice(-140)
  const artifact = `${label}-${++screenshotNumber}`
  await cleanupOwnedResources(
    [
      () => waitForJourneyPaint(page),
      () =>
        page.screenshot({
          path: path.join(temp, `${artifact}.png`),
          fullPage: true,
          timeout: 10_000,
        }),
      () =>
        writeFileSync(
          path.join(temp, `${artifact}.json`),
          JSON.stringify(
            {
              mode,
              viewport: page.viewportSize(),
              path: new URL(page.url()).pathname,
              assetFixtureLimit:
                'Local Draco and synthetic neutral HDR; lighting/CDN not validated',
              assetSubstitutions: pageAssetSubstitutions.get(page) ?? [],
              problems: pageProblems.get(page) ?? [],
            },
            null,
            2
          )
        ),
      () => page.close(),
      () => expect(pageProblems.get(page) ?? []).toEqual([]),
    ],
    'Journey screenshot/page cleanup failed'
  )
}

const j1PendingWaiters = new WeakMap<Page, Set<Promise<unknown>>>()

function observeJ1Wait<T>(page: Page, operation: Promise<T>) {
  // Observe immediately, but rethrow when the successful path consumes the result.
  const settled = operation.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  )
  const pending = j1PendingWaiters.get(page) ?? new Set<Promise<unknown>>()
  pending.add(settled)
  j1PendingWaiters.set(page, pending)
  return async () => {
    const result = await settled
    if (!result.ok) throw result.error
    return result.value
  }
}

async function finishJ1Page(page: Page) {
  await cleanupOwnedResources(
    [
      () => finishPage(page),
      async () => {
        // finishPage closes the page even after capture/errors fail, rejecting outstanding browser waits.
        await Promise.all(j1PendingWaiters.get(page) ?? [])
        j1PendingWaiters.delete(page)
      },
    ],
    'J1 page/waiter cleanup failed'
  )
}

async function captureJ1Step(page: Page, name: string, critical: Locator) {
  await expect
    .poll(
      () =>
        critical.evaluate((element) => {
          let opacity = 1
          let settled = true
          for (
            let current: Element | null = element;
            current;
            current = current.parentElement
          ) {
            opacity *= Number(getComputedStyle(current).opacity)
            settled &&= current
              .getAnimations()
              .every(
                (animation) =>
                  animation.playState === 'finished' ||
                  animation.playState === 'idle'
              )
          }
          return { opacity, settled }
        }),
      { timeout: 10_000 }
    )
    .toEqual({ opacity: 1, settled: true })
  await waitForJourneyPaint(page)
  await page.screenshot({
    path: path.join(temp, name),
    fullPage: true,
    timeout: 10_000,
  })
}

async function expectJ1Cart(page: Page, days: number) {
  const snapshot = page
    .getByRole('heading', { name: A.equipment, exact: true })
    .or(page.getByRole('heading', { name: B.equipment, exact: true }))
    .or(page.getByRole('spinbutton'))
  await expect
    .poll(
      () =>
        snapshot.evaluateAll(
          (elements, { equipmentA, equipmentB }) => {
            const inputs = elements.filter(
              (element): element is HTMLInputElement =>
                element instanceof HTMLInputElement
            )
            const names = elements
              .filter((element) => !(element instanceof HTMLInputElement))
              .map((element) =>
                element.textContent?.trim().replace(/\s+/g, ' ')
              )
            return {
              headingA: names.filter((name) => name === equipmentA).length,
              headingB: names.filter((name) => name === equipmentB).length,
              controls: inputs.length,
              values: inputs.map((input) => input.value),
            }
          },
          { equipmentA: A.equipment, equipmentB: B.equipment }
        ),
      { timeout: 30_000, interval: 250 }
    )
    .toEqual({
      headingA: 1,
      headingB: 0,
      controls: 2,
      values: ['1', String(days)],
    })
}

async function addJ1CartItem(page: Page) {
  await page.goto(`${host(A.slug)}/orcamento?equipmentId=eq-${A.slug}`, {
    waitUntil: 'load',
  })
  await expectJ1Cart(page, 1)
  // Reloading with equipmentId would intentionally reapply the query's 1/1 defaults.
  await page.goto(host(A.slug) + '/orcamento', { waitUntil: 'load' })
  await expectJ1Cart(page, 1)
}

function waitForJ1CartWrite(page: Page, empty: boolean) {
  return observeJ1Wait(
    page,
    page.waitForResponse(
      (response) => {
        if (
          new URL(response.url()).pathname !== '/api/cart/sync' ||
          response.request().method() !== 'POST'
        )
          return false
        const body = response.request().postDataJSON() as {
          items?: Array<{ equipmentId: string; quantity: number; days: number }>
        }
        if (!Array.isArray(body.items)) return false
        if (empty) return body.items.length === 0
        return (
          body.items.length === 1 &&
          body.items[0]?.equipmentId === `eq-${A.slug}` &&
          body.items[0]?.quantity === 1 &&
          body.items[0]?.days === 2
        )
      },
      { timeout: 30_000 }
    )
  )
}

async function expectJ1RemoteCart(userId: string, empty: boolean) {
  const rows = await prisma.cart.findMany({
    where: { userId },
    include: { items: true },
  })
  expect(
    rows.map((row) => ({
      tenantId: row.tenantId,
      userId: row.userId,
      items: row.items.map((item) => ({
        tenantId: item.tenantId,
        equipmentId: item.equipmentId,
        quantity: item.quantity,
        days: item.days,
        pricePerDay: Number(item.pricePerDay),
        finalPrice: Number(item.finalPrice),
      })),
    }))
  ).toEqual([
    {
      tenantId: A.id,
      userId,
      items: empty
        ? []
        : [
            {
              tenantId: A.id,
              equipmentId: `eq-${A.slug}`,
              quantity: 1,
              days: 2,
              pricePerDay: 100,
              finalPrice: 200,
            },
          ],
    },
  ])
}

async function expectJ1Amount(page: Page, label: string, amount: string) {
  await expect
    .poll(async () =>
      (
        await page.getByText(label, { exact: true }).locator('..').innerText()
      ).replace(/\s/g, '')
    )
    .toBe(`${label}R$${amount},00`)
}

async function submitJ1DeliveryQuote(page: Page, userId: string | null) {
  const email = userId ? users.client.email : `j-guest-${run}@example.test`
  await page.locator('#name').fill('Cliente Jornada Orçamento')
  await page.locator('#phone').fill('51999990000')
  await page.locator('#cpf').fill('52998224725')
  await page.locator('#email').fill(email)
  expect(await page.getByRole('combobox').count()).toBe(1)
  await page.getByRole('combobox').click()
  await page
    .getByRole('option', { name: 'Entrega no Endereço', exact: true })
    .click()
  // Existing no-outbound browser policy aborts ViaCEP; the address is entered by the customer.
  const lookupBlocked = observeJ1Wait(
    page,
    page.waitForEvent('requestfailed', {
      predicate: (request) =>
        new URL(request.url()).hostname === 'viacep.com.br',
      timeout: 30_000,
    })
  )
  await page.locator('#cep').fill('90000000')
  await lookupBlocked()
  await expect.poll(() => page.locator('#cep').isEnabled()).toBe(true)
  await page.locator('#logradouro').fill('Rua da Jornada')
  await page.locator('#numero').fill('100')
  await page.locator('#bairro').fill('Centro')
  await page.locator('#cidade').fill('Porto Alegre')
  await page.locator('#estado').fill('RS')
  await expect.poll(() => page.getByRole('combobox').count()).toBe(2)
  await expectJ1Amount(page, 'Subtotal:', '200')
  await expectJ1Amount(page, 'Frete:', '30')
  await expectJ1Amount(page, 'Total:', '230')
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: /Entrega Expressa/ }).click()
  await expectJ1Amount(page, 'Frete:', '45')
  await expectJ1Amount(page, 'Total:', '245')
  await captureJ1Step(
    page,
    `j1-${mode}-express-estimate.png`,
    page.getByText('Total:', { exact: true })
  )
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: /Transportadora Padrão/ }).click()
  await expectJ1Amount(page, 'Frete:', '30')
  await expectJ1Amount(page, 'Total:', '230')
  await captureJ1Step(
    page,
    `j1-${mode}-standard-before-submit.png`,
    page.getByText('Total:', { exact: true })
  )
  // The fixture publishes no quote terms: absence permits submission; it does not invent an acceptance.
  expect(await page.locator('#terms-accept').count()).toBe(0)
  const sent = observeJ1Wait(
    page,
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/quotes' &&
        response.request().method() === 'POST',
      { timeout: 30_000 }
    )
  )
  const cleared = userId ? waitForJ1CartWrite(page, true) : undefined
  await page
    .getByRole('button', { name: 'Enviar Solicitação', exact: true })
    .click()
  const weekend = page.getByRole('alertdialog', {
    name: 'Incluir finais de semana?',
    exact: true,
  })
  await weekend.waitFor()
  await weekend
    .getByRole('button', { name: 'Sim, incluir finais de semana', exact: true })
    .click()
  if (userId) {
    const save = page.getByRole('dialog', {
      name: 'Salvar informações',
      exact: true,
    })
    await save.waitFor()
    await save.getByRole('button', { name: 'Não salvar', exact: true }).click()
  }
  const response = await sent()
  expect(response.status()).toBe(201)
  const submitted = response.request().postDataJSON() as Record<string, unknown>
  expect(submitted).toMatchObject({
    tenantSlug: A.slug,
    customerName: 'Cliente Jornada Orçamento',
    customerEmail: email,
    customerPhone: '(51) 99999-0000',
    cpf: '529.982.247-25',
    deliveryType: 'DELIVERY',
    deliveryAddress: {
      cep: '90000-000',
      logradouro: 'Rua da Jornada',
      numero: '100',
      bairro: 'Centro',
      cidade: 'Porto Alegre',
      estado: 'RS',
    },
    items: [
      {
        equipmentId: `eq-${A.slug}`,
        quantity: 1,
        days: 2,
        includeWeekends: true,
      },
    ],
  })
  const rows = await prisma.quote.findMany({
    where: { email },
    include: { items: true },
  })
  expect(rows).toHaveLength(1)
  const quote = rows[0]!
  expect((await response.json()).id).toBe(quote.id)
  expect({
    tenantId: quote.tenantId,
    userId: quote.userId,
    status: quote.status,
    paymentTerms: quote.paymentTerms,
    deliveryType: quote.deliveryType,
    deliveryFee: Number(quote.deliveryFee),
    total: Number(quote.total),
    originalTotal: Number(quote.originalTotal),
  }).toEqual({
    tenantId: A.id,
    userId,
    status: 'PENDING',
    paymentTerms: 'UPFRONT',
    deliveryType: 'DELIVERY',
    deliveryFee: 30,
    total: 230,
    originalTotal: 230,
  })
  expect(quote.deliveryAddress).toMatchObject({
    cep: '90000-000',
    logradouro: 'Rua da Jornada',
    numero: '100',
    bairro: 'Centro',
    cidade: 'Porto Alegre',
    estado: 'RS',
  })
  expect(
    quote.items.map((item) => ({
      tenantId: item.tenantId,
      equipmentId: item.equipmentId,
      quantity: item.quantity,
      days: item.days,
      includeWeekends: item.includeWeekends,
      pricePerDay: Number(item.pricePerDay),
      total: Number(item.total),
    }))
  ).toEqual([
    {
      tenantId: A.id,
      equipmentId: `eq-${A.slug}`,
      quantity: 1,
      days: 2,
      includeWeekends: true,
      pricePerDay: 100,
      total: 200,
    },
  ])
  expect(quote.startDate).toBeInstanceOf(Date)
  expect(quote.endDate).toBeInstanceOf(Date)
  expect(quote.endDate!.getTime()).toBeGreaterThan(quote.startDate!.getTime())
  expect(quote.items[0]!.startDate).toEqual(quote.startDate)
  expect(quote.items[0]!.endDate).toEqual(quote.endDate)
  expect(
    await prisma.outboxEvent.findMany({
      where: { aggregateId: quote.id },
      select: {
        tenantId: true,
        topic: true,
        aggregateId: true,
        payload: true,
        dedupeKey: true,
        status: true,
        attempts: true,
      },
    })
  ).toEqual([
    {
      tenantId: A.id,
      topic: 'quote.created.notify',
      aggregateId: quote.id,
      payload: { quoteId: quote.id },
      dedupeKey: `${A.id}:quote-created:${quote.id}`,
      status: 'PENDING',
      attempts: 0,
    },
  ])
  if (cleared) {
    expect((await cleared()).status()).toBe(200)
    await expectJ1RemoteCart(userId!, true)
  }
  await page.getByText('0 equipamentos selecionados', { exact: true }).waitFor()
  await page.reload({ waitUntil: 'load' })
  await page.getByText('0 equipamentos selecionados', { exact: true }).waitFor()
  expect(await page.getByRole('spinbutton').count()).toBe(0)
  expect(
    await page.getByRole('heading', { name: A.equipment, exact: true }).count()
  ).toBe(0)
  if (userId) await expectJ1RemoteCart(userId, true)
  writeFileSync(
    path.join(temp, `j1-${mode}-delivery-proof.json`),
    JSON.stringify(
      {
        mode,
        tenantId: A.id,
        equipmentId: `eq-${A.slug}`,
        quoteId: quote.id,
        authenticatedClient: Boolean(userId),
        quantity: 1,
        days: 2,
        itemTotal: 200,
        deliveryFee: 30,
        total: 230,
        quoteCount: 1,
        cartEmptyAfterReload: true,
        limits: [
          'Express is UI estimate only',
          'Local deterministic freight; no Melhor Envio proof',
          'Outbox enqueue only; no notification delivery proof',
        ],
      },
      null,
      2
    )
  )
}

describe.skipIf(!enabled)(`jornadas no navegador sem a raiz (${mode})`, () => {
  beforeAll(async () => {
    const { requireTestDatabase } = await import('../helpers/test-database')
    const databaseUrl = requireTestDatabase(process.env)
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(databaseUrl).hostname
      )
    )
      throw new Error(
        'Browser journeys require the owned local disposable PostgreSQL cluster'
      )
    await requireHttpsPort()
    const database = await seed(databaseUrl)
    const { startResendFixture } = await import('../api-host/resend-provider')
    const resendKey = `re_local_journeys_${run}`
    resend = await startResendFixture(resendKey)
    const provider = await startProviderDouble()
    closers.push(provider.close)
    const certificate = path.join(temp, 'localhost-cert.pem')
    const key = path.join(temp, 'localhost-key.pem')
    tempFiles.push(certificate, key)
    const windowsOpenSsl = 'C:/Program Files/Git/usr/bin/openssl.exe'
    const openssl =
      process.platform === 'win32' && existsSync(windowsOpenSsl)
        ? windowsOpenSsl
        : 'openssl'
    await promisify(execFile)(
      openssl,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=journeys.test',
        '-addext',
        'subjectAltName=DNS:journeys.test,DNS:*.journeys.test,DNS:localhost,IP:127.0.0.1',
        '-keyout',
        key,
        '-out',
        certificate,
      ],
      { timeout: 15_000, windowsHide: true }
    )
    const preload = writeTemp(
      'journeys-preload.cjs',
      `require(${JSON.stringify(path.resolve('tests/helpers/no-network.ts'))});
const original = globalThis.fetch;
const intercepted = new Set(['challenges.cloudflare.com', 'api.pwnedpasswords.com']);
globalThis.fetch = function (input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!intercepted.has(url.hostname)) return original(input, init);
  const target = 'http://127.0.0.1:${provider.port}' + url.pathname + url.search;
  const headers = new Headers(input instanceof Request ? input.headers : init && init.headers);
  headers.set('x-fixture-host', url.hostname);
  return original(target, { ...init, method: (init && init.method) || (input instanceof Request ? input.method : 'GET'), headers });
};
`
    )
    const publication = writeTemp(
      'publication.json',
      JSON.stringify(
        (await import('../helpers/onboarding-data')).onboardingPublication
      )
    )
    const contents = writeTemp(
      'contents.json',
      JSON.stringify(
        Object.fromEntries(
          (
            await import('../helpers/onboarding-data')
          ).onboardingPublication.map((row) => [
            row.kind,
            'Synthetic test only:' + row.kind,
          ])
        )
      )
    )
    const identityToken = writeTemp('never-read-identity-token', 'synthetic')
    const apiPort = await freePort()
    const webPort = await freePort()
    web = host('app')
    const shared = {
      PLATFORM_ENV: 'production',
      PLATFORM_ROOT_DOMAIN: 'journeys.test',
      PLATFORM_EDGE_SECRET: secret,
      PLATFORM_RATE_LIMIT_SECRET: `journey-rate-${run}-0123456789abcdef`,
      NEXT_PUBLIC_AUTH_MODE: mode,
      NEXTAUTH_URL: web,
      NEXTAUTH_URL_INTERNAL: web,
      NEXTAUTH_SECRET: `journey-nextauth-${run}`,
      BETTER_AUTH_URL: web,
      BETTER_AUTH_SECRET: `journey-better-auth-${run}-0123456789`,
      NEXT_TELEMETRY_DISABLED: '1',
      PLATFORM_SELF_SERVICE_SIGNUP: signup ? 'on' : 'off',
      PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'off',
      PLATFORM_SUBACCOUNT_CREATION: 'off',
      PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
      PLATFORM_ASAAS_OUTBOUND_DISABLED: 'true',
      PLATFORM_CUSTOM_DOMAINS: 'off',
      VERCEL: undefined,
      VERCEL_ENV: undefined,
    }
    const api = start(
      'api',
      [
        path.resolve(
          'apps/services/api/.next/standalone/apps/services/api/server.js'
        ),
      ],
      path.resolve('apps/services/api'),
      {
        ...isolatedEnvironment(),
        ...shared,
        NODE_ENV: 'production',
        PORT: String(apiPort),
        HOSTNAME: '127.0.0.1',
        DATABASE_URL: database.businessUrl,
        DIRECT_URL: database.businessUrl,
        PLATFORM_DATABASE_URL: database.platformUrl,
        AUTH_MODE: mode,
        AUTH_V2_ENABLED: 'true',
        NEXTAUTH_URL: web,
        NEXTAUTH_SECRET: `journey-nextauth-${run}`,
        BETTER_AUTH_URL: web,
        BETTER_AUTH_SECRET: `journey-better-auth-${run}-0123456789`,
        RESEND_API_KEY: resendKey,
        RESEND_BASE_URL: resend.origin,
        FROM_EMAIL: 'Plataforma <no-reply@platform.test>',
        NODE_OPTIONS: `--require ${JSON.stringify(preload.replaceAll('\\', '/'))}`,
        PLATFORM_SELF_SERVICE_SIGNUP: signup ? 'on' : 'off',
        PLATFORM_SECRETS_KEK_PROVIDER: signup ? 'aws-kms' : 'env',
        PLATFORM_SECRETS_KMS_KEY_ARN: signup
          ? 'arn:aws:kms:sa-east-1:000000000000:key/00000000-0000-4000-8000-000000000000'
          : '',
        PLATFORM_SECRETS_KEK_CURRENT: signup ? '' : 'K1',
        PLATFORM_SECRETS_KEK_K1: signup
          ? ''
          : Buffer.alloc(32, 17).toString('base64'),
        AWS_ROLE_ARN: signup
          ? 'arn:aws:iam::000000000000:role/synthetic-journeys'
          : '',
        AWS_WEB_IDENTITY_TOKEN_FILE: signup ? identityToken : '',
        PLATFORM_SECRET_FINGERPRINT_KEY: `journey-fingerprint-${run}-0123456789abcdef`,
        PLATFORM_CAPTCHA_SECRET_KEY: `journey-captcha-secret-${run}`,
        PLATFORM_CAPTCHA_SITE_KEY: 'journey-site-key',
        PLATFORM_LEGAL_DOCUMENTS_FILE: publication,
        PLATFORM_LEGAL_DOCUMENT_CONTENTS_FILE: contents,
        PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
        PLATFORM_TRIAL_SECRET: `journey-trial-${run}-0123456789abcdef`,
      }
    )
    await waitFor(`http://127.0.0.1:${apiPort}/api/health`, api, 'api')
    const apiTls = await tlsBridge(
      `http://127.0.0.1:${apiPort}`,
      certificate,
      key
    )
    const webChild = start(
      'web',
      [
        path.resolve('node_modules/next/dist/bin/next'),
        'start',
        '-H',
        'localhost',
        '-p',
        String(webPort),
      ],
      path.resolve('apps/clients/web'),
      {
        ...isolatedEnvironment(),
        ...shared,
        NODE_ENV: 'production',
        WEB_API_ORIGIN: apiTls,
        NODE_EXTRA_CA_CERTS: certificate,
        NODE_OPTIONS: `--require ${JSON.stringify(path.resolve('tests/helpers/no-network.ts').replaceAll('\\', '/'))}`,
        DATABASE_URL:
          'postgresql://unused:unused@127.0.0.1:1/web_has_no_database',
        DIRECT_URL:
          'postgresql://unused:unused@127.0.0.1:1/web_has_no_database',
      }
    )
    await waitFor(`http://localhost:${webPort}/favicon.ico`, webChild, 'web')
    await tlsBridge(`http://localhost:${webPort}`, certificate, key, 443)
    const { chromium } = await import('playwright')
    browser = await chromium.launch({
      args: [
        '--host-resolver-rules=MAP *.journeys.test 127.0.0.1, MAP journeys.test 127.0.0.1',
        '--no-proxy-server',
      ],
    })
    console.info(
      `Browser journeys (${mode}): owned HTTPS, isolated database and canonical roles; artifacts ${temp}`
    )
  }, 240_000)

  afterAll(async () => {
    await cleanup()
  }, 60_000)

  it('J1: vitrine da locadora no próprio host com catálogo e detalhe', async () => {
    const page = await newJourneyPage()
    try {
      await page.goto(host(A.slug) + '/', { waitUntil: 'load' })
      expect(await page.content()).toContain(A.marker)
      await page.goto(host(A.slug) + '/equipamentos', { waitUntil: 'load' })
      await page.getByText(A.equipment).first().waitFor({ timeout: 30_000 })
      expect(await page.content()).not.toContain(B.equipment)
      await page.locator(`a[href="/equipamentos/eq-${A.slug}"]`).first().click()
      await page.waitForURL(`${host(A.slug)}/equipamentos/eq-${A.slug}`)
      await page.getByRole('heading', { name: A.equipment }).first().waitFor()
      await page.reload({ waitUntil: 'load' })
      await page.getByRole('heading', { name: A.equipment }).first().waitFor()
      await page.goBack({ waitUntil: 'load' })
      await page.waitForURL(host(A.slug) + '/equipamentos')
      await page.goForward({ waitUntil: 'load' })
      await page.getByRole('heading', { name: A.equipment }).first().waitFor()
    } finally {
      await finishPage(page)
    }
  }, 120_000)

  it('J1: carrinho persiste, estima frete e envia um orçamento DELIVERY Standard', async () => {
    const client = await prisma.user.findUniqueOrThrow({
      where: { email: users.client.email },
      select: { id: true },
    })
    const source = await newJourneyPage()
    try {
      expect(
        (await source.context().cookies(host(A.slug))).some(
          (cookie) =>
            cookie.name.includes('session_token') ||
            cookie.name.includes('session-token')
        )
      ).toBe(false)
      if (mode === 'legacy') {
        await source.goto(`${host(A.slug)}/equipamentos/eq-${A.slug}`, {
          waitUntil: 'load',
        })
        await source
          .getByRole('button', {
            name: 'Solicitar Orçamento Grátis',
            exact: true,
          })
          .click()
        await source.waitForURL(
          (url) =>
            url.pathname === '/login' && url.searchParams.has('callbackUrl')
        )
        const unavailableLogin = await source.reload({ waitUntil: 'load' })
        expect(unavailableLogin?.status()).toBe(404)
        await captureJ1Step(
          source,
          'j1-legacy-quote-cta-404.png',
          source.getByRole('heading', {
            name: 'Página não encontrada',
            exact: true,
          })
        )
        writeFileSync(
          path.join(temp, 'j1-legacy-quote-cta.json'),
          JSON.stringify(
            {
              path: '/login',
              status: 404,
              reason:
                'Legacy tenant login remains unavailable; public quote entry is used below',
            },
            null,
            2
          )
        )
      }
      await addJ1CartItem(source)
      await source.getByRole('spinbutton').nth(1).fill('2')
      await expectJ1Cart(source, 2)
      await source.reload({ waitUntil: 'load' })
      await expectJ1Cart(source, 2)
      expect(await sessionIdentity(source)).toEqual({
        status: 200,
        email: null,
      })
      await captureJ1Step(
        source,
        `j1-${mode}-guest-cart-after-reload.png`,
        source.getByRole('heading', { name: A.equipment, exact: true })
      )
      if (mode === 'legacy') {
        await submitJ1DeliveryQuote(source, null)
      } else {
        const initialSync = observeJ1Wait(
          source,
          source.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/cart/sync' &&
              response.request().method() === 'GET',
            { timeout: 30_000 }
          )
        )
        await login(source, host(A.slug), '/entrar', users.client.email)
        await source.waitForURL((url) => url.pathname === '/', {
          timeout: 30_000,
        })
        const emptyRemote = await initialSync()
        expect(emptyRemote.status()).toBe(200)
        expect((await emptyRemote.json()).items).toEqual([])
        // Anonymous storage is intentionally separate; no injected storage/cookies and no forced merge.
        await source.goto(host(A.slug) + '/orcamento', { waitUntil: 'load' })
        await source
          .getByText('0 equipamentos selecionados', { exact: true })
          .waitFor()
        await addJ1CartItem(source)
        const saved = waitForJ1CartWrite(source, false)
        await source.getByRole('spinbutton').nth(1).fill('2')
        expect((await saved()).status()).toBe(200)
        await expectJ1Cart(source, 2)
        await expectJ1RemoteCart(client.id, false)
      }
    } finally {
      await finishJ1Page(source)
    }
    if (mode === 'better-auth') {
      // browser.newPage creates a fresh context: this restoration cannot read the source's localStorage.
      const restored = await newJourneyPage()
      try {
        const read = observeJ1Wait(
          restored,
          restored.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/cart/sync' &&
              response.request().method() === 'GET',
            { timeout: 30_000 }
          )
        )
        await login(restored, host(A.slug), '/entrar', users.client.email)
        await restored.waitForURL((url) => url.pathname === '/', {
          timeout: 30_000,
        })
        const remote = await read()
        expect(remote.status()).toBe(200)
        const body = (await remote.json()) as {
          items: Array<{ equipmentId: string; quantity: number; days: number }>
        }
        expect(
          body.items.map(({ equipmentId, quantity, days }) => ({
            equipmentId,
            quantity,
            days,
          }))
        ).toEqual([{ equipmentId: `eq-${A.slug}`, quantity: 1, days: 2 }])
        await restored.goto(host(A.slug) + '/orcamento', { waitUntil: 'load' })
        await expectJ1Cart(restored, 2)
        await captureJ1Step(
          restored,
          'j1-better-auth-remote-cart-restored.png',
          restored.getByRole('heading', { name: A.equipment, exact: true })
        )
        await submitJ1DeliveryQuote(restored, client.id)
      } finally {
        await finishJ1Page(restored)
      }
    }
  }, 180_000)

  it('J2: painel no host app com o ADMIN da locadora', async () => {
    const page = await newJourneyPage()
    try {
      await login(page, host('app'), '/login', users.admin.email)
      await page.waitForURL(/\/admin(\/dashboard)?$/, { timeout: 30_000 })
      await selectTenant(page)
      await page.goto(host('app') + '/admin/equipamentos', {
        waitUntil: 'load',
      })
      await page.getByText(A.equipment).first().waitFor({ timeout: 30_000 })
      await page.reload({ waitUntil: 'load' })
      await page.getByText(A.equipment).first().waitFor({ timeout: 30_000 })
      // Visibility alone permits opacity:0. Wait for the actual item and its ancestors to finish fading.
      await expect
        .poll(
          () =>
            page
              .getByText(A.equipment)
              .first()
              .evaluate((element) => {
                let opacity = 1
                let settled = true
                for (
                  let current: Element | null = element;
                  current;
                  current = current.parentElement
                ) {
                  opacity *= Number(getComputedStyle(current).opacity)
                  settled &&= current
                    .getAnimations()
                    .every(
                      (animation) =>
                        animation.playState === 'finished' ||
                        animation.playState === 'idle'
                    )
                }
                return { opacity, settled }
              }),
          { timeout: 10_000 }
        )
        .toEqual({ opacity: 1, settled: true })
      expect(await sessionIdentity(page)).toEqual({
        status: 200,
        email: users.admin.email,
      })
    } finally {
      await finishPage(page)
    }
  }, 120_000)

  it('J3: FINANCIAL abre só o financeiro e OPERATOR não abre as configurações', async () => {
    const financial = await newJourneyPage()
    try {
      await login(financial, host('app'), '/login', users.financial.email)
      await financial.waitForURL(/\/admin/, { timeout: 30_000 })
      await selectTenant(financial)
      // Selection commits before the role gate replaces the page. Observe that
      // real navigation before attempting the separate forbidden destination.
      await financial.waitForURL(
        (url) =>
          url.origin === host('app') && url.pathname === '/admin/financeiro',
        { waitUntil: 'load', timeout: 30_000 }
      )
      await financial.goto(host('app') + '/admin/dashboard', {
        waitUntil: 'load',
      })
      await financial.waitForURL(
        (url) =>
          url.origin === host('app') && url.pathname === '/admin/financeiro',
        { waitUntil: 'load', timeout: 30_000 }
      )
      expect(
        await financial.evaluate(
          async () => (await fetch('/api/admin/settings')).status
        )
      ).toBe(403)
    } finally {
      await finishPage(financial)
    }
    const operator = await newJourneyPage()
    try {
      await login(operator, host('app'), '/login', users.operator.email)
      await operator.waitForURL(/\/admin/, { timeout: 30_000 })
      await selectTenant(operator)
      await operator.goto(host('app') + '/admin/settings', {
        waitUntil: 'load',
      })
      await operator.waitForURL(/\/admin(\/dashboard)?$/, { timeout: 30_000 })
      expect(
        await operator.evaluate(
          async () => (await fetch('/api/admin/settings')).status
        )
      ).toBe(403)
    } finally {
      await finishPage(operator)
    }
  }, 120_000)

  it.skipIf(mode !== 'better-auth')(
    'J4: cliente entra na vitrine e abre a área do cliente',
    async () => {
      const page = await newJourneyPage()
      const portalHeading = page.getByRole('heading', {
        name: 'Bem-vindo de volta, Jornada client!',
        exact: true,
      })
      const accountMenuTrigger = page.getByRole('button', {
        name: 'Jornada client',
        exact: true,
      })
      try {
        await login(page, host(A.slug), '/entrar', users.client.email)
        await page.waitForURL((url) => url.pathname === '/', {
          timeout: 30_000,
        })
        await page.goto(host(A.slug) + '/area-cliente', { waitUntil: 'load' })
        await portalHeading.waitFor({ timeout: 30_000 })
        await accountMenuTrigger.press('ArrowDown')
        await page
          .getByText(users.client.email)
          .first()
          .waitFor({ timeout: 30_000 })
        await page.reload({ waitUntil: 'load' })
        await portalHeading.waitFor({ timeout: 30_000 })
        await accountMenuTrigger.press('ArrowDown')
        await page
          .getByText(users.client.email)
          .first()
          .waitFor({ timeout: 30_000 })
        expect(await sessionIdentity(page)).toEqual({
          status: 200,
          email: users.client.email,
        })
        // Host-only browser storage must not carry the client's session to the sibling app host.
        await page.goto(host('app') + '/login', { waitUntil: 'load' })
        expect(await sessionIdentity(page)).toEqual({
          status: 200,
          email: null,
        })
      } finally {
        await finishPage(page)
      }
    },
    120_000
  )

  it('J5: o ADMIN de uma locadora não lê dados da outra', async () => {
    const page = await newJourneyPage()
    try {
      await login(page, host('app'), '/login', users.admin.email)
      await page.waitForURL(/\/admin/, { timeout: 30_000 })
      await selectTenant(page)
      const statuses = await page.evaluate(
        async (tenants) => {
          const read = async (tenant: string) =>
            (
              await fetch('/api/admin/equipments', {
                headers: { 'x-tenant-id': tenant },
              })
            ).status
          return [await read(tenants[0]!), await read(tenants[1]!)]
        },
        [A.id, B.id]
      )
      expect(statuses).toEqual([200, 400])
      expect(
        await page.evaluate(
          async (tenantId) =>
            (
              await fetch('/api/auth/organizations/selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId }),
              })
            ).status,
          B.id
        )
      ).toBe(403)
      await page.goto(host(B.slug) + '/', { waitUntil: 'load' })
      expect(await page.content()).not.toContain(A.marker)
      expect(await sessionIdentity(page)).toEqual({ status: 200, email: null })
    } finally {
      await finishPage(page)
    }
  }, 120_000)

  it('J6: sair do painel e entrar de novo', async () => {
    const page = await newJourneyPage()
    try {
      await login(page, host('app'), '/login', users.admin.email)
      await page.waitForURL(/\/admin/, { timeout: 30_000 })
      await selectTenant(page)
      await page.getByRole('button', { name: 'Sair', exact: true }).click()
      await page.waitForURL(/\/login|\/admin\/login/, { timeout: 30_000 })
      expect(
        await page.evaluate(
          async () => (await fetch('/api/auth/organizations')).status
        )
      ).toBe(401)
      expect(await sessionIdentity(page)).toEqual({ status: 200, email: null })
      expect(
        (await page.context().cookies(host('app'))).some(
          (cookie) => cookie.name === 'selected-tenant-id'
        )
      ).toBe(false)
      await page.goto(host('app') + '/admin/equipamentos', {
        waitUntil: 'load',
      })
      await page.waitForURL(/\/login|\/admin\/login/, { timeout: 30_000 })
      await login(page, host('app'), '/login', users.admin.email)
      await page.waitForURL(/\/admin/, { timeout: 30_000 })
      expect(
        await page.evaluate(async () => {
          const response = await fetch('/api/auth/organizations/selection')
          return { status: response.status, body: await response.json() }
        })
      ).toEqual({ status: 200, body: { selection: null } })
      await selectTenant(page)
      await page.goto(host('app') + '/admin/equipamentos', {
        waitUntil: 'load',
      })
      await page.getByText(A.equipment).first().waitFor({ timeout: 30_000 })
    } finally {
      await finishPage(page)
    }
  }, 120_000)

  it.skipIf(signup)(
    'J7: com o cadastro desligado, /comecar informa a indisponibilidade',
    async () => {
      const page = await newJourneyPage()
      try {
        await page.goto(host('app') + '/comecar', { waitUntil: 'load' })
        await page
          .getByText('Fale com a gente')
          .first()
          .waitFor({ timeout: 30_000 })
        expect(await page.locator('input').count()).toBe(0)
      } finally {
        await finishPage(page)
      }
    },
    120_000
  )

  it.skipIf(!signup)(
    'J7: cadastro de locadora em /comecar com confirmação de e-mail e checklist',
    async () => {
      await waitForPreviousAuthWindow()
      const page = await newJourneyPage()
      const sessionTrace = observeJ7SessionResponses(page)
      try {
        await page.route('https://challenges.cloudflare.com/**', (route) =>
          route.fulfill({
            contentType: 'text/javascript',
            body: `window.turnstile = { render(el, options) { setTimeout(() => options.callback(${JSON.stringify(captchaToken)}), 50); return 'fixture'; }, remove() {} };`,
          })
        )
        // 1. Conta do dono, com o desafio do captcha (dublê do widget) antes de enviar.
        await page.goto(host('app') + '/comecar', { waitUntil: 'load' })
        await page.getByLabel('Nome', { exact: true }).fill(owner.name)
        await page.getByLabel('E-mail', { exact: true }).fill(owner.email)
        await page.getByLabel('Senha', { exact: true }).fill(owner.password)
        const createAccess = page.getByRole('button', {
          name: 'Criar meu acesso',
        })
        await expect
          .poll(() => createAccess.isEnabled(), { timeout: 15_000 })
          .toBe(true)
        await createAccess.click()
        await page
          .getByText('Confirme seu e-mail')
          .first()
          .waitFor({ timeout: 30_000 })
        // 2. Confirmação pelo link real do e-mail (dublê do Resend) e retorno ao assistente.
        const { emailLinks, emailsTo } =
          await import('../api-host/resend-provider')
        await expect
          .poll(
            async () => (await emailsTo(resend!.origin, owner.email)).length,
            { timeout: 20_000 }
          )
          .toBe(1)
        const [email] = await emailsTo(resend!.origin, owner.email)
        const link = emailLinks(email!).find((value) =>
          value.startsWith(host('app'))
        )
        expect(link).toBeDefined()
        const verificationUrl = new URL(link!)
        expect(verificationUrl.origin).toBe(host('app'))
        expect(verificationUrl.searchParams.has('callbackURL')).toBe(true)
        const callback = new URL(
          verificationUrl.searchParams.get('callbackURL')!,
          host('app')
        )
        expect(callback.origin).toBe(host('app'))
        expect(callback.pathname).toBe('/comecar')
        expect(callback.search).toBe('')
        expect(callback.hash).toBe('')
        sessionTrace.phase('verification')
        await page.goto(link!, { waitUntil: 'load' })
        await page.waitForURL(host('app') + '/comecar', { timeout: 30_000 })
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { email: owner.email },
              select: { authEmailVerified: true },
            })
          ).authEmailVerified
        ).toBe(true)
        // Verification returns to the wizard without creating a login session.
        expect(await sessionIdentity(page)).toEqual({
          status: 200,
          email: null,
        })
        const signIn = page.getByRole('button', {
          name: 'Já tenho conta — entrar',
          exact: true,
        })
        await signIn.waitFor({ timeout: 30_000 })
        await page.getByLabel('E-mail', { exact: true }).fill(owner.email)
        await page.getByLabel('Senha', { exact: true }).fill(owner.password)
        sessionTrace.phase('signin')
        const signInResponse = page.waitForResponse(
          (response) => {
            const target = new URL(response.url())
            return (
              target.origin === host('app') &&
              target.pathname === '/api/auth/sign-in/email' &&
              response.request().method() === 'POST'
            )
          },
          { timeout: 15_000 }
        )
        void signInResponse.catch(() => undefined)
        await signIn.click()
        const response = await signInResponse
        const body: unknown = await response.json()
        const record =
          body !== null && typeof body === 'object'
            ? (body as Record<string, unknown>)
            : null
        const user =
          record?.user !== null && typeof record?.user === 'object'
            ? (record.user as Record<string, unknown>)
            : null
        const outcome = {
          status: response.status(),
          errorCode:
            typeof record?.code === 'string'
              ? /^[A-Z][A-Z0-9_]{0,79}$/.test(record.code)
                ? record.code
                : 'UNRECOGNIZED_CODE'
              : null,
          hasUserId: typeof user?.id === 'string' && user.id.length > 0,
          ownerMatches: user?.email === owner.email,
          retryAfterSeconds: /^[0-9]{1,5}$/.test(
            response.headers()['retry-after'] ?? ''
          )
            ? Number(response.headers()['retry-after'])
            : null,
        }
        // Persist only bounded status/code/booleans; never the token or raw body.
        writeFileSync(
          path.join(temp, 'j7-signin-response-proof.json'),
          JSON.stringify(outcome, null, 2)
        )
        expect(outcome).toMatchObject({
          status: 200,
          errorCode: null,
          hasUserId: true,
          ownerMatches: true,
        })
        await page.getByText('Sua empresa').first().waitFor({ timeout: 30_000 })
        sessionTrace.phase('company')
        expect(await sessionIdentity(page)).toEqual({
          status: 200,
          email: owner.email,
        })
        expect(
          (
            await prisma.user.findUniqueOrThrow({
              where: { email: owner.email },
            })
          ).authEmailVerified
        ).toBe(true)
        // 3. Empresa, endereço, plano e termos.
        for (const [label, value] of [
          ['CNPJ', '11222333000181'],
          ['Razão social', 'Jornada Locações Ltda'],
          ['Nome fantasia', `Jornada ${run}`],
          ['Celular ou WhatsApp', '41999998888'],
          ['CEP', '80010000'],
          ['Endereço', 'Rua da Jornada'],
          ['Número', '10'],
          ['Bairro', 'Centro'],
          ['Cidade', 'Curitiba'],
        ] as const)
          await page.getByLabel(label, { exact: true }).fill(value)
        await page.locator('#company-type').click()
        await page.getByRole('option', { name: 'Sociedade limitada' }).click()
        await page.locator('#company-state').click()
        await page.getByRole('option', { name: 'PR', exact: true }).click()
        await page
          .getByLabel('Tenho poderes para representar a empresa.')
          .check()
        await page.getByRole('button', { name: 'Continuar' }).click()
        await page.getByLabel('Endereço do site').fill(`j-nova-${run}`)
        await page.getByRole('button', { name: 'Conferir e continuar' }).click()
        await page
          .getByRole('button', { name: `Escolher ${plan.name}` })
          .click()
        await page.getByRole('button', { name: 'Continuar' }).click()
        for (const name of [
          'Termos de Uso',
          'Política de Privacidade',
          'Acordo de Tratamento de Dados',
        ])
          await page.getByLabel(`Li e aceito: ${name}`).check()
        const required = page.getByRole('checkbox', { name: /^Li e aceito:/ })
        for (let index = 0; index < (await required.count()); index++)
          await required.nth(index).check()
        await page.getByRole('button', { name: 'Revisar cadastro' }).click()
        // 4. Criação única, com novo desafio, e o checklist do dono pela API.
        const create = page.getByRole('button', {
          name: 'Criar minha locadora',
        })
        await expect
          .poll(() => create.isEnabled(), { timeout: 15_000 })
          .toBe(true)
        await create.click()
        await page
          .getByText('Locadora criada')
          .first()
          .waitFor({ timeout: 30_000 })
        const organization = await prisma.organization.findFirstOrThrow({
          where: { slug: `j-nova-${run}` },
        })
        expect(organization.name).toBe(`Jornada ${run}`)
        const status = await page.evaluate(async (tenantId) => {
          const response = await fetch('/api/onboarding/status', {
            headers: { 'x-tenant-id': tenantId },
          })
          return { status: response.status, body: await response.json() }
        }, organization.id)
        expect(status.status).toBe(200)
        expect(status.body).toEqual({
          subscriptionStatus: 'TRIALING',
          items: [
            { id: 'ACCOUNT_CREATED', done: true },
            { id: 'FIRST_EQUIPMENT', done: false },
            { id: 'CUSTOMIZE_SITE', done: true },
            { id: 'PUBLISH_SITE', done: false },
            { id: 'ACTIVATE_ONLINE_PAYMENTS', done: false },
            { id: 'SUBSCRIBE', done: false },
          ],
        })
        expect(
          await prisma.organization.count({ where: { slug: `j-nova-${run}` } })
        ).toBe(1)
        expect(
          await prisma.subscription.count({
            where: { tenantId: organization.id, status: 'TRIALING' },
          })
        ).toBe(1)
      } finally {
        const drainSessionTrace = sessionTrace.stop()
        await cleanupOwnedResources(
          [() => finishPage(page), drainSessionTrace],
          'J7 page/session diagnostic cleanup failed'
        )
      }
    },
    180_000
  )
})
