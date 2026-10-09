export const getTypeLabel = (type: string) => {
  switch (type) {
    case 'quote':
      return 'Orçamento'
    case 'equipment':
      return 'Equipamento'
    case 'payment':
      return 'Pagamento'
    case 'system':
      return 'Sistema'
    default:
      return 'Geral'
  }
}

export const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60)
  )

  if (diffInMinutes < 1) return 'Agora mesmo'
  if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`
  return `${Math.floor(diffInMinutes / 1440)}d atrás`
}
