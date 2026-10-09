/**
 * Normalização de endereços (from/to) retornados pela API Zoho Mail.
 * A API pode devolver strings ("Nome <email@x.com>"), objetos ou nomes de campo diferentes (fromAddress, sender).
 * Este módulo unifica o formato para { displayName?, emailAddress? }.
 */

type AddressEntry = { emailAddress?: string; displayName?: string }

function hasValidAddress(entry: AddressEntry): boolean {
  const email = entry.emailAddress?.trim()
  const name = entry.displayName?.trim()
  return Boolean(email ?? name)
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseAddressString(value: string): AddressEntry | null {
  const decoded = decodeHtmlEntities(value).trim()
  if (!decoded) return null
  const match = decoded.match(/^(?:"?([^"]+)"?\s*)?<([^>]+)>$/)
  if (match) {
    const displayName = match[1]?.trim() || undefined
    const emailAddress = match[2]?.trim() || undefined
    return hasValidAddress({ emailAddress, displayName })
      ? { emailAddress, displayName }
      : null
  }
  if (decoded.includes('@')) {
    return { emailAddress: decoded }
  }
  return { displayName: decoded }
}

/**
 * Converte o remetente (fromAddress/sender) da Zoho em { displayName?, emailAddress? }.
 * Aceita string ("Nome <email@x.com>"), objeto ou null/undefined.
 */
export function normalizeFromAddress(value: unknown): AddressEntry | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const parsed = parseAddressString(value)
    return parsed ?? { emailAddress: decodeHtmlEntities(value).trim() }
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const entry: AddressEntry = {
      emailAddress:
        typeof o.emailAddress === 'string' ? o.emailAddress : undefined,
      displayName:
        typeof o.displayName === 'string' ? o.displayName : undefined,
    }
    return hasValidAddress(entry) ? entry : undefined
  }
  return undefined
}
