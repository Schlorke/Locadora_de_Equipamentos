// Textos legais do painel pela rota própria (onda 134, B10): leitura, publicação e despublicação com as mensagens dos
// erros do backend (409 sem configurações, 403, 413, 400 e 404 de documento que não existe).
import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from '../../../shared/api'
import { createTextosLegaisApi } from './textos-legais'

const DOCUMENTO = {
  version: 1,
  lastUpdated: '1 de março de 2026',
  sections: [
    { id: 'a', title: 'A', blocks: [{ type: 'paragraph', text: 'Texto.' }] },
  ],
}

function api(respostas: Array<[number, unknown]>) {
  const fetcher = vi.fn<typeof fetch>()
  for (const [status, body] of respostas)
    fetcher.mockResolvedValueOnce(Response.json(body, { status }))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  return { fetcher, textos: createTextosLegaisApi(client) }
}

describe('createTextosLegaisApi', () => {
  it('lê, publica e despublica pela rota do tipo, com JSON e sem cache de outra locadora', async () => {
    const { fetcher, textos } = api([
      [200, { kind: 'terms', document: null, publishedAt: null }],
      [
        200,
        {
          kind: 'terms',
          document: DOCUMENTO,
          publishedAt: '2026-03-01T12:00:00.000Z',
        },
      ],
      [200, { kind: 'terms', document: null, publishedAt: null }],
    ])
    expect(await textos.ler('terms')).toEqual({
      ok: true,
      documento: null,
      publicadoEm: null,
    })
    expect(await textos.publicar('terms', DOCUMENTO as never)).toEqual({
      ok: true,
      documento: DOCUMENTO,
      publicadoEm: '2026-03-01T12:00:00.000Z',
    })
    expect(await textos.despublicar('terms')).toEqual({
      ok: true,
      documento: null,
      publicadoEm: null,
    })
    const [leitura, publicacao, remocao] = fetcher.mock.calls
    expect(String(leitura![0])).toBe(
      'https://api.example.test/api/admin/settings/legal-documents/terms'
    )
    expect(publicacao![1]?.method).toBe('PUT')
    expect(JSON.parse(String(publicacao![1]?.body))).toEqual({
      document: DOCUMENTO,
    })
    expect(
      (publicacao![1]?.headers as Record<string, string>)['Content-Type']
    ).toBe('application/json')
    expect(remocao![1]?.method).toBe('DELETE')
    expect(String(remocao![0])).toContain('/legal-documents/terms')
  })

  it('a Política de Devolução usa o segmento return-policy', async () => {
    const { fetcher, textos } = api([
      [200, { kind: 'returnPolicy', document: null, publishedAt: null }],
    ])
    await textos.ler('returnPolicy')
    expect(String(fetcher.mock.calls[0]![0])).toMatch(
      /\/legal-documents\/return-policy$/
    )
  })

  it('erros do backend viram mensagens em português, sem fingir sucesso', async () => {
    const { textos } = api([
      [
        409,
        {
          code: 'SETTINGS_NOT_CONFIGURED',
          error:
            'Salve as configurações da locadora antes de publicar os textos legais.',
        },
      ],
      [403, { error: 'Sem permissão' }],
      [413, { error: 'Corpo excede o limite.' }],
      [400, { code: 'LEGAL_DOCUMENT_INVALID', error: 'Documento inválido.' }],
      [404, { code: 'LEGAL_DOCUMENT_NOT_PUBLISHED', error: 'x' }],
      [500, { error: 'Não foi possível concluir a operação.' }],
    ])
    expect(await textos.publicar('privacy', DOCUMENTO as never)).toEqual({
      ok: false,
      erro: 'Salve as configurações da locadora antes de publicar os textos legais.',
    })
    expect(await textos.publicar('privacy', DOCUMENTO as never)).toEqual({
      ok: false,
      erro: 'Você não tem permissão para alterar os textos legais.',
    })
    expect(await textos.publicar('privacy', DOCUMENTO as never)).toEqual({
      ok: false,
      erro: 'O documento passou do tamanho máximo.',
    })
    expect(await textos.publicar('privacy', DOCUMENTO as never)).toEqual({
      ok: false,
      erro: 'O documento não está no formato aceito.',
    })
    // Despublicar o que não existe: o estado final é o pedido (sem documento).
    expect(await textos.despublicar('privacy')).toEqual({
      ok: true,
      documento: null,
      publicadoEm: null,
    })
    expect(await textos.ler('privacy')).toEqual({
      ok: false,
      erro: 'Não foi possível concluir a operação. Tente novamente.',
    })
  })
})
