// @vitest-environment jsdom
// /reset-password no host `app` (H6): o link do e-mail é `<origem do host>/reset-password?token=`; o token precisa
// chegar à tela e ao pedido de redefinição, senão o link abre "Link invalido".
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

type Query = Record<string, string | string[] | undefined>

async function open(query: Query) {
  render(await Page({ searchParams: Promise.resolve(query) }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/reset-password no host app', () => {
  it('o token do link chega à tela e ao pedido de redefinição', async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => Response.json({ message: 'ok' }))
    vi.stubGlobal('fetch', fetcher)
    await open({ token: 'token-do-link' })
    expect(screen.queryByText('Link invalido')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('Digite sua nova senha'), { target: { value: 'nova-senha-1' } })
    fireEvent.change(screen.getByPlaceholderText('Confirme sua nova senha'), { target: { value: 'nova-senha-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir Senha' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('/api/auth/reset-password')
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'token-do-link', password: 'nova-senha-1' })
  })

  it('na casca da plataforma: o nome provisório da plataforma no lugar da marca da locadora', async () => {
    await open({ token: 'token-do-link' })
    expect(screen.getByText(PLATFORM.displayName)).toBeTruthy()
    expect(screen.queryByText('GB')).toBeNull()
    expect(document.body.innerHTML).not.toContain('-mt-[')
  })

  it.each<[string, Query]>([
    ['sem token', {}],
    ['token vazio', { token: '  ' }],
    ['token repetido (ambíguo)', { token: ['a', 'b'] }],
  ])('%s: mostra o link inválido', async (_label, query) => {
    await open(query)
    expect(screen.getByText('Link invalido')).toBeTruthy()
  })
})
