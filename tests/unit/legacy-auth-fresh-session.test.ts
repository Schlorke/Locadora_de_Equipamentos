import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createLegacyAuthentication } from '@gb-locacoes/backend/identity'

describe('legacy sensitive action authentication time', () => {
  it('stamps sign-in, ignores refresh/update payload and keeps credential revocation', async () => {
    let instant = new Date('2026-10-04T16:00:00Z')
    const findUnique = vi
      .fn()
      .mockResolvedValue({ id: 'owner', password: null })
    const engine = createLegacyAuthentication({
      getDatabase: async () =>
        ({ user: { findUnique } }) as unknown as PrismaClient,
      signInAttempts: vi.fn(),
      environment: () => ({
        NEXTAUTH_SECRET: 'fixture-sensitive-session-secret',
      }),
      now: () => instant,
      limiterFailureFields: () => ({ error: 'fixture' }),
    })
    const jwt = engine.authOptions.callbacks!.jwt!
    type Input = Parameters<typeof jwt>[0]
    const token = await jwt({
      token: {},
      user: { id: 'owner', role: 'ADMIN' },
      account: {
        type: 'oauth',
        provider: 'fixture',
        providerAccountId: 'owner',
      },
    } as Input)
    expect(token.authenticatedAt).toBe(instant.getTime())
    instant = new Date('2026-10-04T16:20:00Z')
    const renewed = await jwt({
      token,
      trigger: 'update',
      session: { authenticatedAt: instant.getTime() },
    } as Input)
    expect(renewed.authenticatedAt).toBe(
      new Date('2026-10-04T16:00:00Z').getTime()
    )
    const callback = engine.authOptions.callbacks!.session!
    const session = await callback({
      token: renewed,
      session: {
        expires: '2030-01-01',
        authenticatedAt: instant.getTime(),
        user: { id: 'owner' },
      },
    } as Parameters<typeof callback>[0])
    expect(session).toMatchObject({ authenticatedAt: token.authenticatedAt })
    findUnique.mockResolvedValue({
      id: 'owner',
      password: 'rotated-credential',
    })
    await expect(jwt({ token: renewed } as Input)).rejects.toThrow(
      'SessionCredentialRevoked'
    )
  })
  it('an old signed cookie cannot borrow authentication time from session update', async () => {
    const engine = createLegacyAuthentication({
      getDatabase: vi.fn(),
      signInAttempts: vi.fn(),
      environment: () => ({}),
      limiterFailureFields: () => ({ error: 'fixture' }),
    })
    const callback = engine.authOptions.callbacks!.session!
    const session = await callback({
      token: { id: 'owner', role: 'ADMIN' },
      session: {
        expires: '2030-01-01',
        authenticatedAt: Date.now(),
        user: { id: 'owner' },
      },
    } as Parameters<typeof callback>[0])
    expect(session).not.toHaveProperty('authenticatedAt')
  })
})
