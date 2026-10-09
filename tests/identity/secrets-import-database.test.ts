import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import {
  createSecretImporter,
  createEnvKeyring,
  createSecretVault,
} from '../../packages/backend/src/modules/secrets/index'
import { runIntegrationSecretsImport } from '../../packages/backend/src/runtime/platform-jobs'
import { SecretValue } from '../../packages/backend/src/modules/secrets/secret-value'
import { readConfiguredVaultCredential } from '../../packages/backend/src/runtime/vault-credentials'
import { inspect } from 'node:util'

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'confirmed secrets import under actual restricted roles',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'secret_import_' + suffix + '_test',
      platformRole = 'import_platform_' + suffix,
      businessRole = 'import_business_' + suffix
    let admin: Pool, db: Pool, platformPool: Pool, businessPool: Pool
    let platform: PrismaClient,
      business: PrismaClient,
      scope: ReturnType<typeof createPlatformScope>
    let platformUrl: string, sourceUrl: string
    const fingerprintKey = Buffer.alloc(32, 41),
      ring = createEnvKeyring('K1', { K1: Buffer.alloc(32, 42) })
    const vault = createSecretVault({
      current: ring,
      providers: [ring],
      fingerprintKey,
    })
    let providersCreated = 0
    const makeImporter = (selectedVault = vault) =>
      createSecretImporter({
        fingerprintKey,
        read: createPlatformScope(platform, { readOnly: true })
          .withPlatformTransaction,
        write: scope.withPlatformTransaction,
        configuredVault: async () => {
          providersCreated++
          return { vault: selectedVault, dispose: () => {} }
        },
      })
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      sourceUrl = url.toString()
      db = new Pool({ connectionString: sourceUrl, max: 1 })
      for (const name of fs
        .readdirSync('prisma/migrations')
        .filter((n) => /^\d{12}_/.test(n))
        .sort())
        await db.query(
          fs.readFileSync(
            'prisma/migrations/' + name + '/migration.sql',
            'utf8'
          )
        )
      platformUrl = await createLoginRole(
        db,
        sourceUrl,
        platformRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      const businessUrl = await createLoginRole(
        db,
        sourceUrl,
        businessRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (const [profile, role] of [
        ['platform_runtime', platformRole],
        ['app_runtime', businessRole],
      ])
        await db.query(
          fs
            .readFileSync('prisma/sql/roles/' + profile + '.sql', 'utf8')
            .replaceAll(profile!, role!)
        )
      platformPool = new Pool({ connectionString: platformUrl, max: 4 })
      businessPool = new Pool({ connectionString: businessUrl, max: 1 })
      platform = new PrismaClient({ adapter: new PrismaPg(platformPool) })
      business = new PrismaClient({ adapter: new PrismaPg(businessPool) })
      scope = createPlatformScope(platform)
    }, 120000)
    afterAll(async () => {
      await platform?.$disconnect()
      await business?.$disconnect()
      for (const pool of [platformPool, businessPool, db]) await pool?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const role of [platformRole, businessRole])
          await admin.query('DROP ROLE IF EXISTS "' + role + '"')
        await admin.end()
      }
    })
    async function fixture(provider = 'ASAAS') {
      const id = 'import_' + randomUUID().replaceAll('-', ''),
        tenantId = 'tenant_' + randomUUID().replaceAll('-', '')
      const reference = 'env:LOCADORA_INTEGRATION_' + id.toUpperCase()
      await scope.withPlatformTransaction(async (tx) => {
        await tx.organization.create({
          data: {
            id: tenantId,
            slug: 'import-' + randomUUID().slice(0, 8),
            name: 'Synthetic import',
          },
        })
        await tx.tenantIntegration.create({
          data: {
            id,
            tenantId,
            provider,
            environment: 'sandbox',
            credentialsRef: reference,
          },
        })
      })
      const prefix = reference.slice(4)
      return {
        integrationId: id,
        reference,
        variables: {
          [prefix + '_API_KEY']: 'synthetic-key-' + id,
          [prefix + '_SECRET']: 'synthetic-signing-' + id,
          [prefix + '_ENVIRONMENT']: 'sandbox',
          [prefix + '_VERIFY_TOKEN']: 'synthetic-verify-' + id,
          [prefix + '_USER_AGENT']:
            'Synthetic Shipping (operator@example.invalid)',
        },
        tenantId,
      }
    }
    async function state(id: string) {
      const integration = (
        await db.query('SELECT * FROM tenant_integrations WHERE id=$1', [id])
      ).rows[0]
      const secrets = (
        await db.query(
          'SELECT * FROM integration_secrets WHERE "integrationId"=$1 ORDER BY purpose',
          [id]
        )
      ).rows
      const audit = (
        await db.query('SELECT * FROM audit_logs WHERE "entityId"=$1', [id])
      ).rows
      const platformAudit = (
        await db.query(
          'SELECT * FROM platform_audit_logs WHERE "targetId"=$1',
          [id]
        )
      ).rows
      return { integration, secrets, audit, platformAudit }
    }
    it('dry-run is read-only, does not instantiate KMS and prints no plaintext/ref', async () => {
      const input = await fixture(),
        importer = makeImporter(),
        before = await state(input.integrationId),
        started = providersCreated
      const plan = await importer.plan(input)
      expect(plan.action).toBe('IMPORT')
      expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/)
      expect(plan.fingerprints[0]?.fingerprint).toHaveLength(12)
      for (const value of Object.values(input.variables))
        expect(JSON.stringify(plan)).not.toContain(value)
      expect(JSON.stringify(plan)).not.toContain(input.reference)
      expect(providersCreated).toBe(started)
      expect(await state(input.integrationId)).toEqual(before)
      await expect(
        createPlatformScope(platform, {
          readOnly: true,
        }).withPlatformTransaction((tx) =>
          tx.organization.update({
            where: { id: input.tenantId },
            data: { name: 'forbidden' },
          })
        )
      ).rejects.toThrow()
      importer.dispose()
    })
    it('rejects wrong confirmation and stale operator contents before provider/writes', async () => {
      const input = await fixture(),
        importer = makeImporter(),
        plan = await importer.plan(input),
        started = providersCreated
      await expect(importer.apply(input, '0'.repeat(64))).rejects.toThrow(
        'SECRET_IMPORT_PLAN_CHANGED'
      )
      const changed = {
        ...input,
        variables: {
          ...input.variables,
          [input.reference.slice(4) + '_API_KEY']: 'changed-synthetic',
        },
      }
      await expect(importer.apply(changed, plan.planHash)).rejects.toThrow(
        'SECRET_IMPORT_PLAN_CHANGED'
      )
      expect((await state(input.integrationId)).secrets).toHaveLength(0)
      expect(providersCreated).toBe(started)
      importer.dispose()
    })
    it.each(['ASAAS', 'ZAPSIGN', 'WHATSAPP', 'PIX', 'MELHOR_ENVIO'])(
      'imports %s atomically; retained ids, tenant audit, no plaintext; fresh retry is a no-op',
      async (provider) => {
        const input = await fixture(provider),
          importer = makeImporter(),
          plan = await importer.plan(input)
        await importer.apply(input, plan.planHash)
        const after = await state(input.integrationId)
        expect(after.integration).toMatchObject({
          id: input.integrationId,
          tenantId: input.tenantId,
          credentialSource: 'VAULT',
          credentialsRef: null,
          status: 'ACTIVE',
        })
        expect(after.secrets).toHaveLength(
          provider === 'ASAAS'
            ? 1
            : ['WHATSAPP', 'MELHOR_ENVIO'].includes(provider)
              ? 3
              : 2
        )
        expect(after.secrets.every((s) => s.state === 'ACTIVE')).toBe(true)
        expect(after.audit).toHaveLength(1)
        expect(after.audit[0]).toMatchObject({
          tenantId: input.tenantId,
          action: 'integration.secrets.imported',
          entityId: input.integrationId,
        })
        expect(after.platformAudit).toHaveLength(1)
        for (const value of Object.values(input.variables).filter(
          (v) => v !== 'sandbox'
        ))
          expect(JSON.stringify(after)).not.toContain(value)
        if (provider === 'ASAAS')
          expect(after.integration.webhookTokenHash).toMatch(/^[a-f0-9]{64}$/)
        await expect(importer.apply(input, plan.planHash)).rejects.toThrow(
          'SECRET_IMPORT_PLAN_CHANGED'
        )
        const next = await importer.plan(input)
        expect(next.action).toBe('NOOP')
        await importer.apply(input, next.planHash)
        expect(await state(input.integrationId)).toEqual(after)
        const settings = await platformPool.query(
          "SELECT current_setting('app.platform_scope',true) scope,current_setting('app.tenant_id',true) tenant"
        )
        expect(settings.rows[0].scope ?? '').not.toBe('on')
        expect(settings.rows[0].tenant ?? '').toBe('')
        importer.dispose()
      }
    )
    it('shipping round-trips API key and exact user agent through the actual one-connection tenant reader, redacted', async () => {
      const input = await fixture('MELHOR_ENVIO'),
        importer = makeImporter(),
        plan = await importer.plan(input)
      await importer.apply(input, plan.planHash)
      const env = {
        PLATFORM_SECRETS_KEK_CURRENT: 'K1',
        PLATFORM_SECRETS_KEK_K1: Buffer.alloc(32, 42).toString('base64'),
        PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
      }
      const read = (tenant: string) =>
        business.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.tenant_id',${tenant},true)`
          return readConfiguredVaultCredential(
            {
              kind: 'vault',
              id: input.integrationId,
              tenantId: input.tenantId,
              provider: 'MELHOR_ENVIO',
              environment: 'sandbox',
              transaction: tx,
            },
            env
          )
        })
      const credential = await read(input.tenantId)
      expect(credential?.apiKey).toBe(
        input.variables[input.reference.slice(4) + '_API_KEY']
      )
      expect(credential?.userAgent).toBe(
        'Synthetic Shipping (operator@example.invalid)'
      )
      expect(credential?.environment).toBe('sandbox')
      expect(
        JSON.stringify(credential) + String(credential) + inspect(credential)
      ).not.toContain('operator@example.invalid')
      await expect(read('another-tenant')).rejects.toThrow('SECRET_UNAVAILABLE')
      const stateBefore = await state(input.integrationId)
      const agent = stateBefore.secrets.find(
        (s) => s.purpose === 'PROVIDER_USER_AGENT'
      )!
      await db.query(
        'UPDATE integration_secrets SET "authTag"=$1 WHERE id=$2',
        [Buffer.alloc(16), agent.id]
      )
      await expect(read(input.tenantId)).rejects.toThrow('SECRET_UNAVAILABLE')
      importer.dispose()
    })
    it.each([
      undefined,
      '',
      'missing-contact',
      'Agent (bad\r\n@example.invalid)',
    ])(
      'shipping refuses invalid user agent %s before any write',
      async (agent) => {
        const input = await fixture('MELHOR_ENVIO'),
          importer = makeImporter(),
          before = await state(input.integrationId)
        if (agent === undefined)
          delete input.variables[input.reference.slice(4) + '_USER_AGENT']
        else input.variables[input.reference.slice(4) + '_USER_AGENT'] = agent
        await expect(importer.plan(input)).rejects.toThrow(/^SECRET_IMPORT_/)
        expect(await state(input.integrationId)).toEqual(before)
        importer.dispose()
      }
    )
    it('rollback after the first encrypted value preserves the entire legacy integration and audits', async () => {
      const input = await fixture('WHATSAPP'),
        before = await state(input.integrationId)
      let stores = 0
      const failing = {
        ...vault,
        store: async (...args: Parameters<typeof vault.store>) => {
          if (++stores === 2) throw new Error('synthetic sensitive failure')
          return vault.store(...args)
        },
      }
      const importer = makeImporter(failing),
        plan = await importer.plan(input)
      await expect(importer.apply(input, plan.planHash)).rejects.toThrow(
        'SECRET_IMPORT_UNAVAILABLE'
      )
      expect(await state(input.integrationId)).toEqual(before)
      importer.dispose()
    })
    it('audit failure rolls back source switch, ciphertext and platform audit', async () => {
      const input = await fixture(),
        before = await state(input.integrationId),
        importer = makeImporter(),
        plan = await importer.plan(input)
      await db.query(
        'REVOKE EXECUTE ON FUNCTION public.audit_integration_secret_import(text,text) FROM "' +
          platformRole +
          '"'
      )
      try {
        await expect(importer.apply(input, plan.planHash)).rejects.toThrow(
          'SECRET_IMPORT_UNAVAILABLE'
        )
        expect(await state(input.integrationId)).toEqual(before)
      } finally {
        await db.query(
          'GRANT EXECUTE ON FUNCTION public.audit_integration_secret_import(text,text) TO "' +
            platformRole +
            '"'
        )
        importer.dispose()
      }
    })
    it('round-trip fingerprint mismatch rolls back ciphertext and keeps the original ENV_REF', async () => {
      const input = await fixture(),
        before = await state(input.integrationId)
      const wrong = {
        ...vault,
        reveal: async () =>
          new SecretValue('synthetic mismatched decrypted value'),
      }
      const importer = makeImporter(wrong),
        plan = await importer.plan(input)
      await expect(importer.apply(input, plan.planHash)).rejects.toThrow(
        'SECRET_IMPORT_FINGERPRINT_MISMATCH'
      )
      expect(await state(input.integrationId)).toEqual(before)
      importer.dispose()
    })
    it('changed integration metadata invalidates the reviewed plan without provider access', async () => {
      const input = await fixture(),
        importer = makeImporter(),
        plan = await importer.plan(input),
        started = providersCreated
      await scope.withPlatformTransaction((tx) =>
        tx.tenantIntegration.update({
          where: { id: input.integrationId },
          data: { externalAccountId: 'synthetic-changed-account' },
        })
      )
      const before = await state(input.integrationId)
      await expect(importer.apply(input, plan.planHash)).rejects.toThrow(
        'SECRET_IMPORT_PLAN_CHANGED'
      )
      expect(providersCreated).toBe(started)
      expect(await state(input.integrationId)).toEqual(before)
      importer.dispose()
    })
    it('concurrent confirmed applies serialize: one import and one stale plan, exactly one audit', async () => {
      const input = await fixture(),
        one = makeImporter(),
        two = makeImporter(),
        plan = await one.plan(input)
      const results = await Promise.allSettled([
        one.apply(input, plan.planHash),
        two.apply(input, plan.planHash),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(
        (results.find((r) => r.status === 'rejected') as PromiseRejectedResult)
          .reason.message
      ).toBe('SECRET_IMPORT_PLAN_CHANGED')
      const after = await state(input.integrationId)
      expect(after.audit).toHaveLength(1)
      expect(after.secrets).toHaveLength(1)
      one.dispose()
      two.dispose()
    })
    it.each(['reference', 'environment', 'missing', 'unsupported'])(
      'rejects %s without touching legacy',
      async (kind) => {
        const input = await fixture(
            kind === 'unsupported' ? 'UNSUPPORTED_PROVIDER' : 'ASAAS'
          ),
          before = await state(input.integrationId),
          importer = makeImporter()
        if (kind === 'reference')
          input.reference = 'env:LOCADORA_INTEGRATION_OTHER'
        if (kind === 'environment')
          input.variables[input.reference.slice(4) + '_ENVIRONMENT'] =
            'production'
        if (kind === 'missing')
          delete input.variables[input.reference.slice(4) + '_SECRET']
        await expect(importer.plan(input)).rejects.toThrow(/^SECRET_IMPORT_/)
        expect(await state(input.integrationId)).toEqual(before)
        importer.dispose()
      }
    )
    it('same Asaas key cannot migrate to another tenant and leaves its original ENV_REF', async () => {
      const one = await fixture(),
        two = await fixture(),
        importer = makeImporter()
      two.variables[two.reference.slice(4) + '_API_KEY'] =
        one.variables[one.reference.slice(4) + '_API_KEY']!
      await importer.apply(one, (await importer.plan(one)).planHash)
      const before = await state(two.integrationId)
      await expect(
        importer.apply(two, (await importer.plan(two)).planHash)
      ).rejects.toThrow('SECRET_IMPORT_UNAVAILABLE')
      expect(await state(two.integrationId)).toEqual(before)
      importer.dispose()
    })
    it('platform cannot read/write tenant audit directly; business/PUBLIC cannot invoke the bridge', async () => {
      await expect(
        platformPool.query('SELECT * FROM audit_logs')
      ).rejects.toThrow()
      await expect(
        platformPool.query(
          "INSERT INTO audit_logs(id,action,entity,\"entityId\") VALUES ('forbidden','other','other','other')"
        )
      ).rejects.toThrow()
      await expect(
        businessPool.query(
          "SELECT public.audit_integration_secret_import('anything',$1)",
          ['0'.repeat(64)]
        )
      ).rejects.toThrow()
      const privilege = await db.query(
        "SELECT has_function_privilege($1,'public.audit_integration_secret_import(text,text)','EXECUTE') ok",
        [businessRole]
      )
      expect(privilege.rows[0].ok).toBe(false)
    })
    it('audit bridge works with a non-bypass definer and restores tenant context', async () => {
      const role = 'import_auditor_' + suffix
      await db.query(
        'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT'
      )
      await db.query('GRANT USAGE,CREATE ON SCHEMA public TO "' + role + '"')
      await db.query(
        'GRANT SELECT ON tenant_integrations,integration_secrets TO "' +
          role +
          '"'
      )
      // SELECT FOR UPDATE needs UPDATE privilege on at least one routing column.
      await db.query(
        'GRANT UPDATE(id) ON tenant_integrations TO "' + role + '"'
      )
      await db.query('GRANT INSERT ON audit_logs TO "' + role + '"')
      await db.query(
        'ALTER FUNCTION public.audit_integration_secret_import(text,text) OWNER TO "' +
          role +
          '"'
      )
      await db.query('REVOKE CREATE ON SCHEMA public FROM "' + role + '"')
      try {
        const input = await fixture(),
          importer = makeImporter(),
          plan = await importer.plan(input)
        await importer.apply(input, plan.planHash)
        expect((await state(input.integrationId)).audit).toHaveLength(1)
        importer.dispose()
      } finally {
        await db.query(
          'ALTER FUNCTION public.audit_integration_secret_import(text,text) OWNER TO "' +
            new URL(sourceUrl).username +
            '"'
        )
        await db.query('DROP OWNED BY "' + role + '"')
        await db.query('DROP ROLE "' + role + '"')
      }
    })
    it('actual Node/tsx CLI plans against a restricted database without leaking local-file values', async () => {
      const input = await fixture(),
        directory = fs.mkdtempSync(
          path.join(os.tmpdir(), 'locadora-import-runtime-')
        ),
        file = path.join(directory, 'operator.env')
      fs.writeFileSync(
        file,
        Object.entries(input.variables)
          .map(([name, value]) => name + '=' + JSON.stringify(value))
          .join('\n')
      )
      try {
        const { stdout, stderr } = await promisify(execFile)(
          process.execPath,
          [
            '--import',
            'tsx',
            'tools/integration-secrets-import.mjs',
            '--integration=' + input.integrationId,
            '--reference=' + input.reference,
            '--env-file=' + file,
          ],
          {
            cwd: process.cwd(),
            timeout: 30000,
            env: {
              ...process.env,
              PLATFORM_DATABASE_URL: platformUrl,
              PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
            },
          }
        )
        expect(JSON.parse(stdout)).toMatchObject({
          action: 'IMPORT',
          integrationId: input.integrationId,
        })
        expect(stderr).toBe('')
        for (const value of Object.values(input.variables).filter(
          (v) => v !== 'sandbox'
        ))
          expect(stdout + stderr).not.toContain(value)
        expect((await state(input.integrationId)).secrets).toHaveLength(0)
      } finally {
        fs.unlinkSync(file)
        fs.rmdirSync(directory)
      }
    })
    it('runtime dry-run uses the supplied platform identity without requiring a KEK or contacting AWS', async () => {
      const input = await fixture()
      const result = await runIntegrationSecretsImport(input, undefined, {
        PLATFORM_DATABASE_URL: platformUrl,
        PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
      })
      expect(result.action).toBe('IMPORT')
      expect((await state(input.integrationId)).secrets).toHaveLength(0)
      await expect(
        runIntegrationSecretsImport(input, undefined, {
          PLATFORM_DATABASE_URL: sourceUrl,
          PLATFORM_SECRET_FINGERPRINT_KEY: fingerprintKey.toString('utf8'),
        })
      ).rejects.toThrow()
    })
  }
)
