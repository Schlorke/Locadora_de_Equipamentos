// @vitest-environment jsdom
// Página de Política de Privacidade do app (onda 134, lote vitrine-conteúdo). A caracterização do B0 gravou a árvore de antes da
// troca (primitivas nativas reais sobre o host RN simulado em DOM, tests/helpers/native-screen.tsx) em
// tests/unit/__fixtures__/paginas-legais/privacidade.native.html. Com o documento da GB (tools/gb-site-content.mjs), a página
// nova dá a mesma árvore, byte a byte (leitura do arquivo; a referência do B0 não é regravada). Sem documento, o aviso.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { StorefrontLegalDocument } from '@gb-locacoes/contracts/storefront-legal'
import { PrivacidadePage } from './PrivacidadePage.native'

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

it('com o documento da GB, a mesma árvore de antes da troca (caracterização do B0)', () => {
  const { container } = render(
    <PrivacidadePage
      documento={{
        document: GB_LEGAL_DOCUMENTS.privacy,
        publishedAt: '2026-10-07T12:00:00.000Z',
      }}
    />
  )
  // Só normaliza CRLF do checkout; a árvore completa e a grafia de classe já aprovada continuam comparadas.
  expect(container.innerHTML + '\n').toBe(
    readFileSync(
      path.resolve(
        'tests/unit/__fixtures__/paginas-legais/privacidade.native.html'
      ),
      'utf8'
    )
      .replace(/\r\n/g, '\n')
      .replaceAll('flex-shrink-0', 'shrink-0')
  )
})

it('sem documento publicado: o aviso, sem índice nem texto de outra locadora', () => {
  captured.estado = { status: 'ausente' }
  render(<PrivacidadePage />)
  expect(
    screen.getByText('Esta locadora ainda não publicou este documento.')
  ).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/GB Loca|Última atualização/)
  captured.estado = { status: 'versao-nao-suportada' }
  cleanup()
  render(<PrivacidadePage />)
  expect(
    screen.getByText('Atualize o aplicativo para ler este documento.')
  ).toBeTruthy()
})
