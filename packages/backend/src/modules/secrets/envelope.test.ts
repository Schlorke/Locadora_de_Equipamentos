import { inspect } from 'node:util'
import { describe, expect, it } from 'vitest'
import { createEnvKeyring } from './adapters/env-keyring'
import {
  openSecret,
  sealSecret,
  secretAad,
  secretFingerprint,
} from './envelope'
import { SecretValue } from './secret-value'
import type { KeyEncryptionProvider, SecretContext } from './contracts'

const context: SecretContext = {
  tenantId: 'alfa',
  integrationId: 'gateway_a',
  purpose: 'ASAAS_API_KEY',
  version: 1,
  environment: 'sandbox',
}
const key = Buffer.alloc(32, 19)
const ring = createEnvKeyring('K1', { K1: key })
const providers = new Map([[ring.name, ring]])
const marker = 'synthetic-secret-never-log'

describe('authenticated envelope', () => {
  it('randomizes each envelope and returns plaintext only through an explicit accessor', async () => {
    const first = await sealSecret(marker, context, ring)
    const second = await sealSecret(marker, context, ring)
    expect(first.iv).toHaveLength(12)
    expect(first.authTag).toHaveLength(16)
    expect(first.ciphertext).not.toEqual(second.ciphertext)
    expect(first.wrappedDek).not.toEqual(second.wrappedDek)
    const value = await openSecret(first, context, providers)
    expect(value.use((v) => v)).toBe(marker)
    for (const serialized of [
      JSON.stringify(value),
      inspect(value),
      `${value}`,
      String(value),
    ]) {
      expect(serialized).not.toContain(marker)
      expect(serialized).toContain('REDACTED')
    }
    expect(Object.keys(value)).toEqual([])
    expect(secretAad(context)).toBe('v1|alfa|gateway_a|ASAAS_API_KEY|1|sandbox')
  })
  it.each([
    { tenantId: 'bravo' },
    { integrationId: 'gateway_b' },
    { purpose: 'PROVIDER_API_KEY' as const },
    { version: 2 },
    { environment: 'production' },
    { environment: null },
  ])('authenticates every context field: %j', async (change) => {
    const sealed = await sealSecret(marker, context, ring)
    await expect(
      openSecret(sealed, { ...context, ...change }, providers)
    ).rejects.toThrow('SECRET_UNAVAILABLE')
  })
  it.each(['iv', 'authTag', 'ciphertext', 'wrappedDek'] as const)(
    'rejects tampering with %s',
    async (field) => {
      const sealed = await sealSecret(marker, context, ring)
      const altered = Buffer.from(sealed[field])
      altered[altered.length - 1] = altered[altered.length - 1]! ^ 1
      await expect(
        openSecret({ ...sealed, [field]: altered }, context, providers)
      ).rejects.toThrow('SECRET_UNAVAILABLE')
    }
  )
  it.each([
    { tenantId: 'a|b' },
    { integrationId: 'a|b' },
    { version: 0 },
    { version: 2 ** 31 },
    { environment: '' },
  ])('rejects ambiguous or invalid AAD: %j', (change) => {
    expect(() => secretAad({ ...context, ...change })).toThrow(
      'SECRET_CONTEXT_INVALID'
    )
  })
  it('fails closed without the old KEK and supports a ring containing old keys', async () => {
    const sealed = await sealSecret(marker, context, ring)
    const next = createEnvKeyring('K2', { K1: key, K2: Buffer.alloc(32, 20) })
    expect(
      (await openSecret(sealed, context, new Map([[next.name, next]]))).use(
        (v) => v
      )
    ).toBe(marker)
    const missing = createEnvKeyring('K2', { K2: Buffer.alloc(32, 20) })
    await expect(
      openSecret(sealed, context, new Map([[missing.name, missing]]))
    ).rejects.toThrow('SECRET_UNAVAILABLE')
  })
  it('clears the DEK even when the provider fails and does not disclose provider errors', async () => {
    let borrowed: Uint8Array | undefined
    const failing: KeyEncryptionProvider = {
      ...ring,
      wrap: async (dek) => {
        borrowed = dek
        throw Error(marker)
      },
    }
    await expect(sealSecret(marker, context, failing)).rejects.toThrow(
      'SECRET_UNAVAILABLE'
    )
    expect(borrowed).toBeDefined()
    expect(Array.from(borrowed!)).toEqual(Array(32).fill(0))
  })
  it('uses a stable keyed fingerprint and rejects empty/oversized values', async () => {
    expect(secretFingerprint(marker, key)).toMatch(/^[a-f0-9]{64}$/)
    expect(secretFingerprint(new SecretValue(marker), key)).toBe(
      secretFingerprint(marker, key)
    )
    expect(secretFingerprint(marker, Buffer.alloc(32, 21))).not.toBe(
      secretFingerprint(marker, key)
    )
    for (const value of ['', 'é'.repeat(8193)])
      await expect(sealSecret(value, context, ring)).rejects.toThrow(
        'SECRET_CONTEXT_INVALID'
      )
  })
})
