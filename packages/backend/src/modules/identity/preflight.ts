export type LegacyIdentity = {
  id: string
  email: string
  password: string | null
  emailVerified: Date | null
}

export type IdentityPreflight = {
  users: number
  credentialAccounts: number
  oauthOnly: number
  normalizedEmailChanges: number
  duplicateEmailGroups: number
  invalidEmailCount: number
  unsupportedPasswordHashes: number
  canApply: boolean
}

export function inspectIdentityMigration(
  users: readonly LegacyIdentity[]
): IdentityPreflight {
  const groups = new Map<string, number>()
  let invalidEmailCount = 0
  let unsupportedPasswordHashes = 0
  let normalizedEmailChanges = 0
  let credentialAccounts = 0
  for (const user of users) {
    const normalized = user.email.trim().toLowerCase()
    groups.set(normalized, (groups.get(normalized) || 0) + 1)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) invalidEmailCount++
    if (normalized !== user.email) normalizedEmailChanges++
    if (user.password) {
      credentialAccounts++
      if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password))
        unsupportedPasswordHashes++
    }
  }
  const duplicateEmailGroups = [...groups.values()].filter(
    (count) => count > 1
  ).length
  return {
    users: users.length,
    credentialAccounts,
    oauthOnly: users.length - credentialAccounts,
    normalizedEmailChanges,
    duplicateEmailGroups,
    invalidEmailCount,
    unsupportedPasswordHashes,
    canApply:
      duplicateEmailGroups === 0 &&
      invalidEmailCount === 0 &&
      unsupportedPasswordHashes === 0,
  }
}
