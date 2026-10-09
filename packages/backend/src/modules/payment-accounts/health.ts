import type { PaymentAccount, TenantIntegration } from '@prisma/client'
import type { AsaasAccountHealth } from '../billing/index'

export type AccountHealthTarget = {
  account: PaymentAccount
  integration: TenantIntegration
}
export type AccountHealthReader = (
  _target: AccountHealthTarget
) => Promise<AsaasAccountHealth>

/** Current provider facts decide approval; unresolved operational restrictions stay in place. */
export function projectAccountHealth(
  account: PaymentAccount,
  facts: AsaasAccountHealth
) {
  const expired = facts.commercialInfoExpired ?? account.commercialInfoExpired
  const issue = expired
    ? 'COMMERCIAL_INFO_EXPIRED'
    : [
          'COMMERCIAL_INFO_EXPIRED',
          'KEY_DISABLED',
          'KEY_EXPIRED',
          'KEY_DELETED',
        ].includes(account.healthIssue ?? '')
      ? null
      : account.healthIssue
  const status = facts.status
  const values = status
    ? [
        status.commercialInfo,
        status.bankAccountInfo,
        status.documentation,
        status.general,
      ]
    : []
  const approval = values.includes('REJECTED')
    ? 'REJECTED'
    : values.length === 4 && values.every((value) => value === 'APPROVED')
      ? 'APPROVED'
      : values.includes('AWAITING_APPROVAL') ||
          (status?.general === 'APPROVED' && !values.includes('UNKNOWN'))
        ? 'UNDER_REVIEW'
        : 'AWAITING_OWNER'
  return {
    status: (account.status === 'BLOCKED'
      ? 'BLOCKED'
      : expired || issue
        ? 'RESTRICTED'
        : approval) as PaymentAccount['status'],
    healthIssue: issue,
    commercialInfoExpired: expired,
    ...(facts.commercialInfoExpired !== null
      ? { commercialInfoExpiresAt: facts.commercialInfoExpiresAt }
      : {}),
    ...(status
      ? {
          commercialInfoStatus: status.commercialInfo,
          bankAccountInfoStatus: status.bankAccountInfo,
          documentationStatus: status.documentation,
          generalStatus: status.general,
        }
      : {}),
  }
}
