import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ADR SaaS B.5/B.10: os dois hosts de cron usam o mesmo runner e declaram o job de cada rota.
const state = vi.hoisted(() => {
  const organizations: Array<{ id: string; access: string }> = []
  const database = {
    organization: {
      findMany: async () => organizations.map(({ id }) => ({ id })),
      findFirst: async ({ where }: { where: { id: string } }) => {
        const found = organizations.find(({ id }) => id === where.id)
        return found ? { access: found.access } : null
      },
    },
  }
  return {
    organizations,
    database,
    lateFees: vi.fn(async (context: { tenantId: string }) => ({
      tenantId: context.tenantId,
    })),
    transaction: vi.fn(),
  }
})
vi.mock('@/lib/prisma', () => ({ prisma: state.database }))
vi.mock('@/lib/tenant', () => ({ withTenantTransaction: state.transaction }))
vi.mock('@/lib/late-fee-calculator', () => ({
  calculateAndApplyLateFees: state.lateFees,
}))
vi.mock('@gb-locacoes/backend/runtime', () => ({
  getDatabaseRuntime: () => ({ prisma: state.database }),
}))
vi.mock('../../apps/services/api/src/host/tenant-transaction', () => ({
  withTenantTransaction: state.transaction,
}))
vi.mock('../../apps/services/api/src/host/quotations', () => ({
  calculateAndApplyLateFees: state.lateFees,
}))
import { runTenantCron as legacyRunner } from '@/lib/security/tenant-cron'
import { runTenantCron as serviceRunner } from '../../apps/services/api/src/host/tenant-cron'
import { GET as legacyLateFees } from '@/app/api/cron/late-fees/route'
import { GET as serviceLateFees } from '../../apps/services/api/src/app/api/cron/late-fees/route'

const ROOT = path.resolve(__dirname, '../..')
const SECRET = 'tenant-cron-host-fixture-secret'
const HOSTS = [
  ['legacy', 'app/api/cron'],
  ['service', 'apps/services/api/src/app/api/cron'],
] as const
const OBLIGATION_ROUTES = [
  'auto-convert-quotes',
  'boleto-overdue-alerts',
  'expire-quotes',
  'late-fees',
  'preventive-maintenance',
  'send-notifications',
  'verify-boleto-payments',
]
const request = () =>
  new Request('http://localhost/api/cron/fixture', {
    headers: { authorization: `Bearer ${SECRET}` },
  })

beforeEach(() => {
  state.organizations.splice(
    0,
    state.organizations.length,
    { id: 'tenant-full', access: 'FULL' },
    { id: 'tenant-setup', access: 'SETUP' },
    { id: 'tenant-restricted', access: 'RESTRICTED' },
    { id: 'tenant-archived', access: 'ARCHIVED' }
  )
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'on')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

/** Problems of the `runTenantCron` calls of one cron route: each declares its own job literally. */
function declarationProblems(file: string, source: string) {
  const route = path.basename(path.dirname(file))
  const problems: string[] = []
  const declared: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'runTenantCron'
    ) {
      const options = node.arguments[2]
      const job =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find(
              (property): property is ts.PropertyAssignment =>
                ts.isPropertyAssignment(property) &&
                ts.isIdentifier(property.name) &&
                property.name.text === 'job'
            )
          : undefined
      if (!job || !ts.isStringLiteral(job.initializer))
        problems.push(`${route}: runTenantCron without a literal job`)
      else if (job.initializer.text !== route)
        problems.push(`${route}: declares ${job.initializer.text}`)
      else declared.push(job.initializer.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))
  return { problems, declared }
}
function hostDeclarations(directory: string) {
  const declared: string[] = []
  const problems: string[] = []
  for (const entry of fs.readdirSync(path.join(ROOT, directory))) {
    const file = path.join(ROOT, directory, entry, 'route.ts')
    if (!fs.existsSync(file)) continue
    const result = declarationProblems(file, fs.readFileSync(file, 'utf8'))
    declared.push(...result.declared)
    problems.push(...result.problems)
  }
  return { declared: declared.sort(), problems }
}

describe('tenant cron routes declare their job on both hosts', () => {
  it.each(HOSTS)(
    '%s routes declare one catalog job per runner call',
    (_host, directory) => {
      const { declared, problems } = hostDeclarations(directory)
      expect(problems).toEqual([])
      expect(declared).toEqual(OBLIGATION_ROUTES)
    }
  )

  // A autocrítica roda sobre a rota de cada host (onda 135, B8): a da API compartilhada continua depois que a raiz sair.
  it.each(HOSTS)(
    '%s: rejects a runner call without its declaration',
    (_host, directory) => {
      const file = path.join(ROOT, directory, 'late-fees/route.ts')
      const source = fs.readFileSync(file, 'utf8')
      expect(declarationProblems(file, source).problems).toEqual([])
      for (const changed of [
        source.replace(
          "runTenantCron(request, runJob, { job: 'late-fees' })",
          'runTenantCron(request, runJob)'
        ),
        source.replace("{ job: 'late-fees' }", "{ job: 'expire-quotes' }"),
        source.replace("{ job: 'late-fees' }", '{ job: name }'),
      ]) {
        expect(changed).not.toBe(source)
        expect(declarationProblems(file, changed).problems).toHaveLength(1)
      }
    }
  )
})

describe.each([
  ['legacy', legacyRunner],
  ['service', serviceRunner],
] as const)('%s cron facade', (_host, runTenantCron) => {
  const job = vi.fn(async (context: { tenantId: string }) =>
    Response.json({ ran: context.tenantId })
  )
  const ran = () => job.mock.calls.map((call) => call[0].tenantId)
  beforeEach(() => {
    job.mockClear()
  })

  it('skips the promotion job outside FULL with enforcement on', async () => {
    const response = await runTenantCron(request(), job, {
      job: 'sync-google-merchant',
    })
    expect(response.status).toBe(200)
    expect((await response.json()).skippedTenants).toEqual([
      { tenantId: 'tenant-setup', access: 'SETUP' },
      { tenantId: 'tenant-restricted', access: 'RESTRICTED' },
      { tenantId: 'tenant-archived', access: 'ARCHIVED' },
    ])
    expect(ran()).toEqual(['tenant-full'])
  })

  it('records without skipping in shadow and has no effect in off', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'shadow')
    await runTenantCron(request(), job, { job: 'sync-google-merchant' })
    expect(ran()).toHaveLength(4)
    expect(warn).toHaveBeenCalledWith('[tenant-cron-shadow]', {
      tenantId: 'tenant-archived',
      job: 'sync-google-merchant',
      access: 'ARCHIVED',
    })
    warn.mockClear()
    job.mockClear()
    vi.stubEnv('PLATFORM_SUBSCRIPTION_ENFORCEMENT', 'off')
    await runTenantCron(request(), job, { job: 'sync-google-merchant' })
    expect(ran()).toHaveLength(4)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe.each([
  ['legacy', legacyLateFees],
  ['service', serviceLateFees],
] as const)('%s obligation route', (_host, GET) => {
  it('still charges late fees for SETUP, RESTRICTED and ARCHIVED with enforcement on', async () => {
    state.lateFees.mockClear()
    const response = await GET(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).not.toHaveProperty('skippedTenants')
    expect(state.lateFees.mock.calls.map((call) => call[0])).toEqual([
      { tenantId: 'tenant-full' },
      { tenantId: 'tenant-setup' },
      { tenantId: 'tenant-restricted' },
      { tenantId: 'tenant-archived' },
    ])
  })
})
