import type { PrismaClient } from '@prisma/client'
import type { createCredentialAccounts } from '../modules/identity/credential-accounts'
import type { createIdentityLimiters } from '../modules/identity/rate-limit'
import { clientIpFromHeaders } from '../modules/identity/index'
import { createOwnerAccountHandlers } from '../http/owner-account'
import { assertSelfServiceOnboardingConfiguration } from './onboarding'
import { readConfiguredOnboardingOptions } from './onboarding-options'
import { verifyOnboardingCaptcha } from './onboarding-captcha'
import { verifyOwnerPassword } from './owner-password'

/** Hosts provide their existing session/storage/identity composition; there is no second engine or pool. */
export function createOwnerAccountRuntime(ports: {
  database(): PrismaClient
  accounts: Pick<
    ReturnType<typeof createCredentialAccounts>,
    'registerOwnerAccount' | 'resendOwnerVerification'
  >
  refuseAuthAttempt: ReturnType<
    typeof createIdentityLimiters
  >['refuseAuthAttempt']
  consumeAccountNotice: ReturnType<
    typeof createIdentityLimiters
  >['consumeAccountNotice']
  environment?: () => Readonly<Record<string, string | undefined>>
}) {
  const environment = ports.environment ?? (() => process.env)
  return createOwnerAccountHandlers({
    environment,
    async checkSignup() {
      assertSelfServiceOnboardingConfiguration(environment())
      await readConfiguredOnboardingOptions(environment())
    },
    refuseAttempt: (request, email) =>
      ports.refuseAuthAttempt(
        'register',
        { headers: request.headers, account: email },
        'Muitas tentativas. Tente novamente mais tarde.'
      ),
    async verifyRegistration(input, request, origin) {
      await verifyOnboardingCaptcha({
        secret: environment().PLATFORM_CAPTCHA_SECRET_KEY ?? '',
        token: request.headers.get('X-Platform-Captcha'),
        hostname: new URL(origin).hostname,
        ip: clientIpFromHeaders(request.headers),
        key: 'owner-account-registration',
        userId: input.email,
      })
      await verifyOwnerPassword(input.password)
    },
    register: (input, request) =>
      ports.accounts.registerOwnerAccount(input, request),
    read: (userId) =>
      ports.database().user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, authEmailVerified: true },
      }),
    async consumeResend(email) {
      return (
        (await ports.consumeAccountNotice(
          'owner-verification-resend',
          email
        )) &&
        (await ports.consumeAccountNotice('verification-resend-day', email))
      )
    },
    resend: (email, request) =>
      ports.accounts.resendOwnerVerification(email, request),
  })
}
