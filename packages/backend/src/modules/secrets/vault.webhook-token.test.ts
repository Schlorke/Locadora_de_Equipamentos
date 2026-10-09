import { describe, expect, it } from 'vitest'
import { inspect } from 'node:util'
import { createSecretVault } from './vault'
import { createEnvKeyring } from './adapters/env-keyring'

const ref = {
  tenantId: 'tenant-alfa',
  integrationId: 'integration-alfa',
  environment: 'sandbox',
}
const ring = createEnvKeyring('TEST', { TEST: Buffer.alloc(32, 1) })
const vault = (key = Buffer.alloc(32, 2)) =>
  createSecretVault({ current: ring, providers: [ring], fingerprintKey: key })
describe('recoverable webhook authentication', () => {
  it('is stable across process recreation, redacted and domain separated from credential hashes', () => {
    const value = vault().webhookToken(ref, 'secret-alfa')
    const plain = value.use((token) => token)
    expect(plain).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(
      vault()
        .webhookToken(ref, 'secret-alfa')
        .use((token) => token)
    ).toBe(plain)
    expect(vault().fingerprint('secret-alfa')).not.toBe(plain)
    expect(
      JSON.stringify({ value }) + inspect(value) + String(value)
    ).not.toContain(plain)
  })
  it.each([
    { ...ref, tenantId: 'tenant-bravo' },
    { ...ref, integrationId: 'integration-bravo' },
    { ...ref, environment: 'production' },
  ])('binds all nonsecret reference fields: %j', (other) => {
    expect(
      vault()
        .webhookToken(other, 'secret-alfa')
        .use((value) => value)
    ).not.toBe(
      vault()
        .webhookToken(ref, 'secret-alfa')
        .use((value) => value)
    )
  })
  it('changes on credential/master changes and rejects a forged scope', () => {
    const current = vault()
      .webhookToken(ref, 'secret-alfa')
      .use((value) => value)
    expect(
      vault()
        .webhookToken(ref, 'secret-bravo')
        .use((value) => value)
    ).not.toBe(current)
    expect(
      vault(Buffer.alloc(32, 3))
        .webhookToken(ref, 'secret-alfa')
        .use((value) => value)
    ).not.toBe(current)
    expect(() =>
      vault().webhookToken({ ...ref, tenantId: '../foreign' }, 'secret-alfa')
    ).toThrow('SECRET_CONTEXT_INVALID')
    expect(() => vault().webhookToken(ref, '../secret')).toThrow(
      'SECRET_CONTEXT_INVALID'
    )
  })
})
