// @vitest-environment jsdom
// Marca do cabeçalho da vitrine: só a da própria locadora (cartão público), nunca o nome ou a sigla da GB (achado 143).
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentidadePublicaProvider } from '../../../entities/organizacao'

const configuracao = vi.hoisted(() => ({ companyIconUrl: '' }))
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
      companyPhone: '',
      whatsappNumber: '',
      companyIconUrl: configuracao.companyIconUrl,
    },
  }),
}))
vi.mock('../../../features/carrinho', () => ({
  useCartNotifications: () => ({ itemCount: 0 }),
}))
vi.mock('./Busca.web', () => ({ HeaderSearchCombobox: () => null }))
vi.mock('./Sair.web', () => ({ LogoutConfirmationDialog: () => null }))

import Header from './Cabecalho.web'

beforeEach(() => {
  configuracao.companyIconUrl = ''
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

describe('Header: marca da locadora', () => {
  it('nome e sigla do cartão da locadora', () => {
    const { container } = render(
      <IdentidadePublicaProvider
        value={{ nome: 'Locadora Alfa', cidade: null, uf: null, logoUrl: null }}
      >
        <Header />
      </IdentidadePublicaProvider>
    )
    expect(screen.getByText('Locadora Alfa')).toBeTruthy()
    expect(screen.getByText('LA')).toBeTruthy()
    expect(container.textContent).not.toMatch(/GB Loca|\bGB\b/)
  })

  it('logo da locadora com o nome dela no alt', () => {
    configuracao.companyIconUrl = '/logo.png'
    render(
      <IdentidadePublicaProvider
        value={{ nome: 'Locadora Alfa', cidade: null, uf: null, logoUrl: null }}
      >
        <Header />
      </IdentidadePublicaProvider>
    )
    expect(screen.getByAltText('Locadora Alfa')).toBeTruthy()
  })

  it('sem locadora: nenhuma marca no lugar (nem nome nem sigla de outra)', () => {
    const { container } = render(
      <IdentidadePublicaProvider value={null}>
        <Header />
      </IdentidadePublicaProvider>
    )
    expect(container.textContent).not.toMatch(/GB Loca|\bGB\b/)
    expect(screen.getByText('Equipamentos para Construção')).toBeTruthy()
  })
})
