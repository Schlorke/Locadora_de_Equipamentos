'use client'

import { useEffect, useRef, useState } from 'react'
import {
  PublicPlanSchema,
  type PublicPlan,
  type SubscriptionSummary,
} from '@gb-locacoes/contracts/subscription'
import { isAbortError, useScopedApiClient } from '../../../shared/api'
import {
  OwnerActionError,
  requestOwnerAction,
  type OwnerAction,
  type OwnerActionProblem,
} from '../api/owner-action'

type Intent = {
  scope: string
  fingerprint: string
  key: string
} & (
  | { action: Exclude<OwnerAction, 'reactivate'> }
  | { action: 'reactivate'; plan: PublicPlan }
)
type State =
  | { kind: 'idle' }
  | { kind: 'accepted'; action: OwnerAction }
  | { kind: 'problem'; problem: OwnerActionProblem }
  | { kind: 'confirm' | 'pending'; intent: Intent }
  | {
      kind: 'uncertain'
      intent: Intent
      open: boolean
      problem: 'uncertain' | 'rate'
    }

function offerMatches(intent: Intent, offers?: PublicPlan[]) {
  if (intent.action !== 'reactivate') return true
  const selected = intent.plan
  const current = PublicPlanSchema.safeParse(
    offers?.find((plan) => plan.planVersionId === selected.planVersionId)
  )
  return (
    current.success && JSON.stringify(current.data) === JSON.stringify(selected)
  )
}

/** Uma confirmação pertence à sessão/locadora e ao resumo que a pessoa revisou. */
export function useOwnerAction({
  scope,
  summary,
  reload,
  newKey,
  offers,
}: {
  scope: string
  summary: SubscriptionSummary | null | undefined
  reload(): void
  newKey(): string
  offers?: PublicPlan[]
}) {
  const client = useScopedApiClient(scope)
  const fingerprint = summary ? JSON.stringify(summary) : null
  const action: Exclude<OwnerAction, 'activate' | 'reactivate'> | null =
    summary && summary.status !== 'CANCELED'
      ? summary.cancelAtPeriodEnd
        ? 'undo-cancel'
        : 'cancel'
      : null
  const canActivate = Boolean(
    summary?.billingMode === 'ASAAS' &&
    ['INCOMPLETE', 'TRIALING'].includes(summary.status) &&
    !summary.cancelAtPeriodEnd &&
    summary.plan.interval === 'MONTHLY' &&
    summary.plan.amount !== '0.00'
  )
  const canReactivate = summary?.status === 'CANCELED'
  const [snapshot, setSnapshot] = useState<{ scope: string; state: State }>({
    scope,
    state: { kind: 'idle' },
  })
  const busy = useRef<Intent | null>(null)
  const current = useRef({ scope, fingerprint, offers })
  current.current = { scope, fingerprint, offers }
  let state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'idle' }
  if (
    'intent' in state &&
    (summary === null ||
      (fingerprint !== null && state.intent.fingerprint !== fingerprint) ||
      (state.kind === 'confirm' && !offerMatches(state.intent, offers)))
  )
    state = { kind: 'idle' }
  const stateRef = useRef(state)
  stateRef.current = state
  useEffect(() => {
    if (snapshot.scope !== scope || state !== snapshot.state)
      setSnapshot({ scope, state: { kind: 'idle' } })
  }, [scope, snapshot, state])

  const set = (next: State) => setSnapshot({ scope, state: next })
  function canStart(requested: OwnerAction) {
    return (
      (requested === 'activate'
        ? canActivate
        : requested === 'reactivate'
          ? canReactivate &&
            (Boolean(offers?.length) || stateRef.current.kind === 'uncertain')
          : requested === action) &&
      busy.current?.scope !== scope &&
      (!('intent' in stateRef.current) ||
        stateRef.current.intent.action === requested)
    )
  }
  function begin(
    requested: OwnerAction | null = action,
    planVersionId?: string
  ) {
    if (!requested || !canStart(requested) || !fingerprint) return
    const previous = stateRef.current
    if (previous.kind === 'uncertain') {
      set({ ...previous, open: true })
      return
    }
    const plan =
      requested === 'reactivate'
        ? offers?.find(
            (offer) =>
              offer.planVersionId === planVersionId &&
              offer.interval === 'MONTHLY'
          )
        : undefined
    try {
      let intent: Intent
      if (requested === 'reactivate') {
        if (!plan) return
        intent = {
          scope,
          fingerprint,
          action: requested,
          key: newKey(),
          plan: PublicPlanSchema.parse(plan),
        }
      } else intent = { scope, fingerprint, action: requested, key: newKey() }
      set({
        kind: 'confirm',
        intent,
      })
    } catch {
      set({ kind: 'problem', problem: 'uncertain' })
    }
  }
  function dismiss() {
    if (busy.current?.scope === scope) return
    const value = stateRef.current
    set(
      value.kind === 'uncertain' ? { ...value, open: false } : { kind: 'idle' }
    )
  }
  async function confirm() {
    const value = stateRef.current
    if (value.kind !== 'confirm' && value.kind !== 'uncertain') return
    const intent = value.intent
    if (
      busy.current?.scope === scope ||
      !client.isCurrent() ||
      current.current.scope !== intent.scope ||
      current.current.fingerprint !== intent.fingerprint
    )
      return
    if (
      value.kind === 'confirm' &&
      !offerMatches(intent, current.current.offers)
    )
      return
    busy.current = intent
    set({ kind: 'pending', intent })
    const stillCurrent = () =>
      client.isCurrent() &&
      current.current.scope === intent.scope &&
      current.current.fingerprint === intent.fingerprint
    try {
      if (intent.action === 'reactivate')
        await requestOwnerAction(client, intent.action, intent.key, {
          planVersionId: intent.plan.planVersionId,
        })
      else await requestOwnerAction(client, intent.action, intent.key)
      if (!stillCurrent()) return
      set({ kind: 'accepted', action: intent.action })
      reload()
    } catch (error) {
      if (!stillCurrent() || isAbortError(error)) return
      const problem =
        error instanceof OwnerActionError ? error.problem : 'uncertain'
      if (problem === 'uncertain' || problem === 'rate')
        set({ kind: 'uncertain', intent, open: true, problem })
      else {
        set({ kind: 'problem', problem })
        if (problem !== 'reauthentication') reload()
      }
    } finally {
      if (busy.current === intent) busy.current = null
    }
  }
  return {
    state,
    action,
    canActivate,
    canReactivate,
    canStart,
    begin,
    dismiss,
    confirm,
    isBusy: state.kind === 'pending',
    dialogOpen:
      state.kind === 'confirm' ||
      state.kind === 'pending' ||
      (state.kind === 'uncertain' && state.open),
  }
}
