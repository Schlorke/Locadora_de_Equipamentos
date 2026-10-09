import type { createZohoMailClient } from '../modules/communications/zoho-client'
import type { createZohoMailTokenReader } from '../modules/communications/zoho-tokens'
type TokenReader = ReturnType<typeof createZohoMailTokenReader>
type ReadContext = { tenantId: string }
import { normalizeFromAddress } from '../modules/communications/zoho-address'
import { rejectUntrustedZohoOrigin } from './zoho-origin'
type ToAddressEntry = { emailAddress?: string; displayName?: string }

function hasValidAddress(entry: ToAddressEntry): boolean {
  const email = entry.emailAddress?.trim()
  const name = entry.displayName?.trim()
  return Boolean(email ?? name)
}

function decodeHtmlEntities(value: string): string {
  // &amp; must be decoded FIRST to avoid double-decoding
  // Example: "&amp;lt;" should become "&lt;", not "<"
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseAddressString(value: string): ToAddressEntry | null {
  const decoded = decodeHtmlEntities(value).trim()
  if (!decoded) return null
  const match = decoded.match(/^(?:"?([^"]+)"?\s*)?<([^>]+)>$/)
  if (match) {
    const displayName = match[1]?.trim() || undefined
    const emailAddress = match[2]?.trim() || undefined
    return hasValidAddress({ emailAddress, displayName })
      ? { emailAddress, displayName }
      : null
  }
  if (decoded.includes('@')) {
    return { emailAddress: decoded }
  }
  return { displayName: decoded }
}

/** Converte toAddress da Zoho (string, objeto ou array) em array de { emailAddress?, displayName? }, excluindo entradas vazias. */
function normalizeToAddress(value: unknown): ToAddressEntry[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    const mapped = value
      .map((item): ToAddressEntry | null => {
        if (typeof item === 'string') {
          return parseAddressString(item)
        }
        if (item != null && typeof item === 'object') {
          const o = item as Record<string, unknown>
          const entry: ToAddressEntry = {
            emailAddress:
              typeof o.emailAddress === 'string' ? o.emailAddress : undefined,
            displayName:
              typeof o.displayName === 'string' ? o.displayName : undefined,
          }
          return hasValidAddress(entry) ? entry : null
        }
        return null
      })
      .filter((e): e is ToAddressEntry => e != null)
    return mapped
  }
  if (typeof value === 'string') {
    const decoded = decodeHtmlEntities(value)
    const parts = decoded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return []
    return parts
      .map((part) => parseAddressString(part))
      .filter((entry): entry is ToAddressEntry => entry != null)
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const entry: ToAddressEntry = {
      emailAddress:
        typeof o.emailAddress === 'string' ? o.emailAddress : undefined,
      displayName:
        typeof o.displayName === 'string' ? o.displayName : undefined,
    }
    return hasValidAddress(entry) ? [entry] : []
  }
  return []
}

function parseZohoTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return asNumber
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) return ms
  }
  return undefined
}

function parseZohoBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true') return true
    if (normalized === '0' || normalized === 'false') return false
  }
  return undefined
}

function normalizeMessageToAddress(
  msg: Record<string, unknown>
): Record<string, unknown> {
  const toRaw = msg.toAddress ?? msg.toAddresses
  const toAddress = normalizeToAddress(toRaw)
  return { ...msg, toAddress }
}

