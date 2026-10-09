'use client'
// Texto legal publicado pela própria locadora (onda 134, lote vitrine-conteúdo), lido no navegador e no app pela rota
// pública `GET /api/settings/public/legal-documents/{terms|privacy|return-policy}`. O host web lê no servidor (SSR) e
// passa o documento pronto; aqui só a raiz legada, o app e o diálogo do orçamento. Estados separados: o 404 de documento
// não publicado ("ausente") não é erro, e a versão de documento que este código não conhece pede para atualizar o app.
import { useEffect, useState } from 'react'
import {
  STOREFRONT_LEGAL_SLUGS,
  parseStorefrontLegalDocument,
  type StorefrontLegalDocument,
  type StorefrontLegalKind,
} from '@gb-locacoes/contracts/storefront-legal'
import { useApiClient, type HttpJsonResponse } from '../../../shared/api'
import { usePublicTenantSlug } from '../../organizacao/@x/documento-legal'

export type EstadoDoDocumentoLegal =
  | { status: 'carregando' }
  | {
      status: 'publicado'
      documento: StorefrontLegalDocument
      publicadoEm: string | null
    }
  | { status: 'ausente' }
  | { status: 'versao-nao-suportada' }
  | { status: 'erro' }

/** Interpreta a resposta da rota pública: documento, ausente (404 próprio), versão nova ou erro. */
export function estadoDaResposta(
  resposta: HttpJsonResponse<unknown>
): EstadoDoDocumentoLegal {
  const corpo =
    resposta.data && typeof resposta.data === 'object'
      ? (resposta.data as Record<string, unknown>)
      : {}
  if (resposta.status === 404 && corpo.code === 'LEGAL_DOCUMENT_NOT_PUBLISHED')
    return { status: 'ausente' }
  if (!resposta.ok) return { status: 'erro' }
  const lido = parseStorefrontLegalDocument(corpo.document)
  if (lido.status === 'unsupported-version')
    return { status: 'versao-nao-suportada' }
  if (lido.status !== 'ok') return { status: 'erro' }
  return {
    status: 'publicado',
    documento: lido.document,
    publicadoEm:
      typeof corpo.publishedAt === 'string' ? corpo.publishedAt : null,
  }
}

/**
 * Documento já lido no servidor (SSR do host web): o hook o usa sem consultar a API. Tipo literal, não `interface`: o
 * nome `document` da propriedade não é o global do navegador (o arch-check lê propriedade de tipo literal como tipo).
 */
export type DocumentoLegalInicial = {
  readonly document: StorefrontLegalDocument
  readonly publishedAt: string | null
}

/**
 * Documento da locadora selecionada (ou de `tenantSlug`); sem locadora, erro (nunca o texto de outra). Com `inicial`
 * (o documento que o host web leu no servidor), devolve-o sem consultar a API; `inicial` nulo ou ausente consulta.
 */
export function useDocumentoLegal(
  kind: StorefrontLegalKind,
  options?: {
    tenantSlug?: string | null
    inicial?: DocumentoLegalInicial | null
  }
): EstadoDoDocumentoLegal {
  const api = useApiClient()
  const selecionada = usePublicTenantSlug()
  const slug = options?.tenantSlug ?? selecionada
  const inicial = options?.inicial ?? null
  const chave = `${slug ?? ''}:${kind}`
  const [estado, setEstado] = useState<{
    chave: string
    valor: EstadoDoDocumentoLegal
  }>({ chave, valor: { status: 'carregando' } })
  useEffect(() => {
    if (inicial) return
    if (!slug) {
      setEstado({ chave, valor: { status: 'erro' } })
      return
    }
    const controller = new AbortController()
    setEstado({ chave, valor: { status: 'carregando' } })
    api
      .request<HttpJsonResponse<unknown>>(
        `/api/settings/public/legal-documents/${STOREFRONT_LEGAL_SLUGS[kind]}?tenantSlug=${encodeURIComponent(slug)}`,
        { signal: controller.signal, responseType: 'json-response' }
      )
      .then((resposta) => {
        if (!controller.signal.aborted)
          setEstado({ chave, valor: estadoDaResposta(resposta) })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setEstado({ chave, valor: { status: 'erro' } })
      })
    return () => controller.abort()
  }, [api, chave, kind, slug, inicial])
  if (inicial)
    return {
      status: 'publicado',
      documento: inicial.document,
      publicadoEm: inicial.publishedAt,
    }
  return estado.chave === chave ? estado.valor : { status: 'carregando' }
}
