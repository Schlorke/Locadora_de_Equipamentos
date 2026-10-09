import type { PrismaClient } from '@prisma/client'
import { inspectIdentityMigration } from './preflight'

export async function migrateLegacyIdentities(
  prisma: PrismaClient,
  apply = false
) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true, emailVerified: true },
  })
  const report = inspectIdentityMigration(users)
  const accounts = await prisma.account.findMany({
    where: { provider: { in: ['google', 'facebook'] } },
  })
  const existingAccounts = await prisma.authAccount.findMany({
    select: { providerId: true, accountId: true, userId: true },
  })
  const owners = new Map(
    existingAccounts.map((account) => [
      `${account.providerId}:${account.accountId}`,
      account.userId,
    ])
  )
  const conflictingAccounts =
    accounts.filter((account) => {
      const owner = owners.get(
        `${account.provider}:${account.providerAccountId}`
      )
      return owner && owner !== account.userId
    }).length +
    users.filter((user) => {
      const owner = owners.get(`credential:${user.id}`)
      return owner && owner !== user.id
    }).length
  const result = {
    ...report,
    oauthAccounts: accounts.length,
    conflictingAccounts,
    canApply: report.canApply && conflictingAccounts === 0,
    applied: false,
  }
  if (!apply || !result.canApply) return result
  await prisma.$transaction(
    async (tx) => {
      for (const user of users) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: user.email.trim().toLowerCase(),
            authEmailVerified: Boolean(user.emailVerified),
          },
        })
        if (user.password) {
          await tx.authAccount.upsert({
            where: {
              providerId_accountId: {
                providerId: 'credential',
                accountId: user.id,
              },
            },
            create: {
              accountId: user.id,
              providerId: 'credential',
              userId: user.id,
              password: user.password,
            },
            update: { password: user.password },
          })
        }
      }
      for (const account of accounts) {
        await tx.authAccount.upsert({
          where: {
            providerId_accountId: {
              providerId: account.provider,
              accountId: account.providerAccountId,
            },
          },
          create: {
            id: account.id,
            userId: account.userId,
            providerId: account.provider,
            accountId: account.providerAccountId,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            idToken: account.id_token,
            accessTokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            scope: account.scope,
          },
          update: {},
        })
      }
    },
    { timeout: 60_000 }
  )
  return { ...result, applied: true }
}
