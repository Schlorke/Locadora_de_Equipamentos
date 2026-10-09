'use client'

import { useRef, useState } from 'react'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import {
  requestSitePublication,
  SitePublicationError,
  type PublicationProblem,
} from '../api/publication'

type State =
  | { kind: 'idle' | 'confirm' | 'pending' | 'accepted' }
  | { kind: 'problem'; problem: Exclude<PublicationProblem, 'uncertain'> }
  | { kind: 'uncertain'; open: boolean }

/** A confirmação é descartada ao desmontar/trocar o escopo; nunca há POST automático. */
export function useSitePublication(scope: string, onPublished: () => void) {
  const client = useScopedApiClient(scope)
  const [snapshot, setSnapshot] = useState<{ scope: string; state: State }>({
    scope,
    state: { kind: 'idle' },
  })
  const state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'idle' }
  const setState = (next: State) => setSnapshot({ scope, state: next })
  const liveScope = useRef(scope)
  liveScope.current = scope
  const current = useRef<State>(state)
  current.current = state
  const busy = useRef<{ scope: string } | null>(null)
  const callback = useRef(onPublished)
  callback.current = onPublished
  function begin() {
    if (
      liveScope.current !== scope ||
      !client.isCurrent() ||
      busy.current?.scope === scope
    )
      return
    const next: State =
      current.current.kind === 'uncertain'
        ? { kind: 'uncertain', open: true }
        : { kind: 'confirm' }
    current.current = next
    setState(next)
  }
  function dismiss() {
    if (liveScope.current !== scope || busy.current?.scope === scope) return
    const next: State =
      current.current.kind === 'uncertain'
        ? { kind: 'uncertain', open: false }
        : { kind: 'idle' }
    current.current = next
    setState(next)
  }
  async function confirm() {
    const previous = current.current
    if (
      liveScope.current !== scope ||
      !client.isCurrent() ||
      busy.current?.scope === scope ||
      !(
        previous.kind === 'confirm' ||
        (previous.kind === 'uncertain' && previous.open)
      )
    )
      return
    const attempt = { scope }
    busy.current = attempt
    const pending: State = { kind: 'pending' }
    current.current = pending
    setState(pending)
    try {
      await requestSitePublication(client)
      if (liveScope.current !== scope || !client.isCurrent()) return
      const accepted: State = { kind: 'accepted' }
      current.current = accepted
      setState(accepted)
      callback.current()
    } catch (error) {
      if (
        liveScope.current !== scope ||
        !client.isCurrent() ||
        isAbortError(error)
      )
        return
      const problem =
        error instanceof SitePublicationError ? error.problem : 'uncertain'
      const next: State =
        problem === 'uncertain'
          ? { kind: 'uncertain', open: true }
          : { kind: 'problem', problem }
      current.current = next
      setState(next)
    } finally {
      if (busy.current === attempt) busy.current = null
    }
  }
  return {
    state,
    begin,
    dismiss,
    confirm,
    busy: state.kind === 'pending',
    dialogOpen:
      state.kind === 'confirm' ||
      state.kind === 'pending' ||
      (state.kind === 'uncertain' && state.open),
  }
}
