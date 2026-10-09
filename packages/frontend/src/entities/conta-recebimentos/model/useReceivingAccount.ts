'use client'
import { useCallback, useEffect, useState } from 'react'
import { useTenantContext } from '../../organizacao/@x/conta-recebimentos'
import { useSession } from '../../sessao/@x/conta-recebimentos'
import {
  isAbortError,
  useApiClientRevision,
  useScopedApiClient,
} from '../../../shared/api'
import type { PaymentAccountView } from '@gb-locacoes/contracts/payment-account'
import {
  readReceivingAccount,
  ReceivingReadError,
  type ReceivingReadProblem,
} from '../api/owner-account'

type State =
  | { kind: 'loading' }
  | { kind: 'problem'; problem: ReceivingReadProblem }
  | { kind: 'ready'; account: PaymentAccountView | null }

export function useReceivingAccount() {
  const tenant = useTenantContext(),
    { data: session, status } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.membershipId,
    tenant?.role,
    tenant?.tenant.status,
    session?.user.id,
    status,
    revision,
  ])
  const eligible =
    status === 'authenticated' &&
    Boolean(session?.user.id) &&
    tenant?.role === 'ADMIN' &&
    tenant.tenant.status === 'ACTIVE'
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
    if (!eligible) return
    let active = true
    void readReceivingAccount(client).then(
      (value) => {
        if (active && client.isCurrent())
          setSnapshot({
            scope,
            state: { kind: 'ready', account: value.account },
          })
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error))
          setSnapshot({
            scope,
            state: {
              kind: 'problem',
              problem:
                error instanceof ReceivingReadError
                  ? error.problem
                  : 'unavailable',
            },
          })
      }
    )
    return () => {
      active = false
    }
  }, [client, cycle, eligible, scope])
  let state: State =
    snapshot.scope === scope ? snapshot.state : { kind: 'loading' }
  if (status === 'loading') state = { kind: 'loading' }
  else if (!session?.user.id || status !== 'authenticated')
    state = { kind: 'problem', problem: 'session' }
  else if (!tenant) state = { kind: 'problem', problem: 'selection' }
  else if (!eligible) state = { kind: 'problem', problem: 'owner' }
  return {
    state,
    reload,
    scope,
    tenantName: tenant?.tenant.name,
    tenantSlug: tenant?.tenant.slug,
  }
}
