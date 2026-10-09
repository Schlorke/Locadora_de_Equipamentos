'use client'
import { createContext, useContext, type ReactNode } from 'react'
import { marcaDoAcesso, type IdentidadePublica } from './marca'

const IdentidadeContext = createContext<IdentidadePublica | null>(null)

/** Identidade pública da locadora (cartão que o host já leu), sem dado de outra locadora (T12). */
export function IdentidadePublicaProvider({
  value,
  children,
}: {
  value: IdentidadePublica | null
  children: ReactNode
}) {
  return (
    <IdentidadeContext.Provider value={value}>
      {children}
    </IdentidadeContext.Provider>
  )
}

/**
 * Identidade da locadora pública atual, informada pelo host (no host de locadora, o cartão que o layout leu no
 * servidor). Sem identidade informada (raiz legada, app, painel): `null`, e quem a usa omite nome e marca; nunca uma
 * marca padrão de outra locadora (achado 143). Não consulta a API: o proxy do host de locadora nega o cartão ao
 * navegador (allowlist de API do Lote 4b).
 */
export function useIdentidadePublica(): IdentidadePublica | null {
  return useContext(IdentidadeContext)
}

export function useMarcaDoAcesso(): { sigla: string; rodape: string } {
  return marcaDoAcesso(useIdentidadePublica())
}
