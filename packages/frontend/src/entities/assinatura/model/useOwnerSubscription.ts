'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTenantContext } from '../../organizacao/@x/assinatura'
import { useSession } from '../../sessao/@x/assinatura'
import {
  isAbortError,
  useApiClientRevision,
  useScopedApiClient,
} from '../../../shared/api'
import {
  OwnerReadError,
  readOwnerAccount,
  type OwnerReadProblem,
} from '../api/owner-account'
import type {
  SubscriptionSummary,
  PlatformInvoice,
} from '@gb-locacoes/contracts/subscription'

type ReadState =
  | { kind: 'loading' }
  | { kind: 'problem'; problem: OwnerReadProblem }
  | {
      kind: 'ready'
      summary: SubscriptionSummary | null
      invoices: PlatformInvoice[] | null
    }

/** ADMIN autoriza a tentativa; só a resposta do servidor confirma o dono. */
export function useOwnerSubscription({
  includeInvoices = false,
}: { includeInvoices?: boolean } = {}) {
  const tenant = useTenantContext(),
    { data: session, status } = useSession()
  const transportRevision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.membershipId,
    tenant?.role,
    tenant?.tenant.status,
    session?.user.id,
    status,
    transportRevision,
    includeInvoices,
  ])
  const eligible =
    status === 'authenticated' &&
    Boolean(session?.user.id) &&
    tenant?.role === 'ADMIN' &&
    tenant.tenant.status === 'ACTIVE'
  const client = useScopedApiClient(scope)
  const [cycle, setCycle] = useState(0)
  const [snapshot, setSnapshot] = useState<{ scope: string; state: ReadState }>(
    { scope, state: { kind: 'loading' } }
  )
  const reload = useCallback(() => {
    setSnapshot({ scope, state: { kind: 'loading' } })
    setCycle((value) => value + 1)
  }, [scope])
  useEffect(() => {
    if (!eligible) return
    let active = true
    void readOwnerAccount(client, includeInvoices).then(
      (account) => {
        if (active && client.isCurrent())
          setSnapshot({ scope, state: { kind: 'ready', ...account } })
      },
      (error) => {
        if (active && client.isCurrent() && !isAbortError(error))
          setSnapshot({
            scope,
            state: {
              kind: 'problem',
              problem:
                error instanceof OwnerReadError ? error.problem : 'unavailable',
            },
          })
      }
    )
    return () => {
      active = false
    }
  }, [client, cycle, eligible, includeInvoices, scope])
  let state: ReadState =
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
