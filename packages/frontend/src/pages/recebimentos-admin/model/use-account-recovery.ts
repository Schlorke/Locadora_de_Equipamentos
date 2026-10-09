'use client'
import { useEffect, useRef, useState } from 'react'
import type { AccountRecoveryView } from '@gb-locacoes/contracts/payment-account'
import { readReceivingRecovery } from '../../../entities/conta-recebimentos'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import {
  requestReceivingRecovery,
  ReceivingRecoveryError,
} from '../api/request-recovery'

export function useAccountRecovery(scope: string) {
  const client = useScopedApiClient(scope)
  const current = useRef(scope)
  current.current = scope
  const mounted = useRef(true),
    busy = useRef<{ scope: string } | null>(null)
  const [cycle, setCycle] = useState(0)
  const [snapshot, setSnapshot] = useState<{
    scope: string
    view: AccountRecoveryView | null
    loading: boolean
    failed: boolean
  }>({ scope, view: null, loading: true, failed: false })
  const [action, setAction] = useState<{
    scope: string
    state:
      | 'idle'
      | 'confirmation'
      | 'pending'
      | 'accepted'
      | ReceivingRecoveryError['problem']
  }>({ scope, state: 'idle' })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setSnapshot({ scope, view: null, loading: true, failed: false })
    void readReceivingRecovery(client).then(
      (view) => {
        if (active && client.isCurrent())
          setSnapshot({ scope, view, loading: false, failed: false })
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error))
          setSnapshot({ scope, view: null, loading: false, failed: true })
      }
    )
    return () => {
      active = false
    }
  }, [client, scope, cycle])
  const state =
    snapshot.scope === scope
      ? snapshot
      : { scope, view: null, loading: true, failed: false }
  const actionState = action.scope === scope ? action.state : 'idle'
  const reload = () => {
    if (actionState === 'pending') return
    setAction({ scope, state: 'idle' })
    setCycle((value) => value + 1)
  }
  async function submit() {
    if (
      actionState !== 'confirmation' ||
      !state.view?.canRequest ||
      !client.isCurrent() ||
      busy.current?.scope === scope
    )
      return
    const token = { scope }
    busy.current = token
    setAction({ scope, state: 'pending' })
    try {
      await requestReceivingRecovery(client)
      if (!mounted.current || current.current !== scope || !client.isCurrent())
        return
      setAction({ scope, state: 'accepted' })
      setCycle((value) => value + 1)
    } catch (error) {
      if (
        !mounted.current ||
        current.current !== scope ||
        !client.isCurrent() ||
        isAbortError(error)
      )
        return
      setAction({
        scope,
        state:
          error instanceof ReceivingRecoveryError ? error.problem : 'uncertain',
      })
    } finally {
      if (busy.current === token) busy.current = null
    }
  }
  return {
    ...state,
    action: actionState,
    reload,
    submit,
    confirm: () => {
      if (state.view?.canRequest && client.isCurrent())
        setAction({ scope, state: 'confirmation' })
    },
    cancel: () => {
      if (actionState === 'confirmation') setAction({ scope, state: 'idle' })
    },
  }
}
