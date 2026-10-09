import { timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import {
  ConnectAsaasAccountInputSchema,
  type ConnectAsaasAccountResponse,
} from '@gb-locacoes/contracts/payment-account'
import { normalizarCnpj, validarCnpj } from '@gb-locacoes/domain/documento'
import type { TenantPrincipal } from '../identity/index'
import type { PlatformScope } from '../platform-scope/index'
import {
  AsaasSecretValue,
  type AsaasConnectedAccount,
  type AsaasEnvironment,
} from '../billing/index'
import { SecretVaultError, type createSecretVault } from '../secrets/index'
import {
  authorizeReceivingOwner,
  blockingReceivingIntegration,
} from './owner-authorization'

export class OwnerPaymentAccountConnectError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 409,
    readonly code: string
  ) {
    super(code)
  }
}
export type OwnerPaymentAccountConnectPorts = {
  transaction: PlatformScope['withProvisioningTransaction']
  vault: Pick<
    ReturnType<typeof createSecretVault>,
    'store' | 'activate' | 'fingerprint'
  >
  environment: AsaasEnvironment
  read: (_key: AsaasSecretValue) => Promise<AsaasConnectedAccount>
  now?: () => Date
}

/** Validate before provider I/O and again under the organization lock before storing anything. */
export function createOwnerPaymentAccountConnection(
  ports: OwnerPaymentAccountConnectPorts
) {
  const now = ports.now ?? (() => new Date())
  async function authorize(
    tx: Prisma.TransactionClient,
    principal: TenantPrincipal,
    authenticatedAt: number
  ) {
    const auth = await authorizeReceivingOwner(tx, principal, {
      write: true,
      authenticatedAt,
      now: now(),
      fail: (status, code) => new OwnerPaymentAccountConnectError(status, code),
    })
    if (!auth.emailVerified)
      throw new OwnerPaymentAccountConnectError(403, 'EMAIL_NOT_VERIFIED')
    if (!auth.document)
      throw new OwnerPaymentAccountConnectError(409, 'INVALID_CNPJ')
    return auth.document
  }
  async function existing(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fingerprint: string
  ) {
    const account = await tx.paymentAccount.findFirst({
      where: { tenantId, disconnectedAt: null },
      include: {
        integration: {
          include: {
            secrets: {
              where: { purpose: 'ASAAS_API_KEY', state: 'ACTIVE' },
              select: { fingerprint: true },
            },
          },
        },
      },
    })
    if (account) {
      const digest = account.integration.secrets[0]?.fingerprint
      if (
        account.mode === 'ASAAS_CONNECTED_ACCOUNT' &&
        account.environment === ports.environment &&
        account.integration.provider === 'ASAAS' &&
        account.integration.credentialSource === 'VAULT' &&
        account.integration.environment === ports.environment &&
        account.integration.status !== 'DISABLED' &&
        !['BLOCKED', 'DISCONNECTED'].includes(account.status) &&
        digest &&
        digest.length === fingerprint.length &&
        timingSafeEqual(Buffer.from(digest), Buffer.from(fingerprint))
      )
        return true
      throw new OwnerPaymentAccountConnectError(
        409,
        'PAYMENT_ACCOUNT_ALREADY_EXISTS'
      )
    }
    // A shell left by a cancelled creation request (DISABLED, no secret, no provider reference) does not block.
    if (await blockingReceivingIntegration(tx, tenantId, null))
      throw new OwnerPaymentAccountConnectError(
        409,
        'PAYMENT_INTEGRATION_ALREADY_EXISTS'
      )
    return false
  }
  return async (
    principal: TenantPrincipal,
    input: { apiKey: string; authenticatedAt: number }
  ): Promise<ConnectAsaasAccountResponse> => {
    const parsed = ConnectAsaasAccountInputSchema.safeParse({
      apiKey: input.apiKey,
    })
    if (!parsed.success)
      throw new OwnerPaymentAccountConnectError(400, 'INVALID_API_KEY')
    if (ports.environment !== 'sandbox' && ports.environment !== 'production')
      throw new Error('PAYMENT_ACCOUNT_CONFIGURATION_INVALID')
    if (
      (input.apiKey.startsWith('$aact_prod_') &&
        ports.environment !== 'production') ||
      (input.apiKey.startsWith('$aact_hmlg_') &&
        ports.environment !== 'sandbox')
    )
      throw new OwnerPaymentAccountConnectError(
        400,
        'CREDENTIAL_ENVIRONMENT_CONFLICT'
      )
    const secret = new AsaasSecretValue(parsed.data.apiKey)
    const fingerprint = ports.vault.fingerprint(secret)
    const before = await ports.transaction(principal.tenantId, async (tx) => ({
      document: await authorize(tx, principal, input.authenticatedAt),
      replay: await existing(tx, principal.tenantId, fingerprint),
    }))
    if (before.replay) return { accepted: true as const }
    // There is no open SQL transaction or organization lock during the provider calls.
    const facts = await ports.read(secret)
    if (
      !validarCnpj(facts.document) ||
      normalizarCnpj(facts.document) !== before.document
    )
      throw new OwnerPaymentAccountConnectError(
        409,
        'ACCOUNT_DOCUMENT_MISMATCH'
      )
    try {
      return await ports.transaction(principal.tenantId, async (tx) => {
        if (
          (await authorize(tx, principal, input.authenticatedAt)) !==
          before.document
        )
          throw new OwnerPaymentAccountConnectError(409, 'COMPANY_DATA_CHANGED')
        if (await existing(tx, principal.tenantId, fingerprint))
          return { accepted: true as const }
        const integration = await tx.tenantIntegration.create({
          data: {
            tenantId: principal.tenantId,
            provider: 'ASAAS',
            environment: ports.environment,
            credentialSource: 'VAULT',
            status: 'PROVISIONING',
          },
        })
        const stored = await ports.vault.store(
          tx,
          {
            tenantId: principal.tenantId,
            integrationId: integration.id,
            purpose: 'ASAAS_API_KEY',
            environment: ports.environment,
          },
          secret,
          { createdByUserId: principal.userId }
        )
        await ports.vault.activate(tx, stored.id)
        const at = now()
        const account = await tx.paymentAccount.create({
          data: {
            tenantId: principal.tenantId,
            integrationId: integration.id,
            mode: 'ASAAS_CONNECTED_ACCOUNT',
            environment: ports.environment,
            status: 'RESTRICTED',
            healthIssue: 'WEBHOOK_MISSING',
            requestedByUserId: principal.userId,
            lastKeyUseAt: at,
            lastSyncedAt: at,
            commercialInfoStatus: facts.status.commercialInfo,
            bankAccountInfoStatus: facts.status.bankAccountInfo,
            documentationStatus: facts.status.documentation,
            generalStatus: facts.status.general,
          },
        })
        // status.id identifies a status record; it is NOT the provider's account id.
        await tx.platformAuditLog.create({
          data: {
            actorKind: 'OWNER',
            actorUserId: principal.userId,
            tenantId: principal.tenantId,
            action: 'payment-account.connected',
            targetType: 'PaymentAccount',
            targetId: account.id,
            reasonCategory: 'WEBHOOK_CONFIGURATION_REQUIRED',
            createdAt: at,
          },
        })
        return { accepted: true as const }
      })
    } catch (error) {
      if (
        (error instanceof SecretVaultError &&
          error.code === 'SECRET_ALREADY_EXISTS') ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      )
        throw new OwnerPaymentAccountConnectError(
          409,
          'PAYMENT_ACCOUNT_ALREADY_EXISTS'
        )
      throw error
    }
  }
}
