import { describe, expect, it } from 'vitest'
import {
  createIntegrationCredentialResolver,
  integrationCredentialReference,
} from './integration-credentials'

describe('environment integration credentials', () => {
  it('keeps ENV references literal and lets operators explicitly disable them', async () => {
    expect(
      integrationCredentialReference({
        credentialSource: 'ENV_REF',
        credentialsRef: 'env:LOCADORA_INTEGRATION_A',
      })
    ).toBe('env:LOCADORA_INTEGRATION_A')
    const resolve = createIntegrationCredentialResolver(() => ({
      INTEGRATION_ENV_REFS_ALLOWED: 'false',
      LOCADORA_INTEGRATION_A_SECRET: 'present',
    }))
    expect(await resolve('env:LOCADORA_INTEGRATION_A')).toBeNull()
  })
  it('does not fall back to environment credentials when a VAULT read fails', async () => {
    const target = integrationCredentialReference({
      id: 'a',
      tenantId: 'alfa',
      provider: 'ASAAS',
      environment: 'sandbox',
      credentialSource: 'VAULT',
      credentialsRef: 'env:LOCADORA_INTEGRATION_A',
    })
    const resolve = createIntegrationCredentialResolver(
      () => ({ LOCADORA_INTEGRATION_A_SECRET: 'fallback-forbidden' }),
      async () => {
        throw Error('unavailable')
      }
    )
    expect(await resolve(target)).toBeNull()
  })
  it.each([
    null,
    undefined,
    '',
    'literal-key',
    'env:OTHER',
    'env:LOCADORA_INTEGRATION_lower',
    'env:LOCADORA_INTEGRATION_A/../B',
  ])('rejects reference %s before reading env', async (ref) => {
    const resolve = createIntegrationCredentialResolver(() => {
      throw Error('must not read env')
    })
    expect(await resolve(ref)).toBeNull()
  })
  it.each([undefined, '', '   '])(
    'requires the configured signing secret (%s)',
    async (secret) => {
      const resolve = createIntegrationCredentialResolver(() => ({
        LOCADORA_INTEGRATION_A_SECRET: secret,
        LOCADORA_INTEGRATION_A_API_KEY: 'unusable-alone',
      }))
      expect(await resolve('env:LOCADORA_INTEGRATION_A')).toBeNull()
    }
  )
  it('reads rotation at call time and preserves the existing optional fields', async () => {
    const env = {
      LOCADORA_INTEGRATION_A_SECRET: 'first',
      LOCADORA_INTEGRATION_A_API_KEY: 'local-key',
      LOCADORA_INTEGRATION_A_ENVIRONMENT: 'sandbox',
      LOCADORA_INTEGRATION_A_VERIFY_TOKEN: 'verify',
      LOCADORA_INTEGRATION_A_USER_AGENT: 'agent',
    }
    const resolve = createIntegrationCredentialResolver(() => env)
    expect(await resolve('env:LOCADORA_INTEGRATION_A')).toEqual({
      signingSecret: 'first',
      signingSecrets: ['first'],
      apiKey: 'local-key',
      environment: 'sandbox',
      verifyToken: 'verify',
      userAgent: 'agent',
    })
    env.LOCADORA_INTEGRATION_A_SECRET = 'rotated'
    expect((await resolve('env:LOCADORA_INTEGRATION_A'))?.signingSecret).toBe(
      'rotated'
    )
    expect(await resolve('env:LOCADORA_INTEGRATION_B')).toBeNull()
  })
})
