import {
  createIdentityRuntime,
  createIdentityMailSender,
  type Identity,
} from '@gb-locacoes/backend/identity'

export { identityEnabled, identityMode } from '@gb-locacoes/backend/identity'

const identity = createIdentityRuntime({
  environment: () => process.env,
  loadDependencies: async () => {
    const { prisma } = await import('@/lib/prisma')
    const { default: getResend } = await import('@/lib/resend')
    const send = createIdentityMailSender({
      client: getResend,
      from: () => process.env.FROM_EMAIL,
    })
    const { consumeVerificationResend, legacySignInGuard } =
      await import('@/lib/rate-limit')
    return {
      database: prisma,
      send,
      verificationResendAllowed: consumeVerificationResend,
      signInGuard: legacySignInGuard(),
    }
  },
})

export async function getIdentity(): Promise<Identity> {
  return identity.getIdentity()
}
export async function handleIdentityRequest(
  request: Request
): Promise<Response> {
  return identity.handleIdentityRequest(request)
}
