import {
  CreateOrganizationInputSchema,
  CreateOrganizationResponseSchema,
  IdempotencyKeySchema,
  SlugAvailabilityQuerySchema,
  SlugAvailabilityResponseSchema,
} from '@gb-locacoes/contracts/onboarding'
import {
  classifyHost,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import { readPlatformEdgeContext } from '../modules/identity/platform-edge'
import {
  selectedTenantPreferenceCookie,
  clientIpFromHeaders,
} from '../modules/identity/index'
import {
  OnboardingError,
  type createOrganizationProvisioning,
  type readSignupSlugAvailability,
} from '../modules/onboarding/index'

const codes = new Set([
  'ONBOARDING_CONFIGURATION_INVALID',
  'ONBOARDING_RECEIPT_UNAVAILABLE',
  'ONBOARDING_INPUT_INVALID',
  'ONBOARDING_RATE_LIMITED',
  'LEGAL_DOCUMENT_CHANGED',
  'LEGAL_PUBLICATION_UNAVAILABLE',
  'INVALID_CNPJ',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_NOT_ALLOWED',
  'AUTHENTICATION_REQUIRED',
  'PLATFORM_STAFF_CANNOT_OWN_TENANT',
  'ORGANIZATION_LIMIT_REACHED',
  'PLAN_NOT_AVAILABLE',
  'SLUG_UNAVAILABLE',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_IDEMPOTENCY_KEY',
  'IDENTITY_CHANGED',
  'SELF_SERVICE_SIGNUP_DISABLED',
  'CAPTCHA_REQUIRED',
  'CAPTCHA_INVALID',
  'CAPTCHA_UNAVAILABLE',
  'BODY_TOO_LARGE',
  'JSON_REQUIRED',
  'APP_HOST_REQUIRED',
  'ORIGIN_NOT_ALLOWED',
  'PASSWORD_COMPROMISED',
  'PASSWORD_CHECK_UNAVAILABLE',
  'CREDENTIAL_MAINTENANCE',
])
export const onboardingReply = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Host',
      ...extra,
    },
  })

export function onboardingFailure(error: unknown) {
  if (error instanceof OnboardingError && codes.has(error.code))
    return onboardingReply(
      {
        error: 'Não foi possível concluir esta etapa do cadastro.',
        code: error.code,
        ...(error.suggestions ? { suggestions: [...error.suggestions] } : {}),
      },
      error.status,
      error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}
    )
  return onboardingReply(
    {
      error: 'Não foi possível concluir esta etapa do cadastro.',
      code: 'ONBOARDING_UNAVAILABLE',
    },
    503
  )
}

/** A signed app edge is mandatory outside development. No forwarded host/header fallback. */
export function onboardingAppOrigin(
  request: Request,
  env: Readonly<Record<string, string | undefined>>
) {
  const platform = resolvePlatformEnv(env)
  const edge = readPlatformEdgeContext(request, env)
  let origin: string
  if (edge?.hostKind === 'app') origin = edge.origin
  else {
    if (edge || platform.environment !== 'development')
      throw new OnboardingError(403, 'APP_HOST_REQUIRED')
    const host = classifyHost(new URL(request.url).host, platform)
    if (host.kind !== 'app') throw new OnboardingError(403, 'APP_HOST_REQUIRED')
    origin = host.origin
  }
  const received = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (
    (received !== null && received !== origin) ||
    (site !== null && !['same-origin', 'none'].includes(site)) ||
    (request.method === 'POST' && received !== origin)
  )
    throw new OnboardingError(403, 'ORIGIN_NOT_ALLOWED')
  return origin
}

export async function readOnboardingBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  )
    throw new OnboardingError(415, 'JSON_REQUIRED')
  const reader = request.body?.getReader()
  if (!reader) throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0,
    text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) {
        text += decoder.decode()
        break
      }
      bytes += chunk.value.byteLength
      if (bytes > 16384) {
        await reader.cancel()
        throw new OnboardingError(413, 'BODY_TOO_LARGE')
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof OnboardingError) throw error
    throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
  } finally {
    reader.releaseLock()
  }
}

type Provision = ReturnType<typeof createOrganizationProvisioning>
export function createOnboardingHttpHandlers(ports: {
  environment(): Readonly<Record<string, string | undefined>>
  checkSignup(): void
  provision(
    userId: string,
    input: Parameters<Provision>[1],
    key: string,
    metadata: Parameters<Provision>[3],
    request: Request,
    origin: string
  ): ReturnType<Provision>
  slugAvailability(
    slug: string,
    ip: string | null
  ): ReturnType<typeof readSignupSlugAvailability>
}) {
  return {
    async create(request: Request, userId: string) {
      try {
        const env = ports.environment(),
          origin = onboardingAppOrigin(request, env)
        ports.checkSignup()
        if (request.method !== 'POST' || new URL(request.url).search)
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        const key = IdempotencyKeySchema.safeParse(
          request.headers.get('Idempotency-Key')
        )
        if (!key.success)
          throw new OnboardingError(400, 'INVALID_IDEMPOTENCY_KEY')
        const parsed = CreateOrganizationInputSchema.safeParse(
          await readOnboardingBody(request)
        )
        if (!parsed.success)
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        const receipt = CreateOrganizationResponseSchema.parse(
          await ports.provision(
            userId,
            parsed.data,
            key.data,
            {
              ip: clientIpFromHeaders(request.headers, env),
              userAgent: request.headers.get('user-agent'),
            },
            request,
            origin
          )
        )
        return onboardingReply(receipt, 201, {
          'Set-Cookie': selectedTenantPreferenceCookie(
            receipt.organization.id,
            origin.startsWith('https:')
          ),
        })
      } catch (error) {
        return onboardingFailure(error)
      }
    },
    async slug(request: Request, _userId: string) {
      try {
        const env = ports.environment()
        onboardingAppOrigin(request, env)
        ports.checkSignup()
        const query = new URL(request.url).searchParams
        if (
          request.method !== 'GET' ||
          query.size !== 1 ||
          query.getAll('slug').length !== 1
        )
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        const parsed = SlugAvailabilityQuerySchema.safeParse(
          Object.fromEntries(query)
        )
        if (!parsed.success)
          throw new OnboardingError(400, 'ONBOARDING_INPUT_INVALID')
        return onboardingReply(
          SlugAvailabilityResponseSchema.parse(
            await ports.slugAvailability(
              parsed.data.slug,
              clientIpFromHeaders(request.headers, env)
            )
          )
        )
      } catch (error) {
        return onboardingFailure(error)
      }
    },
  }
}
