'use client'

import { useEffect, useRef, useState } from 'react'

export type AuthSession = {
  user?: {
    id?: string
    email?: string | null
    role?: string | null
    name?: string | null
  }
} | null
export type SignInResult =
  { error?: string | null; ok?: boolean } | null | undefined
export interface CredentialsAdapter {
  signInCredentials: (email: string, password: string) => Promise<SignInResult>
  getSession: () => Promise<AuthSession>
}

export function useCredentialsSignIn({
  signInCredentials,
  getSession,
  onAuthenticated,
  errorParam,
  requireReauthentication = false,
}: CredentialsAdapter & {
  onAuthenticated: (
    session: AuthSession,
    email: string,
    phase: 'session' | 'submit'
  ) => void
  errorParam?: string | null
  /** Presentation only: sensitive commands still validate freshness in the backend. */
  requireReauthentication?: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (requireReauthentication) return
    let active = true
    void getSession()
      .then((session) => {
        if (active && session?.user)
          onAuthenticated(session, session.user.email || '', 'session')
      })
      .catch(() => {
        // An unavailable session does not prevent a credential attempt.
      })
    return () => {
      active = false
    }
  }, [getSession, onAuthenticated, requireReauthentication])

  useEffect(() => {
    if (!errorParam) return
    setError(
      errorParam === 'CredentialsSignin'
        ? 'Credenciais inválidas. Verifique seu email e senha.'
        : errorParam === 'unauthorized'
          ? 'Usuário não autorizado para acessar o sistema.'
          : 'Erro ao fazer login. Tente novamente.'
    )
  }, [errorParam])

  const submit = async () => {
    if (submitting.current) return
    setError(null)
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.')
      return
    }
    submitting.current = true
    setIsLoading(true)
    try {
      const result = await signInCredentials(email, password)
      if (result?.error) {
        setError('Credenciais inválidas. Verifique seu email e senha.')
      } else if (result?.ok) {
        const session = await getSession()
        if (requireReauthentication && !session?.user?.id) {
          setError('Não foi possível confirmar a nova sessão. Entre novamente.')
          return
        }
        onAuthenticated(session, email, 'submit')
      } else {
        setError('Ocorreu um erro desconhecido. Tente novamente.')
      }
    } catch {
      setError('Falha ao tentar fazer login. Verifique sua conexão.')
    } finally {
      submitting.current = false
      setIsLoading(false)
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    setError,
    isLoading,
    setIsLoading,
    submit,
  }
}
export type CredentialsSignInModel = ReturnType<typeof useCredentialsSignIn>
