import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
type WebhookAuthentication = {
  secret: string | undefined
  signingSecrets?: readonly string[]
  signatureHeader: string
  signaturePrefix?: string
  tokenHeaders?: readonly string[]
  tokenHashes?: readonly string[]
  allowSignature?: boolean
}
type AuthenticatedWebhook =
  | { ok: true; body: unknown; payloadHash: string }
  | { ok: false; response: Response }
export function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual || !expected) return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}
export async function readAuthenticatedWebhook(
  request: Request,
  options: WebhookAuthentication
): Promise<AuthenticatedWebhook> {
  const {
    secret,
    signatureHeader,
    signaturePrefix = '',
    tokenHeaders = [],
    tokenHashes = [],
  } = options
  const secrets = options.signingSecrets ?? (secret ? [secret] : [])
  if (
    (secrets.length === 0 && tokenHashes.length === 0) ||
    secrets.some((value) => !value.trim()) ||
    secrets.length > 2 ||
    tokenHashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))
  ) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Webhook authentication unavailable' },
        { status: 503 }
      ),
    }
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'Invalid body' }, { status: 400 }),
    }
  }
  if (Buffer.byteLength(rawBody, 'utf8') > 2 * 1024 * 1024)
    return {
      ok: false,
      response: Response.json(
        { error: 'Webhook body too large' },
        { status: 413 }
      ),
    }
  const signature = request.headers.get(signatureHeader) || ''
  const digest = signature.startsWith(signaturePrefix)
    ? signature.slice(signaturePrefix.length)
    : ''
  const validSignature =
    options.allowSignature !== false &&
    /^[a-fA-F0-9]{64}$/.test(digest) &&
    secrets.some((value) =>
      timingSafeEqual(
        Buffer.from(digest, 'hex'),
        createHmac('sha256', value).update(rawBody).digest()
      )
    )
  const validToken = tokenHeaders.some((header) => {
    const actual = request.headers.get(header)
    if (!actual) return false
    if (tokenHashes.length > 0) {
      const digest = createHash('sha256').update(actual).digest()
      return tokenHashes.some((hash) =>
        timingSafeEqual(digest, Buffer.from(hash, 'hex'))
      )
    }
    return secrets.some((value) => secretsMatch(actual, value))
  })
  if (!validSignature && !validToken) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Invalid webhook authentication' },
        { status: 401 }
      ),
    }
  }

  try {
    return {
      ok: true,
      body: JSON.parse(rawBody) as unknown,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    }
  } catch {
    return {
      ok: false,
      response: Response.json({ error: 'Invalid JSON' }, { status: 400 }),
    }
  }
}
