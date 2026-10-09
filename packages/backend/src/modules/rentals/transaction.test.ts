import { describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'
import { createRentalTransaction } from './transaction'

describe('existing tenant rental transaction contract', () => {
  it('uses the original tenant mutation lock on the same connection before the operation', async () => {
    const calls: string[] = []
    const tx = {
      organization: {
        findUnique: async () => {
          calls.push('organization')
          return { status: 'ACTIVE' }
        },
      },
      $executeRaw: async (sql: TemplateStringsArray, tenantId: string) => {
        expect(sql.join('?')).toBe(
          "SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(?))"
        )
        expect(tenantId).toBe('tenant-alfa')
        calls.push('lock')
      },
    } as unknown as Prisma.TransactionClient
    const run = createRentalTransaction({
      withTenantTransaction: async (context, operation) => {
        expect(context).toEqual({ tenantId: 'tenant-alfa' })
        return operation(tx)
      },
    }).withRentalTransaction
    expect(
      await run({ tenantId: 'tenant-alfa' }, async (connection) => {
        expect(connection).toBe(tx)
        calls.push('operation')
        return 'result'
      })
    ).toBe('result')
    expect(calls).toEqual(['organization', 'lock', 'operation'])
  })
  it.each([null, { status: 'SUSPENDED' }])(
    'refuses inactive/missing organization %j before locks or effects',
    async (organization) => {
      const calls: string[] = []
      const tx = {
        organization: { findUnique: async () => organization },
        $executeRaw: async () => {
          calls.push('lock')
        },
      } as unknown as Prisma.TransactionClient
      const run = createRentalTransaction({
        withTenantTransaction: async (_context, operation) => operation(tx),
      }).withRentalTransaction
      await expect(
        run({ tenantId: 'tenant-alfa' }, async () => {
          calls.push('effect')
        })
      ).rejects.toMatchObject({ status: 403, code: 'tenant_inactive' })
      expect(calls).toEqual([])
    }
  )
})
