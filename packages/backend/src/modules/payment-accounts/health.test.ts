import { describe, expect, it } from 'vitest'
import type { PaymentAccount } from '@prisma/client'
import type { AsaasAccountStatus } from '../billing/asaas-events'
import { projectAccountHealth } from './health'

const account = {
  status: 'UNDER_REVIEW',
  commercialInfoExpired: false,
  healthIssue: null,
} as PaymentAccount
const status: AsaasAccountStatus = {
  id: 'status',
  general: 'APPROVED',
  commercialInfo: 'APPROVED',
  bankAccountInfo: 'APPROVED',
  documentation: 'APPROVED',
}
const facts = {
  status,
  commercialInfoExpired: null,
  commercialInfoExpiresAt: null,
}
describe('shared account approval projection', () => {
  it('approves only complete current approval and preserves an administrative or operational restriction', () => {
    expect(projectAccountHealth(account, facts).status).toBe('APPROVED')
    expect(
      projectAccountHealth({ ...account, status: 'BLOCKED' }, facts).status
    ).toBe('BLOCKED')
    expect(
      projectAccountHealth(
        { ...account, healthIssue: 'WEBHOOK_INTERRUPTED' },
        facts
      ).status
    ).toBe('RESTRICTED')
    expect(
      projectAccountHealth({ ...account, commercialInfoExpired: true }, facts)
        .status
    ).toBe('RESTRICTED')
  })
  it.each(['commercialInfo', 'bankAccountInfo', 'documentation'] as const)(
    'a contradictory general approval cannot bypass %s',
    (field) => {
      for (const value of [
        'PENDING',
        'AWAITING_APPROVAL',
        'REJECTED',
        'UNKNOWN',
      ] as const) {
        const projected = projectAccountHealth(account, {
          ...facts,
          status: { ...status, [field]: value },
        })
        expect(projected.status).not.toBe('APPROVED')
        expect(projected.status).toBe(
          value === 'REJECTED'
            ? 'REJECTED'
            : value === 'UNKNOWN'
              ? 'AWAITING_OWNER'
              : 'UNDER_REVIEW'
        )
      }
    }
  )
})
