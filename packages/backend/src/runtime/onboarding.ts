import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { OnboardingError } from '../modules/onboarding/index'

/** Enabling the public flow requires the documented identity and workload-key configuration. */
export function assertSelfServiceOnboardingConfiguration(
  env: Readonly<Record<string, string | undefined>>
) {
  const mode = env.PLATFORM_SELF_SERVICE_SIGNUP ?? 'off'
  if (mode === 'off')
    throw new OnboardingError(403, 'SELF_SERVICE_SIGNUP_DISABLED')
  if (
    mode !== 'on' ||
    env.AUTH_MODE !== 'better-auth' ||
    env.PLATFORM_SECRETS_KEK_PROVIDER !== 'aws-kms' ||
    !env.PLATFORM_SECRETS_KMS_KEY_ARN?.trim() ||
    !env.AWS_ROLE_ARN?.trim() ||
    !env.AWS_WEB_IDENTITY_TOKEN_FILE?.trim() ||
    !env.PLATFORM_CAPTCHA_SECRET_KEY?.trim() ||
    !env.PLATFORM_CAPTCHA_SITE_KEY?.trim()
  )
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
}

/** Inert configuration adapter. Connections remain owned by the sole platform composition. */
export async function readAssistedOnboardingConfiguration(
  env: Readonly<Record<string, string | undefined>>
) {
  const filename = env.PLATFORM_LEGAL_DOCUMENTS_FILE
  const environment = env.PLATFORM_ASAAS_ENVIRONMENT
  if (
    !path.isAbsolute(filename ?? '') ||
    !['sandbox', 'production'].includes(environment ?? '')
  )
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  let publication: unknown
  try {
    const file = await stat(filename!)
    if (!file.isFile() || file.size > 16384) throw new Error('INVALID_FILE')
    const bytes = await readFile(filename!, 'utf8')
    if (Buffer.byteLength(bytes, 'utf8') > 16384)
      throw new Error('INVALID_FILE')
    publication = JSON.parse(bytes)
  } catch {
    throw new OnboardingError(503, 'LEGAL_PUBLICATION_UNAVAILABLE')
  }
  return {
    trialSecret: env.PLATFORM_TRIAL_SECRET ?? '',
    rateLimitSecret: env.PLATFORM_RATE_LIMIT_SECRET ?? '',
    environment: environment as 'sandbox' | 'production',
    publication: () => publication,
  }
}
