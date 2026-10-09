import type {
  ZohoMutationContext,
  ZohoMutationPorts,
  ZohoRatePorts,
} from './zoho-mutation-ports'
import {
  SaveDraftSchema,
  type SaveDraftInput,
} from '@gb-locacoes/contracts/zoho-mail'
import { ZodError } from 'zod'
import { createZohoMailCommands } from '../modules/communications/zoho-command'
import { zohoCommandResponse } from './zoho-command-response'
import {
  sanitizeHtml,
  plainTextToHtml,
} from '../modules/communications/zoho-content'
export function createZohoMailDraftWriter<TRequest extends Request>({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  checkRateLimit,
  adminApiRateLimit,
  withTenantTransaction,
}: ZohoMutationPorts &
  Pick<ZohoRatePorts<TRequest>, 'checkRateLimit' | 'adminApiRateLimit'>) {
  const commands = createZohoMailCommands({ withTenantTransaction })
  async function saveDraft(
    scope: ZohoMutationContext,
    userId: string | undefined,
    request: TRequest
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    // --- Rate limiting (200/min — auto-save fires every 2.5s) ---
    const rateLimitResult = checkRateLimit(request, adminApiRateLimit)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    const accessToken = await getZohoAccessToken(scope, userId)
    if (!accessToken) {
      return Response.json(
        { error: 'Zoho Mail não conectado. Conecte em /admin/email.' },
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

    // --- Parse & validate body ---
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return Response.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      )
    }

    let body: SaveDraftInput
    try {
      body = SaveDraftSchema.parse(raw)
    } catch (e) {
      if (e instanceof ZodError) {
        return Response.json(
          {
            error: 'Dados inválidos',
            details: e.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 }
        )
      }
      return Response.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      )
    }

    // --- Sanitize content ---
    const finalMailFormat = body.mailFormat
    const normalizedContent = body.content ?? ''
    const finalContent =
      finalMailFormat === 'html'
        ? sanitizeHtml(plainTextToHtml(normalizedContent))
        : normalizedContent

    // --- Build payload ---
    const payload: Record<string, unknown> = {
      fromAddress: body.fromAddress,
      content: finalContent,
      mailFormat: finalMailFormat,
    }
    if (body.toAddress) payload.toAddress = body.toAddress
    if (body.ccAddress) payload.ccAddress = body.ccAddress
    if (body.bccAddress) payload.bccAddress = body.bccAddress
    if (body.subject) payload.subject = body.subject
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      payload.attachments = body.attachments
    }

    const normalizedDraftMessageId = body.draftMessageId ?? null

    try {
      return await commands.execute(
        scope,
        {
          userId,
          operation: 'DRAFT',
          accountId,
          key: request.headers.get('x-idempotency-key'),
          payload: {
            draftFolderId: body.draftFolderId,
            draftMessageId: normalizedDraftMessageId,
            body: payload,
          },
        },
        async () => {
          const result = await makeZohoMailRequest<Record<string, unknown>>(
            accessToken,
            `/accounts/${accountId}/folders/${body.draftFolderId}/messages`,
            {
              method: 'POST',
              body: payload,
            }
          )

          const data = (result as { data?: unknown })?.data
          const draftId =
            typeof (data as { messageId?: string })?.messageId === 'string'
              ? (data as { messageId: string }).messageId
              : Array.isArray(data)
                ? (() => {
                    const first = data.find(
                      (item) =>
                        item &&
                        typeof item === 'object' &&
                        typeof (item as { messageId?: string }).messageId ===
                          'string'
                    ) as { messageId?: string } | undefined
                    return typeof first?.messageId === 'string'
                      ? first.messageId
                      : null
                  })()
                : typeof (result as { messageId?: string })?.messageId ===
                    'string'
                  ? (result as { messageId: string }).messageId
                  : null

          if (
            normalizedDraftMessageId &&
            draftId &&
            normalizedDraftMessageId !== draftId
          ) {
            try {
              await makeZohoMailRequest(
                accessToken,
                `/accounts/${accountId}/folders/${body.draftFolderId}/messages/${normalizedDraftMessageId}`,
                { method: 'DELETE' }
              )
            } catch {
              // Ignorar falha ao remover o rascunho anterior.
            }
          }

          return Response.json({ success: true, draftId })
        }
      )
    } catch (e) {
      const denied = zohoCommandResponse(e)
      if (denied) return denied
      const msg = e instanceof Error ? e.message : 'Erro ao salvar rascunho'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { saveDraft }
}
