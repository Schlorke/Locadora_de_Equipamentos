import type { PlatformEnvSource } from '@gb-locacoes/contracts/platform'
import { rejectExplicitCrossOrigin } from './explicit-origin'

/** Private mailbox/OAuth validates explicit Origin even on GET.
 * Without Origin, native/server calls and top-level OAuth navigation remain valid.
 * Headers-only classification reuses the central trusted-edge comparison;
 * the generic safe-method policy is unchanged.
 */
export function rejectUntrustedZohoOrigin(
  request?: Request,
  env: PlatformEnvSource = process.env
): Response | null {
  return rejectExplicitCrossOrigin(request, env)
}
