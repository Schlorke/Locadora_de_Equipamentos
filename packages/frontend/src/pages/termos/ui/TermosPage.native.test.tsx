// @vitest-environment jsdom
// Página de Termos do app (onda 134, lote vitrine-conteúdo). A caracterização do B0 gravou a árvore de antes da
// troca (primitivas nativas reais sobre o host RN simulado em DOM, tests/helpers/native-screen.tsx) em
// tests/unit/__fixtures__/paginas-legais/termos.native.html. Com o documento da GB (tools/gb-site-content.mjs), a página
// nova dá a mesma árvore, byte a byte (leitura do arquivo; a referência do B0 não é regravada), mais a introdução
// publicada, que o app antes não mostrava (a web, a Privacidade e a Devolução mostram). Sem documento, o aviso.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { StorefrontLegalDocument } from '@gb-locacoes/contracts/storefront-legal'
import { TermosPage } from './TermosPage.native'

const captured = vi.hoisted(() => ({
  classes: [] as string[],
  estado: null as null | { status: string },
}))
vi.mock('react-native', async () =>
  (
    await import('../../../../../../tests/helpers/native-screen')
  ).createNativeHost(captured.classes)
)
vi.mock('@gb-locacoes/ui', async () => ({
  ...(await (
    await import('../../../../../../tests/helpers/native-screen')
  ).nativeUi()),
  ...(await import('../../../../../ui/src/native/DocumentContent.native')),
}))
vi.mock('../../../entities/configuracao', () => ({
  usePublicSettings: () => ({
    settings: {
      companyPhone: '(11) 1234-5678',
      whatsappNumber: '(11) 99999-1111',
      contactEmail: 'contato@tenant.test',
      marketingEmail: '',
      companyAddress: 'Endereço da locadora',
      socialLinks: {},
      heroCarousel: [],
    },
    isLoading: false,
    error: null,
  }),
}))
// Sem documento do servidor, o estado vem do hook (aqui, o estado do teste).
vi.mock('../../../entities/documento-legal', async (original) => {
  const real =
    await original<typeof import('../../../entities/documento-legal')>()
  return {
    ...real,
    useDocumentoLegal: (
      kind: Parameters<typeof real.useDocumentoLegal>[0],
      options: Parameters<typeof real.useDocumentoLegal>[1]
    ) =>
      options?.inicial
        ? real.useDocumentoLegal(kind, options)
        : (captured.estado as ReturnType<typeof real.useDocumentoLegal>),
  }
})
// Os documentos da GB moram em tools/gb-site-content.mjs (JavaScript fora dos pacotes, sem tipos): o teste os carrega
// pelo caminho e os lê com o tipo do contrato.
const { GB_LEGAL_DOCUMENTS } = (await import(
  pathToFileURL(path.resolve('tools/gb-site-content.mjs')).href
)) as {
  GB_LEGAL_DOCUMENTS: Readonly<
    Record<'terms' | 'privacy' | 'returnPolicy', StorefrontLegalDocument>
  >
}
afterEach(() => {
  cleanup()
  captured.classes.length = 0
})

it('com o documento da GB, a árvore de antes da troca (caracterização do B0) mais a introdução publicada, como na web', () => {
  const { container } = render(
    <TermosPage
      documento={{
        document: GB_LEGAL_DOCUMENTS.terms,
        publishedAt: '2026-10-07T12:00:00.000Z',
      }}
    />
  )
  // Segunda rodada da onda 134: a introdução dos Termos aparece no app logo depois do índice, antes da primeira seção
  // (antes só a web a mostrava). Sem ela, a árvore é a do B0, byte a byte.
  const introducao = container.querySelector('nav')!.nextElementSibling!
  expect(introducao.tagName).toBe('DIV')
  expect(introducao.textContent).toBe(GB_LEGAL_DOCUMENTS.terms.intro)
  expect(introducao.nextElementSibling!.tagName).toBe('SECTION')
  introducao.remove()
  // Só normaliza CRLF do checkout; a árvore completa e a grafia de classe já aprovada continuam comparadas.
  expect(container.innerHTML + '\n').toBe(
    readFileSync(
      path.resolve('tests/unit/__fixtures__/paginas-legais/termos.native.html'),
      'utf8'
    )
      .replace(/\r\n/g, '\n')
      .replaceAll('flex-shrink-0', 'shrink-0')
  )
})

it('a introdução que a locadora publicar aparece antes das seções; sem introdução, nada no lugar', () => {
  const termos = {
    version: 1 as const,
    lastUpdated: '1 de março de 2026',
    sections: [
      {
        id: 'uso',
        title: 'Uso',
        blocks: [{ type: 'paragraph' as const, text: 'Regras.' }],
      },
    ],
  }
  const { container } = render(
    <TermosPage
      documento={{
        document: { ...termos, intro: 'Abertura da Locadora Alfa.' },
        publishedAt: '2026-03-01T12:00:00.000Z',
      }}
    />
  )
  const abertura = screen.getByText('Abertura da Locadora Alfa.')
  expect(
    abertura.compareDocumentPosition(screen.getByText('Regras.')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(container.querySelector('nav')!.nextElementSibling!.textContent).toBe(
    'Abertura da Locadora Alfa.'
  )
  cleanup()
  const semIntroducao = render(
    <TermosPage
      documento={{ document: termos, publishedAt: '2026-03-01T12:00:00.000Z' }}
    />
  )
  expect(
    semIntroducao.container.querySelector('nav')!.nextElementSibling!.tagName
  ).toBe('SECTION')
})

it('sem documento publicado: o aviso, sem índice nem texto de outra locadora', () => {
  captured.estado = { status: 'ausente' }
  render(<TermosPage />)
  expect(
    screen.getByText('Esta locadora ainda não publicou este documento.')
  ).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/GB Loca|Última atualização/)
  captured.estado = { status: 'versao-nao-suportada' }
  cleanup()
  render(<TermosPage />)
  expect(
    screen.getByText('Atualize o aplicativo para ler este documento.')
  ).toBeTruthy()
})
