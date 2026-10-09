import { isSameOriginMutation } from '@gb-locacoes/backend/identity'

/**
 * Browser mutations must come from the expected public origin. One rule for
 * the whole backend: this delegates to the same-origin guard of the identity
 * module (`isSameOriginMutation`), also applied centrally by
 * `resolveTenantPrincipal` and the `requireAdmin` middlewares.
 *
 * - With a validated platform edge (tenant, app or apex host), the expected
 *   origin is the one the edge computed for that host: a tenant host never
 *   accepts another tenant's origin, even though all subdomains are same-site.
 * - Without an edge, the configured public origin (`configuredOrigin`,
 *   `WEB_PUBLIC_ORIGIN` by default) across the temporary API proxy, or the
 *   request's own origin when unset; an invalid configured origin refuses.
 * - `Sec-Fetch-Site` must be `same-origin` or `none` when present.
 * - Without browser headers (`Origin`, `Sec-Fetch-Site`), as before: accepted.
 */
export function isTrustedMutationOrigin(
  request: Request,
  configuredOrigin = process.env.WEB_PUBLIC_ORIGIN
): boolean {
  return isSameOriginMutation(request, process.env, configuredOrigin ?? '')
}
