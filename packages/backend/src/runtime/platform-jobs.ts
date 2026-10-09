import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { createOwnerPaymentAccountHandler } from '../http/owner-payment-account'
import { createOwnerPaymentAccountConnectHandler } from '../http/owner-payment-account-connect'
import { createOwnerAccountRecoveryHandler } from '../http/owner-payment-account-recovery'
import { createOwnerPaymentAccountCreateHandler } from '../http/owner-payment-account-create'
import { createOwnerAccountRecovery } from '../modules/payment-accounts/index'
import type { CreateOrganizationInput } from '@gb-locacoes/contracts/onboarding'
import {
  createOrganizationProvisioning,
  readSignupSlugAvailability,
  createOnboardingSlugLimit,
  createOnboardingWelcome,
  type ProvisioningActor,
} from '../modules/onboarding/index'
import {
  readAssistedOnboardingConfiguration,
  assertSelfServiceOnboardingConfiguration,
} from './onboarding'
import { verifyOnboardingCaptcha } from './onboarding-captcha'
import { createOnboardingHttpHandlers } from '../http/onboarding'
import {
  canonicalOrigin,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { createPlatformMailer } from './mail'
import { createPublicPlansHandler } from '../http/public-plans'
import { createOwnerSubscriptionActionHandler } from '../http/owner-cancellation'
import { createSitePublicationHandler } from '../http/site-publication'
import {
  withTenantTransaction,
  type TenantPrincipal,
} from '../modules/identity/index'
import { getDatabaseRuntime } from './database'
import { createPlatformScope } from '../modules/platform-scope/index'
import {
  createPlatformJobs,
  createPlatformMaintenance,
} from '../modules/platform-jobs/index'
import {
  getPlatformDatabaseRuntime,
  createPlatformDatabaseRuntime,
} from './platform-database'
import type { ScheduledJobResult } from './scheduled-job'
import type { AsaasHttpClientConfig } from '../modules/billing/asaas-http'
import {
  createAccountWebhookConsumer,
  createOwnerPaymentAccountConnection,
  createOwnerSubaccountRequest,
  createConnectedAccountConfiguration,
  createProvisioningRequestsMaintenance,
  createSubaccountProvisioning,
  createUncertainSubaccountRecovery,
} from '../modules/payment-accounts/index'
import {
  readSubaccountCreationConfiguration,
  subaccountMaintenanceSwitch,
} from './subaccount-creation'
import {
  readAsaasAccountHealth,
  readAsaasConnectedAccount,
  readAsaasPlatformInvoice,
  readAsaasSubscriptionSnapshot,
  readAsaasPlatformSubscription,
  setAsaasPlatformSubscriptionInactive,
  deleteAsaasPlatformInvoice,
  AsaasSecretValue,
  createAsaasPlatformIssuance,
  createAsaasAccountWebhooks,
  createAsaasSubaccounts,
  createAccountPaymentReconciliation,
  readAsaasPayment,
} from '../modules/billing/index'
import {
  createSubscriptionInvoiceConsumer,
  createSubscriptionJobs,
  createSubscriptionEventConsumer,
  createSubscriptionNotices,
  createSubscriptionIssuance,
  createPublicPlanCatalog,
} from '../modules/subscriptions/index'
import {
  createIntegrationCredentialResolver,
  integrationCredentialReference,
} from './integration-credentials'
import {
  createSecretsRewrap,
  createSecretImporter,
  SecretImportError,
  type SecretImportInput,
} from '../modules/secrets/index'
import { createConfiguredSecrets, secretsConfigured } from './secrets'
import {
  createPlatformAsaasIngress,
  createPlatformAsaasRecovery,
  type PlatformAsaasReceipt,
} from '../modules/platform-webhooks/index'

const receivingReadPorts = {
  withTenantTransaction: <T>(
    context: { tenantId: string },
    operation: (_tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<T> =>
    withTenantTransaction(
      getDatabaseRuntime().prisma,
      context,
      operation,
      options
    ),
}

/** Existing business role, tenant RLS and READ ONLY; no provider call or decryption. */
export function handleConfiguredPaymentAccount(
  request: Request,
  principal: TenantPrincipal
) {
  return createOwnerPaymentAccountHandler({
    ...receivingReadPorts,
    environment: () => process.env,
  })(request, principal)
}

/** Owner recovery reads platform receipts and requests the existing scheduler; no provider I/O or approval. */
export function handleConfiguredPaymentAccountRecovery(
  request: Request,
  principal: TenantPrincipal,
  getSession: Parameters<
    typeof createOwnerAccountRecoveryHandler
  >[0]['getSession']
) {
  const environment = process.env.PLATFORM_ASAAS_ENVIRONMENT
  if (environment !== 'sandbox' && environment !== 'production')
    throw new Error('PAYMENT_ACCOUNT_CONFIGURATION_INVALID')
  const recovery = createOwnerAccountRecovery({
    environment,
    readTransaction: (tenantId, operation) =>
      createPlatformScope(getPlatformDatabaseRuntime().prisma, {
        readOnly: true,
      }).withProvisioningTransaction(tenantId, operation),
    transaction: (tenantId, operation) =>
      createPlatformScope(
        getPlatformDatabaseRuntime().prisma
      ).withProvisioningTransaction(tenantId, operation),
  })
  return createOwnerAccountRecoveryHandler({
    environment: () => process.env,
    getSession,
    recovery: {
      read: recovery.read,
      request: async (actor, authenticatedAt) => {
        // Do not accept a request whose existing scheduler has no configured account-health consumer.
        if (
          !process.env.PLATFORM_WEBHOOK_ORIGIN ||
          !process.env.PLATFORM_OPS_EMAIL ||
          !secretsConfigured(process.env)
        )
          throw new Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
        const secrets = await createConfiguredSecrets(process.env)
        try {
          createConnectedAccountConfiguration({
            transaction: (operation) =>
              createPlatformScope(
                getPlatformDatabaseRuntime().prisma
              ).withPlatformTransaction(operation),
            environment,
            origin: process.env.PLATFORM_WEBHOOK_ORIGIN!,
            email: process.env.PLATFORM_OPS_EMAIL!,
            token: (ref, keyId) => secrets.vault.webhookToken(ref, keyId),
            provider: async () => {
              throw new Error('REQUEST_NEVER_CALLS_PROVIDER')
            },
          })
          return await recovery.request(actor, authenticatedAt)
        } finally {
          secrets.dispose()
        }
      },
    },
  })(request, principal)
}

/** Store only under the isolated platform role after read-only provider proof and current owner checks. */
export function handleConfiguredPaymentAccountConnection(
  request: Request,
  principal: TenantPrincipal,
  getSession: Parameters<
    typeof createOwnerPaymentAccountConnectHandler
  >[0]['getSession']
) {
  return createOwnerPaymentAccountConnectHandler({
    environment: () => process.env,
    getSession,
    connect: async (actor, input) => {
      const environment = process.env.PLATFORM_ASAAS_ENVIRONMENT
      if (environment !== 'sandbox' && environment !== 'production')
        throw new Error('PAYMENT_ACCOUNT_CONFIGURATION_INVALID')
      const secrets = await createConfiguredSecrets(process.env)
      try {
        return await createOwnerPaymentAccountConnection({
          transaction: (tenantId, operation) =>
            createPlatformScope(
              getPlatformDatabaseRuntime().prisma
            ).withProvisioningTransaction(tenantId, operation),
          vault: secrets.vault,
          environment,
          read: (credential) =>
            readAsaasConnectedAccount({ credential, environment }),
        })(actor, input)
      } finally {
        secrets.dispose()
      }
    },
  })(request, principal)
}

/**
 * Owner request of the receiving account (ADR SaaS B.7.2): READ ONLY offer and one atomic request under the
 * isolated platform role, without provider I/O. Unavailable while `PLATFORM_SUBACCOUNT_CREATION` is not `on`.
 */
export function handleConfiguredPaymentAccountCreation(
  request: Request,
  principal: TenantPrincipal,
  getSession: Parameters<
    typeof createOwnerPaymentAccountCreateHandler
  >[0]['getSession']
) {
  return createOwnerPaymentAccountCreateHandler({
    environment: () => process.env,
    getSession,
    creation: createOwnerSubaccountRequest({
      readTransaction: (tenantId, operation) =>
        createPlatformScope(getPlatformDatabaseRuntime().prisma, {
          readOnly: true,
        }).withProvisioningTransaction(tenantId, operation),
      transaction: (tenantId, operation) =>
        createPlatformScope(
          getPlatformDatabaseRuntime().prisma
        ).withProvisioningTransaction(tenantId, operation),
      // The request never holds the root credential: only the settings it needs.
      configuration: () => {
        const config = readSubaccountCreationConfiguration(process.env).config
        return config
          ? {
              environment: config.environment,
              model: config.model,
              requiresPaid: config.requiresPaid,
              site: config.site,
            }
          : null
      },
      enforcement: () => process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT,
    }),
  })(request, principal)
}

/** Owner commands reuse the sole isolated platform composition, without provider I/O in the request. */
export function handleConfiguredSitePublication(
  request: Request,
  principal: TenantPrincipal
) {
  return createSitePublicationHandler({
    transaction: (tenantId, operation) =>
      createPlatformScope(
        getPlatformDatabaseRuntime().prisma
      ).withProvisioningTransaction(tenantId, operation),
    withTenantTransaction: (context, operation) =>
      withTenantTransaction(getDatabaseRuntime().prisma, context, operation),
    environment: () => process.env,
  })(request, principal)
}

/** Owner commands reuse the sole isolated platform composition, without provider I/O in the request. */
export function handleConfiguredOwnerCancellation(
  request: Request,
  principal: TenantPrincipal,
  action: 'cancel' | 'undo-cancel',
  getSession: Parameters<
    typeof createOwnerSubscriptionActionHandler
  >[0]['getSession']
) {
  return createOwnerSubscriptionActionHandler({
    getSession,
    transaction: (tenantId, operation) =>
      createPlatformScope(
        getPlatformDatabaseRuntime().prisma
      ).withProvisioningTransaction(tenantId, operation),
  })(request, principal, action)
}

export function handleConfiguredOwnerActivation(
  request: Request,
  principal: TenantPrincipal,
  getSession: Parameters<
    typeof createOwnerSubscriptionActionHandler
  >[0]['getSession']
) {
  return handleConfiguredOwnerBillingAction(
    request,
    principal,
    'activate',
    getSession
  )
}

export function handleConfiguredOwnerReactivation(
  request: Request,
  principal: TenantPrincipal,
  getSession: Parameters<
    typeof createOwnerSubscriptionActionHandler
  >[0]['getSession']
) {
  return handleConfiguredOwnerBillingAction(
    request,
    principal,
    'reactivate',
    getSession
  )
}

function handleConfiguredOwnerBillingAction(
  request: Request,
  principal: TenantPrincipal,
  action: 'activate' | 'reactivate',
  getSession: Parameters<
    typeof createOwnerSubscriptionActionHandler
  >[0]['getSession']
) {
  const environment = process.env.PLATFORM_ASAAS_ENVIRONMENT
  return createOwnerSubscriptionActionHandler({
    getSession,
    environment:
      environment === 'sandbox' || environment === 'production'
        ? environment
        : undefined,
    transaction: (tenantId, operation) =>
      createPlatformScope(
        getPlatformDatabaseRuntime().prisma
      ).withProvisioningTransaction(tenantId, operation),
  })(request, principal, action)
}

/** Public reads use the same isolated composition, always in a READ ONLY transaction. */
export async function readConfiguredPublicPlans(): Promise<Response> {
  return createPublicPlansHandler(async () => {
    const { prisma } = getPlatformDatabaseRuntime()
    const { withPlatformTransaction } = createPlatformScope(prisma, {
      readOnly: true,
    })
    return createPublicPlanCatalog({ transaction: withPlatformTransaction })()
  })()
}

/** An inbound notification is acknowledged only after the isolated platform transaction commits. */
export async function acceptConfiguredPlatformAsaasReceipt(
  input: PlatformAsaasReceipt
): Promise<Response> {
  try {
    const { prisma } = getPlatformDatabaseRuntime()
    const receive = createPlatformAsaasIngress({
      transaction: createPlatformScope(prisma).withPlatformTransaction,
      environment: process.env.PLATFORM_ASAAS_ENVIRONMENT ?? '',
    })
    return Response.json(await receive(input), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return Response.json(
      { error: 'Webhook persistence unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}

/** Two hosts use this composition. Business consumers are installed by their SaaS lots. */
export async function runConfiguredPlatformJobs(): Promise<ScheduledJobResult> {
  let secrets: Awaited<ReturnType<typeof createConfiguredSecrets>> | undefined
  try {
    const { prisma } = getPlatformDatabaseRuntime()
    const scope = createPlatformScope(prisma)
    const maintenance = createPlatformMaintenance(scope, new Date())
    await maintenance.enqueue()
    if (secretsConfigured(process.env))
      secrets = await createConfiguredSecrets(process.env)
    const rewrap = secrets
      ? createSecretsRewrap(scope, secrets.vault, new Date())
      : undefined
    if (rewrap) await rewrap.enqueue()
    const resolveCredential = createIntegrationCredentialResolver()
    const accounts = createAccountWebhookConsumer({
      transaction: scope.withPlatformTransaction,
      read: async ({ account, integration }) => {
        const credential = await scope.withPlatformTransaction((tx) =>
          resolveCredential(integrationCredentialReference(integration, tx))
        )
        if (
          !credential?.apiKey ||
          credential.environment !== account.environment ||
          !['sandbox', 'production'].includes(account.environment)
        )
          throw new Error('ACCOUNT_CREDENTIAL_UNAVAILABLE')
        return readAsaasAccountHealth({
          credential: credential.apiKey,
          environment: account.environment as 'sandbox' | 'production',
          subaccount: account.mode === 'ASAAS_SUBACCOUNT',
        })
      },
    })
    await accounts.enqueue()
    const accountEnvironment = process.env.PLATFORM_ASAAS_ENVIRONMENT
    const webhookOrigin = process.env.PLATFORM_WEBHOOK_ORIGIN?.trim()
    const opsEmail = process.env.PLATFORM_OPS_EMAIL?.trim()
    const configuration =
      secrets &&
      webhookOrigin &&
      opsEmail &&
      (accountEnvironment === 'sandbox' || accountEnvironment === 'production')
        ? createConnectedAccountConfiguration({
            transaction: scope.withPlatformTransaction,
            environment: accountEnvironment,
            origin: webhookOrigin,
            email: opsEmail,
            token: (ref, keyId) => secrets!.vault.webhookToken(ref, keyId),
            provider: async ({ account, ref }) => {
              const credential = await scope.withPlatformTransaction((tx) =>
                secrets!.vault.reveal(tx, { ...ref, purpose: 'ASAAS_API_KEY' })
              )
              const config = {
                credential,
                environment: account.environment as 'sandbox' | 'production',
              }
              return {
                identity: () => readAsaasConnectedAccount(config),
                webhooks: createAsaasAccountWebhooks(config),
                // Payment reconciliation exists only for the connected account; an interrupted subaccount queue
                // stays restricted (ADR SaaS B.7.4).
                ...(account.mode === 'ASAAS_CONNECTED_ACCOUNT'
                  ? {
                      reconcilePayments: createAccountPaymentReconciliation({
                        withTenantTransaction:
                          receivingReadPorts.withTenantTransaction,
                        readPayment: (id) =>
                          readAsaasPayment(id, {
                            apiKey: credential,
                            environment: config.environment,
                            reconciliation: true,
                          }),
                      }),
                    }
                  : {}),
              }
            },
          })
        : undefined
    if (configuration) await configuration.enqueue()
    // Missing root configuration leaves commercial jobs pending; there is no tenant-key fallback.
    const rootEnvironment = process.env.PLATFORM_ASAAS_ENVIRONMENT
    const rootKey = process.env.PLATFORM_ASAAS_ROOT_API_KEY
    const subscriptions =
      rootKey?.trim() &&
      (rootEnvironment === 'sandbox' || rootEnvironment === 'production')
        ? createSubscriptionInvoiceConsumer({
            transaction: scope.withPlatformTransaction,
            environment: rootEnvironment,
            read: ({ paymentId }) =>
              readAsaasPlatformInvoice(paymentId, {
                credential: new AsaasSecretValue(rootKey),
                environment: rootEnvironment,
              }),
          })
        : undefined
    if (subscriptions) await subscriptions.enqueue()
    const rootConfig: AsaasHttpClientConfig | null =
      rootKey?.trim() &&
      (rootEnvironment === 'sandbox' || rootEnvironment === 'production')
        ? {
            credential: new AsaasSecretValue(rootKey),
            environment: rootEnvironment,
          }
        : null
    const uncertainAccounts = rootConfig
      ? createUncertainSubaccountRecovery({
          transaction: scope.withPlatformTransaction,
          environment: rootConfig.environment,
          provider: createAsaasSubaccounts(rootConfig),
        })
      : undefined
    if (uncertainAccounts) await uncertainAccounts.enqueue()
    // Database-only safety net of the creation requests: always installed, with or without the root credential.
    const creation = readSubaccountCreationConfiguration(process.env)
    await createProvisioningRequestsMaintenance({
      transaction: scope.withPlatformTransaction,
      creation: subaccountMaintenanceSwitch(creation),
    }).run()
    const provisioning =
      creation.config && secrets
        ? createSubaccountProvisioning({
            transaction: scope.withPlatformTransaction,
            environment: creation.config.environment,
            model: creation.config.model,
            origin: creation.config.origin,
            email: creation.config.email,
            provider: createAsaasSubaccounts({
              credential: new AsaasSecretValue(creation.config.rootKey),
              environment: creation.config.environment,
            }),
            vault: secrets.vault,
            site: creation.config.site,
          })
        : undefined
    if (provisioning) await provisioning.enqueue()
    const subscriptionEvents = rootConfig
      ? createSubscriptionEventConsumer({
          transaction: scope.withPlatformTransaction,
          environment: rootConfig.environment,
        })
      : undefined
    if (rootConfig)
      await createPlatformAsaasRecovery(
        scope.withPlatformTransaction,
        rootConfig.environment
      )()
    if (subscriptionEvents) await subscriptionEvents.enqueue()
    const issuance = rootConfig
      ? createSubscriptionIssuance({
          transaction: scope.withPlatformTransaction,
          environment: rootConfig.environment,
          provider: createAsaasPlatformIssuance(rootConfig),
        })
      : undefined
    if (issuance) await issuance.enqueue()
    const subscriptionJobs = createSubscriptionJobs({
      transaction: scope.withPlatformTransaction,
      environment: rootConfig?.environment,
      provider: rootConfig
        ? {
            snapshot: (target) =>
              readAsaasSubscriptionSnapshot(target, rootConfig),
            subscription: (id) => readAsaasPlatformSubscription(id, rootConfig),
            inactive: (id) =>
              setAsaasPlatformSubscriptionInactive(id, rootConfig),
            invoice: (id) => readAsaasPlatformInvoice(id, rootConfig),
            cancelInvoice: (id) => deleteAsaasPlatformInvoice(id, rootConfig),
          }
        : undefined,
    })
    await subscriptionJobs.enqueue()
    let notices: ReturnType<typeof createSubscriptionNotices> | undefined
    const mailKey = process.env.RESEND_API_KEY?.trim()
    const mailFrom = process.env.FROM_EMAIL?.trim()
    let welcome: ReturnType<typeof createOnboardingWelcome> | undefined
    if (mailKey && mailFrom && !/[\r\n]/.test(mailFrom)) {
      try {
        const platform = resolvePlatformEnv(process.env)
        welcome = createOnboardingWelcome({
          transaction: scope.withPlatformTransaction,
          panelUrl: canonicalOrigin(platform, 'app') + '/admin',
          from: mailFrom,
          send: createPlatformMailer(mailKey),
        })
      } catch {
        /* Incomplete mail/host configuration leaves welcome events PENDING. */
      }
    }
    if (
      mailKey &&
      mailFrom &&
      !/[\r\n]/.test(mailFrom) &&
      (rootEnvironment === 'sandbox' || rootEnvironment === 'production')
    ) {
      try {
        const platform = resolvePlatformEnv(process.env)
        notices = createSubscriptionNotices({
          transaction: scope.withPlatformTransaction,
          environment: rootEnvironment,
          panelUrl: canonicalOrigin(platform, 'app') + '/admin',
          from: mailFrom,
          send: createPlatformMailer(mailKey),
        })
      } catch {
        /* Incomplete mail/host configuration leaves commercial notices PENDING. */
      }
    }
    if (notices) await notices.enqueue()
    const dispatch = createPlatformJobs({
      scope,
      handlers: {
        ...maintenance.handlers,
        ...rewrap?.handlers,
        ...accounts.handlers,
        ...configuration?.handlers,
        ...uncertainAccounts?.handlers,
        ...provisioning?.handlers,
        ...subscriptions?.handlers,
        ...subscriptionEvents?.handlers,
        ...subscriptionJobs.handlers,
        ...issuance?.handlers,
        ...notices?.handlers,
        ...welcome?.handlers,
      },
      workerId: randomUUID,
    })
    return { status: 200, body: await dispatch() }
  } catch {
    // Configuration/driver errors can carry connection strings. Never return their text.
    return { status: 503, body: { error: 'Platform jobs unavailable' } }
  } finally {
    secrets?.dispose()
  }
}

/** Operator job: isolated owned pools, explicit env, no scheduler or implicit file loading. */
export async function runIntegrationSecretsImport(
  input: SecretImportInput,
  confirmation: string | undefined,
  env: Readonly<Record<string, string | undefined>>
) {
  const key = Buffer.from(env.PLATFORM_SECRET_FINGERPRINT_KEY ?? '', 'utf8')
  let runtime: ReturnType<typeof createPlatformDatabaseRuntime> | undefined
  let importer: ReturnType<typeof createSecretImporter> | undefined
  try {
    if (key.length < 32)
      throw new SecretImportError('SECRET_IMPORT_CONFIGURATION_INVALID')
    runtime = createPlatformDatabaseRuntime(env)
    importer = createSecretImporter({
      fingerprintKey: key,
      read: createPlatformScope(runtime.prisma, { readOnly: true })
        .withPlatformTransaction,
      write: createPlatformScope(runtime.prisma).withPlatformTransaction,
      configuredVault: () => createConfiguredSecrets(env),
    })
    key.fill(0)
    return confirmation === undefined
      ? await importer.plan(input)
      : await importer.apply(input, confirmation)
  } finally {
    key.fill(0)
    importer?.dispose()
    if (runtime) {
      try {
        await runtime.prisma.$disconnect()
      } finally {
        await runtime.pool.end()
      }
    }
  }
}

/** Assisted operator command. No signup flag, scheduler, provider call or business-pool fallback. */
/** Both HTTP hosts delegate here; storage/authorization stay lazy until parsing and guards pass. */
export async function handleConfiguredOnboarding(
  request: Request,
  userId: string,
  action: 'create' | 'slug'
) {
  const handlers = createOnboardingHttpHandlers({
    environment: () => process.env,
    checkSignup: () => assertSelfServiceOnboardingConfiguration(process.env),
    provision: async (owner, input, key, metadata, inbound, origin) => {
      const configuration = await readAssistedOnboardingConfiguration(
        process.env
      )
      const secrets = await createConfiguredSecrets(process.env)
      try {
        const scope = createPlatformScope(getPlatformDatabaseRuntime().prisma)
        return await createOrganizationProvisioning({
          ...configuration,
          scope,
          authorizeNewRequest: () =>
            verifyOnboardingCaptcha({
              secret: process.env.PLATFORM_CAPTCHA_SECRET_KEY ?? '',
              token: inbound.headers.get('X-Platform-Captcha'),
              hostname: new URL(origin).hostname,
              ip: metadata.ip,
              key,
              userId: owner,
            }),
        })({ userId: owner }, input, key, metadata)
      } finally {
        secrets.dispose()
      }
    },
    slugAvailability: async (slug, ip) => {
      const scope = createPlatformScope(getPlatformDatabaseRuntime().prisma)
      await createOnboardingSlugLimit({
        transaction: scope.withPlatformTransaction,
        secret: process.env.PLATFORM_RATE_LIMIT_SECRET ?? '',
      })(ip)
      return createPlatformScope(getPlatformDatabaseRuntime().prisma, {
        readOnly: true,
      }).withPlatformTransaction((tx) => readSignupSlugAvailability(tx, slug))
    },
  })
  return action === 'create'
    ? handlers.create(request, userId)
    : handlers.slug(request, userId)
}

export async function runAssistedOrganizationProvisioning(
  actor: Required<ProvisioningActor>,
  input: CreateOrganizationInput,
  key: string,
  env: Readonly<Record<string, string | undefined>> = process.env
) {
  const configuration = await readAssistedOnboardingConfiguration(env)
  const runtime = createPlatformDatabaseRuntime(env)
  try {
    const provision = createOrganizationProvisioning({
      ...configuration,
      scope: createPlatformScope(runtime.prisma),
    })
    return await provision(actor, input, key, { ip: null, userAgent: null })
  } finally {
    try {
      await runtime.prisma.$disconnect()
    } finally {
      await runtime.pool.end()
    }
  }
}
