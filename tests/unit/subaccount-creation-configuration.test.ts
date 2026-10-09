import { describe, expect, it } from 'vitest'
import {
  readSubaccountCreationConfiguration,
  subaccountMaintenanceSwitch,
} from '../../packages/backend/src/runtime/subaccount-creation'

/** Wave 134 (S9): the single reading of the creation switches, shared by both API hosts (ADR SaaS B.14). */
const complete = {
  PLATFORM_ENV: 'development',
  PLATFORM_PUBLIC_PORT: '3310',
  PLATFORM_SUBACCOUNT_CREATION: 'on',
  PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'STANDARD',
  PLATFORM_ASAAS_ENVIRONMENT: 'sandbox',
  PLATFORM_ASAAS_ROOT_API_KEY: 'synthetic-root-key',
  PLATFORM_WEBHOOK_ORIGIN: 'https://api.example.test',
  PLATFORM_OPS_EMAIL: 'ops@example.test',
  PLATFORM_SECRETS_KEK_CURRENT: 'K1',
}
const read = (patch: Record<string, string | undefined> = {}) =>
  readSubaccountCreationConfiguration({ ...complete, ...patch })

describe('receiving-account creation configuration', () => {
  it('a complete configuration installs the creation, with the paid first invoice required by default', () => {
    const { flag, model, config } = read()
    expect({ flag, model }).toEqual({ flag: 'on', model: 'STANDARD' })
    expect(config).toMatchObject({
      environment: 'sandbox',
      model: 'STANDARD',
      requiresPaid: true,
      rootKey: 'synthetic-root-key',
      origin: 'https://api.example.test',
      email: 'ops@example.test',
    })
    expect(config!.site('locadora-alfa')).toBe(
      'http://locadora-alfa.localhost:3310'
    )
  })

  it.each([
    ['absent', undefined, 'off'],
    ['off', 'off', 'off'],
    ['an unknown value', 'yes', 'invalid'],
    ['uppercase ON', 'ON', 'invalid'],
  ] as const)(
    'the switch %s keeps the creation unavailable',
    (_label, value, flag) => {
      expect(read({ PLATFORM_SUBACCOUNT_CREATION: value })).toMatchObject({
        flag,
        config: null,
      })
    }
  )

  it.each([
    [
      'BAAS (documents lot pending)',
      { PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'BAAS' },
    ],
    ['an unknown model', { PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'OTHER' }],
    ['no model', { PLATFORM_ASAAS_SUBACCOUNT_MODEL: undefined }],
    ['no environment', { PLATFORM_ASAAS_ENVIRONMENT: undefined }],
    ['another environment', { PLATFORM_ASAAS_ENVIRONMENT: 'staging' }],
    ['no root credential', { PLATFORM_ASAAS_ROOT_API_KEY: ' ' }],
    ['no webhook origin', { PLATFORM_WEBHOOK_ORIGIN: undefined }],
    ['an http origin', { PLATFORM_WEBHOOK_ORIGIN: 'http://api.example.test' }],
    [
      'an origin with a path',
      { PLATFORM_WEBHOOK_ORIGIN: 'https://api.example.test/hooks' },
    ],
    ['no operations e-mail', { PLATFORM_OPS_EMAIL: undefined }],
    ['an invalid operations e-mail', { PLATFORM_OPS_EMAIL: 'ops' }],
    ['no vault', { PLATFORM_SECRETS_KEK_CURRENT: undefined }],
    [
      'no host configuration for the company sites',
      { PLATFORM_ENV: 'production' },
    ],
  ])('%s keeps the creation unavailable', (_label, patch) => {
    expect(read(patch).config).toBeNull()
  })

  it.each([
    [undefined, true],
    ['true', true],
    ['FALSE', true],
    ['0', true],
    ['false', false],
  ] as const)(
    'PLATFORM_SUBACCOUNT_REQUIRES_PAID=%s requires the paid first invoice: %s',
    (value, expected) => {
      expect(
        read({ PLATFORM_SUBACCOUNT_REQUIRES_PAID: value }).config?.requiresPaid
      ).toBe(expected)
    }
  )

  it('the maintenance cancels unsent requests only when the switch is plainly off or another model is configured', () => {
    expect(
      subaccountMaintenanceSwitch(
        read({ PLATFORM_SUBACCOUNT_CREATION: undefined })
      )
    ).toEqual({
      enabled: false,
      model: 'STANDARD',
    })
    expect(
      subaccountMaintenanceSwitch(read({ PLATFORM_SUBACCOUNT_CREATION: 'yes' }))
    ).toEqual({
      enabled: true,
      model: null,
    })
    expect(
      subaccountMaintenanceSwitch(
        read({ PLATFORM_ASAAS_SUBACCOUNT_MODEL: 'BAAS' })
      )
    ).toEqual({
      enabled: true,
      model: 'BAAS',
    })
    // On, but with the root credential missing: nothing is cancelled, the requests wait.
    expect(
      subaccountMaintenanceSwitch(
        read({ PLATFORM_ASAAS_ROOT_API_KEY: undefined })
      )
    ).toEqual({
      enabled: true,
      model: 'STANDARD',
    })
  })
})
