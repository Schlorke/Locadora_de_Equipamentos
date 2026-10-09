// @vitest-environment jsdom
// Login da equipe no host `app` (achado 25): a mesma tela de login do produto, com retorno preso ao painel.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: '' }))
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInCredentials: vi.fn(),
  signInProvider: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('../../../host/auth/client', () => ({ hostAuth: auth }))

import Page from './page'

const TEAM = { user: { id: 'u1', email: 'equipe@example.test', role: 'ADMIN' } }

function open(search = '') {
  nav.search = search
  render(<Page />)
}

async function signIn() {
  fireEvent.change(screen.getByLabelText('Digite seu e-mail'), {
    target: { value: 'equipe@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Digite sua senha'), {
    target: { value: 'senha-de-teste' },
  })
  auth.getSession.mockResolvedValue(TEAM)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar no Sistema' }))
  await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1))
  expect(auth.signInCredentials).toHaveBeenCalledWith(
    'equipe@example.test',
    'senha-de-teste'
  )
  return nav.replace.mock.calls[0]![0] as string
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue(null)
  auth.signInCredentials.mockResolvedValue({ ok: true })
  auth.signInProvider.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('/login no host app (equipe)', () => {
  it('reauthenticate=1 mantém o formulário mesmo com cookie e volta para revisar a assinatura', async () => {
    auth.getSession.mockResolvedValue(TEAM)
    open(
      '?reauthenticate=1&callbackUrl=' +
        encodeURIComponent('/admin/assinatura?locadora=alfa')
    )
    expect(await screen.findByText('Confirme sua identidade')).toBeTruthy()
    expect(nav.replace).not.toHaveBeenCalled()
    expect(auth.getSession).not.toHaveBeenCalled()
    expect(await signIn()).toBe('/admin/assinatura?locadora=alfa')
  })
  it('mostra a tela de login do produto, com recuperação de senha e sem convite de cadastro', async () => {
    open()
    expect(
      await screen.findByRole('button', { name: 'Entrar no Sistema' })
    ).toBeTruthy()
    expect(screen.getByLabelText('Digite seu e-mail')).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Esqueceu sua senha?' })
        .getAttribute('href')
    ).toBe('/recuperar-senha')
    expect(screen.queryByText('Cadastre-se')).toBeNull()
    await waitFor(() => expect(auth.getSession).toHaveBeenCalled())
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('na casca da plataforma: o nome provisório da plataforma no lugar da marca e do rodapé da locadora', async () => {
    const { container } = render(<Page />)
    await screen.findByRole('button', { name: 'Entrar no Sistema' })
    expect(screen.getByText(PLATFORM.displayName)).toBeTruthy()
    expect(
      screen.getByText(`${PLATFORM.displayName} - Sistema de Acesso`)
    ).toBeTruthy()
    expect(screen.queryByText('GB')).toBeNull()
    expect(container.textContent).not.toContain('GB Locações')
    // Sem o deslocamento que compensa o cabeçalho fixo da vitrine.
    expect(container.innerHTML).not.toContain('-mt-[96px]')
  })

  it('login válido entra no painel pelo índice (/admin) quando não há callback', async () => {
    open()
    expect(await signIn()).toBe('/admin')
  })

  it('login válido volta à rota do painel pedida no callback', async () => {
    open(
      '?callbackUrl=' + encodeURIComponent('/admin/orcamentos/q1?status=novo')
    )
    expect(await signIn()).toBe('/admin/orcamentos/q1?status=novo')
  })

  it.each([
    'https://evil.example/admin',
    '//evil.example/admin',
    '/area-cliente',
    '/admin/../area-cliente',
  ])('callback fora do painel é recusado: %s', async (callbackUrl) => {
    open('?callbackUrl=' + encodeURIComponent(callbackUrl))
    expect(await signIn()).toBe('/admin')
  })

  it('credencial recusada não navega e mostra o erro', async () => {
    auth.signInCredentials.mockResolvedValue({
      ok: false,
      error: 'CredentialsSignin',
    })
    open()
    fireEvent.change(screen.getByLabelText('Digite seu e-mail'), {
      target: { value: 'equipe@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Digite sua senha'), {
      target: { value: 'errada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no Sistema' }))
    expect(
      await screen.findByText(
        'Credenciais inválidas. Verifique seu email e senha.'
      )
    ).toBeTruthy()
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('sessão já aberta segue direto para o painel', async () => {
    auth.getSession.mockResolvedValue(TEAM)
    open('?callbackUrl=' + encodeURIComponent('https://evil.example'))
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/admin'))
  })

  it('login social volta por /auth/callback com o destino do painel', async () => {
    open('?callbackUrl=' + encodeURIComponent('/admin/rentals'))
    fireEvent.click(await screen.findByRole('button', { name: /Google/ }))
    await waitFor(() => expect(auth.signInProvider).toHaveBeenCalledTimes(1))
    expect(auth.signInProvider).toHaveBeenCalledWith(
      'google',
      '/auth/callback?callbackUrl=' + encodeURIComponent('/admin/rentals')
    )
  })
})
