import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { SecretVaultError, type KeyEncryptionProvider } from '../contracts'

export function createEnvKeyring(
  current: string,
  keys: Readonly<Record<string, Uint8Array>>
): KeyEncryptionProvider {
  const ring = new Map(
    Object.entries(keys).map(([id, key]) => [id, Buffer.from(key)])
  )
  if (
    !ring.has(current) ||
    [...ring].some(
      ([id, key]) => !/^[A-Z][A-Z0-9_]{0,31}$/.test(id) || key.length !== 32
    )
  )
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  return {
    name: 'env',
    currentKekId: () => current,
    async wrap(dek, aad) {
      if (dek.length !== 32)
        throw new SecretVaultError('SECRET_CONTEXT_INVALID')
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', ring.get(current)!, iv, {
        authTagLength: 16,
      })
      cipher.setAAD(Buffer.from(aad, 'utf8'))
      const encrypted = Buffer.concat([cipher.update(dek), cipher.final()])
      return {
        kekId: current,
        wrapped: Buffer.concat([
          Buffer.from([1]),
          iv,
          cipher.getAuthTag(),
          encrypted,
        ]),
      }
    },
    async unwrap(kekId, wrapped, aad) {
      const key = ring.get(kekId)
      if (!key || wrapped.length !== 61 || wrapped[0] !== 1)
        throw new SecretVaultError('SECRET_UNAVAILABLE')
      let partial: Buffer | undefined
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          wrapped.subarray(1, 13),
          { authTagLength: 16 }
        )
        decipher.setAAD(Buffer.from(aad, 'utf8'))
        decipher.setAuthTag(Buffer.from(wrapped.subarray(13, 29)))
        partial = decipher.update(wrapped.subarray(29))
        return Buffer.concat([partial, decipher.final()])
      } catch {
        throw new SecretVaultError('SECRET_UNAVAILABLE')
      } finally {
        partial?.fill(0)
      }
    },
  }
}
