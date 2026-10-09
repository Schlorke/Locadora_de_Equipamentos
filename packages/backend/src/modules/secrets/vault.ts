import { createHmac } from 'node:crypto'
import { Prisma, type IntegrationSecret } from '@prisma/client'
import { SecretValue } from './secret-value'
import {
  SecretVaultError,
  type KeyEncryptionProvider,
  type SecretContext,
  type SecretReference,
  type SecretInput,
} from './contracts'
import {
  openSecret,
  sealSecret,
  secretAad,
  secretFingerprint,
  unwrapSecretDek,
} from './envelope'

type Transaction = Prisma.TransactionClient
function contextOf(row: IntegrationSecret): SecretContext {
  return {
    tenantId: row.tenantId,
    integrationId: row.integrationId,
    purpose: row.purpose,
    version: row.version,
    environment: row.environment,
  }
}
function envelopeOf(row: IntegrationSecret) {
  if (
    !row.wrappedDek ||
    !row.iv ||
    !row.ciphertext ||
    !row.authTag ||
    row.state === 'DESTROYED'
  )
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  return {
    ...row,
    wrappedDek: row.wrappedDek,
    iv: row.iv,
    ciphertext: row.ciphertext,
    authTag: row.authTag,
  }
}
async function guard(tx: Transaction, tenantId: string | null, write: boolean) {
  const rows = await tx.$queryRaw<
    { platform: boolean; tenant: string | null; safe: boolean }[]
  >`
    SELECT app_is_platform_context() AS platform, current_setting('app.tenant_id',true) AS tenant,
      current_user=session_user AND NOT (rolsuper OR rolbypassrls) AS safe
    FROM pg_roles WHERE rolname=current_user
  `
  const scope = rows[0]
  if (
    !scope?.safe ||
    !(scope.platform || (!write && tenantId && scope.tenant === tenantId))
  )
    throw new SecretVaultError('SECRET_UNAVAILABLE')
}
async function lock(tx: Transaction, integrationId: string, purpose: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`vault:${integrationId}:${purpose}`},0))`
}
/** Credential correlation only: no key material is selected or revealed. */
export async function readActiveAsaasKeyIdentity(
  tx: Transaction,
  ref: Omit<SecretReference, 'purpose'>,
  options: { lock?: boolean } = {}
) {
  secretAad({ ...ref, purpose: 'ASAAS_API_KEY', version: 1 })
  await guard(tx, ref.tenantId, false)
  if (options.lock) await lock(tx, ref.integrationId, 'ASAAS_API_KEY')
  return tx.integrationSecret.findFirst({
    where: {
      ...ref,
      purpose: 'ASAAS_API_KEY',
      state: 'ACTIVE',
      integration: {
        tenantId: ref.tenantId,
        provider: 'ASAAS',
        environment: ref.environment,
      },
    },
    select: { id: true, providerCredentialId: true, expiresAt: true },
  })
}
/**
 * Whether an integration ever held any credential, in any state (no material is selected). A cancelled creation
 * request leaves an integration without one: only that shell may be ignored by the receiving-account slot.
 */
export async function hasIntegrationSecrets(
  tx: Transaction,
  ref: { tenantId: string; integrationId: string }
) {
  await guard(tx, ref.tenantId, false)
  return (
    (await tx.integrationSecret.count({
      where: { tenantId: ref.tenantId, integrationId: ref.integrationId },
    })) > 0
  )
}
/**
 * Whether this keyed fingerprint is the ACTIVE Asaas key of the integration (count only). Lets a retried seal see
 * that a previous commit was applied and its acknowledgement lost, instead of failing on the unique fingerprint.
 */
export async function hasActiveFingerprint(
  tx: Transaction,
  ref: Omit<SecretReference, 'purpose'>,
  fingerprint: string
) {
  secretAad({ ...ref, purpose: 'ASAAS_API_KEY', version: 1 })
  if (!/^[a-f0-9]{64}$/.test(fingerprint))
    throw new SecretVaultError('SECRET_CONTEXT_INVALID')
  await guard(tx, ref.tenantId, false)
  return (
    (await tx.integrationSecret.count({
      where: {
        ...ref,
        purpose: 'ASAAS_API_KEY',
        state: 'ACTIVE',
        fingerprint,
      },
    })) > 0
  )
}
async function sanitized<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof SecretVaultError) throw error
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new SecretVaultError('SECRET_ALREADY_EXISTS')
    throw new SecretVaultError('SECRET_UNAVAILABLE')
  }
}

/** Caller owns the transaction: writes require platform scope; tenant runtime can only reveal its rows. */
export function createSecretVault(options: {
  current: KeyEncryptionProvider
  providers: readonly KeyEncryptionProvider[]
  fingerprintKey: Uint8Array
  now?: () => Date
}) {
  const providers = new Map(
    options.providers.map((provider) => [provider.name, provider])
  )
  if (
    options.fingerprintKey.length < 32 ||
    providers.size !== options.providers.length ||
    providers.get(options.current.name) !== options.current
  )
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  const fingerprintKey = Buffer.from(options.fingerprintKey)
  const now = options.now ?? (() => new Date())
  async function record(tx: Transaction, id: string) {
    await guard(tx, null, true)
    const first = await tx.integrationSecret.findUnique({ where: { id } })
    if (!first) throw new SecretVaultError('SECRET_UNAVAILABLE')
    await lock(tx, first.integrationId, first.purpose)
    const row = await tx.integrationSecret.findUnique({ where: { id } })
    if (!row) throw new SecretVaultError('SECRET_UNAVAILABLE')
    return row
  }
  const vault = {
    /** Recoverable authentication, domain-separated from credential fingerprints. Only its SHA-256 is persisted. */
    webhookToken(ref: Omit<SecretReference, 'purpose'>, activeKeyId: string) {
      const aad = secretAad({ ...ref, purpose: 'ASAAS_API_KEY', version: 1 })
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(activeKeyId))
        throw new SecretVaultError('SECRET_CONTEXT_INVALID')
      return new SecretValue(
        createHmac('sha256', fingerprintKey)
          .update('locadora/asaas-webhook/v1\0')
          .update(aad)
          .update('\0')
          .update(activeKeyId)
          .digest('base64url')
      )
    },
    /** Keyed digest for retry comparison; never use an unkeyed hash of a credential. */
    fingerprint(value: SecretInput) {
      return secretFingerprint(value, fingerprintKey)
    },
    store(
      tx: Transaction,
      ref: SecretReference,
      value: SecretInput,
      meta: {
        providerCredentialId?: string
        expiresAt?: Date
        createdByUserId?: string
      } = {}
    ) {
      return sanitized(async () => {
        secretAad({ ...ref, version: 1 })
        const fingerprint = secretFingerprint(value, fingerprintKey)
        if (
          meta.providerCredentialId &&
          (!/^[A-Za-z0-9_-]{1,128}$/.test(meta.providerCredentialId) ||
            (typeof value === 'string' ? value : value.use((v) => v)) ===
              meta.providerCredentialId)
        )
          throw new SecretVaultError('SECRET_CONTEXT_INVALID')
        if (
          meta.expiresAt &&
          (!Number.isFinite(meta.expiresAt.getTime()) ||
            meta.expiresAt <= now())
        )
          throw new SecretVaultError('SECRET_CONTEXT_INVALID')
        if (
          meta.createdByUserId &&
          !/^[A-Za-z0-9_-]{1,128}$/.test(meta.createdByUserId)
        )
          throw new SecretVaultError('SECRET_CONTEXT_INVALID')
        await guard(tx, ref.tenantId, true)
        const integration = await tx.tenantIntegration.findFirst({
          where: { id: ref.integrationId, tenantId: ref.tenantId },
          select: { environment: true },
        })
        if (!integration || integration.environment !== ref.environment)
          throw new SecretVaultError('SECRET_CONTEXT_INVALID')
        await lock(tx, ref.integrationId, ref.purpose)
        const last = await tx.integrationSecret.aggregate({
          where: {
            tenantId: ref.tenantId,
            integrationId: ref.integrationId,
            purpose: ref.purpose,
          },
          _max: { version: true },
        })
        const version = (last._max.version ?? 0) + 1
        const sealed = await sealSecret(
          value,
          { ...ref, version },
          options.current
        )
        const row = await tx.integrationSecret.create({
          data: {
            ...ref,
            ...sealed,
            ...meta,
            wrappedDek: Buffer.from(sealed.wrappedDek),
            iv: Buffer.from(sealed.iv),
            ciphertext: Buffer.from(sealed.ciphertext),
            authTag: Buffer.from(sealed.authTag),
            version,
            fingerprint,
          },
          select: { id: true, version: true },
        })
        return row
      })
    },
    reveal(tx: Transaction, ref: SecretReference) {
      return sanitized(async () => {
        secretAad({ ...ref, version: 1 })
        await guard(tx, ref.tenantId, false)
        const row = await tx.integrationSecret.findFirst({
          where: {
            ...ref,
            state: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }],
            integration: {
              tenantId: ref.tenantId,
              environment: ref.environment,
              status: { not: 'DISABLED' },
            },
          },
        })
        if (!row) throw new SecretVaultError('SECRET_UNAVAILABLE')
        return openSecret(envelopeOf(row), contextOf(row), providers)
      })
    },
    activate(tx: Transaction, id: string) {
      return sanitized(async () => {
        const row = await record(tx, id)
        if (row.state === 'ACTIVE') return
        if (
          row.state !== 'PENDING' ||
          (row.expiresAt && row.expiresAt <= now())
        )
          throw new SecretVaultError('SECRET_STATE_INVALID')
        // Authentication must succeed before any old active version is displaced.
        await openSecret(envelopeOf(row), contextOf(row), providers)
        const at = now()
        await tx.integrationSecret.updateMany({
          where: {
            integrationId: row.integrationId,
            purpose: row.purpose,
            state: 'ACTIVE',
          },
          data: { state: 'PREVIOUS', retiredAt: at },
        })
        await tx.integrationSecret.update({
          where: { id },
          data: { state: 'ACTIVE', activatedAt: at },
        })
      })
    },
    revealSigningSecrets(
      tx: Transaction,
      ref: Omit<SecretReference, 'purpose'>
    ) {
      return sanitized(async () => {
        const context = { ...ref, purpose: 'PROVIDER_SIGNING_SECRET' as const }
        const at = now()
        secretAad({ ...context, version: 1 })
        await guard(tx, ref.tenantId, false)
        const where = {
          ...context,
          OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
          integration: {
            tenantId: ref.tenantId,
            environment: ref.environment,
            status: { not: 'DISABLED' as const },
          },
        }
        const active = await tx.integrationSecret.findFirst({
          where: { ...where, state: 'ACTIVE' },
        })
        if (!active) throw new SecretVaultError('SECRET_UNAVAILABLE')
        const values = [
          await openSecret(envelopeOf(active), contextOf(active), providers),
        ]
        // One predecessor only, valid for at most 24h; API keys never use this read path.
        const previous = await tx.integrationSecret.findFirst({
          where: {
            ...context,
            integration: where.integration,
            activatedAt: { not: null },
            state: { in: ['PREVIOUS', 'RETIRED', 'DESTROYED'] },
          },
          orderBy: [{ retiredAt: 'desc' }, { version: 'desc' }],
        })
        // Do not fall back to older history when the immediate predecessor is expired or retired.
        if (
          previous?.state === 'PREVIOUS' &&
          previous.retiredAt &&
          previous.retiredAt.getTime() > at.getTime() - 24 * 60 * 60 * 1000 &&
          previous.retiredAt.getTime() <= at.getTime() &&
          (!previous.expiresAt || previous.expiresAt.getTime() > at.getTime())
        )
          values.push(
            await openSecret(
              envelopeOf(previous),
              contextOf(previous),
              providers
            )
          )
        return values
      })
    },
    retire(tx: Transaction, id: string) {
      return sanitized(async () => {
        const row = await record(tx, id)
        if (row.state === 'RETIRED') return
        if (row.state === 'DESTROYED')
          throw new SecretVaultError('SECRET_STATE_INVALID')
        await tx.integrationSecret.update({
          where: { id },
          data: { state: 'RETIRED', retiredAt: now() },
        })
      })
    },
    destroy(tx: Transaction, id: string) {
      return sanitized(async () => {
        const row = await record(tx, id)
        if (row.state === 'DESTROYED') return
        if (row.state === 'ACTIVE')
          throw new SecretVaultError('SECRET_STATE_INVALID')
        await tx.integrationSecret.update({
          where: { id },
          data: {
            state: 'DESTROYED',
            destroyedAt: now(),
            wrappedDek: null,
            iv: null,
            ciphertext: null,
            authTag: null,
          },
        })
      })
    },
    rewrap(tx: Transaction, id: string) {
      return sanitized(async () => {
        const row = await record(tx, id)
        if (
          row.state === 'DESTROYED' ||
          (row.kekProvider === options.current.name &&
            row.kekId === options.current.currentKekId())
        )
          return false
        const dek = await unwrapSecretDek(
          envelopeOf(row),
          contextOf(row),
          providers
        )
        try {
          const wrapped = await options.current.wrap(
            dek,
            secretAad(contextOf(row))
          )
          if (!wrapped.kekId || !wrapped.wrapped.length)
            throw new SecretVaultError('SECRET_UNAVAILABLE')
          await tx.integrationSecret.update({
            where: { id },
            data: {
              kekProvider: options.current.name,
              kekId: wrapped.kekId,
              wrappedDek: Buffer.from(wrapped.wrapped),
            },
          })
          return true
        } finally {
          dek.fill(0)
        }
      })
    },
    rewrapBatch(tx: Transaction, take = 5) {
      return sanitized(async () => {
        if (!Number.isSafeInteger(take) || take < 1 || take > 25)
          throw new SecretVaultError('SECRET_CONTEXT_INVALID')
        await guard(tx, null, true)
        return tx.integrationSecret.findMany({
          where: {
            state: { not: 'DESTROYED' },
            OR: [
              { kekProvider: { not: options.current.name } },
              { kekId: { not: options.current.currentKekId() } },
            ],
          },
          orderBy: { id: 'asc' },
          take,
          select: { id: true },
        })
      })
    },
  }
  return vault
}
