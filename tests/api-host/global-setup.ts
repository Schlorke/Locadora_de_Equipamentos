import { startPrivateStorageFixture } from './private-storage'
import { startZohoMailFixture } from './zoho-mail-provider'
import { startWhatsAppFixture } from './whatsapp-provider'
import { startShippingFixture } from './shipping-provider'
import { startResendFixture } from './resend-provider'
import {
  coverageReport,
  finishRecord,
  formatCoverage,
  readRecord,
  recordDirectory,
  startRecord,
} from './parity-report.mjs'
import { platformRateLimitDigest } from '../../packages/backend/src/modules/directory/rate-limit'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  closeSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:net'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

import type { TestProject } from 'vitest/node'
import { requireTestDatabase } from '../helpers/test-database'
import { publishTestOrganizations } from '../helpers/public-site'
import { alterSharedAcl } from '../helpers/shared-acl'
import {
  cleanupOwnedResources,
  stopOwnedProcess,
} from '../helpers/owned-process'

export type ApiParityContext = {
  /** Dublê do Resend (B9): todo e-mail real dos hosts chega aqui (`RESEND_BASE_URL`), nunca à internet. */
  resendOrigin: string
  /** Remetente configurado nos hosts (`FROM_EMAIL`). */
  mailFrom: string
  shippingOrigin: string
  whatsappOrigin: string
  zohoOrigin: string
  sessionCacheDirectory: string
  api: string
  /** Origem da raiz legada; `null` com `API_LEGACY_MODE=absent` (só a API sobe). Percorra os hosts por `./targets`. */
  legacy: string | null
  alfa: { id: string; slug: string; categoryId: string; equipmentIds: string[] }
  bravo: {
    id: string
    slug: string
    categoryId: string
    equipmentIds: string[]
  }
  suspended: string
  unconfigured: string
  secret: string
  storageOrigin: string
  runtimeUrl: string
  drivers: { alfa: string[]; bravo: string[]; unassigned: string }
  units: { alfa: string[]; bravo: string[]; unassigned: string }
  unassignedEquipment: string
  permissions: {
    alfaOperator: string
    bravoFinancial: string
    alfaClient: string
    wrongModule: string
    wrongAction: string
    unassigned: string
  }
  addresses: {
    alfa: string[]
    bravo: string[]
    otherAlfa: string
    otherBravo: string
    unassigned: string
  }
  directory: { marker: string; secret: string; ips: string[] }
  identity: {
    mode: 'legacy' | 'better-auth'
    users: Array<{ id: string; email: string; password: string }>
    memberships: string[]
  }
}
/** Pasta do registro desta rodada (B3/B11): requisições, casos e arquivos, fora do repositório. */
export type ApiParityRecord = { directory: string; profile: string }
declare module 'vitest' {
  export interface ProvidedContext {
    apiParity: ApiParityContext
    apiParityRecord: ApiParityRecord
  }
}

async function port() {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  const value = address.port
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return value
}
/**
 * Como a raiz legada roda na rodada de paridade (onda 135, E1):
 * - `production`: `next start` sobre o build da raiz (perfil da CI enquanto a raiz existe);
 * - `absent`: a raiz não sobe; só a API compartilhada, e `context.legacy` é `null`;
 * - sem valor (ou `dev`): `next dev` na raiz, para depuração local.
 * Valor desconhecido é recusado antes de qualquer escrita no banco: um erro de digitação nunca vira "sem raiz".
 */
export type LegacyParityMode = 'production' | 'dev' | 'absent'
export function legacyParityMode(
  env: Record<string, string | undefined>
): LegacyParityMode {
  const value = env.API_LEGACY_MODE?.trim()
  if (!value || value === 'dev') return 'dev'
  if (value === 'production' || value === 'absent') return value
  throw new Error(
    `API_LEGACY_MODE must be production, absent or dev (got ${JSON.stringify(value)})`
  )
}

/**
 * Every parity file shares the two owned servers, the runtime role and these fixtures, and many of them change that
 * state mid-test and restore it afterwards (grants revoked from the role, memberships created and removed, a locadora
 * suspended, the fixture users' carts replaced). Two files at once corrupt each other: swapped 403/404/400 answers and
 * unique-constraint failures in beforeAll (wave 131, finding 138). vitest.api.config.ts declares one worker; a larger
 * `--maxWorkers` is refused here, before any database write or server start.
 */
export function assertSerialParityRun(maxWorkers: number) {
  if (maxWorkers !== 1)
    throw new Error(
      `API parity shares servers and fixtures across files and must run with one worker (got maxWorkers=${maxWorkers}); run pnpm test:api without --maxWorkers`
    )
}

/**
 * Cobertura por método da rodada inteira (B3 da onda 135): só quando todos os arquivos de tests/api-host rodaram
 * (uma rodada filtrada não prova a superfície). Método sem sucesso esperado e sem exceção justificada reprova a rodada.
 */
