import type { KMSClient } from '@aws-sdk/client-kms'
import { SecretVaultError, type KeyEncryptionProvider } from '../contracts'

export const KMS_KEY_ARN =
  /^arn:aws:kms:sa-east-1:\d{12}:key\/(?:[a-f0-9-]{36}|mrk-[a-f0-9]{32})$/
export function createAwsKmsKeyEncryption(
  current: string,
  client: Pick<KMSClient, 'send'>
): KeyEncryptionProvider {
  if (!KMS_KEY_ARN.test(current))
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  return {
    name: 'aws-kms',
    currentKekId: () => current,
    async wrap(dek, aad) {
      if (dek.length !== 32)
        throw new SecretVaultError('SECRET_CONTEXT_INVALID')
      try {
        const { EncryptCommand } = await import('@aws-sdk/client-kms')
        const response = await client.send(
          new EncryptCommand({
            KeyId: current,
            Plaintext: dek,
            EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
            EncryptionContext: { aad },
          }),
          { abortSignal: AbortSignal.timeout(8000) }
        )
        if (response.KeyId !== current || !response.CiphertextBlob?.length)
          throw new SecretVaultError('SECRET_UNAVAILABLE')
        return { kekId: response.KeyId, wrapped: response.CiphertextBlob }
      } catch {
        throw new SecretVaultError('SECRET_UNAVAILABLE')
      }
    },
    async unwrap(kekId, wrapped, aad) {
      if (!KMS_KEY_ARN.test(kekId) || !wrapped.length)
        throw new SecretVaultError('SECRET_UNAVAILABLE')
      try {
        const { DecryptCommand } = await import('@aws-sdk/client-kms')
        const response = await client.send(
          new DecryptCommand({
            KeyId: kekId,
            CiphertextBlob: wrapped,
            EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
            EncryptionContext: { aad },
          }),
          { abortSignal: AbortSignal.timeout(8000) }
        )
        if (response.KeyId !== kekId || response.Plaintext?.length !== 32) {
          response.Plaintext?.fill(0)
          throw new SecretVaultError('SECRET_UNAVAILABLE')
        }
        return response.Plaintext
      } catch {
        throw new SecretVaultError('SECRET_UNAVAILABLE')
      }
    },
  }
}
