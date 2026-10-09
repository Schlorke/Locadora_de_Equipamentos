import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createSitePublication } from './site-publication'
import type { TenantPrincipal } from '../identity/index'
import type { TenantTransactionRunner } from '../rentals/index'
import type { PlatformScope } from '../platform-scope/index'

const principal: TenantPrincipal = {
  tenantId: 'alfa',
  userId: 'owner',
  membershipId: 'owner-member',
  role: 'ADMIN',
}
const instant = new Date('2026-10-04T12:00:00Z')
function fixture() {
  const calls: string[] = []
  const org = {
    status: 'ACTIVE',
    access: 'FULL',
    ownerUserId: 'owner',
    sitePublishedAt: null as Date | null,
  }
  const state = { membership: true, verified: true, count: 1, failAudit: false }
  const update = vi.fn(
    async ({ data }: { data: { sitePublishedAt: Date } }) => {
      org.sitePublishedAt = data.sitePublishedAt
    }
  )
  const audit = vi.fn(async () => {
    if (state.failAudit) throw new Error('private database detail')
    calls.push('audit')
  })
  const platform = {
    $executeRaw: async (sql: TemplateStringsArray, tenantId: string) => {
      expect(sql.join('?')).toBe(
        "SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(?))"
      )
      expect(tenantId).toBe('alfa')
      calls.push('lock')
    },
    $queryRaw: async (sql: TemplateStringsArray) => {
      if (sql.join('').includes('platform_user_contacts'))
        return [{ authEmailVerified: state.verified }]
      calls.push('organization-lock')
      return [{ id: 'alfa' }]
    },
    membership: {
      findFirst: async (args: { where: unknown }) => {
        expect(args.where).toEqual({
          id: principal.membershipId,
          tenantId: principal.tenantId,
          userId: principal.userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        return state.membership ? { organization: org } : null
      },
    },
    organization: { update },
    platformAuditLog: { create: audit },
    equipment: {
      count: async () => {
        throw new Error('platform must never read equipment')
      },
    },
  } as unknown as Prisma.TransactionClient
  const business = {
    $executeRaw: async (sql: TemplateStringsArray) => {
      expect(sql.join('')).toBe('SET TRANSACTION READ ONLY')
      calls.push('readonly')
    },
    equipment: {
      count: async (args: { where: unknown }) => {
        expect(args.where).toEqual({ tenantId: 'alfa' })
        calls.push('count')
        return state.count
      },
    },
  } as unknown as Prisma.TransactionClient
  const transaction: PlatformScope['withProvisioningTransaction'] = async (
    tenantId,
    operation
  ) => {
    expect(tenantId).toBe('alfa')
    const before = org.sitePublishedAt
    try {
      const result = await operation(platform)
      calls.push('commit')
      return result
    } catch (error) {
      org.sitePublishedAt = before
      throw error
    }
  }
  const withTenantTransaction: TenantTransactionRunner = async (
    context,
    operation
  ) => {
    expect(context).toEqual({ tenantId: 'alfa' })
    return operation(business)
  }
  const publish = createSitePublication({
    transaction,
    withTenantTransaction,
    now: () => instant,
  })
  return { calls, org, state, update, audit, publish }
}

describe('owner site publication', () => {
  it('holds the stock lock before organization/read-only count and writes only publication/audit', async () => {
    const f = fixture()
    expect(await f.publish(principal)).toEqual({
      published: true,
      publishedAt: instant.toISOString(),
    })
    expect(f.calls).toEqual([
      'lock',
      'organization-lock',
      'readonly',
      'count',
      'audit',
      'commit',
    ])
    expect(f.update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'alfa' },
      data: { sitePublishedAt: instant },
    })
    expect(f.audit).toHaveBeenCalledTimes(1)
  })
  it('returns the original receipt on repeat without changing indexing, slug or timestamps', async () => {
    const f = fixture(),
      first = await f.publish(principal)
    f.state.count = 0
    expect(await f.publish(principal)).toEqual(first)
    expect(f.update).toHaveBeenCalledTimes(1)
    expect(f.audit).toHaveBeenCalledTimes(1)
    expect(f.calls.filter((c) => c === 'count')).toHaveLength(1)
  })
  it.each([
    [
      'owner transferred',
      (f: ReturnType<typeof fixture>) => {
        f.org.ownerUserId = 'another'
      },
      'OWNER_REQUIRED',
    ],
    [
      'inactive membership',
      (f: ReturnType<typeof fixture>) => {
        f.state.membership = false
      },
      'OWNER_REQUIRED',
    ],
    [
      'inactive organization',
      (f: ReturnType<typeof fixture>) => {
        f.org.status = 'SUSPENDED'
      },
      'OWNER_REQUIRED',
    ],
    [
      'email unverified',
      (f: ReturnType<typeof fixture>) => {
        f.state.verified = false
      },
      'EMAIL_NOT_VERIFIED',
    ],
    [
      'setup',
      (f: ReturnType<typeof fixture>) => {
        f.org.access = 'SETUP'
      },
      'SUBSCRIPTION_RESTRICTED',
    ],
    [
      'restricted',
      (f: ReturnType<typeof fixture>) => {
        f.org.access = 'RESTRICTED'
      },
      'SUBSCRIPTION_RESTRICTED',
    ],
    [
      'archived',
      (f: ReturnType<typeof fixture>) => {
        f.org.access = 'ARCHIVED'
      },
      'TENANT_ARCHIVED',
    ],
    [
      'no equipment',
      (f: ReturnType<typeof fixture>) => {
        f.state.count = 0
      },
      'FIRST_EQUIPMENT_REQUIRED',
    ],
  ])(
    'refuses %s without a publication or audit',
    async (_label, change, code) => {
      const f = fixture()
      change(f)
      await expect(f.publish(principal)).rejects.toMatchObject({ code })
      expect(f.update).not.toHaveBeenCalled()
      expect(f.audit).not.toHaveBeenCalled()
      expect(f.org.sitePublishedAt).toBeNull()
    }
  )
  it('rolls back publication when its mandatory audit fails', async () => {
    const f = fixture()
    f.state.failAudit = true
    await expect(f.publish(principal)).rejects.toThrow(
      'private database detail'
    )
    expect(f.org.sitePublishedAt).toBeNull()
    expect(f.calls).not.toContain('commit')
  })
})
