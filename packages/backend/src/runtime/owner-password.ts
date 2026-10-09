import { createHash } from 'node:crypto'
import { OnboardingError } from '../modules/onboarding/index'

/** HIBP range protocol used by Better Auth, with bounded I/O for this new flow only. */
export async function verifyOwnerPassword(
  password: string,
  transport?: typeof fetch
): Promise<void> {
  const digest = createHash('sha1')
    .update(password, 'utf8')
    .digest('hex')
    .toUpperCase()
  try {
    const endpoint = `https://api.pwnedpasswords.com/range/${digest.slice(0, 5)}`
    const options: RequestInit = {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'Locadora Owner Password Check',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }
    const response = transport
      ? await transport(endpoint, options)
      : await fetch(endpoint, options)
    if (!response.ok || !response.body) throw new Error('UNAVAILABLE')
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
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
        if (bytes > 131072) {
          await reader.cancel()
          throw new Error('UNAVAILABLE')
        }
        text += decoder.decode(part.value, { stream: true })
      }
    } finally {
      reader.releaseLock()
    }
    const lines = text.trim().split(/\r?\n/)
    if (!lines.length) throw new Error('UNAVAILABLE')
    let compromised = false
    for (const line of lines) {
      const match = /^([0-9A-Fa-f]{35}):(0|[1-9][0-9]*)$/.exec(line)
      if (!match || !Number.isSafeInteger(Number(match[2])))
        throw new Error('UNAVAILABLE')
      if (match[1]!.toUpperCase() === digest.slice(5) && Number(match[2]) > 0)
        compromised = true
    }
    if (compromised) throw new OnboardingError(422, 'PASSWORD_COMPROMISED')
  } catch (error) {
    if (error instanceof OnboardingError) throw error
    throw new OnboardingError(503, 'PASSWORD_CHECK_UNAVAILABLE')
  }
}
