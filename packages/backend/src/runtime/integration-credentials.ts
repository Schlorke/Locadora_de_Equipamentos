import type { Prisma } from '@prisma/client'
import { readConfiguredVaultCredential } from './vault-credentials'

type IntegrationCredential = {
  signingSecret: string
  signingSecrets?: readonly string[]
  verifyToken?: string
  apiKey?: string
  environment?: string
  userAgent?: string
}
type CredentialTarget = {
  credentialsRef: string | null
  credentialSource?: string
  id?: string
  tenantId?: string
  provider?: string
  environment?: string | null
}
export type VaultCredentialReference = {
  kind: 'vault'
  id: string
  tenantId: string
  provider: string
  environment: string | null
  transaction?: Prisma.TransactionClient
  usage?: 'webhook'
}
export type IntegrationCredentialReference =
  string | null | undefined | VaultCredentialReference
/** ENV_REF keeps the exact legacy resolver argument; VAULT carries trusted tenant metadata and an existing transaction. */
export function integrationCredentialReference(
  integration: CredentialTarget,
  transaction?: Prisma.TransactionClient,
  usage?: 'webhook'
): IntegrationCredentialReference {
  if (integration.credentialSource !== 'VAULT')
    return integration.credentialsRef
  if (!integration.id || !integration.tenantId || !integration.provider)
    return null
  return {
    kind: 'vault',
    id: integration.id,
    tenantId: integration.tenantId,
    provider: integration.provider,
    environment: integration.environment ?? null,
    transaction,
    usage,
  }
}
/** Resolve existing environment references at call time, including credential rotation. */
export function createIntegrationCredentialResolver(
  getEnv: () => Record<string, string | undefined> = () => process.env,
  vaultRead: (
    _ref: VaultCredentialReference,
    _env: Record<string, string | undefined>
  ) => Promise<IntegrationCredential | null> = readConfiguredVaultCredential
) {
  async function resolveIntegrationCredential(
    ref: IntegrationCredentialReference
  ): Promise<IntegrationCredential | null> {
    if (ref && typeof ref === 'object' && ref.kind === 'vault') {
      try {
        return await vaultRead(ref, getEnv())
      } catch {
        return null
      }
    }
    if (
      typeof ref !== 'string' ||
      !/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/.test(ref)
    )
      return null
    if (
      getEnv().INTEGRATION_ENV_REFS_ALLOWED !== undefined &&
      getEnv().INTEGRATION_ENV_REFS_ALLOWED !== 'true'
    )
      return null
    const name = ref.slice('env:'.length)
    const signingSecret = getEnv()[`${name}_SECRET`]
    if (!signingSecret?.trim()) return null
    return {
      signingSecret,
      signingSecrets: [signingSecret],
      verifyToken: getEnv()[`${name}_VERIFY_TOKEN`],
      apiKey: getEnv()[`${name}_API_KEY`],
      environment: getEnv()[`${name}_ENVIRONMENT`],
      userAgent: getEnv()[`${name}_USER_AGENT`],
    }
  }
  return resolveIntegrationCredential
}
