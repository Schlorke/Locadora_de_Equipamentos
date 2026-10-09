import type { PrismaClient, Prisma } from '@prisma/client'
import {
  EntitlementsV1Schema,
  type EntitlementFeature,
} from '@gb-locacoes/contracts/entitlements'
import {
  OrganizationAccessSchema,
  SubscriptionEnforcementSchema,
  type RestrictedMutationCode,
} from '@gb-locacoes/contracts/subscription'
import {
  rentalClose,
  rentalReturn,
  paymentSettlement,
} from './obligation-mutations'
import { recursoNoPlano } from '@gb-locacoes/domain/assinatura'
import { readEffectiveRights } from './effective-rights'
import { isOngoingPayment } from './ongoing-payment'
import { deliveryCompletion } from './delivery-completion'
import {
  withTenantTransaction,
  type TenantPrincipal,
} from '../identity/tenant-principal'
import type { MutationRequest } from '../identity/same-origin-mutation'

/** Explicit operations on existing endpoints; no caller-supplied privilege header/query. */
async function subscriptionRequestOperation(request: MutationRequest) {
  if (!request.method || !request.url) return null
  let path: string
  try {
    path = new URL(request.url).pathname
  } catch {
    return null
  }
  const method = request.method.toUpperCase()
  const oauthWrite =
    method === 'GET' &&
    /^\/api\/admin\/zoho-mail\/oauth\/(?:authorize|callback)$/.test(path)
  const read = (method === 'GET' || method === 'HEAD') && !oauthWrite
  const exportData = read && path === '/api/admin/financial/export'
  const ownerRead =
    read &&
    ['/api/admin/subscription', '/api/admin/subscription/invoices'].includes(
      path
    )
  const ownerCancel =
    method === 'POST' &&
    [
      '/api/admin/subscription/cancel',
      '/api/admin/subscription/undo-cancel',
    ].includes(path)
  // ADR SaaS B.5: receiving setup (connect, or request the account and read its offer) is open in SETUP.
  const setup =
    (read &&
      [
        '/api/admin/payment-account',
        '/api/admin/payment-account/create',
      ].includes(path)) ||
    (method === 'POST' &&
      [
        '/api/admin/payment-account/connect',
        '/api/admin/payment-account/create',
      ].includes(path)) ||
    /^\/api\/admin\/(?:categories|equipments|equipment-units|settings)(?:\/|$)/.test(
      path
    )
  let restricted: RestrictedMutationCode | undefined
  if (ownerCancel) restricted = 'SUBSCRIPTION_CANCEL'
  const ownerActivate =
    method === 'POST' && path === '/api/admin/subscription/activate'
  if (ownerActivate) restricted = 'SUBSCRIPTION_PAY'
  const ownerReactivate =
    method === 'POST' && path === '/api/admin/subscription/reactivate'
  if (ownerReactivate) restricted = 'SUBSCRIPTION_REACTIVATE'
  const body = async () => {
    try {
      return await request.clone?.().json()
    } catch {
      return undefined
    }
  }
  if (path === '/api/user/profile' && (read || method === 'PUT'))
    restricted = 'OWN_PROFILE'
  // Decisão do dono D-D (onda 134): o texto legal segue no ar na pausa; a locadora pode corrigi-lo ou retirá-lo.
  else if (
    (method === 'PUT' || method === 'DELETE') &&
    /^\/api\/admin\/settings\/legal-documents\/(?:terms|privacy|return-policy)$/.test(
      path
    )
  )
    restricted = 'STOREFRONT_LEGAL_DOCUMENT'
  else if (
    method === 'PUT' &&
    /^\/api\/payments\/boleto\/[^/]+\/regenerate$/.test(path)
  )
    restricted = 'PAYMENT_REISSUE'
  else if (
    method === 'POST' &&
    /^\/api\/admin\/rentals\/[^/]+\/checkin$/.test(path) &&
    rentalReturn.safeParse(await body()).success
  )
    restricted = 'RENTAL_RETURN'
  else if (
    method === 'PATCH' &&
    /^\/api\/admin\/rentals\/[^/]+$/.test(path) &&
    rentalClose.safeParse(await body()).success
  )
    restricted = 'RENTAL_CLOSE'
  else if (
    method === 'PATCH' &&
    /^\/api\/admin\/logistics\/[^/]+$/.test(path) &&
    deliveryCompletion.safeParse(await body()).success
  )
    restricted = 'DELIVERY_COMPLETE'
  else if (
    method === 'PATCH' &&
    /^\/api\/admin\/financial\/entries\/[^/]+\/status$/.test(path) &&
    paymentSettlement.safeParse(await body()).success
  )
    restricted = 'PAYMENT_MANUAL_SETTLEMENT'
  const reconciliation =
    method === 'POST' && path === '/api/payments/boleto/verify'
  const newPayment =
    method === 'POST' &&
    ['/api/payments/pix', '/api/payments/boleto/generate'].includes(path)
  const paymentInput = newPayment ? await body() : undefined
  const payment =
    paymentInput && typeof paymentInput === 'object'
      ? (paymentInput as Record<string, unknown>)
      : undefined
  const rentalPaymentId =
    typeof payment?.rentalId === 'string' && payment.quoteId === undefined
      ? payment.rentalId
      : undefined
  let feature: EntitlementFeature | undefined
  if (!read && !restricted && !reconciliation) {
    if (/^\/api\/admin\/(?:logistics|vehicles|drivers)(?:\/|$)/.test(path))
      feature = 'logistics'
    else if (/^\/api\/admin\/maintenance(?:\/|$)/.test(path))
      feature = 'maintenance'
    else if (
      /^\/api\/admin\/whatsapp(?:\/|$)/.test(path) ||
      path === '/api/integrations/whatsapp/send'
    )
      feature = 'whatsapp'
    else if (/^\/api\/admin\/zoho-mail(?:\/|$)/.test(path))
      feature = 'emailInbox'
    else if (/^\/api\/admin\/google-merchant(?:\/|$)/.test(path))
      feature = 'merchantFeed'
    else if (path === '/api/contracts/sign') feature = 'contractSignature'
    else if (newPayment || /\/(?:generate|send)-boleto$/.test(path))
      feature = 'onlinePayments'
  }
  return {
    method,
    path,
    read,
    setup,
    restricted,
    exportData,
    ownerRead,
    ownerCancel,
    ownerActivate,
    ownerReactivate,
    reconciliation,
    newPayment,
    rentalPaymentId,
    feature,
  }
}

