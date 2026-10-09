import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import {
  planMaintenance,
  runMaintenance,
} from '../../scripts/security/maintenance.mjs'
import { requireTestDatabase } from '../helpers/test-database'

const env = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
  BOOTSTRAP_ADMIN_PASSWORD: 'test-password-1234',
}
describe('controlled maintenance CLI', () => {
  it('defaults to dry run without calling any operation', async () => {
    const provision = vi.fn()
    expect(
      await runMaintenance(['provision-admin'], env, {
        'provision-admin': provision,
      })
    ).toEqual({
      operation: 'provision-admin',
      apply: false,
      target: 'loopback',
    })
    expect(provision).not.toHaveBeenCalled()
  })
  it('requires operation-specific confirmation for writes', () => {
    expect(() => planMaintenance(['provision-admin', '--apply'], env)).toThrow(
      'confirmation'
    )
  })
  it('requires separate consent for remote targets', () => {
    expect(() =>
      planMaintenance(
        ['provision-admin', '--apply', '--confirm=provision-admin'],
        { ...env, DATABASE_URL: 'postgresql://test:test@db.example.test/test' }
      )
    ).toThrow('--allow-remote')
  })
  it('calls only the requested operation after complete confirmation', async () => {
    const provision = vi.fn()
    await runMaintenance(
      ['provision-admin', '--apply', '--confirm=provision-admin'],
      env,
      { 'provision-admin': provision }
    )
    expect(provision).toHaveBeenCalledExactlyOnceWith(env)
  })
  it('rejects missing credentials and weak bootstrap passwords', () => {
    expect(() =>
      planMaintenance(['provision-admin'], {
        ...env,
        BOOTSTRAP_ADMIN_PASSWORD: '',
      })
    ).toThrow('12 characters')
    expect(() =>
      planMaintenance(['setup-storage'], {
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      })
    ).toThrow('SUPABASE_SERVICE_ROLE_KEY')
  })
  it('never includes supplied credentials or endpoint in the plan', () => {
    const output = JSON.stringify(planMaintenance(['provision-admin'], env))
    expect(output).not.toContain(env.DATABASE_URL)
    expect(output).not.toContain(env.BOOTSTRAP_ADMIN_PASSWORD)
    expect(output).not.toContain(env.BOOTSTRAP_ADMIN_EMAIL)
  })
})

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'provision-admin against a disposable database',
  () => {
    const tag = randomUUID().slice(0, 8)
    const address = (local: string) => `maint-${local}-${tag}@example.test`
    const existing = address('axb')
    const legacyMixedCase = `Maint-Legacy-${tag}@Example.test`
    let pool: Pool
    let prisma: PrismaClient
    const provision = (email: string) =>
      runMaintenance(
        ['provision-admin', '--apply', '--confirm=provision-admin'],
        {
          DATABASE_URL: requireTestDatabase(process.env),
          BOOTSTRAP_ADMIN_EMAIL: email,
          BOOTSTRAP_ADMIN_PASSWORD: 'test-password-1234',
        }
      )
    const created = [address('a_b'), address('a%'), existing]

    beforeAll(async () => {
      pool = new Pool({
        connectionString: requireTestDatabase(process.env),
        max: 2,
      })
      prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
      await prisma.user.createMany({
        data: [
          { email: existing, name: 'Existing' },
          { email: legacyMixedCase, name: 'Legacy' },
        ],
      })
    })
    afterAll(async () => {
      await prisma?.user.deleteMany({
        where: { email: { in: [...created, legacyMixedCase] } },
      })
      await prisma?.$disconnect()
      await pool?.end()
    })

    it('compares the normalized e-mail exactly: _ and % are not wildcards', async () => {
      // Um ILIKE sem escape casaria as duas com `maint-axb-…` e recusaria.
      await expect(provision(address('a_b'))).resolves.toMatchObject({
        apply: true,
      })
      await expect(provision(address('a%'))).resolves.toMatchObject({
        apply: true,
      })
      const admins = await prisma.user.findMany({
        where: { email: { in: [address('a_b'), address('a%')] } },
        select: { email: true, role: true },
      })
      expect(
        Object.fromEntries(admins.map(({ email, role }) => [email, role]))
      ).toEqual({ [address('a_b')]: 'ADMIN', [address('a%')]: 'ADMIN' })
    }, 30000)

    it('still refuses an existing account regardless of case', async () => {
      await expect(provision(existing.toUpperCase())).rejects.toThrow(
        'Existing account cannot be changed by bootstrap'
      )
      await expect(provision(legacyMixedCase.toLowerCase())).rejects.toThrow(
        'Existing account cannot be changed by bootstrap'
      )
      expect(
        await prisma.user.findUnique({
          where: { email: existing },
          select: { role: true, password: true },
        })
      ).toEqual({ role: 'CLIENT', password: null })
    }, 30000)
  }
)
