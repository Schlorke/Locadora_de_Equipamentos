// @vitest-environment jsdom
// Textos legais no painel web (onda 134, B10): avisos de Termos e Privacidade ausentes, publicar e despublicar só
// depois da confirmação (a versão anterior deixa de existir; D-F) e o editor por seção.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { TextosLegais } from './TextosLegais.web'

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
  render(
    <ApiClientProvider client={client}>
      <TextosLegais />
    </ApiClientProvider>
  )
  return fetcher
}
const metodos = (fetcher: ReturnType<typeof montar>) =>
  fetcher.mock.calls.map(([, init]) => init?.method ?? 'GET')

it('sem Termos nem Privacidade: os dois avisos; com os Termos publicados, o editor traz o documento', async () => {
  montar((url) =>
    url.endsWith('/terms')
      ? Response.json({
          kind: 'terms',
          document: TERMOS,
          publishedAt: '2026-03-01T12:00:00.000Z',
        })
      : Response.json({ kind: 'x', document: null, publishedAt: null })
  )
  expect(
    await screen.findByText(
      'A Política de Privacidade não está publicada: o site fica sem a página de Privacidade.'
    )
  ).toBeTruthy()
  expect(screen.queryByText(/Os Termos de Uso não estão publicados/)).toBeNull()
  expect(
    (screen.getByLabelText('Seção 1: título') as HTMLInputElement).value
  ).toBe('Uso')
  expect(
    (screen.getByLabelText('Seção 1: texto') as HTMLTextAreaElement).value
  ).toBe('Regras.')
  expect(
    screen.getByText(/^Publicado no site em 1 de março de 2026/)
  ).toBeTruthy()
})

it('publicar pede confirmação e só depois envia o PUT; despublicar idem', async () => {
  const fetcher = montar((url, init) => {
    if (init?.method === 'PUT')
      return Response.json({
        kind: 'terms',
        document: JSON.parse(String(init.body)).document,
        publishedAt: '2026-10-07T12:00:00.000Z',
      })
    if (init?.method === 'DELETE')
      return Response.json({ kind: 'terms', document: null, publishedAt: null })
    return Response.json({ kind: 'x', document: null, publishedAt: null })
  })
  expect(
    await screen.findByText(/Os Termos de Uso não estão publicados/)
  ).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Seção 1: título'), {
    target: { value: 'Uso' },
  })
  fireEvent.change(screen.getByLabelText('Seção 1: texto'), {
    target: { value: 'Regras da locadora.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }))
  expect(await screen.findByText('Publicar esta versão?')).toBeTruthy()
  expect(metodos(fetcher)).not.toContain('PUT')
  fireEvent.click(screen.getAllByRole('button', { name: 'Publicar' }).at(-1)!)
  await waitFor(() => expect(metodos(fetcher)).toContain('PUT'))
  await waitFor(() =>
    expect(
      screen.queryByText(/Os Termos de Uso não estão publicados/)
    ).toBeNull()
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Despublicar' }))
  expect(await screen.findByText('Retirar do site?')).toBeTruthy()
  expect(metodos(fetcher)).not.toContain('DELETE')
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Despublicar' }).at(-1)!
  )
  await waitFor(() => expect(metodos(fetcher)).toContain('DELETE'))
  expect(
    await screen.findByText(/Os Termos de Uso não estão publicados/)
  ).toBeTruthy()
})
