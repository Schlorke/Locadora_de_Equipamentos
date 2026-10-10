/**
 * Shared formatting utilities used across admin pages.
 * Copiado da antiga lib/utils/formatting.ts, retirada em F — getInitials distinto de cópias locais
 * em pages (não unificar se divergirem).
 */

/** Extract initials from a person's name. */
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

/** Format a number as Brazilian Real currency (BRL). */
export { formatCurrency } from './moeda'

/** Convert a date string or Date to YYYY-MM-DD format for HTML date inputs. */
export function formatDateForInput(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Convert a YYYY-MM-DD input value to an ISO string at local noon. */
export function dueDateInputToISOString(value: string) {
  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0)
  return localNoon.toISOString()
}
