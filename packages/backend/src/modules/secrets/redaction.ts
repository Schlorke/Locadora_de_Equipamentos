const confidential =
  /^(?:apiKey|accessToken|access_token|authToken|authorization|asaas-access-token|onboardingUrl|wrappedDek|ciphertext|authTag|signingSecrets?|userAgent|verifyToken|password|secret|fingerprintKey|webhookToken|webhookTokenPrevious|PLATFORM_SECRETS_KEK_.+|PLATFORM_SECRET_FINGERPRINT_KEY)$/i

/** Redact structured fields before logging. Plaintext deliberately extracted into a message cannot be recovered here. */
export function redactSecretFields(value: unknown): unknown {
  const seen = new WeakSet<object>()
  function visit(input: unknown): unknown {
    if (!input || typeof input !== 'object') return input
    if (seen.has(input)) return '[Circular]'
    seen.add(input)
    if (Array.isArray(input)) return input.map(visit)
    if (input instanceof Date) return input
    // Redact sensitive names before reading their values, including credential accessors.
    if (Buffer.isBuffer(input) || ArrayBuffer.isView(input)) return '[REDACTED]'
    const result: Record<string, unknown> =
      input instanceof Error
        ? { type: input.name, message: input.message, stack: input.stack }
        : {}
    for (const name of Object.keys(input)) {
      if (confidential.test(name)) result[name] = '[REDACTED]'
      else {
        try {
          result[name] = visit((input as Record<string, unknown>)[name])
        } catch {
          result[name] = '[Unavailable]'
        }
      }
    }
    return result
  }
  return visit(value)
}