const refusal = (
  status: number,
  body: { error: string; code?: string; feature?: EntitlementFeature }
) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Host' },
  })
const unavailable = () =>
  refusal(503, { error: 'Não foi possível verificar o acesso da assinatura.' })
const restricted = () =>
  refusal(402, {
    error: 'Sua assinatura não permite esta operação neste momento.',
    code: 'SUBSCRIPTION_RESTRICTED',
  })
const archived = () =>
  refusal(403, {
    error: 'Esta locadora está arquivada.',
    code: 'TENANT_ARCHIVED',
  })

/** Request admission shared by both hosts. Effects of accepted jobs never pass here. */
export function createSubscriptionRequestAccess(dependencies: {
  getDatabase(): PrismaClient
  enforcement?: () => string | undefined
  shadow?: (_entry: { tenantId: string; code: string }) => void
}) {
  return async (
    request: MutationRequest,
    principal: TenantPrincipal
  ): Promise<{ principal: TenantPrincipal; response?: Response }> => {
    const setting = SubscriptionEnforcementSchema.safeParse(
      dependencies.enforcement?.() ??
        process.env.PLATFORM_SUBSCRIPTION_ENFORCEMENT ??
        'off'
    )
    if (!setting.success) return { principal, response: unavailable() }
    const mode = setting.data
    if (mode === 'off') return { principal }
    const operation = await subscriptionRequestOperation(request)
    let effectivePrincipal = principal
    const decide = async (tx: Prisma.TransactionClient) => {
      const org = await tx.organization.findUnique({
        where: { id: principal.tenantId },
        select: { access: true, ownerUserId: true, status: true },
      })
      if (!org || org.status !== 'ACTIVE')
        return refusal(403, { error: 'Organization access denied' })
      const access = OrganizationAccessSchema.safeParse(org.access)
      if (!access.success || !operation) return unavailable()
      const isOwner = org.ownerUserId === principal.userId
      effectivePrincipal = {
        ...principal,
        access: access.data,
        isOwner,
        actor: isOwner
          ? 'owner'
          : principal.role === 'CLIENT'
            ? 'client'
            : 'staff',
      }
      if (
        (operation.ownerRead ||
          operation.ownerCancel ||
          operation.ownerActivate ||
          operation.ownerReactivate) &&
        !isOwner
      )
        return refusal(403, {
          error: 'Esta operação é exclusiva do dono da locadora.',
          code: 'OWNER_REQUIRED',
        })
      if (access.data === 'ARCHIVED')
        return isOwner &&
          (operation.exportData ||
            operation.ownerRead ||
            operation.ownerReactivate)
          ? undefined
          : archived()
      if (operation.exportData && !isOwner)
        return refusal(403, {
          error: 'Esta operação é exclusiva do dono da locadora.',
          code: 'OWNER_REQUIRED',
        })
      if (
        access.data === 'SETUP' &&
        !operation.setup &&
        operation.restricted !== 'OWN_PROFILE' &&
        !operation.exportData &&
        !operation.ownerRead &&
        !operation.ownerCancel &&
        !operation.ownerActivate &&
        !operation.ownerReactivate &&
        !operation.reconciliation
      )
        return restricted()
      if (
        access.data === 'RESTRICTED' &&
        !operation.read &&
        !operation.restricted &&
        !operation.reconciliation &&
        !operation.newPayment
      )
        return restricted()
      if (operation.newPayment && access.data === 'RESTRICTED') {
        if (!operation.rentalPaymentId) return restricted()
        return (await isOngoingPayment(tx, principal.tenantId, {
          rentalId: operation.rentalPaymentId,
        }))
          ? undefined
          : restricted()
      }
      if (operation.read || operation.restricted || operation.reconciliation)
        return undefined
      if (operation.feature) {
        const rights = await readEffectiveRights(
          tx,
          principal.tenantId,
          new Date()
        )
        if (!rights) return unavailable()
        if (!recursoNoPlano(rights, operation.feature))
          return refusal(402, {
            error: 'Este módulo não está disponível no seu plano.',
            code: 'MODULE_NOT_IN_PLAN',
            feature: operation.feature,
          })
      } else {
        const subscription = await tx.subscription.findFirst({
          where: { tenantId: principal.tenantId, status: { not: 'CANCELED' } },
          select: { planVersion: { select: { entitlements: true } } },
        })
        if (
          !EntitlementsV1Schema.safeParse(
            subscription?.planVersion.entitlements
          ).success
        )
          return unavailable()
      }
      return undefined
    }
    let response: Response | undefined
    try {
      response = await withTenantTransaction(
        dependencies.getDatabase(),
        principal,
        decide
      )
    } catch {
      response = unavailable()
    }
    if (mode === 'shadow') {
      const data = response ? await response.clone().json() : null
      try {
        ;(
          dependencies.shadow ??
          ((entry) => console.warn('[subscription-shadow]', entry))
        )({
          tenantId: principal.tenantId,
          code:
            data?.code ??
            (response ? 'SUBSCRIPTION_POLICY_UNAVAILABLE' : 'ALLOWED'),
        })
      } catch {
        /* Diagnostic failures cannot enforce shadow mode. */
      }
      return { principal }
    }
    return { principal: effectivePrincipal, response }
  }
}
