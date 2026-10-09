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
import { EquipmentDetailsPage } from './Detalhe.web'

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/equipamentos/eq-1',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'eq-1' }),
}))

const equipamento = {
  id: 'eq-1',
  name: 'Betoneira 400L',
  description: 'Betoneira para obras de médio porte',
  pricePerDay: 250,
  isAvailable: true,
  images: ['/fotos/betoneira-1.jpg', '/fotos/betoneira-2.jpg'],
  specifications: { Capacidade: '400 L', Motor: '2 CV' },
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
  category: { id: 'cat-concreto', name: 'Concreto' },
  _count: { quoteItems: 3, reviews: 5 },
}
const unidade = {
  id: 'unit-1',
  uniqueCode: 'BET-001',
  status: 'MAINTENANCE',
  hourMeter: 120,
  odometer: null,
  serialNumber: 'SN-99',
  notes: null,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

let encontrado = true
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
    return encontrado
      ? json(equipamento)
      : json({ error: 'Não encontrado' }, 404)
  if (input === '/api/admin/equipment-units?equipmentId=eq-1')
    return json([unidade])
  if (input === '/api/admin/equipments/eq-1' && init?.method === 'DELETE')
    return json({ ok: true })
  return json({ error: `inesperado: ${input}` }, 500)
})
const confirmMock = vi.fn(() => true)

// Legado: o resolvedor acrescenta a locadora pública. Modo host: resolvedor identidade (sem ?tenantSlug=).
const legacyResolver = (href: string) => withPublicTenant(href, 'locadora-a')
const hostResolver = (href: string) => href

function renderPage(resolveHref: (href: string) => string = legacyResolver) {
  return render(
    <NavigationProvider navigate={() => {}} resolveHref={resolveHref}>
      <FrontendSessionFixture>
        <EquipmentDetailsPage />
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
  encontrado = true
  fetchMock.mockClear()
  confirmMock.mockReset()
  router.push.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('confirm', confirmMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Detalhe admin de equipamento', () => {
  it('mantém galeria, exclusão e unidades físicas', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Betoneira 400L' })
    ).toBeTruthy()
    expect(screen.getByText('Detalhes do equipamento')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/equipments/eq-1',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )

    // Galeria usa a primeira imagem do equipamento.
    const foto = screen.getByAltText('Betoneira 400L')
    expect(decodeURIComponent(foto.getAttribute('src') ?? '')).toContain(
      '/fotos/betoneira-1.jpg'
    )

    // Informações e especificações.
    expect(screen.getByText('Concreto')).toBeTruthy()
    expect(screen.getByText('R$ 250.00')).toBeTruthy()
    expect(screen.getByText('Disponível')).toBeTruthy()
    expect(screen.getByText('Betoneira para obras de médio porte')).toBeTruthy()
    expect(screen.getByText('Capacidade')).toBeTruthy()
    expect(screen.getByText('400 L')).toBeTruthy()

    // Unidades físicas carregadas do endpoint próprio.
    expect(await screen.findByText('Unidades Físicas (1)')).toBeTruthy()
    expect(screen.getByText('BET-001')).toBeTruthy()
    expect(screen.getByText('Manutenção')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/equipment-units?equipmentId=eq-1',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )

    // Navegação pelo Link do design system preserva a locadora.
    expect(
      screen.getByRole('link', { name: 'Editar' }).getAttribute('href')
    ).toBe('/admin/equipamentos/eq-1/editar?tenantSlug=locadora-a')
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')

    // Exclusão exige confirmação: cancelar não chama a API.
    confirmMock.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/equipments/eq-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    )

    confirmMock.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/equipments/eq-1',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' })
      )
    )
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/admin/equipamentos')
    )
  })

  it('modo host: links saem sem ?tenantSlug=', async () => {
    const { container } = renderPage(hostResolver)
    expect(
      await screen.findByRole('heading', { name: 'Betoneira 400L' })
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Editar' }).getAttribute('href')
    ).toBe('/admin/equipamentos/eq-1/editar')
    expect(
      screen.getByRole('link', { name: 'Voltar' }).getAttribute('href')
    ).toBe('/admin/equipamentos')
    const hrefs = [...container.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? ''
    )
    expect(hrefs.filter((href) => href.includes('tenantSlug'))).toEqual([])
  })

  it('equipamento inexistente volta para a listagem e mostra o aviso', async () => {
    encontrado = false
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Equipamento não encontrado' })
    ).toBeTruthy()
    expect(router.push).toHaveBeenCalledWith('/admin/equipamentos')
    expect(
      screen
        .getByRole('link', { name: 'Voltar para Equipamentos' })
        .getAttribute('href')
    ).toBe('/admin/equipamentos?tenantSlug=locadora-a')
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/equipment-units?equipmentId=eq-1'
    )
  })

  it('rota admin de detalhe é shell', () => {
    // No ambiente jsdom o Vite reescreve new URL(..., import.meta.url) como asset http; use o diretório real.
    const route = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../app/admin/equipamentos/[id]/page.tsx'
      ),
      'utf8'
    )
    expect(route).toContain(
      "from '@gb-locacoes/frontend/pages/equipamentos-admin'"
    )
    expect(route).toContain('<EquipmentDetailsPage />')
    // Onda 135 (A8): a mesma página no host web; a asserção sobre a raiz sai no bloco F.
    const webRoute = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../../../apps/clients/web/src/app/(admin)/admin/equipamentos/[id]/page.tsx'
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/equipamentos-admin["']/
    )
    expect(webRoute).toContain('<EquipmentDetailsPage />')
  })
})
