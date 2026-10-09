import { describe, expect, it, vi } from 'vitest'
import type {
  StorefrontLegalDocument,
  StorefrontLegalDocumentResponse,
  StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import type { TenantContext } from '@gb-locacoes/domain/tenancy'
import type { TenantPrincipal } from '../modules/identity/index'
import {
  ADMIN_STOREFRONT_LEGAL_MAX_BODY_BYTES,
  createAdminStorefrontLegalHandlers,
  createPublicStorefrontLegalHandler,
} from './storefront-legal'

// Onda 134 (lote vitrine-conteúdo): rota pública do texto legal da locadora (superfície `identity`: no ar e em pausa
// respondem, desligado dá o 404 do D10) e as funções do painel que as rotas dos dois hosts chamam depois da guarda.
const documento: StorefrontLegalDocument = {
  version: 1,
  lastUpdated: '23 de Junho de 2025',
  sections: [
    {
      id: 'contato',
      title: 'Contato',
      blocks: [{ type: 'paragraph', text: 'Fale conosco.' }],
      contactCard: true,
    },
  ],
}
const params = (kind: string) => ({ params: Promise.resolve({ kind }) })
const principal: TenantPrincipal = {
  tenantId: 'tenant-alfa',
  userId: 'user-alfa',
  membershipId: 'membership-alfa',
  role: 'ADMIN',
}

describe('createPublicStorefrontLegalHandler', () => {
  const resolved = {
    ok: true as const,
    context: { tenantId: 'tenant-alfa' },
    slug: 'alfa',
    edge: null,
    site: { mode: 'PAUSED' as const, indexable: false },
  }
  type GetDocument = (
    context: TenantContext,
    kind: StorefrontLegalKind
  ) => Promise<StorefrontLegalDocumentResponse | null>
  const setup = (
    getDocument = vi.fn<GetDocument>(async () => ({
      kind: 'privacy',
      document: documento,
      publishedAt: '2026-10-06T12:00:00.000Z',
    }))
  ) => {
    const resolveTenant = vi.fn(async () => resolved)
    return {
      resolveTenant,
      getDocument,
      GET: createPublicStorefrontLegalHandler({ resolveTenant, getDocument }),
    }
  }

  it('resolve a locadora na superfície identity (a pausa não esconde os textos legais) e devolve o documento', async () => {
    const { resolveTenant, getDocument, GET } = setup()
    const request = new Request(
      'https://backend.internal/api/settings/public/legal-documents/privacy?tenantSlug=alfa'
    )
    const response = await GET(request, params('privacy'))
    expect(resolveTenant).toHaveBeenCalledWith(request, {
      trim: true,
      requiredCode: true,
      surface: 'identity',
    })
    expect(getDocument).toHaveBeenCalledWith(
      { tenantId: 'tenant-alfa' },
      'privacy'
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      kind: 'privacy',
      document: documento,
      publishedAt: '2026-10-06T12:00:00.000Z',
    })
  })

  it.each(['returnPolicy', 'cookies', 'TERMS', '__proto__', 'terms%2F'])(
    'tipo inválido %s: 404 antes de resolver a locadora ou ler o banco',
    async (kind) => {
      const { resolveTenant, getDocument, GET } = setup()
      const response = await GET(
        new Request('https://backend.internal/x'),
        params(kind)
      )
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(await response.json()).toEqual({
        error: 'Documento não encontrado',
        code: 'LEGAL_DOCUMENT_UNKNOWN',
      })
      expect(resolveTenant).not.toHaveBeenCalled()
      expect(getDocument).not.toHaveBeenCalled()
    }
  )

  it('a recusa da locadora (desligada, desconhecida, conflito) sai como o resolvedor a montou', async () => {
    const recusa = Response.json(
      { error: 'Locadora não encontrada' },
      { status: 404 }
    )
    const getDocument = vi.fn()
    const GET = createPublicStorefrontLegalHandler({
      resolveTenant: vi.fn(async () => ({
        ok: false as const,
        code: 'TENANT_NOT_FOUND' as const,
        response: recusa,
      })),
      getDocument,
    })
    expect(
      await GET(new Request('https://backend.internal/x'), params('terms'))
    ).toBe(recusa)
    expect(getDocument).not.toHaveBeenCalled()
  })

  it('sem documento publicado: 404 próprio', async () => {
    const { GET } = setup(vi.fn<GetDocument>(async () => null))
    const response = await GET(
      new Request('https://backend.internal/x'),
      params('return-policy')
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      error: 'Documento não publicado nesta locadora',
      code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
    })
  })

  it('falha do banco: 500 sem detalhe', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { GET } = setup(
      vi.fn<GetDocument>(async () => {
        throw new Error('connect ECONNREFUSED fixture-private')
      })
    )
    const response = await GET(
      new Request('https://backend.internal/x'),
      params('terms')
    )
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('fixture-private')
    error.mockRestore()
  })
})

