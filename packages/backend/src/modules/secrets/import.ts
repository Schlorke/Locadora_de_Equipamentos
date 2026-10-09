import { createHash, timingSafeEqual } from 'node:crypto'
import type { Prisma, SecretPurpose } from '@prisma/client'
import type { PlatformTransaction } from '../platform-scope/index'
import { secretFingerprint } from './envelope'
import type { createSecretVault } from './vault'

export class SecretImportError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
export type SecretImportInput = {
  integrationId: string
  reference: string
  variables: Readonly<Record<string, string | undefined>>
}
type Vault = ReturnType<typeof createSecretVault>
const select = {
  id: true,
  tenantId: true,
  provider: true,
  environment: true,
  credentialSource: true,
  credentialsRef: true,
  status: true,
  externalAccountId: true,
  webhookTokenHash: true,
  webhookTokenPreviousHash: true,
  webhookTokenPreviousUntil: true,
  secrets: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      purpose: true,
      state: true,
      version: true,
      environment: true,
      fingerprint: true,
      expiresAt: true,
      kekProvider: true,
      kekId: true,
    },
  },
} satisfies Prisma.TenantIntegrationSelect
type Integration = Prisma.TenantIntegrationGetPayload<{ select: typeof select }>
function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
}

/** One integration per confirmed plan; retries must review current state again. */
export function createSecretImporter(options: {
  read: PlatformTransaction
  write: PlatformTransaction
  fingerprintKey: Uint8Array
  configuredVault: () => Promise<{ vault: Vault; dispose: () => void }>
}) {
  const fingerprintKey = Buffer.from(options.fingerprintKey)
  if (fingerprintKey.length < 32)
    throw new SecretImportError('SECRET_IMPORT_CONFIGURATION_INVALID')
  async function load(tx: Prisma.TransactionClient, input: SecretImportInput) {
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(input.integrationId) ||
      !/^env:LOCADORA_INTEGRATION_[A-Z0-9_]+$/.test(input.reference)
    )
      throw new SecretImportError('SECRET_IMPORT_INPUT_INVALID')
    const row = await tx.tenantIntegration.findUnique({
      where: { id: input.integrationId },
      select,
    })
    if (!row || row.status === 'DISABLED')
      throw new SecretImportError('SECRET_IMPORT_INTEGRATION_UNAVAILABLE')
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(row.tenantId))
      throw new SecretImportError('SECRET_IMPORT_INPUT_INVALID')
    const target = await tx.$queryRaw<
      { database: string; role: string; address: string; port: number }[]
    >`
      SELECT current_database() AS database, session_user::text AS role,
        inet_server_addr()::text AS address, inet_server_port() AS port
    `
    if (
      !['ASAAS', 'ZAPSIGN', 'WHATSAPP', 'PIX', 'MELHOR_ENVIO'].includes(
        row.provider
      )
    )
      throw new SecretImportError('SECRET_IMPORT_PROVIDER_UNSUPPORTED')
    if (
      row.credentialSource === 'ENV_REF' &&
      row.credentialsRef !== input.reference
    )
      throw new SecretImportError('SECRET_IMPORT_REFERENCE_MISMATCH')
    const name = input.reference.slice(4)
    const value = (suffix: string) => input.variables[`${name}_${suffix}`]
    if (
      ![null, 'sandbox', 'production'].includes(row.environment) ||
      (value('ENVIRONMENT') !== undefined &&
        value('ENVIRONMENT') !== row.environment) ||
      (['ASAAS', 'MELHOR_ENVIO'].includes(row.provider) &&
        row.environment === null)
    )
      throw new SecretImportError('SECRET_IMPORT_ENVIRONMENT_MISMATCH')
    const required = (suffix: string) => {
      const result = value(suffix)
      if (!result?.trim() || Buffer.byteLength(result, 'utf8') > 16384)
        throw new SecretImportError('SECRET_IMPORT_VARIABLE_MISSING')
      return result
    }
    const secrets: {
      purpose: SecretPurpose
      value: string
      fingerprint: string
    }[] = []
    function add(purpose: SecretPurpose, suffix: string) {
      const plain = required(suffix)
      secrets.push({
        purpose,
        value: plain,
        fingerprint: secretFingerprint(plain, fingerprintKey),
      })
    }
    add(
      row.provider === 'ASAAS' ? 'ASAAS_API_KEY' : 'PROVIDER_API_KEY',
      'API_KEY'
    )
    const signing = required('SECRET')
    const webhookHash =
      row.provider === 'ASAAS'
        ? createHash('sha256').update(signing).digest('hex')
        : null
    if (row.provider !== 'ASAAS') add('PROVIDER_SIGNING_SECRET', 'SECRET')
    if (row.provider === 'WHATSAPP')
      add('PROVIDER_VERIFY_TOKEN', 'VERIFY_TOKEN')
    if (row.provider === 'MELHOR_ENVIO') {
      if (
        !/^[^\r\n]{3,160}\([^()\r\n]+@[^()\r\n]+\)$/.test(
          required('USER_AGENT')
        )
      )
        throw new SecretImportError('SECRET_IMPORT_INPUT_INVALID')
      add('PROVIDER_USER_AGENT', 'USER_AGENT')
    }
    if (row.credentialSource === 'ENV_REF' && row.secrets.length)
      throw new SecretImportError('SECRET_IMPORT_EXISTING_SECRET_CONFLICT')
    if (row.credentialSource === 'VAULT')
      verifyExisting(row, secrets, webhookHash)
    const action = row.credentialSource === 'VAULT' ? 'NOOP' : 'IMPORT'
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          version: 1,
          target: target[0],
          action,
          integration: row,
          reference: input.reference,
          desired: secrets.map(({ purpose, fingerprint }) => ({
            purpose,
            fingerprint,
          })),
          webhookFingerprint: secretFingerprint(signing, fingerprintKey),
        })
      )
      .digest('hex')
    return { row, secrets, webhookHash, hash, action }
  }
  function verifyExisting(
    row: Integration,
    secrets: { purpose: SecretPurpose; fingerprint: string }[],
    webhookHash: string | null
  ) {
    if (
      row.credentialsRef !== null ||
      (webhookHash && !equal(row.webhookTokenHash ?? '', webhookHash))
    )
      throw new SecretImportError('SECRET_IMPORT_EXISTING_SECRET_CONFLICT')
    for (const desired of secrets) {
      const active = row.secrets.filter(
        (s) => s.purpose === desired.purpose && s.state === 'ACTIVE'
      )
      if (
        active.length !== 1 ||
        active[0]!.environment !== row.environment ||
        active[0]!.expiresAt !== null ||
        !equal(active[0]!.fingerprint, desired.fingerprint)
      )
        throw new SecretImportError('SECRET_IMPORT_EXISTING_SECRET_CONFLICT')
    }
  }
  function report(plan: Awaited<ReturnType<typeof load>>) {
    return {
      integrationId: plan.row.id,
      tenantId: plan.row.tenantId,
      provider: plan.row.provider,
      action: plan.action,
      planHash: plan.hash,
      fingerprints: plan.secrets.map((s) => ({
        purpose: s.purpose,
        fingerprint: s.fingerprint.slice(0, 12),
      })),
    }
  }
  async function safe<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof SecretImportError) throw error
      throw new SecretImportError('SECRET_IMPORT_UNAVAILABLE')
    }
  }
  return {
    plan: (input: SecretImportInput) =>
      safe(() => options.read(async (tx) => report(await load(tx, input)))),
    apply: (input: SecretImportInput, confirmation: string) =>
      safe(async () => {
        if (!/^[a-f0-9]{64}$/.test(confirmation))
          throw new SecretImportError('SECRET_IMPORT_CONFIRMATION_INVALID')
        // Wrong/stale confirmations never instantiate a provider or perform a write.
        const preview = await options.read((tx) => load(tx, input))
        if (!equal(preview.hash, confirmation))
          throw new SecretImportError('SECRET_IMPORT_PLAN_CHANGED')
        const configured = await options.configuredVault()
        try {
          return await options.write(async (tx) => {
            await tx.$queryRaw`SELECT id FROM tenant_integrations WHERE id=${input.integrationId} FOR UPDATE`
            const current = await load(tx, input)
            if (!equal(current.hash, confirmation))
              throw new SecretImportError('SECRET_IMPORT_PLAN_CHANGED')
            for (const secret of current.secrets) {
              const ref = {
                tenantId: current.row.tenantId,
                integrationId: current.row.id,
                environment: current.row.environment,
                purpose: secret.purpose,
              }
              if (current.action === 'IMPORT') {
                const stored = await configured.vault.store(
                  tx,
                  ref,
                  secret.value
                )
                await configured.vault.activate(tx, stored.id)
              }
              const restored = await configured.vault.reveal(tx, ref)
              if (
                !equal(
                  secretFingerprint(restored, fingerprintKey),
                  secret.fingerprint
                )
              )
                throw new SecretImportError(
                  'SECRET_IMPORT_FINGERPRINT_MISMATCH'
                )
            }
            if (current.action === 'IMPORT') {
              await tx.tenantIntegration.update({
                where: { id: current.row.id },
                data: {
                  credentialSource: 'VAULT',
                  credentialsRef: null,
                  ...(current.webhookHash
                    ? { webhookTokenHash: current.webhookHash }
                    : {}),
                },
              })
              await tx.$queryRaw`SELECT public.audit_integration_secret_import(${current.row.id},${current.hash})`
              await tx.platformAuditLog.create({
                data: {
                  actorKind: 'SYSTEM',
                  action: 'integration.secrets.imported',
                  tenantId: current.row.tenantId,
                  targetType: 'TenantIntegration',
                  targetId: current.row.id,
                  metadata: { planHash: current.hash },
                },
              })
            }
            return report(current)
          })
        } finally {
          configured.dispose()
        }
      }),
    dispose: () => fingerprintKey.fill(0),
  }
}
