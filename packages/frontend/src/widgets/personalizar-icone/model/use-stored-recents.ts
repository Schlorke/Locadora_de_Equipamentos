'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { keyValueStorage } from '../../../shared/storage'

export function useStoredRecents<T extends string>(key: string, limit: number, normalize: (value: unknown) => T | null) {
  const [recents, setRecents] = useState<T[]>([])
  const [ready, setReady] = useState(false)
  const revision = useRef(0)
  useEffect(() => {
    let active = true
    const initialRevision = revision.current
    Promise.resolve().then(() => keyValueStorage.getItem(key)).then(raw => {
      if (!active || revision.current !== initialRevision || !raw) return
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setRecents([...new Set(parsed.map(normalize).filter((value): value is T => value !== null))].slice(0, limit))
    }).catch(() => {}).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [key, limit, normalize])
  useEffect(() => {
    if (!ready) return
    Promise.resolve().then(() => recents.length ? keyValueStorage.setItem(key, JSON.stringify(recents)) : keyValueStorage.removeItem(key)).catch(() => {})
  }, [key, ready, recents])
  const add = useCallback((value: T) => {
    const normalized = normalize(value)
    if (!normalized) return
    revision.current += 1
    setRecents(previous => [normalized, ...previous.filter(item => item !== normalized)].slice(0, limit))
  }, [normalize, limit])
  const clear = useCallback(() => { revision.current += 1; setRecents([]) }, [])
  return { recents, add, clear }
}
