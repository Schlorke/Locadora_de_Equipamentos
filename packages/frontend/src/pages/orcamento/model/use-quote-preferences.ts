import { useEffect, useState } from 'react'
import { toast } from '../../../shared/lib/toast'
import { useSession } from '../../../entities/sessao'
import { usePublicTenantSlug } from '../../../entities/organizacao'
import type {
  QuotePreferences,
  QuotePreferenceStorage,
} from './quote-page-contract'

/** Adaptador da persistência assíncrona. A chave comercial é a mesma do web. */
export function useQuotePreferences(storage: QuotePreferenceStorage) {
  const slug = usePublicTenantSlug(),
    { data: session } = useSession()
  const scope = JSON.stringify([slug, session?.user?.id])
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<{
    scope: string
    storage: QuotePreferenceStorage
    value?: QuotePreferences
    error?: string
  }>()
  useEffect(() => {
    let active = true
    const keys = ['addressConfirmationDismissed', 'customerInfoDismissed'].map(
      (name) => name + ':' + scope
    )
    void Promise.all(keys.map((key) => storage.getItem(key)))
      .then((values) => {
        if (!active) return
        const cache = new Map(
          keys.map((key, index) => [key, values[index] ?? null])
        )
        const failed = () => {
          if (active)
            toast.error('Não foi possível salvar a preferência de confirmação.')
        }
        setLoaded({
          scope,
          storage,
          value: {
            getItem: (key) => cache.get(key) ?? null,
            setItem: (key, value) => {
              cache.set(key, value)
              void storage.setItem(key, value).catch(failed)
            },
            removeItem: (key) => {
              cache.delete(key)
              void storage.removeItem(key).catch(failed)
            },
          },
        })
      })
      .catch(() => {
        if (active)
          setLoaded({
            scope,
            storage,
            error: 'Não foi possível carregar suas preferências.',
          })
      })
    return () => {
      active = false
    }
  }, [scope, storage, retry])
  const current =
    loaded?.scope === scope && loaded.storage === storage ? loaded : undefined
  return {
    preferences: current?.value,
    error: current?.error,
    retry: () => setRetry((n) => n + 1),
  }
}
