import type {
  ZohoMutationContext,
  ZohoMutationPorts,
} from './zoho-mutation-ports'
import { createZohoMailCommands } from '../modules/communications/zoho-command'
import { zohoCommandResponse } from './zoho-command-response'
type UpdateAction =
  | 'archive'
  | 'unarchive'
  | 'read'
  | 'unread'
  | 'move'
  | 'star'
  | 'unstar'
  | 'spam'
  | 'notspam'

const ACTION_TO_MODE: Record<UpdateAction, string> = {
  archive: 'archiveMails',
  unarchive: 'unArchiveMails',
  read: 'markAsRead',
  unread: 'markAsUnread',
  move: 'moveMessage',
  star: 'setFlag',
  unstar: 'setFlag',
  spam: 'moveToSpam',
  notspam: 'markNotSpam',
}

export function createZohoMailUpdater({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  withTenantTransaction,
}: ZohoMutationPorts) {
  const commands = createZohoMailCommands({ withTenantTransaction })
  async function updateMessages(
    scope: ZohoMutationContext,
    userId: string | undefined,
    request: Request
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      messageIds,
      threadIds,
      action,
      targetFolderId,
      sourceFolderId,
      isArchive,
      isFolderSpecific,
    } = body as {
      messageIds?: string[]
      threadIds?: string[]
      action?: UpdateAction
      targetFolderId?: string
      sourceFolderId?: string
      isArchive?: boolean
      isFolderSpecific?: boolean
    }

    if (!action) {
      return Response.json({ error: 'action é obrigatório' }, { status: 400 })
    }

    if (action === 'move' && !targetFolderId) {
      return Response.json(
        { error: 'targetFolderId é obrigatório para action=move' },
        { status: 400 }
      )
    }

    const accessToken = await getZohoAccessToken(scope, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado' },
        { status: 401 }
      )
    }

    const accountId = await getZohoAccountId(scope, userId)
    if (!accountId) {
      return Response.json(
        { error: 'accountId não encontrado. Reconecte o Zoho Mail.' },
        { status: 400 }
      )
    }

    try {
      const mode = ACTION_TO_MODE[action]
      if (!mode) {
        return Response.json({ error: 'Ação inválida' }, { status: 400 })
      }

      // Zoho exige messageId como JSON Array of long. IDs podem exceder
      // Number.MAX_SAFE_INTEGER, então geramos JSON com números "puros" sem
      // converter para Number (preserva precisão).
      const normalizedMessageIds = (messageIds ?? [])
        .map((id) => (typeof id === 'string' ? id.trim() : String(id)))
        .filter((id) => id.length > 0 && /^\d+$/.test(id))
      const normalizedThreadIds = (threadIds ?? [])
        .map((id) => (typeof id === 'string' ? id.trim() : String(id)))
        .filter((id) => id.length > 0 && /^\d+$/.test(id))
      const supportsThreadIds = [
        'archive',
        'unarchive',
        'read',
        'unread',
        'move',
        'spam',
        'notspam',
        'star',
        'unstar',
      ].includes(action)
      const useThreadIds = supportsThreadIds && normalizedThreadIds.length > 0
      const hasMessageIds = normalizedMessageIds.length > 0
      if (!useThreadIds && !hasMessageIds) {
        return Response.json(
          { error: 'messageIds inválidos ou não numéricos' },
          { status: 400 }
        )
      }

      const parts: string[] = [`"mode":${JSON.stringify(mode)}`]
      if (action === 'move') {
        const dest =
          typeof targetFolderId === 'string' ? targetFolderId.trim() : ''
        if (!dest || !/^\d+$/.test(dest)) {
          return Response.json(
            { error: 'targetFolderId inválido ou não numérico' },
            { status: 400 }
          )
        }
        parts.push(`"destfolderId":${dest}`)
        if (
          typeof sourceFolderId === 'string' &&
          /^\d+$/.test(sourceFolderId)
        ) {
          parts.push(`"folderId":${sourceFolderId}`)
        }
        if (isArchive === true) {
          parts.push(`"isArchive":true`)
        }
        if (isFolderSpecific === true) {
          parts.push(`"isFolderSpecific":true`)
        }
      }
      if (action === 'star' || action === 'unstar') {
        parts.push(
          `"flagid":${JSON.stringify(
            action === 'star' ? 'important' : 'flag_not_set'
          )}`
        )
      }
      if (useThreadIds) {
        parts.push(`"threadId":[${normalizedThreadIds.join(',')}]`)
      }
      if (hasMessageIds && (!useThreadIds || action === 'move')) {
        parts.push(`"messageId":[${normalizedMessageIds.join(',')}]`)
      }
      const payload = `{${parts.join(',')}}`

      return await commands.execute(
        scope,
        {
          userId,
          operation: 'UPDATE',
          accountId,
          key: request.headers.get('x-idempotency-key'),
          payload,
        },
        async () => {
          const result = await makeZohoMailRequest<{
            status?: { code?: number; description?: string }
          }>(accessToken, `/accounts/${accountId}/updatemessage`, {
            method: 'PUT',
            body: payload,
          })

          const code = result?.status?.code
          if (code != null && code !== 200) {
            const desc =
              result?.status?.description ?? 'Erro ao atualizar mensagens'
            return Response.json(
              {
                error:
                  typeof desc === 'string'
                    ? desc
                    : 'Erro ao atualizar mensagens',
              },
              { status: 400 }
            )
          }

          return Response.json({ success: true, result })
        }
      )
    } catch (e) {
      const denied = zohoCommandResponse(e)
      if (denied) return denied
      const msg = e instanceof Error ? e.message : 'Erro ao atualizar mensagens'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { updateMessages }
}
