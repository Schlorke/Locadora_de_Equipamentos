import type { SecretPurpose } from '@prisma/client'

export type SecretContext = {
  tenantId: string
  integrationId: string
  purpose: SecretPurpose
  version: number
  environment: string | null
}
export type SecretReference = Omit<SecretContext, 'version'>
export interface KeyEncryptionProvider {
  readonly name: 'env' | 'aws-kms'
  currentKekId(): string
  wrap(
    dek: Uint8Array,
    aad: string
  ): Promise<{ kekId: string; wrapped: Uint8Array }>
  unwrap(kekId: string, wrapped: Uint8Array, aad: string): Promise<Uint8Array>
}
export type SecretInput = string | { use<T>(fn: (value: string) => T): T }
export type SealedSecret = {
  kekProvider: string
  kekId: string
  wrappedDek: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
  authTag: Uint8Array
  aadVersion: number
}
export class SecretVaultError extends Error {
  constructor(
    readonly code:
      | 'SECRET_CONTEXT_INVALID'
      | 'SECRET_CONFIGURATION_INVALID'
      | 'SECRET_UNAVAILABLE'
      | 'SECRET_STATE_INVALID'
      | 'SECRET_ALREADY_EXISTS'
  ) {
    super(code)
  }
}