export function assertParityCoverage(
  directory: string,
  root = process.cwd(),
  log: (line: string) => void = console.info
) {
  const expected = readdirSync(path.join(root, 'tests/api-host'))
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
  const ran = new Set(
    readRecord(directory, 'files.jsonl').map(
      (row: { file: string }) => row.file
    )
  )
  const missing = expected.filter((name) => !ran.has(name))
  if (missing.length) {
    log(
      `API parity coverage: partial run (${expected.length - missing.length}/${expected.length} files); the 173/221 check needs the whole suite. Record: ${directory}`
    )
    return null
  }
  const report = coverageReport(root, directory)
  writeFileSync(
    path.join(directory, 'coverage.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  log(`${formatCoverage(report)}\nRecord: ${directory}`)
  if (!report.ok)
    throw new Error(
      `API parity coverage failed: ${report.missing.length} methods without an expected success and ${report.problems.length} problems in tests/api-host/route-coverage-exceptions.json (see ${directory}/coverage.json)`
    )
  return report
}

export default async function setup(project: TestProject) {
  assertSerialParityRun(project.config.maxWorkers)
  const legacyMode = legacyParityMode(process.env)
  const recordProfile = `${legacyMode}-${process.env.API_AUTH_MODE === 'better-auth' ? 'better-auth' : 'legacy'}`
  const record = {
    directory: recordDirectory(process.env, recordProfile),
    profile: recordProfile,
  }
  startRecord(record.directory, {
    profile: recordProfile,
    legacyMode,
    authMode:
      process.env.API_AUTH_MODE === 'better-auth' ? 'better-auth' : 'legacy',
    hostMode: process.env.API_HOST_MODE ?? 'dev',
    startedAt: new Date().toISOString(),
  })
  project.provide('apiParityRecord', record)
  const databaseUrl = requireTestDatabase(process.env)
  const pool = new Pool({ connectionString: databaseUrl, max: 2 })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  const run = randomUUID().replaceAll('-', '').slice(0, 12)
  const role = `api_parity_${run}`
  const ids = [
    `api-alfa-${run}`,
    `api-bravo-${run}`,
    `api-suspended-${run}`,
    `api-unconfigured-${run}`,
  ]
  const categoryIds = [randomUUID(), randomUUID()]
  const equipmentIds = [
    Array.from({ length: 12 }, () => randomUUID()),
    Array.from({ length: 2 }, () => randomUUID()),
  ]
  const userIds = [randomUUID(), randomUUID(), randomUUID()]
  const drivers = {
    alfa: [randomUUID(), randomUUID(), randomUUID()],
    bravo: [randomUUID()],
    unassigned: randomUUID(),
  }
  const units: ApiParityContext['units'] = {
    alfa: Array.from({ length: 5 }, () => randomUUID()),
    bravo: Array.from({ length: 2 }, () => randomUUID()),
    unassigned: randomUUID(),
  }
  const unassignedEquipment = randomUUID()
  const addresses: ApiParityContext['addresses'] = {
    alfa: [randomUUID(), randomUUID(), randomUUID()],
    bravo: [randomUUID()],
    otherAlfa: randomUUID(),
    otherBravo: randomUUID(),
    unassigned: randomUUID(),
  }
  const permissions: ApiParityContext['permissions'] = {
    alfaOperator: randomUUID(),
    bravoFinancial: randomUUID(),
    alfaClient: randomUUID(),
    wrongModule: randomUUID(),
    wrongAction: randomUUID(),
    unassigned: randomUUID(),
  }
  const identity: ApiParityContext['identity'] = {
    mode:
      process.env.API_AUTH_MODE === 'better-auth' ? 'better-auth' : 'legacy',
    users: userIds.map((id, index) => ({
      id,
      email: `api-parity-${index}-${run}@example.test`,
      password: `local-parity-password-${index}-${run}`,
    })),
    memberships: [],
  }
  const directory = {
    marker: `APIDIR${run.toUpperCase()}`,
    secret: `local-directory-parity-${run}-secret-0123456789`,
    ips: Array.from(
      { length: 64 },
      (_, index) =>
        `2001:db8:${parseInt(run.slice(0, 4), 16).toString(16)}:${((parseInt(run.slice(4, 8), 16) + index) % 65536).toString(16)}::1`
    ),
  }
  const children: ChildProcess[] = []
  const logs: number[] = []
  let storageFixture:
    Awaited<ReturnType<typeof startPrivateStorageFixture>> | undefined
  let roleCreated = false
  let shippingFixture:
    Awaited<ReturnType<typeof startShippingFixture>> | undefined
  let sessionCacheDirectory: string | undefined
  let providerPreload: string | undefined
  let zohoFixture: Awaited<ReturnType<typeof startZohoMailFixture>> | undefined
  let whatsappFixture:
    Awaited<ReturnType<typeof startWhatsAppFixture>> | undefined
  let resendFixture: Awaited<ReturnType<typeof startResendFixture>> | undefined
  // Chave só de fixture: o dublê recusa qualquer outra, e nenhuma chave real chega aos hosts.
  const resendKey = `re_local_parity_${run}`
  const cleanup = async () => {
    const cleanupLabel = `Owned parity cleanup failed (child PIDs: ${children.map((child) => child.pid).join(', ')})`
    try {
      await cleanupOwnedResources(
        [
          ...[...children]
            .reverse()
            .map((child) => () => stopOwnedProcess(child)),
          () => storageFixture?.close(),
          () => zohoFixture?.close(),
          () => whatsappFixture?.close(),
          () => shippingFixture?.close(),
          () => resendFixture?.close(),
          () => {
            if (providerPreload) rmSync(providerPreload, { force: true })
          },
          ...logs.map((log) => () => closeSync(log)),
          ...identity.users.map((user) => () => {
            if (sessionCacheDirectory)
              rmSync(path.join(sessionCacheDirectory, `${user.id}.cookie`), {
                force: true,
              })
          }),
        ],
        cleanupLabel
      )
    } catch (error) {
      // Preserve fixture rows/ACLs while an owned server may still be using them.
      await cleanupOwnedResources(
        [
          () => {
            throw error
          },
          () => prisma.$disconnect(),
          () => pool.end(),
        ],
        cleanupLabel
      )
    }
    await prisma.outboxEvent.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.whatsAppMessage.deleteMany({
      where: { tenantId: { in: ids } },
    })
    await prisma.whatsAppConversation.deleteMany({
      where: { tenantId: { in: ids } },
    })
    await prisma.zohoMailToken.deleteMany({
      where: { userId: { in: userIds } },
    })
    await prisma.authVerification.deleteMany({
      where: {
        identifier: {
          in: ids.flatMap((tenantId) =>
            userIds.map((userId) => `zoho-oauth:${tenantId}:${userId}`)
          ),
        },
      },
    })
    await prisma.clientDocument.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.payment.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.delivery.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.maintenance.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.rental_items.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.rentals.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.quote.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.setting.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.equipmentUnit.deleteMany({
      where: { OR: [{ tenantId: { in: ids } }, { id: units.unassigned }] },
    })
    await prisma.equipment.deleteMany({
      where: { OR: [{ tenantId: { in: ids } }, { id: unassignedEquipment }] },
    })
    await prisma.category.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.driver.deleteMany({
      where: {
        OR: [{ tenantId: { in: ids } }, { id: drivers.unassigned }],
      },
    })
    await prisma.vehicle.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.permission.deleteMany({
      where: {
        OR: [{ tenantId: { in: ids } }, { id: permissions.unassigned }],
      },
    })
    await prisma.clientProfile.deleteMany({ where: { tenantId: { in: ids } } })
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.auditLog.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { tenantId: { in: ids } }] },
    })
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    for (const user of identity.users) {
      const digest = platformRateLimitDigest(
        directory.secret,
        'account',
        user.email
      )
      for (const kind of ['account', 'account-ip'])
        await prisma.platformRateLimit.deleteMany({
          where: { key: { startsWith: `auth:sign-in:${kind}:${digest}:` } },
        })
    }
    for (const ip of directory.ips) {
      const digest = platformRateLimitDigest(
        directory.secret,
        'ip',
        ip.replace(/::1$/, '::/64')
      )
      await prisma.platformRateLimit.deleteMany({
        where: { key: { startsWith: `directory-search:ip:${digest}:` } },
      })
      await prisma.platformRateLimit.deleteMany({
        where: { key: { startsWith: `auth:sign-in:ip:${digest}:` } },
      })
      await prisma.authRateLimit.deleteMany({
        // Better Auth normalizes IPv6 to a padded /64 before making its key.
        // Both spellings belong to this run's reserved fixture subnet. This
        // cleanup happens only after every owned HTTP child has stopped.
        where: {
          OR: [
            { key: { contains: ip } },
            {
              key: {
                startsWith:
                  ip
                    .split('::')[0]!
                    .split(':')
                    .map((part) => part.padStart(4, '0'))
                    .join(':') + ':',
              },
            },
          ],
        },
      })
    }
    if (roleCreated) {
      await alterSharedAcl(pool, [
        `REVOKE SELECT ON organizations, categories, equipments, settings, rentals, rental_items, payments, quotes FROM ${role}`,
        `REVOKE USAGE ON SCHEMA public FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON platform_rate_limits FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON users FROM ${role}`,
        `REVOKE SELECT, INSERT, DELETE ON verificationtokens FROM ${role}`,
        `REVOKE SELECT, INSERT ON memberships FROM ${role}`,
        `REVOKE SELECT ON subscriptions, platform_invoices, plans, plan_versions, entitlement_overrides FROM ${role}`,
        `REVOKE SELECT, INSERT ON audit_logs FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON maintenances FROM ${role}`,
        `REVOKE SELECT ON whatsapp_conversations, whatsapp_messages, zoho_mail_tokens FROM ${role}`,
        `REVOKE INSERT, UPDATE ON whatsapp_conversations, whatsapp_messages FROM ${role}`,
        `REVOKE UPDATE ON zoho_mail_tokens FROM ${role}`,
        `REVOKE INSERT, DELETE ON zoho_mail_tokens FROM ${role}`,
        `REVOKE SELECT, INSERT, DELETE ON auth_verifications FROM ${role}`,
        `REVOKE INSERT, UPDATE ON settings FROM ${role}`,
        `REVOKE UPDATE(id) ON organizations FROM ${role}`,
        `REVOKE SELECT, INSERT ON drivers FROM ${role}`,
        `REVOKE SELECT ON contracts, quote_adjustments FROM ${role}`,
        `REVOKE INSERT, UPDATE ON contracts FROM ${role}`,
        `REVOKE SELECT, INSERT ON contract_signature_attempts FROM ${role}`,
        `REVOKE UPDATE ON rentals, quotes FROM ${role}`,
        `REVOKE INSERT, DELETE ON quotes FROM ${role}`,
        `REVOKE INSERT ON quote_adjustments FROM ${role}`,
        `REVOKE SELECT ON payment_attempts, financial_settings FROM ${role}`,
        `REVOKE INSERT ON financial_settings FROM ${role}`,
        `REVOKE UPDATE ON payment_attempts FROM ${role}`,
        `REVOKE INSERT ON payment_attempts FROM ${role}`,
        `REVOKE SELECT ON tenant_integrations FROM ${role}`,
        `REVOKE SELECT ON payment_accounts FROM ${role}`,
        `REVOKE SELECT ON external_resource_tenants FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON webhook_inbox FROM ${role}`,
        `REVOKE INSERT ON notifications FROM ${role}`,
        `REVOKE INSERT ON rentals FROM ${role}`,
        `REVOKE INSERT, UPDATE ON rental_items FROM ${role}`,
        `REVOKE INSERT, UPDATE ON payments FROM ${role}`,
        `REVOKE SELECT, INSERT ON client_documents FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON outbox_events FROM ${role}`,
        `REVOKE SELECT, INSERT ON vehicles FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON deliveries FROM ${role}`,
        `REVOKE INSERT, UPDATE, DELETE ON categories FROM ${role}`,
        `REVOKE INSERT ON equipments FROM ${role}`,
        `REVOKE UPDATE, DELETE ON equipments FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON addresses FROM ${role}`,
        `REVOKE SELECT, INSERT, DELETE ON permissions FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON equipment_units FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON quote_items FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE ON client_profiles FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON carts, cart_items FROM ${role}`,
        `REVOKE SELECT, UPDATE, DELETE ON notifications FROM ${role}`,
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON auth_sessions, auth_accounts, auth_rate_limits FROM ${role}`,
        `DROP ROLE ${role}`,
      ])
    }
    await prisma.$disconnect()
    await pool.end()
  }
  try {
    await pool.query(
      `CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT`
    )
    roleCreated = true
    await alterSharedAcl(pool, [
      `GRANT USAGE ON SCHEMA public TO ${role}`,
      `GRANT SELECT ON organizations, categories, equipments, settings, rentals, rental_items, payments, quotes TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON platform_rate_limits TO ${role}`,
      `GRANT SELECT, UPDATE ON users TO ${role}`,
      `GRANT INSERT ON users TO ${role}`,
      `GRANT SELECT, INSERT, DELETE ON verificationtokens TO ${role}`,
      `GRANT SELECT, INSERT ON memberships TO ${role}`,
      `GRANT SELECT ON subscriptions, platform_invoices, plans, plan_versions, entitlement_overrides TO ${role}`,
      `GRANT SELECT, INSERT ON audit_logs TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE ON maintenances TO ${role}`,
      `GRANT SELECT ON whatsapp_conversations, whatsapp_messages, zoho_mail_tokens TO ${role}`,
      `GRANT INSERT, UPDATE ON whatsapp_conversations, whatsapp_messages TO ${role}`,
      `GRANT UPDATE ON zoho_mail_tokens TO ${role}`,
      `GRANT INSERT, DELETE ON zoho_mail_tokens TO ${role}`,
      `GRANT SELECT, INSERT, DELETE ON auth_verifications TO ${role}`,
      `GRANT INSERT, UPDATE ON settings TO ${role}`,
      `GRANT UPDATE(id) ON organizations TO ${role}`,
      `GRANT SELECT, INSERT ON drivers TO ${role}`,
      `GRANT SELECT ON contracts, quote_adjustments TO ${role}`,
      `GRANT INSERT, UPDATE ON contracts TO ${role}`,
      `GRANT SELECT, INSERT ON contract_signature_attempts TO ${role}`,
      `GRANT UPDATE ON rentals, quotes TO ${role}`,
      `GRANT INSERT, DELETE ON quotes TO ${role}`,
      `GRANT INSERT ON quote_adjustments TO ${role}`,
      `GRANT SELECT ON payment_attempts, financial_settings TO ${role}`,
      `GRANT INSERT ON financial_settings TO ${role}`,
      `GRANT INSERT ON payment_attempts TO ${role}`,
      `GRANT UPDATE ON payment_attempts TO ${role}`,
      `GRANT SELECT ON tenant_integrations TO ${role}`,
      // Canonical app_runtime grant (prisma/sql/roles/app_runtime.sql): the charge barrier reads the receiving
      // account under tenant RLS before any integration is selected (wave 134).
      `GRANT SELECT ON payment_accounts TO ${role}`,
      `GRANT SELECT ON external_resource_tenants TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE ON webhook_inbox TO ${role}`,
      `GRANT INSERT ON notifications TO ${role}`,
      `GRANT INSERT ON rentals TO ${role}`,
      `GRANT INSERT, UPDATE ON rental_items TO ${role}`,
      `GRANT INSERT, UPDATE ON payments TO ${role}`,
      `GRANT SELECT ON client_documents TO ${role}`,
      `GRANT INSERT ON client_documents TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE ON outbox_events TO ${role}`,
      `GRANT INSERT, UPDATE, DELETE ON categories TO ${role}`,
      `GRANT INSERT ON equipments TO ${role}`,
      `GRANT UPDATE, DELETE ON equipments TO ${role}`,
      `GRANT SELECT, INSERT ON vehicles TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE ON deliveries TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON addresses TO ${role}`,
      `GRANT SELECT, INSERT, DELETE ON permissions TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_units TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON quote_items TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE ON client_profiles TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON carts, cart_items TO ${role}`,
      `GRANT SELECT, UPDATE, DELETE ON notifications TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions, auth_accounts, auth_rate_limits TO ${role}`,
    ])
    for (const user of identity.users) {
      const password = await bcrypt.hash(user.password, 12)
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: 'fixture-private-customer',
          password,
          role: 'ADMIN',
          authEmailVerified: true,
        },
      })
      // After cutover the engine consumes its migrated credential account;
      // the legacy password alone is intentionally not a fallback.
      if (identity.mode === 'better-auth')
        await prisma.authAccount.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: 'credential',
            password,
          },
        })
    }
    const runtimeUrl = new URL(databaseUrl)
    runtimeUrl.searchParams.set('options', `-c role=${role}`)
    for (const [index, name] of [
      'alfa',
      'bravo',
      'suspended',
      'unconfigured',
    ].entries()) {
      await prisma.organization.create({
        data: {
          id: ids[index]!,
          slug: ids[index]!,
          name,
          status: name === 'suspended' ? 'SUSPENDED' : 'ACTIVE',
          // Identificação legal pública da vitrine (achado 147): só a alfa tem; o CNPJ legado vem formatado.
          ...(index === 0
            ? {
                legalName: 'Alfa Equipamentos Ltda',
                document: '11.222.333/0001-81',
              }
            : {}),
        },
      })
      if (index < 2) {
        await prisma.category.create({
          data: {
            id: categoryIds[index],
            tenantId: ids[index],
            name: index === 0 ? 'Andaimes' : 'Betoneiras',
            slug: `cat-${name}-${run}`,
            iconColor: '#ea580c',
            bgColor: '#fff7ed',
            fontColor: '#7c2d12',
          },
        })
        for (const [number, id] of equipmentIds[index]!.entries()) {
          const descriptionMatch = number === equipmentIds[index]!.length - 1
          await prisma.equipment.create({
            data: {
              id,
              tenantId: ids[index],
              categoryId: categoryIds[index]!,
              name: descriptionMatch
                ? `Andaime exclusivo ${name}`
                : `Betoneira ${name} ${String(number).padStart(2, '0')}`,
              description: descriptionMatch
                ? `guindaste na descrição ${name}`
                : `Concreto ${name}`,
              pricePerDay: '12.50',
              dailyDirectValue: '17.25',
              dailyUseDirectValue: true,
              images:
                number === 0 ? [`https://assets.example.test/${name}.jpg`] : [],
              available: number !== 10,
              maxStock: number === 0 ? 3 : number === 2 ? 0 : 1,
              createdAt: new Date(Date.UTC(2030, 0, 1, 0, 0, number)),
              purchasePrice: '99999',
              specifications: { internal: 'fixture-private' },
              partsLossHistory: { internal: 'fixture-private' },
            },
          })
        }
        const day = (date: number, hour = 0) =>
          new Date(Date.UTC(2030, 0, date, hour))
        // Mesmo instante de saída/entrada mantém a sobreposição inclusiva.
        for (const [slot, status, start, end, quantity] of [
          [0, 'ACTIVE', day(1, 10), day(3, 8), index === 0 ? 2 : 1],
          [1, 'ACTIVE', day(3, 8), day(5, 10), index === 0 ? 1 : 0],
          [2, 'COMPLETED', day(1), day(30, 23), 99],
          [3, 'CANCELLED', day(1), day(30, 23), 99],
        ] as const) {
          if (quantity === 0) continue
          await prisma.rentals.create({
            data: {
              id: randomUUID(),
              tenantId: ids[index],
              userid: userIds[index]!,
              status,
              startdate: start,
              enddate: end,
              total: '15',
              notes: 'fixture-private-rental',
              rental_items: {
                create: {
                  id: randomUUID(),
                  tenantId: ids[index],
                  equipmentid: equipmentIds[index]![0]!,
                  quantity,
                  priceperday: '5',
                  totaldays: slot + 1,
                  totalprice: '15',
                  // As duas reservas ativas exercitam tanto datas do item quanto fallback.
                  startDate: slot === 0 ? start : null,
                  endDate: slot === 0 ? end : null,
                },
              },
            },
          })
        }
        if (index === 0) {
          for (const [date, status, terms, payments] of [
            [10, 'APPROVED', 'UPFRONT', ['PAID']],
            [11, 'APPROVED', 'UPFRONT', ['PENDING']],
            [12, 'APPROVED', 'AT_END', []],
            [13, 'REJECTED', 'UPFRONT', ['PAID']],
            [14, 'APPROVED', 'UPFRONT', ['REFUNDED', 'PAID']],
          ] as const) {
            const quote = await prisma.quote.create({
              data: {
                tenantId: ids[index],
                name: 'fixture-private-customer',
                email: `api-parity-${name}-${run}@example.test`,
                phone: 'fixture-private-phone',
                status,
                paymentTerms: terms,
                total: '15',
              },
            })
            await prisma.rentals.create({
              data: {
                id: randomUUID(),
                tenantId: ids[index],
                userid: userIds[index]!,
                quoteId: quote.id,
                status: status === 'REJECTED' ? 'ACTIVE' : 'PENDING',
                startdate: day(date),
                enddate: day(date, 23),
                total: '15',
                rental_items: {
                  create: {
                    id: randomUUID(),
                    tenantId: ids[index],
                    equipmentid: equipmentIds[index]![1]!,
                    quantity: 1,
                    priceperday: '15',
                    totaldays: 1,
                    totalprice: '15',
                  },
                },
                payments: {
                  create: payments.map((paymentStatus) => ({
                    tenantId: ids[index],
                    status: paymentStatus,
                    dueDate: day(date),
                    amount: '15',
                    method: 'PIX',
                    type: 'DEPOSIT',
                  })),
                },
              },
            })
          }
        }
        await prisma.setting.create({
          data: {
            tenantId: ids[index],
            contactEmail: `${name}@example.test`,
            companyPhone: `phone-${name}`,
            whatsappNumber: `whatsapp-${name}`,
            companyAddress: `Endereço ${name}`,
            companyIconUrl: `https://assets.example.test/${name}-logo.svg`,
            marketingEmail: `marketing-${name}@example.test`,
            aboutUsText: `Sobre ${name}`,
            socialLinks: { website: `https://${name}.example.test` },
            heroCarousel: [
              {
                title: `Destaque ${name}`,
                imageUrl: `https://assets.example.test/${name}-hero.jpg`,
              },
            ],
            waveAnimation: 'animated',
            // Horário de funcionamento (achado 147): o formato do painel e do script da GB, só na alfa.
            ...(index === 0
              ? {
                  businessHours: {
                    monday: { open: '08:00', close: '18:00', closed: false },
                    friday: { open: '08:00', close: '18:00', closed: false },
                    saturday: { open: '08:00', close: '12:00', closed: false },
                    sunday: { closed: true },
                  },
                }
              : {}),
            smtpConfig: { password: 'fixture-private' },
            securityConfig: { key: 'fixture-private' },
            customJs: 'fixture-private',
          },
        })
      }
    }
    for (const [user, tenant, membershipRole, status] of [
      [0, 0, 'CLIENT', 'ACTIVE'],
      [0, 1, 'FINANCIAL', 'ACTIVE'],
      [0, 2, 'ADMIN', 'ACTIVE'],
      [0, 3, 'ADMIN', 'REVOKED'],
      [1, 1, 'OPERATOR', 'ACTIVE'],
    ] as const) {
      const membership = await prisma.membership.create({
        data: {
          userId: userIds[user]!,
          tenantId: ids[tenant]!,
          role: membershipRole,
          status,
        },
      })
      identity.memberships.push(membership.id)
    }
    for (let index = 0; index < 15; index++) {
      const id = `api-dir-${run}-${index}`
      ids.push(id)
      await prisma.organization.create({
        data: {
          id,
          slug: id,
          name:
            index < 12
              ? `${directory.marker} ${String(index).padStart(2, '0')}`
              : index === 14
                ? `${directory.marker} wildcard %_\\`
                : `${directory.marker} hidden-${index}`,
          city: 'Porto Alegre',
          state: 'RS',
          document: '12345678000199',
          postalCode: '12345678',
          directoryListed: index !== 12,
          status: index === 13 ? 'SUSPENDED' : 'ACTIVE',
        },
      })
    }
    // Locadoras vivas, como as que a migration 0104 publicou (S13): a vitrine pública só responde publicada.
    await publishTestOrganizations(prisma, ids)
    const driverDate = new Date('2026-01-01T00:00:00.000Z')
    await prisma.driver.createMany({
      data: [
        ...drivers.alfa.map((id, index) => ({
          id,
          tenantId: ids[0],
          name: ['Zeta alfa', 'Alpha alfa', 'Middle alfa'][index]!,
          phone: 'fixture-private-phone',
          cnh: 'fixture-private-cnh',
          cnhCategory: 'B',
          status: (['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const)[index]!,
          createdAt: driverDate,
          updatedAt: driverDate,
        })),
        {
          id: drivers.bravo[0]!,
          tenantId: ids[1],
          name: 'Only bravo',
          phone: 'fixture-private-phone',
          createdAt: driverDate,
          updatedAt: driverDate,
        },
        {
          id: drivers.unassigned,
          name: 'Quarantined legacy',
          phone: 'fixture-private-phone',
          createdAt: driverDate,
          updatedAt: driverDate,
        },
      ],
    })
    const addressFields = {
      street: 'Fixture private street',
      number: '1',
      complement: null,
      neighborhood: 'Fixture neighborhood',
      city: 'Fixture city',
      state: 'SP',
      zipCode: '01001000',
      updatedAt: driverDate,
    }
    await prisma.address.createMany({
      data: [
        ...addresses.alfa.map((id, index) => ({
          ...addressFields,
          id,
          tenantId: ids[0],
          userId: userIds[0]!,
          isPrimary: index === 0,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        })),
        {
          ...addressFields,
          id: addresses.bravo[0]!,
          tenantId: ids[1],
          userId: userIds[0]!,
          isPrimary: true,
          createdAt: driverDate,
        },
        ...[
          [addresses.otherAlfa, ids[0]],
          [addresses.otherBravo, ids[1]],
        ].map(([id, tenantId]) => ({
          ...addressFields,
          id: id!,
          tenantId,
          userId: userIds[1]!,
          isPrimary: true,
          createdAt: driverDate,
        })),
        {
          ...addressFields,
          id: addresses.unassigned,
          userId: userIds[0]!,
          isPrimary: true,
          createdAt: driverDate,
        },
      ],
    })
    await prisma.permission.createMany({
      data: [
        {
          id: permissions.alfaOperator,
          tenantId: ids[0],
          role: 'OPERATOR',
          module: 'EQUIPMENTS',
          action: 'READ',
        },
        {
          id: permissions.bravoFinancial,
          tenantId: ids[1],
          role: 'FINANCIAL',
          module: 'EQUIPMENTS',
          action: 'READ',
        },
        {
          id: permissions.alfaClient,
          tenantId: ids[0],
          role: 'CLIENT',
          module: 'EQUIPMENTS',
          action: 'READ',
        },
        {
          id: permissions.wrongModule,
          tenantId: ids[0],
          role: 'FINANCIAL',
          module: 'FINANCIAL',
          action: 'READ',
        },
        {
          id: permissions.wrongAction,
          tenantId: ids[0],
          role: 'FINANCIAL',
          module: 'EQUIPMENTS',
          action: 'WRITE',
        },
        {
          id: permissions.unassigned,
          role: 'OPERATOR',
          module: 'EQUIPMENTS',
          action: 'READ',
        },
      ],
    })
    const unitDate = new Date('2026-01-01T00:00:00.000Z')
    await prisma.equipmentUnit.createMany({
      data: [
        ...(
          ['AVAILABLE', 'RENTED', 'RESERVED', 'MAINTENANCE', 'RETIRED'] as const
        ).map((status, index) => ({
          id: units.alfa[index]!,
          tenantId: ids[0],
          equipmentId: equipmentIds[0]![index < 2 ? 0 : 1]!,
          uniqueCode: `UNIT-0${[2, 1, 3, 5, 4][index]}`,
          status,
          serialNumber:
            index === 0
              ? 'Serial-Alfa'
              : index === 1
                ? 'Case-Marker'
                : index === 2
                  ? 'Unique-Serial'
                  : null,
          notes: index === 0 ? 'Private unit note' : null,
          hourMeter: index === 0 ? '12.345' : index === 2 ? '0' : null,
          odometer: index === 0 ? '987.65' : index === 2 ? '0' : null,
          createdAt: unitDate,
          updatedAt: unitDate,
        })),
        ...(['RENTED', 'AVAILABLE'] as const).map((status, index) => ({
          id: units.bravo[index]!,
          tenantId: ids[1],
          equipmentId: equipmentIds[1]![0]!,
          uniqueCode: index ? 'UNIT-06' : 'UNIT-01',
          status,
          serialNumber: index ? null : 'Case-Marker',
          notes: 'Foreign unit private note',
          createdAt: unitDate,
          updatedAt: unitDate,
        })),
        {
          id: units.unassigned,
          equipmentId: equipmentIds[0]![0]!,
          uniqueCode: 'UNIT-00',
          serialNumber: 'Case-Marker',
          createdAt: unitDate,
          updatedAt: unitDate,
        },
      ],
    })
    // Rejected quotes exercise nonzero administrative counts without reserving stock.
    for (const [index, count] of [
      [0, 2],
      [1, 1],
    ] as const) {
      await prisma.quote.create({
        data: {
          tenantId: ids[index],
          name: 'Fixture count customer',
          email: `api-parity-count-${index}-${run}@example.test`,
          phone: 'fixture-count-phone',
          status: 'REJECTED',
          total: String(count * 5),
          items: {
            create: Array.from({ length: count }, () => ({
              tenantId: ids[index],
              equipmentId: equipmentIds[index]![0]!,
              pricePerDay: '5',
              total: '5',
              quantity: 1,
              days: 1,
            })),
          },
        },
      })
    }
    await prisma.equipment.create({
      data: {
        id: unassignedEquipment,
        name: 'Unassigned fixture equipment',
        description: 'Unassigned fixture private description',
        pricePerDay: '12.50',
        categoryId: categoryIds[0]!,
        images: [],
      },
    })
    const ports = [await port(), await port()]
    const secret = 'api-parity-local-edge-secret-0123456789'
    const temp = mkdtempSync(path.join(tmpdir(), 'locadora-api-parity-'))
    sessionCacheDirectory = temp
    const context: ApiParityContext = {
      sessionCacheDirectory,
      api: `http://127.0.0.1:${ports[1]}`,
      legacy: legacyMode === 'absent' ? null : `http://127.0.0.1:${ports[0]}`,
      alfa: {
        id: ids[0]!,
        slug: ids[0]!,
        categoryId: categoryIds[0]!,
        equipmentIds: equipmentIds[0]!,
      },
      bravo: {
        id: ids[1]!,
        slug: ids[1]!,
        categoryId: categoryIds[1]!,
        equipmentIds: equipmentIds[1]!,
      },
      suspended: ids[2]!,
      unconfigured: ids[3]!,
      secret,
      storageOrigin: '',
      resendOrigin: '',
      mailFrom: 'Plataforma <no-reply@platform.test>',
      zohoOrigin: '',
      whatsappOrigin: '',
      shippingOrigin: '',
      runtimeUrl: runtimeUrl.href,
      drivers,
      units,
      unassignedEquipment,
      addresses,
      permissions,
      directory,
      identity,
    }
    storageFixture = await startPrivateStorageFixture()
    context.storageOrigin = storageFixture.origin
    zohoFixture = await startZohoMailFixture(temp)
    context.zohoOrigin = zohoFixture.origin
    whatsappFixture = await startWhatsAppFixture(temp)
    context.whatsappOrigin = whatsappFixture.origin
    shippingFixture = await startShippingFixture(temp)
    context.shippingOrigin = shippingFixture.origin
    resendFixture = await startResendFixture(resendKey)
    context.resendOrigin = resendFixture.origin
    // next dev serializes repeated NODE_OPTIONS keys into one value in its worker.
    // One preload preserves all three provider interceptors through that fork.
    providerPreload = path.join(temp, 'providers-fetch-preload.cjs')
    writeFileSync(
      providerPreload,
      [zohoFixture.preload, whatsappFixture.preload, shippingFixture.preload]
        .map((file) => `require(${JSON.stringify(file)});`)
        .join('\n')
    )
    const next = path.resolve('node_modules/next/dist/bin/next')
    for (const [index, name] of ['legacy', 'api'].entries()) {
      // Sem a raiz (API_LEGACY_MODE=absent) só a API compartilhada sobe.
      if (name === 'legacy' && legacyMode === 'absent') continue
      const log = openSync(path.join(temp, `${name}.log`), 'w')
      logs.push(log)
      const production =
        name === 'api'
          ? process.env.API_HOST_MODE === 'production'
          : legacyMode === 'production'
      const standalone = name === 'api' && production
      const entrypoint = standalone
        ? path.resolve(
            'apps/services/api/.next/standalone/apps/services/api/server.js'
          )
        : next
      const child = spawn(
        process.execPath,
        standalone
          ? [entrypoint]
          : [
              entrypoint,
              production ? 'start' : 'dev',
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
            DATABASE_URL: runtimeUrl.href,
            // The platform runtime is a separate role. This harness only provisions the business role.
            // Never inherit a developer/production PLATFORM_DATABASE_URL for a parity test.
            PLATFORM_DATABASE_URL: '',
            PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
            PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_SHA256: '',
            PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256: '',
            PLATFORM_SELF_SERVICE_SIGNUP: 'off',
            // This base fixture has no subscriptions. Policy-on tests use their own
            // receiving-account fixtures; never inherit an invalid or real cutover flag.
            PLATFORM_SUBSCRIPTION_ENFORCEMENT: 'off',
            PLATFORM_SECRETS_KEK_PROVIDER: 'env',
            PLATFORM_SECRETS_KEK_CURRENT: '',
            PLATFORM_SECRETS_KMS_KEY_ARN: '',
            PLATFORM_SECRET_FINGERPRINT_KEY: '',
            AWS_ROLE_ARN: '',
            AWS_WEB_IDENTITY_TOKEN_FILE: '',
            INTEGRATION_ENV_REFS_ALLOWED: 'true',
            DIRECT_URL: runtimeUrl.href,
            NODE_ENV: production ? 'production' : 'development',
            PORT: String(ports[index]),
            HOSTNAME: '127.0.0.1',
            PLATFORM_ENV: 'production',
            PLATFORM_ROOT_DOMAIN: 'platform.test',
            PLATFORM_EDGE_SECRET: secret,
            PLATFORM_RATE_LIMIT_SECRET: directory.secret,
            TRUSTED_PROXY_HOPS: '',
            VERCEL: undefined,
            WEB_API_ORIGIN: '',
            NEXT_TELEMETRY_DISABLED: '1',
            AUTH_MODE: identity.mode,
            NEXT_PUBLIC_AUTH_MODE: identity.mode,
            AUTH_V2_ENABLED: 'true',
            // O NextAuth é servido pela API em toda rodada (e só por ela sem a raiz): a origem HTTP dela mantém os nomes
            // de cookie do NextAuth (sem o prefixo __Secure-), então os cookies forjados dos testes continuam sendo lidos e
            // recusados. Em produção vale https://app.<raiz> (runbook do corte).
            NEXTAUTH_URL: context.api,
            NEXTAUTH_SECRET: 'local-api-parity-only-secret',
            BETTER_AUTH_URL: 'https://app.platform.test',
            BETTER_AUTH_SECRET: 'local-api-better-auth-secret-0123456789',
            AUTH_TRUSTED_ORIGINS: '',
            BETTER_AUTH_TRUSTED_ORIGINS: '',
            AUTH_CREDENTIAL_WRITES_PAUSED: '',
            // E-mails reais pelo SDK do Resend, apontado ao dublê de loopback (B9 da onda 135).
            RESEND_API_KEY: resendKey,
            RESEND_BASE_URL: context.resendOrigin,
            FROM_EMAIL: context.mailFrom,
            CRON_SECRET:
              process.env.API_CRON_SECRET ?? 'local-api-cron-fixture-only',
            ZOHO_CLIENT_ID: '',
            ZOHO_CLIENT_SECRET: '',
            ZOHO_MAIL_DATACENTER: 'com',
            // Keep local .env files from replacing the fixture's fixed app callback.
            ZOHO_REDIRECT_URI: '',
            ...(zohoFixture
              ? {
                  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(providerPreload.replaceAll('\\', '/'))}`,
                  ZOHO_CLIENT_ID: 'local-zoho-fixture-client',
                  ZOHO_CLIENT_SECRET: 'local-zoho-fixture-secret',
                }
              : {}),
            NEXT_PUBLIC_SUPABASE_URL: storageFixture.origin,
            SUPABASE_SERVICE_ROLE_KEY: 'local-private-storage-fixture-only',
            LOCADORA_INTEGRATION_PARITY_SECRET: 'local-api-parity-only-secret',
            LOCADORA_INTEGRATION_PARITY_API_KEY: 'local-api-parity-only-key',
            LOCADORA_INTEGRATION_PARITY_ENVIRONMENT: 'sandbox',
            PLATFORM_ASAAS_OUTBOUND_DISABLED: 'true',
            LOCADORA_INTEGRATION_SHIPPING_PARITY_SECRET:
              'local-shipping-parity-secret',
            LOCADORA_INTEGRATION_SHIPPING_PARITY_API_KEY:
              'local-shipping-parity-key',
            LOCADORA_INTEGRATION_SHIPPING_PARITY_ENVIRONMENT: 'sandbox',
            LOCADORA_INTEGRATION_SHIPPING_PARITY_USER_AGENT:
              'Fixture (shipping@example.test)',
            LOCADORA_INTEGRATION_SHIPPING_FOREIGN_SECRET:
              'local-shipping-foreign-secret',
            LOCADORA_INTEGRATION_SHIPPING_FOREIGN_API_KEY:
              'local-shipping-foreign-key',
            LOCADORA_INTEGRATION_SHIPPING_FOREIGN_ENVIRONMENT: 'production',
            LOCADORA_INTEGRATION_SHIPPING_FOREIGN_USER_AGENT:
              'Foreign (shipping@example.test)',
            LOCADORA_INTEGRATION_SHIPPING_EMPTY_SECRET:
              'local-shipping-empty-secret',
            LOCADORA_INTEGRATION_SHIPPING_EMPTY_API_KEY: '',
            LOCADORA_INTEGRATION_SHIPPING_EMPTY_ENVIRONMENT: 'sandbox',
            LOCADORA_INTEGRATION_SHIPPING_EMPTY_USER_AGENT:
              'Fixture (shipping@example.test)',
            LOCADORA_INTEGRATION_SHIPPING_BAD_AGENT_SECRET:
              'local-shipping-bad-agent-secret',
            LOCADORA_INTEGRATION_SHIPPING_BAD_AGENT_API_KEY:
              'local-shipping-bad-agent-key',
            LOCADORA_INTEGRATION_SHIPPING_BAD_AGENT_ENVIRONMENT: 'sandbox',
            LOCADORA_INTEGRATION_SHIPPING_BAD_AGENT_USER_AGENT:
              'invalid-contact',
            LOCADORA_INTEGRATION_WHATSAPP_PARITY_SECRET:
              'local-whatsapp-parity-secret',
            LOCADORA_INTEGRATION_WHATSAPP_PARITY_API_KEY:
              'local-whatsapp-parity-key',
            LOCADORA_INTEGRATION_WHATSAPP_PARITY_VERIFY_TOKEN:
              'local-whatsapp-parity-verify',
            LOCADORA_INTEGRATION_WHATSAPP_FOREIGN_SECRET:
              'local-whatsapp-foreign-secret',
            LOCADORA_INTEGRATION_WHATSAPP_FOREIGN_API_KEY:
              'local-whatsapp-foreign-key',
            LOCADORA_INTEGRATION_WHATSAPP_FOREIGN_VERIFY_TOKEN:
              'local-whatsapp-foreign-verify',
            LOCADORA_INTEGRATION_WEBHOOK_PARITY_SECRET:
              'local-webhook-parity-secret',
            LOCADORA_INTEGRATION_WEBHOOK_PARITY_API_KEY:
              'local-webhook-parity-key',
            LOCADORA_INTEGRATION_WEBHOOK_PARITY_ENVIRONMENT: 'sandbox',
            LOCADORA_INTEGRATION_WEBHOOK_FOREIGN_SECRET:
              'local-webhook-foreign-secret',
          },
          stdio: ['ignore', log, log],
        }
      )
      children.push(child)
      let ready = false
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(`${name} exited; inspect ${temp}`)
        try {
          const response = await fetch(
            `${index === 0 ? context.legacy! : context.api}/api/health`,
            { signal: AbortSignal.timeout(4000) }
          )
          if (response.ok && (await response.json()).status === 'healthy') {
            ready = true
            break
          }
        } catch {
          /* The owned server is still starting. */
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (!ready)
        throw new Error(`${name} did not become ready; inspect ${temp}`)
    }
    project.provide('apiParity', context)
    console.info(
      legacyMode === 'absent'
        ? `API parity: owned ${process.env.API_HOST_MODE ?? 'dev'} service only (legacy root absent); auth ${identity.mode}; logs ${temp}`
        : `API parity: owned ${legacyMode} legacy + ${process.env.API_HOST_MODE ?? 'dev'} service; auth ${identity.mode}; logs ${temp}`
    )
    // Production-only contracts (Secure cookies, generic error bodies without details) are asserted as CI runs them.
    if (legacyMode === 'dev' || process.env.API_HOST_MODE !== 'production')
      console.warn(
        'API parity: a host runs in dev; assertions of production behavior (Secure cookies, generic errors) fail by design. The full verification is the CI profile: build the hosts, then API_HOST_MODE=production with API_LEGACY_MODE=production (or absent, without the legacy root) for each API_AUTH_MODE.'
      )
    return async () => {
      await cleanup()
      assertParityCoverage(record.directory)
      finishRecord(record.directory, {
        files: project.vitest.state.getFiles(),
        unhandledErrors: project.vitest.state.getUnhandledErrors(),
      })
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
