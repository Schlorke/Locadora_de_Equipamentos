import { FrontendSessionFixture } from '../../../../../../tests/helpers/frontend-session'
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { NavigationProvider } from '@gb-locacoes/ui'
import { MotionGlobalConfig } from 'framer-motion'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { withPublicTenant } from '../../../entities/organizacao'
import { AdminEquipmentsPage } from './Lista.web'

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/equipamentos',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

type Item = {
  id: string
  name: string
  description: string
  pricePerDay: number
  isAvailable: boolean
  images: string[]
  createdAt: string
  updatedAt: string
  category: { id: string; name: string }
}
const categorias = [
  { id: 'cat-altura', name: 'Altura' },
  { id: 'cat-concreto', name: 'Concreto' },
]
const item = (n: number, extra: Partial<Item> = {}): Item => ({
  id: `eq-${String(n).padStart(2, '0')}`,
  name: `Equipamento ${String(n).padStart(2, '0')}`,
  description: 'Descrição',
  pricePerDay: 100 + n,
  isAvailable: true,
  images: [],
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
  category: categorias[1]!,
  ...extra,
})

let catalogo: Item[] = []
const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  if (input === '/api/admin/equipments?limit=1000')
    return json({ equipments: catalogo })
  if (input === '/api/admin/categories') return json(categorias)
  if (input.startsWith('/api/admin/equipments/') && init?.method === 'DELETE') {
    catalogo = catalogo.filter(
      (equipment) => `/api/admin/equipments/${equipment.id}` !== input
    )
    return json({ ok: true })
  }
  return json({ error: `inesperado: ${input}` }, 500)
})

// Legado: o resolvedor acrescenta a locadora pública. Modo host: resolvedor identidade (sem ?tenantSlug=).
const legacyResolver = (href: string) => withPublicTenant(href, 'locadora-a')
const hostResolver = (href: string) => href

function renderPage(resolveHref: (href: string) => string = legacyResolver) {
  return render(
    <NavigationProvider navigate={() => {}} resolveHref={resolveHref}>
      <FrontendSessionFixture>
        <AdminEquipmentsPage />
      </FrontendSessionFixture>
    </NavigationProvider>
  )
}

