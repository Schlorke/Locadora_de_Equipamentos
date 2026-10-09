'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OnboardingStatusResponse } from '@gb-locacoes/contracts/onboarding'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import {
  ChecklistReadError,
  readOnboardingChecklist,
  type ChecklistProblem,
} from '../api/checklist'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; checklist: OnboardingStatusResponse | null }
  | { kind: 'problem'; problem: ChecklistProblem }

export function useOnboardingChecklist(scope: string, enabled: boolean) {
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
    const controller = new AbortController()
    let active = true
    void readOnboardingChecklist(client, controller.signal).then(
      (checklist) => {
        if (active && client.isCurrent())
          setSnapshot({ scope, state: { kind: 'ready', checklist } })
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error))
          setSnapshot({
            scope,
            state: {
              kind: 'problem',
              problem:
                error instanceof ChecklistReadError
                  ? error.problem
                  : 'unavailable',
            },
          })
      }
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [client, scope, enabled, cycle])
  const state: State =
    enabled && snapshot.scope === scope ? snapshot.state : { kind: 'loading' }
  return { state, reload }
}
