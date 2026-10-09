import type { KMSClient } from '@aws-sdk/client-kms'
import {
  createSecretVault,
  createEnvKeyring,
  createAwsKmsKeyEncryption,
  SecretVaultError,
} from '../modules/secrets/index'

export async function createConfiguredSecrets(
  env: Readonly<Record<string, string | undefined>>,
  now?: () => Date
) {
  const provider = env.PLATFORM_SECRETS_KEK_PROVIDER ?? 'env'
  const selfService = env.PLATFORM_SELF_SERVICE_SIGNUP ?? 'off'
  if (
    !['env', 'aws-kms'].includes(provider) ||
    !['off', 'on'].includes(selfService) ||
    (selfService === 'on' &&
      (provider !== 'aws-kms' ||
        !env.AWS_ROLE_ARN ||
        !env.AWS_WEB_IDENTITY_TOKEN_FILE))
  )
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  const fingerprintKey = Buffer.from(
    env.PLATFORM_SECRET_FINGERPRINT_KEY ?? '',
    'utf8'
  )
  if (fingerprintKey.length < 32)
    throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
  const keys: Record<string, Uint8Array> = {}
  for (const [name, value] of Object.entries(env)) {
    const match = /^PLATFORM_SECRETS_KEK_([A-Z][A-Z0-9_]{0,31})$/.exec(name)
    if (!match || ['PROVIDER', 'CURRENT'].includes(match[1]!)) continue
    if (!value) continue
    const key = Buffer.from(value, 'base64')
    if (key.length !== 32 || key.toString('base64') !== value)
      throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
    keys[match[1]!] = key
  }
  const ring = env.PLATFORM_SECRETS_KEK_CURRENT
    ? createEnvKeyring(env.PLATFORM_SECRETS_KEK_CURRENT, keys)
    : undefined
  let client: KMSClient | undefined
  try {
    if (env.PLATFORM_SECRETS_KMS_KEY_ARN) {
      const [{ KMSClient }, { fromTokenFile }] = await Promise.all([
        import('@aws-sdk/client-kms'),
        import('@aws-sdk/credential-provider-web-identity'),
      ])
      client = new KMSClient({
        region: 'sa-east-1',
        maxAttempts: 2,
        credentials:
          env.AWS_ROLE_ARN && env.AWS_WEB_IDENTITY_TOKEN_FILE
            ? fromTokenFile({
                roleArn: env.AWS_ROLE_ARN,
                webIdentityTokenFile: env.AWS_WEB_IDENTITY_TOKEN_FILE,
              })
            : undefined,
      })
    }
    const kms = client
      ? createAwsKmsKeyEncryption(env.PLATFORM_SECRETS_KMS_KEY_ARN!, client)
      : undefined
    const current = provider === 'env' ? ring : kms
    if (!current) throw new SecretVaultError('SECRET_CONFIGURATION_INVALID')
    const vault = createSecretVault({
      current,
      providers: [ring, kms].filter((p) => p !== undefined),
      fingerprintKey,
      now,
    })
    return { vault, dispose: () => client?.destroy() }
  } catch (error) {
    client?.destroy()
    throw error
  } finally {
    fingerprintKey.fill(0)
    for (const key of Object.values(keys)) key.fill(0)
  }
}
export function secretsConfigured(
  env: Readonly<Record<string, string | undefined>>
): boolean {
  return Boolean(
    env.PLATFORM_SECRETS_KEK_CURRENT ||
    env.PLATFORM_SECRETS_KMS_KEY_ARN ||
    env.PLATFORM_SELF_SERVICE_SIGNUP === 'on'
  )
}