describe('createAdminStorefrontLegalHandlers (depois da guarda SETTINGS)', () => {
  const setup = () => {
    const deps = {
      getDocument: vi.fn(async (_p: TenantPrincipal, kind: string) => ({
        kind: kind as 'terms',
        document: null,
        publishedAt: null,
      })),
      saveDocument: vi.fn(
        async (
          _p: TenantPrincipal,
          kind: string,
          document: StorefrontLegalDocument
        ) => ({
          ok: true as const,
          value: {
            kind: kind as 'terms',
            document,
            publishedAt: '2026-10-06T12:00:00.000Z',
          },
        })
      ),
      removeDocument: vi.fn(async (_p: TenantPrincipal, kind: string) => ({
        ok: true as const,
        value: { kind: kind as 'terms', document: null, publishedAt: null },
      })),
    }
    return { deps, handlers: createAdminStorefrontLegalHandlers(deps) }
  }
  const put = (body: string, headers: Record<string, string> = {}) =>
    new Request(
      'https://app.platform.test/api/admin/settings/legal-documents/terms',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      }
    )

  it('lê o documento da locadora do principal, sem cache', async () => {
    const { deps, handlers } = setup()
    const response = await handlers.read(principal, 'return-policy')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(deps.getDocument).toHaveBeenCalledWith(principal, 'returnPolicy')
    expect(await response.json()).toEqual({
      kind: 'returnPolicy',
      document: null,
      publishedAt: null,
    })
  })

  it.each(['read', 'publish', 'unpublish'] as const)(
    '%s com tipo inválido: 404 sem chamar o caso de uso',
    async (operation) => {
      const { deps, handlers } = setup()
      const response =
        operation === 'publish'
          ? await handlers.publish(principal, 'cookies', put('{}'))
          : await handlers[operation](principal, 'cookies')
      expect(response.status).toBe(404)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(deps.getDocument).not.toHaveBeenCalled()
      expect(deps.saveDocument).not.toHaveBeenCalled()
      expect(deps.removeDocument).not.toHaveBeenCalled()
    }
  )

  it('publica o documento validado', async () => {
    const { deps, handlers } = setup()
    const response = await handlers.publish(
      principal,
      'terms',
      put(JSON.stringify({ document: documento }))
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(deps.saveDocument).toHaveBeenCalledWith(
      principal,
      'terms',
      documento
    )
    expect((await response.json()).document).toEqual(documento)
  })

  it('corpo acima de 256 kB: 413 pelo cabeçalho e pela leitura, sem gravar', async () => {
    const { deps, handlers } = setup()
    expect(ADMIN_STOREFRONT_LEGAL_MAX_BODY_BYTES).toBe(262_144)
    const grande = JSON.stringify({
      document: { ...documento, intro: 'x'.repeat(262_144) },
    })
    expect(
      (await handlers.publish(principal, 'terms', put(grande))).status
    ).toBe(413)
    // Sem Content-Length (corpo em stream): o limite vale na leitura.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(grande))
        controller.close()
      },
    })
    const streamed = new Request(
      'https://app.platform.test/api/admin/settings/legal-documents/terms',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit
    )
    expect((await handlers.publish(principal, 'terms', streamed)).status).toBe(
      413
    )
    expect(deps.saveDocument).not.toHaveBeenCalled()
  })

  it.each([
    ['JSON quebrado', '{', 400],
    ['sem o envelope', JSON.stringify(documento), 400],
    [
      'documento inválido',
      JSON.stringify({ document: { ...documento, version: 2 } }),
      400,
    ],
    [
      'HTML como bloco',
      JSON.stringify({
        document: {
          ...documento,
          sections: [
            {
              id: 'a',
              title: 'A',
              blocks: [{ type: 'html', text: '<b>x</b>' }],
            },
          ],
        },
      }),
      400,
    ],
  ] as const)('%s: %s', async (_caso, body, status) => {
    const { deps, handlers } = setup()
    const response = await handlers.publish(principal, 'terms', put(body))
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({
      code: 'LEGAL_DOCUMENT_INVALID',
    })
    expect(deps.saveDocument).not.toHaveBeenCalled()
  })

  it('corpo que não é JSON: 415', async () => {
    const { deps, handlers } = setup()
    const response = await handlers.publish(
      principal,
      'terms',
      put(JSON.stringify({ document: documento }), {
        'Content-Type': 'text/plain',
      })
    )
    expect(response.status).toBe(415)
    expect(deps.saveDocument).not.toHaveBeenCalled()
  })

  it('sem configurações: 409 SETTINGS_NOT_CONFIGURED', async () => {
    const { deps, handlers } = setup()
    deps.saveDocument.mockResolvedValueOnce({
      ok: false,
      code: 'SETTINGS_NOT_CONFIGURED',
    } as never)
    const response = await handlers.publish(
      principal,
      'terms',
      put(JSON.stringify({ document: documento }))
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error:
        'Salve as configurações da locadora antes de publicar os textos legais.',
      code: 'SETTINGS_NOT_CONFIGURED',
    })
  })

  it('despublica; nada publicado é 404', async () => {
    const { deps, handlers } = setup()
    const ok = await handlers.unpublish(principal, 'privacy')
    expect(ok.status).toBe(200)
    expect(deps.removeDocument).toHaveBeenCalledWith(principal, 'privacy')
    deps.removeDocument.mockResolvedValueOnce({
      ok: false,
      code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
    } as never)
    const ausente = await handlers.unpublish(principal, 'privacy')
    expect(ausente.status).toBe(404)
    expect(ausente.headers.get('Cache-Control')).toBe('no-store')
    expect(await ausente.json()).toMatchObject({
      code: 'LEGAL_DOCUMENT_NOT_PUBLISHED',
    })
  })

  it('falha inesperada: 500 sem detalhe', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { deps, handlers } = setup()
    deps.getDocument.mockRejectedValueOnce(new Error('fixture-private'))
    const response = await handlers.read(principal, 'terms')
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('fixture-private')
    error.mockRestore()
  })
})
