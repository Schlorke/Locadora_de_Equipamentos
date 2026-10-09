'use client'
import { useEffect, useState } from 'react'
import { useApiClient } from '../../../shared/api'
export interface OpenAPIMethodSpec {
  summary?: string
  description?: string
  tags?: string[]
  parameters?: unknown[]
  responses?: Record<string, unknown>
  requestBody?: unknown
}

export interface OpenAPISpec {
  info: {
    title: string
    version: string
    description: string
  }
  paths: Record<string, Record<string, OpenAPIMethodSpec>>
  servers: Array<{
    url: string
    description: string
  }>
}

export function useApiDocs() {
  const api = useApiClient(),
    [spec, setSpec] = useState<OpenAPISpec | null>(null),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api
      .request<OpenAPISpec>('/openapi.json', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setSpec(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSpec(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api])
  return { spec, loading }
}
