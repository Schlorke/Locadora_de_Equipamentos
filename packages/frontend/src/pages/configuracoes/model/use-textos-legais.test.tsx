// @vitest-environment jsdom
// Textos legais no painel (onda 134, B10): leitura dos três documentos, publicar e despublicar pela rota própria,
// 409 sem configurações, avisos de Termos e Privacidade ausentes e nada publicado quando o formulário é inválido.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useTextosLegais } from './use-textos-legais'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const TERMOS = {
  version: 1,
  lastUpdated: '1 de março de 2026',
  sections: [
    {
      id: 'uso',
      title: 'Uso',
      blocks: [{ type: 'paragraph', text: 'Regras.' }],
    },
  ],
}

function montar(rota: (url: string, init?: RequestInit) => Response) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url, init) => rota(String(url), init))
  const client = createHttpClient({
    baseUrl: 'https://api.example.test',
    fetcher,
  })
  const hook = renderHook(
    () => useTextosLegais({ hoje: () => new Date(2026, 9, 7) }),
    {
      wrapper: ({ children }) => (
        <ApiClientProvider client={client}>{children}</ApiClientProvider>
      ),
    }
  )
  return { fetcher, hook }
}

it('carrega os três documentos; Termos publicados viram formulário, os ausentes nascem com a data do dia', async () => {
  const { fetcher, hook } = montar((url) =>
    url.endsWith('/terms')
      ? Response.json({
          kind: 'terms',
          document: TERMOS,
          publishedAt: '2026-03-01T12:00:00.000Z',
        })
      : Response.json({ kind: 'x', document: null, publishedAt: null })
  )
  await waitFor(() =>
    expect(hook.result.current.estados.returnPolicy.carregado).toBe(true)
  )
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(hook.result.current.formularios.terms.secoes[0]).toMatchObject({
    id: 'uso',
    titulo: 'Uso',
    texto: 'Regras.',
  })
  expect(hook.result.current.formularios.privacy.lastUpdated).toBe(
    '7 de outubro de 2026'
  )
  expect(hook.result.current.faltamTermos).toBe(false)
  expect(hook.result.current.faltaPrivacidade).toBe(true)
})

it('publica a Privacidade pelo PUT e despublica pelo DELETE; o aviso acompanha', async () => {
  let privacidade: unknown = null
  const { fetcher, hook } = montar((url, init) => {
    if (url.endsWith('/privacy') && init?.method === 'PUT') {
      privacidade = JSON.parse(String(init.body)).document
      return Response.json({
        kind: 'privacy',
        document: privacidade,
        publishedAt: '2026-10-07T12:00:00.000Z',
      })
    }
    if (url.endsWith('/privacy') && init?.method === 'DELETE')
      return Response.json({
        kind: 'privacy',
        document: null,
        publishedAt: null,
      })
    return Response.json({ kind: 'x', document: null, publishedAt: null })
  })
  await waitFor(() =>
    expect(hook.result.current.estados.privacy.carregado).toBe(true)
  )
  act(() =>
    hook.result.current.editar('privacy', {
      lastUpdated: '7 de outubro de 2026',
      intro: 'Abertura.',
      secoes: [
        {
          id: '',
          titulo: 'Coleta',
          texto: 'Coletamos o mínimo.',
          cartao: true,
          nota: '',
        },
      ],
    })
  )
  await act(async () =>
    expect(await hook.result.current.publicar('privacy')).toBe(true)
  )
  expect(privacidade).toEqual({
    version: 1,
    lastUpdated: '7 de outubro de 2026',
    intro: 'Abertura.',
    sections: [
      {
        id: 'coleta',
        title: 'Coleta',
        blocks: [{ type: 'paragraph', text: 'Coletamos o mínimo.' }],
        contactCard: true,
      },
    ],
  })
  expect(hook.result.current.faltaPrivacidade).toBe(false)
  expect(hook.result.current.estados.privacy.publicadoEm).toBe(
    '2026-10-07T12:00:00.000Z'
  )
  await act(async () =>
    expect(await hook.result.current.despublicar('privacy')).toBe(true)
  )
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
    true
  )
  expect(hook.result.current.faltaPrivacidade).toBe(true)
})

it('409 sem configurações: erro na tela e nada publicado; formulário inválido nem chega ao backend', async () => {
  const { fetcher, hook } = montar((url, init) =>
    init?.method === 'PUT'
      ? Response.json(
          {
            code: 'SETTINGS_NOT_CONFIGURED',
            error:
              'Salve as configurações da locadora antes de publicar os textos legais.',
          },
          { status: 409 }
        )
      : Response.json({ kind: 'x', document: null, publishedAt: null })
  )
  await waitFor(() =>
    expect(hook.result.current.estados.terms.carregado).toBe(true)
  )
  await act(async () =>
    expect(await hook.result.current.publicar('terms')).toBe(false)
  )
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(
    false
  )
  expect(toast.error).toHaveBeenCalledWith('Erro', {
    description: 'Cada seção precisa de título e texto.',
  })
  act(() =>
    hook.result.current.editar('terms', {
      lastUpdated: '7 de outubro de 2026',
      intro: '',
      secoes: [
        { id: 'uso', titulo: 'Uso', texto: 'Regras.', cartao: false, nota: '' },
      ],
    })
  )
  await act(async () =>
    expect(await hook.result.current.publicar('terms')).toBe(false)
  )
  expect(toast.error).toHaveBeenLastCalledWith('Erro', {
    description:
      'Salve as configurações da locadora antes de publicar os textos legais.',
  })
  expect(hook.result.current.estados.terms.documento).toBeNull()
})

// Segunda rodada da onda 134: o aviso dizia "Termos e Condições de Uso publicada no site." (e "retirada"); cada
// texto concorda com o próprio nome.
it.each([
  [
    'terms',
    'Termos e Condições de Uso publicados no site.',
    'Termos e Condições de Uso retirados do site.',
  ],
  [
    'privacy',
    'Política de Privacidade publicada no site.',
    'Política de Privacidade retirada do site.',
  ],
  [
    'returnPolicy',
    'Política de Devolução publicada no site.',
    'Política de Devolução retirada do site.',
  ],
] as const)(
  'o aviso de sucesso concorda com o nome do texto (%s)',
  async (kind, publicado, retirado) => {
    const { hook } = montar((url, init) =>
      init?.method === 'PUT'
        ? Response.json({
            kind,
            document: JSON.parse(String(init.body)).document,
            publishedAt: '2026-10-07T12:00:00.000Z',
          })
        : Response.json({ kind, document: null, publishedAt: null })
    )
    await waitFor(() =>
      expect(hook.result.current.estados[kind].carregado).toBe(true)
    )
    act(() =>
      hook.result.current.editar(kind, {
        lastUpdated: '7 de outubro de 2026',
        intro: '',
        secoes: [
          {
            id: 'uso',
            titulo: 'Uso',
            texto: 'Regras.',
            cartao: false,
            nota: '',
          },
        ],
      })
    )
    await act(async () =>
      expect(await hook.result.current.publicar(kind)).toBe(true)
    )
    expect(toast.success).toHaveBeenLastCalledWith('Sucesso!', {
      description: publicado,
    })
    await act(async () =>
      expect(await hook.result.current.despublicar(kind)).toBe(true)
    )
    expect(toast.success).toHaveBeenLastCalledWith('Sucesso!', {
      description: retirado,
    })
  }
)
