import { isSameOriginMutation } from '@gb-locacoes/backend/identity'
export function isTrustedMutationOrigin(
  request: Request,
  configuredOrigin = process.env.WEB_PUBLIC_ORIGIN
): boolean {
  return isSameOriginMutation(request, process.env, configuredOrigin ?? '')
}
