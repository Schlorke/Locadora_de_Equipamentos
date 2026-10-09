// Textos legais da locadora no painel (onda 134, lote vitrine-conteúdo, B10): `GET/PUT/DELETE
// /api/admin/settings/legal-documents/{terms|privacy|return-policy}` (SETTINGS READ/WRITE, mesma origem). A resposta
// inteira (com o status) vira um resultado: o documento e a data da publicação, ou a mensagem do erro.
import {
  STOREFRONT_LEGAL_SLUGS,
  parseStorefrontLegalDocument,
  type StorefrontLegalDocument,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import type {
  HttpClient,
  HttpJsonResponse,
  HttpRequest,
} from '../../../shared/api'

export type ResultadoDoTexto =
  | {
      ok: true
      documento: StorefrontLegalDocument | null
      publicadoEm: string | null
    }
  | { ok: false; erro: string }

const caminho = (kind: StorefrontLegalKind) =>
  `/api/admin/settings/legal-documents/${STOREFRONT_LEGAL_SLUGS[kind]}`

const corpoDe = (resposta: HttpJsonResponse<unknown>) =>
  resposta.data && typeof resposta.data === 'object'
    ? (resposta.data as Record<string, unknown>)
    : {}

function resultado(
  resposta: HttpJsonResponse<unknown>,
  removendo = false
): ResultadoDoTexto {
  const corpo = corpoDe(resposta)
  if (resposta.ok) {
    const lido =
      corpo.document === null || corpo.document === undefined
        ? null
        : parseStorefrontLegalDocument(corpo.document)
    if (lido && lido.status !== 'ok')
      return {
        ok: false,
        erro: 'O documento publicado está num formato que este painel não lê. Atualize a página.',
      }
    return {
      ok: true,
      documento: lido ? lido.document : null,
      publicadoEm:
        typeof corpo.publishedAt === 'string' ? corpo.publishedAt : null,
    }
  }
  if (
    removendo &&
    resposta.status === 404 &&
    corpo.code === 'LEGAL_DOCUMENT_NOT_PUBLISHED'
  )
    return { ok: true, documento: null, publicadoEm: null }
  if (resposta.status === 409 && typeof corpo.error === 'string')
    return { ok: false, erro: corpo.error }
  if (resposta.status === 401 || resposta.status === 403)
    return {
      ok: false,
      erro: 'Você não tem permissão para alterar os textos legais.',
    }
  if (resposta.status === 413)
    return { ok: false, erro: 'O documento passou do tamanho máximo.' }
  if (resposta.status === 400)
    return { ok: false, erro: 'O documento não está no formato aceito.' }
  return {
    ok: false,
    erro: 'Não foi possível concluir a operação. Tente novamente.',
  }
}

export function createTextosLegaisApi(client: HttpClient) {
  const pedir = (kind: StorefrontLegalKind, options: HttpRequest = {}) =>
    client.request<HttpJsonResponse<unknown>>(caminho(kind), {
      ...options,
      responseType: 'json-response',
    })
  return {
    ler: async (kind: StorefrontLegalKind) => resultado(await pedir(kind)),
    publicar: async (
      kind: StorefrontLegalKind,
      documento: StorefrontLegalDocument
    ) =>
      resultado(
        await pedir(kind, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: documento }),
        })
      ),
    despublicar: async (kind: StorefrontLegalKind) =>
      resultado(await pedir(kind, { method: 'DELETE' }), true),
  }
}
