/** Remove colchetes [] da justificativa de ajuste (ex.: "[Deslocamento (Frete)] Teste" → "Deslocamento (Frete) Teste") */
export function formatAdjustmentReason(
  reason: string | null | undefined
): string {
  if (!reason) return ''
  return reason.replace(/\[|\]/g, '')
}

/** Labels de categoria para exibição dos reajustes. */
export const ADJUSTMENT_CATEGORY_LABELS: Record<string, string> = {
  LABOR: 'Mão de obra',
  TRAVEL: 'Deslocamento (Frete)',
  MAINTENANCE: 'Manutenção',
  OTHER: 'Outro',
}

/**
 * Parseia priceAdjustmentReason em blocos [Categoria] justificativa
 * (fallback quando não há array adjustments).
 */
export function parseAdjustmentBlocks(
  reason: string | null | undefined
): Array<{ category: string; justification: string }> {
  if (!reason?.trim()) return []
  const lines = reason.split(/\r?\n/).filter(Boolean)
  const result: Array<{ category: string; justification: string }> = []
  const regex = /^\[([^\]]+)\]\s*(.*)$/
  for (const line of lines) {
    const match = line.match(regex)
    if (match?.[1] != null) {
      result.push({
        category: match[1].trim(),
        justification: (match[2] ?? '').trim() || '-',
      })
    } else if (line.trim()) {
      result.push({ category: 'Outro', justification: line.trim() })
    }
  }
  return result
}
