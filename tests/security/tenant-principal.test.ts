import { describe, expect, it, vi } from 'vitest'
import {
  resolvePrincipal,
  withTenantTransaction,
} from '../../packages/backend/src/modules/identity/tenant-principal'
import type { PrismaClient } from '@prisma/client'

const membership = {
  id: 'membership-A',
  tenantId: 'tenant-A',
  userId: 'user-1',
  role: 'CLIENT' as const,
  status: 'ACTIVE',
  organization: { status: 'ACTIVE' },
}
const header = (tenantId: string) => ({ source: 'header' as const, tenantId })
const cookie = (tenantId: string) => ({ source: 'cookie' as const, tenantId })
const host = (tenantId: string) => ({ source: 'host' as const, tenantId })
const input = {
  userId: 'user-1',
  candidates: [header('tenant-A')],
  findMembership: async () => membership,
}

describe('tenant principal', () => {
  it('requires authenticated identity before membership lookup', async () => {
    const findMembership = vi.fn()
    expect(
      await resolvePrincipal({ ...input, userId: null, findMembership })
    ).toMatchObject({ ok: false, status: 401 })
    expect(findMembership).not.toHaveBeenCalled()
  })
  it('does not select a first tenant', async () => {
    const findMembership = vi.fn()
    expect(
      await resolvePrincipal({ ...input, candidates: [], findMembership })
    ).toMatchObject({ ok: false, status: 409 })
    expect(findMembership).not.toHaveBeenCalled()
  })
  it('rejects disagreement between explicit selectors', async () => {
    expect(
      await resolvePrincipal({
        ...input,
        candidates: [header('tenant-A'), cookie('tenant-B')],
      })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it.each([
    ['header', [host('tenant-A'), header('tenant-B')]],
    ['cookie', [host('tenant-A'), cookie('tenant-B')]],
    [
      'header and cookie',
      [host('tenant-A'), header('tenant-A'), cookie('tenant-B')],
    ],
  ])(
    'rejects a %s selection that diverges from the host tenant before any lookup',
    async (_name, candidates) => {
      const findMembership = vi.fn()
      expect(
        await resolvePrincipal({ ...input, candidates, findMembership })
      ).toEqual({
        ok: false,
        status: 400,
        error: 'Conflicting tenant selection',
      })
      expect(findMembership).not.toHaveBeenCalled()
    }
  )
  it('accepts selectors that repeat the host tenant and checks that membership', async () => {
    const findMembership = vi.fn(async () => membership)
    expect(
      await resolvePrincipal({
        ...input,
        candidates: [host('tenant-A'), header('tenant-A'), cookie('tenant-A')],
        findMembership,
      })
    ).toMatchObject({ ok: true, principal: { tenantId: 'tenant-A' } })
    expect(findMembership).toHaveBeenCalledExactlyOnceWith('tenant-A', 'user-1')
  })
  it('uses the host tenant alone, without header or cookie', async () => {
    const findMembership = vi.fn(async () => membership)
    expect(
      await resolvePrincipal({
        ...input,
        candidates: [host('tenant-A')],
        findMembership,
      })
    ).toMatchObject({ ok: true, principal: { tenantId: 'tenant-A' } })
    expect(findMembership).toHaveBeenCalledExactlyOnceWith('tenant-A', 'user-1')
  })
  it('keeps rejecting an empty or malformed selection', async () => {
    expect(
      await resolvePrincipal({ ...input, candidates: [header('')] })
    ).toMatchObject({ ok: false, status: 409 })
    expect(
      await resolvePrincipal({ ...input, candidates: [header('a b')] })
    ).toMatchObject({
      ok: false,
      status: 400,
      error: 'Invalid tenant selection',
    })
  })
  it.each(['SUSPENDED', 'REVOKED'])(
    'rejects %s membership on every request',
    async (status) => {
      expect(
        await resolvePrincipal({
          ...input,
          findMembership: async () => ({ ...membership, status }),
        })
      ).toMatchObject({ ok: false, status: 403 })
    }
  )
  it('rejects suspended organizations', async () => {
    expect(
      await resolvePrincipal({
        ...input,
        findMembership: async () => ({
          ...membership,
          organization: { status: 'SUSPENDED' },
        }),
      })
    ).toMatchObject({ ok: false, status: 403 })
  })
  it('cannot substitute a membership from another user or tenant', async () => {
    expect(
      await resolvePrincipal({
        ...input,
        findMembership: async () => ({ ...membership, userId: 'other-user' }),
      })
    ).toMatchObject({ ok: false, status: 403 })
    expect(
      await resolvePrincipal({
        ...input,
        findMembership: async () => ({ ...membership, tenantId: 'tenant-B' }),
      })
    ).toMatchObject({ ok: false, status: 403 })
  })
  it('authorizes using membership role, with no global role input', async () => {
    expect(await resolvePrincipal(input)).toEqual({
      ok: true,
      principal: {
        userId: 'user-1',
        tenantId: 'tenant-A',
        membershipId: 'membership-A',
        role: 'CLIENT',
      },
    })
  })
  it('sets SQL context locally on the same transaction before executing business code', async () => {
    const query = vi.fn().mockResolvedValue([])
    const tx = { $queryRaw: query }
    const transaction = vi.fn(async (fn: (_value: unknown) => unknown) =>
      fn(tx)
    )
    const result = await withTenantTransaction(
      { $transaction: transaction } as unknown as PrismaClient,
      { tenantId: 'tenant-A' },
      async (actual) => {
        expect(query).toHaveBeenCalledOnce()
        expect(actual).toBe(tx)
        return 42
      }
    )
    expect(result).toBe(42)
    expect(query.mock.calls[0]?.[0].join('?')).toBe(
      "SELECT set_config('app.tenant_id', ?, true)"
    )
    expect(query.mock.calls[0]?.[1]).toBe('tenant-A')
  })
})