export function createZohoMailMessageReader({
  getZohoAccessToken,
  getZohoAccountId,
  makeZohoMailRequest,
  getZohoMailBaseUrl,
}: {
  getZohoAccessToken: TokenReader['getZohoAccessToken']
  getZohoAccountId: TokenReader['getZohoAccountId']
  makeZohoMailRequest: ReturnType<
    typeof createZohoMailClient
  >['makeZohoMailRequest']
  getZohoMailBaseUrl: () => string
}) {
  async function readMessage(
    context: ReadContext,
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

    const denied = rejectUntrustedZohoOrigin(request)
    if (denied) return denied
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const folderId = searchParams.get('folderId')
    const { messageId } = await params

    if (!accountId || !folderId || !messageId) {
      return Response.json(
        { error: 'accountId, folderId e messageId são obrigatórios' },
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
      const [detailsRaw, contentRaw] = await Promise.all([
        makeZohoMailRequest<{ data?: unknown }>(
          accessToken,
          `/accounts/${accountId}/folders/${folderId}/messages/${messageId}/details`
        ),
        makeZohoMailRequest<{ data?: unknown }>(
          accessToken,
          `/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`
        ),
      ])

      const detailsPayload = detailsRaw.data ?? detailsRaw
      const details =
        detailsPayload && typeof detailsPayload === 'object'
          ? (detailsPayload as Record<string, unknown>)
          : null

      if (!details) {
        return Response.json(
          { error: 'Metadata inválida retornada pela Zoho Mail API' },
          { status: 502 }
        )
      }

      const contentPayload = contentRaw.data ?? contentRaw
      const contentRecord =
        contentPayload && typeof contentPayload === 'object'
          ? (contentPayload as Record<string, unknown>)
          : null

      const htmlContent =
        typeof contentRecord?.content === 'string'
          ? contentRecord.content
          : typeof contentRecord?.htmlContent === 'string'
            ? contentRecord.htmlContent
            : undefined

      const hasAttachment =
        parseZohoBoolean(details.hasAttachment) ??
        parseZohoBoolean(details.hasAttachments)

      let attachments: Array<{
        attachmentId: string
        fileName: string
        size?: number
      }> = []
      let inlineImages: Array<{
        attachmentId: string
        cid: string
        fileName: string
      }> = []

      if (hasAttachment) {
        try {
          const attachRaw = await makeZohoMailRequest<{ data?: unknown }>(
            accessToken,
            `/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachmentinfo`,
            { searchParams: { includeInline: 'true' } }
          )
          const attachPayload = attachRaw.data ?? attachRaw
          const attachData =
            attachPayload && typeof attachPayload === 'object'
              ? (attachPayload as Record<string, unknown>)
              : null

          // Anexos regulares
          const list = Array.isArray(attachData?.attachments)
            ? (attachData?.attachments as Array<Record<string, unknown>>)
            : []
          attachments = list
            .map((item) => ({
              attachmentId:
                typeof item.attachmentId === 'string'
                  ? item.attachmentId
                  : String(item.attachmentId ?? ''),
              fileName:
                typeof item.attachmentName === 'string'
                  ? item.attachmentName
                  : typeof item.fileName === 'string'
                    ? item.fileName
                    : 'attachment',
              size:
                typeof item.attachmentSize === 'number'
                  ? item.attachmentSize
                  : typeof item.size === 'number'
                    ? item.size
                    : undefined,
            }))
            .filter((item) => item.attachmentId)

          // Imagens inline (embedded) - têm cid para referência no HTML
          const inlineList = Array.isArray(attachData?.inline)
            ? (attachData?.inline as Array<Record<string, unknown>>)
            : []
          inlineImages = inlineList
            .map((item) => ({
              attachmentId:
                typeof item.attachmentId === 'string'
                  ? item.attachmentId
                  : String(item.attachmentId ?? ''),
              cid: typeof item.cid === 'string' ? item.cid : '',
              fileName:
                typeof item.attachmentName === 'string'
                  ? item.attachmentName
                  : typeof item.fileName === 'string'
                    ? item.fileName
                    : 'inline-image',
            }))
            .filter((item) => item.attachmentId && item.cid)
        } catch {
          attachments = []
          inlineImages = []
        }
      }

      const buildInlineUrl = (contentId: string, fileName?: string) =>
        `/api/admin/zoho-mail/messages/${messageId}/inline?accountId=${accountId}&folderId=${folderId}&contentId=${encodeURIComponent(contentId)}&fileName=${encodeURIComponent(fileName ?? 'inline-image')}`

      // Substituir referências cid: no HTML por URLs para a API de inline images
      let processedHtmlContent = htmlContent
      if (processedHtmlContent && inlineImages.length > 0) {
        for (const img of inlineImages) {
          // Escapar caracteres especiais do cid para uso em regex (inclui [ ] e \)
          // ] no início da classe (\]); [ em JS é literal dentro de []
          const cidEscaped = img.cid.replace(/[\]\\^$.*+?()[{}|]/g, '\\$&')
          // Substituir cid:xxx por URL da API
          const cidRegex = new RegExp(`cid:${cidEscaped}`, 'gi')
          const inlineUrl = buildInlineUrl(img.cid, img.fileName)
          processedHtmlContent = processedHtmlContent.replace(
            cidRegex,
            inlineUrl
          )
        }
      }

      // Alguns conteúdos do Zoho vêm com /mail/ImageDisplay? (webmail). Reescrever para o proxy inline.
      // O HTML pode ter entidades codificadas (&amp; em vez de &), então precisamos tratar isso.
      if (processedHtmlContent) {
        const mailWebBaseUrl = getZohoMailBaseUrl().replace(/\/api$/, '')
        // Regex mais abrangente para capturar URLs de imagens inline do Zoho
        // Inclui variações com e sem protocolo, com e sem barra inicial
        const imageDisplayRegex =
          /(?:https?:)?\/\/[^"'\s>]*\/mail\/ImageDisplay\?[^"'\s>]+|\/?mail\/ImageDisplay\?[^"'\s>]+/gi

        processedHtmlContent = processedHtmlContent.replace(
          imageDisplayRegex,
          (match) => {
            try {
              // Decodificar entidades HTML comuns na URL (&amp; -> &)
              const decodedMatch = match
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
              const url = new URL(decodedMatch, mailWebBaseUrl)
              const contentId =
                url.searchParams.get('cid') ?? url.searchParams.get('contentId')
              if (!contentId) return match
              const fileName =
                url.searchParams.get('f') ??
                url.searchParams.get('fileName') ??
                'inline-image'
              return buildInlineUrl(contentId, fileName)
            } catch {
              // Fallback: tentar extrair cid diretamente via regex se URL parser falhar
              const cidMatch = match.match(/[?&]cid=([^&"'\s>]+)/i)
              const fileMatch = match.match(/[?&]f=([^&"'\s>]+)/i)
              if (cidMatch?.[1]) {
                const cid = decodeURIComponent(
                  cidMatch[1].replace(/&amp;/g, '&')
                )
                const file = fileMatch?.[1]
                  ? decodeURIComponent(fileMatch[1].replace(/&amp;/g, '&'))
                  : 'inline-image'
                return buildInlineUrl(cid, file)
              }
              return match
            }
          }
        )
      }

      const normalized = normalizeMessageToAddress({
        messageId: String(details.messageId ?? messageId),
        subject:
          typeof details.subject === 'string' ? details.subject : undefined,
        summary:
          typeof details.summary === 'string' ? details.summary : undefined,
        fromAddress: normalizeFromAddress(
          details.fromAddress ?? details.sender
        ),
        toAddress: details.toAddress,
        receivedTime:
          parseZohoTimestamp(details.receivedTime) ??
          parseZohoTimestamp(details.sentTime) ??
          parseZohoTimestamp(details.sentDateInGMT),
        sentTime: parseZohoTimestamp(details.sentDateInGMT),
        isRead: parseZohoBoolean(details.status),
        hasAttachments: hasAttachment,
        attachments,
        htmlContent: processedHtmlContent,
        content: processedHtmlContent,
      })

      return Response.json({ message: normalized })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar mensagem'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { readMessage }
}
