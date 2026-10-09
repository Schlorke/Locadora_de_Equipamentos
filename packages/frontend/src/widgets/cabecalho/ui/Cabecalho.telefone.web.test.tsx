// @vitest-environment jsdom
// Telefone e WhatsApp na barra do topo do cabeçalho: só os números que a própria locadora informou, aparados, com o "|"
// só entre os dois; sem nenhum (inclusive sem locadora, como no laboratório /catalog), o bloco sai; enquanto as
// configurações carregam, fica no lugar, sem número nem "|". Com os dois (a GB), a marcação da produção (main eb4c0098,
// components/header.tsx).
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configuracao = vi.hoisted(() => ({
  companyPhone: '',
  whatsappNumber: '',
  isLoading: false,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('../../../entities/sessao', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))
vi.mock('../../../entities/configuracao', () => ({
  usePublicSettings: () => ({
    settings: {
      companyPhone: configuracao.companyPhone,
      whatsappNumber: configuracao.whatsappNumber,
      companyIconUrl: '',
    },
    isLoading: configuracao.isLoading,
    error: null,
  }),
}))
vi.mock('../../../features/carrinho', () => ({
  useCartNotifications: () => ({ itemCount: 0 }),
}))
vi.mock('./Busca.web', () => ({ HeaderSearchCombobox: () => null }))
vi.mock('./Sair.web', () => ({ LogoutConfirmationDialog: () => null }))

import Header from './Cabecalho.web'

const TELEFONE = '(51) 3000-0000'
const WHATSAPP = '(51) 99999-0000'

/** Barra do topo do cabeçalho (fundo slate-700): telefone, atendimento e acesso. */
function barra(numeros: {
  companyPhone: string
  whatsappNumber: string
  isLoading?: boolean
}) {
  configuracao.companyPhone = numeros.companyPhone
  configuracao.whatsappNumber = numeros.whatsappNumber
  configuracao.isLoading = numeros.isLoading ?? false
  const { container } = render(<Header />)
  const topo = container.querySelector('header > div')!
  return {
    topo,
    /** Bloco do telefone (ícone e números), primeiro filho da coluna da esquerda. */
    bloco: topo.querySelector('div.flex.items-start'),
  }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Header: telefone e WhatsApp da locadora', () => {
  it('com os dois números (a GB): a marcação da produção, com o "|" entre eles', () => {
    const { bloco } = barra({
      companyPhone: TELEFONE,
      whatsappNumber: WHATSAPP,
    })
    expect(bloco?.querySelector('svg')?.getAttribute('class')).toContain(
      'h-4 w-4 text-slate-200'
    )
    expect(bloco?.lastElementChild?.outerHTML).toBe(
      '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">' +
        '<a href="tel:+555130000000" class="hidden sm:inline text-slate-100 hover:text-white transition-colors">(51) 3000-0000</a>' +
        '<span class="hidden sm:inline text-slate-300">|</span>' +
        '<a href="tel:+5551999990000" class="text-slate-100 hover:text-white transition-colors">(51) 99999-0000</a>' +
        '</div>'
    )
  })

  it('só o telefone: sem "|", sem o link vazio do WhatsApp e com o número também no celular', () => {
    const { bloco } = barra({ companyPhone: TELEFONE, whatsappNumber: '' })
    // No celular a produção mostra só o WhatsApp (o telefone tem `hidden sm:inline`); sem ele, o telefone fica visível
    // em toda largura, com a classe do link do WhatsApp, e a barra nunca fica só com o ícone.
    expect(bloco?.lastElementChild?.outerHTML).toBe(
      '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">' +
        '<a href="tel:+555130000000" class="text-slate-100 hover:text-white transition-colors">(51) 3000-0000</a>' +
        '</div>'
    )
  })

  it('com algum número, um deles fica visível no celular (sem `hidden`)', () => {
    for (const numeros of [
      { companyPhone: TELEFONE, whatsappNumber: WHATSAPP },
      { companyPhone: TELEFONE, whatsappNumber: '' },
      { companyPhone: ` ${TELEFONE} `, whatsappNumber: '  ' },
      { companyPhone: '', whatsappNumber: WHATSAPP },
    ]) {
      const { bloco } = barra(numeros)
      const noCelular = [...(bloco?.querySelectorAll('a') ?? [])].filter(
        (link) => !link.classList.contains('hidden')
      )
      expect(noCelular).toHaveLength(1)
      expect(noCelular[0]?.textContent).toMatch(/^\(\d{2}\) [\d-]+$/)
      cleanup()
    }
  })

  it('só o WhatsApp: sem "|" e sem o link vazio do telefone', () => {
    const { bloco } = barra({ companyPhone: '', whatsappNumber: WHATSAPP })
    expect(bloco?.lastElementChild?.outerHTML).toBe(
      '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">' +
        '<a href="tel:+5551999990000" class="text-slate-100 hover:text-white transition-colors">(51) 99999-0000</a>' +
        '</div>'
    )
  })

  it('número só com espaços não conta, e o número sai aparado', () => {
    const { bloco } = barra({
      companyPhone: '  ',
      whatsappNumber: `  ${WHATSAPP} `,
    })
    expect(bloco?.querySelectorAll('a')).toHaveLength(1)
    expect(bloco?.querySelector('a')?.textContent).toBe(WHATSAPP)
    expect(bloco?.textContent).not.toContain('|')
  })

  it('sem nenhum número (ou sem locadora): o bloco sai e o atendimento fica', () => {
    const { topo, bloco } = barra({ companyPhone: '', whatsappNumber: ' ' })
    expect(bloco).toBeNull()
    expect(topo.querySelector('a[href^="tel:"]')).toBeNull()
    expect(topo.textContent).not.toContain('|')
    expect(topo.textContent).toContain(
      'Atendimento especializado • Entregamos em toda região'
    )
  })

  it('carregando: o bloco fica no lugar, só com o ícone (sem número nem "|")', () => {
    const { bloco } = barra({
      companyPhone: '',
      whatsappNumber: '',
      isLoading: true,
    })
    expect(bloco?.querySelector('svg')).not.toBeNull()
    expect(bloco?.lastElementChild?.outerHTML).toBe(
      '<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2"></div>'
    )
  })
})
