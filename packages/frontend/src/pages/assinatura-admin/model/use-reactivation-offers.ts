'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PublicPlan } from '@gb-locacoes/contracts/subscription'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import { readReactivationOffers } from '../api/reactivation-offers'

type State =
  { kind: 'loading' | 'unavailable' } | { kind: 'ready'; plans: PublicPlan[] }

export function useReactivationOffers(scope: string, enabled: boolean) {
  const client = useScopedApiClient(scope)
  const [cycle, setCycle] = useState(0)
  const [snapshot, setSnapshot] = useState<{ scope: string; state: State }>({
    scope,
    state: { kind: 'loading' },
  })
  const reload = useCallback(() => {
    setSnapshot({ scope, state: { kind: 'loading' } })
    setCycle((value) => value + 1)
  }, [scope])
  useEffect(() => {
    if (!enabled) return
    let active = true
    void readReactivationOffers(client).then(
      (plans) => {
        if (active && client.isCurrent())
          setSnapshot({ scope, state: { kind: 'ready', plans } })
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error))
          setSnapshot({ scope, state: { kind: 'unavailable' } })
      }
    )
    return () => {
      active = false
    }
  }, [client, cycle, enabled, scope])
  const state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'loading' }
  return { state, reload }
}
