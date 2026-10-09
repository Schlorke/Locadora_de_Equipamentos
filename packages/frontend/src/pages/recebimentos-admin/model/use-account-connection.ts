'use client'
import { useEffect, useRef, useState } from 'react'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import {
  connectReceivingAccount,
  ReceivingConnectError,
  type ReceivingConnectProblem,
} from '../api/connect-account'

type State =
  | { kind: 'idle' | 'editing' | 'pending' | 'accepted' }
  | { kind: 'problem'; problem: ReceivingConnectProblem }

/** Scope and transport govern the action. Credentials never become model state or retry intents. */
export function useAccountConnection({
  scope,
  available,
  reload,
}: {
  scope: string
  available: boolean
  reload(): void
}) {
  const client = useScopedApiClient(scope)
  const [snapshot, setSnapshot] = useState<{ scope: string; state: State }>({
    scope,
    state: { kind: 'idle' },
  })
  const current = useRef({ scope, available })
  current.current = { scope, available }
  const busy = useRef<{ scope: string } | null>(null)
  const state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'idle' }
  useEffect(() => {
    if (snapshot.scope !== scope)
      setSnapshot({ scope, state: { kind: 'idle' } })
  }, [scope, snapshot.scope])
  const stateRef = useRef(state)
  stateRef.current = state
  const editable =
    state.kind === 'editing' ||
    (state.kind === 'problem' &&
      ['key', 'rejected', 'environment', 'rate'].includes(state.problem))
  function begin() {
    if (available && stateRef.current.kind === 'idle' && client.isCurrent())
      setSnapshot({ scope, state: { kind: 'editing' } })
  }
  function dismiss() {
    if (busy.current?.scope !== scope && editable)
      setSnapshot({ scope, state: { kind: 'idle' } })
  }
  async function submit(apiKey: string) {
    if (
      !available ||
      !editable ||
      !client.isCurrent() ||
      busy.current?.scope === scope
    )
      return
    const request = { scope }
    busy.current = request
    setSnapshot({ scope, state: { kind: 'pending' } })
    const stillCurrent = () =>
      client.isCurrent() && current.current.scope === scope
    try {
      await connectReceivingAccount(client, apiKey)
      if (!stillCurrent()) return
      setSnapshot({ scope, state: { kind: 'accepted' } })
      reload()
    } catch (error) {
      if (!stillCurrent() || isAbortError(error)) return
      setSnapshot({
        scope,
        state: {
          kind: 'problem',
          problem:
            error instanceof ReceivingConnectError
              ? error.problem
              : 'uncertain',
        },
      })
    } finally {
      if (busy.current === request) busy.current = null
    }
  }
  return { state, begin, dismiss, submit, editable }
}
