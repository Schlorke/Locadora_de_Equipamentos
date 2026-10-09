import { describe, expect, it } from 'vitest'
import { runSeed } from '../../prisma/seed'
import { planBackfill } from '../../scripts/backfill-quote-codes'
const env = { DATABASE_URL: 'postgresql://test@localhost:5432/test_backfill' }
describe('quote code backfill safety plan (no database execution)', () => {
  it('requires explicit tenant and defaults to dry-run', () => {
    expect(() => planBackfill([], env)).toThrow('--tenant-id')
    expect(planBackfill(['--tenant-id', 'tenant-a'], env).apply).toBe(false)
    expect(planBackfill(['--tenant-id=tenant-b'], env).tenantId).toBe(
      'tenant-b'
    )
  })
  it('rejects implicit targets, remote targets and non-test database', () => {
    for (const input of [
      {},
      { DATABASE_URL: 'postgresql://db.example.test/test_backfill' },
      { DATABASE_URL: 'postgresql://localhost/production' },
    ])
      expect(() => planBackfill(['--tenant-id=a'], input)).toThrow()
  })
  it('requires exact operation, database and disposable opt-ins before apply', () => {
    const args = [
      '--tenant-id=a',
      '--apply',
      '--confirm=backfill-quote-codes',
      '--confirm-database=test_backfill',
    ]
    expect(() => planBackfill(args, env)).toThrow('--apply')
    expect(() =>
      planBackfill(args.slice(0, -1), {
        ...env,
        TEST_DATABASE_DISPOSABLE: 'true',
      })
    ).toThrow('--apply')
    expect(
      planBackfill(args, { ...env, TEST_DATABASE_DISPOSABLE: 'true' }).apply
    ).toBe(true)
  })
  it('sample catalog seed defaults to a disconnected dry run and never provisions an account', async () => {
    expect(await runSeed(['--tenant-id=a'], env)).toEqual({
      tenantId: 'a',
      mode: 'dry-run',
      scope: 'sample-catalog-only',
    })
    await expect(runSeed(['--tenant-id=a', '--apply'], env)).rejects.toThrow(
      '--apply'
    )
  })
})
