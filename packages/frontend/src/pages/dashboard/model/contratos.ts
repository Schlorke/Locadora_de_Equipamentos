export type {
  DashboardStats,
  RecentQuote,
  RevenueData,
  AgingData,
} from './types'

export function getInitials(name: string): string | null {
  const n = (name || '').trim()
  if (!n || n === '-') return null
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    const s = ((a ?? '') + (b ?? '')).toUpperCase().slice(0, 2)
    return s || null
  }
  const c = parts[0]?.[0]
  return c ? c.toUpperCase() : null
}
