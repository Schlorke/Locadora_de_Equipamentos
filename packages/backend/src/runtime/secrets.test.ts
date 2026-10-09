import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  oidc: vi.fn(() => 'oidc-provider'),
  destroy: vi.fn(),
}))
vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: class {
    constructor(options: unknown) {
      mocks.client(options)
    }
    destroy = mocks.destroy
  },
}))
vi.mock('@aws-sdk/credential-provider-web-identity', () => ({
  fromTokenFile: mocks.oidc,
}))
import { createConfiguredSecrets, secretsConfigured } from './secrets'

const env = {
  PLATFORM_SECRET_FINGERPRINT_KEY:
    'synthetic-fingerprint-key-at-least-32-bytes',
  PLATFORM_SECRETS_KEK_CURRENT: 'K1',
  PLATFORM_SECRETS_KEK_K1: Buffer.alloc(32, 8).toString('base64'),
}
const arn =
  'arn:aws:kms:sa-east-1:123456789012:key/12345678-1234-1234-1234-123456789abc'
describe('secret vault runtime configuration', () => {
  it('does not require a vault for unconfigured legacy integrations', async () => {
    expect(secretsConfigured({})).toBe(false)
    expect(secretsConfigured(env)).toBe(true)
    const configured = await createConfiguredSecrets(env)
    configured.dispose()
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it.each([
    { PLATFORM_SECRET_FINGERPRINT_KEY: 'short' },
    { PLATFORM_SECRETS_KEK_K1: 'wrong' },
    { PLATFORM_SECRETS_KEK_PROVIDER: 'unknown' },
    { PLATFORM_SELF_SERVICE_SIGNUP: 'true' },
    { PLATFORM_SELF_SERVICE_SIGNUP: 'on' },
    {
      PLATFORM_SELF_SERVICE_SIGNUP: 'on',
      PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
      PLATFORM_SECRETS_KMS_KEY_ARN: arn,
    },
  ])('fails closed and conceals invalid values: %j', async (change) => {
    await expect(
      createConfiguredSecrets({ ...env, ...change })
    ).rejects.toThrow(/^SECRET_CONFIGURATION_INVALID$/)
  })
  it('requires explicit web identity for self service and never passes static AWS keys', async () => {
    const configured = await createConfiguredSecrets({
      ...env,
      PLATFORM_SELF_SERVICE_SIGNUP: 'on',
      PLATFORM_SECRETS_KEK_PROVIDER: 'aws-kms',
      PLATFORM_SECRETS_KMS_KEY_ARN: arn,
      AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/fixture',
      AWS_WEB_IDENTITY_TOKEN_FILE: '/synthetic/token',
      AWS_ACCESS_KEY_ID: 'not-used',
      AWS_SECRET_ACCESS_KEY: 'not-used',
    })
    expect(mocks.oidc).toHaveBeenCalledWith({
      roleArn: 'arn:aws:iam::123456789012:role/fixture',
      webIdentityTokenFile: '/synthetic/token',
    })
    expect(mocks.client).toHaveBeenCalledWith({
      region: 'sa-east-1',
      maxAttempts: 2,
      credentials: 'oidc-provider',
    })
    configured.dispose()
    expect(mocks.destroy).toHaveBeenCalled()
  })
})
