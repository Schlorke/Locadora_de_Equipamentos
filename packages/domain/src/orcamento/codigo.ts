export function formatQuoteCode(year: number, sequence: number): string {
  return `Q-${year}-${String(sequence).padStart(4, '0')}`
}

export function parseQuoteCodeSequence(
  code: string | null | undefined
): number {
  if (!code) return 0
  const match = code.match(/^Q-\d{4}-(\d{4,})$/)
  if (!match?.[1]) return 0
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : 0
}
