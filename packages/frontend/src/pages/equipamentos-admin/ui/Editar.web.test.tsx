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
import { EditarEquipamentoPage } from './Editar.web'

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/equipamentos/eq-1/editar',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'eq-1' }),
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
const equipamento = {
  id: 'eq-1',
  name: 'Betoneira 400L',
  description: 'Betoneira para obras',
  pricePerDay: 250,
  categoryId: 'cat-concreto',
  images: ['https://cdn.example.test/betoneira.jpg'],
  isAvailable: true,
  specifications: { Capacidade: '400 L' },
  maxStock: 3,
  partsLossHistory: [
    {
      date: '2026-09-01',
      description: 'Parafusos perdidos',
      quantity: 1,
      images: [],
    },
  ],
  partsLossCount: 1,
  popularPeriod: 'weekly',
  monthlyRentalEnabled: false,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
  if (
    input === '/api/admin/equipments/eq-1' &&
    (!init?.method || init.method === 'GET')
  )
    return json(equipamento)
  if (input === '/api/admin/categories') return json(categorias)
  if (input === '/api/admin/equipments/eq-1' && init?.method === 'PUT')
    return json({ id: 'eq-1' })
  return json({ error: `inesperado: ${input}` }, 500)
})
const putBodies = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) =>
        url === '/api/admin/equipments/eq-1' && init?.method === 'PUT'
    )
    .map(([, init]) => JSON.parse(String(init?.body)))

// Legado: o resolvedor acrescenta a locadora pública. Modo host: resolvedor identidade (sem ?tenantSlug=).
const legacyResolver = (href: string) => withPublicTenant(href, 'locadora-a')
const hostResolver = (href: string) => href

function renderPage(resolveHref: (href: string) => string = legacyResolver) {
  return render(
    <NavigationProvider navigate={() => {}} resolveHref={resolveHref}>
      <FrontendSessionFixture>
        <EditarEquipamentoPage />
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
  // Só o relógio de datas é fixado: o calendário de perdas bloqueia datas futuras em relação a "hoje".
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0))
  fetchMock.mockClear()
  router.push.mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Editar equipamento admin', () => {
  it('preserva a mensagem de erro não JSON e não navega após PUT recusado', async () => {
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response('<html>offline</html>', {
            status: 502,
            statusText: 'Bad Gateway',
          })
        : fetchMock(url, init)
    )
    renderPage()
    await screen.findByDisplayValue('Betoneira 400L')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Erro', {
        description: 'Bad Gateway',
      })
    )
    expect(router.push).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
  it('mantém formulário, perdas e calendário do widget', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Editar Equipamento' })
    ).toBeTruthy()
    expect(
      screen.getByText('Atualize as informações do equipamento')
    ).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/equipments/eq-1',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/categories',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')
    expect(
      screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')

    // Formulário vem preenchido com o equipamento salvo.
    expect(
      (screen.getByLabelText('Nome do Equipamento *') as HTMLInputElement).value
    ).toBe('Betoneira 400L')
    expect(await screen.findByTitle('Concreto')).toBeTruthy()
    expect(
      (document.getElementById('pricePerDay') as HTMLInputElement).value
    ).toMatch(/250,00/)
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Desativar locação mensal',
        }) as HTMLInputElement
      ).checked
    ).toBe(true)
    for (const periodo of [
      'Período Diário',
      'Período Semanal',
      'Período Quinzenal',
      'Período Mensal',
    ]) {
      expect(screen.getByRole('heading', { name: periodo })).toBeTruthy()
    }

    // Perdas de peças: histórico existente e novo registro pelo calendário do widget.
    expect(
      screen.getByRole('heading', {
        name: 'Registro de Perdas de Peças e Avarias',
      })
    ).toBeTruthy()
    expect(screen.getByText('Parafusos perdidos')).toBeTruthy()
    const total = screen.getByText('Total de Perdas Registradas').parentElement!
    expect(within(total).getByText('1')).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: /Selecione a data da perda/ })
    )
    expect(
      screen.getByText('Selecione a data em que ocorreu a perda')
    ).toBeTruthy()
    const calendario = screen.getByRole('grid')
    expect(calendario.getAttribute('aria-label')).toMatch(/setembro/i)
    const dia = (numero: string) =>
      within(calendario)
        .getAllByRole('button')
        .find((button) => button.textContent === numero) as
        HTMLButtonElement | undefined
    expect(dia('20')?.disabled ?? true).toBe(true)
    expect(dia('10')?.disabled).toBe(false)
    fireEvent.click(dia('10')!)
    expect(screen.getByRole('button', { name: '10/09/2026' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Descrição da Perda'), {
      target: { value: 'Mangueira rompida' },
    })
    fireEvent.change(screen.getByLabelText('Quantidade'), {
      target: { value: '2a' },
    })
    expect(
      (screen.getByLabelText('Quantidade') as HTMLInputElement).value
    ).toBe('2')
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar Registro de Perda' })
    )

    await waitFor(() => expect(putBodies()).toHaveLength(1))
    expect(putBodies()[0]).toMatchObject({
      name: 'Betoneira 400L',
      partsLossCount: 3,
      partsLossHistory: [
        { date: '2026-09-01', description: 'Parafusos perdidos', quantity: 1 },
        {
          date: '2026-09-10',
          description: 'Mangueira rompida',
          quantity: 2,
          images: [],
        },
      ],
    })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Perda registrada!',
        expect.anything()
      )
    )
    expect(await screen.findByText('Mangueira rompida')).toBeTruthy()
    expect(within(total).getByText('3')).toBeTruthy()

    // Salvar o formulário principal envia o equipamento inteiro com PUT e volta para a listagem.
    fireEvent.change(screen.getByLabelText('Nome do Equipamento *'), {
      target: { value: 'Betoneira 400L Plus' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))
    await waitFor(() => expect(putBodies()).toHaveLength(2))
    expect(putBodies()[1]).toMatchObject({
      name: 'Betoneira 400L Plus',
      categoryId: 'cat-concreto',
      pricePerDay: 250,
      images: ['https://cdn.example.test/betoneira.jpg'],
      monthlyRentalEnabled: false,
      partsLossCount: 3,
    })
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/admin/equipamentos')
    )
    expect(toast.success).toHaveBeenCalledWith(
      'Equipamento Atualizado!',
      expect.anything()
    )
  }, 20_000)

  it('modo host: links saem sem ?tenantSlug=', async () => {
    const { container } = renderPage(hostResolver)
    expect(
      await screen.findByRole('heading', { name: 'Editar Equipamento' })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos')
    expect(
      screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')
    ).toBe('/admin/equipamentos')
    const hrefs = [...container.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? ''
    )
    expect(hrefs.filter((href) => href.includes('tenantSlug'))).toEqual([])
  })

  it('rota admin de editar é shell', () => {
    // No ambiente jsdom o Vite reescreve new URL(..., import.meta.url) como asset http; use o diretório real.
    const route = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../app/admin/equipamentos/[id]/editar/page.tsx'
      ),
      'utf8'
    )
    expect(route).toContain(
      "from '@gb-locacoes/frontend/pages/equipamentos-admin'"
    )
    expect(route).toContain('<EditarEquipamentoPage />')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../apps/clients/web/src/app/(admin)/admin/equipamentos/[id]/editar/page.tsx'
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/equipamentos-admin["']/
    )
    expect(webRoute).toContain('<EditarEquipamentoPage />')
  })
})
