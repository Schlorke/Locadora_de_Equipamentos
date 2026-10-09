import type {
  ZohoMutationContext,
  ZohoMutationPorts,
} from './zoho-mutation-ports'
import { createZohoMailCommands } from '../modules/communications/zoho-command'
import { zohoCommandResponse } from './zoho-command-response'
export function createZohoMailDeleter({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  withTenantTransaction,
}: ZohoMutationPorts) {
  const commands = createZohoMailCommands({ withTenantTransaction })
  async function deleteMessage(
    scope: ZohoMutationContext,
    userId: string | undefined,
    request: Request,
    parameters: { params: Promise<{ messageId: string }> }
  ): Promise<Response> {
    const { params } = parameters
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const folderId = searchParams.get('folderId')
    const expunge = searchParams.get('expunge') === 'true'
    const { messageId } = await params

    if (!accountId || !folderId || !messageId) {
      return Response.json(
        { error: 'accountId, folderId e messageId são obrigatórios' },
        { status: 400 }
      )
    }

    if (accountId !== (await getZohoAccountId(scope, userId)))
      return Response.json(
        { error: 'Conta de e-mail não autorizada nesta locadora' },
        { status: 403 }
      )
    const accessToken = await getZohoAccessToken(scope, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado' },
        { status: 401 }
      )
    }

    try {
      const path = `/accounts/${accountId}/folders/${folderId}/messages/${messageId}`
      return await commands.execute(
        scope,
        {
          userId,
          operation: 'DELETE',
          accountId,
          key: request.headers.get('x-idempotency-key'),
          payload: { folderId, messageId, expunge },
        },
        async () => {
          await makeZohoMailRequest(accessToken, path, {
            method: 'DELETE',
            searchParams: expunge ? { expunge: 'true' } : undefined,
          })
          return Response.json({ success: true })
        }
      )
    } catch (e) {
      const denied = zohoCommandResponse(e)
      if (denied) return denied
      const msg = e instanceof Error ? e.message : 'Erro ao excluir mensagem'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { deleteMessage }
}
