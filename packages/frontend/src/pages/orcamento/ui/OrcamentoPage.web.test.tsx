import { TenantProvider } from '../../../entities/organizacao'
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateIntelligentPrice } from '../../../entities/equipamento'
import { useCartStore, type CartItem } from '../../../features/carrinho'

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/orcamento',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))
// Visitante sem sessão: a página não carrega perfil nem endereços.
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

import { QuotePageWrapper } from './OrcamentoPage.web'

// Caminho do disco (o `URL` do jsdom não serve ao `fs`).
const read = (relative: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), relative), 'utf8')

describe('Página de orçamento', () => {
  it('mantém o WhatsApp da locadora, o suspense e o pedido', () => {
    const source = read('./OrcamentoPage.web.tsx')
    expect(source).toContain('Solicitar Orçamento')
    // Achado 143: o número é o da própria locadora; o teste anterior afirmava o WhatsApp fixo da GB.
    expect(source).toContain(
      'openWhatsAppQuote(whatsappData, contatoDaLocadora.whatsappNumber)'
    )
    expect(source).not.toMatch(/555198205163|5551998205163|GB Loca/)
    expect(source).toContain('WhatsApp aberto com sua solicitação formatada.')
    expect(source).toContain('Erro ao preparar mensagem para WhatsApp.')
    expect(source).toContain('<Suspense fallback={null}>')
    expect(source).toContain('export function QuotePageWrapper()')
  })
})

describe('Página de orçamento: valores dos itens', () => {
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
  /** Linha do resumo ("Subtotal:", "Total:") com o valor ao lado. */
  const summaryRow = (label: string) =>
    (screen.getByText(label).parentElement?.textContent ?? '').replace(
      /\u00a0/g,
      ' '
    )

  beforeEach(() => {
    window.localStorage.clear()
    useCartStore.setState({ items: [] })
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    vi.stubGlobal('scrollTo', () => undefined)
    // Catálogo e disponibilidade indisponíveis: os itens ficam como estão no carrinho.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 }))
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('subtotal de cada item, Subtotal e Total pela regra única da linha (preço exato × quantidade, arredondado uma vez)', () => {
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
        <QuotePageWrapper />
      </TenantProvider>
    )

    // O valor do servidor, nunca a unidade arredondada × quantidade (3.471,42 / 2.666,66 / 135,15).
    for (const [right, wrong] of [
      ['R$ 3.471,43', 'R$ 3.471,42'],
      ['R$ 2.666,67', 'R$ 2.666,66'],
      ['R$ 135,14', 'R$ 135,15'],
    ] as const) {
      expect(screen.getAllByText(right).length).toBeGreaterThan(0)
      expect(screen.queryAllByText(wrong)).toHaveLength(0)
    }
    // 3.471,43 + 2.666,67 + 135,14, sem frete (retirada não escolhida).
    expect(summaryRow('Subtotal:')).toBe('Subtotal:R$ 6.273,24')
    expect(summaryRow('Total:')).toBe('Total:R$ 6.273,24')
  })
})
