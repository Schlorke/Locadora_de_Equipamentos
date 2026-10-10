import type {
  ZohoMutationContext,
  ZohoMutationPorts,
  ZohoRatePorts,
  ZohoSendPorts,
} from './zoho-mutation-ports'
import {
  SendEmailSchema as ReplyEmailSchema,
  type SendEmailInput as ReplyEmailInput,
} from '@gb-locacoes/contracts/zoho-mail'
import { ZodError } from 'zod'
import { createZohoMailCommands } from '../modules/communications/zoho-command'
import { zohoCommandResponse } from './zoho-command-response'
import {
  sanitizeHtml,
  plainTextToHtml,
} from '../modules/communications/zoho-content'
export function createZohoMailReplier<TRequest extends Request>({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  checkRateLimit,
  strictRateLimit,
  checkIdempotency,
  storeIdempotency,
  withTenantTransaction,
  logger,
}: ZohoMutationPorts &
  Pick<ZohoRatePorts<TRequest>, 'checkRateLimit' | 'strictRateLimit'> &
  ZohoSendPorts) {
  const commands = createZohoMailCommands({ withTenantTransaction })
  async function replyMessage(
    scope: ZohoMutationContext,
    userId: string | undefined,
    request: TRequest,
    parameters: { params: Promise<{ messageId: string }> }
  ): Promise<Response> {
    if (!userId) {
      return Response.json(
        { error: 'Usuário não identificado' },
        { status: 401 }
      )
    }

    // --- Rate limiting ---
    const rateLimitResult = checkRateLimit(request, strictRateLimit)
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    // --- Idempotency ---
    const suppliedKey = request.headers.get('x-idempotency-key')
    // Compatibilidade do cache: o prefixo app/api/... é namespace textual da antiga app/ retirada em F, não import de arquivo.
    // Mantê-lo idêntico preserva as chaves existentes quando usesLegacyIdempotency() seleciona esse caminho.
    const idempotencyKey = suppliedKey
      ? `${scope.tenantId}:${userId}:app/api/admin/zoho-mail/messages/[messageId]/reply/route.ts:${suppliedKey}`
      : null
    const cached = commands.usesLegacyIdempotency()
      ? checkIdempotency(idempotencyKey)
      : null
    if (cached) {
      return Response.json(cached)
    }

    // --- Zoho tokens ---
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

    // --- Validate messageId ---
    const { messageId } = await parameters.params
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      return Response.json(
        { error: 'messageId é obrigatório' },
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

    let body: ReplyEmailInput
    try {
      body = ReplyEmailSchema.parse(raw)
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
    const finalContent =
      finalMailFormat === 'html'
        ? sanitizeHtml(plainTextToHtml(body.content))
        : body.content

    // --- Build payload ---
    const payload: Record<string, unknown> = {
      fromAddress: body.fromAddress,
      toAddress: body.toAddress,
      subject: body.subject,
      content: finalContent,
      action: 'Reply',
      mailFormat: finalMailFormat,
    }
    if (body.ccAddress) payload.ccAddress = body.ccAddress
    if (body.bccAddress) payload.bccAddress = body.bccAddress
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      payload.attachments = body.attachments
    }

    // --- Reply via Zoho ---
    try {
      const response = await commands.execute(
        scope,
        {
          userId,
          operation: 'REPLY',
          accountId,
          key: suppliedKey,
          payload: { messageId, body: payload },
          audit: { action: 'SEND', entity: 'EMAIL', entityId: messageId },
        },
        async () => {
          await makeZohoMailRequest(
            accessToken,
            `/accounts/${accountId}/messages/${messageId}`,
            {
              method: 'POST',
              body: payload,
            }
          )
          return Response.json({ success: true })
        }
      )

      const responseData = { success: true }

      // Store idempotency result
      if (commands.usesLegacyIdempotency()) {
        storeIdempotency(idempotencyKey, responseData)

        // Audit log (fire-and-forget)
        await withTenantTransaction(scope, (tx) =>
          tx.auditLog.create({
            data: {
              tenantId: scope.tenantId,
              userId,
              action: 'SEND',
              entity: 'EMAIL',
              entityId: messageId,
            },
          })
        )
      }

      logger.info(
        { userId, to: body.toAddress, subject: body.subject, messageId },
        'Email reply sent via Zoho'
      )

      return response
    } catch (e) {
      const denied = zohoCommandResponse(e)
      if (denied) return denied
      const msg = e instanceof Error ? e.message : 'Erro ao enviar resposta'
      logger.error(
        { userId, messageId, error: msg },
        'Failed to send email reply via Zoho'
      )
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { replyMessage }
}
