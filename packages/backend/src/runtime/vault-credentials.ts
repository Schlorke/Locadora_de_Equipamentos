import type { Prisma } from '@prisma/client'
import { createConfiguredSecrets } from './secrets'
import { getDatabaseRuntime } from './database'
import type { VaultCredentialReference } from './integration-credentials'
import type { SecretReference, SecretValue } from '../modules/secrets/index'

class VaultCredential {
  readonly #key?: SecretValue
  readonly #signing: readonly SecretValue[]
  readonly #verify?: SecretValue
  readonly #userAgent?: SecretValue
  constructor(
    readonly environment: string | undefined,
    key?: SecretValue,
    signing: readonly SecretValue[] = [],
    verify?: SecretValue,
    userAgent?: SecretValue
  ) {
    this.#key = key
    this.#signing = signing
    this.#verify = verify
    this.#userAgent = userAgent
  }
  get apiKey() {
    return this.#key?.use((value) => value)
  }
  get signingSecret() {
    return this.#signing[0]?.use((value) => value) ?? ''
  }
  get signingSecrets() {
    return this.#signing.map((secret) => secret.use((value) => value))
  }
  get userAgent() {
    return this.#userAgent?.use((value) => value)
  }
  get verifyToken() {
    return this.#verify?.use((value) => value)
  }
  toJSON() {
    return '[REDACTED]'
  }
  toString() {
    return '[REDACTED]'
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'IntegrationCredential([REDACTED])'
  }
}
export async function readConfiguredVaultCredential(
  ref: VaultCredentialReference,
  env: Readonly<Record<string, string | undefined>>
) {
  // Asaas inbound authenticates the stored hash without needing a usable outbound API key.
  if (ref.provider === 'ASAAS' && ref.usage === 'webhook')
    return new VaultCredential(ref.environment ?? undefined)
  const configured = await createConfiguredSecrets(env)
  try {
    const read = async (tx: Prisma.TransactionClient) => {
      const integration = await tx.tenantIntegration.findFirst({
        where: {
          id: ref.id,
          tenantId: ref.tenantId,
          credentialSource: 'VAULT',
          environment: ref.environment,
          provider: ref.provider,
          status: { not: 'DISABLED' },
        },
        select: { id: true },
      })
      if (!integration) return null
      const context: Omit<SecretReference, 'purpose'> = {
        tenantId: ref.tenantId,
        integrationId: ref.id,
        environment: ref.environment,
      }
      if (ref.usage === 'webhook') {
        const signing = await configured.vault.revealSigningSecrets(tx, context)
        const verify =
          ref.provider === 'WHATSAPP'
            ? await configured.vault.reveal(tx, {
                ...context,
                purpose: 'PROVIDER_VERIFY_TOKEN',
              })
            : undefined
        return new VaultCredential(
          ref.environment ?? undefined,
          undefined,
          signing,
          verify
        )
      }
      const key = await configured.vault.reveal(tx, {
        ...context,
        purpose:
          ref.provider === 'ASAAS' ? 'ASAAS_API_KEY' : 'PROVIDER_API_KEY',
      })
      const userAgent =
        ref.provider === 'MELHOR_ENVIO'
          ? await configured.vault.reveal(tx, {
              ...context,
              purpose: 'PROVIDER_USER_AGENT',
            })
          : undefined
      return new VaultCredential(
        ref.environment ?? undefined,
        key,
        [],
        undefined,
        userAgent
      )
    }
    if (ref.transaction) return await read(ref.transaction)
    return await getDatabaseRuntime().prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id',${ref.tenantId},true)`
        return read(tx)
      },
      { maxWait: 10000, timeout: 30000 }
    )
  } finally {
    configured.dispose()
  }
}
