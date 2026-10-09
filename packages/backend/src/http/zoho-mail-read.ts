import type { createZohoMailClient } from '../modules/communications/zoho-client'
import type { createZohoMailTokenReader } from '../modules/communications/zoho-tokens'
type TokenReader = ReturnType<typeof createZohoMailTokenReader>
type ReadContext = { tenantId: string }
import { normalizeFromAddress } from '../modules/communications/zoho-address'
import { rejectUntrustedZohoOrigin } from './zoho-origin'
export function createZohoMailListReader({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
}: {
  getZohoAccessToken: TokenReader['getZohoAccessToken']
  getZohoAccountId: TokenReader['getZohoAccountId']
  makeZohoMailRequest: ReturnType<
    typeof createZohoMailClient
  >['makeZohoMailRequest']
}) {
  async function listAccounts(
    context: ReadContext,
    userId: string | undefined,
    request?: Request
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    const denied = rejectUntrustedZohoOrigin(request)
    if (denied) return denied
    const accessToken = await getZohoAccessToken(context, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado. Conecte em Configurações.' },
        { status: 401 }
      )
    }

    try {
      const raw = await makeZohoMailRequest<{
        data?: unknown[]
        accounts?: unknown[]
      }>(accessToken, '/accounts')

      // raw.data já é o array de contas: { status, data: [...] }
      const list = Array.isArray(raw.data) ? raw.data : (raw.accounts ?? [])

      return Response.json({ accounts: list })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar contas Zoho'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  async function listFolders(
    context: ReadContext,
    userId: string | undefined,
    request: Request
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    const denied = rejectUntrustedZohoOrigin(request)
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    if (!accountId) {
      return Response.json(
        { error: 'accountId é obrigatório' },
        { status: 400 }
      )
    }

    if (accountId !== (await getZohoAccountId(context, userId)))
      return Response.json(
        { error: 'Conta de e-mail não autorizada nesta locadora' },
        { status: 403 }
      )
    const accessToken = await getZohoAccessToken(context, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado. Conecte em Configurações.' },
        { status: 401 }
      )
    }

    try {
      const raw = await makeZohoMailRequest<{
        data?: unknown[]
        folders?: unknown[]
      }>(accessToken, `/accounts/${accountId}/folders`)
      // Zoho pode retornar { status, data: [...] } ou { folders: [...] }
      const list = Array.isArray(raw.data) ? raw.data : (raw.folders ?? [])
      return Response.json({ folders: list })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar pastas'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  async function listMessages(
    context: ReadContext,
    userId: string | undefined,
    request: Request
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    const denied = rejectUntrustedZohoOrigin(request)
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const folderId = searchParams.get('folderId')
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)
    const start = Number(searchParams.get('start')) || 0

    if (!accountId || !folderId) {
      return Response.json(
        { error: 'accountId e folderId são obrigatórios' },
        { status: 400 }
      )
    }

    if (accountId !== (await getZohoAccountId(context, userId)))
      return Response.json(
        { error: 'Conta de e-mail não autorizada nesta locadora' },
        { status: 403 }
      )
    const accessToken = await getZohoAccessToken(context, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado. Conecte em Configurações.' },
        { status: 401 }
      )
    }

    /** Zoho list retorna status como "0" (não lido) / "1" (lido); converte para isRead boolean. */
    function parseReadStatus(value: unknown): boolean | undefined {
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') {
        if (value === 1) return true
        if (value === 0) return false
      }
      if (typeof value === 'string') {
        const n = value.trim().toLowerCase()
        if (n === '1' || n === 'true') return true
        if (n === '0' || n === 'false') return false
      }
      return undefined
    }

    try {
      const raw = await makeZohoMailRequest<{
        data?: unknown[]
        messages?: unknown[]
      }>(accessToken, `/accounts/${accountId}/messages/view`, {
        searchParams: { folderId, limit, start },
      })
      // Zoho pode retornar { status, data: [...] } ou { messages: [...] }
      const list = Array.isArray(raw.data) ? raw.data : (raw.messages ?? [])
      // Normalizar fromAddress e status→isRead (Zoho usa "status": "0"/"1", frontend espera isRead boolean)
      const messages = list.map((item: unknown) => {
        const msg =
          item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : {}
        const from = normalizeFromAddress(msg.fromAddress ?? msg.sender)
        const isRead =
          typeof msg.isRead === 'boolean'
            ? msg.isRead
            : parseReadStatus(msg.status)
        return {
          ...msg,
          fromAddress: from ?? undefined,
          ...(isRead !== undefined && { isRead }),
        }
      })
      return Response.json({ messages })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao listar mensagens'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { listAccounts, listFolders, listMessages }
}
