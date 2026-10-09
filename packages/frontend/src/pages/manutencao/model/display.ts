export const formatCurrency = (value: number | null) => {
  if (!value) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Não definido'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Data inválida'
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Data inválida'
  }
}
