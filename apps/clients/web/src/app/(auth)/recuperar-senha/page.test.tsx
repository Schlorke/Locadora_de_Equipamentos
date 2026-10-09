// @vitest-environment jsdom
// /recuperar-senha no host `app`: a mesma tela do produto, na casca da plataforma (nome provisório no lugar da marca
// da locadora, sem o deslocamento que compensa o cabeçalho fixo da vitrine), e o pedido segue para a API.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PLATFORM } from '@gb-locacoes/contracts/platform'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('/recuperar-senha no host app', () => {
  it('mostra o nome da plataforma no lugar da marca da locadora, sem o deslocamento da vitrine', () => {
    const { container } = render(<Page />)
    expect(screen.getByText('Recuperar Senha')).toBeTruthy()
    expect(screen.getByText(PLATFORM.displayName)).toBeTruthy()
    expect(screen.queryByText('GB')).toBeNull()
    expect(container.innerHTML).not.toContain('-mt-[')
    expect(screen.getByRole('link', { name: 'Voltar ao Login' }).getAttribute('href')).toBe('/login')
  })

  it('o pedido de recuperação segue para a API com o e-mail', async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => Response.json({ message: 'ok' }))
    vi.stubGlobal('fetch', fetcher)
    render(<Page />)
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'equipe@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar Instruções' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('/api/auth/forgot-password')
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'equipe@example.test' })
  })
})
