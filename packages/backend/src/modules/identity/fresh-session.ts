/** Authentication time is supplied by a verified engine, never by request data. */
export function isFreshAuthentication(
  authenticatedAt: unknown,
  now: Date
): boolean {
  return (
    typeof authenticatedAt === 'number' &&
    Number.isSafeInteger(authenticatedAt) &&
    authenticatedAt > 0 &&
    authenticatedAt <= now.getTime() &&
    now.getTime() - authenticatedAt <= 10 * 60_000
  )
}

/** Better Auth preserves createdAt while renewing updatedAt/expiresAt. */
export function identityAuthenticationTime(value: unknown): number | undefined {
  if (!(value instanceof Date)) return undefined
  const instant = value.getTime()
  return Number.isSafeInteger(instant) && instant > 0 ? instant : undefined
}
