'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useApiClientRevision } from '../../../shared/api'
import { useSession } from '../../../entities/sessao'

export function useEquipmentScope(record: string | null) {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session, status } = useSession()
  const revision = useApiClientRevision()
  return JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    status,
    revision,
    record,
  ])
}
