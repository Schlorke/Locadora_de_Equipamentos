import type { TenantTransactionRunner } from '../modules/rentals/index'
export function createZohoOAuthDisconnect({
  withTenantTransaction,
}: {
  withTenantTransaction: TenantTransactionRunner
}) {
  async function disconnectZohoOAuth(
    principal: { tenantId: string },
    userId: string | undefined
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    await withTenantTransaction(principal, (tx) =>
      tx.zohoMailToken.deleteMany({
        where: { tenantId: principal.tenantId, userId },
      })
    )
    return Response.json({ success: true })
  }
  return { disconnectZohoOAuth }
}
