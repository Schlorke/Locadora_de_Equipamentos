import type { createZohoMailTokenReader } from '../modules/communications/zoho-tokens'
import { rejectUntrustedZohoOrigin } from './zoho-origin'
type TokenReader = ReturnType<typeof createZohoMailTokenReader>
type ReadContext = { tenantId: string }
export function createZohoMailContentReader({
  getZohoAccessToken,
  getZohoAccountId,
  getZohoMailBaseUrl,
  ZOHO_MAIL_API_BASE,
}: {
  getZohoAccessToken: TokenReader['getZohoAccessToken']
  getZohoAccountId: TokenReader['getZohoAccountId']
  getZohoMailBaseUrl: () => string
  ZOHO_MAIL_API_BASE: string
}) {
  async function downloadAttachment(
    context: ReadContext,
    userId: string | undefined,
    request: Request,
    parameters: { params: Promise<{ messageId: string; attachmentId: string }> }
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
    const filename = searchParams.get('filename') || 'attachment'
    const { messageId, attachmentId } = await parameters.params

    if (!accountId || !folderId || !messageId || !attachmentId) {
      return Response.json(
        {
          error:
            'accountId, folderId, messageId e attachmentId são obrigatórios',
        },
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
        { error: 'Zoho Mail não conectado. Conecte em /admin/email.' },
        { status: 401 }
      )
    }

    const url = `${ZOHO_MAIL_API_BASE}/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachments/${attachmentId}`

    try {
      const zohoRes = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          Accept: 'application/octet-stream',
        },
      })

      if (!zohoRes.ok) {
        const text = await zohoRes.text()
        return Response.json(
          { error: text || 'Erro ao obter anexo da Zoho Mail' },
          { status: zohoRes.status }
        )
      }

      const contentType =
        zohoRes.headers.get('content-type') || 'application/octet-stream'
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const disposition = `attachment; filename="${safeFilename}"`

      return new Response(zohoRes.body ?? undefined, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': disposition,
          'Cache-Control': 'private, no-store',
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao baixar anexo'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  async function readInlineImage(
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
    const contentId = searchParams.get('contentId')
    const fileName = searchParams.get('fileName') || 'inline-image'
    const { messageId } = await params

    if (!accountId || !folderId || !messageId || !contentId) {
      return Response.json(
        {
          error: 'accountId, folderId, messageId e contentId são obrigatórios',
        },
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
      const baseUrl = getZohoMailBaseUrl()
      const url = new URL(
        `${baseUrl}/accounts/${accountId}/folders/${folderId}/messages/${messageId}/inline`
      )
      url.searchParams.set('contentId', contentId)
      url.searchParams.set('fileName', fileName)

      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      })

      if (!response.ok) {
        const status = response.status
        // Tentar obter mais detalhes do erro
        const errorText = await response.text().catch(() => '')
        console.error(
          `[Zoho Inline] Erro ${status} ao buscar imagem: ${contentId}`,
          errorText
        )
        return Response.json(
          { error: 'Erro ao buscar imagem inline' },
          { status }
        )
      }

      const contentType =
        response.headers.get('content-type') || 'application/octet-stream'

      // Usar Uint8Array em vez de ArrayBuffer para evitar problemas de streaming
      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      return new Response(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(uint8Array.byteLength),
          'Cache-Control': 'private, no-store',
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Erro ao buscar imagem inline'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { downloadAttachment, readInlineImage }
}
