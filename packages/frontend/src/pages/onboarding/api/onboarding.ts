import { z } from 'zod'
import {
  OnboardingOptionsResponseSchema,
  SlugAvailabilityResponseSchema,
  CreateOrganizationResponseSchema,
  type CreateOrganizationInput,
} from '@gb-locacoes/contracts/onboarding'
import {
  OwnerAccountResponseSchema,
  type OwnerRegistrationInput,
} from '@gb-locacoes/contracts/credentials'
import type {
  HttpClient,
  HttpJsonResponse,
  HttpRequest,
} from '../../../shared/api'

export class OnboardingRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super('Não foi possível concluir esta etapa.')
  }
}
async function request<T>(
  client: HttpClient,
  path: string,
  schema: z.ZodType<T>,
  options: HttpRequest = {}
): Promise<T> {
  const response = await client.request<HttpJsonResponse<unknown>>(path, {
    ...options,
    responseType: 'json-response',
  })
  if (!response.ok) {
    const error = z
      .object({ code: z.string().max(80) })
      .safeParse(response.data)
    throw new OnboardingRequestError(
      error.success ? error.data.code : 'ONBOARDING_UNAVAILABLE',
      response.status
    )
  }
  const parsed = schema.safeParse(response.data)
  if (!parsed.success)
    throw new OnboardingRequestError('ONBOARDING_RECEIPT_UNAVAILABLE', 503)
  return parsed.data
}
const accepted = z.strictObject({ message: z.string().min(1).max(500) })
const post = (
  body: unknown,
  headers: Record<string, string> = {}
): HttpRequest => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...headers },
})
export const onboardingApi = {
  options: (client: HttpClient) =>
    request(client, '/api/onboarding/options', OnboardingOptionsResponseSchema),
  account: (client: HttpClient) =>
    request(client, '/api/auth/owner-account', OwnerAccountResponseSchema),
  register: (
    client: HttpClient,
    input: OwnerRegistrationInput,
    token: string
  ) =>
    request(
      client,
      '/api/auth/owner-register',
      accepted,
      post(input, { 'X-Platform-Captcha': token })
    ),
  resend: (client: HttpClient) =>
    request(client, '/api/auth/owner-verification', accepted, post({})),
  slug: (client: HttpClient, slug: string) =>
    request(
      client,
      '/api/onboarding/slug-availability?slug=' + encodeURIComponent(slug),
      SlugAvailabilityResponseSchema
    ),
  create: (
    client: HttpClient,
    input: CreateOrganizationInput,
    key: string,
    token: string
  ) =>
    request(
      client,
      '/api/onboarding/organizations',
      CreateOrganizationResponseSchema,
      post(input, { 'Idempotency-Key': key, 'X-Platform-Captcha': token })
    ),
}
