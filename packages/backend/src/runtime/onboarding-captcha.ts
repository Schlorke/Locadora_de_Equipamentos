import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import { OnboardingError } from '../modules/onboarding/index'

const answer = z.object({
  success: z.boolean(),
  hostname: z.string().max(255).optional(),
  action: z.string().max(128).optional(),
})
/** Fixed Siteverify endpoint, one bounded request. Tokens are not logged or persisted. */
export async function verifyOnboardingCaptcha(
  input: {
    secret: string
    token: string | null
    hostname: string
    ip: string | null
    key: string
    userId: string
  },
  transport?: typeof fetch
) {
  if (!input.secret.trim())
    throw new OnboardingError(503, 'ONBOARDING_CONFIGURATION_INVALID')
  if (!input.token?.trim() || input.token.length > 2048)
    throw new OnboardingError(400, 'CAPTCHA_REQUIRED')
  const hex = createHmac('sha256', input.secret)
    .update(
      JSON.stringify([
        'onboarding',
        input.userId,
        input.key,
        input.hostname,
        input.token,
      ])
    )
    .digest('hex')
  const idempotency = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  try {
    const options: RequestInit = {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: input.secret,
        response: input.token,
        idempotency_key: idempotency,
        ...(input.ip && isIP(input.ip) ? { remoteip: input.ip } : {}),
      }),
    }
    const endpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    const response = transport
      ? await transport(endpoint, options)
      : await fetch(endpoint, options)
    if (!response.ok || !response.body) throw new Error('UNAVAILABLE')
    const reader = response.body.getReader(),
      decoder = new TextDecoder('utf-8', { fatal: true })
    let bytes = 0,
      text = ''
    try {
      for (;;) {
        const part = await reader.read()
        if (part.done) {
          text += decoder.decode()
          break
        }
        bytes += part.value.byteLength
        if (bytes > 8192) {
          await reader.cancel()
          throw new Error('UNAVAILABLE')
        }
        text += decoder.decode(part.value, { stream: true })
      }
    } finally {
      reader.releaseLock()
    }
    const result = answer.safeParse(JSON.parse(text))
    if (!result.success) throw new Error('UNAVAILABLE')
    if (
      !result.data.success ||
      result.data.hostname !== input.hostname ||
      result.data.action !== 'onboarding'
    )
      throw new OnboardingError(400, 'CAPTCHA_INVALID')
  } catch (error) {
    if (error instanceof OnboardingError) throw error
    throw new OnboardingError(503, 'CAPTCHA_UNAVAILABLE')
  }
}
