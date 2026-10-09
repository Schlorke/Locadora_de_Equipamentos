import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ENTITLEMENT_FEATURES } from '@gb-locacoes/contracts/entitlements'
import { createPublicPlanCatalog } from '../../packages/backend/src/modules/subscriptions/public-catalog'
import { createPlatformScope } from '../../packages/backend/src/modules/platform-scope/index'
import { createLoginRole } from '../helpers/database-roles'
import { requireTestDatabase } from '../helpers/test-database'
import {
  checkPlatformDatabase,
  checkTenantDatabase,
} from '../../tools/tenant-database-check.mjs'
import { checkPlatformPreflight } from '../../tools/platform-preflight.mjs'

const inventory = JSON.parse(
  fs.readFileSync('tools/tenant-models.json', 'utf8')
) as {
  tenantModels: { table: string }[]
  platformModels: { table: string; read: string }[]
}
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'S2 platform isolation, upgrade and history',
  () => {
    const suffix = randomUUID().replaceAll('-', '')
    const database = 'platform_' + suffix + '_test'
    const appRole = 'app_' + suffix
    const platformRole = 'platform_' + suffix
    let admin: Pool, db: Pool, app: Pool, platform: Pool
    let catalogClient: PrismaClient
    const migrations = fs
      .readdirSync('prisma/migrations')
      .filter((x) => /^\d{12}_/.test(x))
      .sort()
    const sql = (name: string) =>
      fs.readFileSync(
        path.join('prisma/migrations', name, 'migration.sql'),
        'utf8'
      )
    async function scoped<T>(
      pool: Pool,
      tenant: string | null,
      operation: (connection: import('pg').PoolClient) => Promise<T>
    ) {
      const c = await pool.connect()
      try {
        await c.query('BEGIN')
        await c.query(
          "SELECT set_config('app.tenant_id',$1,true),set_config('app.platform_scope','on',true)",
          [tenant ?? '']
        )
        const value = await operation(c)
        await c.query('COMMIT')
        return value
      } catch (error) {
        await c.query('ROLLBACK')
        throw error
      } finally {
        c.release()
      }
    }
    beforeAll(async () => {
      const source = requireTestDatabase(process.env)
      admin = new Pool({ connectionString: source, max: 1 })
      await admin.query('CREATE DATABASE "' + database + '"')
      const url = new URL(source)
      url.pathname = '/' + database
      db = new Pool({ connectionString: url.toString(), max: 1 })
      for (const name of migrations.filter((x) => x < '202610030101'))
        await db.query(sql(name))
      await db.query(
        `INSERT INTO organizations(id,slug,name,"updatedAt") VALUES ('alfa','alfa','A',now()),('bravo','bravo','B',now())`
      )
      await db.query(
        `INSERT INTO users(id,email,"updatedAt") VALUES ('owner','owner@example.test',now()),('staff','staff@example.test',now())`
      )
      for (const name of migrations.filter(
        (x) => x >= '202610030101' && x < '202610030105'
      ))
        await db.query(sql(name))
      // Replay the real migration with invalid legacy fixtures: it must fail before DDL and leave no changes.
      for (const fixture of [
        `INSERT INTO tenant_integrations(id,"tenantId",provider,"credentialsRef","updatedAt") VALUES ('bad','alfa','ASAAS','invalid',now())`,
        `INSERT INTO tenant_integrations(id,"tenantId",provider,"externalAccountId","credentialsRef","updatedAt") VALUES ('one','alfa','ASAAS','one','env:LOCADORA_INTEGRATION_TEST',now()),('two','alfa','ASAAS','two','env:LOCADORA_INTEGRATION_TEST',now())`,
      ]) {
        const c = await db.connect()
        try {
          await c.query('BEGIN')
          await c.query(fixture)
          await expect(
            c.query(sql('202610030105_payment_accounts_vault'))
          ).rejects.toThrow(/Preflight/)
        } finally {
          await c.query('ROLLBACK')
          c.release()
        }
        expect(
          (
            await db.query(
              "SELECT to_regclass('public.payment_accounts') AS account"
            )
          ).rows[0].account
        ).toBeNull()
        expect(
          (await db.query('SELECT count(*)::int AS n FROM tenant_integrations'))
            .rows[0].n
        ).toBe(0)
      }
      for (const name of migrations.filter((x) => x >= '202610030105'))
        await db.query(sql(name))
      const appUrl = await createLoginRole(
        db,
        url.toString(),
        appRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      const platformUrl = await createLoginRole(
        db,
        url.toString(),
        platformRole,
        'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE'
      )
      for (let n = 0; n < 2; n++)
        for (const [name, role] of [
          ['app_runtime', appRole],
          ['platform_runtime', platformRole],
        ])
          await db.query(
            fs
              .readFileSync('prisma/sql/roles/' + name + '.sql', 'utf8')
              .replaceAll(name!, role!)
          )
      app = new Pool({ connectionString: appUrl, max: 1 })
      platform = new Pool({ connectionString: platformUrl, max: 2 })
      catalogClient = new PrismaClient({ adapter: new PrismaPg(platform) })
    }, 120_000)
    afterAll(async () => {
      await catalogClient?.$disconnect()
      await app?.end()
      await platform?.end()
      await db?.end()
      if (admin) {
        await admin.query('DROP DATABASE IF EXISTS "' + database + '"')
        for (const role of [appRole, platformRole])
          await admin.query('DROP ROLE IF EXISTS "' + role + '"')
        await admin.end()
      }
    })
    it('lists only currently sellable public offers with READ ONLY platform isolation', async () => {
      const now = new Date('2026-10-04T12:00:00Z')
      const rights = {
        schema: 1,
        limits: { equipments: 20, staffSeats: 3 },
        features: Object.fromEntries(
          ENTITLEMENT_FEATURES.map((name) => [name, true])
        ),
      }
      const scope = createPlatformScope(catalogClient, { readOnly: true })
      const read = createPublicPlanCatalog({
        transaction: scope.withPlatformTransaction,
        now: () => now,
      })
      expect(await read()).toEqual({ plans: [] })
      await db.query(`INSERT INTO plans(id,code,name,"isPublic","archivedAt","updatedAt") VALUES
        ('catalog-public','catalog-public','Plano sintético',true,null,now()),
        ('catalog-private','catalog-private','Interno',false,null,now()),
        ('catalog-archived','catalog-archived','Arquivado',true,now(),now())`)
      try {
        for (const [id, planId, version, interval, amount, from, until] of [
          [
            'catalog-monthly',
            'catalog-public',
            1,
            'MONTHLY',
            '199.90',
            now,
            null,
          ],
          [
            'catalog-yearly',
            'catalog-public',
            2,
            'YEARLY',
            '1999.90',
            now,
            null,
          ],
          [
            'catalog-expired',
            'catalog-public',
            3,
            'MONTHLY',
            '299.90',
            new Date(now.getTime() - 1),
            now,
          ],
          [
            'catalog-future',
            'catalog-public',
            4,
            'MONTHLY',
            '399.90',
            new Date(now.getTime() + 1),
            null,
          ],
          [
            'catalog-private-version',
            'catalog-private',
            1,
            'MONTHLY',
            '0.00',
            now,
            null,
          ],
          [
            'catalog-archived-version',
            'catalog-archived',
            1,
            'MONTHLY',
            '599.90',
            now,
            null,
          ],
        ]) {
          await db.query(
            `INSERT INTO plan_versions(id,"planId",version,interval,amount,"trialDays",entitlements,"sellableFrom","sellableUntil")
            VALUES ($1,$2,$3,$4,$5,14,$6,$7,$8)`,
            [
              id,
              planId,
              version,
              interval,
              amount,
              JSON.stringify(rights),
              from instanceof Date ? from.toISOString() : from,
              until instanceof Date ? until.toISOString() : until,
            ]
          )
        }
        const body = await read()
        expect(
          body.plans.map((plan) => [
            plan.planVersionId,
            plan.interval,
            plan.amount,
          ])
        ).toEqual([
          ['catalog-yearly', 'YEARLY', '1999.90'],
          ['catalog-monthly', 'MONTHLY', '199.90'],
        ])
        expect(Object.keys(body.plans[0]!).sort()).toEqual(
          [
            'amount',
            'code',
            'entitlements',
            'interval',
            'name',
            'planVersionId',
            'trialDays',
            'version',
          ].sort()
        )
        await expect(
          scope.withPlatformTransaction((tx) =>
            tx.plan.create({
              data: { code: 'catalog-forbidden', name: 'Forbidden' },
            })
          )
        ).rejects.toThrow(/read.only/)
        await expect(
          scope.withPlatformTransaction((tx) => tx.equipment.findMany())
        ).rejects.toThrow(/permission denied/)
        for (let n = 10; n < 20; n++) {
          await db.query(
            `INSERT INTO plan_versions(id,"planId",version,amount,entitlements,"sellableFrom") VALUES ($1,'catalog-public',$2,10,$3,$4)`,
            ['catalog-extra-' + n, n, JSON.stringify(rights), now.toISOString()]
          )
        }
        await expect(read()).rejects.toThrow()
        expect(
          (
            await db.query(
              `SELECT count(*)::int AS n FROM plan_versions WHERE "planId"='catalog-public'`
            )
          ).rows[0].n
        ).toBe(14)
      } finally {
        await db.query(
          `UPDATE plans SET "archivedAt"=now() WHERE id IN ('catalog-public','catalog-private','catalog-archived')`
        )
      }
    })
    it('backfills existing companies FULL + internal complimentary, new companies SETUP', async () => {
      expect(
        (
          await db.query(
            'SELECT access,origin,"sitePublishedAt" IS NOT NULL AS published FROM organizations ORDER BY id'
          )
        ).rows
      ).toEqual([
        { access: 'FULL', origin: 'LEGACY', published: true },
        { access: 'FULL', origin: 'LEGACY', published: true },
      ])
      expect(
        await scoped(
          platform,
          null,
          async (c) =>
            (
              await c.query(
                'SELECT status,"billingMode","complimentaryReason" FROM subscriptions ORDER BY id'
              )
            ).rows
        )
      ).toEqual([
        {
          status: 'ACTIVE',
          billingMode: 'COMPLIMENTARY',
          complimentaryReason: 'LEGACY_BACKFILL',
        },
        {
          status: 'ACTIVE',
          billingMode: 'COMPLIMENTARY',
          complimentaryReason: 'LEGACY_BACKFILL',
        },
      ])
      await app.query(
        `INSERT INTO organizations(id,slug,name,"updatedAt") VALUES ('new','new','New',now())`
      )
      expect(
        (await app.query(`SELECT access FROM organizations WHERE id='new'`))
          .rows[0].access
      ).toBe('SETUP')
      await expect(
        app.query(
          `INSERT INTO organizations(id,slug,name,access,"updatedAt") VALUES ('spoof','spoof','Spoof','FULL',now())`
        )
      ).rejects.toThrow('ORGANIZATION_PLATFORM_COLUMNS')
    })
    it('checks all 32 business and 18 platform policies and actual role privileges', async () => {
      expect(await checkTenantDatabase(app)).toMatchObject({
        ok: true,
        tables: 32,
        platformTables: 18,
        issues: [],
      })
      expect(await checkPlatformDatabase(platform)).toMatchObject({
        ok: true,
        tables: 18,
        issues: [],
      })
      expect((await checkPlatformDatabase(db)).ok).toBe(false)
      expect((await checkTenantDatabase(platform)).ok).toBe(false)
    })
    it('GUC cannot elevate app access, and platform scope is transaction local', async () => {
      expect((await app.query('SELECT * FROM subscriptions')).rowCount).toBe(0)
      expect(
        await scoped(
          app,
          'alfa',
          async (c) =>
            (await c.query('SELECT "tenantId" FROM subscriptions')).rows
        )
      ).toEqual([{ tenantId: 'alfa' }])
      expect(
        await scoped(
          app,
          'bravo',
          async (c) =>
            (await c.query('SELECT "tenantId" FROM subscriptions')).rows
        )
      ).toEqual([{ tenantId: 'bravo' }])
      expect(
        (await platform.query('SELECT * FROM subscriptions')).rowCount
      ).toBe(0)
      expect(
        await scoped(
          platform,
          null,
          async (c) => (await c.query('SELECT * FROM subscriptions')).rowCount
        )
      ).toBe(2)
      expect(
        (await platform.query('SELECT * FROM subscriptions')).rowCount
      ).toBe(0)
      await expect(
        scoped(app, 'alfa', (c) =>
          c.query(`UPDATE subscriptions SET status='ACTIVE'`)
        )
      ).rejects.toThrow(/permission denied/)
      await expect(
        app.query('SET ROLE "' + platformRole + '"')
      ).rejects.toThrow(/permission denied/)
    })
    it.each(inventory.tenantModels.map((row) => row.table))(
      'platform cannot read, update or delete business %s',
      async (table) => {
        for (const statement of [
          'SELECT 1 FROM "' + table + '"',
          'UPDATE "' + table + '" SET "tenantId"="tenantId"',
          'DELETE FROM "' + table + '"',
        ])
          await expect(
            scoped(platform, 'alfa', (c) => c.query(statement))
          ).rejects.toThrow(/permission denied/)
      }
    )
    it('onboarding seeds allow INSERT only and keep the existing tenant policy', async () => {
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO categories(id,"tenantId",name,slug,"updatedAt") VALUES ($1,'alfa','No','no-scope',now())`,
            [randomUUID()]
          )
        )
      ).rejects.toThrow(/row-level security/)
      await scoped(platform, 'alfa', (c) =>
        c.query(
          `INSERT INTO categories(id,"tenantId",name,slug,"updatedAt") VALUES ($1,'alfa','Seed','seed',now())`,
          [randomUUID()]
        )
      )
      await expect(
        scoped(platform, 'alfa', (c) =>
          c.query(
            `INSERT INTO categories(id,"tenantId",name,slug,"updatedAt") VALUES ($1,'alfa','No','returning',now()) RETURNING id`,
            [randomUUID()]
          )
        )
      ).rejects.toThrow(/permission denied/)
      await expect(platform.query('SELECT * FROM users')).rejects.toThrow(
        /permission denied/
      )
      expect(
        (await platform.query('SELECT * FROM platform_user_contacts')).rows[0]
      ).not.toHaveProperty('password')
    })
    it('protects published slug and projection; preserves an active ADMIN owner atomically', async () => {
      await expect(
        scoped(app, 'alfa', (c) =>
          c.query(`UPDATE organizations SET access='FULL' WHERE id='new'`)
        )
      ).rejects.toThrow('ORGANIZATION_PLATFORM_COLUMNS')
      await expect(
        app.query(`UPDATE organizations SET slug='renamed' WHERE id='alfa'`)
      ).rejects.toThrow('SLUG_IMMUTABLE_AFTER_PUBLISH')
      await scoped(platform, null, async (c) => {
        await c.query(
          `INSERT INTO organizations(id,slug,name,origin,"ownerUserId","updatedAt") VALUES ('owned','owned','Owned','ONBOARDING','owner',now())`
        )
        await c.query(
          `INSERT INTO memberships(id,"tenantId","userId",role,"updatedAt") VALUES ('member','owned','owner','ADMIN',now())`
        )
      })
      for (const statement of [
        `UPDATE memberships SET role='CLIENT' WHERE id='member'`,
        `UPDATE memberships SET status='REVOKED' WHERE id='member'`,
        `UPDATE memberships SET "tenantId"='alfa' WHERE id='member'`,
      ])
        await expect(
          scoped(platform, null, (c) => c.query(statement))
        ).rejects.toThrow('OWNER_MEMBERSHIP_REQUIRED')
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO organizations(id,slug,name,origin,"ownerUserId","updatedAt") VALUES ('missing','missing','Missing','ONBOARDING','owner',now())`
          )
        )
      ).rejects.toThrow()
    })
    it('platform staff cannot gain company membership in either insertion order', async () => {
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO platform_staff(id,"userId",role) VALUES ('owner-staff','owner','PLATFORM_ADMIN')`
          )
        )
      ).rejects.toThrow('PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP')
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO platform_staff(id,"userId",role) VALUES ('staff-record','staff','PLATFORM_SUPPORT')`
        )
      )
      await expect(
        app.query(
          `INSERT INTO memberships(id,"tenantId","userId","updatedAt") VALUES ('staff-member','alfa','staff',now())`
        )
      ).rejects.toThrow('PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP')
      await expect(app.query('SELECT * FROM platform_staff')).rejects.toThrow(
        /permission denied/
      )
    })
    it('keeps versions immutable, prevents public zero-price plans and canceled resurrection', async () => {
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE plan_versions SET amount=1 WHERE id='planv_interno_legado_1'`
          )
        )
      ).rejects.toThrow('PLAN_VERSION_IMMUTABLE')
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE plans SET "isPublic"=true WHERE id='plan_interno_legado'`
          )
        )
      ).rejects.toThrow('PUBLIC_PLAN_REQUIRES_PRICE')
      await scoped(platform, null, (c) =>
        c.query(
          `UPDATE subscriptions SET status='CANCELED',"canceledAt"=now() WHERE "tenantId"='bravo'`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE subscriptions SET status='ACTIVE' WHERE "tenantId"='bravo'`
          )
        )
      ).rejects.toThrow('SUBSCRIPTION_HISTORY_IMMUTABLE')
      await expect(
        db.query(`DELETE FROM subscriptions WHERE "tenantId"='bravo'`)
      ).rejects.toThrow('PLATFORM_HISTORY_DELETE_FORBIDDEN')
    })
    it('serializes staff/membership races in both insertion orders', async () => {
      async function lockObserved(pid: number) {
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          if (
            (
              await db.query(
                'SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted',
                [pid]
              )
            ).rowCount
          )
            return
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
        throw Error('Competing transaction did not reach the lock')
      }
      for (const staffFirst of [true, false]) {
        const user = staffFirst ? 'race-staff-first' : 'race-member-first'
        await db.query(
          `INSERT INTO users(id,email,"updatedAt") VALUES ($1,$2,now())`,
          [user, user + '@example.test']
        )
        const first = await (staffFirst ? platform : app).connect()
        const second = await (staffFirst ? app : platform).connect()
        try {
          for (const c of [first, second]) {
            await c.query('BEGIN')
            await c.query("SELECT set_config('app.platform_scope','on',true)")
          }
          const staff = `INSERT INTO platform_staff(id,"userId",role) VALUES ($1,$1,'PLATFORM_SUPPORT')`
          const member = `INSERT INTO memberships(id,"tenantId","userId","updatedAt") VALUES ($1,'alfa',$1,now())`
          await first.query(staffFirst ? staff : member, [user])
          const pid = (await second.query('SELECT pg_backend_pid() AS pid'))
            .rows[0].pid
          const pending = second
            .query(staffFirst ? member : staff, [user])
            .then(
              () => null,
              (error) => error as Error
            )
          await lockObserved(pid)
          await first.query('COMMIT')
          expect((await pending)?.message).toContain(
            'PLATFORM_STAFF_CANNOT_HAVE_MEMBERSHIP'
          )
        } finally {
          await first.query('ROLLBACK')
          await second.query('ROLLBACK')
          first.release()
          second.release()
        }
      }
    })
    it('compound references stop invoice/account/secret tenant reassignment', async () => {
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO platform_invoices(id,"tenantId","subscriptionId","providerPaymentId",amount,"dueDate","syncedAt","updatedAt") VALUES ('invoice','alfa','sub_legacy_alfa','payment',10,CURRENT_DATE,now(),now())`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO platform_invoices(id,"tenantId","subscriptionId","providerPaymentId",amount,"dueDate","syncedAt","updatedAt") VALUES ('foreign','bravo','sub_legacy_alfa','payment-foreign',10,CURRENT_DATE,now(),now())`
          )
        )
      ).rejects.toThrow(/foreign key/)
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO tenant_integrations(id,"tenantId",provider,"credentialSource","updatedAt") VALUES ('vault','alfa','ASAAS','VAULT',now())`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO payment_accounts(id,"tenantId","integrationId",mode,environment,"updatedAt") VALUES ('foreign-account','bravo','vault','ASAAS_CONNECTED_ACCOUNT','sandbox',now())`
          )
        )
      ).rejects.toThrow(/foreign key/)
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO payment_accounts(id,"tenantId","integrationId",mode,environment,"updatedAt") VALUES ('account','alfa','vault','ASAAS_CONNECTED_ACCOUNT','sandbox',now())`
        )
      )
      const insert = `INSERT INTO integration_secrets(id,"tenantId","integrationId",purpose,version,state,"kekProvider","kekId","wrappedDek",iv,ciphertext,"authTag",fingerprint) VALUES ('secret','alfa','vault','ASAAS_API_KEY',1,'ACTIVE','env','test',decode('aa','hex'),decode(repeat('00',12),'hex'),decode('bb','hex'),decode(repeat('00',16),'hex'),repeat('a',64))`
      await scoped(platform, null, (c) => c.query(insert))
      await expect(
        scoped(platform, null, (c) =>
          c.query(`UPDATE integration_secrets SET iv=NULL WHERE id='secret'`)
        )
      ).rejects.toThrow(/integration_secrets_shred/)
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE integration_secrets SET "tenantId"='bravo' WHERE id='secret'`
          )
        )
      ).rejects.toThrow(/foreign key/)
      expect(
        await scoped(
          app,
          'bravo',
          async (c) =>
            (await c.query(`SELECT * FROM integration_secrets`)).rowCount
        )
      ).toBe(0)
      expect(
        await scoped(
          app,
          'alfa',
          async (c) =>
            (await c.query(`SELECT * FROM integration_secrets`)).rowCount
        )
      ).toBe(1)
    })
    it('deduplicates current accounts and active keys without crossing companies', async () => {
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO tenant_integrations(id,"tenantId",provider,"credentialSource","updatedAt") VALUES ('vault-b','bravo','ASAAS','VAULT',now())`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO tenant_integrations(id,"tenantId",provider,"externalAccountId","credentialsRef","updatedAt") VALUES ('asaas-double','bravo','ASAAS','other','env:LOCADORA_INTEGRATION_TEST',now())`
          )
        )
      ).rejects.toThrow(/tenant_integrations_single_asaas/)
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO integration_secrets(id,"tenantId","integrationId",purpose,version,state,"kekProvider","kekId","wrappedDek",iv,ciphertext,"authTag",fingerprint) VALUES ('duplicate-key','bravo','vault-b','ASAAS_API_KEY',1,'PENDING','env','test',decode('aa','hex'),decode(repeat('00',12),'hex'),decode('bb','hex'),decode(repeat('00',16),'hex'),repeat('a',64))`
          )
        )
      ).rejects.toThrow(/integration_secrets_api_key_fingerprint/)
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO integration_secrets(id,"tenantId","integrationId",purpose,version,state,"kekProvider","kekId","wrappedDek",iv,ciphertext,"authTag",fingerprint) VALUES ('duplicate-active','alfa','vault','ASAAS_API_KEY',2,'ACTIVE','env','test',decode('aa','hex'),decode(repeat('00',12),'hex'),decode('bb','hex'),decode(repeat('00',16),'hex'),repeat('b',64))`
          )
        )
      ).rejects.toThrow(/integration_secrets_one_active/)
      await scoped(platform, null, (c) =>
        c.query(
          `UPDATE integration_secrets SET state='DESTROYED',ciphertext=NULL,"wrappedDek"=NULL,iv=NULL,"authTag"=NULL,"destroyedAt"=now() WHERE id='secret'`
        )
      )
      expect(
        await scoped(
          platform,
          null,
          async (c) =>
            (
              await c.query(
                `SELECT ciphertext FROM integration_secrets WHERE id='secret'`
              )
            ).rows[0].ciphertext
        )
      ).toBeNull()
    })
    it('keeps the declared income platform-only, purged once and never deleted (wave 134, T-S2)', async () => {
      await db.query(
        `INSERT INTO organizations(id,slug,name,"updatedAt") VALUES ('charlie','charlie','C',now())`
      )
      await scoped(platform, null, async (c) => {
        await c.query(
          `INSERT INTO tenant_integrations(id,"tenantId",provider,"credentialSource",environment,status,"updatedAt") VALUES ('vault-c','charlie','ASAAS','VAULT','sandbox','PROVISIONING',now())`
        )
        await c.query(
          `INSERT INTO payment_accounts(id,"tenantId","integrationId",mode,"subaccountModel",environment,status,"updatedAt") VALUES ('account-c','charlie','vault-c','ASAAS_SUBACCOUNT','STANDARD','sandbox','PROVISIONING',now())`
        )
      })
      const version = 'a'.repeat(64)
      const insert = (
        id: string,
        tenant: string,
        value: string | null,
        phone: string | null,
        dataVersion = version
      ) =>
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO payment_account_provisioning_requests(id,"tenantId","paymentAccountId","incomeValue","mobilePhone","companyDataVersion") VALUES ($1,$2,'account-c',$3,$4,$5)`,
            [id, tenant, value, phone, dataVersion]
          )
        )
      const update = (set: string) =>
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE payment_account_provisioning_requests SET ${set} WHERE id='request-c'`
          )
        )
      await expect(
        insert('foreign', 'alfa', '98765.43', '11987654321')
      ).rejects.toThrow(/foreign key/)
      for (const [value, phone, dataVersion, constraint] of [
        ['98765.43', '1133334444', version, 'phone'],
        ['-1.00', '11987654321', version, 'income'],
        ['98765.43', '11987654321', 'not-a-version', 'version'],
        [null, '11987654321', version, 'purge'],
        ['98765.43', null, version, 'purge'],
      ] as const)
        await expect(
          insert('invalid', 'charlie', value, phone, dataVersion)
        ).rejects.toThrow('payment_account_provisioning_requests_' + constraint)
      await insert('request-c', 'charlie', '98765.43', '11987654321')
      await expect(
        insert('second', 'charlie', '1.00', '11987654321')
      ).rejects.toThrow(
        /payment_account_provisioning_requests_paymentAccountId/
      )
      // The business role never reads the declared income, even inside its own company.
      await expect(
        scoped(app, 'charlie', (c) =>
          c.query('SELECT * FROM payment_account_provisioning_requests')
        )
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        app.query('SELECT count(*) FROM payment_account_provisioning_requests')
      ).rejects.toMatchObject({ code: '42501' })
      // The platform role outside a platform transaction sees nothing.
      expect(
        (
          await platform.query(
            'SELECT count(*)::int AS n FROM payment_account_provisioning_requests'
          )
        ).rows[0].n
      ).toBe(0)
      expect(
        await scoped(
          platform,
          null,
          async (c) =>
            (
              await c.query(
                `SELECT "incomeValue"::text AS value FROM payment_account_provisioning_requests WHERE id='request-c'`
              )
            ).rows
        )
      ).toEqual([{ value: '98765.43' }])
      // Live values and identity never change; the only update is the single purge.
      for (const set of [
        `"incomeValue"=1`,
        `"mobilePhone"='11900000000'`,
        `"companyDataVersion"='${'b'.repeat(64)}'`,
        `"createdAt"=now() - interval '1 day'`,
      ])
        await expect(update(set)).rejects.toThrow(
          'PAYMENT_ACCOUNT_PROVISIONING_REQUEST_IMMUTABLE'
        )
      await expect(
        update(`"purgedAt"=now(),"purgeReason"='CREATED'`)
      ).rejects.toThrow('payment_account_provisioning_requests_purge')
      await expect(
        update(
          `"purgedAt"=now(),"purgeReason"='LATER',"incomeValue"=NULL,"mobilePhone"=NULL`
        )
      ).rejects.toThrow('payment_account_provisioning_requests_purge')
      await update(
        `"purgedAt"=now(),"purgeReason"='CREATED',"incomeValue"=NULL,"mobilePhone"=NULL`
      )
      for (const set of [
        `"purgedAt"=NULL,"purgeReason"=NULL,"incomeValue"=1,"mobilePhone"='11987654321'`,
        `"purgeReason"='BLOCKED'`,
        `"purgedAt"=now()`,
      ])
        await expect(update(set)).rejects.toThrow(
          'PAYMENT_ACCOUNT_PROVISIONING_REQUEST_IMMUTABLE'
        )
      // No DELETE: the platform role has no privilege and even the owner hits the history guard.
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `DELETE FROM payment_account_provisioning_requests WHERE id='request-c'`
          )
        )
      ).rejects.toMatchObject({ code: '42501' })
      await expect(
        db.query(
          `DELETE FROM payment_account_provisioning_requests WHERE id='request-c'`
        )
      ).rejects.toThrow('PLATFORM_HISTORY_DELETE_FORBIDDEN')
      expect(
        (
          await db.query(
            `SELECT "incomeValue","mobilePhone","purgeReason","companyDataVersion" FROM payment_account_provisioning_requests WHERE id='request-c'`
          )
        ).rows
      ).toEqual([
        {
          incomeValue: null,
          mobilePhone: null,
          purgeReason: 'CREATED',
          companyDataVersion: version,
        },
      ])
    })
    it('keeps events and legal evidence append-only and support read-only/time-limited', async () => {
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO subscription_events(id,"tenantId","subscriptionId","toStatus",reason,source,"dedupeKey") VALUES ('event','alfa','sub_legacy_alfa','ACTIVE','TEST','SYSTEM','test')`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE subscription_events SET reason='changed' WHERE id='event'`
          )
        )
      ).rejects.toThrow('PLATFORM_APPEND_ONLY')
      await scoped(platform, null, (c) =>
        c.query(
          `INSERT INTO legal_acceptances(id,"userId","tenantId",kind,version,"textSha256") VALUES ('terms','owner','alfa','PLATFORM_TERMS','test',repeat('a',64)),('marketing','owner','alfa','MARKETING_OPT_IN','test',repeat('a',64))`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE legal_acceptances SET "withdrawnAt"=now() WHERE id='terms'`
          )
        )
      ).rejects.toThrow('LEGAL_ACCEPTANCE_IMMUTABLE')
      await scoped(platform, null, (c) =>
        c.query(
          `UPDATE legal_acceptances SET "withdrawnAt"=now() WHERE id='marketing'`
        )
      )
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `UPDATE legal_acceptances SET "withdrawnAt"=NULL WHERE id='marketing'`
          )
        )
      ).rejects.toThrow('LEGAL_ACCEPTANCE_IMMUTABLE')
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO support_access_grants(id,"tenantId","grantedByUserId",reason,"approverStaffIds","expiresAt") VALUES ('too-long','alfa','owner','Support investigation','{}',now()+interval '73 hours')`
          )
        )
      ).rejects.toThrow(/support_grant_window/)
      await expect(
        scoped(platform, null, (c) =>
          c.query(
            `INSERT INTO support_access_grants(id,"tenantId",reason,"breakGlass","approverStaffIds","expiresAt") VALUES ('same-approver','alfa','Support investigation',true,'{one,one}',now()+interval '1 hour')`
          )
        )
      ).rejects.toThrow(/support_break_glass/)
    })
    it('read-only preflight reports missing subscription by id without credential values', async () => {
      const result = await scoped(platform, null, (c) =>
        checkPlatformPreflight(c, {})
      )
      expect(result.issues).toContainEqual({
        code: 'SUBSCRIPTION_REQUIRED',
        id: 'new',
      })
      expect(JSON.stringify(result)).not.toMatch(
        /wrappedDek|ciphertext|apiKey|password/
      )
    })
  }
)
