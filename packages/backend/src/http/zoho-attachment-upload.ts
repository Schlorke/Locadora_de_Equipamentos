import type {
  ZohoMutationContext,
  ZohoMutationPorts,
  ZohoRatePorts,
} from './zoho-mutation-ports'
import type { createZohoMailClient } from '../modules/communications/zoho-client'
import { createHash } from 'node:crypto'
import { createZohoMailCommands } from '../modules/communications/zoho-command'
import { zohoCommandResponse } from './zoho-command-response'
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50 MB total

type UploadPayload = {
  attachments: Array<{
    storeName: string
    attachmentName: string
    attachmentPath: string
    fileName: string
    size?: number
  }>
}

function isFile(value: unknown): value is File {
  return (
    typeof File !== 'undefined' &&
    value instanceof File &&
    typeof value.arrayBuffer === 'function'
  )
}

export function createZohoMailAttachmentUploader<TRequest extends Request>({
  getZohoAccessToken,
  getZohoAccountId,
  uploadZohoMailAttachments,
  checkRateLimit,
  adminApiRateLimit,
  withTenantTransaction,
}: Omit<ZohoMutationPorts, 'makeZohoMailRequest'> &
  Pick<ReturnType<typeof createZohoMailClient>, 'uploadZohoMailAttachments'> &
  Pick<ZohoRatePorts<TRequest>, 'checkRateLimit' | 'adminApiRateLimit'>) {
  const commands = createZohoMailCommands({ withTenantTransaction })
  async function uploadAttachments(
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

    // --- Rate limiting ---
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

    let formData: { getAll(_name: string): unknown[] }
    try {
      formData = (await request.formData()) as {
        getAll(_name: string): unknown[]
      }
    } catch {
      return Response.json(
        { error: 'Falha ao ler arquivos enviados' },
        { status: 400 }
      )
    }

    const files = formData.getAll('files').filter(isFile)
    if (files.length === 0) {
      return Response.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // --- File size validation ---
    let totalSize = 0
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          {
            error: `Arquivo "${file.name || 'anexo'}" excede o limite de 20 MB`,
          },
          { status: 400 }
        )
      }
      totalSize += file.size
    }
    if (totalSize > MAX_TOTAL_SIZE) {
      return Response.json(
        { error: 'O total de anexos excede o limite de 50 MB' },
        { status: 400 }
      )
    }

    try {
      return await commands.execute(
        scope,
        {
          userId,
          operation: 'UPLOAD',
          accountId,
          key: request.headers.get('x-idempotency-key'),
          payload: async () =>
            Promise.all(
              files.map(async (file) => ({
                name: file.name,
                size: file.size,
                type: file.type,
                sha256: createHash('sha256')
                  .update(new Uint8Array(await file.arrayBuffer()))
                  .digest('hex'),
              }))
            ),
        },
        async () => {
          const attachments = await uploadZohoMailAttachments(
            accessToken,
            accountId,
            files.map((file) => ({
              file,
              fileName: file.name || 'anexo',
              size: file.size,
            }))
          )

          const payload: UploadPayload = { attachments }
          return Response.json(payload)
        }
      )
    } catch (e) {
      const denied = zohoCommandResponse(e)
      if (denied) return denied
      const msg = e instanceof Error ? e.message : 'Erro ao enviar anexos'
      return Response.json({ error: msg }, { status: 500 })
    }
  }
  return { uploadAttachments }
}
