'use client'
import { useEffect, useRef, useState } from 'react'
import type { PaymentAccountCreationOffer } from '@gb-locacoes/contracts/payment-account'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import { readCreationOffer } from '../api/creation-offer'
import {
  requestReceivingAccount,
  ReceivingCreateError,
  type ReceivingCreateProblem,
} from '../api/create-account'

type State =
  | { kind: 'idle' | 'editing' | 'pending' | 'accepted' }
  | { kind: 'problem'; problem: ReceivingCreateProblem }

/** Problems that leave the form open for a correction; everything else only allows reading the state again. */
const EDITABLE: readonly ReceivingCreateProblem[] = ['input', 'rate']

/**
 * Offer and request of the receiving account, bound to the current scope and transport like the connection. The
 * typed values never become model state: they are passed once to `submit` and never retried after an
 * unconfirmed outcome.
 */
export function useAccountCreation({
  scope,
  enabled,
  reload,
}: {
  scope: string
  enabled: boolean
  reload(): void
}) {
  const client = useScopedApiClient(scope)
  const [offer, setOffer] = useState<{
    scope: string
    value: PaymentAccountCreationOffer | null
  } | null>(null)
  const [snapshot, setSnapshot] = useState<{ scope: string; state: State }>({
    scope,
    state: { kind: 'idle' },
  })
  const current = useRef(scope)
  current.current = scope
  const busy = useRef<{ scope: string } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    /**
     * A fresh offer is read only after the account read found no current account: a request accepted before
     * was returned or cancelled (decision D-3), so its acceptance gives way to the offer and its outcome.
     */
    const settle = (value: PaymentAccountCreationOffer | null) => {
      setOffer({ scope, value })
      setSnapshot((previous) =>
        previous.scope === scope && previous.state.kind === 'accepted'
          ? { scope, state: { kind: 'idle' } }
          : previous
      )
    }
    void readCreationOffer(client).then(
      (value) => {
        if (active && client.isCurrent()) settle(value)
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error)) settle(null)
      }
    )
    return () => {
      active = false
    }
  }, [client, enabled, scope])
  useEffect(() => {
    if (snapshot.scope !== scope)
      setSnapshot({ scope, state: { kind: 'idle' } })
  }, [scope, snapshot.scope])
  const state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'idle' }
  const currentOffer = enabled && offer?.scope === scope ? offer.value : null
  const stateRef = useRef(state)
  stateRef.current = state
  const available = currentOffer?.available === true
  const editable =
    state.kind === 'editing' ||
    (state.kind === 'problem' && EDITABLE.includes(state.problem))
  function begin() {
    if (available && stateRef.current.kind === 'idle' && client.isCurrent())
      setSnapshot({ scope, state: { kind: 'editing' } })
  }
  function dismiss() {
    if (busy.current?.scope !== scope && editable)
      setSnapshot({ scope, state: { kind: 'idle' } })
  }
  /** Reads the state again; a new request always starts from an empty form. */
  function refresh() {
    if (busy.current?.scope === scope) return
    setSnapshot({ scope, state: { kind: 'idle' } })
    reload()
  }
  async function submit(values: { incomeValue: string; mobilePhone: string }) {
    const version = currentOffer?.companyDataVersion
    if (
      !available ||
      !version ||
      !editable ||
      !client.isCurrent() ||
      busy.current?.scope === scope
    )
      return
    const request = { scope }
    busy.current = request
    setSnapshot({ scope, state: { kind: 'pending' } })
    const stillCurrent = () => client.isCurrent() && current.current === scope
    try {
      await requestReceivingAccount(client, {
        ...values,
        companyDataVersion: version,
      })
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
            error instanceof ReceivingCreateError ? error.problem : 'uncertain',
        },
      })
    } finally {
      if (busy.current === request) busy.current = null
    }
  }
  return {
    offer: currentOffer,
    state,
    begin,
    dismiss,
    refresh,
    submit,
    editable,
  }
}
