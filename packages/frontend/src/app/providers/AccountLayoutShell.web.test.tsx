// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApplicationSessionProvider,
  type ApplicationSession,
  type SessionState,
} from '../../entities/sessao'
import { AccountLayoutShell } from './AccountLayoutShell.web'

/**
 * Moldura da área do cliente no host web (onda 135, A5; E13 do plano de aposentadoria da raiz). A raiz legada montava
 * o menu lateral da área do cliente (Dashboard, Notificações, Perfil, Orçamentos, Endereços, Suporte e Sair) no
 * `app/area-cliente/layout.tsx`; o host web só aplicava o `noindex` e o portão de modo, e as páginas apareciam sem o
 * menu. A composição passa a morar na camada app do frontend, como a do painel (AdminLayoutShell, entrada 295).
 */
const route = vi.hoisted(() => ({
  pathname: '/area-cliente',
  replace: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: route.replace }),
}))

function session(
  status: SessionState['status'],
  data: ApplicationSession
): SessionState {
  return { data, status, update: async () => data, signOut: async () => {} }
}

const tree = (
  state: SessionState,
  children: ReactNode = <p>Conteúdo da página</p>
) => (
  <ApplicationSessionProvider value={state}>
    <AccountLayoutShell>{children}</AccountLayoutShell>
  </ApplicationSessionProvider>
)

const CLIENT = session('authenticated', {
  user: { id: 'cliente-1', name: 'Carla Cliente', role: 'CLIENT' },
})

beforeEach(() => {
  route.pathname = '/area-cliente'
  route.replace.mockReset()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AccountLayoutShell', () => {
  it('compõe o menu da área do cliente em volta da página, com o item da rota atual ativo', () => {
    render(tree(CLIENT))
    expect(screen.getByText('Conteúdo da página')).toBeTruthy()
    expect(screen.getByText('Área do Cliente')).toBeTruthy()
    expect(screen.getByText('Carla Cliente')).toBeTruthy()
    const links = Object.fromEntries(
      [
        'Dashboard',
        'Notificações',
        'Meu Perfil',
        'Meus Orçamentos',
        'Endereços',
        'Suporte',
      ].map((label) => [
        label,
        screen.getByText(label).closest('a')?.getAttribute('href'),
      ])
    )
    expect(links).toEqual({
      Dashboard: '/area-cliente',
      Notificações: '/area-cliente/notificacoes',
      'Meu Perfil': '/area-cliente/perfil',
      'Meus Orçamentos': '/area-cliente/historico',
      Endereços: '/area-cliente/enderecos',
      Suporte: '/contato',
    })
    expect(screen.getByText('Dashboard').closest('a')?.className).toContain(
      'from-orange-500'
    )
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
    // Cliente não vê o atalho do painel.
    expect(screen.queryByText('Painel Administrador')).toBeNull()
  })

  it('marca o histórico também no detalhe de um orçamento', () => {
    route.pathname = '/area-cliente/historico/orc-1'
    render(tree(CLIENT))
    expect(
      screen.getByText('Meus Orçamentos').closest('a')?.className
    ).toContain('from-orange-500')
    expect(screen.getByText('Dashboard').closest('a')?.className).not.toContain(
      'from-orange-500'
    )
  })

  it('equipe da locadora (papel do vínculo) vê o atalho do painel', () => {
    render(
      tree(
        session('authenticated', {
          user: { id: 'equipe-1', name: 'Fábio', role: 'FINANCIAL' },
        })
      )
    )
    expect(
      screen
        .getByText('Painel Administrador')
        .closest('a')
        ?.getAttribute('href')
    ).toBe('/admin')
  })

  it('sem sessão não mostra a página e volta ao login', () => {
    render(tree(session('unauthenticated', null)))
    expect(screen.queryByText('Conteúdo da página')).toBeNull()
    expect(screen.queryByText('Área do Cliente')).toBeNull()
    expect(route.replace).toHaveBeenCalledWith('/login')
  })

  it('sai pela entrada pública do app (web), não por caminho profundo', () => {
    // No jsdom o Vite reescreve new URL(..., import.meta.url) como asset http: o diretório real.
    const index = readFileSync(
      resolve(import.meta.dirname, '../index.web.ts'),
      'utf8'
    )
    expect(index).toMatch(
      /export \{ AccountLayoutShell \} from '\.\/providers\/AccountLayoutShell\.web'/
    )
  })
})
