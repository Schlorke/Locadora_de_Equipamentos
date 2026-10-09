import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import {
  AdminStorefrontLegalBodySchema,
  storefrontLegalKindFromSlug,
  type AdminStorefrontLegalResponse,
  type StorefrontLegalDocument,
  type StorefrontLegalDocumentResponse,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import type {
  PublicRequestTenant,
  PublicRequestTenantOptions,
  TenantPrincipal,
} from '../modules/identity/index'

// Textos legais da vitrine por locadora (onda 134; decisão do dono de 2026-10-06, item 3). A mesma fábrica nos dois
// hosts de API (raiz legada e apps/services/api), com a composição de `modules/catalog`.

const NO_STORE = { 'Cache-Control': 'no-store' } as const

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: NO_STORE })

const unknownKind = () =>
  reply(
    { error: 'Documento não encontrado', code: 'LEGAL_DOCUMENT_UNKNOWN' },
    404
  )

const notPublished = () =>
  reply(
    {
      error: 'Documento não publicado nesta locadora',
      code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
    },
    404
  )

type KindParams = { params: Promise<{ kind: string }> }

/**
 * `GET /api/settings/public/legal-documents/{terms|privacy|return-policy}`: o texto legal publicado da locadora.
 * Superfície `identity`, explícita: com o site no ar ou em pausa responde (decisão do dono de 2026-10-06, item 4: as
 * páginas legais continuam no ar na pausa); desligado ou desconhecido dá o mesmo 404 do D10. Tipo inválido: 404 antes
 * de qualquer leitura.
 */
export function createPublicStorefrontLegalHandler(deps: {
  resolveTenant: (
    _request: Request,
    _options: PublicRequestTenantOptions
  ) => Promise<PublicRequestTenant>
  getDocument: (
    _context: TenantContext,
    _kind: StorefrontLegalKind
  ) => Promise<StorefrontLegalDocumentResponse | null>
}) {
  return async function GET(
    request: Request,
    { params }: KindParams
  ): Promise<Response> {
    try {
      const kind = storefrontLegalKindFromSlug((await params).kind)
      if (!kind) return unknownKind()
      const tenant = await deps.resolveTenant(request, {
        trim: true,
        requiredCode: true,
        surface: 'identity',
      })
      if (!tenant.ok) return tenant.response
      const document = await deps.getDocument(tenant.context, kind)
      return document ? reply(document) : notPublished()
    } catch (error) {
      console.error(
        'Erro ao buscar texto legal da locadora:',
        error instanceof Error ? error.name : 'erro'
      )
      return reply({ error: 'Não foi possível carregar o documento' }, 500)
    }
  }
}

/** Teto do corpo do PUT do painel (o documento validado tem até 200.000 bytes). */
export const ADMIN_STOREFRONT_LEGAL_MAX_BODY_BYTES = 262_144

type BodyRead = { ok: true; text: string } | { ok: false; response: Response }

/** Lê o corpo contando bytes; acima do teto, 413 sem ler o resto. */
async function readBoundedBody(request: Request): Promise<BodyRead> {
  const declared = Number(request.headers.get('Content-Length') ?? '')
  if (
    Number.isFinite(declared) &&
    declared > ADMIN_STOREFRONT_LEGAL_MAX_BODY_BYTES
  )
    return {
      ok: false,
      response: reply({ error: 'Corpo excede o limite.' }, 413),
    }
  const reader = request.body?.getReader()
  if (!reader) return { ok: true, text: '' }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let text = ''
  let bytes = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) {
        text += decoder.decode()
        return { ok: true, text }
      }
      bytes += chunk.value.byteLength
      if (bytes > ADMIN_STOREFRONT_LEGAL_MAX_BODY_BYTES) {
        await reader.cancel()
        return {
          ok: false,
          response: reply({ error: 'Corpo excede o limite.' }, 413),
        }
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } catch {
    return {
      ok: false,
      response: reply(
        { error: 'Documento inválido.', code: 'LEGAL_DOCUMENT_INVALID' },
        400
      ),
    }
  } finally {
    reader.releaseLock()
  }
}

const invalidDocument = () =>
  reply({ error: 'Documento inválido.', code: 'LEGAL_DOCUMENT_INVALID' }, 400)

type WriteResult =
  | { ok: true; value: AdminStorefrontLegalResponse }
  | {
      ok: false
      code: 'SETTINGS_NOT_CONFIGURED' | 'LEGAL_DOCUMENT_NOT_PUBLISHED'
    }

const writeReply = (result: WriteResult) => {
  if (result.ok) return reply(result.value)
  return result.code === 'SETTINGS_NOT_CONFIGURED'
    ? reply(
        {
          error:
            'Salve as configurações da locadora antes de publicar os textos legais.',
          code: 'SETTINGS_NOT_CONFIGURED',
        },
        409
      )
    : notPublished()
}

const failure = (error: unknown) => {
  console.error(
    'Erro no texto legal do painel:',
    error instanceof Error ? error.name : 'erro'
  )
  return reply({ error: 'Não foi possível concluir a operação.' }, 500)
}

/**
 * `GET/PUT/DELETE /api/admin/settings/legal-documents/{kind}` depois da guarda da rota (`SETTINGS` READ no GET e WRITE
 * no PUT e no DELETE, mesma origem nas escritas): tipo pelo segmento, corpo com teto de 256 kB (413), documento pelo
 * contrato estrito (400) e respostas sem cache. A publicação e a despublicação (com a auditoria) são dos casos de uso
 * de `modules/catalog/admin-settings`.
 */
export function createAdminStorefrontLegalHandlers(deps: {
  getDocument: (
    _principal: TenantPrincipal,
    _kind: StorefrontLegalKind
  ) => Promise<AdminStorefrontLegalResponse>
  saveDocument: (
    _principal: TenantPrincipal,
    _kind: StorefrontLegalKind,
    _document: StorefrontLegalDocument
  ) => Promise<WriteResult>
  removeDocument: (
    _principal: TenantPrincipal,
    _kind: StorefrontLegalKind
  ) => Promise<WriteResult>
}) {
  async function read(principal: TenantPrincipal, slug: string) {
    const kind = storefrontLegalKindFromSlug(slug)
    if (!kind) return unknownKind()
    try {
      return reply(await deps.getDocument(principal, kind))
    } catch (error) {
      return failure(error)
    }
  }

  async function publish(
    principal: TenantPrincipal,
    slug: string,
    request: Request
  ) {
    const kind = storefrontLegalKindFromSlug(slug)
    if (!kind) return unknownKind()
    const contentType = request.headers
      .get('Content-Type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase()
    if (contentType !== 'application/json')
      return reply({ error: 'Corpo JSON obrigatório.' }, 415)
    const body = await readBoundedBody(request)
    if (!body.ok) return body.response
    let json: unknown
    try {
      json = JSON.parse(body.text)
    } catch {
      return invalidDocument()
    }
    const parsed = AdminStorefrontLegalBodySchema.safeParse(json)
    if (!parsed.success) return invalidDocument()
    try {
      return writeReply(
        await deps.saveDocument(principal, kind, parsed.data.document)
      )
    } catch (error) {
      return failure(error)
    }
  }

  async function unpublish(principal: TenantPrincipal, slug: string) {
    const kind = storefrontLegalKindFromSlug(slug)
    if (!kind) return unknownKind()
    try {
      return writeReply(await deps.removeDocument(principal, kind))
    } catch (error) {
      return failure(error)
    }
  }

  return { read, publish, unpublish }
}
