// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCredentialsSignIn } from './use-credentials-sign-in'

afterEach(cleanup)
describe('credenciais compartilhadas', () => {
  it('não envia formulário vazio', async () => {
    const signInCredentials = vi.fn()
    const getSession = vi.fn().mockResolvedValue(null)
    const onAuthenticated = vi.fn()
    const { result } = renderHook(() =>
      useCredentialsSignIn({ signInCredentials, getSession, onAuthenticated })
    )
    await act(async () => {
      await result.current.submit()
    })
    expect(signInCredentials).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Por favor, preencha todos os campos.')
  })
  it('reautenticação ignora cookie existente e só navega depois de enviar credenciais', async () => {
    const session = { user: { id: 'fixture-user', email: 'user@example.test' } }
    const getSession = vi.fn().mockResolvedValue(session)
    const signInCredentials = vi.fn().mockResolvedValue({ ok: true })
    const onAuthenticated = vi.fn()
    const { result } = renderHook(() =>
      useCredentialsSignIn({
        getSession,
        signInCredentials,
        onAuthenticated,
        requireReauthentication: true,
      })
    )
    expect(getSession).not.toHaveBeenCalled()
    expect(onAuthenticated).not.toHaveBeenCalled()
    act(() => {
      result.current.setEmail(session.user.email)
      result.current.setPassword('password')
    })
    await act(async () => result.current.submit())
    expect(signInCredentials).toHaveBeenCalledTimes(1)
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(onAuthenticated).toHaveBeenCalledWith(
      session,
      session.user.email,
      'submit'
    )
  })
  it.each([null, { user: { email: 'user@example.test' } }])(
    'reautenticação sem identidade confirmada não navega: %j',
    async (session) => {
      const getSession = vi.fn().mockResolvedValue(session)
      const onAuthenticated = vi.fn()
      const { result } = renderHook(() =>
        useCredentialsSignIn({
          getSession,
          signInCredentials: vi.fn().mockResolvedValue({ ok: true }),
          onAuthenticated,
          requireReauthentication: true,
        })
      )
      act(() => {
        result.current.setEmail('user@example.test')
        result.current.setPassword('password')
      })
      await act(async () => result.current.submit())
      expect(onAuthenticated).not.toHaveBeenCalled()
      expect(result.current.error).toContain('confirmar a nova sessão')
    }
  )
  it('conserva a negativa sem redirecionar e libera o botão', async () => {
    const signInCredentials = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'invalid' })
    const getSession = vi.fn().mockResolvedValue(null)
    const onAuthenticated = vi.fn()
    const { result } = renderHook(() =>
      useCredentialsSignIn({ signInCredentials, getSession, onAuthenticated })
    )
    act(() => {
      result.current.setEmail('user@example.test')
      result.current.setPassword('password')
    })
    await act(async () => {
      await result.current.submit()
    })
    expect(onAuthenticated).not.toHaveBeenCalled()
    expect(result.current.error).toContain('Credenciais inválidas')
    expect(result.current.isLoading).toBe(false)
  })
  it('obtém a role da sessão e impede dois envios simultâneos', async () => {
    const signInCredentials = vi.fn().mockResolvedValue({ ok: true })
    const user = { email: 'operator@example.test', role: 'ADMIN' }
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ user })
    const onAuthenticated = vi.fn()
    const { result } = renderHook(() =>
      useCredentialsSignIn({ signInCredentials, getSession, onAuthenticated })
    )
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    act(() => {
      result.current.setEmail(user.email)
      result.current.setPassword('password')
    })
    await act(async () => {
      await Promise.all([result.current.submit(), result.current.submit()])
    })
    expect(signInCredentials).toHaveBeenCalledTimes(1)
    expect(onAuthenticated).toHaveBeenCalledWith({ user }, user.email, 'submit')
  })
})
