'use client'

import { useEffect, useState } from 'react'

/**
 * Hook para adicionar debounce em valores que mudam frequentemente
 * Útil para otimizar performance em buscas e filtros
 *
 * @param value - O valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 350ms)
 * @returns O valor debounced que só atualiza após o delay
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearchTerm = useDebounce(searchTerm, 350)
 *
 * useEffect(() => {
 *   // Esta busca só executa 350ms após o usuário parar de digitar
 *   fetchResults(debouncedSearchTerm)
 * }, [debouncedSearchTerm])
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
