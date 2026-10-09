'use client'

import { useMemo } from 'react'
import { useScopedApiClient } from '../../../shared/api'
import { createSettingsApi } from './settings'

export function useSettingsApi() {
  const client = useScopedApiClient(null)
  return useMemo(
    () => ({ ...createSettingsApi(client), isCurrent: client.isCurrent }),
    [client]
  )
}
