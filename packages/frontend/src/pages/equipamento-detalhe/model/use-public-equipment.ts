import { useEffect, useMemo, useState } from 'react'
import type { PublicEquipment } from '@gb-locacoes/contracts'
import {
  HttpError,
  isAbortError,
  useScopedApiClient,
} from '../../../shared/api'
import { createPublicEquipmentApi } from '../api/public-equipment'

export function usePublicEquipment(id: string, tenantSlug: string | null) {
  const client = useScopedApiClient(tenantSlug)
  const api = useMemo(() => createPublicEquipmentApi(client), [client])
  const [state, setState] = useState<{
    loading: boolean
    equipment: PublicEquipment | null
    error: string | null
  }>({ loading: true, equipment: null, error: null })
  const [revision, retry] = useState(0)
  useEffect(() => {
    let active = true
    setState({ loading: true, equipment: null, error: null })
    api
      .read(tenantSlug, id)
      .then((equipment) => {
        if (active) setState({ loading: false, equipment, error: null })
      })
      .catch((error) => {
        if (active && !isAbortError(error))
          setState({
            loading: false,
            equipment: null,
            // Site da locadora em pausa (503 SITE_PAUSED, S13) ou indisponível: a mensagem neutra do backend.
            error:
              error instanceof HttpError && error.status === 503
                ? error.message
                : 'Não foi possível carregar o equipamento. Tente novamente.',
          })
      })
    return () => {
      active = false
    }
  }, [api, tenantSlug, id, revision])
  return { ...state, retry: () => retry((n) => n + 1) }
}
