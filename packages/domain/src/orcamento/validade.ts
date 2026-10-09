export function isQuoteValid(quote: {
  validUntil?: Date | null
  status: string
}): boolean {
  if (quote.status !== 'PENDING') {
    return false
  }

  if (!quote.validUntil) {
    return true
  }

  return new Date() <= quote.validUntil
}
