import type { TenantTransactionRunner } from '../rentals/index'
import type { createZohoMailClient } from './zoho-client'
export function createZohoMailTokenReader({
  withTenantTransaction,
  refreshAccessToken,
  getZohoMailBaseUrl,
}: {
  withTenantTransaction: TenantTransactionRunner
  refreshAccessToken: ReturnType<
    typeof createZohoMailClient
  >['refreshAccessToken']
  getZohoMailBaseUrl: () => string
}) {
  async function getZohoAccessToken(
    context: { tenantId: string },
    userId: string
  ): Promise<string | null> {
    const row = await withTenantTransaction(context, (tx) =>
      tx.zohoMailToken.findUnique({
        where: { tenantId_userId: { tenantId: context.tenantId, userId } },
      })
    )
    if (
      !row ||
      new URL(getZohoMailBaseUrl()).hostname !== `mail.zoho.${row.datacenter}`
    )
      return null

    const now = new Date()
    if (row.expiresAt > now) {
      return row.accessToken
    }

    try {
      const { access_token, expires_in } = await refreshAccessToken(
        row.refreshToken
      )
      const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000)
      await withTenantTransaction(context, (tx) =>
        tx.zohoMailToken.update({
          where: { tenantId_userId: { tenantId: context.tenantId, userId } },
          data: { accessToken: access_token, expiresAt },
        })
      )
      return access_token
    } catch {
      return null
    }
  }

  /** Retorna o accountId armazenado para o usuário, se existir. */
  async function getZohoAccountId(
    context: { tenantId: string },
    userId: string
  ): Promise<string | null> {
    const row = await withTenantTransaction(context, (tx) =>
      tx.zohoMailToken.findUnique({
        where: { tenantId_userId: { tenantId: context.tenantId, userId } },
        select: { accountId: true },
      })
    )
    return row?.accountId ?? null
  }

  return { getZohoAccessToken, getZohoAccountId }
}
