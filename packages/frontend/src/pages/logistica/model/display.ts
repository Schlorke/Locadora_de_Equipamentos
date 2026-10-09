import type { Delivery } from './contracts'

export function formatDate(dateString: string | null | undefined) {
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

export function formatAddress(address: Delivery['address']) {
  const parts = [
    address.street,
    address.number,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Endereço não informado'
}
