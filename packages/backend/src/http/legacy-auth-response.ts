import { AUTH_UNAVAILABLE_RETRY_SECONDS } from '../modules/identity/legacy-credentials'
import { SIGN_IN_UNAVAILABLE } from '../modules/identity/legacy-auth'
import { refuseNextAuthRead } from '../modules/identity/engine-read-origin'
type RouteHandler<C> = (_request: Request, _context: C) => Promise<Response>

/**
 * NextAuth answers every error of the credentials callback with 401. A
 * sign-in that could not be counted or checked (`SIGN_IN_UNAVAILABLE`) is an
 * outage, not a wrong password: like the other identity flows, it answers 503
 * with `Retry-After` and `no-store` (429 only ever means a limit was reached),
 * keeping the JSON body `{ url }` the NextAuth client reads the code from.
 * Other responses pass through untouched.
 */
export async function signInAvailability(
  response: Response
): Promise<Response> {
  if (response.status !== 401) return response
  let url: unknown
  try {
    url = ((await response.clone().json()) as { url?: unknown } | null)?.url
  } catch {
    return response
  }
  if (typeof url !== 'string') return response
  let code: string | null
  try {
    code = new URL(url, 'http://localhost').searchParams.get('error')
  } catch {
    return response
  }
  if (code !== SIGN_IN_UNAVAILABLE) return response
  const headers = new Headers(response.headers)
  headers.set('Retry-After', String(AUTH_UNAVAILABLE_RETRY_SECONDS))
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, { status: 503, headers })
}

/**
 * The NextAuth route handler of both hosts (`withSignInAvailability(NextAuth(authOptions))` in the `[...nextauth]`
 * routes, legacy and better-auth-v2 modes):
 * - its reads (`session`, `csrf`, `providers` and every other GET/HEAD but the cross-site navigations) with an
 *   explicit Origin of another origin get the central 403 before the engine and its storage (`refuseNextAuthRead`,
 *   the rule the Better Auth reads follow; wave 133, finding 149). Without an Origin, or with the own one, the engine
 *   answers as before; mutations keep its double-submit token;
 * - `signInAvailability` is applied to its answers.
 */
export function withSignInAvailability<C>(
  handler: RouteHandler<C>
): RouteHandler<C> {
  return async (request, context) =>
    refuseNextAuthRead(request) ??
    signInAvailability(await handler(request, context))
}
