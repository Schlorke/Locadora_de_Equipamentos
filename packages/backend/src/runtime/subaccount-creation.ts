import { SubaccountModelSchema } from '@gb-locacoes/contracts/payment-account'
import {
  canonicalOrigin,
  resolvePlatformEnv,
} from '@gb-locacoes/contracts/platform'
import type { SubaccountCreationSettings } from '../modules/payment-accounts/index'
import { secretsConfigured } from './secrets'

type Env = Readonly<Record<string, string | undefined>>

export type SubaccountCreationConfiguration = SubaccountCreationSettings & {
  rootKey: string
  origin: string
  email: string
}

/**
 * The single reading of the receiving-account creation switches (ADR SaaS B.14), shared by both API hosts:
 * - `flag`: `PLATFORM_SUBACCOUNT_CREATION`, `off` when absent; any other value than `on`/`off` is `invalid`;
 * - `model`: `PLATFORM_ASAAS_SUBACCOUNT_MODEL` when valid;
 * - `config`: present only with the flag `on`, the `STANDARD` model (BAAS waits for the documents lot), the
 *   environment, the root credential, the webhook origin, the operations e-mail, the vault and the canonical
 *   company site. `PLATFORM_SUBACCOUNT_REQUIRES_PAID` is `false` only for the literal `false` (fail closed).
 */
export function readSubaccountCreationConfiguration(env: Env): {
  flag: 'on' | 'off' | 'invalid'
  model: 'STANDARD' | 'BAAS' | null
  config: SubaccountCreationConfiguration | null
} {
  const raw = env.PLATFORM_SUBACCOUNT_CREATION?.trim()
  const flag: 'on' | 'off' | 'invalid' =
    !raw || raw === 'off' ? 'off' : raw === 'on' ? 'on' : 'invalid'
  const parsedModel = SubaccountModelSchema.safeParse(
    env.PLATFORM_ASAAS_SUBACCOUNT_MODEL?.trim()
  )
  const model = parsedModel.success ? parsedModel.data : null
  const unavailable = { flag, model, config: null }
  if (flag !== 'on' || model !== 'STANDARD') return unavailable
  const environment = env.PLATFORM_ASAAS_ENVIRONMENT
  const rootKey = env.PLATFORM_ASAAS_ROOT_API_KEY?.trim()
  const origin = env.PLATFORM_WEBHOOK_ORIGIN?.trim()
  const email = env.PLATFORM_OPS_EMAIL?.trim()
  if (
    (environment !== 'sandbox' && environment !== 'production') ||
    !rootKey ||
    !origin ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !secretsConfigured(env)
  )
    return unavailable
  try {
    const url = new URL(origin)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return unavailable
    // Host configuration that cannot derive the company sites keeps the creation unavailable.
    const platform = resolvePlatformEnv(env)
    const site = (slug: string) => canonicalOrigin(platform, { slug })
    return {
      flag,
      model,
      config: {
        environment,
        model,
        requiresPaid: env.PLATFORM_SUBACCOUNT_REQUIRES_PAID?.trim() !== 'false',
        site,
        rootKey,
        origin: url.origin,
        email,
      },
    }
  } catch {
    return unavailable
  }
}

/** Maintenance input: cancel unsent requests only when the switch is plainly off or the model changed. */
export function subaccountMaintenanceSwitch(
  creation: ReturnType<typeof readSubaccountCreationConfiguration>
): { enabled: boolean; model: 'STANDARD' | 'BAAS' | null } {
  // An invalid switch is incomplete configuration, never an instruction to cancel the pending requests.
  if (creation.flag === 'invalid') return { enabled: true, model: null }
  return { enabled: creation.flag === 'on', model: creation.model }
}
