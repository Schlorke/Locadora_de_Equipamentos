// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateIntelligentPrice } from '../../../entities/equipamento'
import { TenantProvider } from '../../../entities/organizacao'
import { useCartStore, type CartItem } from '../../../features/carrinho'

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/area-cliente',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}))
// Sem sessão a página não busca locações, orçamentos nem atividades: só o carrinho aparece.
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

import { AreaClientePage } from './AreaClientePage.web'

// Caminho do disco (o `URL` do jsdom não serve ao `fs`).
const read = (relative: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), relative), 'utf8')

describe('Dashboard da área do cliente', () => {
  it('mantém os status, a saudação e a identidade visual', () => {
    const source = read('./AreaClientePage.web.tsx')
    expect(source).toContain("label: 'Pendente'")
    expect(source).toContain("label: 'Ativa'")
    expect(source).toContain("label: 'Concluída'")
    expect(source).toContain("label: 'Atrasada'")
    const model = read('../model/use-area-cliente.ts')
    expect(model).toContain("return 'Data inválida'")
    expect(model).toContain("return 'há alguns segundos'")
    expect(source).toContain('Bem-vindo de volta,')
    expect(source).toContain('id="dashboard-banner"')
    expect(source).toContain('#f9fafb')
    const route = read('../../../../../../app/area-cliente/page.tsx')
    expect(route).toContain("from '@gb-locacoes/frontend/pages/area-cliente'")
    expect(route).toContain('return <AreaClientePage />')
    // Onda 135 (A8): a mesma página no host web (área do cliente no host da locadora); a asserção da raiz sai no F.
    const webRoute = read(
      '../../../../../../apps/clients/web/src/app/(public)/[locadora]/(account)/area-cliente/page.tsx'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/area-cliente["']/
    )
    expect(webRoute).toContain('return <AreaClientePage />')
  })
})

describe('Dashboard da área do cliente: valores do carrinho', () => {
  /** Item como a página do equipamento põe no carrinho: preço da unidade para os dias e quantidade 1. */
  function addToCart(
    equipmentId: string,
    equipmentName: string,
    pricing: Partial<CartItem>,
    days: number,
    quantity: number
  ) {
    const finalPrice = calculateIntelligentPrice(
      { pricePerDay: 0, ...pricing },
      days
    )
    useCartStore.getState().addItem({
      equipmentId,
      equipmentName,
      quantity: 1,
      days,
      finalPrice,
      ...pricing,
    } as CartItem)
    useCartStore.getState().updateItemQuantity(equipmentId, quantity)
  }
  const text = (element: Element | null | undefined) =>
    (element?.textContent ?? '').replace(/\u00a0/g, ' ')
  /** Texto de cada "Total Estimado" da página (o cartão do topo e o rodapé do bloco "Meu Carrinho"). */
  const estimatedTotals = () =>
    screen
      .getAllByText('Total Estimado')
      .map((label) => text(label.parentElement))
  const itemBlock = (name: string) => text(screen.getByText(name).parentElement)

  beforeEach(() => {
    window.localStorage.clear()
    useCartStore.setState({ items: [] })
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('subtotal do item e Total Estimado pela regra única da linha: 3 × semanal direto 900 por 9 dias = R$ 3.471,43', () => {
    addToCart(
      'eq-1',
      'Betoneira 400L',
      { pricePerDay: 150, weeklyUseDirectValue: true, weeklyDirectValue: 900 },
      9,
      3
    )
    render(
      <TenantProvider value={null}>
        <AreaClientePage />
      </TenantProvider>
    )

    expect(itemBlock('Betoneira 400L')).toContain('Qtd: 3x')
    expect(itemBlock('Betoneira 400L')).toContain('R$ 3.471,43')
    expect(estimatedTotals()).toEqual([
      'Total EstimadoR$ 3471.43no carrinho',
      'Total EstimadoR$ 3.471,43',
    ])
  })

  it('o Total Estimado é a soma exata dos subtotais mostrados em cada item', () => {
    addToCart(
      'eq-1',
      'Betoneira 400L',
      { pricePerDay: 150, weeklyUseDirectValue: true, weeklyDirectValue: 900 },
      9,
      3
    )
    addToCart(
      'eq-2',
      'Andaime',
      {
        pricePerDay: 80,
        biweeklyUseDirectValue: true,
        biweeklyDirectValue: 1000,
      },
      20,
      2
    )
    addToCart(
      'eq-3',
      'Compactador',
      { pricePerDay: 50.05, dailyDiscount: 10 },
      1,
      3
    )
    render(
      <TenantProvider value={null}>
        <AreaClientePage />
      </TenantProvider>
    )

    expect(itemBlock('Betoneira 400L')).toContain('R$ 3.471,43')
    expect(itemBlock('Andaime')).toContain('R$ 2.666,67')
    expect(itemBlock('Compactador')).toContain('R$ 135,14')
    // 3.471,43 + 2.666,67 + 135,14
    expect(estimatedTotals()).toEqual([
      'Total EstimadoR$ 6273.24no carrinho',
      'Total EstimadoR$ 6.273,24',
    ])
  })
})
