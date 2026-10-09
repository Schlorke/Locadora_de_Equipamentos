export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateString: string | null | undefined) {
  if (!dateString) return 'Não definido'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return 'Data inválida'
  }
}
