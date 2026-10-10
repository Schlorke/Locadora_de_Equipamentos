/** Mesmo formato observado nas antigas lib/utils.ts e lib/utils/formatting.ts, retiradas em F. */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