// Animações de entrada/saída (AnimatePresence) ficam instantâneas; o comportamento testado é o da página.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})
beforeEach(() => {
  catalogo = []
  fetchMock.mockClear()
  router.push.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('scrollTo', () => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Listagem admin de equipamentos', () => {
  it('mantém filtros, paginação e diálogo de exclusão', async () => {
    catalogo = [
      ...Array.from({ length: 10 }, (_, index) => item(index + 1)),
      item(11, {
        name: 'Andaime tubular',
        isAvailable: false,
        category: categorias[0]!,
      }),
    ]
    const { container } = renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Gerenciar Equipamentos' })
    ).toBeTruthy()
    expect(
      screen.getByText('Controle todo o catálogo de equipamentos para locação')
    ).toBeTruthy()
    expect(
      await screen.findByText(/^11\s+equipamentos encontrados/)
    ).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/equipments?limit=1000',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/categories',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )

    // Ações navegam pelo Link do design system, preservando a locadora ativa.
    const novo = screen.getByRole('link', { name: 'Novo Equipamento' })
    expect(novo.getAttribute('href')).toBe(
      '/admin/equipamentos/novo?tenantSlug=locadora-a'
    )

    // Paginação: 9 por página, ordenados por nome.
    expect(
      await screen.findByRole('heading', { name: 'Andaime tubular' })
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Equipamento 08' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Equipamento 09' })).toBeNull()
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    fireEvent.click(screen.getByText('2', { selector: 'a' }))
    expect(await screen.findByText('Página 2 de 2')).toBeTruthy()
    expect(
      await screen.findByRole('heading', { name: 'Equipamento 09' })
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Equipamento 10' })).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Andaime tubular' })
    ).toBeNull()

    // Filtros de status e categoria combinam; resetar volta ao catálogo inteiro.
    fireEvent.click(screen.getByTitle('Todos os status'))
    fireEvent.click(screen.getByRole('button', { name: 'Indisponível' }))
    expect(
      await screen.findByText(/^1\s+equipamentos encontrados/)
    ).toBeTruthy()
    expect(
      await screen.findByRole('heading', { name: 'Andaime tubular' })
    ).toBeTruthy()
    expect(screen.queryByText('Página 1 de 1')).toBeNull()
    fireEvent.click(screen.getByTitle('Todas as categorias'))
    expect(screen.getByRole('button', { name: 'Altura' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Concreto' }))
    expect(
      await screen.findByText('Nenhum equipamento encontrado')
    ).toBeTruthy()
    fireEvent.click(screen.getByTitle('Resetar filtros'))
    expect(
      await screen.findByText(/^11\s+equipamentos encontrados/)
    ).toBeTruthy()
    expect(await screen.findByText('Página 1 de 2')).toBeTruthy()

    // Busca filtra a lista e volta à primeira página.
    fireEvent.change(screen.getByPlaceholderText('Buscar equipamentos...'), {
      target: { value: 'andaime' },
    })
    expect(
      await screen.findByText(/^1\s+equipamentos encontrados/)
    ).toBeTruthy()
    // A grade troca dentro de AnimatePresence (mode="wait"): o novo resultado entra de forma assíncrona.
    expect(
      await screen.findByRole('heading', { name: 'Andaime tubular' })
    ).toBeTruthy()
    expect(screen.getByText('Indisponível')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Equipamento 01' })).toBeNull()
    const editar = container.querySelector<HTMLAnchorElement>('a.edit-button')
    expect(editar?.getAttribute('href')).toBe(
      '/admin/equipamentos/eq-11/editar?tenantSlug=locadora-a'
    )

    fireEvent.change(screen.getByPlaceholderText('Buscar equipamentos...'), {
      target: { value: 'inexistente' },
    })
    expect(
      await screen.findByText('Nenhum equipamento encontrado')
    ).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Buscar equipamentos...'), {
      target: { value: 'andaime' },
    })
    await screen.findByRole('heading', { name: 'Andaime tubular' })

    // Exclusão pede confirmação no diálogo, chama a API e recarrega a lista.
    const excluir = container.querySelector<HTMLButtonElement>(
      'button.delete-button'
    )
    expect(excluir).toBeTruthy()
    fireEvent.click(excluir!)
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Excluir equipamento?')).toBeTruthy()
    expect(within(dialogo).getByText(/"Andaime tubular"/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/equipments/eq-11',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' })
      )
    )
    expect(
      await screen.findByText('Nenhum equipamento encontrado')
    ).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      fetchMock.mock.calls.filter(
        ([url]) => url === '/api/admin/equipments?limit=1000'
      )
    ).toHaveLength(2)
  })

  it('modo host: links saem sem ?tenantSlug=', async () => {
    catalogo = [item(1), item(2, { name: 'Andaime tubular' })]
    const { container } = renderPage(hostResolver)
    expect(
      await screen.findByRole('heading', { name: 'Andaime tubular' })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Novo Equipamento' })
        .getAttribute('href')
    ).toBe('/admin/equipamentos/novo')
    const editar = container.querySelector<HTMLAnchorElement>('a.edit-button')
    expect(editar?.getAttribute('href')).toMatch(
      /^\/admin\/equipamentos\/eq-0[12]\/editar$/
    )
    const hrefs = [...container.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? ''
    )
    expect(hrefs.filter((href) => href.includes('tenantSlug'))).toEqual([])
  })

  it('rota admin de listagem é shell', () => {
    // No ambiente jsdom o Vite reescreve new URL(..., import.meta.url) como asset http; use o diretório real.
    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../apps/clients/web/src/app/(admin)/admin/equipamentos/page.tsx'
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/equipamentos-admin["']/
    )
    expect(webRoute).toContain('<AdminEquipmentsPage />')
  })
})
