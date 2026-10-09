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
} from '@testing-library/react'
import { NavigationProvider } from '@gb-locacoes/ui'
import { MotionGlobalConfig } from 'framer-motion'
import { toast } from 'sonner'
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
import { NovoEquipamentoPage } from './Novo.web'

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/equipamentos/novo',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))
vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

const categorias = [
  { id: 'cat-concreto', name: 'Concreto' },
  { id: 'cat-altura', name: 'Altura' },
]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
  if (input === '/api/admin/categories') return json(categorias)
  if (input === '/api/admin/equipments' && init?.method === 'POST')
    return json({ id: 'eq-novo' }, 201)
  return json({ error: `inesperado: ${input}` }, 500)
})
const postCalls = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) => url === '/api/admin/equipments' && init?.method === 'POST'
  )

// Legado: o resolvedor acrescenta a locadora pública. Modo host: resolvedor identidade (sem ?tenantSlug=).
const legacyResolver = (href: string) => withPublicTenant(href, 'locadora-a')
const hostResolver = (href: string) => href

function renderPage(resolveHref: (href: string) => string = legacyResolver) {
  return render(
    <NavigationProvider navigate={() => {}} resolveHref={resolveHref}>
      <FrontendSessionFixture>
        <NovoEquipamentoPage />
      </FrontendSessionFixture>
    </NavigationProvider>
  )
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})
beforeEach(() => {
  fetchMock.mockClear()
  router.push.mockClear()
  vi.mocked(toast.error).mockClear()
  vi.mocked(toast.success).mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Novo equipamento admin', () => {
  it('mantém formulário, períodos e upload de imagens', async () => {
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'Novo Equipamento' })
    ).toBeTruthy()
    expect(
      screen.getByText('Adicione um novo equipamento ao catálogo de locação')
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')
    expect(
      screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/categories',
        expect.objectContaining({ method: 'GET', credentials: 'include' })
      )
    )

    // Períodos de locação e preço base.
    for (const periodo of [
      'Período Diário',
      'Período Semanal',
      'Período Quinzenal',
      'Período Mensal',
    ]) {
      expect(screen.getByRole('heading', { name: periodo })).toBeTruthy()
    }
    expect(screen.getByText(/Preço por Dia \(R\$\)/)).toBeTruthy()

    // Preenche os dados básicos.
    fireEvent.change(screen.getByLabelText('Nome do Equipamento *'), {
      target: { value: 'Betoneira 400L' },
    })
    fireEvent.change(screen.getByLabelText('Descrição *'), {
      target: { value: 'Betoneira para obras' },
    })
    fireEvent.click(screen.getByTitle('Escolha uma categoria'))
    fireEvent.click(await screen.findByRole('button', { name: 'Concreto' }))
    expect(screen.getByTitle('Concreto')).toBeTruthy()
    fireEvent.change(document.getElementById('pricePerDay')!, {
      target: { value: '25000' },
    })
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Desativar locação mensal' })
    )

    // Sem imagem o cadastro é bloqueado antes de chamar a API.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Equipamento' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Imagem obrigatória',
        expect.anything()
      )
    )
    expect(postCalls()).toHaveLength(0)

    // Upload por URL adiciona a imagem ao formulário.
    fireEvent.change(screen.getByLabelText('Ou adicionar por URL'), {
      target: { value: 'https://cdn.example.test/betoneira.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(await screen.findByText('Imagens (1/5)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Equipamento' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    const [, init] = postCalls()[0]!
    expect(init?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: 'Betoneira 400L',
      description: 'Betoneira para obras',
      categoryId: 'cat-concreto',
      pricePerDay: 250,
      images: ['https://cdn.example.test/betoneira.jpg'],
      dailyRentalEnabled: true,
      weeklyRentalEnabled: true,
      biweeklyRentalEnabled: true,
      monthlyRentalEnabled: false,
      popularPeriod: 'weekly',
    })
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/admin/equipamentos')
    )
    expect(toast.success).toHaveBeenCalledWith(
      'Equipamento Criado!',
      expect.anything()
    )
  })

  it('modo host: links saem sem ?tenantSlug=', async () => {
    const { container } = renderPage(hostResolver)
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos')
    expect(
      screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')
    ).toBe('/admin/equipamentos')
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/categories',
        expect.objectContaining({ method: 'GET', credentials: 'include' })
      )
    )
    const hrefs = [...container.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? ''
    )
    expect(hrefs.filter((href) => href.includes('tenantSlug'))).toEqual([])
  })

  it('rota admin de novo é shell', () => {
    // No ambiente jsdom o Vite reescreve new URL(..., import.meta.url) como asset http; use o diretório real.
    const route = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../app/admin/equipamentos/novo/page.tsx'
      ),
      'utf8'
    )
    expect(route).toContain(
      "from '@gb-locacoes/frontend/pages/equipamentos-admin'"
    )
    expect(route).toContain('<NovoEquipamentoPage />')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../apps/clients/web/src/app/(admin)/admin/equipamentos/novo/page.tsx'
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/equipamentos-admin["']/
    )
    expect(webRoute).toContain('<NovoEquipamentoPage />')
  })
})
