import type { IdentityMode } from './configuration'

/** Framework readers stay in the host; the cutover policy is shared. */
export function createApplicationSessionReader<Session, Options>(readers: {
  mode(): IdentityMode
  identityEnabled(): boolean
  identity(): Promise<Session | null>
  legacy(_options?: Options): Promise<Session | null>
}) {
  return async function getServerSession(
    options?: Options
  ): Promise<Session | null> {
    const mode = readers.mode()
    if (readers.identityEnabled()) {
      try {
        const session = await readers.identity()
        if (session) return session
      } catch {
        // Missing configuration or storage must never revive old JWTs after cutover.
        if (mode === 'better-auth') return null
      }
    }
    if (mode === 'better-auth') return null
    return readers.legacy(options)
  }
}
