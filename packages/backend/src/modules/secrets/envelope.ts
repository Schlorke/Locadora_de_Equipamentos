import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto'
import { SecretPurpose } from '@prisma/client'
import {
  SecretVaultError,
  type KeyEncryptionProvider,
  type SecretContext,
  type SecretInput,
  type SealedSecret,
} from './contracts'
import { SecretValue } from './secret-value'

export function secretAad(context: SecretContext): string {
  if (
    !/^[A-Za-z0-9_-]{1,128}$/.test(context.tenantId) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(context.integrationId) ||
    !Object.values(SecretPurpose).includes(context.purpose) ||
    !Number.isSafeInteger(context.version) ||
    context.version < 1 ||
    context.version > 2147483647 ||
    ![null, 'sandbox', 'production'].includes(context.environment)
  )
    throw new SecretVaultError('SECRET_CONTEXT_INVALID')
  return `v1|${context.tenantId}|${context.integrationId}|${context.purpose}|${context.version}|${context.environment ?? '-'}`
}
export function secretFingerprint(value: SecretInput, key: Uint8Array): string {
  if (key.length < 32)
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  const compute = (plain: string) => {
    if (!plain || Buffer.byteLength(plain, 'utf8') > 16384)
      throw new SecretVaultError('SECRET_CONTEXT_INVALID')
    return createHmac('sha256', key).update(plain, 'utf8').digest('hex')
  }
  return typeof value === 'string' ? compute(value) : value.use(compute)
}
export async function sealSecret(
  value: SecretInput,
  context: SecretContext,
  provider: KeyEncryptionProvider
): Promise<SealedSecret> {
  const aad = secretAad(context)
  const dek = randomBytes(32)
  const iv = randomBytes(12)
  const plain = Buffer.from(
    typeof value === 'string' ? value : value.use((v) => v),
    'utf8'
  )
  try {
    if (!plain.length || plain.length > 16384)
      throw new SecretVaultError('SECRET_CONTEXT_INVALID')
    const cipher = createCipheriv('aes-256-gcm', dek, iv, { authTagLength: 16 })
    cipher.setAAD(Buffer.from(aad, 'utf8'))
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
    const wrapped = await provider.wrap(dek, aad)
    if (!wrapped.kekId || !wrapped.wrapped.length)
      throw new SecretVaultError('SECRET_UNAVAILABLE')
    return {
      kekProvider: provider.name,
      kekId: wrapped.kekId,
      wrappedDek: wrapped.wrapped,
      iv,
      ciphertext,
      authTag: cipher.getAuthTag(),
      aadVersion: 1,
    }
  } catch (error) {
    if (error instanceof SecretVaultError) throw error
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  } finally {
    dek.fill(0)
    plain.fill(0)
  }
}
export async function unwrapSecretDek(
  sealed: SealedSecret,
  context: SecretContext,
  providers: ReadonlyMap<string, KeyEncryptionProvider>
): Promise<Uint8Array> {
  const aad = secretAad(context)
  if (
    sealed.aadVersion !== 1 ||
    sealed.iv.length !== 12 ||
    sealed.authTag.length !== 16 ||
    !sealed.ciphertext.length
  )
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  const provider = providers.get(sealed.kekProvider)
  if (!provider) throw new SecretVaultError('SECRET_UNAVAILABLE')
  try {
    const dek = await provider.unwrap(sealed.kekId, sealed.wrappedDek, aad)
    if (dek.length !== 32) {
      dek.fill(0)
      throw new SecretVaultError('SECRET_UNAVAILABLE')
    }
    return dek
  } catch {
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  }
}
export async function openSecret(
  sealed: SealedSecret,
  context: SecretContext,
  providers: ReadonlyMap<string, KeyEncryptionProvider>
): Promise<SecretValue> {
  const dek = await unwrapSecretDek(sealed, context, providers)
  let plain: Buffer | undefined
  let partial: Buffer | undefined
  try {
    const decipher = createDecipheriv('aes-256-gcm', dek, sealed.iv, {
      authTagLength: 16,
    })
    decipher.setAAD(Buffer.from(secretAad(context), 'utf8'))
    decipher.setAuthTag(Buffer.from(sealed.authTag))
    partial = decipher.update(sealed.ciphertext)
    plain = Buffer.concat([partial, decipher.final()])
    return new SecretValue(plain.toString('utf8'))
  } catch {
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  } finally {
    dek.fill(0)
    partial?.fill(0)
    plain?.fill(0)
  }
}
