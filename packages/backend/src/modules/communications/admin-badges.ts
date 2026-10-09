import type { TenantTransactionRunner } from '../rentals/index'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { createZohoMailClient } from './zoho-client'
import type { createZohoMailTokenReader } from './zoho-tokens'
interface BadgesResponse {
  email: number
  quotes: number
  rentals: number
  whatsapp: number
}

export function createAdminBadges({
  withTenantTransaction,
  isZohoOAuthConfigured,
  makeZohoMailRequest,
  getZohoAccessToken,
  getZohoAccountId,
}: { withTenantTransaction: TenantTransactionRunner } & Pick<
  ReturnType<typeof createZohoMailClient>,
  'isZohoOAuthConfigured' | 'makeZohoMailRequest'
> &
  ReturnType<typeof createZohoMailTokenReader>) {
  async function readAdminBadges(
    context: TenantContext,
    userId?: string
  ): Promise<BadgesResponse> {
    const [quotesCount, rentalsCount, whatsappCount, emailCount] =
      await Promise.all([
        // Orçamentos pendentes
        withTenantTransaction(context, (prisma) =>
          prisma.quote.count({
            where: { tenantId: context.tenantId, status: 'PENDING' },
          })
        ),

        // Locações aguardando ação (PENDING = aguardando checkout, PENDING_RETURN = aguardando devolução)
        withTenantTransaction(context, (prisma) =>
          prisma.rentals.count({
            where: {
              tenantId: context.tenantId,
              status: {
                in: ['PENDING', 'PENDING_RETURN'],
              },
              // Excluir locações órfãs (sem orçamento vinculado)
              quoteId: { not: null },
            },
          })
        ),

        // WhatsApp: mensagens recebidas (INBOUND) que não foram respondidas
        // Uma conversa "não respondida" é aquela cuja última mensagem é INBOUND
        getUnrespondedWhatsAppCount(context),

        // Emails não lidos (Zoho Mail) - com timeout para não bloquear
        getUnreadEmailCount(context, userId),
      ])

    const badges: BadgesResponse = {
      email: emailCount,
      quotes: quotesCount,
      rentals: rentalsCount,
      whatsapp: whatsappCount,
    }

    return badges
  }
  async function getUnrespondedWhatsAppCount(context: {
    tenantId: string
  }): Promise<number> {
    try {
      // Buscar conversas onde a última mensagem é INBOUND (recebida do cliente)
      const conversations = await withTenantTransaction(context, (prisma) =>
        prisma.whatsAppConversation.findMany({
          where: { tenantId: context.tenantId },
          select: {
            id: true,
            messages: {
              select: {
                direction: true,
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: 1,
            },
          },
        })
      )

      // Contar conversas onde a última mensagem é INBOUND
      return conversations.filter(
        (conv) => conv.messages[0]?.direction === 'INBOUND'
      ).length
    } catch {
      // Se o modelo WhatsApp ainda não existe ou há erro, retorna 0
      return 0
    }
  }

  /**
   * Obtém contagem de emails não lidos do Zoho Mail.
   * Retorna 0 se Zoho não estiver configurado ou houver erro.
   */
  async function getUnreadEmailCount(
    context: { tenantId: string },
    userId?: string
  ): Promise<number> {
    // Se Zoho não está configurado, retorna 0
    if (!isZohoOAuthConfigured() || !userId) {
      return 0
    }

    try {
      const accessToken = await getZohoAccessToken(context, userId)
      if (!accessToken) {
        return 0
      }

      const accountId = await getZohoAccountId(context, userId)
      if (!accountId) {
        return 0
      }

      // Buscar pastas para obter unreadCount do Inbox (timeout 5s para não bloquear o endpoint)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const raw = await makeZohoMailRequest<{
          data?: Array<{
            folderId?: string
            folderName?: string
            unreadCount?: number
            folderType?: string
          }>
          folders?: Array<{
            folderId?: string
            folderName?: string
            unreadCount?: number
            folderType?: string
          }>
        }>(accessToken, `/accounts/${accountId}/folders`, {
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const folders = Array.isArray(raw.data) ? raw.data : (raw.folders ?? [])

        // Encontrar a pasta Inbox (geralmente folderType === '1' ou folderName === 'Inbox')
        const inbox = folders.find(
          (f) =>
            f.folderType === '1' ||
            f.folderName?.toLowerCase() === 'inbox' ||
            f.folderName?.toLowerCase() === 'caixa de entrada'
        )

        return inbox?.unreadCount ?? 0
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === 'AbortError') {
          // Timeout de 5s: Zoho demorou demais; retornar 0 para não bloquear badges
          return 0
        }
        return 0
      }
    } catch {
      return 0
    }
  }

  return { readAdminBadges }
}
