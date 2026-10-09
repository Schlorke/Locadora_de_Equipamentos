// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientProvider, type HttpClient } from '../../../shared/api'
import { estadoDaResposta, useDocumentoLegal } from './use-documento-legal'

// Onda 134: o documento ausente (404 próprio) é diferente do erro e da versão que o app não conhece.
afterEach(cleanup)
const documento = {
  version: 1,
  lastUpdated: '19 de janeiro de 2026',
  sections: [
    {
      id: 'objeto',
      title: 'Objeto',
      blocks: [{ type: 'paragraph', text: 'Texto.' }],
    },
  ],
}
const wrapper =
  (request: ReturnType<typeof vi.fn>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(ApiClientProvider, {
      client: { request: request as HttpClient['request'] },
      children,
    })

describe('estadoDaResposta', () => {
  it('publicado, ausente (404 do documento), versão não suportada e erro', () => {
    expect(
      estadoDaResposta({
        ok: true,
        status: 200,
        data: {
          kind: 'terms',
          document: documento,
          publishedAt: '2026-10-06T12:00:00.000Z',
        },
      })
    ).toEqual({
      status: 'publicado',
      documento,
      publicadoEm: '2026-10-06T12:00:00.000Z',
    })
    expect(
      estadoDaResposta({
        ok: false,
        status: 404,
        data: { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' },
      })
    ).toEqual({ status: 'ausente' })
    expect(
      estadoDaResposta({
        ok: true,
        status: 200,
        data: { document: { ...documento, version: 2 } },
      })
    ).toEqual({ status: 'versao-nao-suportada' })
    for (const resposta of [
      { ok: false, status: 404, data: { error: 'Locadora não encontrada' } },
      { ok: false, status: 500, data: null },
      { ok: false, status: 503, data: { code: 'SITE_PAUSED' } },
      { ok: true, status: 200, data: { document: { html: '<p>x</p>' } } },
      { ok: true, status: 200, data: null },
    ])
      expect(estadoDaResposta(resposta), JSON.stringify(resposta)).toEqual({
        status: 'erro',
      })
  })
})

describe('useDocumentoLegal', () => {
  it('pede o documento da locadora pelo slug da rota, sem cache de outra locadora', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { kind: 'returnPolicy', document: documento, publishedAt: null },
    })
    const { result } = renderHook(
      () => useDocumentoLegal('returnPolicy', { tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(request) }
    )
    expect(result.current).toEqual({ status: 'carregando' })
    await waitFor(() => expect(result.current.status).toBe('publicado'))
    expect(request.mock.calls[0]![0]).toBe(
      '/api/settings/public/legal-documents/return-policy?tenantSlug=locadora-a'
    )
    expect(request.mock.calls[0]![1]).toMatchObject({
      responseType: 'json-response',
    })
  })

  it('ausente e erro de rede são estados diferentes', async () => {
    const ausente = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      data: { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' },
    })
    const primeiro = renderHook(
      () => useDocumentoLegal('terms', { tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(ausente) }
    )
    await waitFor(() =>
      expect(primeiro.result.current).toEqual({ status: 'ausente' })
    )
    const falha = vi.fn().mockRejectedValue(new Error('offline'))
    const segundo = renderHook(
      () => useDocumentoLegal('terms', { tenantSlug: 'locadora-a' }),
      { wrapper: wrapper(falha) }
    )
    await waitFor(() =>
      expect(segundo.result.current).toEqual({ status: 'erro' })
    )
  })

  it('sem locadora selecionada: erro, sem consultar a API', async () => {
    const request = vi.fn()
    const { result } = renderHook(() => useDocumentoLegal('privacy'), {
      wrapper: wrapper(request),
    })
    await waitFor(() => expect(result.current).toEqual({ status: 'erro' }))
    expect(request).not.toHaveBeenCalled()
  })
})

describe('useDocumentoLegal com o documento do servidor (SSR do host web)', () => {
  it('com o documento inicial, devolve publicado sem consultar a API', () => {
    const request = vi.fn()
    const { result } = renderHook(
      () =>
        useDocumentoLegal('terms', {
          tenantSlug: 'alfa',
          inicial: {
            document: documento as never,
            publishedAt: '2026-10-06T12:00:00.000Z',
          },
        }),
      { wrapper: wrapper(request) }
    )
    expect(result.current).toEqual({
      status: 'publicado',
      documento,
      publicadoEm: '2026-10-06T12:00:00.000Z',
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('inicial nulo (sem documento no servidor) consulta como antes', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      data: { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED' },
    })
    const { result } = renderHook(
      () => useDocumentoLegal('privacy', { tenantSlug: 'alfa', inicial: null }),
      { wrapper: wrapper(request) }
    )
    await waitFor(() => expect(result.current).toEqual({ status: 'ausente' }))
    expect(request).toHaveBeenCalledTimes(1)
  })
})
